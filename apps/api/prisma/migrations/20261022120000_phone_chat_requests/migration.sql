-- WhatsApp-style messaging: users are reachable by phone number, and
-- conversations started by someone new arrive as message requests
-- (accept to proceed, X to hide).

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "phone" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "users_phone_key" ON "users"("phone");

ALTER TABLE "conversation_participants" ADD COLUMN IF NOT EXISTS "accepted_at" TIMESTAMP(3);
ALTER TABLE "conversation_participants" ADD COLUMN IF NOT EXISTS "hidden_at" TIMESTAMP(3);

-- Everyone who has already sent a message in a conversation has engaged:
-- their acceptance is backfilled so no existing thread turns into a request.
UPDATE conversation_participants cp
SET "accepted_at" = now()
WHERE EXISTS (
  SELECT 1 FROM messages m WHERE m.conversation_id = cp.conversation_id AND m.sender_id = cp.user_id
);
