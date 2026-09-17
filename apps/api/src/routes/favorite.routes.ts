import { Router } from "express";
import { favoriteController } from "../controllers/favorite.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { idParamsSchema } from "../validators/common.js";
import { createFavoriteBodySchema, listFavoritesQuerySchema } from "../validators/favorite.schema.js";

export const favoriteRouter = Router();

favoriteRouter.use(requireAuth);

favoriteRouter.get("/", validate({ query: listFavoritesQuerySchema }), favoriteController.list);
favoriteRouter.post("/", validate({ body: createFavoriteBodySchema }), favoriteController.create);
favoriteRouter.delete("/:id", validate({ params: idParamsSchema }), favoriteController.remove);
