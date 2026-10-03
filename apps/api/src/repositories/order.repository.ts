import type { Prisma } from "./../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import type { OrderAddressInput } from "../validators/order.schema.js";

export const orderInclude = {
  items: true,
  address: true,
  transactions: { select: { id: true, reference: true, status: true, amount: true, provider: true } },
} as const;

export type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

export type CartLineSnapshot = {
  productId: string | null;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  productType: "PHYSICAL" | "DIGITAL";
  digitalStorageKey: string | null;
  downloadLimit: number | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

export const orderRepository = {
  async createOrder(input: {
    userId: string;
    reference: string;
    subtotal: number;
    shippingFee: number;
    total: number;
    currency: string;
    address: OrderAddressInput | null;
    items: CartLineSnapshot[];
  }): Promise<OrderWithRelations> {
    const data: Prisma.OrderUncheckedCreateInput = {
      userId: input.userId,
      reference: input.reference,
      status: "AWAITING_PAYMENT",
      subtotal: input.subtotal,
      shippingFee: input.shippingFee,
      total: input.total,
      currency: input.currency,
      items: {
        create: input.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          productName: item.productName,
          variantName: item.variantName,
          productType: item.productType,
          digitalStorageKey: item.digitalStorageKey,
          downloadLimit: item.downloadLimit,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          lineTotal: item.lineTotal,
        })),
      },
      ...(input.address
        ? {
            address: {
              create: {
                recipientName: input.address.recipientName,
                phone: input.address.phone,
                city: input.address.city,
                area: input.address.area ?? null,
                addressLine: input.address.addressLine ?? null,
                instructions: input.address.instructions ?? null,
              },
            },
          }
        : {}),
    };
    return prisma.order.create({ data, include: orderInclude });
  },

  async findManyByUser(userId: string, options: { page: number; limit: number }): Promise<OrderWithRelations[]> {
    return prisma.order.findMany({
      where: { userId },
      include: orderInclude,
      orderBy: { createdAt: "desc" },
      skip: (options.page - 1) * options.limit,
      take: options.limit,
    });
  },

  async countByUser(userId: string): Promise<number> {
    return prisma.order.count({ where: { userId } });
  },

  async findById(id: string): Promise<OrderWithRelations | null> {
    return prisma.order.findUnique({ where: { id }, include: orderInclude });
  },

  async markPaid(id: string): Promise<OrderWithRelations | null> {
    const order = await prisma.order.findUnique({ where: { id }, include: { items: true } });
    if (!order) return null;
    if (["PAID", "PROCESSING", "SHIPPED", "DELIVERED", "REFUNDED"].includes(order.status)) {
      return prisma.order.findUnique({ where: { id }, include: orderInclude });
    }

    return prisma.$transaction(async (tx) => {
      // Physical stock is reserved at payment time (validated again at checkout).
      // updateMany skips the decrement when stock was drained in the meantime.
      for (const item of order.items) {
        if (item.productType === "PHYSICAL" && item.productId) {
          await tx.product.updateMany({
            where: { id: item.productId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });
        }
      }
      return tx.order.update({
        where: { id },
        data: { status: "PAID", paidAt: new Date() },
        include: orderInclude,
      });
    });
  },

  async findOrderItem(itemId: string) {
    return prisma.orderItem.findUnique({ where: { id: itemId }, include: { order: true } });
  },

  async incrementDownloadCount(itemId: string): Promise<void> {
    await prisma.orderItem.update({ where: { id: itemId }, data: { downloadCount: { increment: 1 } } });
  },
};
