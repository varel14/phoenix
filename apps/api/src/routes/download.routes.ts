import { Router } from "express";
import { downloadController } from "../controllers/download.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { idParamsSchema } from "../validators/common.js";
import { createDownloadBodySchema, listDownloadsQuerySchema } from "../validators/download.schema.js";

export const downloadRouter = Router();

downloadRouter.use(requireAuth);

downloadRouter.get("/", validate({ query: listDownloadsQuerySchema }), downloadController.list);
downloadRouter.post("/", validate({ body: createDownloadBodySchema }), downloadController.create);
downloadRouter.delete("/:id", validate({ params: idParamsSchema }), downloadController.remove);
