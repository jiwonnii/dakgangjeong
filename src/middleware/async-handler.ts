import type { RequestHandler } from "express";

export function asyncHandler(handler: RequestHandler): RequestHandler {
  return (req, res, next) => {
    // Must return this promise, not just fire it: Next.js's route-handler
    // bridge (src/lib/next-route.ts's runExpressHandlers) awaits each
    // handler's return value and moves on to the next middleware once it
    // settles, assuming "resolved without calling next() yet" means the
    // handler is done. Real Express never inspects a middleware's return
    // value (this is a no-op there, safe for the old Express app too), but
    // without the `return` here the wrapper resolved on the same tick it
    // was called — before requireAuth's actual `await
    // supabase.auth.getUser()` had a chance to finish — so the bridge moved
    // on to requireVerifiedEmail before req.authUser was ever set. Confirmed
    // 2026-08-12: every authenticated Next.js route (recommendations
    // included) failed with AUTH_REQUIRED even with a valid token.
    return Promise.resolve(handler(req, res, next)).catch(next);
  };
}
