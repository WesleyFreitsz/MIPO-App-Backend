-- Frente 1 (loja): check-in por QR, presença e papel WAITER. Idempotente.
-- Rode fora de BEGIN/COMMIT por causa do ALTER TYPE ... ADD VALUE.
ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'WAITER';

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "showInStorePresence" boolean NOT NULL DEFAULT true;

DO $$ BEGIN
  CREATE TYPE store_visits_source_enum AS ENUM ('QR', 'STAFF');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS store_visits (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "checkedInAt" timestamp NOT NULL DEFAULT now(),
  "checkedOutAt" timestamp,
  source store_visits_source_enum NOT NULL DEFAULT 'QR',
  "checkedInById" uuid
);

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_store_visits_open_user"
  ON store_visits ("userId") WHERE "checkedOutAt" IS NULL;
CREATE INDEX IF NOT EXISTS "IDX_store_visits_checkedInAt"
  ON store_visits ("checkedInAt");

CREATE TABLE IF NOT EXISTS store_checkin_codes (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code character varying(64) NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  "createdAt" timestamp NOT NULL DEFAULT now()
);
