import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({
    service: "meoksa-api",
    modules: ["auth", "onboarding", "dogs", "walk-routes", "walk-records", "care"]
  });
}
