/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import multer from "multer";
import mammoth from "mammoth";
import PDFDocument from "pdfkit";
import axios from "axios";
import { parseStringPromise } from "xml2js";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

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
If the user asks to "find", "search", "lookup", "download", or "get sources/papers/research" about any topic:
1. Briefly state in <chat> that you are searching for real academic papers.
2. You MUST append a <searchRealPapers> XML element immediately after your </chat> element containing ONLY a single, short search query string. 
<searchRealPapers>machine learning</searchRealPapers>
Do NOT hallucinate or generate paper contents using <downloadPaper>. Only provide the query. The system will download 1 real PDF paper natively and display it.

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

async function startServer() {
  const app = express();

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

  // In-memory file registry
  const uploadedFiles = new Map<string, { buffer: Buffer, mimetype: string, originalname: string }>();

  // Safe upload route using standard multer middleware
  app.post("/api/upload", upload.single("file"), (req, res) => {
    console.log("[UPLOAD] Received request to /api/upload");
    try {
      if (!req.file) {
        console.warn("[UPLOAD] No file was found in req.file");
        return res.status(400).json({ success: false, error: "No file uploaded" });
      }
      
      console.log(`[UPLOAD] Processing file: ${req.file.originalname} (${req.file.mimetype}, ${req.file.size} bytes)`);
      
      const fileId = `file-${Date.now()}`;
      uploadedFiles.set(fileId, {
        buffer: req.file.buffer,
        mimetype: req.file.mimetype || "application/octet-stream",
        originalname: req.file.originalname,
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

  app.get("/api/files/:id", (req, res) => {
    const file = uploadedFiles.get(req.params.id);
    if (!file) {
      return res.status(404).send("File not found");
    }
    res.setHeader("Content-Type", file.mimetype);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(file.originalname)}"`);
    res.send(file.buffer);
  });

  app.get("/api/files/:id/raw-text", async (req, res) => {
    const file = uploadedFiles.get(req.params.id);
    if (!file) {
      return res.status(404).json({ success: false, error: "File not found" });
    }

    try {
      const extension = file.originalname.toLowerCase().split('.').pop();
      if (extension === "docx") {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        return res.json({ success: true, text: result.value });
      } else if (extension === "txt" || extension === "md" || extension === "html" || extension === "json") {
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
      const response = await axios.get(url, { 
        responseType: 'arraybuffer', 
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'application/pdf,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Referer': 'https://www.google.com/'
        } 
      });
      
      const contentType = response.headers['content-type'];
      if (typeof contentType === 'string' && !contentType.includes('application/pdf')) {
        throw new Error(`Expected PDF but got: ${contentType}`);
      }

      const fileId = `file-${Date.now()}`;
      uploadedFiles.set(fileId, {
        buffer: Buffer.from(response.data),
        mimetype: 'application/pdf',
        originalname: 'document.pdf'
      });
      res.json({ success: true, fileId });
    } catch (err: any) {
      console.error("[PDF Download] Error:", err);
      res.status(500).json({ success: false, error: err.message });
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

      const client = getMistralClient();
      const completion = await client.chat.completions.create({
        model: "mistral-small-latest",
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

      res.json({ synthesis: completion.choices[0].message.content });
    } catch (error: any) {
      console.error("Synthesis Error:", error);
      res.status(500).json({ error: "Failed to synthesize findings using the primary LLM." });
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
      }

      // Now we have docText and meta content, feed to gemini-3.5-flash for structured summarization
      const geminiPrompt = `You are a world-class academic research bot. Please read and analyze the following extracted text snippet from a research source/URL (${url}). 
Generated from source named: "${sourceMetaData.title || 'Unknown Source'}" by author/publisher: "${sourceMetaData.author || 'Unknown'}".

CONTENT STREAM:
"""
${docText}
"""

Please synthesize this content and create a highly detailed academic research summary.
Deliver your synthesis exactly according to the strict JSON schema provided.

The generated "summary" field should contain a complete, beautifully structured 3-Paragraph academic literature summary detailing:
Paragraph 1: Core Summary description and overall context of the website reference or document/theme.
Paragraph 2: Academic relevance & synthesis (empirical findings, methodology discussed, or theoretical arguments).
Paragraph 3: Practical incorporation value (how the researcher can use this resource to augment drafting on student-success/neuroplasticity/literature review topics).

Return EXACTLY a JSON output containing the structural properties: 'title', 'author', 'summary', and 'fileType'.
Keep the 'fileType' as either 'Note' or 'Document'.`;

      const aiResponse = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: geminiPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING, description: "A clean academic title refined from the webpage description." },
              author: { type: Type.STRING, description: "The author/organization or publisher domain name." },
              summary: { type: Type.STRING, description: "Highly comprehensive 3-paragraph literature summary with double newlines between paragraphs." },
              fileType: { type: Type.STRING, enum: ["Note", "Document"] }
            },
            required: ["title", "author", "summary", "fileType"]
          }
        }
      });

      const responseText = aiResponse.text;
      if (!responseText) {
        throw new Error("Empty response from AI summarization engine.");
      }

      const parsedJSON = JSON.parse(responseText.trim());
      const rawSummary = parsedJSON.summary || parsedJSON.description || "";
      const summaryCleaned = typeof rawSummary === 'string' ? rawSummary.replace(/\\n/g, '\n') : "";
      res.json({
        success: true,
        data: {
          title: parsedJSON.title || sourceMetaData.title,
          author: parsedJSON.author || sourceMetaData.author,
          description: summaryCleaned.substring(0, 100) + "...",
          summary: summaryCleaned, // store full text in summary property
          fileType: parsedJSON.fileType || "Note",
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
        return res.status(400).json({ error: "userQuery is required" });
      }

      try {
        const client = getMistralClient();
        const completion = await client.chat.completions.create({
          model: "mistral-small-latest",
          messages: [
            {
              role: "system",
              content: "You are an assistant that summarizes chat queries. Speak ONLY in a 2-4 word theme representing the query, without any surrounding punctuation or quotes."
            },
            {
              role: "user",
              content: `Summarize this chat query into a short 2-4 word theme: "${userQuery}"`
            }
          ],
          temperature: 0.5,
        });

        const title = completion.choices[0].message.content?.replace(/['"“”]/g, "").trim() || "Untitled Chat";
        res.json({ title });
      } catch (innerError: any) {
        console.error("Inner generate title LLM call failed, returning fallback", innerError);
        res.json({ title: userQuery.split(" ").slice(0, 3).join(" ") + "..." });
      }
    } catch (error: any) {
      console.error("Generate Title Error:", error);
      res.status(500).json({ error: "Failed to generate title." });
    }
  });

  // Research Chat & Academic Draft Optimizer Route
  app.post("/api/research/chat", async (req, res) => {
    try {
      const { messages, context } = req.body;

      if (!messages || !Array.isArray(messages)) {
        res.status(400).json({ error: "Invalid request payload. Messages are required." });
        return;
      }

      const lastMessage = messages[messages.length - 1]?.content || "";
      const isSearchRequest = /find|search|research|papers|articles|studies|scholar|source|lookup|download|internet|web|document/i.test(lastMessage) && lastMessage.length < 150;

      let researchContext = "";
      if (isSearchRequest) {
        console.log("Detecting search request, fetching papers...");
        try {
          const searchResponse = await fetch(`https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(lastMessage)}&limit=5&fields=title,authors,year,abstract,venue`);
          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            const papers = searchData.data || [];
            if (papers.length > 0) {
              researchContext = `
--- AUTOMATIC SCHOLAR SEARCH RESULTS ---
The user requested papers. I found these on Semantic Scholar:
${papers.map((p: any, i: number) => `[${i+1}] ${p.title} (${p.year}). Authors: ${p.authors?.map((a:any)=>a.name).join(', ')}. Abstract: ${p.abstract?.substring(0, 300)}...`).join('\n\n')}
-----------------------------------------
Please synthesize these results into your greeting and offer to cite them.
`;
            }
          }
        } catch (e) {
          console.error("Auto-search failed", e);
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
      }));

      // Inject current workspace context
      openaiMessages.unshift({
        role: "user",
        content: `Here is my current workspace state:\n${formattedContext}\nTreat this as background info. I am specifically asking you to help me with my document.`
      });

      // Mistral client API call
      const client = getMistralClient();
      const completion = await client.chat.completions.create({
        model: "mistral-small-latest",
        messages: [
          {
            role: "system",
            content: systemInstruction,
          },
          ...openaiMessages
        ],
        temperature: 0.7,
        stream: true
      });

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      for await (const chunk of completion) {
        const content = chunk.choices[0]?.delta?.content || "";
        if (content) {
          res.write(`data: ${JSON.stringify({ text: content })}\n\n`);
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
      if (!cleanQuery) cleanQuery = "machine learning";

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
        if (pdfLink) {
          try {
            // wait a little bit to respect rate limits
            await new Promise(resolve => setTimeout(resolve, 500));

            const attemptDownload = async (url: string) => {
              const headers: any = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/pdf,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://www.google.com/',
                'Cache-Control': 'no-cache',
                'Pragma': 'no-cache',
                'sec-ch-ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'Upgrade-Insecure-Requests': '1'
              };
              
              try {
                const domain = new URL(url).hostname;
                if (domain.includes('ajpmonline.org') || domain.includes('sciencedirect.com') || domain.includes('elsevier.com')) {
                   headers['Referer'] = `https://${domain}/`;
                   headers['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
                }
              } catch (e) {}

              return await fetchWithRetry(url, { 
                responseType: 'arraybuffer',
                headers: headers
              }, 1);
            };

            let pdfRes;
            try {
              pdfRes = await attemptDownload(pdfLink);
            } catch (pdfErr: any) {
              console.warn(`Primary download failed for ${title} from ${pdfLink}: ${pdfErr.message}. Trying fallbacks.`);
              
              // Try other locations if available
              const locations = entry.locations || [];
              for (const loc of locations) {
                if (loc.pdf_url && loc.pdf_url !== pdfLink) {
                  try {
                    await new Promise(resolve => setTimeout(resolve, 1000)); // Delay between fallback attempts
                    pdfRes = await attemptDownload(loc.pdf_url);
                    pdfLink = loc.pdf_url; // update link to the working one
                    break;
                  } catch (e) {
                    console.warn(`Fallback download failed for ${title} from ${loc.pdf_url}`);
                    continue;
                  }
                }
              }
            }

            if (pdfRes) {
              fileId = `semantic-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
              uploadedFiles.set(fileId, {
                buffer: Buffer.from(pdfRes.data),
                mimetype: 'application/pdf',
                originalname: `${title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`
              });
            } else {
              console.warn(`All PDF download attempts failed for ${title}. Creating elegant summary PDF fallback...`);
              try {
                const doc = new PDFDocument({ margin: 50 });
                const buffers: Buffer[] = [];
                doc.on('data', buffers.push.bind(buffers));
                
                // Header details
                doc.fontSize(22).font('Helvetica-Bold').fillColor('#0f172a').text(title, { align: 'center' });
                doc.moveDown(0.5);
                doc.fontSize(12).font('Helvetica-Oblique').fillColor('#475569').text(`${author || 'Unknown Author'} (${year || '2026'})`, { align: 'center' });
                doc.moveDown(2);
                
                // Warning / study guide alert info
                doc.fontSize(10).font('Helvetica-Bold').fillColor('#b45309').text('[STUDY NOTE: Original full-text PDF is protected by publisher access wall. Hand-crafted scholar outline generated successfully for interactive testing and annotation.]', { align: 'center' });
                doc.moveDown(1.5);

                // Abstract section
                if (abstract && abstract !== "No abstract available.") {
                  doc.fontSize(14).font('Helvetica-Bold').fillColor('#1e293b').text('Abstract');
                  doc.moveDown(0.5);
                  doc.fontSize(11).font('Helvetica').fillColor('#334155').text(abstract, { align: 'justify', lineGap: 3 });
                  doc.moveDown(1.5);
                }

                // Comprehensive synthesized background
                doc.fontSize(14).font('Helvetica-Bold').fillColor('#1e293b').text('Core Study Highlights & Background');
                doc.moveDown(0.5);
                const synthesizedOverview = `This academic paper, titled "${title}" published in ${year}, represents an essential contribution to the study field. Although the original publisher's distribution channel restricts automated server-side full PDF indexing (returning a security token check), the scholarly reference metadata has been preserved.

Key aspects analyzed in this work include:
1. Core Methodology: Examined datasets, experimental conditions, or historical literature reviews relevant to the subject.
2. Significant Conclusions: The authors present insights, observations, and structural findings highlighted in the research index.
3. Relevance: Critical context to establish standard academic comprehension, study planning, testing, and continuous annotation.

Please feel free to tag notes, reference external sources, or generate a comprehension test on the study elements above.`;
                doc.fontSize(11).font('Helvetica').fillColor('#334155').text(synthesizedOverview, { align: 'justify', lineGap: 3 });

                doc.end();

                const pdfData = await new Promise<Buffer>((resolve) => {
                  doc.on('end', () => {
                    resolve(Buffer.concat(buffers));
                  });
                });

                fileId = `semantic-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
                uploadedFiles.set(fileId, {
                  buffer: pdfData,
                  mimetype: 'application/pdf',
                  originalname: `${title.replace(/[^a-zA-Z0-9]/g, '_')}_Summary.pdf`
                });
              } catch (pdfGenErr) {
                console.error("Failed to generate fallback PDF:", pdfGenErr);
              }
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
          fileId
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
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        const fileId = `file-${Date.now()}`;
        uploadedFiles.set(fileId, {
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

        const result = JSON.parse(text.trim());
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

        const result = JSON.parse(text.trim());
        return res.json(result);
      }
    } catch (e: any) {
      console.error("[QUIZ_GEN_API] Error:", e);
      res.status(500).json({ error: e.message || "An exception occurred during quiz composition." });
    }
  });

  // Serve static UI assets and delegate routing
  if (process.env.NODE_ENV !== "production") {
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Research Draft & Outline Server running securely on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Error starting server:", err);
});
