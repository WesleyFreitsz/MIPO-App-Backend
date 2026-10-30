-- Histórico de jogos: partidas vindas de pedidos de jogo ou registradas à mão. Idempotente.
DO $$ BEGIN
  CREATE TYPE game_plays_source_enum AS ENUM ('ORDER', 'MANUAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS game_plays (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  "gameId" uuid NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  "userId" uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  "playedAt" timestamp NOT NULL,
  source game_plays_source_enum NOT NULL,
  "orderItemId" uuid,
  note text,
  "createdAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "IDX_game_plays_user_played" ON game_plays ("userId", "playedAt");
CREATE INDEX IF NOT EXISTS "IDX_game_plays_game" ON game_plays ("gameId");
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_game_plays_order_item" ON game_plays ("orderItemId");

CREATE TABLE IF NOT EXISTS game_play_players (
  "playId" uuid NOT NULL REFERENCES game_plays(id) ON DELETE CASCADE,
  "userId" uuid NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  PRIMARY KEY ("playId", "userId")
);

CREATE INDEX IF NOT EXISTS "IDX_game_play_players_user" ON game_play_players ("userId");
