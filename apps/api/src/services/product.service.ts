import { prisma } from "../config/prisma.js";
import { AppError } from "../lib/errors.js";
import { buildPagination, type PaginationMeta } from "../lib/responses.js";
import {
  productRepository,
  productCardInclude,
  type ProductCard,
  type ProductDetail,
} from "../repositories/product.repository.js";
import type { CreateProductBody, ListProductsQuery, UpdateProductBody } from "../validators/product.schema.js";
import type { Prisma } from "../generated/prisma/client.js";

export const productCategoryService = {
  async list() {
    return productRepository.findCategories();
  },
};

function variantCreateData(variants: CreateProductBody["variants"]) {
  if (!variants) return undefined;
  return variants.map((variant) => ({
    name: variant.name,
    ...(variant.sku != null ? { sku: variant.sku } : {}),
    ...(variant.priceOverride != null ? { priceOverride: variant.priceOverride } : {}),
    ...(variant.stock != null ? { stock: variant.stock } : {}),
    ...(variant.attributes != null ? { attributes: variant.attributes as Prisma.InputJsonValue } : {}),
  }));
}

function imageCreateData(images: CreateProductBody["images"]) {
  if (!images) return undefined;
  return images.map((image) => ({ url: image.url, position: image.position }));
}

export const productService = {
  async list(query: ListProductsQuery): Promise<{ products: ProductCard[]; pagination: PaginationMeta }> {
    const { products, total } = await productRepository.findMany(query);
    return { products, pagination: buildPagination(query.page, query.limit, total) };
  },

  async getDetail(id: string): Promise<ProductDetail> {
    const product = await productRepository.findDetailById(id);
    if (!product) throw AppError.notFound("Product");
    return product;
  },

  async createForArtist(userId: string, body: CreateProductBody): Promise<ProductDetail> {
    const artist = await prisma.artist.findUnique({ where: { userId }, select: { id: true } });
    if (!artist) throw AppError.forbidden("Only artists can sell on the Boutique");
    const category = await productRepository.findCategoryById(body.categoryId);
    if (!category) throw AppError.notFound("Product category");

    const variantData = variantCreateData(body.variants);
    const imageData = imageCreateData(body.images);
    const data: Prisma.ProductUncheckedCreateInput = {
      sellerId: artist.id,
      categoryId: body.categoryId,
      name: body.name,
      description: body.description ?? null,
      type: body.type,
      price: body.price,
      stock: body.type === "DIGITAL" ? null : (body.stock ?? null),
      sku: body.sku ?? null,
      weightGrams: body.weightGrams ?? null,
      digitalStorageKey: body.digitalStorageKey ?? null,
      downloadLimit: body.downloadLimit ?? null,
      isActive: body.isActive,
      ...(body.metadata != null ? { metadata: body.metadata as Prisma.InputJsonValue } : {}),
      ...(variantData ? { variants: { create: variantData } } : {}),
      ...(imageData ? { images: { create: imageData } } : {}),
    };
    return productRepository.create(artist.id, data);
  },

  async updateForArtist(userId: string, productId: string, body: UpdateProductBody): Promise<ProductDetail> {
    const existing = await productRepository.findOwnedById(productId);
    if (!existing || existing.seller.userId !== userId) throw AppError.notFound("Product");

    const variantData = variantCreateData(body.variants);
    const imageData = imageCreateData(body.images);
    const data: Prisma.ProductUncheckedUpdateInput = {
      ...(body.name != null ? { name: body.name } : {}),
      ...(body.description != null ? { description: body.description } : {}),
      ...(body.categoryId != null ? { categoryId: body.categoryId } : {}),
      ...(body.type != null ? { type: body.type } : {}),
      ...(body.price != null ? { price: body.price } : {}),
      ...(body.type === "DIGITAL"
        ? { stock: null }
        : body.stock != null
          ? { stock: body.stock }
          : {}),
      ...(body.sku != null ? { sku: body.sku } : {}),
      ...(body.weightGrams != null ? { weightGrams: body.weightGrams } : {}),
      ...(body.digitalStorageKey != null ? { digitalStorageKey: body.digitalStorageKey } : {}),
      ...(body.downloadLimit != null ? { downloadLimit: body.downloadLimit } : {}),
      ...(body.isActive != null ? { isActive: body.isActive } : {}),
      ...(body.metadata != null ? { metadata: body.metadata as Prisma.InputJsonValue } : {}),
      ...(variantData ? { variants: { deleteMany: {}, create: variantData } } : {}),
      ...(imageData ? { images: { deleteMany: {}, create: imageData } } : {}),
    };
    return productRepository.update(productId, data);
  },

  async removeForArtist(userId: string, productId: string): Promise<void> {
    const existing = await productRepository.findOwnedById(productId);
    if (!existing || existing.seller.userId !== userId) throw AppError.notFound("Product");
    await productRepository.remove(productId);
  },
};

// Re-exported for tests that need the card shape.
export type { ProductCard };
export { productCardInclude };
