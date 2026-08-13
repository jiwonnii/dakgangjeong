import { Router } from "express";
import { z } from "zod";
import { validateRequest } from "../../lib/validation.js";
import { requireAuth } from "../../middleware/auth.js";
import { deleteAccount, getMe, resendVerificationEmail, signOut, signInWithEmail, signUpWithEmail, verifyEmailOtp } from "./auth.controller.js";
export const authRouter = Router();
const loginSchema = z.object({
    email: z.string().trim().email(),
    password: z.string().min(8).max(72)
});
const signUpSchema = loginSchema
    .extend({
    confirmPassword: z.string().min(8).max(72)
})
    .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"]
});
const resendVerificationSchema = z.object({
    email: z.string().trim().email()
});
const verifyEmailOtpSchema = z.object({
    email: z.string().trim().email(),
    token: z.string().trim().regex(/^\d{6}$/)
});
authRouter.post("/signup", validateRequest(signUpSchema), signUpWithEmail);
authRouter.post("/verify-email", validateRequest(verifyEmailOtpSchema), verifyEmailOtp);
authRouter.post("/login", validateRequest(loginSchema), signInWithEmail);
authRouter.post("/resend-verification", validateRequest(resendVerificationSchema), resendVerificationEmail);
authRouter.get("/me", requireAuth, getMe);
authRouter.post("/logout", requireAuth, signOut);
authRouter.delete("/account", requireAuth, deleteAccount);
