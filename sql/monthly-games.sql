-- Jogos do mês, partidas pontuadas e marcações de jogos (favorito, quero jogar, avaliação).
BEGIN;

CREATE TABLE IF NOT EXISTS public.monthly_games (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
    year integer NOT NULL,
    month integer NOT NULL,
    "gameId" uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    "prizeFirst" character varying,
    "prizeSecond" character varying,
    "prizeThird" character varying,
    rules text,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT "UQ_monthly_games_year_month_game" UNIQUE (year, month, "gameId")
);

DO $$ BEGIN
    CREATE TYPE public.monthly_game_scores_status_enum AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.monthly_game_scores (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
    "monthlyGameId" uuid NOT NULL REFERENCES public.monthly_games(id) ON DELETE CASCADE,
    "userId" uuid NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
    score integer NOT NULL,
    "proofImageUrl" character varying,
    note text,
    status public.monthly_game_scores_status_enum DEFAULT 'PENDING' NOT NULL,
    "rejectionReason" character varying,
    "reviewedById" uuid,
    "reviewedAt" timestamp without time zone,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "IDX_monthly_game_scores_game_status"
    ON public.monthly_game_scores ("monthlyGameId", status);

CREATE TABLE IF NOT EXISTS public.game_user_marks (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL PRIMARY KEY,
    "gameId" uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
    "userId" uuid NOT NULL REFERENCES public."user"(id) ON DELETE CASCADE,
    "isFavorite" boolean DEFAULT false NOT NULL,
    "wantsToPlay" boolean DEFAULT false NOT NULL,
    rating integer CHECK (rating BETWEEN 1 AND 5),
    review text,
    "updatedAt" timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT "UQ_game_user_marks_game_user" UNIQUE ("gameId", "userId")
);

COMMIT;
