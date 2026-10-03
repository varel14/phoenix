import { z } from "zod";
import { paginationSchema, userIdSchema } from "./common.js";

export const listConversationsQuerySchema = paginationSchema.extend({
  search: z.string().trim().min(1).max(100).optional(),
});

export const searchUsersQuerySchema = z.object({
  search: z.string().trim().min(1).max(100),
});

export const createConversationBodySchema = z.object({
  recipientId: userIdSchema,
});

export const listMessagesQuerySchema = paginationSchema.extend({});

export const messageAttachmentSchema = z.object({
  url: z.string().min(1).max(2048),
  storageKey: z.string().min(1).max(500),
  mimeType: z.string().min(1).max(100).optional(),
  fileSizeBytes: z.number().int().positive().max(100 * 1024 * 1024).optional(),
  durationSec: z.number().int().positive().max(3600).optional(),
  name: z.string().trim().max(255).optional(),
});

export const sendMessageBodySchema = z
  .object({
    type: z.enum(["TEXT", "VOICE"]).default("TEXT"),
    content: z.string().trim().min(1).max(4000).optional(),
    attachment: messageAttachmentSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === "TEXT" && !value.content) {
      ctx.addIssue({ code: "custom", path: ["content"], message: "content is required for TEXT messages" });
    }
    if (value.type === "VOICE") {
      if (!value.attachment) {
        ctx.addIssue({ code: "custom", path: ["attachment"], message: "attachment is required for VOICE messages" });
      } else if (!value.attachment.durationSec) {
        ctx.addIssue({ code: "custom", path: ["attachment", "durationSec"], message: "durationSec is required for VOICE messages" });
      }
    }
  });

export type ListConversationsQuery = z.infer<typeof listConversationsQuerySchema>;
export type SearchUsersQuery = z.infer<typeof searchUsersQuerySchema>;
export type CreateConversationBody = z.infer<typeof createConversationBodySchema>;
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;
export type MessageAttachmentInput = z.infer<typeof messageAttachmentSchema>;
export type SendMessageBody = z.infer<typeof sendMessageBodySchema>;
