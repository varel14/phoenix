import { Router } from "express";
import { artistController } from "../controllers/artist.controller.js";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { idParamsSchema, paginationSchema } from "../validators/common.js";
import {
  artistSongParamsSchema,
  artistVideoParamsSchema,
  createArtistBodySchema,
  listArtistsQuerySchema,
  updateArtistBodySchema,
} from "../validators/artist.schema.js";
import { createSongBodySchema, updateSongBodySchema } from "../validators/song.schema.js";
import { createVideoBodySchema, updateVideoBodySchema } from "../validators/video.schema.js";

export const artistRouter = Router();

// Public catalog
artistRouter.get("/", validate({ query: listArtistsQuerySchema }), artistController.list);

// Authenticated area — declared BEFORE /:id routes so "me" is not swallowed
artistRouter.get("/me", requireAuth, artistController.getMe);
artistRouter.get("/following/list", requireAuth, validate({ query: paginationSchema }), artistController.listFollowing);
artistRouter.post("/", requireAuth, validate({ body: createArtistBodySchema }), artistController.create);
artistRouter.patch("/:id", requireAuth, requireRole("ARTIST"), validate({ params: idParamsSchema, body: updateArtistBodySchema }), artistController.update);

// Content management (role + ownership enforced)
artistRouter.post(
  "/:id/songs",
  requireAuth,
  requireRole("ARTIST"),
  validate({ params: idParamsSchema, body: createSongBodySchema }),
  artistController.publishSong,
);
artistRouter.patch(
  "/:id/songs/:songId",
  requireAuth,
  requireRole("ARTIST"),
  validate({ params: artistSongParamsSchema, body: updateSongBodySchema }),
  artistController.updateSong,
);
artistRouter.delete(
  "/:id/songs/:songId",
  requireAuth,
  requireRole("ARTIST"),
  validate({ params: artistSongParamsSchema }),
  artistController.removeSong,
);

artistRouter.post(
  "/:id/videos",
  requireAuth,
  requireRole("ARTIST"),
  validate({ params: idParamsSchema, body: createVideoBodySchema }),
  artistController.publishVideo,
);
artistRouter.patch(
  "/:id/videos/:videoId",
  requireAuth,
  requireRole("ARTIST"),
  validate({ params: artistVideoParamsSchema, body: updateVideoBodySchema }),
  artistController.updateVideo,
);
artistRouter.delete(
  "/:id/videos/:videoId",
  requireAuth,
  requireRole("ARTIST"),
  validate({ params: artistVideoParamsSchema }),
  artistController.removeVideo,
);

// Follows
artistRouter.post("/:id/follow", requireAuth, validate({ params: idParamsSchema }), artistController.follow);
artistRouter.delete("/:id/follow", requireAuth, validate({ params: idParamsSchema }), artistController.unfollow);

// Public catalog subroutes (after /me to avoid shadowing)
artistRouter.get("/:id", optionalAuth, validate({ params: idParamsSchema }), artistController.getById);
artistRouter.get("/:id/songs", validate({ params: idParamsSchema, query: paginationSchema }), artistController.listSongs);
artistRouter.get("/:id/videos", validate({ params: idParamsSchema, query: paginationSchema }), artistController.listVideos);

// Stats (owner only)
artistRouter.get("/:id/stats", requireAuth, requireRole("ARTIST"), validate({ params: idParamsSchema }), artistController.stats);
