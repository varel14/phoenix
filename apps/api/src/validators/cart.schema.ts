import { z } from "zod";
import { uuidSchema } from "./common.js";

export const addCartItemBodySchema = z
  .object({
    productId: uuidSchema,
    variantId: uuidSchema.optional(),
    quantity: z.number().int().min(1).max(99).default(1),
  })
  .refine((value) => value.variantId || value.variantId === undefined, { message: "Invalid variant" });

export const updateCartItemBodySchema = z.object({
  quantity: z.number().int().min(1).max(99),
});

export type AddCartItemBody = z.infer<typeof addCartItemBodySchema>;
export type UpdateCartItemBody = z.infer<typeof updateCartItemBodySchema>;
