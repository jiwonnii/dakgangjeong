import cors from "cors";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { healthRouter } from "./routes/health";
import { apiRouter } from "./routes/index";

export function createApp() {
  const app = express();
  const corsOrigin =
    env.CORS_ORIGIN === "*"
      ? true
      : env.CORS_ORIGIN.split(",")
          .map((origin) => origin.trim())
          .filter(Boolean);

  app.use(
    cors({
      origin: corsOrigin,
      credentials: true
    })
  );
  app.use(express.json());

  // Rough demo page (public/demo.html, visit /demo.html) — served from this
  // same origin so it can call /api/* without any CORS configuration.
  // Deliberately not named index.html / served at "/" — that path already
  // serves the JSON service-info route below and this shouldn't shadow it.
  // Not the product UI — that is the Next.js app in app/ (see README).
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  app.use(express.static(path.join(__dirname, "..", "public")));

  app.get("/", (_req, res) => {
    res.json({
      service: "meoksa-backend",
      version: "0.1.0",
      docs: "/api"
    });
  });

  app.use("/health", healthRouter);
  app.use("/api", apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
