import { Router } from "express";
import { songController } from "../controllers/song.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { idParamsSchema } from "../validators/common.js";
import {
  listSongsQuerySchema,
  searchSongsQuerySchema,
} from "../validators/song.schema.js";

export const songRouter = Router();

// Public catalog
songRouter.get("/", validate({ query: listSongsQuerySchema }), songController.list);
songRouter.get("/search", validate({ query: searchSongsQuerySchema }), songController.search);
songRouter.get("/:id", validate({ params: idParamsSchema }), songController.getById);

// Favorites (authenticated)
songRouter.post("/:id/favorite", requireAuth, validate({ params: idParamsSchema }), songController.favorite);
songRouter.delete("/:id/favorite", requireAuth, validate({ params: idParamsSchema }), songController.unfavorite);
