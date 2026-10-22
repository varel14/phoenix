import { Prisma } from "./../generated/prisma/client.js";
import { prisma } from "../config/prisma.js";
import { AppError } from "../lib/errors.js";
import { emitToUser } from "../lib/realtime.js";
import { pushService } from "../lib/push.js";
import {
  userFollowRepository,
  type UserFollowRef,
} from "../repositories/follow.repository.js";

/** Error code when a chat is attempted without a mutual follow. */
export const FOLLOW_REQUIRED_CODE = "FOLLOW_REQUIRED";
export type UserFollowStatus = "none" | "pending" | "accepted";
export type UserFollowState = {
  /** My outgoing edge: none (no request), pending (awaiting acceptance) or accepted. */
  status: UserFollowStatus;
  /** Their ACCEPTED follow toward me — combined with `accepted` this is a mutual. */
  followsMe: boolean;
  isMutual: boolean;
  /** Wallet compatibility: any edge counts as a pursued contact. */
  isFollowing: boolean;
};
export type FollowedUser = UserFollowRef & { isMutual: boolean };

/** Follow relationship between the user and a target, computed in one round-trip. */
export async function getFollowState(
  userId: string,
  targetId: string,
): Promise<UserFollowState> {
  const edge = await userFollowRepository.findEdge(userId, targetId);
  const followers = await userFollowRepository.findFollowerIds(userId, [
    targetId,
  ]);
  const followsMe = followers.has(targetId);
  const accepted = edge?.status === "ACCEPTED";
  return {
    status: accepted ? "accepted" : edge ? "pending" : "none",
    followsMe,
    isMutual: accepted && followsMe,
    isFollowing: edge !== null,
  };
}

/** True when both ACCEPTED edges exist — the precondition for chatting. */
export async function areMutualFollows(
  userId: string,
  targetId: string,
): Promise<boolean> {
  const [following, followers] = await Promise.all([
    userFollowRepository.findFollowingIds(userId, [targetId]),
    userFollowRepository.findFollowerIds(userId, [targetId]),
  ]);
  return following.has(targetId) && followers.has(targetId);
}

export const userService = {
  /**
   * Follow request lifecycle: creates a PENDING request. Auto-accepts when
   * the target already follows me (ACCEPTED) or has a pending request toward
   * me — both express mutual intent.
   */
  async follow(userId: string, targetId: string): Promise<UserFollowState> {
    if (userId === targetId) {
      throw AppError.badRequest("You cannot follow yourself");
    }
    const target = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, name: true },
    });
    if (!target) throw AppError.notFound("User");

    const theirEdge = await userFollowRepository.findEdge(targetId, userId);
    const theirEdgeAccepted = theirEdge?.status === "ACCEPTED";
    const autoAccept = theirEdgeAccepted || theirEdge?.status === "PENDING";

    try {
      await userFollowRepository.follow(
        userId,
        targetId,
        autoAccept ? "ACCEPTED" : "PENDING",
      );
    } catch (error) {
      if (!(
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      )) {
        throw error;
      }
    }

    // Re-read their edge AFTER our insert: a concurrent follow that raced us
    // (both requests in flight) still gets promoted, so a mutual pair can
    // never end up with two dangling PENDING edges.
    const theirEdgeNow = await userFollowRepository.findEdge(targetId, userId);
    if (theirEdgeNow?.status === "PENDING") {
      await userFollowRepository.accept(targetId, userId);
      emitToUser(targetId, "follow:accepted", { userId, name: target.name });
      void pushService.sendToUsers([targetId], {
        title: "Demande acceptée",
        body: `${target.name} suit également — vous pouvez discuter.`,
      });
    }

    if (theirEdgeNow?.status !== "ACCEPTED") {
      // New request ping: realtime when online, push when not.
      emitToUser(targetId, "follow:request", {
        followerId: userId,
        name: target.name,
      });
      void pushService.sendToUsers([targetId], {
        title: "Nouvelle demande de suivi",
        body: `${target.name} souhaite vous suivre.`,
      });
    }

    return getFollowState(userId, targetId);
  },

  async unfollow(userId: string, targetId: string): Promise<UserFollowState> {
    const removed = await userFollowRepository.unfollow(userId, targetId);
    if (removed === 0) throw AppError.notFound("Follow");
    return {
      status: "none",
      followsMe: false,
      isMutual: false,
      isFollowing: false,
    };
  },

  /** Incoming follow requests awaiting my acceptance, newest first. */
  async listFollowRequests(userId: string): Promise<UserFollowRef[]> {
    return userFollowRepository.findPendingIncoming(userId);
  },

  /** Accepts a pending request → the follower becomes ACCEPTED (mutual). */
  async acceptFollowRequest(userId: string, followerId: string): Promise<void> {
    const accepted = await userFollowRepository.accept(followerId, userId);
    if (!accepted) throw AppError.notFound("Follow request");
    const me = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });
    emitToUser(followerId, "follow:accepted", {
      userId,
      name: me?.name ?? "",
    });
    void pushService.sendToUsers([followerId], {
      title: "Demande acceptée",
      body: `${me?.name ?? "Quelqu'un"} a accepté votre demande — vous pouvez discuter.`,
    });
  },

  /** Rejects (deletes) a pending incoming request. */
  async rejectFollowRequest(userId: string, followerId: string): Promise<void> {
    const removed = await userFollowRepository.unfollow(followerId, userId);
    if (removed === 0) throw AppError.notFound("Follow request");
  },

  /** Everyone the user follows (ACCEPTED, newest first), with the mutual flag resolved. */
  async listFollowing(userId: string): Promise<FollowedUser[]> {
    const following = await userFollowRepository.listFollowing(userId);
    const followers = await userFollowRepository.findFollowerIds(
      userId,
      following.map((entry) => entry.id),
    );
    return following.map((entry) => ({
      ...entry,
      isMutual: followers.has(entry.id),
    }));
  },
};
