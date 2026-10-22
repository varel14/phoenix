-- Follow requests: new user follows start as PENDING until the recipient
-- accepts. Pre-existing edges are wallet partners / established connections
-- and are grandfathered as ACCEPTED. Existing DIRECT conversations where BOTH
-- sides have messaged are also grandfathered as mutual ACCEPTED follows so
-- nobody loses an ongoing chat; one-sided conversations stay as they are.

ALTER TABLE "user_follows" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PENDING';

UPDATE "user_follows" SET "status" = 'ACCEPTED';

-- Grandfather real exchanges (both sides sent at least one message) in both
-- directions.
WITH pairs AS (
  SELECT cp_a.user_id AS user_a, cp_b.user_id AS user_b
  FROM conversations c
  JOIN conversation_participants cp_a ON cp_a.conversation_id = c.id
  JOIN conversation_participants cp_b ON cp_b.conversation_id = c.id AND cp_b.user_id <> cp_a.user_id
  WHERE c.type = 'DIRECT'
    AND EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id AND m.sender_id = cp_a.user_id)
    AND EXISTS (SELECT 1 FROM messages m WHERE m.conversation_id = c.id AND m.sender_id = cp_b.user_id)
    AND cp_a.user_id < cp_b.user_id
),
both_ways AS (
  SELECT user_a AS follower_id, user_b AS following_id FROM pairs
  UNION ALL
  SELECT user_b, user_a FROM pairs
)
INSERT INTO "user_follows" (id, follower_id, following_id, status, created_at)
SELECT gen_random_uuid(), follower_id, following_id, 'ACCEPTED', now() FROM both_ways
ON CONFLICT ("follower_id", "following_id") DO UPDATE SET "status" = 'ACCEPTED';

CREATE INDEX IF NOT EXISTS "user_follows_following_id_status_idx" ON "user_follows"("following_id", "status");
