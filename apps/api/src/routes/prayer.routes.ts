import { Router } from "express";
import { prayerController, prayerCategoryController, sermonController } from "../controllers/prayer.controller.js";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { idParamsSchema } from "../validators/common.js";
import {
  createPrayerBodySchema,
  listPrayerFavoritesQuerySchema,
  listPrayersQuerySchema,
  updatePrayerBodySchema,
} from "../validators/prayer.schema.js";
import { listSermonsQuerySchema } from "../validators/sermon.schema.js";

export const prayerRouter = Router();

// Public feed/detail: optionalAuth personalizes favorites visibility.
prayerRouter.get("/", optionalAuth, validate({ query: listPrayersQuerySchema }), prayerController.list);
// Authenticated-only routes must be registered before GET /:id.
prayerRouter.get("/favorites", requireAuth, validate({ query: listPrayerFavoritesQuerySchema }), prayerController.listFavorites);
prayerRouter.get(
  "/:id",
  optionalAuth,
  validate({ params: idParamsSchema }),
  prayerController.detail,
);

prayerRouter.post("/", requireAuth, validate({ body: createPrayerBodySchema }), prayerController.create);
prayerRouter.patch("/:id", requireAuth, validate({ params: idParamsSchema, body: updatePrayerBodySchema }), prayerController.update);
prayerRouter.delete("/:id", requireAuth, validate({ params: idParamsSchema }), prayerController.remove);
prayerRouter.post("/:id/favorite", requireAuth, validate({ params: idParamsSchema }), prayerController.addFavorite);
prayerRouter.delete("/:id/favorite", requireAuth, validate({ params: idParamsSchema }), prayerController.removeFavorite);

export const prayerCategoryRouter = Router();

prayerCategoryRouter.get("/", prayerCategoryController.list);

export const sermonRouter = Router();

sermonRouter.get("/", validate({ query: listSermonsQuerySchema }), sermonController.list);
sermonRouter.get("/:id", validate({ params: idParamsSchema }), sermonController.detail);
