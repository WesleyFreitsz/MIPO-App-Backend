-- Procuro jogadores: chamados para jogar agora (na loja) ou agendados. Idempotente.
DO $$ BEGIN
  CREATE TYPE play_calls_mode_enum AS ENUM ('NOW', 'SCHEDULED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE play_calls_status_enum AS ENUM ('OPEN', 'FULL', 'CLOSED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS play_calls (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "creatorId" uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "gameId" uuid REFERENCES games(id) ON DELETE SET NULL,
  title character varying(120) NOT NULL,
  mode play_calls_mode_enum NOT NULL,
  "scheduledFor" timestamp,
  "slotsNeeded" integer NOT NULL,
  note character varying(500),
  status play_calls_status_enum NOT NULL DEFAULT 'OPEN',
  "chatId" uuid,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_play_calls_status_mode" ON play_calls (status, mode);

CREATE TABLE IF NOT EXISTS play_call_members (
  "callId" uuid NOT NULL REFERENCES play_calls(id) ON DELETE CASCADE,
  "userId" uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "joinedAt" timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY ("callId", "userId")
);
