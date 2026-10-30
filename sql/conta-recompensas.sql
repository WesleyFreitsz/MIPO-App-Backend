-- Frente D: refresh tokens, papel MODERATOR e resgate de recompensas. Idempotente.
-- ALTER TYPE ... ADD VALUE não pode rodar dentro de transação no Postgres < 12; rode este arquivo fora de BEGIN/COMMIT.

ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'MODERATOR';

CREATE TABLE IF NOT EXISTS refresh_tokens (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" uuid NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "tokenHash" varchar(64) NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "revokedAt" timestamp NULL,
  "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "IDX_refresh_tokens_tokenHash" ON refresh_tokens ("tokenHash");
CREATE INDEX IF NOT EXISTS "IDX_refresh_tokens_userId" ON refresh_tokens ("userId");

DO $$ BEGIN
  CREATE TYPE reward_redemptions_status_enum AS ENUM ('PENDING', 'DELIVERED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS reward_redemptions (
  "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" uuid NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "rewardId" uuid NULL REFERENCES rewards("id") ON DELETE SET NULL,
  "rewardTitle" varchar NOT NULL,
  "price" int NOT NULL,
  "status" reward_redemptions_status_enum NOT NULL DEFAULT 'PENDING',
  "deliveredAt" timestamp NULL,
  "createdAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "IDX_reward_redemptions_userId" ON reward_redemptions ("userId");
