-- Chat: respostas, reações e "visto por último"
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS "replyToId" uuid NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FK_chat_messages_replyToId'
  ) THEN
    ALTER TABLE chat_messages
      ADD CONSTRAINT "FK_chat_messages_replyToId"
      FOREIGN KEY ("replyToId") REFERENCES chat_messages(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE chat_members ADD COLUMN IF NOT EXISTS "lastSeenAt" timestamp NULL;

CREATE TABLE IF NOT EXISTS chat_message_reactions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "messageId" uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  "userId" uuid NOT NULL,
  emoji varchar(16) NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "UQ_chat_message_reactions_message_user_emoji" UNIQUE ("messageId", "userId", emoji)
);

CREATE INDEX IF NOT EXISTS "IDX_chat_message_reactions_messageId"
  ON chat_message_reactions ("messageId");

-- Idempotência do envio: o mesmo clientId do mesmo usuário não gera mensagem duplicada
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS "clientId" character varying(64);
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_chat_messages_user_client" ON chat_messages ("userId", "clientId");
