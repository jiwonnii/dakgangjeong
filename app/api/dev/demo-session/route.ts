import { NextResponse } from "next/server";
import { env } from "@/src/config/env";
import { AppError } from "@/src/lib/app-error";
import { getSupabaseAdminClient } from "@/src/lib/supabase";

const DEMO_EMAIL = "jenjen05@naver.com";
const DEMO_DOG_INVITE_CODE = "SMOKE01";

function errorResponse(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        error: {
          code: error.code,
          message: error.message,
          details: error.details
        }
      },
      { status: error.statusCode }
    );
  }

  return NextResponse.json(
    {
      error: {
        code: "DEMO_SESSION_FAILED",
        message: error instanceof Error ? error.message : "Failed to create demo session."
      }
    },
    { status: 500 }
  );
}

export async function GET() {
  if (env.NODE_ENV === "production") {
    return NextResponse.json(
      {
        error: {
          code: "NOT_FOUND",
          message: "Route not found."
        }
      },
      { status: 404 }
    );
  }

  try {
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

    return NextResponse.json({ accessToken, dogId: dogRow.id, email: DEMO_EMAIL });
  } catch (error) {
    return errorResponse(error);
  }
}
