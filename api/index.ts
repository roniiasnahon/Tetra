import { app, startPromise } from "../server.js";

export default async function handler(req: any, res: any) {
  try {
    // Ensure all directories and client initialization promises have completed
    await startPromise;
    return app(req, res);
  } catch (err: any) {
    console.error("Vercel Serverless Function Dispatch Error:", err);
    res.status(500).json({
      error: "Internal Server Error in Vercel Function Dispatch",
      message: err?.message || String(err),
      stack: err?.stack || "No stack trace available",
    });
  }
}
