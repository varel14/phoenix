import { Router } from "express";
import { videoController } from "../controllers/video.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { idParamsSchema } from "../validators/common.js";
import { listVideosQuerySchema, searchVideosQuerySchema } from "../validators/video.schema.js";

export const videoRouter = Router();

// Public catalog
videoRouter.get("/", validate({ query: listVideosQuerySchema }), videoController.list);
videoRouter.get("/search", validate({ query: searchVideosQuerySchema }), videoController.search);
videoRouter.get("/:id", validate({ params: idParamsSchema }), videoController.getById);

// Favorites (authenticated)
videoRouter.post("/:id/favorite", requireAuth, validate({ params: idParamsSchema }), videoController.favorite);
videoRouter.delete("/:id/favorite", requireAuth, validate({ params: idParamsSchema }), videoController.unfavorite);
