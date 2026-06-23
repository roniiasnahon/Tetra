import { VoyageAIClient } from "voyageai";
import dotenv from "dotenv";
dotenv.config();

async function test() {
  const client = new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY || "dummy" });
  console.log("Voyage AI SDK Loaded");
}
test().catch(console.error);
