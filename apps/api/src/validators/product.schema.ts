import { z } from "zod";
import { paginationSchema, uuidSchema } from "./common.js";

export const productTypeSchema = z.enum(["PHYSICAL", "DIGITAL"]);

const inStockParam = z
  .enum(["true", "false"])
  .transform((value) => value === "true")
  .optional();

export const listProductsQuerySchema = paginationSchema.extend({
  categoryId: uuidSchema.optional(),
  type: productTypeSchema.optional(),
  search: z.string().trim().min(1).max(100).optional(),
  minPrice: z.coerce.number().int().min(0).max(100_000_000).optional(),
  maxPrice: z.coerce.number().int().min(0).max(100_000_000).optional(),
  inStock: inStockParam,
  sort: z.enum(["recent", "price_asc", "price_desc"]).default("recent"),
});

export const productVariantInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  sku: z.string().trim().max(100).optional(),
  priceOverride: z.number().int().min(0).max(100_000_000).optional(),
  stock: z.number().int().min(0).max(1_000_000).optional(),
  attributes: z.record(z.string().min(1).max(50), z.unknown()).optional(),
});

const productBaseObject = z.object({
  name: z.string().trim().min(2).max(150),
  description: z.string().trim().max(5000).optional(),
  categoryId: uuidSchema,
  type: productTypeSchema.default("PHYSICAL"),
  price: z.number().int().min(0).max(100_000_000),
  stock: z.number().int().min(0).max(1_000_000).optional(),
  sku: z.string().trim().max(100).optional(),
  weightGrams: z.number().int().min(0).max(1_000_000).optional(),
  digitalStorageKey: z.string().trim().max(255).optional(),
  downloadLimit: z.number().int().min(1).max(1000).optional(),
  isActive: z.boolean().default(true),
  metadata: z.record(z.string().min(1).max(50), z.unknown()).optional(),
  variants: z.array(productVariantInputSchema).max(20).optional(),
  images: z
    .array(
      z.object({
        url: z.string().min(1).max(2048),
        position: z.number().int().min(0).max(100).default(0),
      }),
    )
    .max(10)
    .optional(),
});

const digitalStockRule = (value: { type?: "DIGITAL" | "PHYSICAL" | undefined; stock?: number | undefined }) =>
  value.type !== "DIGITAL" || value.stock == null;

export const createProductBodySchema = productBaseObject.refine(digitalStockRule, {
  message: "Digital products do not carry stock",
  path: ["stock"],
});

export const updateProductBodySchema = productBaseObject.partial().refine(digitalStockRule, {
  message: "Digital products do not carry stock",
  path: ["stock"],
});

export type ProductType = z.infer<typeof productTypeSchema>;
export type ListProductsQuery = z.infer<typeof listProductsQuerySchema>;
export type CreateProductBody = z.infer<typeof createProductBodySchema>;
export type UpdateProductBody = z.infer<typeof updateProductBodySchema>;
