-- Conformidade LGPD / ECA Digital / lojas. Idempotente.
ALTER TABLE "user" ALTER COLUMN age DROP NOT NULL;
-- Já existe no código desde antes desta rodada; garante a coluna em bancos criados a partir de dumps antigos.
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "recoveryAttempts" integer NOT NULL DEFAULT 0;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "birthDate" date;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "ageVerificationMethod" character varying(40);
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "termsVersion" character varying(20);
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" timestamp;
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "showLastSeen" boolean NOT NULL DEFAULT true;

DO $$ BEGIN
  CREATE TYPE reports_type_enum AS ENUM ('POST', 'USER', 'CHAT_MESSAGE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE reports ADD COLUMN IF NOT EXISTS type reports_type_enum NOT NULL DEFAULT 'POST';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS "chatMessageId" uuid;

DO $$ BEGIN
  ALTER TABLE reports ADD CONSTRAINT "FK_reports_chat_message"
    FOREIGN KEY ("chatMessageId") REFERENCES chat_messages(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
