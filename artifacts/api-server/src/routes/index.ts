import { Router, type IRouter } from "express";
import healthRouter from "./health";
import papersRouter from "./papers";
import collectionsRouter from "./collections";
import arxivRouter from "./arxiv";

const router: IRouter = Router();

router.use(healthRouter);
router.use(papersRouter);
router.use(collectionsRouter);
router.use(arxivRouter);

export default router;
