// @ts-nocheck
import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import debateRouter from "./debate.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(debateRouter);

export default router;

