/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

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
- **Smart Editor**: Only provide a 'suggestion' payload if the user specifically asks for writing/editing, OR if their input clearly implies a need for document improvement. If the user is just saying "hi," "hello," or chatting casually, DO NOT include a 'suggestion' object.
- **Academic Excellence**: When you do write, never sacrifice quality. Provide multi-paragraph, detailed, and highly polished content.
- **Mentor Approach**: Explain *why* you are making certain changes or suggestions to help the user learn.

Your responses must consist of:
1. Internal reasoning ("thought").
2. Conversational feedback ("content").
3. A structured "suggestion" payload ("suggestion") ONLY when relevant to document creation or editing.
   - "edit_document": Provide the complete content in suggestion.replaceContent (ALWAYS start with a high-quality H1 title).
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

  // Research Chat & Academic Draft Optimizer Route
  app.post("/api/research/chat", async (req, res) => {
    try {
      const { messages, context } = req.body;

      if (!messages || !Array.isArray(messages)) {
        res.status(400).json({ error: "Invalid request payload. Messages are required." });
        return;
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
            content: systemInstruction + `
IMPORTANT: You MUST return a valid JSON object matching the following structure:
{
  "thought": "Internal reasoning (planning for excellence and student success!)",
  "content": "Warm, encouraging conversational response (mentor-style)",
  "suggestion": {
     "type": "edit_document",
     "title": "New title (updates the Title field)",
     "replaceContent": "LONG-FORM content for the body (DO NOT repeat the title as an H1 here)",
     "citations": []
  }
}
If the user is just greeting you or chatting without asking for changes, OMIT the "suggestion" field entirely. ALWAYS stay strictly in character as a supportive success coach!`
          },
          ...openaiMessages
        ],
        temperature: 0.7,
        response_format: { type: "json_object" }
      });

      const text = completion.choices[0].message.content;

      if (!text) {
        throw new Error("Empty response received from Baseten GPT 120B.");
      }

      const parsedResponse = JSON.parse(text);
      res.json(parsedResponse);
    } catch (error: any) {
      console.error("Research API Error:", error);
      res.status(500).json({
        error: error.message || "An internal error occurred during processing."
      });
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
