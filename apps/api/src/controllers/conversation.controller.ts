import type { Request, Response } from "express";
import { conversationService } from "../services/conversation.service.js";
import { sendPaginated, sendSuccess } from "../lib/responses.js";
import { AppError } from "../lib/errors.js";
import { emitToConversation, emitToUser } from "../lib/realtime.js";
import {
  validatedBody,
  validatedParams,
  validatedQuery,
} from "../middleware/validate.js";
import type { AuthenticatedUser } from "../types/express.d.js";
import type {
  MatchContactsBody,
  SearchMessagesQuery,
  CreateConversationBody,
  ListConversationsQuery,
  ListMessagesQuery,
  SearchUsersQuery,
  SendMessageBody,
} from "../validators/conversation.schema.js";
import type { idParamsSchema } from "../validators/common.js";
import type { z } from "zod";

function requireUser(req: Request): AuthenticatedUser {
  if (!req.user) throw AppError.unauthorized();
  return req.user;
}

export const conversationController = {
  /** Minimal user directory used by the "new conversation" picker. */
  async searchUsers(req: Request, res: Response) {
    const user = requireUser(req);
    const { search } = validatedQuery<SearchUsersQuery>(req);
    const users = await conversationService.searchUsers(user.id, search);
    sendSuccess(res, users);
  },

  async matchContacts(req: Request, res: Response) {
    const user = requireUser(req);
    const { phones } = validatedBody<MatchContactsBody>(req);
    const users = await conversationService.matchContacts(user.id, phones);
    sendSuccess(res, users);
  },

  async acceptRequest(req: Request, res: Response) {
    const user = requireUser(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    const result = await conversationService.acceptRequest(user.id, id);
    sendSuccess(res, result);
  },

  async hideConversation(req: Request, res: Response) {
    const user = requireUser(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    const result = await conversationService.hideConversation(user.id, id);
    sendSuccess(res, result);
  },

  async list(req: Request, res: Response) {
    const user = requireUser(req);
    const query = validatedQuery<ListConversationsQuery>(req);
    const { conversations, pagination } = await conversationService.list(
      user.id,
      query,
    );
    sendPaginated(res, conversations, pagination);
  },

  async create(req: Request, res: Response) {
    const user = requireUser(req);
    const body = validatedBody<CreateConversationBody>(req);
    const conversation = await conversationService.createDirect(user.id, body);
    sendSuccess(res, conversation, 201);
  },

  async detail(req: Request, res: Response) {
    const user = requireUser(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    const conversation = await conversationService.getDetailOrThrow(
      user.id,
      id,
    );
    sendSuccess(res, conversation);
  },

  async searchMessages(req: Request, res: Response) {
    const user = requireUser(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    const { q } = validatedQuery<SearchMessagesQuery>(req);
    const messages = await conversationService.searchMessages(user.id, id, q);
    sendSuccess(res, messages);
  },

  async listMessages(req: Request, res: Response) {
    const user = requireUser(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    const query = validatedQuery<ListMessagesQuery>(req);
    const { messages, pagination } = await conversationService.listMessages(
      user.id,
      id,
      query,
    );
    sendPaginated(res, messages, pagination);
  },

  async sendMessage(req: Request, res: Response) {
    const user = requireUser(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    const body = validatedBody<SendMessageBody>(req);
    const { message, otherParticipantIds } =
      await conversationService.sendMessage(user.id, id, body);

    emitToConversation(id, "message:new", { conversationId: id, message });
    for (const participantId of otherParticipantIds) {
      emitToUser(participantId, "message:received", {
        conversationId: id,
        message,
      });
    }
    sendSuccess(res, message, 201);
  },

  async markRead(req: Request, res: Response) {
    const user = requireUser(req);
    const { id } = validatedParams<z.infer<typeof idParamsSchema>>(req);
    const result = await conversationService.markRead(user.id, id);
    emitToConversation(id, "message:read", {
      conversationId: id,
      userId: user.id,
      lastReadAt: result.lastReadAt,
    });
    sendSuccess(res, result);
  },
};
