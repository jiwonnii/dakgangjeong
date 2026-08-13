import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8).max(72)
});

export const signUpSchema = loginSchema
  .extend({
    confirmPassword: z.string().min(8).max(72)
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"]
  });

export const resendVerificationSchema = z.object({
  email: z.string().trim().email()
});

export const verifyEmailOtpSchema = z.object({
  email: z.string().trim().email(),
  token: z.string().trim().regex(/^\d{6}$/)
});
