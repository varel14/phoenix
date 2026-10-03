import { prisma } from "../config/prisma.js";
import type { Prisma } from "../generated/prisma/client.js";

export interface ActivityInput {
  actorId?: string | undefined;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown> | undefined;
}

/**
 * Records a sensitive operation (payment state change, moderation, campaign
 * review, ...) for traceability. Never throws: auditing must not break the
 * business flow it observes, and never store secrets or credentials here.
 */
export async function recordActivity(input: ActivityInput): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        actorId: input.actorId ?? null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        ...(input.metadata !== undefined
          ? { metadata: input.metadata as Prisma.InputJsonValue }
          : {}),
      },
    });
  } catch (error) {
    console.error("[audit] Failed to record activity:", input.action, error);
  }
}
