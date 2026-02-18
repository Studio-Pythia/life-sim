-- ══════════════════════════════════════════════════════════
-- LIFE SIM ANALYTICS — PostgreSQL Schema
-- Deploy on Railway Postgres (one-click from dashboard)
-- ══════════════════════════════════════════════════════════

-- Runs: one row per complete playthrough
CREATE TABLE IF NOT EXISTS runs (
  id            SERIAL PRIMARY KEY,
  session_id    TEXT NOT NULL,
  run_id        TEXT NOT NULL UNIQUE,
  gender        TEXT,
  city          TEXT,
  desire        TEXT,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at      TIMESTAMPTZ,
  death_age     INT,
  death_cause   TEXT,
  final_stats   JSONB,
  verdict       TEXT,
  achievements  TEXT
);

CREATE INDEX IF NOT EXISTS idx_runs_session ON runs(session_id);
CREATE INDEX IF NOT EXISTS idx_runs_city ON runs(city);
CREATE INDEX IF NOT EXISTS idx_runs_started ON runs(started_at);

-- Turns: every decision point in a player's life
CREATE TABLE IF NOT EXISTS turns (
  id            SERIAL PRIMARY KEY,
  run_id        TEXT NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
  age           INT NOT NULL,
  scenario_text TEXT,
  option_a      TEXT,
  option_b      TEXT,
  chosen        TEXT,           -- 'A' or 'B'
  chosen_label  TEXT,
  stats_before  JSONB,
  stats_after   JSONB,
  effects       JSONB,
  relationships JSONB,
  death_cause_hint TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_turns_run ON turns(run_id);
CREATE INDEX IF NOT EXISTS idx_turns_age ON turns(age);

-- Events: lightweight event stream for anything else
-- (game_start, death, custom client events, errors, etc.)
CREATE TABLE IF NOT EXISTS events (
  id            SERIAL PRIMARY KEY,
  session_id    TEXT,
  run_id        TEXT,
  event_type    TEXT NOT NULL,
  data          JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_run ON events(run_id);
CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);

-- Stat snapshots: one row per age checkpoint, for plotting arcs
CREATE TABLE IF NOT EXISTS stat_snapshots (
  id            SERIAL PRIMARY KEY,
  run_id        TEXT NOT NULL REFERENCES runs(run_id) ON DELETE CASCADE,
  age           INT NOT NULL,
  money         REAL,
  stability     REAL,
  status        REAL,
  health        REAL,
  stress        REAL,
  freedom       REAL,
  exposure      REAL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_run ON stat_snapshots(run_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_run_age ON stat_snapshots(run_id, age);

-- ══════════════════════════════════════════════════════════
-- USEFUL VIEWS for quick querying
-- ══════════════════════════════════════════════════════════

-- Player journey summary
CREATE OR REPLACE VIEW run_summaries AS
SELECT
  r.run_id,
  r.gender,
  r.city,
  r.desire,
  r.started_at,
  r.death_age,
  r.death_cause,
  r.verdict,
  COUNT(t.id) AS total_turns,
  COUNT(t.id) FILTER (WHERE t.chosen = 'A') AS chose_a,
  COUNT(t.id) FILTER (WHERE t.chosen = 'B') AS chose_b
FROM runs r
LEFT JOIN turns t ON t.run_id = r.run_id
GROUP BY r.id;

-- Death statistics
CREATE OR REPLACE VIEW death_stats AS
SELECT
  city,
  COUNT(*) AS deaths,
  ROUND(AVG(death_age)) AS avg_death_age,
  MIN(death_age) AS youngest_death,
  MAX(death_age) AS oldest_death,
  MODE() WITHIN GROUP (ORDER BY death_cause) AS most_common_cause
FROM runs
WHERE death_age IS NOT NULL
GROUP BY city;

-- Popular desires
CREATE OR REPLACE VIEW desire_rankings AS
SELECT
  LOWER(TRIM(desire)) AS desire,
  COUNT(*) AS times_chosen,
  ROUND(AVG(death_age)) AS avg_death_age,
  COUNT(*) FILTER (WHERE death_age >= 70) AS lived_long,
  COUNT(*) FILTER (WHERE death_age < 30) AS died_young
FROM runs
WHERE desire IS NOT NULL AND desire != ''
GROUP BY LOWER(TRIM(desire))
ORDER BY times_chosen DESC;
