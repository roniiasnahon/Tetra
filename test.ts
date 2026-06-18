import { GoogleGenAI, GenerateContentConfig } from "@google/genai";
const config: GenerateContentConfig = {
  thinkingConfig: {
    thinkingBudget: 1024
  }
}
console.log(config);
