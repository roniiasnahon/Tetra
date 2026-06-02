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

const systemInstruction = `You are an elite, supportive Academic Research Mentor & Outline Draft Optimizer.
Your job is to assist the user in framing academic outlines, organizing citation databases, and expanding loose drafting notes into high-quality scholarly paragraphs.

You are given the current research context of the user workspace:
1. "Notes": Loose, raw ideas, citations fragments, or reference quotes.
2. "Citations": Formatted bibliography entries (APA, MLA, IEEE, Chicago) containing meta-attributes.
3. "Outline / Drafts": The current tree of hierarchical items containing heading levels, points, draft paragraphs, and links to source citation IDs.

Your responses must consist of:
1. Conversational academic feedback ("content"), guiding the user through logical structure, source synthesis, literature reviews, or thesis formatting.
2. An optional structured "suggestion" payload ("suggestion") if the user requests or if it would be helpful to:
   - "outline": Propose a structured set of sections (including title, subsections, focal points, draft text suggestions, and cited source IDs mapped from the user's citation collection).
   - "citations": Convert raw notes/citations snippets into clean, standard bibliography objects.
   - "draft_section": Suggest a focused paragraph of highly polished draft markdown text for a specific outline section.
   - "edit_document": Perform direct inline document edits upating title, adding a paper reference text, or removing a paper reference based on the user's explicit request.

Always match the academic standards: citations should be properly integrated into paragraphs (e.g. MLA "[Author, Page]" or APA "[Author, Year]" style or standard numerical labels if requested), research outlines should flow logically, and content should remain intellectual, rigorous, and clear.`;

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

      const client = getGeminiClient();

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

CURRENT STRUCTURAL OUTLINE:
${JSON.stringify(userOutlineList, null, 2)}
-------------------------------
`;

      const contents = messages.map((m: any) => ({
        role: m.role,
        parts: [{ text: m.content }]
      }));

      // Inject current workspace context as structural context
      contents.unshift({
        role: "user",
        parts: [{ text: `Here is my current workspace state:\n${formattedContext}\nTreat this as background info and help me with my next steps.` }]
      });
      contents.push({
        role: "user",
        parts: [{ text: "Apply our strict academic guidelines, and output a valid JSON response including 'content' and optional 'suggestion' matching the response schema." }]
      });

      const response = await client.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          responseMimeType: "application/json",
          responseSchema: geminiResponseSchema,
          temperature: 0.2, // Keep it focused and deterministic for academic outputs
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error("Empty response received from Gemini.");
      }

      const parsedResponse = JSON.parse(text);
      res.json(parsedResponse);
    } catch (error: any) {
      console.error("Gemini API Error:", error);
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
