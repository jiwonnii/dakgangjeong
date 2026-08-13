import type { NextRequest } from "next/server";
import { runExpressHandlers } from "@/src/lib/next-route";
import { listDogBreeds } from "@/src/modules/dogs/dog.controller";

export async function GET(request: NextRequest) {
  return runExpressHandlers(request, {}, [listDogBreeds]);
}
