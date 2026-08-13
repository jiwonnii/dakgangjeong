import type { NextRequest } from "next/server";
import { runExpressHandlers } from "@/src/lib/next-route";
import { requireAuth } from "@/src/middleware/auth";
import { createDog, listDogs } from "@/src/modules/dogs/dog.controller";

export async function GET(request: NextRequest) {
  return runExpressHandlers(request, {}, [requireAuth, listDogs]);
}

export async function POST(request: NextRequest) {
  return runExpressHandlers(request, {}, [requireAuth, createDog]);
}
