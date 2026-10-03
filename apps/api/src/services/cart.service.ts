import { prisma } from "../config/prisma.js";
import { AppError } from "../lib/errors.js";
import {
  cartRepository,
  type CartItemWithProduct,
} from "../repositories/cart.repository.js";
import type { AddCartItemBody, UpdateCartItemBody } from "../validators/cart.schema.js";

export type CartSummary = {
  id: string;
  items: CartItemWithProduct[];
  itemCount: number;
  subtotal: number;
  currency: string;
  requiresShipping: boolean;
};

export function lineUnitPrice(item: Pick<CartItemWithProduct, "product" | "variant">): number {
  return item.variant?.priceOverride ?? item.product.price;
}

function buildSummary(cart: NonNullable<Awaited<ReturnType<typeof cartRepository.findCartByUser>>>): CartSummary {
  const subtotal = cart.items.reduce((sum, item) => sum + lineUnitPrice(item) * item.quantity, 0);
  const requiresShipping = cart.items.some((item) => item.product.type === "PHYSICAL");
  const currency = cart.items[0]?.product.currency ?? "XOF";
  return {
    id: cart.id,
    items: cart.items,
    itemCount: cart.items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal,
    currency,
    requiresShipping,
  };
}

export const cartService = {
  async getOrCreateCart(userId: string) {
    const cart = await cartRepository.findCartByUser(userId);
    if (cart) return cart;
    return cartRepository.createCart(userId);
  },

  async getCart(userId: string): Promise<CartSummary> {
    const cart = await cartRepository.findCartByUser(userId);
    if (!cart) {
      const created = await cartRepository.createCart(userId);
      return buildSummary(created);
    }
    return buildSummary(cart);
  },

  async addItem(userId: string, body: AddCartItemBody): Promise<CartSummary> {
    const product = await prisma.product.findFirst({
      where: {
        id: body.productId,
        isActive: true,
        category: { isActive: true },
        publishedAt: { lte: new Date() },
      },
      include: { variants: true },
    });
    if (!product) throw AppError.notFound("Product");

    let variant = null;
    if (body.variantId) {
      variant = product.variants.find((v) => v.id === body.variantId && v.isActive);
      if (!variant) throw AppError.badRequest("This variant does not exist for this product");
    }

    const availableStock = variant ? variant.stock : product.stock;
    if (product.type === "PHYSICAL" && availableStock != null && availableStock < body.quantity) {
      throw AppError.conflict("Insufficient stock");
    }

    const cart = await this.getOrCreateCart(userId);
    const existing = await cartRepository.findCartItem(cart.id, product.id, body.variantId ?? null);
    const newQuantity = (existing?.quantity ?? 0) + body.quantity;
    if (product.type === "PHYSICAL" && availableStock != null && availableStock < newQuantity) {
      throw AppError.conflict("Insufficient stock");
    }

    await cartRepository.addItem(cart.id, product.id, body.variantId ?? null, body.quantity);
    return this.getCart(userId);
  },

  async updateItem(userId: string, itemId: string, body: UpdateCartItemBody): Promise<CartSummary> {
    const item = await cartRepository.findCartItemById(itemId);
    if (!item || item.cart.userId !== userId) throw AppError.notFound("Cart item");

    const availableStock = item.variant ? item.variant.stock : item.product.stock;
    if (item.product.type === "PHYSICAL" && availableStock != null && availableStock < body.quantity) {
      throw AppError.conflict("Insufficient stock");
    }
    await cartRepository.updateItemQuantity(itemId, body.quantity);
    return this.getCart(userId);
  },

  async removeItem(userId: string, itemId: string): Promise<CartSummary> {
    const item = await cartRepository.findCartItemById(itemId);
    if (!item || item.cart.userId !== userId) throw AppError.notFound("Cart item");
    await cartRepository.removeItem(itemId);
    return this.getCart(userId);
  },

  async clear(userId: string): Promise<CartSummary> {
    const cart = await this.getOrCreateCart(userId);
    await cartRepository.clear(cart.id);
    return this.getCart(userId);
  },
};
