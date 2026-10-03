import { z } from "zod";
import { paginationSchema, uuidSchema } from "./common.js";

export const orderAddressSchema = z.object({
  recipientName: z.string().trim().min(2).max(100),
  phone: z
    .string()
    .trim()
    .regex(/^[+\d][\d\s.-]{7,19}$/, "Invalid phone number"),
  city: z.string().trim().min(2).max(100),
  area: z.string().trim().max(100).optional(),
  addressLine: z.string().trim().max(255).optional(),
  instructions: z.string().trim().max(500).optional(),
});

export const createOrderBodySchema = z.object({
  shippingAddress: orderAddressSchema.optional(),
});

export const listOrdersQuerySchema = paginationSchema.extend({});

export const orderDownloadParamsSchema = z.object({
  orderId: uuidSchema,
  itemId: uuidSchema,
});

export type OrderAddressInput = z.infer<typeof orderAddressSchema>;
export type CreateOrderBody = z.infer<typeof createOrderBodySchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
