import { GoogleGenAI } from "@google/genai";

async function test() {
  const ai = new GoogleGenAI({});
  const res = await ai.models.generateContent({
    model: "gemini-3.5-flash",
    contents: "Who won the last super bowl?",
    config: {
      tools: [{
        googleSearch: {}
      }]
    }
  });
  console.log(res.text);
}
test().catch(console.error);
