import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";
import { healthRouter } from "./routes/health.js";
import { apiRouter } from "./routes/index.js";
export function createApp() {
    const app = express();
    const corsOrigin = env.CORS_ORIGIN === "*"
        ? true
        : env.CORS_ORIGIN.split(",")
            .map((origin) => origin.trim())
            .filter(Boolean);
    app.use(cors({
        origin: corsOrigin,
        credentials: true
    }));
    app.use(express.json());
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
