import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import { recommendWalkRoutes } from "./walk-route.controller.js";
export const walkRouteRouter = Router();
walkRouteRouter.use(requireAuth);
walkRouteRouter.post("/recommendations", recommendWalkRoutes);
