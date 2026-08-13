import { Router } from "express";
import { requireAuth, requireVerifiedEmail } from "../../middleware/auth";
import { validateRequest } from "../../lib/validation";
import { getDurationOptions, getWarnings, recommendWalkRoutes } from "./walk-route.controller";
import {
  durationOptionsQuerySchema,
  recommendationRequestSchema,
  warningsQuerySchema
} from "./walk-route.schemas";

export const walkRouteRouter = Router();

walkRouteRouter.use(requireAuth);
walkRouteRouter.use(requireVerifiedEmail);

walkRouteRouter.get(
  "/duration-options",
  validateRequest(durationOptionsQuerySchema, "query"),
  getDurationOptions
);
walkRouteRouter.get("/warnings", validateRequest(warningsQuerySchema, "query"), getWarnings);
walkRouteRouter.post(
  "/recommendations",
  validateRequest(recommendationRequestSchema, "body"),
  recommendWalkRoutes
);
