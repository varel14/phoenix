-- Draft ("brouillon") conversations: created when the user leaves a fresh
-- chat with text in the composer, promoted on the first sent message.
ALTER TABLE "conversations" ADD COLUMN "is_draft" BOOLEAN NOT NULL DEFAULT false;
