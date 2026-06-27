import OpenAI from "openai";
import { VoyageAIClient } from "voyageai";
import { GoogleGenAI } from "@google/genai";

let basetenClient: OpenAI | null = null;
let mistralClient: OpenAI | null = null;
let groqClient: OpenAI | null = null;
let cohereClient: OpenAI | null = null;
let upstageClient: OpenAI | null = null;
let rekaClient: OpenAI | null = null;
let inceptionClient: OpenAI | null = null;
let xiaomiClient: OpenAI | null = null;
let voyageClient: VoyageAIClient | null = null;
let aiInstance: GoogleGenAI | null = null;

export function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }
    aiInstance = new GoogleGenAI({
      apiKey,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    });
  }
  return aiInstance;
}

export function getVoyageClient(): VoyageAIClient {
  if (!voyageClient) {
    const apiKey = process.env.VOYAGE_API_KEY;
    if (!apiKey) throw new Error("VOYAGE_API_KEY is not configured.");
    voyageClient = new VoyageAIClient({ apiKey });
  }
  return voyageClient;
}

export function getBasetenClient(): OpenAI {
  if (!basetenClient) {
    const apiKey = process.env.BASETEN_API_KEY;
    if (!apiKey) throw new Error("BASETEN_API_KEY is not configured.");
    basetenClient = new OpenAI({ apiKey, baseURL: "https://inference.baseten.co/v1" });
  }
  return basetenClient;
}

export function getMistralClient(): OpenAI {
  if (!mistralClient) {
    const apiKey = process.env.MISTRAL_API_KEY;
    if (!apiKey) throw new Error("MISTRAL_API_KEY is not configured.");
    mistralClient = new OpenAI({ apiKey, baseURL: "https://api.mistral.ai/v1" });
  }
  return mistralClient;
}

export function getGroqClient(): OpenAI {
  if (!groqClient) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error("GROQ_API_KEY is not configured.");
    groqClient = new OpenAI({ apiKey, baseURL: "https://api.groq.com/openai/v1" });
  }
  return groqClient;
}

export function getCohereClient(): OpenAI {
  if (!cohereClient) {
    const apiKey = process.env.COHERE_API_KEY;
    if (!apiKey) throw new Error("COHERE_API_KEY is not configured.");
    cohereClient = new OpenAI({ apiKey, baseURL: "https://api.cohere.com/compatibility/v1" });
  }
  return cohereClient;
}

export function getUpstageClient(): OpenAI {
  if (!upstageClient) {
    const apiKey = process.env.UPSTAGE_API_KEY;
    if (!apiKey) throw new Error("UPSTAGE_API_KEY is not configured.");
    upstageClient = new OpenAI({ apiKey, baseURL: "https://api.upstage.ai/v1/solar" });
  }
  return upstageClient;
}

export function getRekaClient(): OpenAI {
  if (!rekaClient) {
    const apiKey = process.env.REKA_API_KEY;
    if (!apiKey) throw new Error("REKA_API_KEY is not configured.");
    rekaClient = new OpenAI({ apiKey, baseURL: "https://api.reka.ai/v1" });
  }
  return rekaClient;
}

export function getInceptionClient(): OpenAI {
  if (!inceptionClient) {
    const apiKey = process.env.INCEPTION_API_KEY;
    if (!apiKey) throw new Error("INCEPTION_API_KEY is not configured.");
    inceptionClient = new OpenAI({ apiKey, baseURL: "https://api.inceptionlabs.ai/v1" });
  }
  return inceptionClient;
}

export function getXiaomiClient(): OpenAI {
  if (!xiaomiClient) {
    const apiKey = process.env.XIAOMI_API_KEY;
    if (!apiKey) throw new Error("XIAOMI_API_KEY is not configured.");
    xiaomiClient = new OpenAI({ apiKey, baseURL: "https://api.xiaomimimo.com/v1" });
  }
  return xiaomiClient;
}
