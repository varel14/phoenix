import { apiFetch, getPaginated } from "./api-client";
import type {
  Wallet,
  WalletRecipient,
  WalletTransaction,
  WalletTransactionType,
  MobileMoneyProvider,
  PaymentMethod,
} from "@/types/wallet";

export const walletApi = {
  async show() {
    const result = await apiFetch<{ data: { wallet: Wallet } }>(
      "/api/v1/wallet",
    );
    return result.data.wallet;
  },

  async transactions(
    params: {
      page?: number;
      limit?: number;
      type?: WalletTransactionType;
    } = {},
  ) {
    return getPaginated<WalletTransaction>(
      "/api/v1/wallet/transactions",
      params,
    );
  },

  async detail(id: string) {
    const result = await apiFetch<{ data: WalletTransaction }>(
      `/api/v1/wallet/transactions/${id}`,
    );
    return result.data;
  },

  async initiateTopup(body: { amount: number; note?: string }) {
    const result = await apiFetch<{ data: { transaction: WalletTransaction } }>(
      "/api/v1/wallet/topups",
      {
        method: "POST",
        body,
      },
    );
    return result.data.transaction;
  },

  /** Dev-only confirmation endpoint (blocked on a production server). */
  async devConfirmTopup(reference: string) {
    const result = await apiFetch<{
      data: {
        transaction: WalletTransaction;
        wallet: Wallet;
        duplicate: boolean;
      };
    }>(`/api/v1/wallet/topups/${reference}/dev-confirm`, { method: "POST" });
    return result.data;
  },

  async transfer(body: { recipientId: string; amount: number; note?: string }) {
    const result = await apiFetch<{
      data: {
        transaction: WalletTransaction;
        wallet: Wallet;
        duplicate: boolean;
      };
    }>("/api/v1/wallet/transfers", { method: "POST", body });
    return result.data;
  },

  /** Wire money to a real-world Orange Money / MTN number (PENDING). */
  async initiatePhoneTransfer(body: {
    phoneNumber: string;
    provider: MobileMoneyProvider;
    amount: number;
    note?: string;
  }) {
    const result = await apiFetch<{ data: { transaction: WalletTransaction } }>(
      "/api/v1/wallet/phone-transfers",
      { method: "POST", body },
    );
    return result.data.transaction;
  },

  /** Dev-only confirmation for phone transfers (provider-webhook stand-in). */
  async devConfirmPhoneTransfer(reference: string) {
    const result = await apiFetch<{
      data: {
        transaction: WalletTransaction;
        wallet: Wallet;
        duplicate: boolean;
      };
    }>(`/api/v1/wallet/phone-transfers/${reference}/dev-confirm`, {
      method: "POST",
    });
    return result.data;
  },

  async recipients(params: { search?: string } = {}) {
    const query = params.search
      ? `?search=${encodeURIComponent(params.search)}`
      : "";
    const result = await apiFetch<{ data: WalletRecipient[] }>(
      `/api/v1/wallet/recipients${query}`,
    );
    return result.data;
  },

  // ------------------------------------------------------ payment methods
  async listPaymentMethods() {
    const result = await apiFetch<{ data: PaymentMethod[] }>(
      "/api/v1/wallet/methods",
    );
    return result.data;
  },

  async createPaymentMethod(body: {
    provider: MobileMoneyProvider;
    phoneNumber: string;
    isDefault?: boolean;
  }) {
    const result = await apiFetch<{ data: { method: PaymentMethod } }>(
      "/api/v1/wallet/methods",
      { method: "POST", body },
    );
    return result.data.method;
  },

  async deletePaymentMethod(id: string) {
    await apiFetch(`/api/v1/wallet/methods/${id}`, { method: "DELETE" });
  },

  /** Promotes a method to default; returns the refreshed list. */
  async setDefaultPaymentMethod(id: string) {
    const result = await apiFetch<{ data: PaymentMethod[] }>(
      `/api/v1/wallet/methods/${id}/default`,
      { method: "PATCH" },
    );
    return result.data;
  },
};
