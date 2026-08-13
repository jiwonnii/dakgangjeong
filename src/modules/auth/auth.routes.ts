import { Router } from "express";
import { validateRequest } from "../../lib/validation";
import { requireAuth } from "../../middleware/auth";
import {
  deleteAccount,
  getMe,
  resendVerificationEmail,
  signOut,
  signInWithEmail,
  signUpWithEmail,
  verifyEmailOtp
} from "./auth.controller";
import {
  loginSchema,
  resendVerificationSchema,
  signUpSchema,
  verifyEmailOtpSchema
} from "./auth.schemas";

export const authRouter = Router();

authRouter.post("/signup", validateRequest(signUpSchema), signUpWithEmail);
authRouter.post(
  "/verify-email",
  validateRequest(verifyEmailOtpSchema),
  verifyEmailOtp
);
authRouter.post("/login", validateRequest(loginSchema), signInWithEmail);
authRouter.post(
  "/resend-verification",
  validateRequest(resendVerificationSchema),
  resendVerificationEmail
);
authRouter.get("/me", requireAuth, getMe);
authRouter.post("/logout", requireAuth, signOut);
authRouter.delete("/account", requireAuth, deleteAccount);
