import type { ArtistRoyaltyEarnings, PageSubscription, SubscriptionStatus } from "@/types/api";
import { apiFetch } from "./api-client";

/**
 * Page subscription (2 500 FCFA/month) and the 1 FCFA/month per-download
 * royalty paid to the artist under cover of that subscription.
 */
export const subscriptionsApi = {
  async getStatus() {
    const result = await apiFetch<{ data: SubscriptionStatus }>("/api/v1/subscriptions/me");
    return result.data;
  },

  async subscribe(artistId?: string) {
    const result = await apiFetch<{
      data: { subscription: PageSubscription; transaction: { id: string; reference: string; amount: number } };
    }>("/api/v1/subscriptions", { method: "POST", body: artistId ? { artistId } : {} });
    return result.data;
  },

  async cancel(artistId?: string) {
    const query = artistId ? `?artistId=${encodeURIComponent(artistId)}` : "";
    const result = await apiFetch<{ data: { cancelled: number } }>(`/api/v1/subscriptions/me${query}`, {
      method: "DELETE",
    });
    return result.data;
  },

  async myRoyalties() {
    const result = await apiFetch<{
      data: { months: Array<{ periodStart: string; downloads: number; amount: number }>; total: number };
    }>("/api/v1/subscriptions/royalties/mine");
    return result.data;
  },

  async artistEarnings() {
    const result = await apiFetch<{ data: ArtistRoyaltyEarnings }>("/api/v1/subscriptions/royalties/earnings");
    return result.data;
  },
};
