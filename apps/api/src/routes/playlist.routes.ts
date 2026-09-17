import { Router } from "express";
import { z } from "zod";
import { playlistController } from "../controllers/playlist.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { idParamsSchema, paginationSchema } from "../validators/common.js";
import {
  addPlaylistItemBodySchema,
  createPlaylistBodySchema,
  listPlaylistsQuerySchema,
  updatePlaylistBodySchema,
} from "../validators/playlist.schema.js";

export const playlistRouter = Router();

// All playlist routes require authentication (playlists are user-owned)
playlistRouter.use(requireAuth);

playlistRouter.get("/", validate({ query: listPlaylistsQuerySchema }), playlistController.list);
playlistRouter.post("/", validate({ body: createPlaylistBodySchema }), playlistController.create);
playlistRouter.get("/:id", validate({ params: idParamsSchema }), playlistController.getById);
playlistRouter.patch("/:id", validate({ params: idParamsSchema, body: updatePlaylistBodySchema }), playlistController.update);
playlistRouter.delete("/:id", validate({ params: idParamsSchema }), playlistController.remove);

playlistRouter.get("/:id/items", validate({ params: idParamsSchema, query: paginationSchema }), playlistController.listItems);
playlistRouter.post("/:id/items", validate({ params: idParamsSchema, body: addPlaylistItemBodySchema }), playlistController.addItem);
playlistRouter.delete(
  "/:id/items/:itemId",
  validate({ params: z.object({ id: idParamsSchema.shape.id, itemId: idParamsSchema.shape.id }) }),
  playlistController.removeItem,
);
