import { Router } from "express";
import { userController } from "../controllers/user.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { userIdParamsSchema, userIdSchema } from "../validators/common.js";
import { z } from "zod";

const followerParamsSchema = z.object({ followerId: userIdSchema });

/**
 * Mounted under /users: the user-to-user follow graph. Mutual ACCEPTED
 * follows power wallet payments and unlock chatting; new follows are
 * requests awaiting acceptance.
 */
export const userRouter = Router();

userRouter.use(requireAuth);

userRouter.get("/following", userController.listFollowing);
userRouter.get(
  "/:id/follow-state",
  validate({ params: userIdParamsSchema }),
  userController.followState,
);
userRouter.get("/follow-requests", userController.listFollowRequests);
userRouter.post(
  "/follow-requests/:followerId/accept",
  validate({ params: followerParamsSchema }),
  userController.acceptFollowRequest,
);
userRouter.delete(
  "/follow-requests/:followerId",
  validate({ params: followerParamsSchema }),
  userController.rejectFollowRequest,
);
userRouter.post(
  "/:id/follow",
  validate({ params: userIdParamsSchema }),
  userController.follow,
);
userRouter.delete(
  "/:id/follow",
  validate({ params: userIdParamsSchema }),
  userController.unfollow,
);
