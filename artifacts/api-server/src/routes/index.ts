import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import authRouter from "./auth.js";
import phonesRouter from "./phones.js";
import boxVerifyRouter from "./box-verify.js";
import fusionVerifyRouter from "./fusion-verify.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/phones", phonesRouter);
router.use("/box-verify", boxVerifyRouter);
router.use("/fusion-verify", fusionVerifyRouter);

export default router;
