import type { RequestHandler } from "express";
import { AppError } from "../../lib/app-error";
import { getSupabaseAdminClient } from "../../lib/supabase";
import {
  evaluateWarningsAndDuration,
  loadDogProfile,
  recommendWalkRoutes as runRecommendationPipeline
} from "./services/recommendation.service";
import type {
  durationOptionsQuerySchema,
  recommendationRequestSchema,
  warningsQuerySchema
} from "./walk-route.schemas";
import type { z } from "zod";

function getAuthUserId(req: Parameters<RequestHandler>[0]) {
  if (!req.authUser?.id) {
    throw new AppError("Authenticated user is required.", 401, "AUTH_REQUIRED");
  }

  return req.authUser.id;
}

/**
 * Every endpoint in this controller reads a specific dog's data, so each
 * one must confirm the authenticated user is actually a guardian of that
 * dog before proceeding — using supabaseAdmin (service role) bypasses RLS
 * entirely, so this check is the only thing standing between "any logged
 * in user" and "any dog's recommendation data" without it.
 */
async function assertDogGuardian(dogId: string, userId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("dog_guardians")
    .select("role")
    .eq("dog_id", dogId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new AppError(error.message, 500, "DOG_GUARDIAN_LOOKUP_FAILED");
  }

  if (!data) {
    throw new AppError(
      "You are not a guardian of this dog.",
      403,
      "DOG_GUARDIAN_REQUIRED"
    );
  }
}

export const getDurationOptions: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    const { dogId, lat, lon } = req.query as unknown as z.infer<typeof durationOptionsQuerySchema>;

    await assertDogGuardian(dogId, userId);

    const now = new Date();
    const profile = await loadDogProfile(dogId, now);
    const { durationOptions } = await evaluateWarningsAndDuration(profile, { lat, lon }, now);

    res.json({ durationOptions });
  } catch (error) {
    next(error);
  }
};

export const getWarnings: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    const { dogId, lat, lon } = req.query as unknown as z.infer<typeof warningsQuerySchema>;

    await assertDogGuardian(dogId, userId);

    const now = new Date();
    const profile = await loadDogProfile(dogId, now);
    const { warningEvaluation } = await evaluateWarningsAndDuration(profile, { lat, lon }, now);

    res.json({
      overallLevel: warningEvaluation.overallLevel,
      warnings: warningEvaluation.warnings
    });
  } catch (error) {
    next(error);
  }
};

export const recommendWalkRoutes: RequestHandler = async (req, res, next) => {
  try {
    const userId = getAuthUserId(req);
    const body = req.body as z.infer<typeof recommendationRequestSchema>;

    await assertDogGuardian(body.dogId, userId);

    const result = await runRecommendationPipeline({
      dogId: body.dogId,
      origin: body.origin,
      durationChoice: body.durationChoice,
      customMinutes: body.customMinutes,
      refresh: body.refresh
    });

    if (result.status === "ok") {
      res.json(result);
      return;
    }

    // Coverage/generation/filtering "nothing to recommend" outcomes are not
    // server errors — 200 with a status field the client can branch on.
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};
