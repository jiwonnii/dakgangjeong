import type { RequestHandler } from "express";
import type { ZodSchema } from "zod";
import { AppError } from "./app-error";

type RequestPart = "body" | "params" | "query";

export function validateRequest(
  schema: ZodSchema,
  part: RequestPart = "body"
): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req[part]);

    if (!result.success) {
      next(
        new AppError(
          "Invalid request data.",
          400,
          "VALIDATION_ERROR",
          result.error.flatten()
        )
      );
      return;
    }

    if (part === "query") {
      // Express 5 turned `req.query` into a getter derived from the raw URL
      // (no longer a plain writable property), so a direct `req.query = ...`
      // throws "Cannot set property query of #<IncomingMessage> which has
      // only a getter" — this line was never exercised until 2026-08-10
      // (neither GET /duration-options nor GET /warnings had been called
      // with real query params before). Overriding the property descriptor
      // is the standard workaround for validated/coerced query values under
      // Express 5.
      Object.defineProperty(req, "query", {
        value: result.data,
        writable: true,
        configurable: true
      });
    } else {
      req[part] = result.data;
    }

    next();
  };
}
