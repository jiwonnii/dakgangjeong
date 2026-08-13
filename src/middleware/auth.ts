import type { RequestHandler } from "express";
import type { User } from "@supabase/supabase-js";
import { AppError } from "../lib/app-error";
import { getSupabaseClient } from "../lib/supabase";
import { asyncHandler } from "./async-handler";

function isEmailVerified(user: User) {
  return Boolean(user.email_confirmed_at ?? user.confirmed_at);
}

export const requireAuth: RequestHandler = asyncHandler(async (req, _res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    throw new AppError("Bearer token is required.", 401, "AUTH_REQUIRED");
  }

  const token = authHeader.slice("Bearer ".length);
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user) {
    throw new AppError("Invalid or expired token.", 401, "AUTH_INVALID");
  }

  req.authUser = data.user;
  next();
});

export const requireVerifiedEmail: RequestHandler = (req, _res, next) => {
  if (!req.authUser) {
    next(new AppError("Authenticated user is required.", 401, "AUTH_REQUIRED"));
    return;
  }

  if (!isEmailVerified(req.authUser)) {
    next(
      new AppError(
        "Email verification is required before onboarding.",
        403,
        "EMAIL_NOT_VERIFIED"
      )
    );
    return;
  }

  next();
};
