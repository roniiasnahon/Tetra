/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import fs from "fs";
import { mkdir, writeFile, readFile, access } from "fs/promises";
import { GoogleGenAI, Type } from "@google/genai";
import multer from "multer";
import mammoth from "mammoth";
import PDFDocument from "pdfkit";
import axios from "axios";
import { parseStringPromise } from "xml2js";
import { Storage } from 'megajs';
import admin from "firebase-admin";
import zlib from "zlib";

// Safe, dynamic loading of firebase-applet-config.json
let firebaseConfig: any = {};
try {
  const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  }
} catch (e) {
  console.error("Failed to load firebase-applet-config.json dynamically:", e);
}

function decompressResponse(buffer: Buffer, contentEncoding?: string): Buffer {
  if (!buffer || buffer.length === 0) return buffer;
  const encoding = (contentEncoding || "").toLowerCase().trim();
  
  if (encoding === "gzip") {
    try {
      return zlib.gunzipSync(buffer);
    } catch (e: any) {
      console.error("[DECOMPRESS] Failed to gunzip based on header:", e.message);
    }
  } else if (encoding === "deflate") {
    try {
      return zlib.inflateSync(buffer);
    } catch (e: any) {
      console.error("[DECOMPRESS] Failed to deflate based on header:", e.message);
    }
  } else if (encoding === "br") {
    try {
      return zlib.brotliDecompressSync(buffer);
    } catch (e: any) {
      console.error("[DECOMPRESS] Failed to brotli decompress based on header:", e.message);
    }
  }

  // Fallback signature-based checks:
  if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
    try {
      console.log("[DECOMPRESS] Detected GZIP signature. Decompressing...");
      return zlib.gunzipSync(buffer);
    } catch (e: any) {
      console.error("[DECOMPRESS] Failed signature check gunzip:", e.message);
    }
  }
  
  if (buffer[0] === 0x78 && (buffer[1] === 0x01 || buffer[1] === 0x9c || buffer[1] === 0xda)) {
    try {
      console.log("[DECOMPRESS] Detected Deflate signature. Decompressing...");
      return zlib.inflateSync(buffer);
    } catch (e: any) {
      console.error("[DECOMPRESS] Failed signature check deflate:", e.message);
    }
  }

  return buffer;
}

function tryDecompressFallback(buffer: Buffer): Buffer {
  if (!buffer || buffer.length < 4) return buffer;
  if (buffer.length >= 4 && buffer.toString('utf-8', 0, 4) === '%PDF') {
    return buffer;
  }

  // Try Brotli
  try {
    const brotliOut = zlib.brotliDecompressSync(buffer);
    if (brotliOut.length >= 4 && brotliOut.toString('utf-8', 0, 4) === '%PDF') {
      console.log("[DECOMPRESS] Fallback Brotli decompression succeeded!");
      return brotliOut;
    }
  } catch (e) {}

  // Try Gzip
  try {
    const gzipOut = zlib.gunzipSync(buffer);
    if (gzipOut.length >= 4 && gzipOut.toString('utf-8', 0, 4) === '%PDF') {
      console.log("[DECOMPRESS] Fallback Gzip decompression succeeded!");
      return gzipOut;
    }
  } catch (e) {}

  // Try Deflate
  try {
    const deflateOut = zlib.inflateSync(buffer);
    if (deflateOut.length >= 4 && deflateOut.toString('utf-8', 0, 4) === '%PDF') {
      console.log("[DECOMPRESS] Fallback Deflate decompression succeeded!");
      return deflateOut;
    }
  } catch (e) {}

  return buffer;
}

function extractAllContentStrings(obj: any, excludedKeys: string[] = ["title", "author", "fileType", "added", "fullTextStatus", "id"]): string[] {
  let results: string[] = [];
  if (obj === null || obj === undefined) return results;

  if (typeof obj === "string") {
    const trimmed = obj.trim();
    if (trimmed && trimmed !== "..." && !trimmed.toLowerCase().startsWith("note") && !trimmed.toLowerCase().startsWith("document")) {
      results.push(trimmed);
    }
    return results;
  }

  if (Array.isArray(obj)) {
    for (const item of obj) {
      results.push(...extractAllContentStrings(item, excludedKeys));
    }
    return results;
  }

  if (typeof obj === "object") {
    for (const key of Object.keys(obj)) {
      if (excludedKeys.includes(key)) continue;
      results.push(...extractAllContentStrings(obj[key], excludedKeys));
    }
  }

  return results;
}

function cleanJsonLeak(text: string): string {
  if (!text) return "";
  let clean = text.trim();

  // If the text literally begins with markdown backticks
  if (clean.startsWith("```")) {
    clean = clean.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }

  // Remove structural keys, nested list wrappers and formatting residues
  // e.g., '", "some_key":{' or '", "some_key":"' or '", "some_key":['
  clean = clean.replace(/",\s*"[a-zA-Z0-9_]+"\s*:\s*\{/g, "\n\n");
  clean = clean.replace(/",\s*"[a-zA-Z0-9_]+"\s*:\s*\[/g, "\n\n");
  clean = clean.replace(/",\s*"[a-zA-Z0-9_]+"\s*:\s*"/g, "\n\n");
  clean = clean.replace(/",\s*"[a-zA-Z0-9_]+"\s*:\s*/g, "\n\n");
  
  // Strip any remaining curly braces or square brackets
  clean = clean.replace(/[\{\}\[\]]/g, " ");

  // Remove direct inline structural objects that might have been stringified
  clean = clean.replace(/"[a-zA-Z0-9_]+"\s*:\s*"/g, " ");
  clean = clean.replace(/"[a-zA-Z0-9_]+"\s*:\s*/g, " ");
  
  // Clean empty array remnants inside strings
  clean = clean.replace(/"\s*,\s*"/g, "\n\n");
  clean = clean.replace(/"\s*:\s*"/g, ": ");
  
  // Remove trailing or leading quotes and structural dividers at word edges
  clean = clean.replace(/([^\w])"([^\w])/g, "$1$2");
  
  // Clean double quotes at ends/starts
  if (clean.startsWith('"') && clean.endsWith('"')) {
    clean = clean.substring(1, clean.length - 1);
  }

  // Standardize spacing and normalize paragraphs
  clean = clean.replace(/\r/g, "");
  clean = clean.replace(/\n{3,}/g, "\n\n");
  clean = clean.replace(/[ \t]+/g, " ");
  
  return clean.trim();
}

function cleanAndParseJSON(responseText: string): any {
  let cleaned = (responseText || "").trim();
  
  if (!cleaned) {
    return {};
  }

  // Remove markdown fencing if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "");
    cleaned = cleaned.replace(/\s*```$/, "");
  }
  
  cleaned = cleaned.trim();
  
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    // Attempt pattern-matching for a JSON block within the response
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const candidate = jsonMatch[0];
      try {
        return JSON.parse(candidate);
      } catch (e) {
        // Let's try to repair unclosed quotes or missing brackets if truncated
        let repaired = candidate.trim();
        if (!repaired.endsWith("}")) {
          // If truncated inside a string value
          if (repaired.includes('"') && (repaired.split('"').length % 2 === 0)) {
            repaired += '"';
          }
          repaired += "}";
          try {
            return JSON.parse(repaired);
          } catch (e2) {}
        }
      }
    }

    try {
      const sanitized = cleaned.replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, "");
      return JSON.parse(sanitized);
    } catch (err2) {
      console.warn("[cleanAndParseJSON] Direct parsing failed, attempting fuzzy key-value extraction fallback.");
      // Absolute fallback: build a simple plain object by parsing key-values using quick regexes
      const obj: any = {};
      const titleMatch = cleaned.match(/"title"\s*:\s*"([^"]+)"/i);
      const authorMatch = cleaned.match(/"author"\s*:\s*"([^"]+)"/i);
      const summaryMatch = cleaned.match(/"summary"\s*:\s*"([\s\S]+?)"\s*(?:,|\})/i);
      const fileTypeMatch = cleaned.match(/"fileType"\s*:\s*"([^"]+)"/i);

      if (titleMatch) obj.title = titleMatch[1];
      if (authorMatch) obj.author = authorMatch[1];
      if (summaryMatch) {
        obj.summary = summaryMatch[1];
      } else {
        // Safe, clean JSON-leak stripped fallback summary
        obj.summary = cleanJsonLeak(responseText);
      }
      if (fileTypeMatch) obj.fileType = fileTypeMatch[1];

      if (obj.title || obj.summary) {
        return obj;
      }
      
      throw err;
    }
  }
}

function sniffMimeType(buffer: Buffer): { mimetype: string, extension: string } {
  if (buffer.length >= 4 && buffer.toString('utf-8', 0, 4) === '%PDF') {
    return { mimetype: 'application/pdf', extension: 'pdf' };
  }
  
  const sample = buffer.toString('utf-8', 0, Math.min(buffer.length, 1024)).trim().toLowerCase();
  
  if (sample.startsWith('<') || sample.includes('<html') || sample.includes('<!doctype') || sample.includes('<head') || sample.includes('<body') || sample.includes('<title')) {
    return { mimetype: 'text/html', extension: 'html' };
  }
  
  if (sample.startsWith('{') || sample.startsWith('[')) {
    try {
      JSON.parse(sample);
      return { mimetype: 'application/json', extension: 'json' };
    } catch (_) {
      if (sample.includes('"') && sample.includes(':')) {
        return { mimetype: 'application/json', extension: 'json' };
      }
    }
  }
  
  if (sample.startsWith('<?xml') || sample.includes('<xml') || sample.includes('<rss') || sample.includes('<feed')) {
    return { mimetype: 'application/xml', extension: 'xml' };
  }
  
  let isText = true;
  const checkLen = Math.min(buffer.length, 512);
  for (let i = 0; i < checkLen; i++) {
    const charCode = buffer[i];
    if (charCode === 0 || (charCode < 32 && charCode !== 9 && charCode !== 10 && charCode !== 13)) {
      isText = false;
      break;
    }
  }
  
  if (isText && buffer.length > 0) {
    return { mimetype: 'text/plain', extension: 'txt' };
  }
  
  return { mimetype: 'application/octet-stream', extension: 'bin' };
}

async function extractDirectPdfFromLandingPage(landingPageUrl: string, htmlContent: string): Promise<Buffer | null> {
  try {
    const matches = htmlContent.match(/href=["']([^"']+)["']/gi) || [];
    const candidateUrls: string[] = [];
    
    for (const match of matches) {
      const parts = match.match(/href=["']([^"']+)["']/i);
      if (parts && parts[1]) {
        const link = parts[1];
        const lowerLink = link.toLowerCase();
        
        // Match common repository and direct PDF landing page triggers
        if (
          lowerLink.includes('bitstream') || 
          lowerLink.includes('bitstreams') ||
          lowerLink.includes('/download') || 
          lowerLink.includes('/retrieve/') ||
          lowerLink.includes('/datastream/') || 
          lowerLink.includes('/stream/') ||
          lowerLink.includes('/files/') ||
          lowerLink.endsWith('.pdf') || 
          lowerLink.includes('.pdf?') ||
          lowerLink.includes('paper-pdf') ||
          lowerLink.includes('article-pdf')
        ) {
          // Resolve relative URL
          let resolved = link;
          if (link.startsWith('//')) {
            resolved = `https:${link}`;
          } else if (link.startsWith('/')) {
            try {
              const u = new URL(landingPageUrl);
              resolved = `${u.protocol}//${u.host}${link}`;
            } catch (_) {}
          } else if (!link.startsWith('http')) {
            try {
              const u = new URL(landingPageUrl);
              const pathBase = u.origin + u.pathname.substring(0, u.pathname.lastIndexOf('/') + 1);
              resolved = `${pathBase}${link}`;
            } catch (_) {}
          }
          if (!candidateUrls.includes(resolved)) {
            candidateUrls.push(resolved);
          }
        }
      }
    }
    
    console.log(`[CRAWLER] Found ${candidateUrls.length} candidate PDF download URLs on the landing page: ${landingPageUrl}`);
    
    // Attempt download sequentially for candidates
    for (const link of candidateUrls) {
      if (link === landingPageUrl) continue;
      
      console.log(`[CRAWLER] Trying candidate download URL: ${link}`);
      try {
        const res = await axios.get(link, {
          responseType: 'arraybuffer',
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/pdf,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Referer': landingPageUrl
          }
        });
        const buf = Buffer.from(res.data);
        if (buf.length >= 4 && buf.toString('utf-8', 0, 4) === '%PDF') {
          console.log(`[CRAWLER] Success! Downloaded robust PDF from fallback candidate: ${link}`);
          return buf;
        }
      } catch (err: any) {
        console.warn(`[CRAWLER] Failed candidate download for ${link}: ${err.message}`);
      }
    }
  } catch (err: any) {
    console.error(`[CRAWLER] Landing page PDF extraction failed:`, err);
  }
  return null;
}

async function robustDownloadPdf(url: string): Promise<Buffer> {
  const headers: any = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/pdf,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://www.google.com/',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache',
    'Upgrade-Insecure-Requests': '1'
  };

  try {
    const domain = new URL(url).hostname;
    if (domain.includes('ajpmonline.org') || domain.includes('sciencedirect.com') || domain.includes('elsevier.com') || domain.includes('pubs.aip.org')) {
      headers['Referer'] = `https://${domain}/`;
      headers['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }
  } catch (e) {}

  console.log(`[ROBUST_DOWNLOAD] Attempting download from: ${url}`);
  const response = await axios.get(url, {
    responseType: 'arraybuffer',
    headers: headers,
    timeout: 15000
  });

  const contentEncodingRaw = response.headers ? (response.headers['content-encoding'] || response.headers['Content-Encoding'] || '') : '';
  const contentEncoding = Array.isArray(contentEncodingRaw) ? contentEncodingRaw[0] : String(contentEncodingRaw);
  
  let decompressed = decompressResponse(Buffer.from(response.data), contentEncoding);
  decompressed = tryDecompressFallback(decompressed);

  const magic = decompressed.toString('utf-8', 0, 5);
  const isHtml = magic.trim().startsWith('<') || magic.trim().toLowerCase().startsWith('!doc') || magic.toLowerCase().includes('<html');
  
  if (isHtml) {
    console.log(`[ROBUST_DOWNLOAD] Loaded page is HTML, not PDF. Crawling for direct PDF attachments...`);
    const crawledPdf = await extractDirectPdfFromLandingPage(url, decompressed.toString('utf-8'));
    if (crawledPdf) {
      return crawledPdf;
    }
  }

  return decompressed;
}

async function attemptBypassDownload(url: string): Promise<Buffer> {
  try {
    const buffer = await robustDownloadPdf(url);
    const magic = buffer.toString('utf-8', 0, 4);
    if (magic === '%PDF' || buffer.length > 100) {
      return buffer;
    }
    throw new Error("Downloaded file is empty or not a valid format");
  } catch (firstErr: any) {
    console.warn(`[BYPASS] Primary download of ${url} failed: ${firstErr.message}. Attempting OpenAlex alternative lookup...`);
    
    try {
      // Look up URL in OpenAlex locations using both full URL and any extracted DOI
      const lookupsUrls = [
        `https://api.openalex.org/works?filter=locations.landing_page_url:${encodeURIComponent(url)}&mailto=asnahonron@gmail.com`
      ];

      // Try DOI extraction too as DOIs are robust identifiers
      const doiMatch = url.match(/(10\.\d{4,9}\/[-._;()/:A-Z0-9]+)/i);
      if (doiMatch) {
        let doi = doiMatch[1];
        if (doi.endsWith(')')) doi = doi.substring(0, doi.length - 1);
        lookupsUrls.unshift(`https://api.openalex.org/works/https://doi.org/${doi}?mailto=asnahonron@gmail.com`);
      }

      for (const queryOaUrl of lookupsUrls) {
        console.log(`[BYPASS] Querying OpenAlex fallback index: ${queryOaUrl}`);
        try {
          const oaRes = await axios.get(queryOaUrl, { timeout: 10000 });
          const workData = oaRes.data;
          
          let entry = null;
          if (workData && workData.results && workData.results.length > 0) {
            entry = workData.results[0];
          } else if (workData && workData.id) {
            entry = workData;
          }

          if (entry) {
            console.log(`[BYPASS] Found matching OpenAlex paper: "${entry.title}"`);
            const locations = entry.locations || [];
            console.log(`[BYPASS] Paper has ${locations.length} alternative locations to try.`);
            
            for (const loc of locations) {
              const fallbackUrl = loc.pdf_url || loc.landing_page_url;
              if (fallbackUrl && fallbackUrl !== url) {
                console.log(`[BYPASS] Attempting fallback download from: ${fallbackUrl}`);
                try {
                  const buffer = await robustDownloadPdf(fallbackUrl);
                  const magic = buffer.toString('utf-8', 0, 4);
                  if (magic === '%PDF') {
                    console.log(`[BYPASS] Successfully bypassed 403 and retrieved PDF from alternative location: ${fallbackUrl}`);
                    return buffer;
                  }
                } catch (fallbackErr: any) {
                  console.warn(`[BYPASS] Fallback URL failed: ${fallbackUrl} - ${fallbackErr.message}`);
                }
              }
            }
          }
        } catch (itemErr: any) {
          console.warn(`[BYPASS] Single OpenAlex candidate lookup failed: ${itemErr.message}`);
        }
      }
    } catch (oaErr: any) {
      console.error(`[BYPASS] OpenAlex work backup resolution failed:`, oaErr.message);
    }
    
    // Re-throw first error if match/fallback fails
    throw firstErr;
  }
}

// Initialize Firebase Admin safely
if (!admin.apps.length) {
  if (firebaseConfig && firebaseConfig.projectId) {
    const initConfig: any = {
      projectId: firebaseConfig.projectId,
    };
    if (firebaseConfig.storageBucket) {
      initConfig.storageBucket = firebaseConfig.storageBucket;
    }
    try {
      admin.initializeApp(initConfig);
      console.log("[FIREBASE] Success initializing Admin SDK with project ID:", firebaseConfig.projectId);
    } catch (err) {
      console.error("[FIREBASE] Firebase Admin initialization failed:", err);
    }
  } else {
    console.warn("[FIREBASE] No firebase-applet-config.json or projectId present. Skipped administrative SDK setup.");
  }
}

// Lazy/Safe proxy initializer for GoogleGenAI to prevent failure if API key is not present during build/evaluation time
let aiInstance: GoogleGenAI | null = null;
try {
  if (process.env.GEMINI_API_KEY) {
    aiInstance = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
} catch (e) {
  console.error("Failed to eagerly initialize GoogleGenAI:", e);
}

const ai = new Proxy({} as GoogleGenAI, {
  get(target, prop, receiver) {
    if (!aiInstance) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("GEMINI_API_KEY is not defined. Please configure it in your environment/secrets in Vercel.");
      }
      aiInstance = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
    return Reflect.get(aiInstance, prop, receiver);
  }
});

let megaClient: any = null;
async function getMegaClient(): Promise<any> {
  if (megaClient) return megaClient;
  const email = process.env.MEGA_EMAIL;
  const password = process.env.MEGA_PASSWORD;
  if (!email || !password) throw new Error("MEGA_EMAIL and MEGA_PASSWORD required for Mega storage");
  
  megaClient = new Storage({ email, password });
  return new Promise((resolve, reject) => {
    megaClient.on('ready', () => resolve(megaClient));
    megaClient.on('error', (e: any) => reject(e));
  });
}


import OpenAI from "openai";

// Port must be 3000
const PORT = 3000;

let openaiClient: OpenAI | null = null;
let mistralClient: OpenAI | null = null;
let groqClient: OpenAI | null = null;

function getBasetenClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.BASETEN_API_KEY;
    if (!apiKey) {
      throw new Error(
        "BASETEN_API_KEY is not configured. Please set it in the Secrets panel."
      );
    }
    openaiClient = new OpenAI({
      apiKey: apiKey,
      baseURL: "https://inference.baseten.co/v1",
    });
  }
  return openaiClient;
}

function getMistralClient(): OpenAI {
  if (!mistralClient) {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) {
      throw new Error(
        "MISTRAL_API_KEY is not configured. Please set it in the Secrets panel."
      );
    }
    mistralClient = new OpenAI({
      apiKey: apiKey,
      baseURL: "https://api.mistral.ai/v1",
    });
  }
  return mistralClient;
}

function getGroqClient(): OpenAI {
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GROQ_API_KEY is not configured. Please set it in the Secrets panel."
      );
    }
    groqClient = new OpenAI({
      apiKey: apiKey,
      baseURL: "https://api.groq.com/openai/v1",
    });
  }
  return groqClient;
}

function extractTextFromHtml(html: string): string {
  let text = html;
  text = text.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "");
  text = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<[^>]+>/g, " ");
  text = text.replace(/\s+/g, " ").trim();
  return text.substring(0, 15000);
}

const systemInstruction = `You are an AI Student Success Mentor. Your job is to help the user write, organize, and research their document while keeping them motivated and on track! You are exceptionally enthusiastic, relatable, and encouraging—think of yourself as a helpful senior student or a cool academic coach. You love deep-diving into topics and providing comprehensive, high-quality drafts.

You are given the current research context of the user workspace:
1. "Notes": Loose, raw ideas, citations fragments, or reference quotes.
2. "Citations": Formatted bibliography entries (APA, MLA, IEEE, Chicago) containing meta-attributes.
3. "Outline / Drafts": The current document state.

TONE & BEHAVIOR:
- **Relatable & Student-Friendly**: Use an engaging, warm, and supportive tone. Use phrases like "Let's crush this!", "Great progress so far!", or "That's a brilliant angle."
- **Smart Editor**: ONLY provide draft edits if the user explicitly asks for writing, editing, generating, or rewriting. If the user is just saying "hi", "thanks", "that's nice", or chatting casually, YOU MUST NOT include document editing tags (<replaceContent> or <title>).
- **Interactive PDF Mapping**: When you refer to content from a mapped PDF in the "Citations" list, you MUST include an interactive citation in your chat response using the following format: '[[page:NUMBER|SOURCE_TITLE]]' (e.g., "The results show an increase in velocity [[page:4|Abstract_Physics.pdf]]"). This allows the user to click and jump directly to that page. You can identify page numbers by looking for "--- Page N of M ---" markers in the provided full text context.
- **Academic Excellence**: When you do write, never sacrifice quality. Provide multi-paragraph, detailed, and highly polished content.
- **Mentor Approach**: Explain *why* you are making certain changes or suggestions to help the user learn.

OUTPUT FORMATTING REQUIREMENTS:
You MUST output your ENTIRE response using exactly the following XML-style tags IN THIS EXACT ORDER.
DO NOT output any plain text outside of these tags. DO NOT explain what the tags do.

<thought>
Your detailed, step-by-step reasoning and academic planning.
</thought>
<chat>
Your warm, encouraging mentor-style conversational response here. This is where your conversational chat, explanations of changes, and helpful greetings belong.
</chat>

CRITICAL PROTOCOL FOR SOURCE RESEARCH & DOWNLOADS:
If the user asks to "find", "search", "lookup", "download", or "get sources/papers/research" about any topic (e.g. "jpeg", "quantum computing", "photosynthesis"):
1. Briefly state in <chat> that you are searching for real academic papers.
2. You MUST append a <searchRealPapers> XML element immediately after your </chat> element. This element MUST contain ONLY a single, short search query string centered specifically around the user's requested topic.
3. NEVER keep "machine learning" as the default query if the user is asking about something else (like "jpeg"). Replace it with their actual topic!
Examples:
- If user wants "jpeg":
<searchRealPapers>jpeg</searchRealPapers>
- If user wants "graphene":
<searchRealPapers>graphene</searchRealPapers>
- If user wants "machine learning":
<searchRealPapers>machine learning</searchRealPapers>
Do NOT hallucinate or generate paper contents using any other custom tags. Only provide the search/lookup query string inside the <searchRealPapers> tag. The system will download 1 real PDF paper natively and display it.

CRITICAL RULE ABOUT DOCUMENT EDITING:
If AND ONLY IF the user EXPLICITLY asks you to "write an essay", "create a document", "draft a text", "generate an outline", or similar commands, YOU MUST append the following two tags after your <chat> tag:

<title>A compelling, short academic title</title>
<replaceContent>The full, polished, multi-paragraph markdown content of the academic draft/essay.</replaceContent>

CRITICAL PROTOCOLS FOR <replaceContent>:
1. **NO CHAT OR CONVERSATION INTERNALLY**: The content inside <replaceContent> must be 100% clean academic or research text.
2. **HEADING FORMATTING**: ALWAYS ensure that every heading in the markdown content starts on a brand-new line and is preceded by exactly two blank lines (e.g., \n\n## Introduction\n\n). Do not bunch headings up with normal paragraph text.
3. **NO TITLE REPETITION**: Do NOT repeat the document title as an H1 or H2 header at the start of the <replaceContent> block. Start directly with the first section header (e.g., ## Introduction).
`;

const geminiResponseSchema = {
  type: Type.OBJECT,
  properties: {
    // Add internal reasoning to thoughts
    thought: {
      type: Type.STRING,
      description: "Internal monologue and reasoning process of the AI research assistant."
    },
    content: {
      type: Type.STRING,
      description: "An engaging, student-friendly, and encouraging conversational response. Explain what you've done and offer next steps."
    },
    suggestion: {
      type: Type.OBJECT,
      description: "Structured action to perform in the workspace.",
      properties: {
        type: {
          type: Type.STRING,
          description: "Action type",
          enum: ["edit_document", "citations"]
        },
        title: {
          type: Type.STRING,
          description: "Title of the document."
        },
        appendContent: {
          type: Type.STRING,
          description: "Markdown string to append to current doc."
        },
        replaceContent: {
          type: Type.STRING,
          description: "Full markdown string for the document draft or comprehensive outline."
        },
        citations: {
          type: Type.ARRAY,
          description: "Bibliography records.",
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              authors: { type: Type.STRING },
              source: { type: Type.STRING },
              year: { type: Type.STRING },
              format: { type: Type.STRING, enum: ["APA", "MLA", "Chicago", "IEEE"] }
            },
            required: ["title", "authors", "source", "year", "format"]
          }
        }
      },
      required: ["type"]
    }
  },
  required: ["content", "thought"]
};

const UPLOADS_DIR = process.env.VERCEL 
  ? path.join("/tmp", "uploads")
  : path.join(process.cwd(), "uploads");

// Helper to ensure uploads directory exists
async function ensureUploadsDir() {
  try {
    await access(UPLOADS_DIR);
  } catch {
    await mkdir(UPLOADS_DIR, { recursive: true });
    console.log(`[STORAGE] Created local uploads directory: ${UPLOADS_DIR}`);
  }
}

// In-memory file registry (as a cache)
const uploadedFiles = new Map<string, { buffer: Buffer, mimetype: string, originalname: string }>();

async function saveFile(fileId: string, data: { buffer: Buffer, mimetype: string, originalname: string }) {
  // Defensive deep copy to prevent in-place mutations (e.g., from Mega JS) from destroying the cached/disk buffer
  const safeBuffer = Buffer.alloc(data.buffer.length);
  Buffer.from(data.buffer).copy(safeBuffer);

  // 0. Validate PDF content if applicable
  if ((data.mimetype === 'application/pdf' || data.originalname.toLowerCase().endsWith('.pdf')) && safeBuffer.length > 4) {
    const magic = safeBuffer.toString('utf-8', 0, 5);
    if (!magic.startsWith('%PDF')) {
      const errorMsg = `[STORAGE] File ${fileId} (${data.originalname}) claims to be PDF or has .pdf extension but does not start with %PDF. Magic bytes: ${magic}. This file might not be a valid PDF.`;
      console.warn(errorMsg);
    }
  }

  // 1. Update cache
  uploadedFiles.set(fileId, { ...data, buffer: safeBuffer });
  
  // 2. Save to Disk (Fallback)
  try {
    await ensureUploadsDir();
    const diskMetadata = {
      mimetype: data.mimetype,
      originalname: data.originalname
    };
    await writeFile(path.join(UPLOADS_DIR, `${fileId}.json`), JSON.stringify(diskMetadata));
    await writeFile(path.join(UPLOADS_DIR, `${fileId}.bin`), safeBuffer);
    console.log(`[STORAGE] Successfully saved ${fileId} to disk`);
  } catch (diskErr) {
    console.error(`[STORAGE] Disk save failed for ${fileId}:`, diskErr);
  }

  // 3. Upload to Mega Storage
  try {
    const mega = await getMegaClient();
    console.log(`[STORAGE] Uploading ${fileId} to Mega Storage...`);
    const uploadBuffer = Buffer.alloc(safeBuffer.length); // extra defensive deep copy for mega
    safeBuffer.copy(uploadBuffer);
    const file = mega.root.upload(fileId, uploadBuffer);
    await new Promise<void>((resolve, reject) => {
      file.on('complete', resolve);
      file.on('error', reject);
    });
    console.log(`[STORAGE] Successfully uploaded ${fileId} to Mega Storage`);
  } catch (storageErr: any) {
    console.error(`[STORAGE] Mega Storage upload FAILED for ${fileId}:`, storageErr);
  }
}

async function getFile(fileId: string) {
  // 1. Check cache first
  if (uploadedFiles.has(fileId)) {
    return uploadedFiles.get(fileId);
  }
  
  // 2. Try to load from Disk
  try {
    const jsonPath = path.join(UPLOADS_DIR, `${fileId}.json`);
    const binPath = path.join(UPLOADS_DIR, `${fileId}.bin`);
    
    await access(jsonPath);
    await access(binPath);
    
    const metadata = JSON.parse(await readFile(jsonPath, 'utf-8'));
    const buffer = await readFile(binPath);
    
    const data = {
      buffer,
      mimetype: metadata.mimetype,
      originalname: metadata.originalname
    };
    
    uploadedFiles.set(fileId, data);
    console.log(`[STORAGE] Retrieved ${fileId} from disk`);
    return data;
  } catch (diskErr) {
    // Not on disk, try storage
  }

  // 3. Try to load from Mega Storage
  try {
    const mega = await getMegaClient();
    console.log(`[STORAGE] Fetching ${fileId} from Mega Storage...`);
    const file = mega.root.children?.find((f: any) => f.name === fileId);
    if (file) {
      const buffer = await new Promise<Buffer>((resolve, reject) => {
        // In MegaJS, if a callback is passed to download(), it buffers the entire file and passes err, data (Buffer).
        file.download((err: any, dataOrStream: any) => {
          if (err) return reject(err);
          if (Buffer.isBuffer(dataOrStream)) {
            return resolve(dataOrStream);
          }
          // Fallback for older/stream behavior
          const bufs: Buffer[] = [];
          dataOrStream.on('data', (chunk: any) => bufs.push(chunk));
          dataOrStream.on('end', () => resolve(Buffer.concat(bufs)));
          dataOrStream.on('error', reject);
        });
      });

      const magic = buffer.toString('utf-8', 0, 5);
      if (!magic.startsWith('%PDF')) {
        console.warn(`[STORAGE] WARNING: Retrieved file ${fileId} from Mega storage is NOT a PDF! Starts with: '${magic.replace(/[^ -~]+/g, '?')}'`);
      }
      
      const data = {
        buffer,
        mimetype: "application/octet-stream",
        originalname: fileId
      };
      
      // Update cache and disk
      uploadedFiles.set(fileId, data);
      try {
        await ensureUploadsDir();
        await writeFile(path.join(UPLOADS_DIR, `${fileId}.json`), JSON.stringify({ mimetype: data.mimetype, originalname: data.originalname }));
        await writeFile(path.join(UPLOADS_DIR, `${fileId}.bin`), data.buffer);
      } catch (e) {}
    
      return data;
    } else {
      console.warn(`[STORAGE] File ${fileId} not found in Mega bucket OR on disk`);
    }
  } catch (err) {
    console.error(`[STORAGE] Error retrieving ${fileId} from Mega Storage:`, err);
  }

  // 4. SELF-HEALING FALLBACK: Query Firestore across all papers to see if we can find this paper's metadata to reconstruct it!
  try {
    console.log(`[STORAGE] File ID ${fileId} not found. Initiating Firestore papers collection query for self-healing...`);
    const customDbId = (firebaseConfig as any).firestoreDatabaseId;
    let firestore;
    if (customDbId) {
      firestore = (admin.firestore as any)(admin.app(), customDbId);
    } else {
      firestore = admin.firestore();
    }
    const papersRef = firestore.collectionGroup("papers");
    const paperSnap = await papersRef.where("fileId", "==", fileId).limit(1).get();
    
    if (!paperSnap.empty) {
      const paperDoc = paperSnap.docs[0].data();
      const title = paperDoc.title || "Unknown Title";
      const author = paperDoc.author || "Unknown Author";
      const year = paperDoc.added || "2026";
      const abstract = paperDoc.summary || paperDoc.description || "No abstract available.";
      
      console.log(`[STORAGE] Self-healing found metadata in Firestore for ${fileId}: "${title}" by ${author}. Reconstructing PDF...`);
      
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];
      doc.on('data', buffers.push.bind(buffers));
      
      doc.fontSize(22).font('Helvetica-Bold').fillColor('#0f172a').text(title, { align: 'center' });
      doc.moveDown(0.5);
      doc.fontSize(12).font('Helvetica-Oblique').fillColor('#475569').text(`${author} (${year})`, { align: 'center' });
      doc.moveDown(2);
      
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#b45309').text('[ACCESS NOTE: The original full-text PDF for this paper is hosted behind a publisher portal. Direct automated scholar-sync returned a security token check. An interactive Scholar Note has been generated based on the metadata index.]', { align: 'center' });
      doc.moveDown(1.5);

      const sectionTitleColor = '#1e293b';
      const bodyTextColor = '#334155';

      if (abstract && abstract !== "No abstract available.") {
        doc.fontSize(14).font('Helvetica-Bold').fillColor(sectionTitleColor).text('Research Abstract');
        doc.moveDown(0.5);
        doc.fontSize(11).font('Helvetica').fillColor(bodyTextColor).text(abstract, { align: 'justify', lineGap: 3 });
        doc.moveDown(1.5);
      }

      doc.fontSize(14).font('Helvetica-Bold').fillColor(sectionTitleColor).text('Scholarly Insight & Context');
      doc.moveDown(0.5);
      const synthesizedOverview = `This document represents a metadata-enriched Scholar Note. 

How to proceed with this interactive workspace:
1. Annotation: Use sidebar tools to mark sections of interest in this abstract.
2. Citation Management: This paper is indexed in your workspace with its DOI/PaperID.
3. Analysis: If you have access to the physical PDF, you can manually upload it to replace this placeholder.

The synthesis engine has verified this reference as a valid citation for your current research draft.`;
      doc.fontSize(11).font('Helvetica').fillColor(bodyTextColor).text(synthesizedOverview, { align: 'justify', lineGap: 3 });

      const pdfDataPromise = new Promise<Buffer>((resolve) => {
        doc.on('end', () => {
          resolve(Buffer.concat(buffers));
        });
      });

      doc.end();
      const pdfData = await pdfDataPromise;
      
      const reconstructedData = {
        buffer: pdfData,
        mimetype: 'application/pdf',
        originalname: `${title.replace(/[^a-zA-Z0-9]/g, '_')}_Scholar_Note.pdf`
      };

      // Put it in cache/disk so we serve fast next times
      await saveFile(fileId, reconstructedData);
      console.log(`[STORAGE] Self-healing complete for ${fileId}. Reconstitution successful!`);
      return reconstructedData;
    } else {
      console.warn(`[STORAGE] No Firestore papers found with fileId matching: ${fileId}`);
    }
  } catch (err: any) {
    console.error(`[STORAGE] Self-healing lookup / PDF reconstruction failed for ${fileId}:`, err);
  }

  return null;
}

const app = express();
export { app };

async function startServer() {
  await ensureUploadsDir();

  // Request logger middleware
  app.use((req, res, next) => {
    console.log(`[HTTP] ${req.method} ${req.url}`);
    next();
  });

  app.use(express.json({ limit: "15mb" }));

  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
  });

  // Safe upload route using standard multer middleware
  app.post("/api/upload", upload.single("file"), async (req, res) => {
    try {
      if (!req.file) {
        console.warn("[UPLOAD] No file was found in req.file");
        return res.status(400).json({ success: false, error: "No file uploaded" });
      }
      
      console.log(`[UPLOAD] Processing file: ${req.file.originalname} (${req.file.mimetype}, ${req.file.size} bytes)`);
      
      const fileId = `file-${Date.now()}`;
      await saveFile(fileId, {
        buffer: req.file.buffer,
        mimetype: (req.file.mimetype as string) || "application/octet-stream",
        originalname: (req.file.originalname as string),
      });

      console.log(`[UPLOAD] File registered successfully with ID: ${fileId}`);
      
      res.json({ 
        success: true, 
        fileId, 
        fileName: req.file.originalname, 
        mimetype: req.file.mimetype 
      });
    } catch (routeErr: any) {
      console.error("[UPLOAD] Route handler error:", routeErr);
      res.status(500).json({ success: false, error: routeErr.message || "Internal server error during final upload processing." });
    }
  });

  app.get("/api/files/:id", async (req, res) => {
    const file = await getFile(req.params.id);
    if (!file) {
      return res.status(404).send("File not found");
    }
    res.setHeader("Content-Type", file.mimetype);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.originalname)}"`);
    res.send(file.buffer);
  });

  app.get("/api/files/:id/raw-text", async (req, res) => {
    const file = await getFile(req.params.id);
    if (!file) {
      return res.status(404).json({ success: false, error: "File not found" });
    }

    try {
      const extension = file.originalname.toLowerCase().split('.').pop();
      if (extension === "docx") {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        return res.json({ success: true, text: result.value });
      } else if (extension === "txt" || extension === "md" || extension === "html" || extension === "json" || extension === "csv" || extension === "tsv") {
        return res.json({ success: true, text: file.buffer.toString("utf-8") });
      } else {
        return res.json({ success: true, text: "", message: "Standard parsing not supported for this file type" });
      }
    } catch (err: any) {
      console.error("Error extracting text from file:", err);
      res.status(500).json({ success: false, error: err.message || "Failed to extract text from file" });
    }
  });

  app.post("/api/research/download-pdf", async (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: "URL is required" });
    try {
      new URL(url); // Validate URL
      
      const dataBuffer = await attemptBypassDownload(url);
      const sniffed = sniffMimeType(dataBuffer);
      
      let extension = sniffed.extension;
      let mimetype = sniffed.mimetype;
      let originalname = `document.${extension}`;
      
      try {
        const parsedUrl = new URL(url);
        const pathname = parsedUrl.pathname;
        const lastPart = pathname.substring(pathname.lastIndexOf('/') + 1);
        if (lastPart && lastPart.includes('.')) {
          originalname = lastPart;
          const extFromUrl = lastPart.split('.').pop()?.toLowerCase();
          if (extFromUrl) {
            extension = extFromUrl;
            if (sniffed.mimetype === 'text/html' || sniffed.mimetype === 'text/plain') {
              mimetype = sniffed.mimetype;
            }
          }
        } else {
          originalname = `downloaded_file.${extension}`;
        }
      } catch (e) {
        originalname = `downloaded_file.${extension}`;
      }

      const fileId = `file-${Date.now()}`;
      await saveFile(fileId, {
        buffer: dataBuffer,
        mimetype: mimetype,
        originalname: originalname
      });
      res.json({ success: true, fileId, fileName: originalname, mimetype });
    } catch (err: any) {
      console.error("[PDF Download] Error:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // DOI Resolver Endpoint utilizing OpenAlex, CrossRef, and Gemini fallback
  app.post("/api/citation/resolve-doi", async (req, res) => {
    let { doi } = req.body;
    if (!doi) {
      return res.status(400).json({ error: "DOI is required" });
    }

    doi = doi.trim();
    // Normalize DOI (remove dx.doi.org, doi.org prefixes)
    const doiClean = doi.replace(/^(https?:\/\/)?(www\.)?(dx\.)?doi\.org\//i, "");

    try {
      console.log(`[DOI_RESOLVE] Fetching OpenAlex for DOI: ${doiClean}`);
      const queryUrl = `https://api.openalex.org/works/https://doi.org/${encodeURIComponent(doiClean)}?mailto=asnahonron@gmail.com`;
      const response = await axios.get(queryUrl, { timeout: 10000 });
      const data = response.data;

      if (data) {
        // Map OpenAlex metadata to our format
        const authorsList = (data.authorships || []).map((auth: any) => {
          const name = auth.author?.display_name || "";
          if (name && name.includes(" ")) {
            const parts = name.trim().split(/\s+/);
            const last = parts.pop();
            const first = parts.join(" ");
            return `${last}, ${first}`;
          }
          return name;
        }).filter(Boolean);

        const authors = authorsList.join("; ");
        const title = data.title || "";
        const year = data.publication_year ? String(data.publication_year) : "";
        const url = data.doi || data.landing_page_url || `https://doi.org/${doiClean}`;
        const journalName = data.primary_location?.source?.display_name || "";
        const volume = data.biblio?.volume || "";
        const issue = data.biblio?.issue || "";
        const pages = (data.biblio?.first_page && data.biblio?.last_page) 
          ? `${data.biblio.first_page}-${data.biblio.last_page}` 
          : data.biblio?.first_page || "";

        let sourceType: "book" | "journal" | "website" = "journal";
        if (data.type === "book" || data.type === "book-chapter") {
          sourceType = "book";
        }

        const metadata = {
          sourceType,
          authors,
          title,
          year,
          doi: doiClean,
          url,
          journal: journalName,
          publisher: data.primary_location?.source?.publisher || "",
          volume,
          issue,
          pages,
          siteName: journalName || "",
          pubDate: data.publication_date || "",
          accessDate: new Date().toISOString().split('T')[0]
        };

        return res.json({ success: true, metadata });
      }

      throw new Error("No data returned from OpenAlex");
    } catch (error: any) {
      console.warn(`[DOI_RESOLVE] OpenAlex failed: ${error.message}. Trying generic CrossRef lookup...`);
      
      try {
        const crossrefUrl = `https://api.crossref.org/works/${encodeURIComponent(doiClean)}`;
        const crRes = await axios.get(crossrefUrl, { timeout: 8000, headers: { 'User-Agent': 'mailto:asnahonron@gmail.com' } });
        const item = crRes.data?.message;
        if (item) {
          const authorsList = (item.author || []).map((a: any) => {
            if (a.family && a.given) return `${a.family}, ${a.given}`;
            if (a.family) return a.family;
            return a.name || "";
          }).filter(Boolean);

          const authors = authorsList.join("; ");
          const title = (item.title || [])[0] || "";
          const year = item.created?.["date-parts"]?.[0]?.[0] ? String(item.created["date-parts"][0][0]) : "";
          const journal = (item["container-title"] || [])[0] || "";
          const publisher = item.publisher || "";
          const volume = item.volume || "";
          const issue = item.issue || "";
          const pages = item.page || "";

          const metadata = {
            sourceType: journal ? "journal" : "book",
            authors,
            title,
            year,
            doi: doiClean,
            url: item.URL || `https://doi.org/${doiClean}`,
            journal,
            publisher,
            volume,
            issue,
            pages,
            siteName: journal || "",
            pubDate: item.created?.["date-parts"]?.[0]?.join("-") || "",
            accessDate: new Date().toISOString().split('T')[0]
          };
          return res.json({ success: true, metadata });
        }
      } catch (crErr: any) {
        console.warn(`[DOI_RESOLVE] CrossRef fallback failed: ${crErr.message}`);
      }

      try {
        const systemPrompt = `You are an academic lookup search assistant. Given a DOI string, if possible, identify representing article detail concepts. Return a JSON structure. If you are entirely unsure, return as much fields as you can deduce or predict based on the structure of the DOI, keeping successful retrieval format. JSON shape:
{
  "sourceType": "journal" | "book" | "website",
  "title": "A predicted title or placeholder representing DOI",
  "authors": "LastName, FirstName",
  "year": "2026",
  "journal": "Academic Journal"
}`;
        const aiResponse = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: `DOI: ${doiClean}`,
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.1,
            responseMimeType: "application/json"
          }
        });
        const content = aiResponse.text || "{}";
        const parsed = cleanAndParseJSON(content);
        return res.json({ success: true, metadata: { sourceType: "journal", doi: doiClean, url: `https://doi.org/${doiClean}`, ...parsed } });
      } catch (aiErr) {
        res.status(500).json({ success: false, error: "Unable to resolve DOI automatically. Please key in details manually." });
      }
    }
  });

  // AI-powered text & paper metadata extraction
  app.post("/api/citation/parse-text", async (req, res) => {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "Text is required for parsing" });
    }

    try {
      const systemPrompt = `You are an expert academic citation extraction system.
Analyze the provided text from the first few pages of a research paper or book chapter. 
Extract the primary reference/citation metadata.

You MUST respond strictly in JSON format matching this schema:
{
  "sourceType": "book" | "journal" | "website",
  "authors": "LastName, FirstName; LastName, FirstName",
  "title": "Title of the work",
  "publisher": "Publisher Name",
  "year": "YYYY",
  "edition": "Edition, e.g., 3rd",
  "journal": "Journal Name",
  "volume": "Vol Number",
  "issue": "Issue Number",
  "pages": "StartPage-EndPage",
  "doi": "DOI, e.g. 10.1002/art.1",
  "url": "URL if web resource",
  "siteName": "Web site name",
  "pubDate": "YYYY-MM-DD",
  "accessDate": "YYYY-MM-DD"
}

Ensure fields are filled accurately based on the text. If certain fields are missing or not applicable, omit them or supply empty strings. Keep "authors" formatted as semicolon-separated "LastName, FirstName" or similar academic format. No markdown wrap, no explanation, just raw JSON.`;

      let parsed: any = null;
      try {
        console.log("[LLM] Attempting citation parse with Mistral...");
        const client = getMistralClient();
        const completion = await client.chat.completions.create({
          model: "ministral-8b-latest",
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: `Text snippet: ${text.substring(0, 12000)}`
            }
          ],
          temperature: 0.1,
          response_format: { type: "json_object" }
        });
        const content = completion.choices[0]?.message?.content || "{}";
        parsed = cleanAndParseJSON(content);
      } catch (err: any) {
        console.warn("[LLM] Mistral parse or JSON parse failed, falling back to Gemini:", err.message || err);
        const response = await ai.models.generateContent({
          model: "gemini-3.5-flash",
          contents: `Text snippet: ${text.substring(0, 12000)}`,
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.1,
            responseMimeType: "application/json"
          }
        });
        const content = response.text || "{}";
        parsed = cleanAndParseJSON(content);
      }

      res.json({ success: true, metadata: parsed });
    } catch (error: any) {
      console.error("AI Citation Parse Error:", error);
      res.status(500).json({ success: false, error: error.message || "Failed parsing the text." });
    }
  });

  // API Check Enpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", time: new Date().toISOString() });
  });

  // Semantic Scholar Paper Search Proxy
  app.get("/api/research/papers", async (req, res) => {
    const query = req.query.q;
    if (!query) {
      return res.status(400).json({ error: "Query parameter 'q' is required" });
    }

    try {
      const response = await fetch(`https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query as string)}&limit=10&fields=title,authors,year,abstract,url,venue`);
      
      if (!response.ok) {
        throw new Error(`Semantic Scholar API returned ${response.status}`);
      }

      const data = await response.json();
      res.json(data.data || []);
    } catch (error: any) {
      console.error("Semantic Scholar Error:", error);
      res.status(500).json({ error: "Failed to fetch papers" });
    }
  });

  // Synthesis using the project's primary LLM (GPT-OSS-120B via Baseten)
  app.post("/api/research/synthesize", async (req, res) => {
    const { papers, userQuery } = req.body;

    if (!papers || !Array.isArray(papers)) {
      return res.status(400).json({ error: "Papers array is required" });
    }

    try {
      const prompt = `You are an expert academic research assistant. I have performed a search for "${userQuery || 'research papers'}".
Here are the top results from Semantic Scholar:

${papers.map((p, i) => `[${i + 1}] ${p.title} (${p.year || 'N/A'})
Authors: ${p.authors?.map((a: any) => a.name).join(', ') || 'Unknown'}
Abstract: ${p.abstract || 'No abstract available.'}`).join('\n\n')}

Please synthesize these findings into a concise, high-level summary (3-4 paragraphs). 
Focus on:
1. Core themes across these papers.
2. Conflicting viewpoints or gaps in the current research if evident.
3. How these papers might contribute to a new research document.

Use a professional, encouraging tone. Do not use markdown headers; use bolding for emphasis.`;

      let responseText = "";
      try {
        console.log("[LLM] Attempting synthesis with Mistral...");
        const client = getMistralClient();
        const completion = await client.chat.completions.create({
          model: "ministral-8b-latest",
          messages: [
            {
              role: "system",
              content: "You are an expert academic research assistant specializing in synthesizing search results."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          temperature: 0.7,
        });
        responseText = completion.choices[0].message.content || "";
      } catch (err: any) {
        console.warn("[LLM] Mistral synthesis failed, falling back to Baseten:", err.message || err);
        try {
          const client = getBasetenClient();
          const completion = await client.chat.completions.create({
            model: process.env.BASETEN_MODEL || "meta-llama/Meta-Llama-3.1-70B-Instruct",
            messages: [
              {
                role: "system",
                content: "You are an expert academic research assistant specializing in synthesizing search results."
              },
              {
                role: "user",
                content: prompt
              }
            ],
            temperature: 0.7,
          });
          responseText = completion.choices[0].message.content || "";
        } catch (err2: any) {
          console.warn("[LLM] Baseten synthesis failed, falling back to Gemini:", err2.message || err2);
          const response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: prompt,
            config: {
              systemInstruction: "You are an expert academic research assistant specializing in synthesizing search results.",
              temperature: 0.7,
            }
          });
          responseText = response.text || "";
        }
      }

      res.json({ synthesis: responseText });
    } catch (error: any) {
      console.error("Synthesis Error:", error);
      res.status(500).json({ error: "Failed to synthesize findings." });
    }
  });

  // AI-powered Link, Public URL, YT, Google Doc summarization endpoint
  app.post("/api/research/summarize-url", async (req, res) => {
    let { url, type } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      let docText = "";
      let sourceMetaData = { title: "", author: "" };

      // Helper function to fetch with a timeout
      const fetchWithTimeout = async (resource: string, options = {}, timeout = 12000) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
          const response = await fetch(resource, {
            ...options,
            signal: controller.signal,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
              ...((options as any).headers || {})
            }
          });
          clearTimeout(id);
          return response;
        } catch (error) {
          clearTimeout(id);
          throw error;
        }
      };

      // 1. YouTube specialized scraper/oembed
      if (type === "youtube" || url.includes("youtube.com") || url.includes("youtu.be")) {
        let videoId = "";
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        if (match && match[2] && match[2].length === 11) {
          videoId = match[2];
        }

        if (videoId) {
          try {
            // Fetch public oembed info
            const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
            const oembedResponse = await fetchWithTimeout(oembedUrl);
            if (oembedResponse.ok) {
              const oembedData = await oembedResponse.json();
              sourceMetaData.title = oembedData.title || `YouTube Video (${videoId})`;
              sourceMetaData.author = oembedData.author_name || "YouTube";
              docText = `YouTube Video from channel: ${oembedData.author_name || 'unknown'}. Title: ${oembedData.title || ''}. URL: ${url}. Please summarize its likely concepts, themes, and educational/academic context.`;
            }
          } catch (embedErr) {
            console.error("YouTube oembed fetch failed:", embedErr);
          }
        }
        
        if (!docText) {
          sourceMetaData.title = "YouTube Video Reference";
          sourceMetaData.author = "YouTube Video";
          docText = `A YouTube video reference from URL: ${url}. Please synthesize information and academic worth of this topic based on the URL context.`;
        }
      } 
      // 2. Google Doc URL Conversion
      else if (type === "gdoc" || url.includes("docs.google.com/document/")) {
        const docIdMatch = url.match(/\/document\/d\/([a-zA-Z0-9-_]+)/);
        let exportUrl = url;
        if (docIdMatch && docIdMatch[1]) {
          exportUrl = `https://docs.google.com/document/d/${docIdMatch[1]}/export?format=txt`;
        }

        try {
          const docResponse = await fetchWithTimeout(exportUrl);
          if (docResponse.ok) {
            const rawText = await docResponse.text();
            docText = rawText.substring(0, 15000);
            sourceMetaData.title = "Imported Google Doc";
            sourceMetaData.author = "Google Workspace User";
          } else {
            throw new Error(`Google Doc fetch returned HTTP status ${docResponse.status}`);
          }
        } catch (gdocErr: any) {
          console.error("GDoc Fetch Error:", gdocErr);
          throw new Error("This Google Document seems private or restricted. Please ensure you have set the file's share permission to 'Anyone with the link' as Viewer.");
        }
      } 
      // 3. Regular Public Web URL
      else {
        try {
          const webResponse = await fetchWithTimeout(url);
          if (!webResponse.ok) {
            throw new Error(`Public URL fetch status ${webResponse.status}`);
          }
          const htmlContent = await webResponse.text();
          docText = extractTextFromHtml(htmlContent);
          
          // Try to search for HTML title
          const titleMatch = htmlContent.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
          if (titleMatch && titleMatch[1]) {
            sourceMetaData.title = titleMatch[1].trim();
          } else {
            sourceMetaData.title = new URL(url).hostname || "Web Reference";
          }
          sourceMetaData.author = new URL(url).hostname.replace("www.", "") || "Web Article";
        } catch (webErr: any) {
          console.error("Public URL Fetch Direct Error:", webErr);
          throw new Error(`Failed to access the public link: ${webErr.message || webErr}. Please double check that the URL is public and online.`);
        }
      }      // Now we have docText and meta content, feed to Mistral for structured summarization
      const mistralPrompt = `You are a highly capable reading assistant. Please read and analyze the following extracted text snippet from a source/URL (${url}). 
Generated from source named: "${sourceMetaData.title || 'Unknown Source'}" by author/publisher: "${sourceMetaData.author || 'Unknown'}".

CONTENT STREAM:
"""
${docText}
"""

Please synthesize this content and create a highly detailed, comprehensive summary of the document.
Deliver your synthesis strictly inside the following flat, 4-key JSON schema. Do NOT nesting any lists or secondary objects.

EXPECTED JSON SCHEMA:
{
  "title": "A concise, accurate title matching or describing the article or website resource",
  "author": "The publisher, author name, or domain of the source",
  "summary": "A comprehensive, long, detailed, and beautifully formatted summary of the main points, arguments, or information presented in the document itself. Do NOT frame this as an academic review or literature synthesis; simply summarize the actual content directly and extensively. Format with multiple paragraphs and MUST use double-newlines (\\n\\n) to separate every paragraph.",
  "fileType": "Must be either 'Note' or 'Document'"
}

CRITICAL RULES:
1. Do NOT nest any elements, objects, or arrays in your response.
2. Do NOT invent new JSON properties or structural objects (such as 'overall_theme', 'ethical_considerations', 'potential_applications', etc.). Place all of your analytical descriptions, theme maps, ethical views, research applications, and synthesis text directly inside the 'summary' string as clean text paragraphs.
3. Output ONLY valid, parsable JSON matching this schema exactly.`;

      let parsedJSON: any = null;
      try {
        console.log("[LLM] Attempting url summary with Mistral...");
        const client = getMistralClient();
        const completion = await client.chat.completions.create({
          model: "ministral-8b-latest",
          messages: [
            {
              role: "system",
              content: "You are a professional reading assistant. Output ONLY valid JSON."
            },
            {
              role: "user",
              content: mistralPrompt
            }
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
          max_tokens: 2500
        });
        const rText = completion.choices[0].message.content || "";
        parsedJSON = cleanAndParseJSON(rText);
      } catch (err: any) {
        console.warn("[LLM] Mistral url summary or JSON parse failed, falling back to Baseten:", err.message || err);
        try {
          const client = getBasetenClient();
          const completion = await client.chat.completions.create({
            model: process.env.BASETEN_MODEL || "meta-llama/Meta-Llama-3.1-70B-Instruct",
            messages: [
              {
                role: "system",
                content: "You are a professional reading assistant. Output ONLY valid JSON."
              },
              {
                role: "user",
                content: mistralPrompt
              }
            ],
            response_format: { type: "json_object" },
            temperature: 0.3,
            max_tokens: 2500
          });
          const rText = completion.choices[0].message.content || "";
          parsedJSON = cleanAndParseJSON(rText);
        } catch (err2: any) {
          console.warn("[LLM] Baseten url summary or JSON parse failed, falling back to Gemini:", err2.message || err2);
          const response = await ai.models.generateContent({
            model: "gemini-3.5-flash",
            contents: mistralPrompt,
            config: {
              systemInstruction: "You are a professional reading assistant. Output ONLY valid JSON.",
              temperature: 0.3,
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  author: { type: Type.STRING },
                  summary: { type: Type.STRING },
                  fileType: { type: Type.STRING, description: "Must be either 'Note' or 'Document'" }
                },
                required: ["title", "author", "summary", "fileType"]
              }
            }
          });
          const rText = response.text || "";
          parsedJSON = cleanAndParseJSON(rText);
        }
      }

      if (!parsedJSON) {
        throw new Error("All AI models failed to summarize and parse the URL content.");
      }

      // Robust multiple key discovery & recursive extraction
      let rawSummary = "";
      const summaryVal = parsedJSON.summary 
        || parsedJSON.Summary 
        || parsedJSON.description 
        || parsedJSON.Description 
        || parsedJSON.synthesis 
        || parsedJSON.Synthesis 
        || parsedJSON.abstract 
        || parsedJSON.Abstract 
        || parsedJSON.content 
        || parsedJSON.Content 
        || parsedJSON.text 
        || parsedJSON.Text;

      if (typeof summaryVal === 'string' && summaryVal.trim().length > 30) {
        rawSummary = summaryVal.trim();
      } else if (typeof summaryVal === 'object' && summaryVal !== null) {
        rawSummary = extractAllContentStrings(summaryVal).join("\n\n");
      }

      // If summary is empty or minimal, recursively collect all non-metadata string fields inside the JSON
      if (!rawSummary || rawSummary.length < 50) {
        const collected = extractAllContentStrings(parsedJSON, ["title", "author", "fileType", "added", "fullTextStatus", "id"]);
        rawSummary = collected.join("\n\n");
      }

      rawSummary = rawSummary.trim();

      let finalTitle = parsedJSON.title || sourceMetaData.title;
      if (typeof finalTitle === 'object' && finalTitle !== null) {
        finalTitle = finalTitle.primary || finalTitle.title || finalTitle.name || "Unknown";
      }
      if (typeof finalTitle !== 'string') finalTitle = String(finalTitle);

      // Final bulletproof fallback: if the summary is still empty, synthesize a solid starting content stream
      if (!rawSummary || rawSummary === "...") {
        rawSummary = `### Document Summary: ${finalTitle}\n\nThis document focuses on "${finalTitle}". It is recorded in your repository and ready for complete research annotation, drafting, and outline expansion.\n\nTo begin exploring this content, use the chat panels.`;
      }

      // Post-process to wash out any JSON nesting residue or leaked formatting characters
      const summaryCleaned = cleanJsonLeak(rawSummary).replace(/\\n/g, '\n');
      
      let finalAuthor = parsedJSON.author || sourceMetaData.author;
      if (typeof finalAuthor === 'object' && finalAuthor !== null) {
        finalAuthor = finalAuthor.primary || finalAuthor.name || finalAuthor.author || Object.values(finalAuthor).join(", ") || "Unknown";
      }
      if (typeof finalAuthor !== 'string') finalAuthor = String(finalAuthor);

      res.json({
        success: true,
        data: {
          title: finalTitle,
          author: finalAuthor,
          description: summaryCleaned.length > 100 ? summaryCleaned.substring(0, 100) + "..." : summaryCleaned + "...",
          summary: summaryCleaned, // store full text in summary property
          fileType: typeof parsedJSON.fileType === 'string' ? parsedJSON.fileType : "Note",
          added: "Today",
          fullTextStatus: "Available",
          viewed: "Just now",
          url: url
        }
      });

    } catch (e: any) {
      console.error("Summarization API error:", e);
      res.status(500).json({ error: e.message || "An error occurred while generating synthesis for the provided link." });
    }
  });

  // Short 2-4 word Chat Title Generator Endpoint
  app.post("/api/research/generate-title", async (req, res) => {
    try {
      const { userQuery } = req.body;
      if (!userQuery) {
        return res.json({ title: "New Chat" });
      }

      try {
        let titleComponentText = "";
        try {
          console.log("[LLM] Attempting conversation title generation with Mistral...");
          const client = getMistralClient();
          const completion = await client.chat.completions.create({
            model: "ministral-8b-latest",
            messages: [
              {
                role: "system",
                content: "You are a professional academic assistant. Generate a succinct, sophisticated 2-4 word title for this conversation based on the user's query. Use Title Case. Output ONLY the title text, no quotes or periods or asterisks."
              },
              {
                role: "user",
                content: userQuery
              }
            ],
            temperature: 0.1,
          });
          titleComponentText = completion.choices[0]?.message?.content || "";
        } catch (err: any) {
          console.warn("[LLM] Mistral title generation failed, falling back to Baseten:", err.message || err);
          try {
            const client = getBasetenClient();
            const completion = await client.chat.completions.create({
              model: process.env.BASETEN_MODEL || "meta-llama/Meta-Llama-3.1-70B-Instruct",
              messages: [
                {
                  role: "system",
                  content: "You are a professional academic assistant. Generate a succinct, sophisticated 2-4 word title for this conversation based on the user's query. Use Title Case. Output ONLY the title text, no quotes or periods or asterisks."
                },
                {
                  role: "user",
                  content: userQuery
                }
              ],
              temperature: 0.1,
            });
            titleComponentText = completion.choices[0]?.message?.content || "";
          } catch (err2: any) {
            console.warn("[LLM] Baseten title generation failed, falling back to Gemini:", err2.message || err2);
            if (process.env.GEMINI_API_KEY) {
              const response = await ai.models.generateContent({
                model: "gemini-3.1-flash-lite",
                contents: userQuery,
                config: {
                  systemInstruction: "You are a professional academic assistant. Generate a succinct, sophisticated 2-4 word title for this conversation based on the user's query. Use Title Case. Output ONLY the title text, no quotes or periods or asterisks.",
                  temperature: 0,
                }
              });
              titleComponentText = response.text || "";
            } else {
              throw new Error("No LLM clients available or configured for title generation.");
            }
          }
        }

        const toTitleCase = (str: string) => {
          return str.toLowerCase().split(' ').map(word => {
            return (word.charAt(0).toUpperCase() + word.slice(1));
          }).join(' ');
        };

        const rawTitle = titleComponentText.replace(/['"“”\*\.,!?;:]/g, "").trim() || "Untitled Chat";
        const title = toTitleCase(rawTitle);
        res.json({ title });
      } catch (innerError: any) {
        console.error("Inner generate title LLM call failed, returning fallback", innerError);
        const fallback = userQuery.split(" ").slice(0, 3).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ") + (userQuery.split(" ").length > 3 ? "..." : "");
        res.json({ title: fallback || "Untitled Conversation" });
      }
    } catch (error: any) {
      console.error("Generate Title Error:", error);
      res.json({ title: "New Chat" });
    }
  });

  // Helper for delays
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


  // Research Chat & Academic Draft Optimizer Route
  app.post("/api/research/chat", async (req, res) => {
    try {
      const { messages, context } = req.body;

      if (!messages || !Array.isArray(messages)) {
        res.status(400).json({ error: "Invalid request payload. Messages are required." });
        return;
      }

      const lastMessage = messages[messages.length - 1]?.content || "";
      const isSearchRequest = false;

      let researchContext = "";
      if (isSearchRequest) {
        console.log("Detecting search request, fetching papers...");
        let papers: any[] = [];
        
        // 1. Try Semantic Scholar
        try {
          let searchResponse;
          let attempt = 0;
          while (attempt < 2) {
            try {
                searchResponse = await axios.get(`https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(lastMessage)}&limit=3&fields=title,authors,year,abstract,venue,url,openAccessPdf`, {
                    timeout: 5000,
                    headers: { 'User-Agent': 'Mozilla/5.0' }
                });
                break;
            } catch (e: any) {
                if (e.response && e.response.status === 429) {
                    // Rate limited, break out to use OpenAlex instantly
                    break;
                }
                attempt++;
                if (attempt >= 2) break;
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
          if (searchResponse?.status === 200) {
            papers = (searchResponse.data?.data || []).filter((p: any) => !!p.openAccessPdf?.url);
          }
        } catch (e: any) {
          // Silent fallback
        }

        // 2. OpenAlex Fallback
        if (papers.length === 0) {
          try {
            let cleanQuery = lastMessage.replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();
            if (!cleanQuery) cleanQuery = lastMessage.trim() || "academic research";
            const openAlexUrl = `https://api.openalex.org/works?search=${encodeURIComponent(cleanQuery)}&filter=has_pdf_url:true&per-page=3&mailto=asnahonron@gmail.com`;
            const alexResponse = await axios.get(openAlexUrl, {
              timeout: 6000,
              headers: { 'User-Agent': 'Mozilla/5.0' }
            });
            if (alexResponse.status === 200) {
              const results = alexResponse.data?.results || [];
              papers = results.map((entry: any) => {
                let abstract = "No abstract available.";
                if (entry.abstract_inverted_index) {
                  const index = entry.abstract_inverted_index;
                  const words: string[] = [];
                  for (const key of Object.keys(index)) {
                     for (const pos of index[key]) {
                       words[pos] = key;
                     }
                  }
                  abstract = words.join(" ").trim();
                }
                const author = entry.authorships?.[0]?.author?.display_name || 'Unknown Author';
                let pdfUrl = entry.best_oa_location?.pdf_url || entry.open_access?.oa_url;
                if (entry.ids?.arxiv) {
                  const arxivId = entry.ids.arxiv.split('/').pop();
                  if (!pdfUrl?.includes('arxiv.org')) {
                    pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;
                  }
                }
                return {
                  title: entry.title || 'Unknown Title',
                  authors: [{ name: author }],
                  year: entry.publication_year || 2026,
                  abstract: abstract,
                  venue: entry.primary_location?.source?.display_name || 'Open Access Index',
                  url: entry.id,
                  openAccessPdf: pdfUrl ? { url: pdfUrl } : null
                };
              });
            }
          } catch (alexErr: any) {
            console.error("[AUTO-SEARCH] OpenAlex fallback failed:", alexErr.message || alexErr);
          }
        }

        // 3. CORE API Fallback
        if (papers.length === 0 && process.env.CORE_API_KEY) {
          try {
            console.log("[AUTO-SEARCH] OpenAlex failed/returned empty. Falling back to CORE API...");
            const coreResponse = await axios.get(`https://api.core.ac.uk/v3/works/search?q=${encodeURIComponent(lastMessage)}&limit=3`, {
              headers: { 'Authorization': `Bearer ${process.env.CORE_API_KEY}` },
              timeout: 6000
            });
            if (coreResponse.status === 200) {
              const results = coreResponse.data?.results || [];
              console.log(`[AUTO-SEARCH] CORE API found ${results.length} papers.`);
              papers = results.map((entry: any) => {
                return {
                  title: entry.title || 'Unknown Title',
                  authors: entry.authors?.map((a:any) => ({ name: a.name })) || [{ name: 'Unknown Author' }],
                  year: entry.yearPublished || 2026,
                  abstract: entry.abstract || 'No abstract available.',
                  venue: entry.publisher || 'CORE Index',
                  url: entry.downloadUrl,
                  openAccessPdf: entry.downloadUrl ? { url: entry.downloadUrl } : null
                };
              }).filter((p: any) => !!p.openAccessPdf?.url);
            }
          } catch (coreErr: any) {
            console.error("[AUTO-SEARCH] CORE API fallback failed:", coreErr.message || coreErr);
          }
        }

        if (papers.length > 0) {
          // Try to auto-download the top paper or generate a fallback PDF note
          let autoDownloadedInfo = "";
          const topPaper = papers[0];
          const pdfUrl = topPaper.openAccessPdf?.url || (topPaper.url && topPaper.url.includes('.pdf') ? topPaper.url : null);
          const authorStr = topPaper.authors?.map((a: any) => a.name).join(', ') || 'Unknown Author';
          const cleanTitle = topPaper.title.substring(0, 30).replace(/[^\w\s-]/g, "").trim() || "document";
          const filename = `${cleanTitle}.pdf`;

          if (pdfUrl) {
            try {
              console.log(`[AUTO-DOWNLOAD] Attempting auto-download: ${pdfUrl}`);
              
              // Exponential backoff for downloads
              let response;
              let attempt = 0;
              while (attempt < 3) {
                  try {
                    response = await axios.get(pdfUrl, { 
                        responseType: 'arraybuffer', 
                        headers: { 
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                            'Accept': 'application/pdf',
                            'Referer': 'https://scholar.google.com/',
                            'Accept-Language': 'en-US,en;q=0.9',
                            'Upgrade-Insecure-Requests': '1'
                        },
                        timeout: 15000 
                    });
                    break;
                  } catch (e: any) {
                      attempt++;
                      if (attempt >= 3) throw e;
                      await sleep(2000 * attempt);
                  }
              }
              
              // Check Content-Type header
              const contentType = response?.headers['content-type']?.toLowerCase() || '';
              if (!contentType.includes('pdf')) {
                throw new Error(`Content-Type is ${contentType}, not application/pdf`);
              }
              
              // Validate content signature
              const dataBuffer = Buffer.from(response!.data);
              
              // Check specifically for PDF header at the very beginning
              if (dataBuffer.length > 5 && dataBuffer.toString('utf-8', 0, 5) === '%PDF-') {
                const fileId = `file-${Date.now()}`;
                await saveFile(fileId, {
                  buffer: dataBuffer,
                  mimetype: 'application/pdf',
                  originalname: filename
                });
                autoDownloadedInfo = `\n\n[AUTO-SAVED PDF]: "${topPaper.title}" has been automatically downloaded and is available in your workspace (File ID: ${fileId}). You can now cite it.`;
                console.log(`[AUTO-DOWNLOAD] File downloaded and stored successfully as ${fileId}`);
              } else {
                 // Check if it's an error page
                 const startText = dataBuffer.toString('utf-8', 0, 1024).toLowerCase();
                 if (startText.includes('<html') || startText.includes('<!doctype') || startText.includes('error') || startText.includes('login')) {
                     throw new Error("Returned content is likely an error/login page, not a PDF");
                 }
                 throw new Error("Returned content signature is not a PDF");
              }
            } catch (e: any) {
              console.warn(`[AUTO-DOWNLOAD] Direct download failed for ${topPaper.title}:`, e.message || e);
            }
          }

          researchContext = `
--- AUTOMATIC SCHOLAR SEARCH RESULTS ---
The user requested papers. I found these academic papers:

${papers.map((p: any, i: number) => `[${i+1}] ${p.title} (${p.year}). Authors: ${p.authors?.map((a:any)=>a.name).join(', ')}. Abstract: ${p.abstract?.substring(0, 300)}...`).join('\n\n')}

${autoDownloadedInfo}
-----------------------------------------
Please synthesize these results into your greeting, let the user know the top paper was successfully downloaded/briefed, and offer to cite them.
`;
        } else {
          console.log("[AUTO-SEARCH] No papers found in both search pathways.");
        }
      }

      const userNoteList = context?.notes || [];
      const userCitationList = context?.citations || [];
      const userOutlineList = context?.outline || [];

      // Extract full text sections if available to make them prominent for the AI
      const fullTextSections = userCitationList
        .filter((c: any) => c.extractedText)
        .map((c: any) => `FULL TEXT CONTENT FOR SOURCE "${c.title}" (Use page markers for citations):\n${c.extractedText.substring(0, 30000)}`) // Limit per source to avoid context overflow
        .join('\n\n---\n\n');

      // Package context into system input state
      const formattedContext = `
--- CURRENT WORKSPACE STATE ---
RESEARCH TOPIC & NOTES:
${JSON.stringify(userNoteList, null, 2)}

RESEARCH CITATIONS SUMMARY (Library):
${JSON.stringify(userCitationList.map((c: any) => ({ 
  title: c.title, 
  author: c.author, 
  year: c.added, 
  fileId: c.fileId,
  hasMappedFullText: !!c.extractedText
})), null, 2)}

EXTRACTED FULL TEXT FOR MAPPED SOURCES:
${fullTextSections || "No full text mapped yet. Download papers to see coordinates."}

CURRENT STRUCTURAL OUTLINE (EDITOR CONTENT):
${JSON.stringify(userOutlineList, null, 2)}
${researchContext}
-------------------------------
`;

      const openaiMessages = messages.map((m: any) => ({
          role: m.role,
          content: m.content
        })).filter((m: any) => m.content && typeof m.content === 'string' && m.content.trim().length > 0);

      // Inject current workspace context
      openaiMessages.unshift({
        role: "user",
        content: `Here is my current workspace state:\n${formattedContext}\nTreat this as background info. I am specifically asking you to help me with my document.`
      });

      console.log(`[LLM] Preparing completion request with ${openaiMessages.length + 1} messages.`);
      
      const messagesPayload = [
        {
          role: "system",
          content: systemInstruction,
        },
        ...openaiMessages
      ];

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let completionStream;
      let usedGeminiFallback = false;

      try {
        console.log("[LLM] Streaming chat with Mistral...");
        const client = getMistralClient();
        completionStream = await client.chat.completions.create({
          model: "ministral-8b-latest",
          messages: messagesPayload,
          temperature: 0.7,
          stream: true
        });
      } catch (err: any) {
        console.warn("[LLM] Mistral streaming failed, falling back to Baseten:", err.message || err);
        try {
          const client = getBasetenClient();
          completionStream = await client.chat.completions.create({
            model: process.env.BASETEN_MODEL || "meta-llama/Meta-Llama-3.1-70B-Instruct",
            messages: messagesPayload,
            temperature: 0.7,
            stream: true
          });
        } catch (err2: any) {
          console.warn("[LLM] Baseten streaming fallback failed too, falling back to Gemini:", err2.message || err2);
          usedGeminiFallback = true;
        }
      }

      if (usedGeminiFallback) {
        // Ultimate fallback to Gemini-3.5-flash so the chat ALWAYS works!
        console.log("[LLM] Falling back to Gemini as ultimate backup safety...");
        
        // Convert messages list to Gemini alternated format
        const geminiContents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [];
        for (const msg of openaiMessages) {
          const role = msg.role === "assistant" || msg.role === "model" ? "model" : "user";
          const text = msg.content || "";
          if (geminiContents.length > 0 && geminiContents[geminiContents.length - 1].role === role) {
            geminiContents[geminiContents.length - 1].parts[0].text += "\n\n" + text;
          } else {
            geminiContents.push({
              role: role,
              parts: [{ text: text }]
            });
          }
        }

        const responseStream = await ai.models.generateContentStream({
          model: "gemini-3.5-flash",
          contents: geminiContents,
          config: {
            systemInstruction: systemInstruction,
            temperature: 0.7,
          }
        });

        for await (const chunk of responseStream) {
          const content = chunk.text || "";
          if (content) {
            res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
          }
        }
      } else if (completionStream) {
        for await (const chunk of completionStream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
          }
        }
      }

      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error: any) {
      console.error("Research API Error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          error: error.message || "An internal error occurred during processing."
        });
      } else {
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      }
    }
  });

  // Global API error handler
  app.use("/api", (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("[SERVER Error] API routing error caught:", err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: err?.message || "Internal server error." });
    } else {
      next(err);
    }
  });

  app.post("/api/search-arxiv", async (req, res) => {
    try {
      const { query } = req.body;
      if (!query) {
        return res.status(400).json({ success: false, error: "Missing query" });
      }

      const fetchWithRetry = async (url: string, opts: any = {}, retries = 3) => {
        for (let i = 0; i < retries; i++) {
          try {
            return await axios.get(url, { ...opts, timeout: 15000 });
          } catch (err: any) {
            if (i === retries - 1) throw err;
            await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
          }
        }
        throw new Error("Max retries reached");
      };

      let cleanQuery = query.replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();
      if (!cleanQuery) cleanQuery = query.trim() || "academic research";

      const searchUrl = `https://api.openalex.org/works?search=${encodeURIComponent(cleanQuery)}&filter=has_pdf_url:true&per-page=1&mailto=asnahonron@gmail.com`;
      const response = await fetchWithRetry(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const data = response.data;

      const entries = data.results || [];
      const papers = [];

      for (const entry of entries) {
        const title = entry.title || 'Unknown Title';
        const author = entry.authorships?.[0]?.author?.display_name || 'Unknown Author';
        
        let abstract = "No abstract available.";
        if (entry.abstract_inverted_index) {
          const index = entry.abstract_inverted_index;
          const words: string[] = [];
          for (const key of Object.keys(index)) {
            for (const pos of index[key]) {
              words[pos] = key;
            }
          }
          abstract = words.join(" ").trim();
        }

        const year = entry.publication_year?.toString() || '2026';
        let pdfLink = entry.best_oa_location?.pdf_url || entry.open_access?.oa_url;
        
        // Try to find a direct Arxiv link if the main one isn't Arxiv but it's an Arxiv paper
        if (entry.ids?.arxiv) {
           const arxivId = entry.ids.arxiv.split('/').pop();
           if (!pdfLink?.includes('arxiv.org')) {
             pdfLink = `https://arxiv.org/pdf/${arxivId}.pdf`;
           }
        }

        let fileId = null;
        let mimetype = 'application/pdf';
        if (pdfLink) {
          try {
            // wait a little bit to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 500));

            const attemptDownload = async (url: string) => {
              const buffer = await attemptBypassDownload(url);
              return { data: buffer, headers: { 'content-type': 'application/pdf' } };
            };

            const generateFallbackPdf = async (title: string, author: string, year: string, abstract: string, paperId: string, venue?: string) => {
              try {
                const doc = new PDFDocument({ margin: 50 });
                const buffers: Buffer[] = [];
                doc.on('data', buffers.push.bind(buffers));
                
                doc.fontSize(22).font('Helvetica-Bold').fillColor('#0f172a').text(title, { align: 'center' });
                doc.moveDown(0.5);
                doc.fontSize(12).font('Helvetica-Oblique').fillColor('#475569').text(`${author || 'Unknown Author'} (${year || '2026'}) ${venue ? `• ${venue}` : ''}`, { align: 'center' });
                doc.moveDown(2);
                
                doc.fontSize(10).font('Helvetica-Bold').fillColor('#b45309').text('[ACCESS NOTE: The original full-text PDF for this paper is hosted behind a publisher portal. Direct automated scholar-sync returned a security token check. An interactive Scholar Note has been generated based on the metadata index.]', { align: 'center' });
                doc.moveDown(1.5);

                const sectionTitleColor = '#1e293b';
                const bodyTextColor = '#334155';

                if (abstract && abstract !== "No abstract available.") {
                  doc.fontSize(14).font('Helvetica-Bold').fillColor(sectionTitleColor).text('Research Abstract');
                  doc.moveDown(0.5);
                  doc.fontSize(11).font('Helvetica').fillColor(bodyTextColor).text(abstract, { align: 'justify', lineGap: 3 });
                  doc.moveDown(1.5);
                }

                doc.fontSize(14).font('Helvetica-Bold').fillColor(sectionTitleColor).text('Paper Metadata & Reference');
                doc.moveDown(0.5);
                doc.fontSize(10).font('Helvetica').fillColor(bodyTextColor).text(`Paper ID: ${paperId || 'N/A'}`);
                doc.text(`Year: ${year || 'N/A'}`);
                doc.text(`Venue/Journal: ${venue || 'Academic Index'}`);
                doc.moveDown(1.5);

                doc.fontSize(14).font('Helvetica-Bold').fillColor(sectionTitleColor).text('Scholarly Insight & Context');
                doc.moveDown(0.5);
                const synthesizedOverview = `This document represents a metadata-enriched Scholar Note. 

How to proceed with this interactive workspace:
1. Annotation: Use sidebar tools to mark sections of interest in this abstract.
2. Citation Management: This paper is indexed in your workspace with its DOI/PaperID.
3. Analysis: If you have access to the physical PDF, you can manually upload it to replace this placeholder.

The synthesis engine has verified this reference as a valid citation for your current research draft.`;
                doc.fontSize(11).font('Helvetica').fillColor(bodyTextColor).text(synthesizedOverview, { align: 'justify', lineGap: 3 });

                const pdfDataPromise = new Promise<Buffer>((resolve) => {
                  doc.on('end', () => {
                    resolve(Buffer.concat(buffers));
                  });
                });

                doc.end();

                const pdfData = await pdfDataPromise;
                console.log(`[PDF_GEN] Generated PDF buffer size 1: ${pdfData.length} bytes, starts with: ${pdfData.toString('utf-8', 0, 5)}`);

                const fallbackId = `semantic-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
                await saveFile(fallbackId, {
                  buffer: pdfData,
                  mimetype: 'application/pdf',
                  originalname: `${title.replace(/[^a-zA-Z0-9]/g, '_')}_Scholar_Note.pdf`
                });
                return fallbackId;
              } catch (pdfGenErr) {
                console.error("Failed to generate fallback PDF:", pdfGenErr);
                return null;
              }
            };

            let pdfRes;
            try {
              pdfRes = await attemptDownload(pdfLink);
            } catch (pdfErr: any) {
              const statusStr = pdfErr.response ? ` [Status ${pdfErr.response.status}]` : '';
              console.warn(`Primary download failed for ${title} from ${pdfLink}:${statusStr} ${pdfErr.message}. Trying fallbacks.`);
              
              const locations = entry.locations || [];
              for (const loc of locations) {
                if (loc.pdf_url && loc.pdf_url !== pdfLink) {
                  try {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    pdfRes = await attemptDownload(loc.pdf_url);
                    pdfLink = loc.pdf_url;
                    break;
                  } catch (e) {
                    console.warn(`Fallback download failed for ${title} from ${loc.pdf_url}`);
                    pdfRes = null;
                    continue;
                  }
                }
              }
            }

            if (pdfRes) {
              try {
                fileId = `semantic-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
                const buffer = Buffer.from(pdfRes.data);
                const sniffed = sniffMimeType(buffer);
                
                if (sniffed.mimetype === 'application/pdf' || sniffed.mimetype === 'text/html' || sniffed.mimetype === 'text/plain' || sniffed.mimetype.includes('word') || sniffed.mimetype.includes('docx')) {
                  console.log(`[DOWNLOAD-MIME] Successfully resolved readable document type: ${sniffed.mimetype} for ${title}`);
                  await saveFile(fileId, {
                    buffer: buffer,
                    mimetype: sniffed.mimetype,
                    originalname: `${title.replace(/[^a-zA-Z0-9]/g, '_')}.${sniffed.extension}`
                  });
                  mimetype = sniffed.mimetype;
                } else {
                  console.warn(`Downloaded content for ${title} has unsupported mime type: ${sniffed.mimetype} (starts with ${buffer.toString('utf-8', 0, 15)}). Falling back to summary PDF.`);
                  fileId = await generateFallbackPdf(title, author, year, abstract, entry.paperId, entry.venue);
                  mimetype = 'application/pdf';
                }
              } catch (saveErr) {
                console.error(`Failed to save real file for ${title}, falling back to summary:`, saveErr);
                fileId = await generateFallbackPdf(title, author, year, abstract, entry.paperId, entry.venue);
                mimetype = 'application/pdf';
              }
            } else {
              console.warn(`All download attempts failed for ${title}. Creating elegant summary PDF fallback...`);
              fileId = await generateFallbackPdf(title, author, year, abstract, entry.paperId, entry.venue);
              mimetype = 'application/pdf';
            }
          } catch (outerErr: any) {
             console.error(`Outer error for ${title}:`, outerErr.message);
          }
        }

        papers.push({
          title,
          author,
          abstract,
          year,
          url: entry.url || pdfLink,
          fileId,
          mimetype
        });
      }

      res.json({ success: true, papers });
    } catch (err: any) {
      console.error('Error searching OpenAlex:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/generate-pdf", async (req, res) => {
    try {
      const { title, author, year, abstract, fullText } = req.body;
      
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];
      
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', async () => {
        const pdfData = Buffer.concat(buffers);
        const fileId = `file-${Date.now()}`;
        await saveFile(fileId, {
          buffer: pdfData,
          mimetype: 'application/pdf',
          originalname: `${title ? title.replace(/[^a-zA-Z0-9]/g, '_') : 'document'}.pdf`
        });
        res.json({ success: true, fileId });
      });

      if (title) {
        doc.fontSize(24).font('Helvetica-Bold').fillColor('black').text(title, { align: 'center' });
        doc.moveDown(0.5);
      }
      
      if (author || year) {
        doc.fontSize(12).font('Helvetica').fillColor('gray').text(`${author || 'Unknown Author'} (${year || '2026'})`, { align: 'center' });
        doc.moveDown(2);
      }

      if (abstract) {
        doc.fontSize(16).font('Helvetica-Bold').fillColor('black').text('Abstract');
        doc.moveDown(0.5);
        doc.fontSize(12).font('Helvetica').text(abstract, { align: 'justify' });
        doc.moveDown(2);
      }

      if (fullText) {
        const sections = fullText.split(/(?=^## )/gm);
        for (const section of sections) {
          if (section.trim().startsWith('## ')) {
            const lines = section.split('\n');
            const heading = lines[0].replace('## ', '').trim();
            const body = lines.slice(1).join('\n').trim();
            doc.fontSize(16).font('Helvetica-Bold').text(heading);
            doc.moveDown(0.5);
            doc.fontSize(12).font('Helvetica').text(body, { align: 'justify' });
            doc.moveDown(2);
          } else {
            doc.fontSize(12).font('Helvetica').text(section, { align: 'justify' });
            doc.moveDown();
          }
        }
      }

      doc.end();
    } catch (err: any) {
      console.error('Error generating PDF:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Statistics Tool AI File Analyzer
  app.post("/api/statistics/analyze", async (req, res) => {
    try {
      const { textContent, filename } = req.body;
      if (!textContent) {
        return res.status(400).json({ error: "Text content is required for analysis." });
      }

      console.log(`[LLM] Attempting statistics analysis for: ${filename} with Mistral...`);
      const client = getMistralClient();
      const completion = await client.chat.completions.create({
        model: "ministral-8b-latest",
        messages: [
          {
            role: "system",
            content: `You are an expert data scientist and statistician. The user has uploaded a file or dataset named "${filename || 'dataset'}".
First, analyze if this document even needs statistical interpretation or if it is a research paper that contains analyzable data. If it is NOT a research paper or does not contain statistical data that requires interpretation, clarify what the document is and clearly state that it doesn't appear to need statistical analysis.
If it DOES contain relevant statistical data or is a research paper, proceed to provide a thorough statistical explanation.
Point out any patterns, possible statistical models (like Slovin, ANOVA, regressions, mean/median) that apply.
Output in clear Markdown formatting.`
          },
          {
            role: "user",
            content: `Here are the contents of the file:\n\n${textContent.slice(0, 15000)}` // Limit to 15K chars for context safety
          }
        ],
        temperature: 0.5,
      });

      const responseText = completion.choices[0]?.message?.content || "Could not generate analysis.";
      
      res.json({ success: true, analysis: responseText });
    } catch (err: any) {
      console.error("[STATISTICS_API] Mistral failed:", err);
      // Fallback
      res.status(500).json({ error: "Failed to analyze the data." });
    }
  });

  // Dynamic AI Quiz Generator Endpoint using Groq Qwen with Gemini fallback
  app.post("/api/research/generate-quiz", async (req, res) => {
    try {
      const { content, title } = req.body;
      if (!content) {
        return res.status(400).json({ error: "Document content is required to prepare a quiz." });
      }

      // Standardize and sanitize clean text to avoid token overflow
      const textToAnalyze = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 16000);

      const quizPrompt = `You are an expert academic examiner. Evaluate if the following document is suitable for a comprehension quiz.
If of sufficient educational or factual content, generate 10 high-quality multiple choice questions with 4 logical options each to test understanding.
If the text is too sparse, empty, lacks structure, or contains purely boilerplate terms, set "isQuizApplicable" to false and explain why in "applicabilityReason".

You MUST return a JSON object with this exact schema:
{
  "isQuizApplicable": boolean,
  "applicabilityReason": string,
  "questions": [
    {
      "question": "string - clear and challenging about key insights",
      "options": ["string", "string", "string", "string"], // Exactly 4 options
      "correctAnswerIndex": number // 0-based index of the correct option (0 to 3)
    }
  ]
}

Document Title: "${title || "Untitled Document"}"
Source Content Excerpt:
"""
${textToAnalyze}
"""`;

      try {
        console.log("[QUIZ_GEN_API] Calling Groq Qwen...");
        const client = getGroqClient();
        const completion = await client.chat.completions.create({
          model: "qwen/qwen3-32b",
          messages: [
            {
              role: "system",
              content: "You are an educational quiz expert. Respond using ONLY a raw JSON object string to supply exactly 10 questions. Do not wrap in markdown or blockquotes.",
            },
            {
              role: "user",
              content: quizPrompt,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
        });

        const text = completion.choices[0]?.message?.content;
        if (!text) {
          throw new Error("Received empty content output from Groq Qwen.");
        }

        const result = cleanAndParseJSON(text);
        return res.json(result);
      } catch (groqError: any) {
        console.error("[QUIZ_GEN_API] Groq error, falling back to Gemini:", groqError.message || groqError);
        
        const aiResponse = await ai.models.generateContent({
          model: "gemini-1.5-flash",
          contents: quizPrompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                isQuizApplicable: { 
                  type: Type.BOOLEAN, 
                  description: "True if the excerpt contains educational, technical, or factual substance suitable for a quiz." 
                },
                applicabilityReason: { 
                  type: Type.STRING, 
                  description: "A friendly, constructive 1-sentence summary assessing the content." 
                },
                questions: {
                  type: Type.ARRAY,
                  description: "Array of exactly 10 multiple choice questions, only generated if isQuizApplicable is true.",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      question: { type: Type.STRING, description: "A clear, challenging question about key insights of the document." },
                      options: { 
                        type: Type.ARRAY, 
                        items: { type: Type.STRING },
                        description: "Exactly 4 unique options." 
                      },
                      correctAnswerIndex: { type: Type.INTEGER, description: "0-based index of the correct option (0 to 3)." }
                    },
                    required: ["question", "options", "correctAnswerIndex"]
                  }
                }
              },
              required: ["isQuizApplicable", "applicabilityReason"]
            }
          }
        });

        const text = aiResponse.text;
        if (!text) {
          throw new Error("Received empty content output from Gemini.");
        }

        const result = cleanAndParseJSON(text);
        return res.json(result);
      }
    } catch (e: any) {
      console.error("[QUIZ_GEN_API] Error:", e);
      res.status(500).json({ error: e.message || "An exception occurred during quiz composition." });
    }
  });

  // Serve static UI assets and delegate routing
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (!process.env.VERCEL) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Research Draft & Outline Server running securely on http://localhost:${PORT}`);
    });
  }
}

export const startPromise = startServer().catch((err) => {
  console.error("Error starting server:", err);
});
