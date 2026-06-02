/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

// Port must be 3000
const PORT = 3000;

let aiInstance: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GEMINI_API_KEY is not configured in the workspace secrets. Please set it in the Secrets panel."
      );
    }
    aiInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

const systemInstruction = `You are an AI Research Assistant. Your job is to help the user write, organize, and research their document.

You are given the current research context of the user workspace:
1. "Notes": Loose, raw ideas, citations fragments, or reference quotes.
2. "Citations": Formatted bibliography entries (APA, MLA, IEEE, Chicago) containing meta-attributes.
3. "Outline / Drafts": The current document state.

Please adapt your tone to the user. If they just want to chat casually, be conversational and friendly. If they want help structuring a rigorous academic document, be scholarly and professional. Do not force a long academic evaluation when the user simply says "hi" or "yo"; greet them back naturally. If they ask for help with their document, use the context to provide insightful recommendations, synthesis, or document edits.

Your responses must consist of:
1. Conversational feedback ("content").
2. An optional structured "suggestion" payload ("suggestion") if the user requests or if it would be helpful to:
   - "outline": Propose a structured set of sections (including title, subsections, focal points, draft text suggestions, and cited source IDs mapped from the user's citation collection).
   - "citations": Convert raw notes/citations snippets into clean, standard bibliography objects.
   - "draft_section": Suggest a focused paragraph of highly polished draft markdown text for a specific outline section.
   - "edit_document": Perform direct inline document edits updating title, adding a paper reference text, or removing a paper reference based on the user's explicit request.`;

const geminiResponseSchema = {
  type: Type.OBJECT,
  properties: {
    content: {
      type: Type.STRING,
      description: "The primary conversational guiding response from the AI mentor, explaining thoughts, methodologies, or advice."
    },
    suggestion: {
      type: Type.OBJECT,
      description: "Structured actions/items to automatically import into the user's workspace. Null if only responding in plain chat.",
      properties: {
        type: {
          type: Type.STRING,
          description: "Type of suggestion to insert/overwrite",
          enum: ["outline", "citations", "draft_section", "edit_document"]
        },
        title: {
          type: Type.STRING,
          description: "New title for the document if requested to change."
        },
        appendContent: {
          type: Type.STRING,
          description: "A drafted paragraph or content block to append to the end of the document.",
        },
        replaceContent: {
          type: Type.STRING,
          description: "Only use this to rewrite or completely replace the document contents if asked."
        },
        outline: {
          type: Type.ARRAY,
          description: "Use when creating or restructuring outline sections.",
          items: {
            type: Type.OBJECT,
            properties: {
              level: {
                type: Type.INTEGER,
                description: "Outline depth: 1 (Main Head), 2 (Subsection), 3 (Detail Section)"
              },
              title: {
                type: Type.STRING,
                description: "Title of section"
              },
              points: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Guiding bullet points or goals for this section"
              },
              draftContent: {
                type: Type.STRING,
                description: "Suggested draft copy for this section, incorporating matching citation handles"
              },
              linkedCitations: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "An array of IDs of the citations from context that are cited in this draftContent"
              }
            },
            required: ["level", "title", "points", "draftContent", "linkedCitations"]
          }
        },
        citations: {
          type: Type.ARRAY,
          description: "Use when extracting bibliography references or formatting existing source elements.",
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              authors: { type: Type.STRING },
              source: { type: Type.STRING, description: "Name of journal, book publication, website, or university press" },
              year: { type: Type.STRING },
              url: { type: Type.STRING },
              doi: { type: Type.STRING },
              format: { type: Type.STRING, enum: ["APA", "MLA", "Chicago", "IEEE"] },
              quoteSnippet: { type: Type.STRING, description: "Direct scholarly quotation snippet" }
            },
            required: ["title", "authors", "source", "year", "format"]
          }
        },
        draftMarkdown: {
          type: Type.STRING,
          description: "Suggested markdown text to draft or expand a target section."
        },
        targetSectionId: {
          type: Type.STRING,
          description: "Optional Section ID to link this draft content suggestion back to. Matches one of the Outlineitem IDs sent in context."
        }
      },
      required: ["type"]
    }
  },
  required: ["content"]
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

      // Add system instruction
      openaiMessages.unshift({
        role: "system",
        content: systemInstruction + `

IMPORTANT: You MUST return a valid JSON object. 

DIRECTIVE FOR ALL RESPONSES (CHAT & WRITING):
1. ALWAYS start your response by explaining your internal reasoning in the "thought" field.
2. ALWAYS return a valid JSON object.
3. For writing tasks (essays, reports):
   - ALWAYS use "suggestion.type": "edit_document"
   - ALWAYS provide the long-form text in "suggestion.replaceContent".
   - Keep "content" UNDER 20 words (a brief summary).
4. For general chat:
   - Provide your response in the "content" field.
   - Use "suggestion": null if no document edits are needed.

MATCH THIS JSON SCHEMA:
{
  "thought": "A detailed reasoning string explaining your logic and academic approach before writing",
  "content": "Conversational response string",
  "suggestion": {
     "type": "edit_document",
     "title": "optional new title",
     "replaceContent": "MARKDOWN STRING"
  }
}

NOTE: Use "replaceContent" if you are rewriting the entire document or creating a new structured layout with headings.`
      });
      
      const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.MISTRAL_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "mistral-medium-latest",
          messages: openaiMessages,
          response_format: { type: "json_object" },
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Mistral API Error: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      const text = data.choices[0].message.content;

      if (!text) {
        throw new Error("Empty response received from Mistral.");
      }

      const parsedResponse = JSON.parse(text);
      res.json(parsedResponse);
    } catch (error: any) {
      console.error("Mistral API Error:", error);
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
