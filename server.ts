/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import dotenv from "dotenv";
dotenv.config();

process.on("uncaughtException", (err) => {
  console.error("[PROCESS UNCAUGHT EXCEPTION]", err);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("[PROCESS UNHANDLED REJECTION]", reason);
});

import "express-async-errors";
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
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
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

import { decompressResponse, tryDecompressFallback, extractAllContentStrings, cleanJsonLeak, cleanAndParseJSON, sniffMimeType, extractDirectPdfFromLandingPage, robustDownloadPdf, attemptBypassDownload, extractTextFromHtml } from "./src/api/utils/file-parsers.js";
import { z } from "zod";
import {
  SendVerificationSchema,
  VerifyCodeSchema,
  CustomTokenSchema,
  OcrImageSchema,
  DownloadPdfSchema,
  ResolveDoiSchema,
  ParseTextSchema,
  SynthesizeSchema,
  SummarizeUrlSchema,
  GenerateTitleSchema,
  ChatSchema,
  SearchArxivSchema,
  GeneratePdfSchema,
  AnalyzeStatsSchema,
  GenerateQuizSchema,
  GenerateNotesSchema,
  VoyageEmbedSchema,
  VoyageRerankSchema,
  LinkPreviewSchema,
  FileIdSchema,
  SearchPapersSchema
} from "./src/api/utils/validators.js";
import { getGeminiClient, getVoyageClient, getBasetenClient, getMistralClient, getGroqClient, getCohereClient, getUpstageClient, getRekaClient, getInceptionClient, getXiaomiClient } from "./src/api/services/ai.js";
import { saveFile, getFile, getR2Client, getCachedPaper, setCachedPaper } from "./src/api/services/storage.js";

const ai = getGeminiClient();
const PORT = 3000;

const systemInstruction = `You are an AI Student Success Mentor. Your job is to help the user write, organize, and research their document while keeping them motivated and on track! You are exceptionally enthusiastic, relatable, and encouraging—think of yourself as a helpful senior student or a cool academic coach. You love deep-diving into topics and providing comprehensive, high-quality drafts.

You are given the current research context of the user workspace:
1. "Notes": Loose, raw ideas, citations fragments, or reference quotes.
2. "Citations": Formatted bibliography entries (APA, MLA, IEEE, Chicago) containing meta-attributes.
3. "Outline / Drafts": The current document state.

TONE & BEHAVIOR:
- **Relatable & Student-Friendly**: Use an engaging, warm, and supportive tone.
- **Smart Editor**: ONLY provide draft edits or delegate to the specialized agent, **Blob**, if the user explicitly asks for writing, editing, generating, draft-making, or rewriting.
- **Interactive PDF Mapping**: When you refer to content from a mapped PDF in the "Citations" list, you MUST include an interactive citation in your chat response using the following format: '[[page:NUMBER|SOURCE_TITLE]]'.
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
If the user asks to "find", "search", "lookup", "download", or "get sources/papers/research" about any topic:
1. Briefly state in <chat> that you are searching for real academic papers.
2. You MUST append a <searchRealPapers> XML element immediately after your </chat> element containing ONLY a single short search query string.
3. **NO HALLUCINATED ABSTRACTS ON DOWNLOAD FAILURE**.

CRITICAL RULE ABOUT DOCUMENT EDITING (DELEGATION TO EDITOR AGENT):
If AND ONLY IF the user EXPLICITLY asks you to "write an essay", "create a document", "draft a text", "generate an outline", "write a section", "rewrite/edit the content", YOU MUST delegate this task to our specialized agent, **Blob**.
Immediately after your </chat> element, append a <callEditorAgent> XML element containing a comprehensive prompt detailing what Blob should write.
`;






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
      console.log(
        "[FIREBASE] Success initializing Admin SDK with project ID:",
        firebaseConfig.projectId,
      );
    } catch (err) {
      console.error("[FIREBASE] Firebase Admin initialization failed:", err);
    }
  } else {
    console.warn(
      "[FIREBASE] No firebase-applet-config.json or projectId present. Skipped administrative SDK setup.",
    );
  }
}

// Lazy/Safe proxy initializer for GoogleGenAI to prevent failure if API key is not present during build/evaluation time


// In-memory file registry (as a cache)


// Load downloaded papers cache from disk






import apiRouter from "./src/api/routes/index.js";

const app = express();

app.use("/api", apiRouter);

// Add request logger for debugging
app.use((req, res, next) => {
  if (!req.url.startsWith('/@vite') && !req.url.startsWith('/src') && !req.url.startsWith('/node_modules')) {
    console.log(`[HTTP] ${req.method} ${req.url}`);
  }
  next();
});

// Health check endpoint
app.post("/api/log-error", express.json(), (req, res) => {
  const fs = require('fs');
  fs.writeFileSync('error-stack.txt', req.body.stack || req.body.message);
  res.send('ok');
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});
export { app };

async function startServer() {
    
  // Robust static asset serving for images/assets to prevent SPA fallback
  app.use((req, res, next) => {
    const urlPath = req.path;
    const ext = path.extname(urlPath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      ".png": "image/png",
      ".svg": "image/svg+xml",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
      ".gif": "image/gif",
      ".ico": "image/x-icon",
    };

    if (mimeTypes[ext]) {
      const pathsToTry = [
        path.join(process.cwd(), "public", urlPath),
        path.join(process.cwd(), "dist", urlPath),
        path.join(process.cwd(), urlPath),
      ];

      for (const p of pathsToTry) {
        try {
          if (fs.existsSync(p) && fs.statSync(p).isFile()) {
            console.log(
              `[StaticServe] Serving ${urlPath} as ${mimeTypes[ext]} from ${p}`,
            );
            res.setHeader("Content-Type", mimeTypes[ext]);
            res.setHeader("Cache-Control", "public, max-age=3600");
            return res.sendFile(p);
          }
        } catch (e) {
          // Skip
        }
      }
      console.warn(
        `[StaticServe] Asset NOT FOUND for correctly matched extension: ${urlPath}. Tried: ${pathsToTry.join(", ")}`,
      );
    }
    next();
  });

  // Request logger middleware
  app.use((req, res, next) => {
    if (req.url.startsWith("/api/")) {
      console.log(`[HTTP] ${req.method} ${req.url}`);
    }
    next();
  });

  app.use(express.json({ limit: "100mb" }));

  // Helper to retrieve the current Firestore instance
  const getDbInstance = () => {
    const customDbId = (firebaseConfig as any).firestoreDatabaseId;
    return customDbId
      ? getFirestore(admin.apps[0] || admin.app(), customDbId)
      : admin.firestore();
  };

  // In-memory verification code storage (bypasses Firestore rules and IAM issues for ephemeral email codes)
  const verificationCodesData = new Map<
    string,
    { code: string; expiresAt: number }
  >();

  // Resend API: Send 6-digit confirmation code
  app.post("/api/send-verification", async (req, res) => {
    const { email } = req.body;
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Email address is required." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    // Generate a 6-digit number code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    try {
      // Save code in memory (15 min expiration)
      verificationCodesData.set(normalizedEmail, {
        code,
        expiresAt: Date.now() + 15 * 60 * 1000,
      });

      console.log(`[VERIFICATION-MEMORY] Code saved for: ${normalizedEmail}`);

      const gmailUser = process.env.GMAIL_USER;
      const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

      if (!gmailUser || !gmailAppPassword) {
        console.log(
          `\n=============================================================`,
        );
        console.log(
          `[VERIFICATION CODE MOCK] NO GMAIL_USER OR GMAIL_APP_PASSWORD DETECTED!`,
        );
        console.log(
          `FOR TESTING, USE THIS VERIFICATION CODE FOR: ${normalizedEmail}`,
        );
        console.log(`CODE: ${code}`);
        console.log(
          `=============================================================\n`,
        );
        return res.json({
          success: true,
          mocked: true,
          message:
            "No Gmail credentials found. For testing, the verification code has been printed to the server command line console.",
        });
      }

      const nodemailer = await import("nodemailer");

      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: gmailUser,
          pass: gmailAppPassword,
        },
      });

      const mailOptions = {
        from: `"Cosmi" <${gmailUser}>`,
        to: normalizedEmail,
        subject: "Verify your Cosmi account",
        html: `
<!DOCTYPE html>
<html>
<head>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
</head>
<body style="background-color: #f9fafb; padding: 40px 0; margin: 0; font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; -webkit-font-smoothing: antialiased;">
          <div style="max-width: 440px; margin: 0 auto; padding: 44px 36px; border: 1px solid #e4e4e7; border-radius: 12px; background-color: #ffffff; color: #09090b; text-align: center; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.05);">
            <div style="margin-bottom: 28px;">
              <span style="font-family: 'DM Sans', sans-serif; font-weight: 800; font-size: 24px; letter-spacing: -0.05em; color: #09090b;">cosmi</span>
            </div>
            <h2 style="font-size: 21px; font-weight: 600; margin: 0 0 10px 0; color: #09090b; letter-spacing: -0.025em; line-height: 1.2;">Verify your email</h2>
            <p style="font-size: 14px; line-height: 1.6; color: #4b5563; margin: 0 0 32px 0;">Please enter the 6-digit confirmation code below to complete your registration.</p>
            
            <div style="text-align: center; margin-bottom: 32px; white-space: nowrap;">
              ${code
                .split("")
                .map(
                  (digit) =>
                    `<div style="display: inline-block; width: 44px; height: 52px; margin: 0 4px; line-height: 52px; font-size: 22px; font-weight: 600; color: #09090b; background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; text-align: center;">${digit}</div>`,
                )
                .join("")}
            </div>

            <p style="font-size: 12px; line-height: 1.6; color: #71717a; margin: 24px 0 0 0;">If you don't see this email in your inbox, please check your spam or junk folder.</p>
            <p style="font-size: 11px; line-height: 1.6; color: #a1a1aa; margin: 12px 0 0 0;">This code is valid for 15 minutes. If you did not request this, you can ignore this security email.</p>
          </div>
</body>
</html>
        `,
      };

      await transporter.sendMail(mailOptions);

      console.log(
        `[NODEMAILER] Emailed verification code successfully to: ${normalizedEmail}`,
      );
      return res.json({ success: true });
    } catch (err: any) {
      console.error("[VERIFICATION-SEND-ERROR] Failed to send email:", err);
      return res
        .status(500)
        .json({ error: `Verification delivery failed: ${err.message || err}` });
    }
  });

  // Resend API: Verify 6-digit confirmation code
  app.post("/api/verify-code", async (req, res) => {
    const { email, code } = req.body;
    if (!email || !code) {
      return res
        .status(400)
        .json({ error: "Email address and code are both required." });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedCode = code.trim();

    try {
      const record = verificationCodesData.get(normalizedEmail);

      if (!record) {
        return res
          .status(400)
          .json({
            error:
              "No active verification request found for this email address. Please request a new code.",
          });
      }

      // Expire codes after 15 minutes
      if (Date.now() > record.expiresAt) {
        verificationCodesData.delete(normalizedEmail);
        return res
          .status(400)
          .json({
            error:
              "This confirmation code has expired. Please request a new one.",
          });
      }

      if (record.code !== normalizedCode) {
        return res
          .status(400)
          .json({
            error: "Invalid confirmation code. Please check and retype.",
          });
      }

      // Valid and verified! Delete from memory to prevent multi-use
      verificationCodesData.delete(normalizedEmail);
      console.log(
        `[VERIFICATION-SUCCESS] ${normalizedEmail} successfully validated.`,
      );
      return res.json({ success: true, verified: true });
    } catch (err: any) {
      console.error("[VERIFICATION-CHECK-ERROR] Validation query failed:", err);
      return res
        .status(500)
        .json({ error: `Validation check failed: ${err.message || err}` });
    }
  });



  // Dynamic public metadata resolver for rich inline link-previews
  app.get("/api/link-preview", async (req, res) => {
    const { url } = req.query;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "URL query parameter is required" });
    }

    try {
      const parsedUrl = new URL(url);

      // 1. YouTube specialized scraper/oembed
      if (
        parsedUrl.hostname.includes("youtube.com") ||
        parsedUrl.hostname.includes("youtu.be")
      ) {
        let videoId = "";
        const regExp =
          /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
        const match = url.match(regExp);
        if (match && match[2] && match[2].length === 11) {
          videoId = match[2];
        }

        if (videoId) {
          try {
            const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
            const oembedResponse = await axios.get(oembedUrl, {
              timeout: 3500,
            });
            if (oembedResponse.status === 200) {
              const data = oembedResponse.data;
              return res.json({
                title: data.title || "YouTube Video Reference",
                description: `YouTube video from creator channel: ${data.author_name || "YouTube Creator"}. Click to watch.`,
                image: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
                siteName: "YouTube",
                isVideo: true,
              });
            }
          } catch (e: any) {
            console.warn(
              "[PREVIEW] YouTube oembed lookup failed, fallback to direct thumbnail",
              e.message,
            );
          }

          return res.json({
            title: "YouTube Video Reference",
            description: "Watch this video presentation directly on YouTube.",
            image: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
            siteName: "YouTube",
            isVideo: true,
          });
        }
      }

      // 2. Regular website scraper - with Native Fetch, You.com API, and Search Fallback
      let html = "";
      let fetchSuccess = false;
      let title = parsedUrl.hostname;
      let description = `Browse research and articles directly on ${parsedUrl.hostname}.`;
      let image = "";
      let resolved = false;

      const urlLower = url.toLowerCase();
      const shouldSkipDirectScrape =
        urlLower.includes("reddit.com") ||
        urlLower.includes("yahoo.com") ||
        urlLower.includes("twitter.com") ||
        urlLower.includes("x.com") ||
        urlLower.includes("bloomberg.com") ||
        urlLower.includes("nytimes.com") ||
        urlLower.includes("medium.com") ||
        urlLower.includes("quora.com") ||
        urlLower.includes("facebook.com") ||
        urlLower.includes("instagram.com") ||
        urlLower.includes("linkedin.com") ||
        urlLower.includes("sciencedirect.com") ||
        urlLower.includes("springer.com") ||
        urlLower.includes("nature.com") ||
        urlLower.includes("wsj.com") ||
        urlLower.includes("wired.com") ||
        urlLower.includes("ft.com") ||
        urlLower.includes("cnbc.com");

      // 2a. You.com fallback - Extremely fast and bypasses direct anti-scraping blocks
      const youApiKey = process.env.YOU_API_KEY;
      if (youApiKey && youApiKey.trim() !== "") {
        const previewEndpoints = [
          `https://api.ydc-index.io/v1/search?query=${encodeURIComponent(url)}`,
          `https://api.ydc-index.io/search?query=${encodeURIComponent(url)}`,
        ];
        for (const endpoint of previewEndpoints) {
          try {
            console.log(
              "[PREVIEW] Resolving preview with You.com api for:",
              url,
              "at endpoint:",
              endpoint,
            );
            const trimmedKey = youApiKey.trim();
            const response = await axios.get(endpoint, {
              headers: {
                "X-API-KEY": trimmedKey,
                Accept: "application/json",
              },
              timeout: 3000,
            });

            if (
              response.status === 200 &&
              response.data &&
              (response.data.hits || response.data.results)
            ) {
              const hits = response.data.hits || response.data.results || [];
              if (hits.length > 0) {
                const bestHit = hits[0];
                title = bestHit.title || title;
                description =
                  bestHit.snippet || bestHit.description || description;
                image = bestHit.thumbnail?.original || image;
                resolved = true;
                console.log(
                  "[PREVIEW] Successfully resolved from You.com API at:",
                  endpoint,
                );
                break;
              }
            }
          } catch (youErr: any) {
            console.warn(
              `[PREVIEW] You.com endpoint ${endpoint} failed:`,
              youErr.message || youErr,
            );
            if (youErr.response?.status === 401 || youErr.response?.status === 403) {
              break; // Invalid/unauthorized key, stop
            }
          }
        }
      }

      // 2b. Direct scrape only if the domain is benign
      if (!resolved && !shouldSkipDirectScrape) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 3500);

          const fetchRes = await fetch(url, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
              Accept:
                "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.9",
              "Cache-Control": "no-cache",
            },
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (fetchRes.ok) {
            html = await fetchRes.text();
            fetchSuccess = true;
          }
        } catch (fetchErr: any) {
          // Silent fallback
        }

        // If native fetch failed, attempt a backup direct get with axios
        if (!fetchSuccess) {
          try {
            const response = await axios.get(url, {
              headers: {
                "User-Agent":
                  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
                Accept:
                  "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
              },
              timeout: 2500,
            });
            html = response.data;
            fetchSuccess = true;
          } catch (axiosErr: any) {
            // Silent fallback
          }
        }
      }

      // 2c. If direct attempts fail/skipped, query DDG search as a super high-quality fallback
      if (!resolved && (!fetchSuccess || shouldSkipDirectScrape)) {
        try {
          const ddgSearchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(url)}`;
          const ddgResponse = await axios.get(ddgSearchUrl, {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
              "Accept-Language": "en-US,en;q=0.9",
            },
            timeout: 3500,
          });
          const ddgHtml = ddgResponse.data;

          // Match result titles and direct links
          const resultARegex =
            /<a class="result__a" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
          const snippetRegex =
            /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

          let matchA;
          const titlesAndLinks: Array<{ href: string; title: string }> = [];
          while ((matchA = resultARegex.exec(ddgHtml)) !== null) {
            let href = matchA[1];
            if (href.includes("uddg=")) {
              const parts = href.split("uddg=");
              if (parts[1]) {
                href = decodeURIComponent(parts[1].split("&")[0]);
              }
            }
            const titleVal = matchA[2].replace(/<[^>]*>/g, "").trim();
            titlesAndLinks.push({ href, title: titleVal });
          }

          let matchSnippet;
          const snippets: string[] = [];
          while ((matchSnippet = snippetRegex.exec(ddgHtml)) !== null) {
            const snippet = matchSnippet[1].replace(/<[^>]*>/g, "").trim();
            snippets.push(snippet);
          }

          if (titlesAndLinks.length > 0) {
            let bestIndex = 0;
            const targetHostname = parsedUrl.hostname
              .toLowerCase()
              .replace(/^www\./, "");
            for (let i = 0; i < titlesAndLinks.length; i++) {
              if (
                titlesAndLinks[i].href.toLowerCase().includes(targetHostname)
              ) {
                bestIndex = i;
                break;
              }
            }

            const bestResult = titlesAndLinks[bestIndex];
            const bestSnippet = snippets[bestIndex] || "";
            const siteName = parsedUrl.hostname.replace(/^www\./, "");

            return res.json({
              title: bestResult.title,
              description:
                bestSnippet ||
                `Resolved reference link from ${parsedUrl.hostname}.`,
              image: "",
              siteName,
            });
          }
        } catch (ddgErr: any) {
          // Silent fallback
        }
      }

      const decodeHtmlEntities = (str: string) => {
        return str
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&rsquo;/g, "'")
          .replace(/&lsquo;/g, "'")
          .replace(/&ldquo;/g, '"')
          .replace(/&rdquo;/g, '"')
          .replace(/&ndash;/g, "–")
          .replace(/&mdash;/g, "—");
      };

      if (!resolved) {
        title = parsedUrl.hostname;
        description = `Browse research and articles directly on ${parsedUrl.hostname}.`;
        image = "";
      }

      if (fetchSuccess && html) {
        const titleMatch =
          html.match(
            /<meta\s+property=["']og:title["']\s+content=["']([\s\S]*?)["']/i,
          ) ||
          html.match(
            /<meta\s+name=["']twitter:title["']\s+content=["']([\s\S]*?)["']/i,
          ) ||
          html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

        const descMatch =
          html.match(
            /<meta\s+property=["']og:description["']\s+content=["']([\s\S]*?)["']/i,
          ) ||
          html.match(
            /<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i,
          ) ||
          html.match(
            /<meta\s+name=["']twitter:description["']\s+content=["']([\s\S]*?)["']/i,
          );

        const imageMatch =
          html.match(
            /<meta\s+property=["']og:image["']\s+content=["']([\s\S]*?)["']/i,
          ) ||
          html.match(
            /<meta\s+name=["']twitter:image["']\s+content=["']([\s\S]*?)["']/i,
          );

        if (titleMatch && titleMatch[1]) {
          title = decodeHtmlEntities(
            titleMatch[1].replace(/<[^>]*>/g, "").trim(),
          );
        }

        if (descMatch && descMatch[1]) {
          description = decodeHtmlEntities(
            descMatch[1].replace(/<[^>]*>/g, "").trim(),
          );
        }

        if (imageMatch && imageMatch[1]) {
          image = imageMatch[1].trim();
        }
      }

      const siteName = parsedUrl.hostname.replace(/^www\./, "");

      return res.json({
        title,
        description,
        image,
        siteName,
      });
    } catch (err: any) {
      console.warn("[PREVIEW] Link preview scrape failed", err.message);
      let siteName = "External Reference";
      try {
        siteName = new URL(url).hostname.replace(/^www\./, "");
      } catch {}

      return res.json({
        title: siteName,
        description: `Reference link to ${siteName}. Click to open the web resource.`,
        image: "",
        siteName,
      });
    }
  });

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  });

  // Safe upload route using standard multer middleware
  app.post(
    "/api/upload",
    (req, res, next) => {
      upload.single("file")(req, res, function (err) {
        if (err instanceof multer.MulterError) {
          return res.status(400).json({ success: false, error: err.message });
        } else if (err) {
          return res.status(500).json({ success: false, error: err.message });
        }
        next();
      });
    },
    async (req, res) => {
      try {
        if (!req.file) {
          console.warn("[UPLOAD] No file was found in req.file");
          return res
            .status(400)
            .json({ success: false, error: "No file uploaded" });
        }

        console.log(
          `[UPLOAD] Processing file: ${req.file.originalname} (${req.file.mimetype}, ${req.file.size} bytes)`,
        );

        const fileId = `file-${Date.now()}`;
        await saveFile(fileId, {
          buffer: req.file.buffer,
          mimetype: (req.file.mimetype as string) || "application/octet-stream",
          originalname: req.file.originalname as string,
        });

        console.log(`[UPLOAD] File registered successfully with ID: ${fileId}`);

        res.json({
          success: true,
          fileId,
          fileName: req.file.originalname,
          mimetype: req.file.mimetype,
        });
      } catch (routeErr: any) {
        throw routeErr;
      }
    },
  );

  app.post("/api/auth/custom-token", async (req, res) => {
    try {
      const { idToken } = CustomTokenSchema.parse(req.body);
      if (!idToken) {
        return res.status(400).json({ error: "Missing idToken" });
      }

      // Verify the ID token
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const uid = decodedToken.uid;

      // Create a custom token
      const customToken = await admin.auth().createCustomToken(uid);

      res.json({ customToken });
    } catch (err: any) {
      throw err;
    }
  });

  app.get("/api/files/:id", async (req, res) => {
    const { id } = FileIdSchema.parse(req.params);
    const file = await getFile(id);
    if (!file) {
      return res.status(404).send("File not found");
    }
    res.setHeader("Content-Type", file.mimetype);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${encodeURIComponent(file.originalname)}"`,
    );
    res.send(file.buffer);
  });

  app.get("/api/files/:id/raw-text", async (req, res) => {
    const { id } = FileIdSchema.parse(req.params);
    const file = await getFile(id);
    if (!file) {
      return res.status(404).json({ success: false, error: "File not found" });
    }

    try {
      const extension = (file.originalname || "").toLowerCase().split(".").pop();
      const mimetype = file.mimetype || "application/octet-stream";
      const isImage = mimetype.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif"].includes(extension || "");

      if (isImage) {
        console.log(`[OCR] Auto-running OCR on uploaded image ${req.params.id} via Gemini API...`);
        const imagePart = {
          inlineData: {
            mimeType: mimetype.startsWith("image/") ? mimetype : "image/jpeg",
            data: file.buffer.toString("base64"),
          },
        };
        const promptPart = {
          text: "Extract and transcribe all text from this image. Output only the plain text found in the image, preserving the layout as much as possible. Do not add any conversational commentary, explanations, or wrapper markdown blocks."
        };
        const response = await ai.models.generateContent({
          model: "gemini-flash-latest",
          contents: [{ role: "user", parts: [imagePart, promptPart] }]
        });
        const transText = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
        return res.json({ success: true, text: transText });
      } else if (extension === "docx") {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        return res.json({ success: true, text: result.value });
      } else if (
        extension === "txt" ||
        extension === "md" ||
        extension === "html" ||
        extension === "json" ||
        extension === "csv" ||
        extension === "tsv"
      ) {
        return res.json({ success: true, text: file.buffer.toString("utf-8") });
      } else {
        return res.json({
          success: true,
          text: "",
          message: "Standard parsing not supported for this file type",
        });
      }
    } catch (err: any) {
      console.error("Error extracting text from file:", err);
      throw err;
    }
  });

  app.post("/api/ocr-image", async (req, res) => {
    try {
      const { base64, mimeType } = OcrImageSchema.parse(req.body);
      if (!base64) {
        return res.status(400).json({ success: false, error: "Missing image base64 data" });
      }

      const safeMimeType = mimeType || "image/jpeg";
      console.log(`[OCR] Direct image OCR request (${safeMimeType}, base64 length: ${base64.length})`);

      const imagePart = {
        inlineData: {
          mimeType: safeMimeType,
          data: base64,
        },
      };

      const promptPart = {
        text: "Extract and transcribe all text from this image. Output only the plain text found in the image, preserving the layout as much as possible. Do not add any conversational commentary, explanations, or wrapper markdown blocks."
      };

      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: [{ role: "user", parts: [imagePart, promptPart] }]
      });
      const transcribedText = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
      res.json({ success: true, text: transcribedText });
    } catch (err: any) {
      throw err;
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
        const lastPart = pathname.substring(pathname.lastIndexOf("/") + 1);
        if (lastPart && lastPart.includes(".")) {
          originalname = lastPart;
          const extFromUrl = lastPart.split(".").pop()?.toLowerCase();
          if (extFromUrl) {
            extension = extFromUrl;
            if (
              sniffed.mimetype === "text/html" ||
              sniffed.mimetype === "text/plain"
            ) {
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
        originalname: originalname,
      });
      res.json({ success: true, fileId, fileName: originalname, mimetype });
    } catch (err: any) {
      throw err;
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
    const doiClean = doi.replace(
      /^(https?:\/\/)?(www\.)?(dx\.)?doi\.org\//i,
      "",
    );

    try {
      console.log(`[DOI_RESOLVE] Fetching OpenAlex for DOI: ${doiClean}`);
      const queryUrl = `https://api.openalex.org/works/https://doi.org/${encodeURIComponent(doiClean)}?mailto=asnahonron@gmail.com`;
      const response = await axios.get(queryUrl, { timeout: 10000 });
      const data = response.data;

      if (data) {
        // Map OpenAlex metadata to our format
        const authorsList = (data.authorships || [])
          .map((auth: any) => {
            const name = auth.author?.display_name || "";
            if (name && name.includes(" ")) {
              const parts = name.trim().split(/\s+/);
              const last = parts.pop();
              const first = parts.join(" ");
              return `${last}, ${first}`;
            }
            return name;
          })
          .filter(Boolean);

        const authors = authorsList.join("; ");
        const title = data.title || "";
        const year = data.publication_year ? String(data.publication_year) : "";
        const url =
          data.doi || data.landing_page_url || `https://doi.org/${doiClean}`;
        const journalName = data.primary_location?.source?.display_name || "";
        const volume = data.biblio?.volume || "";
        const issue = data.biblio?.issue || "";
        const pages =
          data.biblio?.first_page && data.biblio?.last_page
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
          accessDate: new Date().toISOString().split("T")[0],
        };

        return res.json({ success: true, metadata });
      }

      throw new Error("No data returned from OpenAlex");
    } catch (error: any) {
        console.warn(
          `[DOI_RESOLVE] OpenAlex failed: ${error.message}. Trying generic CrossRef lookup...`
        );

      try {
        const crossrefUrl = `https://api.crossref.org/works/${encodeURIComponent(doiClean)}`;
        const crRes = await axios.get(crossrefUrl, {
          timeout: 8000,
          headers: { "User-Agent": "mailto:asnahonron@gmail.com" },
        });
        const item = crRes.data?.message;
        if (item) {
          const authorsList = (item.author || [])
            .map((a: any) => {
              if (a.family && a.given) return `${a.family}, ${a.given}`;
              if (a.family) return a.family;
              return a.name || "";
            })
            .filter(Boolean);

          const authors = authorsList.join("; ");
          const title = (item.title || [])[0] || "";
          const year = item.created?.["date-parts"]?.[0]?.[0]
            ? String(item.created["date-parts"][0][0])
            : "";
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
            accessDate: new Date().toISOString().split("T")[0],
          };
          return res.json({ success: true, metadata });
        }
      } catch (crErr: any) {
        console.warn(
          `[DOI_RESOLVE] CrossRef fallback failed: ${crErr.message}`,
        );
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
          model: "gemini-flash-latest",
          contents: [{ role: "user", parts: [{ text: `DOI: ${doiClean}` }] }],
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        });
        const content = aiResponse.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        const parsed = cleanAndParseJSON(content);
        return res.json({
          success: true,
          metadata: {
            sourceType: "journal",
            doi: doiClean,
            url: `https://doi.org/${doiClean}`,
            ...parsed,
          },
        });
      } catch (aiErr) {
        res
          .status(500)
          .json({
            success: false,
            error:
              "Unable to resolve DOI automatically. Please key in details manually.",
          });
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
              content: systemPrompt,
            },
            {
              role: "user",
              content: `Text snippet: ${text.substring(0, 12000)}`,
            },
          ],
          temperature: 0.1,
          response_format: { type: "json_object" },
        });
        const content = completion.choices[0]?.message?.content || "{}";
        parsed = cleanAndParseJSON(content);
      } catch (err: any) {
        console.warn(
          "[LLM] Mistral parse or JSON parse failed, falling back to Gemini:",
          err.message || err,
        );
        const response = await ai.models.generateContent({
          model: "gemini-flash-latest",
          contents: [{ role: "user", parts: [{ text: `Text snippet: ${text.substring(0, 12000)}` }] }],
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.1,
            responseMimeType: "application/json",
          },
        });
        const content = response.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        parsed = cleanAndParseJSON(content);
      }

      res.json({ success: true, metadata: parsed });
    } catch (error: any) {
      console.error("AI Citation Parse Error:", error);
      res
        .status(500)
        .json({
          success: false,
          error: error.message || "Failed parsing the text.",
        });
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
      const response = await fetch(
        `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query as string)}&limit=10&fields=title,authors,year,abstract,url,venue`,
      );

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
      const prompt = `You are an expert academic research assistant. I have performed a search for "${userQuery || "research papers"}".
Here are the top results from Semantic Scholar:

${papers
  .map(
    (p, i) => `[${i + 1}] ${p.title} (${p.year || "N/A"})
Authors: ${p.authors?.map((a: any) => a.name).join(", ") || "Unknown"}
Abstract: ${p.abstract || "No abstract available."}`,
  )
  .join("\n\n")}

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
              content:
                "You are an expert academic research assistant specializing in synthesizing search results.",
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
        });
        responseText = completion.choices[0].message.content || "";
      } catch (err: any) {
        console.warn(
          "[LLM] Mistral synthesis failed, falling back to Baseten:",
          err.message || err,
        );
        try {
          const client = getBasetenClient();
          const completion = await client.chat.completions.create({
            model:
              process.env.BASETEN_MODEL ||
              "meta-llama/Meta-Llama-3.1-70B-Instruct",
            messages: [
              {
                role: "system",
                content:
                  "You are an expert academic research assistant specializing in synthesizing search results.",
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            temperature: 0.7,
          });
          responseText = completion.choices[0].message.content || "";
        } catch (err2: any) {
          console.warn(
            "[LLM] Baseten synthesis failed, falling back to Gemini:",
            err2.message || err2,
          );
          const response = await ai.models.generateContent({
            model: "gemini-flash-latest",
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
              temperature: 0.7,
              systemInstruction: "You are an expert academic research assistant specializing in synthesizing search results.",
            },
          });
          responseText = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
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
      const fetchWithTimeout = async (
        resource: string,
        options = {},
        timeout = 12000,
      ) => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
          const response = await fetch(resource, {
            ...options,
            signal: controller.signal,
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
              ...((options as any).headers || {}),
            },
          });
          clearTimeout(id);
          return response;
        } catch (error) {
          clearTimeout(id);
          throw error;
        }
      };

      // 1. YouTube specialized scraper/oembed
      if (
        type === "youtube" ||
        url.includes("youtube.com") ||
        url.includes("youtu.be")
      ) {
        let videoId = "";
        const regExp =
          /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
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
              sourceMetaData.title =
                oembedData.title || `YouTube Video (${videoId})`;
              sourceMetaData.author = oembedData.author_name || "YouTube";
              docText = `YouTube Video from channel: ${oembedData.author_name || "unknown"}. Title: ${oembedData.title || ""}. URL: ${url}. Please summarize its likely concepts, themes, and educational/academic context.`;
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
            throw new Error(
              `Google Doc fetch returned HTTP status ${docResponse.status}`,
            );
          }
        } catch (gdocErr: any) {
          console.error("GDoc Fetch Error:", gdocErr);
          throw new Error(
            "This Google Document seems private or restricted. Please ensure you have set the file's share permission to 'Anyone with the link' as Viewer.",
          );
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
          const titleMatch = htmlContent.match(
            /<title[^>]*>([\s\S]*?)<\/title>/i,
          );
          if (titleMatch && titleMatch[1]) {
            sourceMetaData.title = titleMatch[1].trim();
          } else {
            sourceMetaData.title = new URL(url).hostname || "Web Reference";
          }
          sourceMetaData.author =
            new URL(url).hostname.replace("www.", "") || "Web Article";
        } catch (webErr: any) {
          console.error("Public URL Fetch Direct Error:", webErr);
          throw new Error(
            `Failed to access the public link: ${webErr.message || webErr}. Please double check that the URL is public and online.`,
          );
        }
      } // Now we have docText and meta content, feed to Mistral for structured summarization
      const mistralPrompt = `You are a highly capable reading assistant. Please read and analyze the following extracted text snippet from a source/URL (${url}). 
Generated from source named: "${sourceMetaData.title || "Unknown Source"}" by author/publisher: "${sourceMetaData.author || "Unknown"}".

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
              content:
                "You are a professional reading assistant. Output ONLY valid JSON.",
            },
            {
              role: "user",
              content: mistralPrompt,
            },
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
          max_tokens: 2500,
        });
        const rText = completion.choices[0].message.content || "";
        parsedJSON = cleanAndParseJSON(rText);
      } catch (err: any) {
        console.warn(
          "[LLM] Mistral url summary or JSON parse failed, falling back to Baseten:",
          err.message || err,
        );
        try {
          const client = getBasetenClient();
          const completion = await client.chat.completions.create({
            model:
              process.env.BASETEN_MODEL ||
              "meta-llama/Meta-Llama-3.1-70B-Instruct",
            messages: [
              {
                role: "system",
                content:
                  "You are a professional reading assistant. Output ONLY valid JSON.",
              },
              {
                role: "user",
                content: mistralPrompt,
              },
            ],
            response_format: { type: "json_object" },
            temperature: 0.3,
            max_tokens: 2500,
          });
          const rText = completion.choices[0].message.content || "";
          parsedJSON = cleanAndParseJSON(rText);
        } catch (err2: any) {
          console.warn(
            "[LLM] Baseten url summary or JSON parse failed, falling back to Gemini:",
            err2.message || err2,
          );
          const response = await ai.models.generateContent({
            model: "gemini-flash-latest",
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
                  fileType: {
                    type: Type.STRING,
                    description: "Must be either 'Note' or 'Document'",
                  },
                },
                required: ["title", "author", "summary", "fileType"],
              },
            },
          });
          const rText = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
          parsedJSON = cleanAndParseJSON(rText);
        }
      }

      if (!parsedJSON) {
        throw new Error(
          "All AI models failed to summarize and parse the URL content.",
        );
      }

      // Robust multiple key discovery & recursive extraction
      let rawSummary = "";
      const summaryVal =
        parsedJSON.summary ||
        parsedJSON.Summary ||
        parsedJSON.description ||
        parsedJSON.Description ||
        parsedJSON.synthesis ||
        parsedJSON.Synthesis ||
        parsedJSON.abstract ||
        parsedJSON.Abstract ||
        parsedJSON.content ||
        parsedJSON.Content ||
        parsedJSON.text ||
        parsedJSON.Text;

      if (typeof summaryVal === "string" && summaryVal.trim().length > 30) {
        rawSummary = summaryVal.trim();
      } else if (typeof summaryVal === "object" && summaryVal !== null) {
        rawSummary = extractAllContentStrings(summaryVal).join("\n\n");
      }

      // If summary is empty or minimal, recursively collect all non-metadata string fields inside the JSON
      if (!rawSummary || rawSummary.length < 50) {
        const collected = extractAllContentStrings(parsedJSON, [
          "title",
          "author",
          "fileType",
          "added",
          "fullTextStatus",
          "id",
        ]);
        rawSummary = collected.join("\n\n");
      }

      rawSummary = rawSummary.trim();

      let finalTitle = parsedJSON.title || sourceMetaData.title;
      if (typeof finalTitle === "object" && finalTitle !== null) {
        finalTitle =
          finalTitle.primary ||
          finalTitle.title ||
          finalTitle.name ||
          "Unknown";
      }
      if (typeof finalTitle !== "string") finalTitle = String(finalTitle);

      // Final bulletproof fallback: if the summary is still empty, synthesize a solid starting content stream
      if (!rawSummary || rawSummary === "...") {
        rawSummary = `### Document Summary: ${finalTitle}\n\nThis document focuses on "${finalTitle}". It is recorded in your repository and ready for complete research annotation, drafting, and outline expansion.\n\nTo begin exploring this content, use the chat panels.`;
      }

      // Post-process to wash out any JSON nesting residue or leaked formatting characters
      const summaryCleaned = cleanJsonLeak(rawSummary).replace(/\\n/g, "\n");

      let finalAuthor = parsedJSON.author || sourceMetaData.author;
      if (typeof finalAuthor === "object" && finalAuthor !== null) {
        finalAuthor =
          finalAuthor.primary ||
          finalAuthor.name ||
          finalAuthor.author ||
          Object.values(finalAuthor).join(", ") ||
          "Unknown";
      }
      if (typeof finalAuthor !== "string") finalAuthor = String(finalAuthor);

      res.json({
        success: true,
        data: {
          title: finalTitle,
          author: finalAuthor,
          description:
            summaryCleaned.length > 100
              ? summaryCleaned.substring(0, 100) + "..."
              : summaryCleaned + "...",
          summary: summaryCleaned, // store full text in summary property
          fileType:
            typeof parsedJSON.fileType === "string"
              ? parsedJSON.fileType
              : "Note",
          added: "Today",
          fullTextStatus: "Available",
          viewed: "Just now",
          url: url,
        },
      });
    } catch (e: any) {
      console.error("Summarization API error:", e);
      res
        .status(500)
        .json({
          error:
            e.message ||
            "An error occurred while generating synthesis for the provided link.",
        });
    }
  });

  // Short 2-4 word Chat Title Generator Endpoint
  app.post("/api/research/generate-title", async (req, res) => {
    try {
      const { userQuery } = GenerateTitleSchema.parse(req.body);
      if (!userQuery) {
        return res.json({ title: "New Chat" });
      }

      try {
        let titleComponentText = "";
        try {
          console.log(
            "[LLM] Attempting conversation title generation with Mistral...",
          );
          const client = getMistralClient();
          const completion = await client.chat.completions.create({
            model: "ministral-8b-latest",
            messages: [
              {
                role: "system",
                content:
                  "You are a strict title generator. Generate an appropriate, natural, and descriptive title of maximum 7 words based on the user's initial query. Do NOT include ANY explanation, introduction, conversational text, parentheses, notes, or suggestions. Output ONLY the plain text title, nothing else. For casual greetings or brief casual text (e.g., 'yo', 'hi', 'hello', 'hey'), output a simple, clean title like 'New Conversation' or 'Casual Chat'.",
              },
              {
                role: "user",
                content: userQuery,
              },
            ],
            temperature: 0.1,
          });
          titleComponentText = completion.choices[0]?.message?.content || "";
        } catch (err: any) {
          console.warn(
            "[LLM] Mistral title generation failed, falling back to Baseten:",
            err.message || err,
          );
          try {
            const client = getBasetenClient();
            const completion = await client.chat.completions.create({
              model:
                process.env.BASETEN_MODEL ||
                "meta-llama/Meta-Llama-3.1-70B-Instruct",
              messages: [
                {
                  role: "system",
                  content:
                    "You are a strict title generator. Generate an appropriate, natural, and descriptive title of maximum 7 words based on the user's initial query. Do NOT include ANY explanation, introduction, conversational text, parentheses, notes, or suggestions. Output ONLY the plain text title, nothing else. For casual greetings or brief casual text (e.g., 'yo', 'hi', 'hello', 'hey'), output a simple, clean title like 'New Conversation' or 'Casual Chat'.",
                },
                {
                  role: "user",
                  content: userQuery,
                },
              ],
              temperature: 0.1,
            });
            titleComponentText = completion.choices[0]?.message?.content || "";
          } catch (err2: any) {
            console.warn(
              "[LLM] Baseten title generation failed, falling back to Gemini:",
              err2.message || err2,
            );
            if (process.env.GEMINI_API_KEY) {
              const response = await ai.models.generateContent({
                model: "gemini-3.1-flash-lite",
                contents: [{ role: "user", parts: [{ text: userQuery }] }],
                config: {
                  systemInstruction:
                    "You are a strict title generator. Generate an appropriate, natural, and descriptive title of maximum 7 words based on the user's initial query. Do NOT include ANY explanation, introduction, conversational text, parentheses, notes, or suggestions. Output ONLY the plain text title, nothing else. For casual greetings or brief casual text (e.g., 'yo', 'hi', 'hello', 'hey'), output a simple, clean title like 'New Conversation' or 'Casual Chat'.",
                  temperature: 0,
                },
              });
              titleComponentText = response.candidates?.[0]?.content?.parts?.[0]?.text || "";
            } else {
              throw new Error(
                "No LLM clients available or configured for title generation.",
              );
            }
          }
        }

        const toTitleCase = (str: string) => {
          const minorWords = [
            "and",
            "or",
            "but",
            "a",
            "an",
            "the",
            "for",
            "to",
            "in",
            "of",
            "at",
            "by",
            "from",
            "with",
          ];
          return str
            .split(/\s+/)
            .map((word, idx) => {
              if (!word) return "";
              const lowerWord = word.toLowerCase();
              // Handle lowercase for minor words unless it is the start of the title
              if (minorWords.includes(lowerWord) && idx > 0) {
                return lowerWord;
              }
              // Keep acronyms uppercase if they are all uppercase (e.g., DNA, AI, API)
              if (
                word === word.toUpperCase() &&
                word.length > 1 &&
                !/\d/.test(word)
              ) {
                return word;
              }
              // Otherwise, capitalize first letter, preserve the rest of the casing if mixed
              return word.charAt(0).toUpperCase() + word.slice(1);
            })
            .join(" ");
        };

        // Parse and clean up any explanation/commentary that might have leaked from the LLM
        let cleaned = titleComponentText;
        
        // Remove anything in parentheses (e.g. "(Note Since Your Query...)")
        cleaned = cleaned.replace(/\([^)]*\)/g, "");
        // Remove anything in square brackets
        cleaned = cleaned.replace(/\[[^\]]*\]/g, "");
        
        // Extract first non-empty line
        const lines = cleaned.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
        cleaned = lines[0] || "";

        // Strip typical labels
        cleaned = cleaned.replace(/^(title|subject|topic|header|suggestion):\s*/i, "");
        cleaned = cleaned.replace(/^(here is a title|suggested title):\s*/i, "");

        // Strip punctuation
        cleaned = cleaned.replace(/['"“”\*\.,!?;:]/g, "").trim();

        // Enforce max 7 words
        const words = cleaned.split(/\s+/).filter(Boolean);
        if (words.length > 7) {
          cleaned = words.slice(0, 7).join(" ");
        }

        const rawTitle = cleaned.trim() || "Untitled Chat";
        const title = toTitleCase(rawTitle);
        res.json({ title });
      } catch (innerError: any) {
        console.error(
          "Inner generate title LLM call failed, returning fallback",
          innerError,
        );
        const fallback =
          userQuery
            .split(" ")
            .slice(0, 3)
            .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
            .join(" ") + (userQuery.split(" ").length > 3 ? "..." : "");
        res.json({ title: fallback || "Untitled Conversation" });
      }
    } catch (error: any) {
      console.error("Generate Title Error:", error);
      res.json({ title: "New Chat" });
    }
  });

  // Helper for delays
  const sleep = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  // Helper for web scraping search results
  async function searchWeb(query: string): Promise<string> {
    const youApiKey = process.env.YOU_API_KEY;
    let youErrorNotice = "";

    if (youApiKey && youApiKey.trim() !== "") {
      const trimmedKey = youApiKey.trim();

      const attempts = [
        {
          url: `https://api.ydc-index.io/v1/search?query=${encodeURIComponent(query)}`,
          method: "GET" as const,
          data: null,
        },
        {
          url: `https://ydc-index.io/v1/search?query=${encodeURIComponent(query)}`,
          method: "GET" as const,
          data: null,
        },
        {
          url: `https://api.ydc-index.io/search?query=${encodeURIComponent(query)}`,
          method: "GET" as const,
          data: null,
        },
        {
          url: `https://ydc-index.io/search?query=${encodeURIComponent(query)}`,
          method: "GET" as const,
          data: null,
        },
        {
          url: `https://api.ydc-index.io/v1/contents?query=${encodeURIComponent(query)}`,
          method: "GET" as const,
          data: null,
        },
        {
          url: `https://ydc-index.io/v1/contents?query=${encodeURIComponent(query)}`,
          method: "GET" as const,
          data: null,
        },
        {
          url: `https://api.ydc-index.io/v1/contents`,
          method: "POST" as const,
          data: { query: query, crawl_timeout: 10 },
        },
        {
          url: `https://ydc-index.io/v1/contents`,
          method: "POST" as const,
          data: { query: query, crawl_timeout: 10 },
        },
      ];

      let lastErrorStatus = "";
      let foundSuccess = false;
      let finalResultsStr = "";

      for (const attempt of attempts) {
        try {
          console.log(
            `[YOU.COM SEARCH TRY] Method: ${attempt.method} on ${attempt.url}`,
          );
          const headers: Record<string, string> = {
            "X-API-KEY": trimmedKey,
            Accept: "application/json",
          };

          let response;
          if (attempt.method === "POST") {
            headers["Content-Type"] = "application/json";
            response = await axios.post(attempt.url, attempt.data, {
              headers,
              timeout: 8000,
            });
          } else {
            response = await axios.get(attempt.url, { headers, timeout: 8000 });
          }

          const hits = response.data?.hits || response.data?.results || [];
          const results: Array<{
            title: string;
            link: string;
            snippet: string;
          }> = [];

          if (Array.isArray(hits)) {
            for (const hit of hits) {
              const title = hit.title || hit.name || "Untitled Result";
              const link = hit.url || hit.link || "";

              let snippet = "";
              if (Array.isArray(hit.snippets) && hit.snippets.length > 0) {
                snippet = hit.snippets.join(" ");
              } else if (hit.description) {
                snippet = hit.description;
              } else if (hit.snippet) {
                snippet = hit.snippet;
              }

              if (link) {
                results.push({ title, link, snippet });
              }
            }
          }

          if (results.length > 0) {
            console.log(
              `[YOU.COM SEARCH SUCCESS] Found ${results.length} results via ${attempt.url}`,
            );
            foundSuccess = true;
            finalResultsStr = results
              .map(
                (r, i) =>
                  `[Web Result ${i + 1}] Title: ${r.title}\nURL: ${r.link}\nSnippet: ${r.snippet}`,
              )
              .join("\n\n");
            break;
          }
        } catch (err: any) {
          console.warn(
            `[YOU.COM SEARCH TRY FAILED] ${attempt.url} failed:`,
            err.message || err,
          );
          if (err.response) {
            const status = err.response.status;
            console.warn(
              `[YOU.COM SEARCH ERROR DETAIL] Status: ${status}, Data:`,
              JSON.stringify(err.response.data || {}).substring(0, 500),
            );
            lastErrorStatus = status.toString();

            // If the key is outright invalid (401 Unauthorized), do not spam remaining endpoints
            if (status === 401) {
              console.warn(
                `[YOU.COM SEARCH] Received 401 Unauthorized. Stopping further retry endpoints.`,
              );
              break;
            }
          }
        }
      }

      if (foundSuccess) {
        return finalResultsStr;
      }

      // If we got here, all attempts failed or returned no results. Show advisory.
      if (lastErrorStatus === "403") {
        youErrorNotice =
          "\n\n[SYSTEM ADVISORY: The You.com search API endpoints returned 403 Forbidden. This indicates your YOU_API_KEY in the Secrets panel under Settings is either invalid, expired, or doesn't have permissions for search index retrieval. Fulfilling query via DuckDuckGo fallback.]";
      } else if (lastErrorStatus) {
        youErrorNotice = `\n\n[SYSTEM ADVISORY: You.com search API failed with status ${lastErrorStatus}. Fulfilling query via DuckDuckGo fallback.]`;
      } else {
        youErrorNotice =
          "\n\n[SYSTEM ADVISORY: You.com search returned empty. Fulfilling query via DuckDuckGo fallback.]";
      }
    } else {
      console.log(
        `[YOU.COM SEARCH] YOU_API_KEY not configured or empty; defaulting to DuckDuckGo...`,
      );
      youErrorNotice =
        "\n\n[SYSTEM ADVISORY: YOU_API_KEY is not configured in the Secrets panel under Settings. Defaulting gracefully to DuckDuckGo. You can configure YOU_API_KEY in the application Secrets to use the premium You.com Index API.]";
    }

    try {
      const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
      const response = await axios.get(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
        timeout: 8000,
      });
      const html = response.data;

      const results: Array<{ title: string; link: string; snippet: string }> =
        [];

      // Match result titles and direct links
      const resultARegex =
        /<a class="result__a" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
      const snippetRegex = /<a class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;

      let matchA;
      const titlesAndLinks: Array<{ href: string; title: string }> = [];
      while ((matchA = resultARegex.exec(html)) !== null) {
        let href = matchA[1];
        if (href.includes("uddg=")) {
          const parts = href.split("uddg=");
          if (parts[1]) {
            href = decodeURIComponent(parts[1].split("&")[0]);
          }
        }
        const title = matchA[2].replace(/<[^>]*>/g, "").trim();
        titlesAndLinks.push({ href, title });
      }

      let matchSnippet;
      const snippets: string[] = [];
      while ((matchSnippet = snippetRegex.exec(html)) !== null) {
        const snippet = matchSnippet[1].replace(/<[^>]*>/g, "").trim();
        snippets.push(snippet);
      }

      const maxResults = Math.min(titlesAndLinks.length, snippets.length, 5);
      for (let i = 0; i < maxResults; i++) {
        results.push({
          title: titlesAndLinks[i].title,
          link: titlesAndLinks[i].href,
          snippet: snippets[i],
        });
      }

      if (results.length === 0) {
        try {
          const ddgJson = await axios.get(
            `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json`,
            { timeout: 4000 },
          );
          if (ddgJson.data?.AbstractText) {
            results.push({
              title: ddgJson.data.Heading || "Instant Answer",
              link: ddgJson.data.AbstractURL || "",
              snippet: ddgJson.data.AbstractText,
            });
          }
        } catch (err) {
          console.warn("JSON DDG fallback failed:", err);
        }
      }

      if (results.length > 0) {
        return (
          results
            .map(
              (r, i) =>
                `[Web Result ${i + 1}] Title: ${r.title}\nURL: ${r.link}\nSnippet: ${r.snippet}`,
            )
            .join("\n\n") + youErrorNotice
        );
      }
      return "No web search results matches for your query." + youErrorNotice;
    } catch (err: any) {
      console.error("Web search query failed:", err.message || err);
      return (
        `No real-time web results found. (${err.message || err})` +
        youErrorNotice
      );
    }
  }

  // Helper to fetch educational or scientific images related to the web search query via Wikipedia
  async function searchImages(
    query: string,
  ): Promise<Array<{ url: string; title: string }>> {
    try {
      const url = `https://en.wikipedia.org/w/api.php?action=query&prop=pageimages&generator=search&gsrsearch=${encodeURIComponent(query)}&format=json&piprop=original&origin=*&gsrlimit=6`;
      const response = await axios.get(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        timeout: 5000,
      });
      const pages = response.data?.query?.pages || {};
      const images: Array<{ url: string; title: string }> = [];
      for (const key of Object.keys(pages)) {
        const page = pages[key];
        if (page.original?.source) {
          const imgUrl = page.original.source;
          if (imgUrl.match(/\.(jpg|jpeg|png|gif|svg|webp)/i)) {
            images.push({
              url: imgUrl,
              title: page.title || query,
            });
          }
        }
      }
      return images;
    } catch (err: any) {
      console.warn("Wikipedia image search helper failed:", err.message || err);
      return [];
    }
  }

  async function getContextualQuery(
    messages: any[],
    lastMessage: string,
  ): Promise<string> {
    if (!messages || messages.length <= 1) {
      return lastMessage;
    }

    // Check if we should use Mistral or fallback to Gemini
    let useMistral = false;
    let mistralAppClient: any = null;
    try {
      mistralAppClient = getMistralClient();
      useMistral = !!mistralAppClient;
    } catch (e) {
      // Mistral API key might not be available
    }

    try {
      const prompt = `You are an expert helper that extracts a single focused Search Query based on conversation context.
We need to run a Google search to answer the user's latest query, but the latest query might use pronouns (like "it", "them", "that", "this") referring to previous topics.
If the user's latest query is an explicit greeting (like "hi", "hello"), purely conversational, or DOES NOT strictly require searching live internet data, you MUST return exactly the string "NO_SEARCH_NEEDED".
Otherwise, analyze the past conversation history and output ONLY a 2-5 word highly optimized search query to retrieve precise facts on the web.
Do NOT include any extra text, punctuation, quotes, or explanations. Only the raw query string or "NO_SEARCH_NEEDED".

CONVERSATION HISTORY:
${messages
  .slice(-5)
  .map((m) => `${m.role}: ${m.content}`)
  .join("\n")}

USER'S LATEST QUERY: "${lastMessage}"
OPTIMIZED SEARCH QUERY:`;

      let extracted = "";

      if (useMistral) {
        // Use Mistral for contextual search
        const mistralResponse = await mistralAppClient.chat.completions.create({
          model: "mistral-large-latest",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
          max_tokens: 20,
        });
        extracted = mistralResponse.choices[0]?.message?.content?.trim() || "";
      } else {
        // Fallback to Gemini
        const response = await ai.models.generateContent({
          model: "gemini-flash-latest",
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          config: {
            temperature: 0.1,
            maxOutputTokens: 20,
          },
        });
        extracted = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      }

      extracted = extracted.replace(/^["']|["']$/g, "") || lastMessage;
      console.log(
        `[CONTEXTUAL SEARCH] Formulated search query: "${extracted}" (original query: "${lastMessage}")`,
      );
      return extracted;
    } catch (err: any) {
      console.warn(
        "[CONTEXTUAL SEARCH] Could not generate contextual query, falling back to original:",
        err.message || err,
      );
      return lastMessage;
    }
  }

  // Research Chat & Academic Draft Optimizer Route
  app.post("/api/research/chat", async (req, res) => {
    try {
      const {
        messages,
        context,
        model,
        thinkingLevel,
        webSearch,
        attachment,
        explainStyle,
        writeStyle,
        personalityProfile,
        customInstructions,
        userFullName,
        userWorkType,
      } = req.body;

      if (!messages || !Array.isArray(messages)) {
        res
          .status(400)
          .json({ error: "Invalid request payload. Messages are required." });
        return;
      }

      const lastMessage = messages[messages.length - 1]?.content || "";
      const isSearchRequest = false;
      const requestedModel = model || "auto";
      const cleanedLastMsg = lastMessage.toLowerCase().trim();
      const webSearchEnabled = !!webSearch || 
        cleanedLastMsg.startsWith("web search") || 
        cleanedLastMsg.startsWith("websearch") || 
        cleanedLastMsg.startsWith("search ");

      let researchContext = "";
      if (attachment && attachment.fileId && !attachment.mimetype?.startsWith("image/")) {
        researchContext += `\n[SPECIAL FOCUS ATTACHMENT]: The user has attached the workspace document "${attachment.fileName || 'Attached File'}" (ID: ${attachment.fileId}) specifically to prompt this reply. Give absolute highest priority to files/data/claims contained within this file in your response.\n`;
        try {
          const fileData = await getFile(attachment.fileId);
          if (fileData) {
            let fileText = "";
            const ext =
              attachment.fileName.toLowerCase().split(".").pop() || "";
            if (ext === "docx") {
              const resDoc = await mammoth.extractRawText({
                buffer: fileData.buffer,
              });
              fileText = resDoc.value;
            } else if (ext === "pdf") {
              // For PDFs, we scan the workspace citations attached in the body context if present
              if (context && context.citations) {
                const matched = context.citations.find(
                  (c: any) => c.fileId === attachment.fileId,
                );
                if (matched && matched.fullText) {
                  fileText = matched.fullText;
                }
              }
            } else if (
              [
                "txt",
                "md",
                "html",
                "htm",
                "json",
                "csv",
                "tsv",
                "xml",
                "css",
                "js",
                "ts",
                "py",
              ].includes(ext)
            ) {
              fileText = fileData.buffer.toString("utf-8");
            }

            if (fileText && fileText.trim().length > 0) {
              researchContext += `\n--- CONTENT OF ATTACHED FILE "${attachment.fileName}" ---\n${fileText.substring(0, 45000)}\n----------------------------------------\n`;
              console.log(
                `[CHAT ATTACHMENT] Successfully parsed text (${fileText.length} characters) from document ${attachment.fileName} and attached to LLM payload.`,
              );
            } else {
              // Fallback check in context citations
              if (context && context.citations) {
                const matched = context.citations.find(
                  (c: any) => c.fileId === attachment.fileId,
                );
                if (matched && matched.fullText) {
                  fileText = matched.fullText;
                  researchContext += `\n--- CONTENT OF ATTACHED FILE "${attachment.fileName}" ---\n${fileText.substring(0, 45000)}\n----------------------------------------\n`;
                }
              }
            }
          }
        } catch (e: any) {
          console.error(
            "[CHAT ATTACHMENT] Failed server-side attachment parsing:",
            e.message || e,
          );
        }
      }

      if (
        webSearchEnabled &&
        !requestedModel.includes("gemini") &&
        requestedModel !== "auto"
      ) {
        const resolvedQuery = await getContextualQuery(messages, lastMessage);

        if (resolvedQuery !== "NO_SEARCH_NEEDED") {
          console.log(
            `[REAL-TIME SEARCH] Fetching web results for query: "${resolvedQuery}" (original: "${lastMessage}")`,
          );
          const searchResults = await searchWeb(resolvedQuery);

          researchContext = `
--- GOOGLE / DUCKDUCKGO WEB SEARCH GROUNDING RESULTS ---
We retrieved these current live web results for "${resolvedQuery}":

${searchResults}

INSTRUCTION: Synthesize and ground your response on these web results, and make sure to list the source URLs as clickable links.
--------------------------------------------------------
`;
        } else {
          console.log(
            `[REAL-TIME SEARCH] Skipping search, LLM determined NO_SEARCH_NEEDED for: "${lastMessage}"`,
          );
        }
      } else if (isSearchRequest) {
        console.log("Detecting search request, fetching papers...");
        let papers: any[] = [];

        // 1. Try Semantic Scholar
        try {
          let searchResponse;
          let attempt = 0;
          while (attempt < 2) {
            try {
              searchResponse = await axios.get(
                `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(lastMessage)}&limit=15&fields=title,authors,year,abstract,venue,url,openAccessPdf`,
                {
                  timeout: 5000,
                  headers: { "User-Agent": "Mozilla/5.0" },
                },
              );
              break;
            } catch (e: any) {
              if (e.response && e.response.status === 429) {
                // Rate limited, break out to use OpenAlex instantly
                break;
              }
              attempt++;
              if (attempt >= 2) break;
              await new Promise((resolve) => setTimeout(resolve, 1000));
            }
          }
          if (searchResponse?.status === 200) {
            let candidatePapers = (searchResponse.data?.data || []).filter(
              (p: any) => !!p.openAccessPdf?.url,
            );
            // Optionally Rerank via Voyage AI if API Key is present
            if (candidatePapers.length > 3 && process.env.VOYAGE_API_KEY) {
              try {
                const voyageClient = getVoyageClient();
                const documentsToRerank = candidatePapers.map(
                  (p) => `Title: ${p.title}\nAbstract: ${p.abstract || "N/A"}`,
                );
                const rerankResult = await voyageClient.rerank({
                  query: lastMessage,
                  documents: documentsToRerank,
                  model: "rerank-2",
                  topK: 3,
                });
                if (rerankResult.data && rerankResult.data.length > 0) {
                  papers = rerankResult.data.map(
                    (r) => candidatePapers[r.index],
                  );
                  console.log(
                    `[VOYAGE_RERANK] Successfully reranked semantic scholar results for "${lastMessage}"`,
                  );
                } else {
                  papers = candidatePapers.slice(0, 3);
                }
              } catch (rerankErr: any) {
                console.warn(
                  "[VOYAGE_RERANK] Failed to rerank, falling back to original sorting:",
                  rerankErr.message,
                );
                papers = candidatePapers.slice(0, 3);
              }
            } else {
              papers = candidatePapers.slice(0, 3);
            }
          }
        } catch (e: any) {
          // Silent fallback
        }

        // 2. OpenAlex Fallback
        if (papers.length === 0) {
          try {
            let cleanQuery = lastMessage
              .replace(/[^\w\s-]/g, " ")
              .replace(/\s+/g, " ")
              .trim();
            if (!cleanQuery)
              cleanQuery = lastMessage.trim() || "academic research";
            const openAlexUrl = `https://api.openalex.org/works?search=${encodeURIComponent(cleanQuery)}&filter=has_pdf_url:true&per-page=15&mailto=asnahonron@gmail.com`;
            const alexResponse = await axios.get(openAlexUrl, {
              timeout: 6000,
              headers: { "User-Agent": "Mozilla/5.0" },
            });
            if (alexResponse.status === 200) {
              const results = alexResponse.data?.results || [];
              let candidatePapers = results.map((entry: any) => {
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
                const author =
                  entry.authorships?.[0]?.author?.display_name ||
                  "Unknown Author";
                let pdfUrl =
                  entry.best_oa_location?.pdf_url || entry.open_access?.oa_url;
                if (entry.ids?.arxiv) {
                  const arxivId = entry.ids.arxiv.split("/").pop();
                  if (!pdfUrl?.includes("arxiv.org")) {
                    pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;
                  }
                }
                return {
                  title: entry.title || "Unknown Title",
                  authors: [{ name: author }],
                  year: entry.publication_year || 2026,
                  abstract: abstract,
                  venue:
                    entry.primary_location?.source?.display_name ||
                    "Open Access Index",
                  url: entry.id,
                  openAccessPdf: pdfUrl ? { url: pdfUrl } : null,
                };
              });

              if (candidatePapers.length > 3 && process.env.VOYAGE_API_KEY) {
                try {
                  const voyageClient = getVoyageClient();
                  const documentsToRerank = candidatePapers.map(
                    (p) =>
                      `Title: ${p.title}\nAbstract: ${p.abstract || "N/A"}`,
                  );
                  const rerankResult = await voyageClient.rerank({
                    query: lastMessage,
                    documents: documentsToRerank,
                    model: "rerank-2",
                    topK: 3,
                  });
                  if (rerankResult.data && rerankResult.data.length > 0) {
                    papers = rerankResult.data.map(
                      (r) => candidatePapers[r.index],
                    );
                  } else {
                    papers = candidatePapers.slice(0, 3);
                  }
                } catch (e: any) {
                  papers = candidatePapers.slice(0, 3);
                }
              } else {
                papers = candidatePapers.slice(0, 3);
              }
            }
          } catch (alexErr: any) {
            console.error(
              "[AUTO-SEARCH] OpenAlex fallback failed:",
              alexErr.message || alexErr,
            );
          }
        }

        // 3. CORE API Fallback
        if (papers.length === 0 && process.env.CORE_API_KEY) {
          try {
            console.log(
              "[AUTO-SEARCH] OpenAlex failed/returned empty. Falling back to CORE API...",
            );
            const coreResponse = await axios.get(
              `https://api.core.ac.uk/v3/works/search?q=${encodeURIComponent(lastMessage)}&limit=3`,
              {
                headers: {
                  Authorization: `Bearer ${process.env.CORE_API_KEY}`,
                },
                timeout: 6000,
              },
            );
            if (coreResponse.status === 200) {
              const results = coreResponse.data?.results || [];
              console.log(
                `[AUTO-SEARCH] CORE API found ${results.length} papers.`,
              );
              papers = results
                .map((entry: any) => {
                  return {
                    title: entry.title || "Unknown Title",
                    authors: entry.authors?.map((a: any) => ({
                      name: a.name,
                    })) || [{ name: "Unknown Author" }],
                    year: entry.yearPublished || 2026,
                    abstract: entry.abstract || "No abstract available.",
                    venue: entry.publisher || "CORE Index",
                    url: entry.downloadUrl,
                    openAccessPdf: entry.downloadUrl
                      ? { url: entry.downloadUrl }
                      : null,
                  };
                })
                .filter((p: any) => !!p.openAccessPdf?.url);
            }
          } catch (coreErr: any) {
            console.error(
              "[AUTO-SEARCH] CORE API fallback failed:",
              coreErr.message || coreErr,
            );
          }
        }

        if (papers.length > 0) {
          // Try to auto-download the top paper or generate a fallback PDF note
          let autoDownloadedInfo = "";
          let downloadSuccess = false;
          const topPaper = papers[0];
          const pdfUrl =
            topPaper.openAccessPdf?.url ||
            (topPaper.url && topPaper.url.includes(".pdf")
              ? topPaper.url
              : null);
          const authorStr =
            topPaper.authors?.map((a: any) => a.name).join(", ") ||
            "Unknown Author";
          const cleanTitle =
            topPaper.title
              .substring(0, 30)
              .replace(/[^\w\s-]/g, "")
              .trim() || "document";
          const filename = `${cleanTitle}.pdf`;

          if (pdfUrl) {
            try {
              console.log(
                `[AUTO-DOWNLOAD] Attempting auto-download: ${pdfUrl}`,
              );

              // Exponential backoff for downloads
              let response;
              let attempt = 0;
              while (attempt < 3) {
                try {
                  response = await axios.get(pdfUrl, {
                    responseType: "arraybuffer",
                    headers: {
                      "User-Agent":
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                      Accept: "application/pdf",
                      Referer: "https://scholar.google.com/",
                      "Accept-Language": "en-US,en;q=0.9",
                      "Upgrade-Insecure-Requests": "1",
                    },
                    timeout: 15000,
                  });
                  break;
                } catch (e: any) {
                  attempt++;
                  if (attempt >= 3) throw e;
                  await sleep(2000 * attempt);
                }
              }

              // Check Content-Type header
              const contentType =
                response?.headers["content-type"]?.toLowerCase() || "";
              if (!contentType.includes("pdf")) {
                throw new Error(
                  `Content-Type is ${contentType}, not application/pdf`,
                );
              }

              // Validate content signature
              const dataBuffer = Buffer.from(response!.data);

              // Check specifically for PDF header at the very beginning
              if (
                dataBuffer.length > 5 &&
                dataBuffer.toString("utf-8", 0, 5) === "%PDF-"
              ) {
                const fileId = `file-${Date.now()}`;
                await saveFile(fileId, {
                  buffer: dataBuffer,
                  mimetype: "application/pdf",
                  originalname: filename,
                });
                autoDownloadedInfo = `\n\n[AUTO-SAVED PDF]: "${topPaper.title}" has been automatically downloaded and is available in your workspace (File ID: ${fileId}). You can now cite it.`;
                console.log(
                  `[AUTO-DOWNLOAD] File downloaded and stored successfully as ${fileId}`,
                );
                downloadSuccess = true;
              } else {
                // Check if it's an error page
                const startText = dataBuffer
                  .toString("utf-8", 0, 1024)
                  .toLowerCase();
                if (
                  startText.includes("<html") ||
                  startText.includes("<!doctype") ||
                  startText.includes("error") ||
                  startText.includes("login")
                ) {
                  throw new Error(
                    "Returned content is likely an error/login page, not a PDF",
                  );
                }
                throw new Error("Returned content signature is not a PDF");
              }
            } catch (e: any) {
              console.warn(
                `[AUTO-DOWNLOAD] Direct download failed for ${topPaper.title}:`,
                e.message || e,
              );
            }
          }

          if (downloadSuccess) {
            researchContext = `
--- AUTOMATIC SCHOLAR SEARCH RESULTS ---
The user requested papers. I found these academic papers:

${papers.map((p: any, i: number) => `[${i + 1}] ${p.title} (${p.year}). Authors: ${p.authors?.map((a: any) => a.name).join(", ")}. Abstract: ${p.abstract?.substring(0, 300)}...`).join("\n\n")}

${autoDownloadedInfo}
-----------------------------------------
The top paper was successfully downloaded and stored. Please let the user know, highlight elements of it, and offer to cite it or help them integrate it.
`;
          } else {
            researchContext = `
--- AUTOMATIC SCHOLAR SEARCH RESULTS ---
The user requested papers. I found these academic papers:

${papers.map((p: any, i: number) => `[${i + 1}] ${p.title} (${p.year}). Authors: ${p.authors?.map((a: any) => a.name).join(", ")}. Abstract: ${p.abstract?.substring(0, 300)}...`).join("\n\n")}

-----------------------------------------
CRITICAL INSTRUCTION: The automated PDF download for "${topPaper.title}" failed.
DO NOT provide any external download or reference links/URLs for papers in your response.
DO NOT summarize or produce/hallucinate an abstract or brief of this failed paper in your response.
Instead, do the following (Strategy 2):
1. Directly present alternative papers or suggest alternative keywords/search areas to refine the topic.
2. Suggest that if they have the document's PDF stored locally, they can manually upload it to the workspace for robust analysis.
`;
          }
        } else {
          console.log("[AUTO-SEARCH] No papers found in both search pathways.");
        }
      }

      const userNoteList = context?.notes || [];
      const userCitationList = context?.citations || [];
      const userOutlineList = context?.outline || [];

      // Extract full text sections if available to make them prominent for the AI
      const fullTextSections = userCitationList
        .filter((c: any) => c.extractedText || c.fullText)
        .map(
          (c: any) =>
            `FULL TEXT CONTENT FOR SOURCE "${c.title}" (Use page markers for citations):\n${(c.extractedText || c.fullText || "").substring(0, 30000)}`,
        ) // Limit per source to avoid context overflow
        .join("\n\n---\n\n");

      // Package context into system input state
      const formattedContext = `
--- CURRENT WORKSPACE STATE ---
RESEARCH TOPIC & NOTES:
${JSON.stringify(userNoteList, null, 2)}

RESEARCH CITATIONS SUMMARY (Library):
${JSON.stringify(
  userCitationList.map((c: any) => ({
    title: c.title,
    author: c.author || c.authors,
    year: c.year || c.added,
    fileId: c.fileId,
    hasMappedFullText: !!c.extractedText || !!c.fullText,
  })),
  null,
  2,
)}

EXTRACTED FULL TEXT FOR MAPPED SOURCES:
${fullTextSections || "No full text mapped yet. Download papers to see coordinates."}

CURRENT STRUCTURAL OUTLINE (EDITOR CONTENT):
${JSON.stringify(userOutlineList, null, 2)}
${researchContext}
-------------------------------
`;

      const rawOpenaiMessages: any[] = messages
        .map((m: any) => {
          let content = m.content || "";
          if (!content.trim() && m.attachment) {
            content = `[Attached Document: ${m.attachment.fileName}]`;
          }
          return {
            role: m.role,
            content: content,
          };
        })
        .filter(
          (m: any) =>
            m.content &&
            typeof m.content === "string" &&
            m.content.trim().length > 0,
        );

      // Consolidate consecutive messages of the same role to prevent API errors (like Reka AI's strict schema)
      const openaiMessages: any[] = [];
      for (const msg of rawOpenaiMessages) {
        if (
          openaiMessages.length > 0 &&
          openaiMessages[openaiMessages.length - 1].role === msg.role
        ) {
          openaiMessages[openaiMessages.length - 1].content +=
            "\n\n" + msg.content;
        } else {
          openaiMessages.push({ ...msg });
        }
      }

      // Inject current workspace context
      if (openaiMessages.length > 0 && openaiMessages[0].role === "user") {
        openaiMessages[0].content = `Here is my current workspace state:\n${formattedContext}\nTreat this as background info. I am specifically asking you to help me with my document.\n\n---\n\n${openaiMessages[0].content}`;
      } else {
        openaiMessages.unshift({
          role: "user",
          content: `Here is my current workspace state:\n${formattedContext}\nTreat this as background info. I am specifically asking you to help me with my document.`,
        });
      }

      console.log(
        `[LLM] Preparing completion request with ${openaiMessages.length + 1} messages.`,
      );

      let activeSystemInstruction = systemInstruction;

      // Inject Custom Persona, Profile, Styles, and Guidelines dynamically
      if (personalityProfile) {
        if (personalityProfile === "Success Student Mentor") {
          activeSystemInstruction += `\n\nAI PERSONA: You are an AI Student Success Mentor. Be enthusiastic, relatable, warm, and highly encouraging. Use phrases like "Let's crush this!", "Great progress!", or "Brilliant angle!"`;
        } else if (personalityProfile === "Rigorous Peer Scholar") {
          activeSystemInstruction += `\n\nAI PERSONA: You are a Rigorous Peer Scholar. Be incredibly precise, highly formal, analytical, objective, and deeply scholarly. Focus entirely on academic rigor and precision. Avoid informal slang or cheering catchphrases.`;
        } else if (personalityProfile === "Socratic Guide") {
          activeSystemInstruction += `\n\nAI PERSONA: You are a Socratic Guide. Guide the user by challenging them with deep, guiding, reflective, open-ended questions. Prompt self-discovery and deeper intellectual analysis rather than giving answers directly.`;
        } else if (personalityProfile === "Supportive Coach") {
          activeSystemInstruction += `\n\nAI PERSONA: You are a Supportive Coach. Be friendly, motivating, focus on action plans, study schedules, and offer positive reinforcement to keep the user focused and moving forward.`;
        }
      }

      if (explainStyle && explainStyle !== "Standard") {
        activeSystemInstruction += `\n\nEXPLANATION STYLE OPTION: Explain all concepts and facts so that a ${explainStyle} can fully grasp them. Tailor your complexity, metaphors, terms and depth perfectly to this style.`;
      }

      if (writeStyle && writeStyle !== "Standard") {
        activeSystemInstruction += `\n\nWRITING STYLE OPTION: Synthesize and draft any written work in the exact style of a ${writeStyle}. Match their sentence structure, complexity, and vocabulary level perfectly.`;
      }

      if (customInstructions && customInstructions.trim()) {
        activeSystemInstruction += `\n\nADDITIONAL CUSTOM USER GUIDELINES: You must strictly adhere to the following instructions: "${customInstructions}"`;
      }

      if (userFullName || userWorkType) {
        activeSystemInstruction += `\n\nUSER PROFILE: You are currently aiding ${userFullName || "the user"}${userWorkType ? ` (who works/studies as a ${userWorkType})` : ""}. Remember this when framing your help.`;
      }

      if (webSearchEnabled) {
        activeSystemInstruction +=
          "\n\nCRITICAL REAL-TIME GROUNDING INLINE CITATIONS INSTRUCTIONS:\nWhen answering using the DuckDuckGo / You.com / Internet Web Grounding Results context, you MUST use inline markdown links for citations, formatted exactly as `[[1] Source Title](URL)`. DO NOT output a '### References' section at the end. Place these inline citation links right next to the facts inside your text to anchor your assertions firmly (e.g. `apples are red [[1] Apple Wiki](https://example.com/apple)`).";
      }

      if (thinkingLevel === "Deep") {
        activeSystemInstruction +=
          "\n\n[DEEP THINKING MODE ENABLED - MANDATORY REASONING]: You MUST perform extensive, step-by-step reasoning and analytical planning about the user's request. You MUST write this deep-thinking reasoning and planning inside the <thought>...</thought> tags FIRST, before writing any general chat inside <chat>...</chat> tags. Make your <thought> block extremely detailed, thorough, and highly analytical. Your response MUST strictly start with <thought> and close with </thought> before continuing to <chat>, otherwise the system cannot render your thinking process.";
      } else if (thinkingLevel === "Instant") {
        activeSystemInstruction +=
          "\n\n[THINKING DISABLED]: You must provide a direct, concise, and immediate response without any extensive reasoning, self-reflection, or internal thinking steps. Do not output any <think> tags. Keep it brief and to the point.";
      }

      // Ensure the model is completely context-aware of the current workspace state (document, notes, citations)
      activeSystemInstruction += `\n\n=== CURRENT WORKSPACE CONTEXT ===\n${formattedContext}\n=================================`;

      const messagesPayload = [
        {
          role: "system",
          content: activeSystemInstruction,
        },
        ...openaiMessages,
      ];

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      let completionStream;
      let usedGeminiFallback = !!(
        attachment &&
        (attachment.mimetype?.startsWith("image/") ||
          attachment.mimetype?.includes("pdf") ||
          (attachment.fileName && attachment.fileName.toLowerCase().endsWith(".pdf")))
      );
      let tryBasetenFirst =
        !usedGeminiFallback && requestedModel === "hokku-iv";
      let tryUpstageFirst =
        !usedGeminiFallback && requestedModel === "solar-pro2";
      let tryRekaFirst = !usedGeminiFallback && requestedModel === "reka-flash";
      let tryInceptionFirst =
        !usedGeminiFallback && requestedModel === "mercury-2";
      let tryXiaomiFirst =
        !usedGeminiFallback && requestedModel === "mimo-v2.5-pro";
      let tryGroqFirst =
        !usedGeminiFallback && requestedModel === "llama-3.1-8b-instant";
      let tryMistralFirst =
        !usedGeminiFallback &&
        !tryBasetenFirst &&
        !tryUpstageFirst &&
        !tryRekaFirst &&
        !tryInceptionFirst &&
        !tryXiaomiFirst &&
        !tryGroqFirst &&
        !requestedModel.includes("cohere") &&
        !requestedModel.includes("command-a");
      let tryCohereFirst =
        !usedGeminiFallback &&
        !tryBasetenFirst &&
        !tryUpstageFirst &&
        !tryRekaFirst &&
        !tryInceptionFirst &&
        !tryXiaomiFirst &&
        !tryGroqFirst &&
        (requestedModel.includes("cohere") ||
          requestedModel.includes("command-a"));
      let mistralModelToUse = "mistral-large-latest";
      let cohereModelToUse = "command-a-plus-05-2026";
      let basetenModelToUse =
        process.env.BASETEN_MODEL || "llama-3-1-70b-instruct";

      if (requestedModel && requestedModel !== "auto") {
        if (requestedModel.includes("mistral")) {
          tryMistralFirst = true;
          tryCohereFirst = false;
          tryBasetenFirst = false;
          tryUpstageFirst = false;
          tryRekaFirst = false;
          tryXiaomiFirst = false;
          usedGeminiFallback = false;
          mistralModelToUse = requestedModel;
        } else if (requestedModel.includes("gemini")) {
          tryMistralFirst = false;
          tryCohereFirst = false;
          tryBasetenFirst = false;
          tryUpstageFirst = false;
          tryRekaFirst = false;
          tryXiaomiFirst = false;
          usedGeminiFallback = true;
        } else if (
          requestedModel.includes("cohere") ||
          requestedModel.includes("command-a")
        ) {
          tryMistralFirst = false;
          tryCohereFirst = true;
          tryBasetenFirst = false;
          tryUpstageFirst = false;
          tryRekaFirst = false;
          tryXiaomiFirst = false;
          usedGeminiFallback = false;
          cohereModelToUse = requestedModel;
        } else if (requestedModel === "hokku-iv") {
          tryMistralFirst = false;
          tryCohereFirst = false;
          tryBasetenFirst = true;
          tryUpstageFirst = false;
          tryRekaFirst = false;
          tryXiaomiFirst = false;
          usedGeminiFallback = false;
        } else if (requestedModel === "solar-pro2") {
          tryMistralFirst = false;
          tryCohereFirst = false;
          tryBasetenFirst = false;
          tryUpstageFirst = true;
          tryRekaFirst = false;
          tryXiaomiFirst = false;
          usedGeminiFallback = false;
        } else if (requestedModel === "reka-flash") {
          tryMistralFirst = false;
          tryCohereFirst = false;
          tryBasetenFirst = false;
          tryUpstageFirst = false;
          tryRekaFirst = true;
          tryInceptionFirst = false;
          tryXiaomiFirst = false;
          usedGeminiFallback = false;
        } else if (requestedModel === "mercury-2") {
          tryMistralFirst = false;
          tryCohereFirst = false;
          tryBasetenFirst = false;
          tryUpstageFirst = false;
          tryRekaFirst = false;
          tryInceptionFirst = true;
          tryXiaomiFirst = false;
          usedGeminiFallback = false;
        } else if (requestedModel === "mimo-v2.5-pro") {
          tryMistralFirst = false;
          tryCohereFirst = false;
          tryBasetenFirst = false;
          tryUpstageFirst = false;
          tryRekaFirst = false;
          tryInceptionFirst = false;
          tryXiaomiFirst = true;
          tryGroqFirst = false;
          usedGeminiFallback = false;
        } else if (requestedModel === "llama-3.1-8b-instant") {
          tryMistralFirst = false;
          tryCohereFirst = false;
          tryBasetenFirst = false;
          tryUpstageFirst = false;
          tryRekaFirst = false;
          tryInceptionFirst = false;
          tryXiaomiFirst = false;
          tryGroqFirst = true;
          usedGeminiFallback = false;
        }
      }

      if (tryGroqFirst) {
        try {
          console.log(`[LLM] Streaming chat with Groq (llama-3.1-8b-instant)...`);
          const client = getGroqClient();
          completionStream = await client.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: messagesPayload,
            temperature: 0.7,
            stream: true,
          });
        } catch (err: any) {
          console.warn(`[LLM] Groq streaming failed:`, err.message || err);

          if (
            err.message?.includes("GROQ_API_KEY") ||
            err.message?.includes("configured")
          ) {
            throw new Error(
              "GROQ_API_KEY is not defined. Please configure it in your Settings.",
            );
          }

          if (requestedModel !== "llama-3.1-8b-instant") {
            console.warn("[LLM] Falling back to Gemini...");
            tryGroqFirst = false;
            usedGeminiFallback = true;
          } else {
            throw new Error(
              `Groq LLM failed: ${err.message || "Unknown error during streaming."}`,
            );
          }
        }
      }

      if (tryBasetenFirst) {
        try {
          console.log(
            `[LLM] Streaming chat with Baseten (${basetenModelToUse})...`,
          );
          const client = getBasetenClient();
          completionStream = await client.chat.completions.create({
            model: basetenModelToUse,
            messages: messagesPayload,
            temperature: 0.7,
            stream: true,
          });
        } catch (err: any) {
          console.warn(
            `[LLM] Baseten streaming failed (${basetenModelToUse}):`,
            err.message || err,
          );

          if (
            err.message?.includes("BASETEN_API_KEY") ||
            err.message?.includes("configured")
          ) {
            throw new Error(
              "BASETEN_API_KEY is not defined. Please configure it in your Settings.",
            );
          }

          const modelError = err.message || JSON.stringify(err);
          if (modelError.includes("404") || modelError.includes("model")) {
            throw new Error(
              `Baseten Model ID error: "${basetenModelToUse}" was not found (404). Please check your BASETEN_MODEL secret and ensure it matches the model slug on your Baseten dashboard.`,
            );
          }

          if (requestedModel !== "hokku-iv") {
            console.warn("[LLM] Falling back to Gemini...");
            tryBasetenFirst = false;
            usedGeminiFallback = true;
          } else {
            throw new Error(
              `Baseten LLM failed: ${modelError || "Unknown error during streaming."}`,
            );
          }
        }
      }

      if (tryMistralFirst) {
        try {
          console.log(
            `[LLM] Streaming chat with Mistral (${mistralModelToUse})...`,
          );
          const client = getMistralClient();
          completionStream = await client.chat.completions.create({
            model: mistralModelToUse,
            messages: messagesPayload,
            temperature: 0.7,
            stream: true,
          });
        } catch (err: any) {
          console.warn(
            `[LLM] Mistral streaming failed (${mistralModelToUse}):`,
            err.message || err,
          );

          if (
            err.message?.includes("MISTRAL_API_KEY is not configured") &&
            requestedModel.includes("mistral")
          ) {
            throw new Error(
              "MISTRAL_API_KEY is not defined. Please configure it in your Settings.",
            );
          }

          // ONLY fallback to Gemini if they didn't explicitly request a Mistral model
          if (!requestedModel.includes("mistral")) {
            console.warn("[LLM] Falling back to Gemini...");
            tryMistralFirst = false;
            usedGeminiFallback = true;
          } else {
            throw new Error(
              `Mistral LLM failed: ${err.message || "Unknown error during streaming."}`,
            );
          }
        }
      }

      if (tryCohereFirst) {
        try {
          console.log(
            `[LLM] Streaming chat with Cohere (${cohereModelToUse})...`,
          );
          const client = getCohereClient();
          completionStream = await client.chat.completions.create({
            model: cohereModelToUse,
            messages: messagesPayload,
            temperature: 0.7,
            stream: true,
          });
        } catch (err: any) {
          console.warn(
            `[LLM] Cohere streaming failed (${cohereModelToUse}):`,
            err.message || err,
          );

          if (
            err.message?.includes("COHERE_API_KEY") ||
            err.message?.includes("configured")
          ) {
            throw new Error(
              "COHERE_API_KEY is not defined. Please configure it in your Settings.",
            );
          }

          if (
            !requestedModel.includes("cohere") &&
            !requestedModel.includes("command-a")
          ) {
            console.warn("[LLM] Falling back to Gemini...");
            tryCohereFirst = false;
            usedGeminiFallback = true;
          } else {
            throw new Error(
              `Cohere LLM failed: ${err.message || "Unknown error during streaming."}`,
            );
          }
        }
      }

      if (tryUpstageFirst) {
        try {
          console.log(`[LLM] Streaming chat with Upstage (solar-pro2)...`);
          const client = getUpstageClient();
          completionStream = await client.chat.completions.create({
            model: "solar-pro2",
            messages: messagesPayload,
            temperature: 0.7,
            stream: true,
          });
        } catch (err: any) {
          console.warn(`[LLM] Upstage streaming failed:`, err.message || err);

          if (
            err.message?.includes("UPSTAGE_API_KEY") ||
            err.message?.includes("configured")
          ) {
            throw new Error(
              "UPSTAGE_API_KEY is not defined. Please configure it in your Settings.",
            );
          }

          if (requestedModel !== "solar-pro2") {
            console.warn("[LLM] Falling back to Gemini...");
            tryUpstageFirst = false;
            usedGeminiFallback = true;
          } else {
            throw new Error(
              `Upstage LLM failed: ${err.message || "Unknown error during streaming."}`,
            );
          }
        }
      }

      if (tryRekaFirst) {
        try {
          console.log(`[LLM] Streaming chat with Reka (reka-flash)...`);
          const client = getRekaClient();
          completionStream = await client.chat.completions.create({
            model: "reka-flash",
            messages: messagesPayload,
            temperature: 0.7,
            stream: true,
          });
        } catch (err: any) {
          console.warn(`[LLM] Reka streaming failed:`, err.message || err);

          if (
            err.message?.includes("REKA_API_KEY") ||
            err.message?.includes("configured")
          ) {
            throw new Error(
              "REKA_API_KEY is not defined. Please configure it in your Settings.",
            );
          }

          if (requestedModel !== "reka-flash") {
            console.warn("[LLM] Falling back to Gemini...");
            tryRekaFirst = false;
            usedGeminiFallback = true;
          } else {
            throw new Error(
              `Reka LLM failed: ${err.message || "Unknown error during streaming."}`,
            );
          }
        }
      }

      if (tryInceptionFirst) {
        try {
          console.log(`[LLM] Streaming chat with Inception (mercury-2)...`);
          const client = getInceptionClient();
          completionStream = await client.chat.completions.create({
            model: "mercury-2",
            messages: messagesPayload,
            temperature: 0.7,
            stream: true,
          });
        } catch (err: any) {
          console.warn(`[LLM] Inception streaming failed:`, err.message || err);

          if (
            err.message?.includes("INCEPTION_API_KEY") ||
            err.message?.includes("configured")
          ) {
            throw new Error(
              "INCEPTION_API_KEY is not defined. Please configure it in your Settings.",
            );
          }

          if (requestedModel !== "mercury-2") {
            console.warn("[LLM] Falling back to Gemini...");
            tryInceptionFirst = false;
            usedGeminiFallback = true;
          } else {
            throw new Error(
              `Inception LLM failed: ${err.message || "Unknown error during streaming."}`,
            );
          }
        }
      }

      if (tryXiaomiFirst) {
        try {
          console.log(`[LLM] Streaming chat with Xiaomi (mimo-v2.5-pro)...`);
          const client = getXiaomiClient();
          completionStream = await client.chat.completions.create({
            model: "mimo-v2.5-pro",
            messages: messagesPayload,
            temperature: 0.7,
            stream: true,
          });
        } catch (err: any) {
          console.warn(`[LLM] Xiaomi streaming failed:`, err.message || err);

          if (
            err.message?.includes("XIAOMI_API_KEY") ||
            err.message?.includes("configured") ||
            err.message?.includes("401") ||
            err.message?.includes("JWT") ||
            err.message?.includes("Invalid JWT")
          ) {
            throw new Error(
              "XIAOMI_API_KEY is invalid or missing. Please check your API key in Settings.",
            );
          }

          if (requestedModel !== "mimo-v2.5-pro") {
            console.warn("[LLM] Falling back to Gemini...");
            tryXiaomiFirst = false;
            usedGeminiFallback = true;
          } else {
            throw new Error(
              `Xiaomi LLM failed: ${err.message || "Unknown error during streaming."}`,
            );
          }
        }
      }

      let mainChatCollectedText = "";

      if (
        (!tryMistralFirst &&
          !tryCohereFirst &&
          !tryBasetenFirst &&
          !tryUpstageFirst &&
          !tryRekaFirst &&
          !tryInceptionFirst &&
          !tryXiaomiFirst &&
          !tryGroqFirst) ||
        usedGeminiFallback
      ) {
        console.log(`[LLM] Streaming chat with Gemini...`);

        // Convert messages list to Gemini alternated format
        const geminiContents: Array<{
          role: "user" | "model";
          parts: Array<any>;
        }> = [];
        for (const msg of openaiMessages) {
          const role =
            msg.role === "assistant" || msg.role === "model" ? "model" : "user";
          const text = msg.content || "";
          if (
            geminiContents.length > 0 &&
            geminiContents[geminiContents.length - 1].role === role
          ) {
            const firstPart =
              geminiContents[geminiContents.length - 1].parts[0];
            if (firstPart && "text" in firstPart) {
              firstPart.text += "\n\n" + text;
            } else {
              geminiContents[geminiContents.length - 1].parts.push({
                text: text,
              });
            }
          } else {
            geminiContents.push({
              role: role,
              parts: [{ text: text }],
            });
          }
        }

        if (
          attachment &&
          (attachment.mimetype?.startsWith("image/") ||
            attachment.mimetype?.includes("pdf") ||
            (attachment.fileName && attachment.fileName.toLowerCase().endsWith(".pdf")))
        ) {
          try {
            const fileData = await getFile(attachment.fileId);
            if (fileData) {
              const base64Data = fileData.buffer.toString("base64");
              // Find the last user message in geminiContents to attach the file part
              let addedToLast = false;
              for (let i = geminiContents.length - 1; i >= 0; i--) {
                if (geminiContents[i].role === "user") {
                  geminiContents[i].parts.push({
                    inlineData: {
                      mimeType: fileData.mimetype,
                      data: base64Data,
                    },
                  });
                  addedToLast = true;
                  break;
                }
              }
              if (!addedToLast) {
                geminiContents.push({
                  role: "user",
                  parts: [
                    { text: "[Attached File]" },
                    {
                      inlineData: {
                        mimeType: fileData.mimetype,
                        data: base64Data,
                      },
                    },
                  ],
                });
              }
              console.log(
                `[GEMINI MULTIMODAL] Successfully attached file ${attachment.fileName} size ${fileData.buffer.length} to conversational payload.`,
              );
            }
          } catch (err: any) {
            console.error(
              "[GEMINI MULTIMODAL] Error loading attachment for integration:",
              err.message || err,
            );
          }
        }

        const geminiConfig: any = {
          systemInstruction: activeSystemInstruction,
          temperature: 0.7,
        };

        if (thinkingLevel === "Deep") {
          geminiConfig.thinkingConfig = { thinkingLevel: "HIGH" };
        } else if (thinkingLevel === "Instant") {
          geminiConfig.thinkingConfig = { thinkingLevel: "OFF" };
        }

        if (webSearchEnabled) {
          geminiConfig.tools = [{ googleSearch: {} }];
        }

        const responseStream = await ai.models.generateContentStream({
          model: "gemini-flash-latest",
          contents: geminiContents,
          config: geminiConfig,
        });

        let inThoughtBlock = false;

        for await (const chunk of responseStream) {
          const groundingMetadata = chunk.candidates?.[0]?.groundingMetadata;
          if (groundingMetadata) {
            res.write(
              `data: ${JSON.stringify({ groundingMetadata })}\n\n`,
            );
          }

          const parts = chunk.candidates?.[0]?.content?.parts;
          if (parts && Array.isArray(parts) && parts.length > 0) {
            for (const part of parts) {
              const isThought = !!part.thought;
              const text = part.text || "";

              if (text) {
                let textToStream = "";

                if (isThought) {
                  if (!inThoughtBlock) {
                    textToStream += "<thought>\n";
                    inThoughtBlock = true;
                  }
                  textToStream += text;
                } else {
                  if (inThoughtBlock) {
                    textToStream += "\n</thought>\n";
                    inThoughtBlock = false;
                  }
                  textToStream += text;
                }

                if (textToStream) {
                  mainChatCollectedText += textToStream;
                  res.write(
                    `data: ${JSON.stringify({ text: textToStream })}\n\n`,
                  );
                }
              }
            }
          } else {
            const content = chunk.candidates?.[0]?.content?.parts?.[0]?.text || "";
            if (content) {
              let textToStream = "";
              if (inThoughtBlock) {
                textToStream += "\n</thought>\n";
                inThoughtBlock = false;
              }
              textToStream += content;
              mainChatCollectedText += textToStream;
              res.write(`data: ${JSON.stringify({ text: textToStream })}\n\n`);
            }
          }
        }

        if (inThoughtBlock) {
          mainChatCollectedText += "\n</thought>\n";
          res.write(`data: ${JSON.stringify({ text: "\n</thought>\n" })}\n\n`);
        }
      } else if (completionStream) {
        for await (const chunk of completionStream) {
          const content = chunk.choices[0]?.delta?.content || "";
          if (content) {
            mainChatCollectedText += content;
            res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
          }
        }
      }

      // Check if main chat has delegated task to the Mistral Editor Agent
      const callAgentMatch = mainChatCollectedText?.match(
        /<callEditorAgent>([\s\S]*?)(?:<\/callEditorAgent>|$)/i,
      );
      if (callAgentMatch) {
        const editorPrompt = callAgentMatch[1].trim();
        let editorModel = "codestral-latest"; // Default specialized Mistral agent
        if (mistralModelToUse === "codestral-latest") {
          editorModel = "mistral-large-latest";
        } else if (mistralModelToUse === "mistral-large-latest") {
          editorModel = "codestral-latest";
        }

        console.log(
          `[BLOB AGENT] Main chat agent delegated content creation. Model: ${editorModel}, Prompt: "${editorPrompt.substring(0, 100)}..."`,
        );

        // Notify client that the editor agent is starting
        res.write(`data: ${JSON.stringify({ status: "editor_agent" })}\n\n`);

        const editorSystemPrompt = `You are Blob, the specialized content creation agent. Your sole purpose is to write, generate, or rewrite highly structured, polished, and comprehensive academic/research content for the editor.
You are extremely professional and focused on academic quality.

Your output MUST use exactly these two XML-style tags:
<title>A compelling, short academic title</title>
<replaceContent>The full, polished, multi-paragraph markdown content of the academic draft/essay.</replaceContent>

CRITICAL PROTOCOLS:
1. NO CHAT OR CONVERSATION: Do NOT output any conversational preambles, greetings, or postscripts. Start directly with the XML tags: <title> and <replaceContent>. No plain text outside the XML tags.
2. HEADING FORMATTING: ALWAYS ensure that every heading in the markdown content starts on a brand-new line and is preceded by exactly two blank lines (e.g., \\n\\n## Introduction\\n\\n).
3. NO TITLE REPETITION: Do NOT repeat the document title as an H1 or H2 header at the start of the <replaceContent> block. Start directly with the first section header (e.g., ## Introduction).
4. Academic Excellence: Write deep, detailed, multi-paragraph content. Don't summarize unnecessarily; expand and construct standard academic paragraphs.`;

        try {
          const client = getMistralClient();
          const editorStream = await client.chat.completions.create({
            model: editorModel,
            messages: [
              { role: "system", content: editorSystemPrompt },
              {
                role: "user",
                content: `Please write our paper content with the following details and outline context:\n\n${editorPrompt}`,
              },
            ],
            temperature: 0.7,
            stream: true,
          });

          for await (const chunk of editorStream) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
            }
          }

          // Output confirmation message from Blob after drafting completes
          const completionMsg =
            "\n\n**Blob:** Done making the content! It is successfully integrated into your editor.";
          res.write(`data: ${JSON.stringify({ text: completionMsg })}\n\n`);
        } catch (editorErr: any) {
          console.error(
            "[BLOB AGENT] Error while calling specialized Editor Agent (Blob):",
            editorErr,
          );
          res.write(
            `data: ${JSON.stringify({ text: `\n\n**[Error] Blob failed to compile content:** ${editorErr.message || editorErr}` })}\n\n`,
          );
        } finally {
          res.write(
            `data: ${JSON.stringify({ status: "editor_agent_done" })}\n\n`,
          );
        }
      }

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (error: any) {
      console.error("Research API Error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          error:
            error.message || "An internal error occurred during processing.",
        });
      } else {
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      }
    }
  });

  // Global API error handler
  app.use(
    "/api",
    (
      err: any,
      req: express.Request,
      res: express.Response,
      next: express.NextFunction,
    ) => {
      console.error("[SERVER Error] API routing error caught:", err);
      if (!res.headersSent) {
        res
          .status(500)
          .json({
            success: false,
            error: err?.message || "Internal server error.",
          });
      } else {
        next(err);
      }
    },
  );

  app.post("/api/search-arxiv", async (req, res) => {
    try {
      const { query } = SearchArxivSchema.parse(req.body);
      if (!query) {
        return res.status(400).json({ success: false, error: "Missing query" });
      }

      let cleanQuery = query
        .replace(/[^\w\s-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!cleanQuery) cleanQuery = query.trim() || "academic research";

      let entries: any[] = [];
      let sourceEngine = "Semantic Scholar";

      // 1. TRY SEMANTIC SCHOLAR FIRST
      try {
        console.log(`[SEARCH-API] Searching Semantic Scholar for: "${cleanQuery}"`);
        const ssUrl = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(cleanQuery)}&limit=10&fields=title,authors,year,abstract,openAccessPdf,url,externalIds`;
        const ssResponse = await axios.get(ssUrl, {
          timeout: 10000,
          headers: { "User-Agent": "Mozilla/5.0" },
        });

        if (ssResponse.status === 200 && ssResponse.data?.data) {
          const rawData = ssResponse.data.data || [];
          console.log(`[SEARCH-API] Semantic Scholar returned ${rawData.length} papers.`);
          
          entries = rawData.map((paper: any) => {
            const authorNames = (paper.authors || [])
              .map((a: any) => a.name)
              .filter(Boolean)
              .join(", ");

            let pdfLink = paper.openAccessPdf?.url || null;
            if (paper.externalIds?.ArXiv) {
              const arxivId = paper.externalIds.ArXiv.split("/").pop();
              pdfLink = `https://arxiv.org/pdf/${arxivId}.pdf`;
            }

            return {
              title: paper.title || "Unknown Title",
              author: authorNames || "Unknown Author",
              abstract: paper.abstract || "No abstract available.",
              year: paper.year?.toString() || "2026",
              url: paper.url || "",
              pdfLink: pdfLink,
              doi: paper.externalIds?.DOI || "",
              arxivId: paper.externalIds?.ArXiv || null,
            };
          });
        }
      } catch (ssErr: any) {
        console.warn(`[SEARCH-API] Semantic Scholar failed: ${ssErr.message}. Falling back to OpenAlex...`);
      }

      // 2. FALLBACK TO OPENALEX
      if (entries.length === 0) {
        sourceEngine = "OpenAlex";
        try {
          console.log(`[SEARCH-API] Searching OpenAlex for: "${cleanQuery}"`);
          const openAlexUrl = `https://api.openalex.org/works?search=${encodeURIComponent(cleanQuery)}&filter=has_pdf_url:true&per-page=10&mailto=asnahonron@gmail.com`;
          const alexResponse = await axios.get(openAlexUrl, {
            timeout: 10000,
            headers: { "User-Agent": "Mozilla/5.0" },
          });

          if (alexResponse.status === 200 && alexResponse.data?.results) {
            const results = alexResponse.data.results || [];
            console.log(`[SEARCH-API] OpenAlex returned ${results.length} papers.`);
            
            entries = results.map((entry: any) => {
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

              const author = entry.authorships?.[0]?.author?.display_name || "Unknown Author";
              let pdfLink = entry.best_oa_location?.pdf_url || entry.open_access?.oa_url;
              if (entry.ids?.arxiv) {
                const arxivId = entry.ids.arxiv.split("/").pop();
                if (!pdfLink?.includes("arxiv.org")) {
                  pdfLink = `https://arxiv.org/pdf/${arxivId}.pdf`;
                }
              }

              return {
                title: entry.title || "Unknown Title",
                author: author,
                abstract: abstract,
                year: entry.publication_year?.toString() || "2026",
                url: entry.id || "",
                pdfLink: pdfLink,
                doi: entry.doi || "",
                arxivId: entry.ids?.arxiv ? entry.ids.arxiv.split("/").pop() : null,
              };
            });
          }
        } catch (alexErr: any) {
          console.warn(`[SEARCH-API] OpenAlex fallback failed: ${alexErr.message}`);
        }
      }

      // 3. FALLBACK TO CROSSREF
      if (entries.length === 0) {
        sourceEngine = "CrossRef";
        try {
          console.log(`[SEARCH-API] Searching CrossRef fallback for: "${cleanQuery}"`);
          const crossrefUrl = `https://api.crossref.org/works?query=${encodeURIComponent(cleanQuery)}&rows=5`;
          const crRes = await axios.get(crossrefUrl, {
            timeout: 10000,
            headers: { "User-Agent": "mailto:asnahonron@gmail.com" },
          });
          const items = crRes.data?.message?.items || [];
          entries = items.map((item: any) => {
            const authorName = (item.author || [])
              .map((a: any) => {
                if (a.family && a.given) return `${a.family}, ${a.given}`;
                if (a.family) return a.family;
                return a.name || "";
              })
              .filter(Boolean)
              .join("; ");

            const yearStr = item.issued?.["date-parts"]?.[0]?.[0]
              ? String(item.issued["date-parts"][0][0])
              : "2026";

            const doiVal = item.DOI || "";
            const bestPdf = item.link?.find((l: any) => l["content-type"] === "application/pdf" || l.URL?.endsWith(".pdf"))?.URL 
              || item.link?.[0]?.URL 
              || "";

            return {
              title: item.title?.[0] || "Unknown Title",
              author: authorName || "Unknown Author",
              abstract: "Abstract resolved from CrossRef bibliographic metadata.",
              year: yearStr,
              url: item.URL || (doiVal ? `https://doi.org/${doiVal}` : ""),
              pdfLink: bestPdf,
              doi: doiVal,
              arxivId: null,
            };
          });
        } catch (crErr: any) {
          console.warn(`[SEARCH-API] CrossRef fallback failed: ${crErr.message}`);
        }
      }

      // 4. GENERATE SYNTHETIC AS LAST RESORT
      if (entries.length === 0) {
        sourceEngine = "Synthetic Fallback";
        try {
          console.log(`[SEARCH-API] Creating synthetic papers fallback...`);
          const prompt = `You are an academic database search engine. The user is searching for: "${query}". 
Generate a list of 2 highly realistic, relevant academic research papers.
Return ONLY a valid JSON array of objects, with no markdown formatting around it (no backticks, no \`\`\`json, just the array). Each object must have these exact fields:
- title: (string) A realistic, relevant academic paper title
- author: (string) A realistic name of the lead author and co-authors
- abstract: (string) A realistic, academic abstract of 100-150 words summarizing the paper's methodology and findings
- year: (string) A realistic publication year between 2018 and 2026
- url: (string) A placeholder URL or DOI link
`;
          const aiResponse = await ai.models.generateContent({
            model: "gemini-flash-latest",
            contents: prompt,
          });
          const textResponse = aiResponse.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
          const cleanJsonText = textResponse.replace(/```json|```/g, "").trim();
          const syntheticPapers = JSON.parse(cleanJsonText);
          entries = syntheticPapers.map((sp: any) => {
            return {
              title: sp.title || "Synthetic Research Paper",
              author: sp.author || "Unknown Author",
              abstract: sp.abstract || "Abstract unavailable.",
              year: sp.year || "2026",
              url: sp.url || "https://doi.org",
              pdfLink: null,
              doi: "",
              arxivId: null,
            };
          });
        } catch (geminiErr: any) {
          console.error("[SEARCH-API] Synthetic fallback failed:", geminiErr.message);
        }
      }

      const papers = [];
      const sortedEntries = [...entries].sort((a, b) => {
        const scoreA = (a.pdfLink ? 2 : 0) + (a.arxivId ? 1 : 0);
        const scoreB = (b.pdfLink ? 2 : 0) + (b.arxivId ? 1 : 0);
        return scoreB - scoreA;
      });

      const candidatesToProcess = sortedEntries.slice(0, 3);
      console.log(`[SEARCH-API] Processing ${candidatesToProcess.length} candidate papers for download.`);

      for (const entry of candidatesToProcess) {
        const title = entry.title;
        const author = entry.author;
        const abstract = entry.abstract;
        const year = entry.year;
        let pdfLink = entry.pdfLink;

        const normalizedTitle = title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .slice(0, 50)
          .replace(/^-+|-+$/g, "");

        let fileId = null;
        let mimetype = "application/pdf";

        let existingCachedPaper = null;
        if (pdfLink && (await getCachedPaper(pdfLink)) !== null) {
          existingCachedPaper = (await getCachedPaper(pdfLink));
        } else if (normalizedTitle && (await getCachedPaper(normalizedTitle)) !== null) {
          existingCachedPaper = (await getCachedPaper(normalizedTitle));
        }

        if (existingCachedPaper) {
          console.log(`[DEDUPLICATION] Reusing existing downloaded PDF for "${title}" with fileId: ${existingCachedPaper.fileId}`);
          fileId = existingCachedPaper.fileId;
          mimetype = existingCachedPaper.mimetype;
        } else if (pdfLink || entry.doi) {
          try {
            await new Promise((resolve) => setTimeout(resolve, 500));

            const attemptDownload = async (url: string) => {
              const buffer = await attemptBypassDownload(url);
              return {
                data: buffer,
                headers: { "content-type": "application/pdf" },
              };
            };

            let pdfRes;
            let doiClean = entry.doi
              ? entry.doi.replace(/^(https?:\/\/)?(www\.)?(dx\.)?doi\.org\//i, "")
              : null;
              
            if (!doiClean && title) {
              try {
                console.log(`[Crossref] Looking up DOI for title: ${title}`);
                const crossrefUrl = `https://api.crossref.org/works?query.title=${encodeURIComponent(title)}&select=DOI,title&rows=3&mailto=asnahonron@gmail.com`;
                const crossrefRes = await axios.get(crossrefUrl, { timeout: 8000 });
                if (crossrefRes.data?.message?.items?.length > 0) {
                  doiClean = crossrefRes.data.message.items[0].DOI;
                  console.log(`[Crossref] Found DOI: ${doiClean}`);
                }
              } catch (crossErr: any) {
                console.warn(`[Crossref] DOI lookup failed: ${crossErr.message}`);
              }
            }
              
            if (doiClean) {
              try {
                console.log(`[Unpaywall] Checking Unpaywall first for DOI: ${doiClean}`);
                const unpaywallUrl = `https://api.unpaywall.org/v2/${encodeURIComponent(doiClean)}?email=asnahonron@gmail.com`;
                const unpaywallRes = await axios.get(unpaywallUrl, { timeout: 8000 });
                if (unpaywallRes.data && unpaywallRes.data.is_oa) {
                  const unpaywallPdfLink = unpaywallRes.data.best_oa_location?.url_for_pdf;
                  if (unpaywallPdfLink) {
                    console.log(`[Unpaywall] Found prioritized open-access PDF: ${unpaywallPdfLink}`);
                    try {
                      pdfRes = await attemptDownload(unpaywallPdfLink);
                      pdfLink = unpaywallPdfLink;
                    } catch (e: any) {
                      console.warn(`[Unpaywall] Failed to download PDF from Unpaywall URL: ${unpaywallPdfLink}`);
                    }
                  }
                  if (!pdfRes && unpaywallRes.data.oa_locations) {
                    for (const loc of unpaywallRes.data.oa_locations) {
                      if (loc.url_for_pdf && loc.url_for_pdf !== unpaywallPdfLink) {
                        try {
                          await new Promise((resolve) => setTimeout(resolve, 500));
                          pdfRes = await attemptDownload(loc.url_for_pdf);
                          pdfLink = loc.url_for_pdf;
                          break;
                        } catch (e: any) {
                          console.warn(`[Unpaywall] Fallback download failed for: ${loc.url_for_pdf}`);
                        }
                      }
                    }
                  }
                }
              } catch (unpaywallErr: any) {
                console.warn(`[Unpaywall] API query failed: ${unpaywallErr.message}`);
              }
            }

            if (!pdfRes && pdfLink) {
              try {
                console.log(`[DOWNLOAD] Attempting direct download from PDF Link: ${pdfLink}`);
                pdfRes = await attemptDownload(pdfLink);
              } catch (pdfErr: any) {
                console.warn(`[DOWNLOAD] Direct download failed for: ${pdfLink}: ${pdfErr.message}`);
              }
            }

            if (pdfRes) {
              try {
                const cleanTitle = normalizedTitle || "paper";
                fileId = `semantic-${cleanTitle}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
                const buffer = Buffer.from(pdfRes.data);
                const sniffed = sniffMimeType(buffer);

                if (
                  sniffed.mimetype === "application/pdf" ||
                  sniffed.mimetype === "text/html" ||
                  sniffed.mimetype === "text/plain" ||
                  sniffed.mimetype.includes("word") ||
                  sniffed.mimetype.includes("docx")
                ) {
                  console.log(`[DOWNLOAD-MIME] Successfully resolved readable document type: ${sniffed.mimetype} for ${title}`);
                  await saveFile(fileId, {
                    buffer: buffer,
                    mimetype: sniffed.mimetype,
                    originalname: `${title.replace(/[^a-zA-Z0-9]/g, "_")}.${sniffed.extension}`,
                  });
                  mimetype = sniffed.mimetype;

                  const cacheEntry = {
                    fileId,
                    title,
                    pdfUrl: pdfLink,
                    mimetype: sniffed.mimetype,
                  };
                  await setCachedPaper(normalizedTitle, cacheEntry);
                  if (pdfLink) {
                    await setCachedPaper(pdfLink, cacheEntry);
                  }
                } else {
                  console.warn(`Downloaded content for ${title} has unsupported mime type: ${sniffed.mimetype}.`);
                  fileId = null;
                  mimetype = null;
                }
              } catch (saveErr: any) {
                console.error(`Failed to save real file for ${title}:`, saveErr.message);
                fileId = null;
                mimetype = null;
              }
            } else {
              console.log(`[INFO] Could not download PDF for paper: ${title}`);
              fileId = null;
              mimetype = null;
            }
          } catch (outerErr: any) {
            console.error(`Outer error downloading ${title}:`, outerErr.message);
          }
        }

        papers.push({
          title,
          author,
          abstract,
          year,
          url: entry.url || pdfLink,
          fileId,
          mimetype,
        });
      }

      res.json({ success: true, papers, engine: sourceEngine });
    } catch (err: any) {
      console.error("Error searching OpenAlex:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post("/api/generate-pdf", async (req, res) => {
    try {
      const { title, author, year, abstract, fullText } = GeneratePdfSchema.parse(req.body);

      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];

      doc.on("data", buffers.push.bind(buffers));
      doc.on("end", async () => {
        const pdfData = Buffer.concat(buffers);
        const fileId = `file-${Date.now()}`;
        await saveFile(fileId, {
          buffer: pdfData,
          mimetype: "application/pdf",
          originalname: `${title ? title.replace(/[^a-zA-Z0-9]/g, "_") : "document"}.pdf`,
        });
        res.json({ success: true, fileId });
      });

      if (title) {
        doc
          .fontSize(24)
          .font("Helvetica-Bold")
          .fillColor("black")
          .text(title, { align: "center" });
        doc.moveDown(0.5);
      }

      if (author || year) {
        doc
          .fontSize(12)
          .font("Helvetica")
          .fillColor("gray")
          .text(`${author || "Unknown Author"} (${year || "2026"})`, {
            align: "center",
          });
        doc.moveDown(2);
      }

      if (abstract) {
        doc
          .fontSize(16)
          .font("Helvetica-Bold")
          .fillColor("black")
          .text("Abstract");
        doc.moveDown(0.5);
        doc.fontSize(12).font("Helvetica").text(abstract, { align: "justify" });
        doc.moveDown(2);
      }

      if (fullText) {
        const sections = fullText.split(/(?=^## )/gm);
        for (const section of sections) {
          if (section.trim().startsWith("## ")) {
            const lines = section.split("\n");
            const heading = lines[0].replace("## ", "").trim();
            const body = lines.slice(1).join("\n").trim();
            doc.fontSize(16).font("Helvetica-Bold").text(heading);
            doc.moveDown(0.5);
            doc.fontSize(12).font("Helvetica").text(body, { align: "justify" });
            doc.moveDown(2);
          } else {
            doc
              .fontSize(12)
              .font("Helvetica")
              .text(section, { align: "justify" });
            doc.moveDown();
          }
        }
      }

      doc.end();
    } catch (err: any) {
      console.error("Error generating PDF:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Statistics Tool AI File Analyzer
  app.post("/api/statistics/analyze", async (req, res) => {
    try {
      const { textContent, filename } = AnalyzeStatsSchema.parse(req.body);
      if (!textContent) {
        return res
          .status(400)
          .json({ error: "Text content is required for analysis." });
      }

      console.log(
        `[LLM] Attempting statistics analysis for: ${filename} with Mistral...`,
      );
      const client = getMistralClient();
      const completion = await client.chat.completions.create({
        model: "ministral-8b-latest",
        messages: [
          {
            role: "system",
            content: `You are an expert data scientist and statistician. The user has uploaded a file or dataset named "${filename || "dataset"}".
First, analyze if this document even needs statistical interpretation or if it is a research paper that contains analyzable data. If it is NOT a research paper or does not contain statistical data that requires interpretation, clarify what the document is and clearly state that it doesn't appear to need statistical analysis.
If it DOES contain relevant statistical data or is a research paper, proceed to provide a thorough statistical explanation.
Point out any patterns, possible statistical models (like Slovin, ANOVA, regressions, mean/median) that apply.
Output in clear Markdown formatting.`,
          },
          {
            role: "user",
            content: `Here are the contents of the file:\n\n${textContent.slice(0, 15000)}`, // Limit to 15K chars for context safety
          },
        ],
        temperature: 0.5,
      });

      const responseText =
        completion.choices[0]?.message?.content ||
        "Could not generate analysis.";

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
      const { content, title } = GenerateQuizSchema.parse(req.body);
      if (!content) {
        return res
          .status(400)
          .json({ error: "Document content is required to prepare a quiz." });
      }

      // Standardize and sanitize clean text to avoid token overflow
      const textToAnalyze = content
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .substring(0, 16000);

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
          model: "llama-3.1-8b-instant",
          messages: [
            {
              role: "system",
              content:
                "You are an educational quiz expert. Respond using ONLY a raw JSON object string to supply exactly 10 questions. Do not wrap in markdown or blockquotes.",
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
        console.error(
          "[QUIZ_GEN_API] Groq error, falling back to Gemini:",
          groqError.message || groqError,
        );

        const aiResponse = await ai.models.generateContent({
          model: "gemini-flash-latest",
          contents: quizPrompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                isQuizApplicable: {
                  type: Type.BOOLEAN,
                  description:
                    "True if the excerpt contains educational, technical, or factual substance suitable for a quiz.",
                },
                applicabilityReason: {
                  type: Type.STRING,
                  description:
                    "A friendly, constructive 1-sentence summary assessing the content.",
                },
                questions: {
                  type: Type.ARRAY,
                  description:
                    "Array of exactly 10 multiple choice questions, only generated if isQuizApplicable is true.",
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      question: {
                        type: Type.STRING,
                        description:
                          "A clear, challenging question about key insights of the document.",
                      },
                      options: {
                        type: Type.ARRAY,
                        items: { type: Type.STRING },
                        description: "Exactly 4 unique options.",
                      },
                      correctAnswerIndex: {
                        type: Type.INTEGER,
                        description:
                          "0-based index of the correct option (0 to 3).",
                      },
                    },
                    required: ["question", "options", "correctAnswerIndex"],
                  },
                },
              },
              required: ["isQuizApplicable", "applicabilityReason"],
            },
          },
        });

        const text = aiResponse.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
          throw new Error("Received empty content output from Gemini.");
        }

        const result = cleanAndParseJSON(text);
        return res.json(result);
      }
    } catch (e: any) {
      console.error("[QUIZ_GEN_API] Error:", e);
      res
        .status(500)
        .json({
          error: e.message || "An exception occurred during quiz composition.",
        });
    }
  });

  // Generate structured study notes from document text
  app.post("/api/research/generate-notes", async (req, res) => {
    try {
      const { content, title } = GenerateNotesSchema.parse(req.body);
      if (!content) {
        return res
          .status(400)
          .json({
            error: "Document content is required to generate study notes.",
          });
      }

      // Sanitize is helpful for density and matching token limits safely
      const textToAnalyze = content
        .replace(/<[^>]*>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .substring(0, 18000);

      const notesPrompt = `You are a world-class academic researcher and expert note-taker. 
Your goal is to extract the most critical insights, facts, formulas, or structures from the source text and transform them into beautiful, comprehensive, highly-structured student/research study notes.

CRITICAL FORMATTING RULES FOR SCIENCE, MATH, PHYSICS & CHEMISTRY:
If the source text contains any formulas, equations, mathematical expressions, physics laws, or chemical structures/compounds (e.g., H2O, CO2, chemical reactions), you MUST format them using standard LaTeX/KaTeX notations.
- Use single dollar signs $...$ for inline math (e.g. $E = mc^2$ or $\\text{H}_2\\text{O}$ or $x^2 + y^2 = r^2$).
- Use double dollar signs $$\n...\n$$ for standalone/block equations.
- Do NOT use plain text, caret symbol (e.g. x^2), or sub/superscript elements where LaTeX can represent them.

Structure the notes neatly with bold main topics, numbered lists, and bullet points. Focus on:
1. Executive Summary: A quick overview of the document's main focus.
2. Core Findings & key concepts: Lucid explanations of claims, assertions, or data.
3. Key Takeaways & Supporting Details: Bullet points.

Make sure the response is in plain text Markdown and is dense with actual knowledge, highly readable, and professional.

Document Title: "${title || "Untitled Document"}"
Source Content Excerpt:
"""
${textToAnalyze}
"""`;

      console.log("[NOTES_API] Calling Mistral to generate study notes...");
      let generatedNotes = "";
      try {
        const client = getMistralClient();
        const completion = await client.chat.completions.create({
          model: "ministral-8b-latest",
          messages: [
            {
              role: "system",
              content:
                "You are a world-class academic researcher and expert note-taker who formats beautiful study notes in clean plain-text markdown. Do NOT wrap your response in ```markdown block. Output the markdown naturally.",
            },
            {
              role: "user",
              content: notesPrompt,
            },
          ],
          temperature: 0.3,
        });
        generatedNotes = completion.choices[0]?.message?.content || "";
        generatedNotes = generatedNotes
          .replace(/^```markdown\n?/gi, "")
          .replace(/\n?```$/gi, "");
      } catch (mistralErr: any) {
        console.warn(
          "[NOTES_API] Mistral failed, falling back to Gemini:",
          mistralErr.message || mistralErr,
        );
        try {
          const aiResponse = await ai.models.generateContent({
            model: "gemini-flash-latest",
            contents: notesPrompt,
          });
          generatedNotes = aiResponse.candidates?.[0]?.content?.parts?.[0]?.text || "";
        } catch (gemIniErr: any) {
          console.warn(
            "[NOTES_API] gemini-flash-latest failed, trying gemini-3.1-flash-lite:",
            gemIniErr.message || gemIniErr,
          );
          try {
            const aiResponse2 = await ai.models.generateContent({
              model: "gemini-3.1-flash-lite",
              contents: notesPrompt,
            });
            generatedNotes = aiResponse2.candidates?.[0]?.content?.parts?.[0]?.text || "";
          } catch (gemIniErr2: any) {
            console.warn(
              "[NOTES_API] gemini-3.1-flash-lite failed, trying gemini-flash-latest fallback:",
              gemIniErr2.message || gemIniErr2,
            );
            const aiResponse3 = await ai.models.generateContent({
              model: "gemini-flash-latest",
              contents: notesPrompt,
            });
            generatedNotes = aiResponse3.candidates?.[0]?.content?.parts?.[0]?.text || "";
          }
        }
      }

      if (!generatedNotes) {
        throw new Error("Received empty notes output from Gemini.");
      }

      return res.json({ notes: generatedNotes });
    } catch (e: any) {
      console.error("[NOTES_API] Error:", e);
      res
        .status(500)
        .json({
          error: e.message || "An exception occurred during notes composition.",
        });
    }
  });

  app.post("/api/voyage/embed", async (req, res) => {
    try {
      const { texts, model = "voyage-3" } = VoyageEmbedSchema.parse(req.body);
      if (!texts || !Array.isArray(texts) || texts.length === 0) {
        return res
          .status(400)
          .json({ error: "An array of 'texts' is required." });
      }

      const client = getVoyageClient();
      console.log(
        `[VOYAGE_API] Generating embeddings for ${texts.length} items using ${model}...`,
      );
      const result = await client.embed({
        input: texts,
        model: model,
      });

      return res.json({ success: true, embeddings: result.data });
    } catch (e: any) {
      console.error("[VOYAGE_API] Embedding error:", e);
      if (e.message?.includes("VOYAGE_API_KEY")) {
        return res.status(401).json({ error: e.message });
      }
      return res
        .status(500)
        .json({ error: "Failed to generate embeddings via Voyage AI." });
    }
  });

  app.post("/api/voyage/rerank", async (req, res) => {
    try {
      const { query, documents, topK = null, model = "rerank-2" } = VoyageRerankSchema.parse(req.body);
      if (
        !query ||
        !documents ||
        !Array.isArray(documents) ||
        documents.length === 0
      ) {
        return res
          .status(400)
          .json({ error: "'query' and 'documents' array are required." });
      }

      const client = getVoyageClient();
      console.log(
        `[VOYAGE_API] Reranking ${documents.length} documents for query: "${query}"...`,
      );

      const result = await client.rerank({
        query,
        documents: documents
          .map((d) => (typeof d === "string" ? d : JSON.stringify(d)))
          .slice(0, 50),
        model: model,
        topK: topK || undefined,
      });

      return res.json({ success: true, results: result.data });
    } catch (e: any) {
      console.error("[VOYAGE_API] Reranking error:", e);
      if (e.message?.includes("VOYAGE_API_KEY")) {
        return res.status(401).json({ error: e.message });
      }
      return res.status(500).json({ error: "Failed to rerank via Voyage AI." });
    }
  });

  // serve static UI assets and delegate routing
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
      console.log(
        `Research Draft & Outline Server running securely on http://localhost:${PORT}`,
      );
    });
  }
}

export const startPromise = startServer().catch((err) => {
  console.error("Error starting server:", err);
});
