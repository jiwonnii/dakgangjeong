import { NextResponse, type NextRequest } from "next/server";
import type { RequestHandler } from "express";
import { ZodError } from "zod";
import { AppError } from "./app-error";

type RouteContext = {
  params?: Record<string, string | string[]>;
};

type MockRequest = {
  authUser?: unknown;
  body: unknown;
  headers: Record<string, string | undefined>;
  method: string;
  params: Record<string, string | string[]>;
  path: string;
  query: Record<string, string | string[]>;
};

type MockResponse = {
  status(code: number): MockResponse;
  json(payload: unknown): MockResponse;
};

function searchParamsToObject(searchParams: URLSearchParams) {
  const query: Record<string, string | string[]> = {};

  searchParams.forEach((value, key) => {
    const existing = query[key];

    if (existing === undefined) {
      query[key] = value;
      return;
    }

    query[key] = Array.isArray(existing) ? [...existing, value] : [existing, value];
  });

  return query;
}

async function parseBody(request: NextRequest) {
  if (request.method === "GET" || request.method === "HEAD") {
    return undefined;
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (!contentType.includes("application/json")) {
    return undefined;
  }

  return request.json().catch(() => undefined);
}

function errorToResponse(error: unknown) {
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

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid request data.",
          details: error.flatten()
        }
      },
      { status: 400 }
    );
  }

  const message = error instanceof Error ? error.message : "Unexpected server error.";

  return NextResponse.json(
    {
      error: {
        code: "INTERNAL_ERROR",
        message
      }
    },
    { status: 500 }
  );
}

export async function runExpressHandlers(
  request: NextRequest,
  context: RouteContext,
  handlers: RequestHandler[]
) {
  const url = new URL(request.url);
  let statusCode = 200;
  let responsePayload: unknown;
  let hasResponse = false;

  const req = {
    body: await parseBody(request),
    headers: {
      authorization: request.headers.get("authorization") ?? undefined
    },
    method: request.method,
    params: context.params ?? {},
    path: url.pathname,
    query: searchParamsToObject(url.searchParams)
  } as MockRequest;

  const res = {
    status(code: number) {
      statusCode = code;
      return res;
    },
    json(payload: unknown) {
      responsePayload = payload;
      hasResponse = true;
      return res;
    }
  } as MockResponse;

  try {
    for (const handler of handlers) {
      if (hasResponse) {
        break;
      }

      await new Promise<void>((resolve, reject) => {
        let nextCalled = false;
        const next = (error?: unknown) => {
          nextCalled = true;
          if (error) {
            reject(error);
            return;
          }

          resolve();
        };

        Promise.resolve(
          handler(req as never, res as never, next as never)
        )
          .then(() => {
            if (!nextCalled) {
              resolve();
            }
          })
          .catch(reject);
      });
    }

    return NextResponse.json(responsePayload ?? {}, { status: statusCode });
  } catch (error) {
    return errorToResponse(error);
  }
}
