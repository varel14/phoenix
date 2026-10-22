import { apiFetch } from "./api-client";
import type { WalletRecipient } from "@/types/wallet";

export type FollowStatus = "none" | "pending" | "accepted";
export type UserFollowState = {
  status: FollowStatus;
  /** They follow me with an ACCEPTED edge. */
  followsMe: boolean;
  isMutual: boolean;
  /** Wallet compatibility: true when my outgoing follow is ACCEPTED. */
  isFollowing: boolean;
};

function withCompat(
  state: Omit<UserFollowState, "isFollowing">,
): UserFollowState {
  return { ...state, isFollowing: state.status === "accepted" };
}

/** User-to-user follow graph — mutual follows are wallet payment partners. */
export const usersApi = {
  async follow(id: string) {
    const result = await apiFetch<{
      data: Omit<UserFollowState, "isFollowing">;
    }>(`/api/v1/users/${id}/follow`, { method: "POST" });
    return withCompat(result.data);
  },

  async unfollow(id: string) {
    const result = await apiFetch<{
      data: Omit<UserFollowState, "isFollowing">;
    }>(`/api/v1/users/${id}/follow`, { method: "DELETE" });
    return withCompat(result.data);
  },

  async followState(id: string) {
    const result = await apiFetch<{
      data: Omit<UserFollowState, "isFollowing">;
    }>(`/api/v1/users/${id}/follow-state`);
    return withCompat(result.data);
  },

  /** Incoming follow requests awaiting my acceptance. */
  async followRequests() {
    const result = await apiFetch<{
      data: Array<{ id: string; name: string; image: string | null }>;
    }>("/api/v1/users/follow-requests");
    return result.data;
  },

  async acceptFollowRequest(followerId: string) {
    const result = await apiFetch<{ data: { accepted: boolean } }>(
      `/api/v1/users/follow-requests/${followerId}/accept`,
      { method: "POST" },
    );
    return result.data;
  },

  async rejectFollowRequest(followerId: string) {
    const result = await apiFetch<{ data: { accepted: boolean } }>(
      `/api/v1/users/follow-requests/${followerId}`,
      { method: "DELETE" },
    );
    return result.data;
  },

  async following() {
    const result = await apiFetch<{ data: WalletRecipient[] }>(
      "/api/v1/users/following",
    );
    return result.data;
  },
};
