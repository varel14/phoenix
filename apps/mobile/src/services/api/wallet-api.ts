import { apiFetch, getPaginated } from "./api-client";
import type {
  Wallet,
  WalletRecipient,
  WalletTransaction,
  WalletTransactionType,
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

  async recipients(params: { search?: string } = {}) {
    const query = params.search
      ? `?search=${encodeURIComponent(params.search)}`
      : "";
    const result = await apiFetch<{ data: WalletRecipient[] }>(
      `/api/v1/wallet/recipients${query}`,
    );
    return result.data;
  },
};
