import { app, startPromise } from "../server.js";

export default async function handler(req: any, res: any) {
  // Wait for routes & directories configuration to resolve
  await startPromise;
  return app(req, res);
}
