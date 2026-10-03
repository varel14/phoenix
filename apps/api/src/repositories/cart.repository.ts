import type { Prisma } from "./../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";

export const cartItemInclude = {
  product: {
    include: {
      images: { orderBy: { position: "asc" as const }, take: 1 },
      category: true,
    },
  },
  variant: true,
} as const;

export type CartItemWithProduct = Prisma.CartItemGetPayload<{ include: typeof cartItemInclude }>;

export const cartRepository = {
  async findCartByUser(userId: string) {
    return prisma.cart.findUnique({ where: { userId }, include: { items: { include: cartItemInclude } } });
  },

  async createCart(userId: string) {
    return prisma.cart.create({ data: { userId }, include: { items: { include: cartItemInclude } } });
  },

  async findCartItem(cartId: string, productId: string, variantId: string | null) {
    return prisma.cartItem.findFirst({
      where: { cartId, productId, variantId },
      include: cartItemInclude,
    });
  },

  async findCartItemById(id: string) {
    return prisma.cartItem.findUnique({ where: { id }, include: { cart: { select: { userId: true } }, ...cartItemInclude } });
  },

  async addItem(cartId: string, productId: string, variantId: string | null, quantity: number) {
    const existing = await prisma.cartItem.findFirst({
      where: { cartId, productId, variantId },
      select: { id: true, quantity: true },
    });
    if (existing) {
      return prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: { increment: quantity } },
        include: cartItemInclude,
      });
    }
    return prisma.cartItem.create({
      data: { cartId, productId, variantId, quantity },
      include: cartItemInclude,
    });
  },

  async updateItemQuantity(id: string, quantity: number) {
    return prisma.cartItem.update({ where: { id }, data: { quantity }, include: cartItemInclude });
  },

  async removeItem(id: string): Promise<void> {
    await prisma.cartItem.delete({ where: { id } });
  },

  async clear(cartId: string): Promise<void> {
    await prisma.cartItem.deleteMany({ where: { cartId } });
  },
};
