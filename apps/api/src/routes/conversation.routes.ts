import { Router } from "express";
import { conversationController } from "../controllers/conversation.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { idParamsSchema } from "../validators/common.js";
import {
  createConversationBodySchema,
  matchContactsBodySchema,
  listConversationsQuerySchema,
  listMessagesQuerySchema,
  searchMessagesQuerySchema,
  searchUsersQuerySchema,
  sendMessageBodySchema,
} from "../validators/conversation.schema.js";

export const conversationRouter = Router();

conversationRouter.use(requireAuth);

// Registered before /:id so "users" is not captured as an id.
conversationRouter.get(
  "/users",
  validate({ query: searchUsersQuerySchema }),
  conversationController.searchUsers,
);
conversationRouter.get(
  "/",
  validate({ query: listConversationsQuerySchema }),
  conversationController.list,
);
conversationRouter.post(
  "/",
  validate({ body: createConversationBodySchema }),
  conversationController.create,
);
conversationRouter.post(
  "/match-contacts",
  validate({ body: matchContactsBodySchema }),
  conversationController.matchContacts,
);
conversationRouter.post(
  "/:id/accept",
  validate({ params: idParamsSchema }),
  conversationController.acceptRequest,
);
conversationRouter.post(
  "/:id/hide",
  validate({ params: idParamsSchema }),
  conversationController.hideConversation,
);
conversationRouter.get(
  "/:id",
  validate({ params: idParamsSchema }),
  conversationController.detail,
);
conversationRouter.get(
  "/:id/messages",
  validate({ params: idParamsSchema, query: listMessagesQuerySchema }),
  conversationController.listMessages,
);
conversationRouter.get(
  "/:id/messages/search",
  validate({ params: idParamsSchema, query: searchMessagesQuerySchema }),
  conversationController.searchMessages,
);
conversationRouter.post(
  "/:id/messages",
  validate({ params: idParamsSchema, body: sendMessageBodySchema }),
  conversationController.sendMessage,
);
conversationRouter.post(
  "/:id/read",
  validate({ params: idParamsSchema }),
  conversationController.markRead,
);
