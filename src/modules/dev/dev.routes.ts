/**
 * Dev-only demo helper — NOT part of the real product API. Mints a real
 * Supabase session for a fixed demo user/dog so `public/demo.html` (a
 * rough map demo for seeing real recommendations end-to-end) can call the
 * real, authenticated `POST /api/walk-routes/recommendations` without a
 * login UI. Disabled outside development (see the NODE_ENV guard in
 * routes/index.ts) — this endpoint hands out a valid access token for a
 * fixed account with no credential check, which must never exist in a
 * deployed environment.
 *
 * Reuses the exact magic-link-mint-and-follow flow this project already
 * verified working manually during the 2026-08-10 live smoke test:
 * `supabase.auth.admin.generateLink` + a manual-redirect GET on the
 * returned `action_link`, parsing `access_token` out of the redirect's URL
 * fragment. Directly POSTing to `/auth/v1/verify` was tried first and
 * returned `otp_expired`/`validation_failed` — only the GET-the-real-link
 * approach actually works.
 */

import { Router } from "express";
import { asyncHandler } from "../../middleware/async-handler";
import { getSupabaseAdminClient } from "../../lib/supabase";
import { env } from "../../config/env";
import { AppError } from "../../lib/app-error";

export const devRouter = Router();

const DEMO_EMAIL = "jenjen05@naver.com";
const DEMO_DOG_INVITE_CODE = "SMOKE01";

devRouter.get(
  "/demo-session",
  asyncHandler(async (_req, res) => {
    const supabase = getSupabaseAdminClient();

    const { data: dogRow, error: dogError } = await supabase
      .from("dogs")
      .select("id")
      .eq("invite_code", DEMO_DOG_INVITE_CODE)
      .maybeSingle();

    if (dogError || !dogRow) {
      throw new AppError(
        "Demo dog not found. Create one with invite_code='SMOKE01' first.",
        500,
        "DEMO_DOG_MISSING"
      );
    }

    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: DEMO_EMAIL
    });

    if (linkError || !linkData) {
      throw new AppError(
        `Failed to generate demo session link: ${linkError?.message}`,
        502,
        "DEMO_SESSION_LINK_FAILED"
      );
    }

    const actionLink = linkData.properties?.action_link;

    if (!actionLink) {
      throw new AppError("generateLink returned no action_link.", 502, "DEMO_SESSION_LINK_MISSING");
    }

    const verifyResponse = await fetch(actionLink, { redirect: "manual" });
    const location = verifyResponse.headers.get("location");
    const accessToken = location ? new URLSearchParams(location.split("#")[1]).get("access_token") : null;

    if (!accessToken) {
      throw new AppError("Could not extract access_token from demo session link.", 502, "DEMO_SESSION_TOKEN_MISSING");
    }

    res.json({ accessToken, dogId: dogRow.id, email: DEMO_EMAIL });
  })
);
