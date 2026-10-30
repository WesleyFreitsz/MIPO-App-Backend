-- Frente C: lembretes de evento, preferências de notificação e envios agendados.
BEGIN;

ALTER TABLE event ADD COLUMN IF NOT EXISTS "reminder24hSentAt" TIMESTAMP NULL;
ALTER TABLE event ADD COLUMN IF NOT EXISTS "reminder1hSentAt" TIMESTAMP NULL;

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" UUID NOT NULL,
  type VARCHAR(30) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  CONSTRAINT "UQ_notification_preferences_user_type" UNIQUE ("userId", type)
);

CREATE TABLE IF NOT EXISTS scheduled_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR NOT NULL,
  message VARCHAR NOT NULL,
  icon VARCHAR NULL,
  "eventId" UUID NULL,
  "sendAt" TIMESTAMP NOT NULL,
  "sentAt" TIMESTAMP NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now()
);

-- Papel de moderador (o enum é criado pelo TypeORM como user_role_enum)
ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'MODERATOR';

COMMIT;
