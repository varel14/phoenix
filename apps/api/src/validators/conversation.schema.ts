import { z } from "zod";
import { paginationSchema, userIdSchema } from "./common.js";

export const listConversationsQuerySchema = paginationSchema.extend({
  search: z.string().trim().min(1).max(100).optional(),
});

export const searchUsersQuerySchema = z.object({
  // Optional: an empty search returns the default contact list.
  search: z.string().trim().max(100).default(""),
});

export const searchMessagesQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
});

/** Device contact phone numbers to match against app users. */
export const matchContactsBodySchema = z.object({
  phones: z.array(z.string().trim().min(6).max(32)).max(500),
});

export const listMessagesQuerySchema = paginationSchema.extend({});

export const messageAttachmentSchema = z.object({
  url: z.string().min(1).max(2048),
  storageKey: z.string().min(1).max(500),
  mimeType: z.string().min(1).max(100).optional(),
  fileSizeBytes: z
    .number()
    .int()
    .positive()
    .max(100 * 1024 * 1024)
    .optional(),
  durationSec: z.number().int().positive().max(3600).optional(),
  name: z.string().trim().max(255).optional(),
});

export const sendMessageBodySchema = z
  .object({
    type: z.enum(["TEXT", "VOICE", "IMAGE", "VIDEO", "FILE"]).default("TEXT"),
    content: z.string().trim().min(1).max(4000).optional(),
    attachment: messageAttachmentSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === "TEXT" && !value.content) {
      ctx.addIssue({
        code: "custom",
        path: ["content"],
        message: "content is required for TEXT messages",
      });
    }
    if (value.type === "VOICE") {
      if (!value.attachment) {
        ctx.addIssue({
          code: "custom",
          path: ["attachment"],
          message: "attachment is required for VOICE messages",
        });
      } else if (!value.attachment.durationSec) {
        ctx.addIssue({
          code: "custom",
          path: ["attachment", "durationSec"],
          message: "durationSec is required for VOICE messages",
        });
      }
    }
    if (
      (value.type === "IMAGE" ||
        value.type === "VIDEO" ||
        value.type === "FILE") &&
      !value.attachment
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["attachment"],
        message: `attachment is required for ${value.type} messages`,
      });
    }
  });

export const createConversationBodySchema = z.object({
  recipientId: userIdSchema,
  /** Create the conversation as a draft ("brouillon") — no message sent yet. */
  draft: z.boolean().optional(),
  /** First message to send atomically with the conversation creation. */
  message: sendMessageBodySchema.optional(),
});

export type ListConversationsQuery = z.infer<
  typeof listConversationsQuerySchema
>;
export type SearchUsersQuery = z.infer<typeof searchUsersQuerySchema>;
export type CreateConversationBody = z.infer<
  typeof createConversationBodySchema
>;
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;
export type SearchMessagesQuery = z.infer<typeof searchMessagesQuerySchema>;
export type MatchContactsBody = z.infer<typeof matchContactsBodySchema>;
export type MessageAttachmentInput = z.infer<typeof messageAttachmentSchema>;
export type SendMessageBody = z.infer<typeof sendMessageBodySchema>;
