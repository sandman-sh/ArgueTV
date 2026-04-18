// @ts-nocheck
import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "../../../../packages/api-zod/src/generated/api.js";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;

