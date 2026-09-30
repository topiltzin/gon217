-- Optional player accounts. Run with `npm run db:migrate` (idempotent).
-- No personal data: a player is a preset nickname (word keys + number) and a hashed PIN.

CREATE TABLE IF NOT EXISTS players (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adjective       text NOT NULL,
  animal          text NOT NULL,
  number          smallint NOT NULL CHECK (number BETWEEN 1 AND 99),
  pin_hash        text NOT NULL,
  failed_attempts smallint NOT NULL DEFAULT 0,
  locked_until    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (adjective, animal, number)
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  player_id  uuid NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_player_idx ON sessions (player_id);

CREATE TABLE IF NOT EXISTS scores (
  player_id  uuid NOT NULL REFERENCES players (id) ON DELETE CASCADE,
  slug       text NOT NULL,
  best       integer NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, slug)
);

CREATE INDEX IF NOT EXISTS scores_slug_best_idx ON scores (slug, best);
