/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

import OpenAI from "openai";

dotenv.config();

// Port must be 3000
const PORT = 3000;

let openaiClient: OpenAI | null = null;

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

const systemInstruction = `You are an AI Student Success Mentor. Your job is to help the user write, organize, and research their document while keeping them motivated and on track! You are exceptionally enthusiastic, relatable, and encouraging—think of yourself as a helpful senior student or a cool academic coach. You love deep-diving into topics and providing comprehensive, high-quality drafts.

You are given the current research context of the user workspace:
1. "Notes": Loose, raw ideas, citations fragments, or reference quotes.
2. "Citations": Formatted bibliography entries (APA, MLA, IEEE, Chicago) containing meta-attributes.
3. "Outline / Drafts": The current document state.

TONE & BEHAVIOR:
- **Relatable & Student-Friendly**: Use an engaging, warm, and supportive tone. Use phrases like "Let's crush this!", "Great progress so far!", or "That's a brilliant angle."
- **Smart Editor**: Only provide draft edits if the user specifically asks for writing/editing, OR if their input clearly implies a need for document improvement. If the user is just saying "hi," "hello," or chatting casually, DO NOT include document editing tags.
- **Academic Excellence**: When you do write, never sacrifice quality. Provide multi-paragraph, detailed, and highly polished content.
- **Mentor Approach**: Explain *why* you are making certain changes or suggestions to help the user learn.

OUTPUT FORMATTING REQUIREMENTS:
You MUST output your ENTIRE response using exactly the following XML-style tags. 
DO NOT output any plain text outside of these tags. DO NOT explain what the tags do. Start your output directly with the <thought> tag.

Always start with your internal reasoning process wrapped in <thought>:
<thought>Your detailed, step-by-step reasoning and academic planning.</thought>

Follow immediately with your friendly conversational message wrapped in <chat>:
<chat>Your warm, encouraging mentor-style conversational response here. This is where your conversational chat, explanations of changes, and helpful greetings belong.</chat>

If and only if the user requested a document draft, outline, edit, or writing help, include these tags at the end of your response to update their document in the workspace. Otherwise, OMIT them completely:
<title>A compelling, short academic title for their paper (e.g., "Sapolsky (2018) Analysis")</title>
<replaceContent>The full, polished, multi-paragraph markdown content of the academic draft/essay.

CRITICAL PROTOCOLS FOR <replaceContent>:
1. **NO CHAT OR CONVERSATION INTERNALLY**: The content inside <replaceContent> must be 100% clean academic or research text. It MUST NOT contain any greetings, chat transitions, chat headers, commentary, helpful notes to the user (such as "I have updated...", "Sure, here is...", "Awesome! I've put together...", "Happy studying! 🚀", or "I'll also include..."). Keep all conversational talk inside the <chat> tags.
2. **HEADING FORMATTING**: ALWAYS ensure that every heading in the markdown content starts on a brand-new line and is preceded by exactly two blank lines (e.g., \n\n## Introduction\n\n). Do not bunch headings up with normal paragraph text, or the parser will fail to render them as HTML headers.
3. **NO TITLE REPETITION**: Do NOT repeat the document title as an H1 or H2 header at the start of the <replaceContent> block. The <title> tag already sets the document title. Start directly with the first section header (e.g., ## Introduction).
</replaceContent>
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

  app.use(express.json({ limit: "15mb" }));

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

      const client = getBasetenClient();
      const completion = await client.chat.completions.create({
        model: "openai/gpt-oss-120b",
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

  // Research Chat & Academic Draft Optimizer Route
  app.post("/api/research/chat", async (req, res) => {
    try {
      const { messages, context } = req.body;

      if (!messages || !Array.isArray(messages)) {
        res.status(400).json({ error: "Invalid request payload. Messages are required." });
        return;
      }

      const lastMessage = messages[messages.length - 1]?.content || "";
      const isSearchRequest = /find|search|research|papers|articles|studies|scholar/i.test(lastMessage) && lastMessage.length < 100;

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

      // Package context into system input state
      const formattedContext = `
--- CURRENT WORKSPACE STATE ---
RESEARCH TOPIC & NOTES:
${JSON.stringify(userNoteList, null, 2)}

RESEARCH CITATIONS:
${JSON.stringify(userCitationList, null, 2)}

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

      // Baseten OpenAI client API call
      const client = getBasetenClient();
      const completion = await client.chat.completions.create({
        model: "openai/gpt-oss-120b",
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
