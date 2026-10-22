import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "@/services/api/users-api";
import type { UserFollowState } from "@/services/api/users-api";
import type { WalletRecipient, WalletTransaction } from "@/types/wallet";

/** Invalidates every cache that renders follow state or recipient rails. */
function useInvalidateFollows() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["wallet-recipients"] });
    void queryClient.invalidateQueries({ queryKey: ["wallet-transaction"] });
    void queryClient.invalidateQueries({ queryKey: ["following"] });
  };
}

/**
 * Applies a follow state to every cached recipient list and transaction
 * detail, so the UI reflects the change locally before the refetch lands.
 */
function useFollowStatePatch() {
  const queryClient = useQueryClient();
  return (id: string, state: UserFollowState) => {
    queryClient.setQueriesData<WalletRecipient[]>(
      { queryKey: ["wallet-recipients"] },
      (old) =>
        old?.map((recipient) =>
          recipient.id === id ? { ...recipient, ...state } : recipient,
        ),
    );
    queryClient.setQueriesData<WalletTransaction | undefined>(
      { queryKey: ["wallet-transaction"] },
      (old) =>
        old && old.counterparty?.id === id
          ? {
              ...old,
              counterparty: { ...old.counterparty, ...state },
            }
          : old,
    );
  };
}

function useFollowMutation(direction: "follow" | "unfollow") {
  const queryClient = useQueryClient();
  const patch = useFollowStatePatch();
  const invalidate = useInvalidateFollows();
  const optimisticState: UserFollowState =
    direction === "follow"
      ? {
          status: "accepted",
          followsMe: false,
          isMutual: false,
          isFollowing: true,
        }
      : {
          status: "none",
          followsMe: false,
          isMutual: false,
          isFollowing: false,
        };

  return useMutation({
    mutationFn: (id: string): Promise<UserFollowState> =>
      direction === "follow" ? usersApi.follow(id) : usersApi.unfollow(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["wallet-recipients"] });
      await queryClient.cancelQueries({ queryKey: ["wallet-transaction"] });
      const snapshots = [
        ...queryClient.getQueriesData({ queryKey: ["wallet-recipients"] }),
        ...queryClient.getQueriesData({ queryKey: ["wallet-transaction"] }),
      ];
      patch(id, optimisticState);
      return snapshots;
    },
    // Server state is exact — paint it immediately.
    onSuccess: (state, id) => patch(id, state),
    // Restore the pre-mutation caches if the request failed.
    onError: (_error, _id, snapshots) => {
      for (const [key, value] of snapshots ?? []) {
        queryClient.setQueryData(key, value);
      }
    },
    onSettled: invalidate,
  });
}

/** Follow a user; recipient lists and detail views update instantly. */
export function useFollowUser() {
  return useFollowMutation("follow");
}

/** Unfollow a user; recipient lists and detail views update instantly. */
export function useUnfollowUser() {
  return useFollowMutation("unfollow");
}
