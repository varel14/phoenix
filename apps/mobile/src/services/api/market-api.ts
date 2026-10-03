import { apiFetch, getPaginated } from "./api-client";
import type { Cart, Order, ProductCard, ProductCategory, ProductDetail, ShippingAddressInput } from "@/types/market";

export interface ProductListParams {
  page?: number;
  limit?: number;
  categoryId?: string;
  type?: "PHYSICAL" | "DIGITAL";
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort?: "recent" | "price_asc" | "price_desc";
}

export const productsApi = {
  async list(params: ProductListParams = {}) {
    return getPaginated<ProductCard>("/api/v1/products", params);
  },

  async getById(id: string) {
    const result = await apiFetch<{ data: ProductDetail }>(`/api/v1/products/${id}`);
    return result.data;
  },
};

export const productCategoriesApi = {
  async list() {
    const result = await apiFetch<{ data: ProductCategory[] }>("/api/v1/product-categories");
    return result.data;
  },
};

export const cartApi = {
  async get() {
    const result = await apiFetch<{ data: Cart }>("/api/v1/cart");
    return result.data;
  },

  async addItem(productId: string, quantity = 1, variantId?: string) {
    const result = await apiFetch<{ data: Cart }>("/api/v1/cart/items", {
      method: "POST",
      body: { productId, quantity, ...(variantId ? { variantId } : {}) },
    });
    return result.data;
  },

  async updateItem(itemId: string, quantity: number) {
    const result = await apiFetch<{ data: Cart }>(`/api/v1/cart/items/${itemId}`, {
      method: "PATCH",
      body: { quantity },
    });
    return result.data;
  },

  async removeItem(itemId: string) {
    const result = await apiFetch<{ data: Cart }>(`/api/v1/cart/items/${itemId}`, { method: "DELETE" });
    return result.data;
  },

  async clear() {
    const result = await apiFetch<{ data: Cart }>("/api/v1/cart", { method: "DELETE" });
    return result.data;
  },
};

export const ordersApi = {
  async create(shippingAddress?: ShippingAddressInput) {
    const result = await apiFetch<{
      data: { order: Order; transaction: { reference: string; status: string }; paymentUrl: string | null; instructions: string | null };
    }>("/api/v1/orders", {
      method: "POST",
      body: shippingAddress ? { shippingAddress } : {},
    });
    return result.data;
  },

  async list(params: { page?: number; limit?: number } = {}) {
    return getPaginated<Order>("/api/v1/orders", params);
  },

  async getById(id: string) {
    const result = await apiFetch<{ data: Order }>(`/api/v1/orders/${id}`);
    return result.data;
  },
};
