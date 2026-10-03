import { apiFetch, getPaginated } from "./api-client";
import type {
  InitiatePaymentResult,
  PaymentCategory,
  PaymentService,
  PaymentServiceDetail,
  PaymentTransaction,
  PaymentTransactionStatus,
} from "@/types/payments";

export const paymentsApi = {
  async categories() {
    const result = await apiFetch<{ data: PaymentCategory[] }>("/api/v1/payment-categories");
    return result.data;
  },

  async services(params: { categoryId?: string } = {}) {
    const query = params.categoryId ? `?categoryId=${params.categoryId}` : "";
    const result = await apiFetch<{ data: PaymentService[] }>(`/api/v1/payment-services${query}`);
    return result.data;
  },

  async service(id: string) {
    const result = await apiFetch<{ data: PaymentServiceDetail }>(`/api/v1/payment-services/${id}`);
    return result.data;
  },

  async initiate(body: { serviceId: string; amount?: number; fields?: Record<string, string> }) {
    const result = await apiFetch<{ data: InitiatePaymentResult }>("/api/v1/payments", {
      method: "POST",
      body: { fields: {}, ...body },
    });
    return result.data;
  },

  /** Dev-only confirmation endpoint (blocked on a production server). */
  async devConfirm(reference: string) {
    const result = await apiFetch<{ data: { transaction: PaymentTransaction; duplicate: boolean } }>(
      `/api/v1/payments/${reference}/dev-confirm`,
      { method: "POST" },
    );
    return result.data;
  },

  async list(params: { page?: number; limit?: number; status?: PaymentTransactionStatus } = {}) {
    return getPaginated<PaymentTransaction>("/api/v1/payments", params);
  },

  async getById(id: string) {
    const result = await apiFetch<{ data: PaymentTransaction }>(`/api/v1/payments/${id}`);
    return result.data;
  },
};
