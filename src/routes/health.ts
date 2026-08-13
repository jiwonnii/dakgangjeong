import { Router } from "express";
import { hasSupabaseConfig } from "../lib/supabase";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "meoksa-backend",
    supabase: hasSupabaseConfig ? "configured" : "missing-config",
    timestamp: new Date().toISOString()
  });
});
