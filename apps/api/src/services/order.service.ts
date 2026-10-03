import { AppError } from "../lib/errors.js";
import { ORDER_REFERENCE_PREFIX, generateReference } from "../lib/refs.js";
import { buildPagination, type PaginationMeta } from "../lib/responses.js";
import { cartRepository } from "../repositories/cart.repository.js";
import {
  orderRepository,
  type OrderWithRelations,
} from "../repositories/order.repository.js";
import { digitalFilesDir } from "../lib/storage.js";
import { presignDigitalDownload } from "../lib/object-storage.js";
import path from "node:path";
import { createReadStream } from "node:fs";
import { existsSync, statSync } from "node:fs";
import type { CreateOrderBody, ListOrdersQuery } from "../validators/order.schema.js";

const DOWNLOADABLE_STATUSES = new Set(["PAID", "PROCESSING", "SHIPPED", "DELIVERED"]);

export const orderService = {
  /**
   * Creates the order from the server-side cart. Prices are read from the
   * database (never trusted from the client) and snapshotted into items.
   */
  async createFromCart(userId: string, body: CreateOrderBody) {
    const cart = await cartRepository.findCartByUser(userId);
    if (!cart || cart.items.length === 0) throw AppError.badRequest("Your cart is empty");

    const requiresShipping = cart.items.some((item) => item.product.type === "PHYSICAL");
    if (requiresShipping && !body.shippingAddress) {
      throw AppError.badRequest("A delivery address is required for physical products");
    }

    // Re-validate stock and compute authoritative totals from current DB prices.
    for (const item of cart.items) {
      if (item.product.type !== "PHYSICAL") continue;
      const availableStock = item.variant ? item.variant.stock : item.product.stock;
      if (availableStock != null && availableStock < item.quantity) {
        throw AppError.conflict(`Insufficient stock for "${item.product.name}"`);
      }
    }

    const subtotal = cart.items.reduce(
      (sum, item) => sum + (item.variant?.priceOverride ?? item.product.price) * item.quantity,
      0,
    );
    const shippingFee = 0; // Dedicated delivery/logistics comes later.
    const total = subtotal + shippingFee;
    const currency = cart.items[0]?.product.currency ?? "XOF";

    const order = await orderRepository.createOrder({
      userId,
      reference: generateReference(ORDER_REFERENCE_PREFIX),
      subtotal,
      shippingFee,
      total,
      currency,
      address: body.shippingAddress ?? null,
      items: cart.items.map((item) => ({
        productId: item.productId,
        variantId: item.variantId,
        productName: item.product.name,
        variantName: item.variant?.name ?? null,
        productType: item.product.type,
        digitalStorageKey: item.product.digitalStorageKey,
        downloadLimit: item.product.downloadLimit,
        unitPrice: item.variant?.priceOverride ?? item.product.price,
        quantity: item.quantity,
        lineTotal: (item.variant?.priceOverride ?? item.product.price) * item.quantity,
      })),
    });

    await cartRepository.clear(cart.id);
    return order;
  },

  /** Called by the payment pipeline once the webhook confirms the money. */
  async markPaid(orderId: string): Promise<OrderWithRelations | null> {
    return orderRepository.markPaid(orderId);
  },

  async list(userId: string, query: ListOrdersQuery): Promise<{ orders: OrderWithRelations[]; pagination: PaginationMeta }> {
    const [orders, total] = await Promise.all([
      orderRepository.findManyByUser(userId, query),
      orderRepository.countByUser(userId),
    ]);
    return { orders, pagination: buildPagination(query.page, query.limit, total) };
  },

  async getForUser(userId: string, orderId: string): Promise<OrderWithRelations> {
    const order = await orderRepository.findById(orderId);
    if (!order || order.userId !== userId) throw AppError.notFound("Order");
    return order;
  },

  /**
   * Authorizes a digital download: ownership + paid order + download limit.
   * With R2 configured, returns a short-lived presigned bucket URL; otherwise
   * a readable stream of the protected local file (never a public URL).
   */
  async authorizeDigitalDownload(
    userId: string,
    orderId: string,
    itemId: string,
  ): Promise<
    | { mode: "url"; downloadUrl: string; fileName: string }
    | { mode: "stream"; stream: NodeJS.ReadableStream; fileName: string; fileSizeBytes: number }
  > {
    const order = await this.getForUser(userId, orderId);
    if (!DOWNLOADABLE_STATUSES.has(order.status)) {
      throw AppError.forbidden("This order has not been paid yet");
    }
    const item = order.items.find((entry) => entry.id === itemId);
    if (!item) throw AppError.notFound("Order item");
    if (item.productType !== "DIGITAL" || !item.digitalStorageKey) {
      throw AppError.badRequest("This item is not a digital product");
    }
    if (item.downloadLimit != null && item.downloadCount >= item.downloadLimit) {
      throw AppError.forbidden("Download limit reached for this purchase");
    }
    await orderRepository.incrementDownloadCount(item.id);

    const fileName = path.basename(item.digitalStorageKey);
    const downloadUrl = await presignDigitalDownload(item.digitalStorageKey, fileName);
    if (downloadUrl) return { mode: "url", downloadUrl, fileName };

    const filePath = path.join(digitalFilesDir(), fileName);
    if (!existsSync(filePath)) throw AppError.notFound("Digital file");
    return {
      mode: "stream",
      stream: createReadStream(filePath),
      fileName,
      fileSizeBytes: statSync(filePath).size,
    };
  },
};
