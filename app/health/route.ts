import { NextResponse } from "next/server";
import { hasSupabaseConfig } from "@/src/lib/supabase";

export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "meoksa-backend",
    supabase: hasSupabaseConfig ? "configured" : "missing-config",
    timestamp: new Date().toISOString()
  });
}
