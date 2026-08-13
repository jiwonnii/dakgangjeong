import { Router } from "express";
import { validateRequest } from "../../lib/validation";
import { requireAuth, requireVerifiedEmail } from "../../middleware/auth";
import {
  createDogProfile,
  getOnboardingDebugDb,
  getOnboardingOptions,
  getOnboardingStatus,
  joinDogProfile,
  upsertGuardianProfile
} from "./onboarding.controller";
import {
  createDogOnboardingSchema,
  guardianProfileSchema,
  joinDogByInviteCodeSchema
} from "./onboarding.schemas";

export const onboardingRouter = Router();

onboardingRouter.get("/options", getOnboardingOptions);
onboardingRouter.use(requireAuth);
onboardingRouter.get("/status", getOnboardingStatus);
onboardingRouter.get("/debug-db", getOnboardingDebugDb);
onboardingRouter.use(requireVerifiedEmail);
onboardingRouter.put(
  "/guardian-profile",
  validateRequest(guardianProfileSchema),
  upsertGuardianProfile
);
onboardingRouter.post(
  "/dogs",
  validateRequest(createDogOnboardingSchema),
  createDogProfile
);
onboardingRouter.post(
  "/join",
  validateRequest(joinDogByInviteCodeSchema),
  joinDogProfile
);
