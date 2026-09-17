import { Router } from "express";
import { healthController } from "../controllers/health.controller.js";
import { songRouter } from "./song.routes.js";
import { videoRouter } from "./video.routes.js";
import { artistRouter } from "./artist.routes.js";
import { playlistRouter } from "./playlist.routes.js";
import { favoriteRouter } from "./favorite.routes.js";
import { downloadRouter } from "./download.routes.js";
import { eventRouter } from "./event.routes.js";

export const apiRouter = Router();

apiRouter.get("/health", healthController.apiHealth);

apiRouter.use("/songs", songRouter);
apiRouter.use("/videos", videoRouter);
apiRouter.use("/artists", artistRouter);
apiRouter.use("/playlists", playlistRouter);
apiRouter.use("/favorites", favoriteRouter);
apiRouter.use("/downloads", downloadRouter);
apiRouter.use("/events", eventRouter);
