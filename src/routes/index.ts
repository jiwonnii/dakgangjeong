import { Router } from "express";
import { authRouter } from "../modules/auth/auth.routes";
import { careRouter } from "../modules/care/care.routes";
import { dogRouter } from "../modules/dogs/dog.routes";
import { devRouter } from "../modules/dev/dev.routes";
import { onboardingRouter } from "../modules/onboarding/onboarding.routes";
import { walkRecordRouter } from "../modules/walkRecords/walk-record.routes";
import { walkRouteRouter } from "../modules/walkRoutes/walk-route.routes";
import { env } from "../config/env";

export const apiRouter = Router();

apiRouter.get("/", (_req, res) => {
  res.json({
    service: "meoksa-api",
    modules: ["auth", "onboarding", "dogs", "walk-routes", "walk-records", "care"]
  });
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/onboarding", onboardingRouter);
apiRouter.use("/dogs", dogRouter);
apiRouter.use("/walk-routes", walkRouteRouter);
apiRouter.use("/walk-records", walkRecordRouter);
apiRouter.use("/care", careRouter);

// Dev-only demo session minting for public/index.html — never in production.
if (env.NODE_ENV !== "production") {
  apiRouter.use("/dev", devRouter);
}
