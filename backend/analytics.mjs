// analytics.mjs — Persistent analytics layer (PostgreSQL)
// Connects to Railway Postgres via DATABASE_URL env var.
// Falls back to in-memory buffer if no DB is configured.

import pg from "pg";
const { Pool } = pg;

let pool = null;
let dbReady = false;

// ──────────────────────────────────────
// Connection
// ──────────────────────────────────────
export async function initAnalytics() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[analytics] No DATABASE_URL — running in-memory only (data lost on restart)");
    return false;
  }

  try {
    pool = new Pool({
      connectionString: url,
      ssl: url.includes("railway") ? { rejectUnauthorized: false } : false,
      max: 5,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });

    // Test connection
    const client = await pool.connect();
    await client.query("SELECT 1");
    client.release();

    // Auto-create tables if they don't exist
    await runMigrations();

    dbReady = true;
    console.log("[analytics] PostgreSQL connected — persistent analytics active");
    return true;
  } catch (err) {
    console.error("[analytics] DB connection failed:", err.message);
    console.warn("[analytics] Falling back to in-memory analytics");
    return false;
  }
}

async function runMigrations() {
  const schema = `
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

    CREATE TABLE IF NOT EXISTS turns (
      id            SERIAL PRIMARY KEY,
      run_id        TEXT NOT NULL,
      age           INT NOT NULL,
      scenario_text TEXT,
      option_a      TEXT,
      option_b      TEXT,
      chosen        TEXT,
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

    CREATE TABLE IF NOT EXISTS stat_snapshots (
      id            SERIAL PRIMARY KEY,
      run_id        TEXT NOT NULL,
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
  `;

  await pool.query(schema);
}

// ──────────────────────────────────────
// In-memory fallback (existing behavior)
// ──────────────────────────────────────
const MEM_EVENTS = [];
const MEM_MAX = 5000;

function memLog(event) {
  MEM_EVENTS.push({ ...event, ts: Date.now() });
  if (MEM_EVENTS.length > MEM_MAX) MEM_EVENTS.shift();
}

// ──────────────────────────────────────
// Write operations
// ──────────────────────────────────────

/** Register a new game run */
export async function logGameStart({ session_id, run_id, gender, city, desire }) {
  memLog({ type: "game_start", session_id, run_id, data: { gender, city, desire } });

  if (!dbReady) return;
  try {
    await pool.query(
      `INSERT INTO runs (session_id, run_id, gender, city, desire)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (run_id) DO NOTHING`,
      [session_id, run_id, gender, city, desire]
    );
  } catch (err) {
    console.error("[analytics] logGameStart error:", err.message);
  }
}

/** Log a turn — the scenario, both options, and (later) the choice made */
export async function logTurn({
  run_id, age, scenario_text, option_a, option_b,
  stats_before, relationships, death_cause_hint
}) {
  memLog({ type: "turn", run_id, data: { age } });

  if (!dbReady) return;
  try {
    await pool.query(
      `INSERT INTO turns (run_id, age, scenario_text, option_a, option_b, stats_before, relationships, death_cause_hint)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [run_id, age, scenario_text, option_a, option_b,
       JSON.stringify(stats_before), JSON.stringify(relationships), death_cause_hint]
    );
  } catch (err) {
    console.error("[analytics] logTurn error:", err.message);
  }
}

/** Record the player's choice + resulting stat changes */
export async function logChoice({
  run_id, age, chosen, chosen_label, effects, stats_after
}) {
  memLog({ type: "choice", run_id, data: { age, chosen, chosen_label } });

  if (!dbReady) return;
  try {
    // Update the most recent turn for this run+age
    await pool.query(
      `UPDATE turns SET chosen = $1, chosen_label = $2, effects = $3, stats_after = $4
       WHERE id = (
         SELECT id FROM turns WHERE run_id = $5 AND age = $6 ORDER BY created_at DESC LIMIT 1
       )`,
      [chosen, chosen_label, JSON.stringify(effects), JSON.stringify(stats_after), run_id, age]
    );

    // Also snapshot the stats
    const s = stats_after || {};
    await pool.query(
      `INSERT INTO stat_snapshots (run_id, age, money, stability, status, health, stress, freedom, exposure)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [run_id, age, s.money, s.stability, s.status, s.health, s.stress, s.freedom, s.exposure]
    );
  } catch (err) {
    console.error("[analytics] logChoice error:", err.message);
  }
}

/** Record a death — end of a run */
export async function logDeath({
  run_id, age, cause, final_stats, verdict, achievements
}) {
  memLog({ type: "death", run_id, data: { age, cause } });

  if (!dbReady) return;
  try {
    await pool.query(
      `UPDATE runs SET ended_at = NOW(), death_age = $1, death_cause = $2,
         final_stats = $3, verdict = $4, achievements = $5
       WHERE run_id = $6`,
      [age, cause, JSON.stringify(final_stats), verdict, achievements, run_id]
    );
  } catch (err) {
    console.error("[analytics] logDeath error:", err.message);
  }
}

/** Generic event log */
export async function logEvent({ type, session_id, run_id, data }) {
  memLog({ type, session_id, run_id, data });

  if (!dbReady) return;
  try {
    await pool.query(
      `INSERT INTO events (session_id, run_id, event_type, data) VALUES ($1, $2, $3, $4)`,
      [session_id || null, run_id || null, type, JSON.stringify(data || {})]
    );
  } catch (err) {
    console.error("[analytics] logEvent error:", err.message);
  }
}

// ──────────────────────────────────────
// Read operations (for dashboard)
// ──────────────────────────────────────

/** Overview stats */
export async function getSummary() {
  if (!dbReady) {
    // Fallback: compute from memory
    const counts = {};
    let totalDeathAge = 0, deathCount = 0;
    const desires = {};
    for (const e of MEM_EVENTS) {
      counts[e.type] = (counts[e.type] || 0) + 1;
      if (e.type === "death" && e.data?.age) { totalDeathAge += e.data.age; deathCount++; }
      if (e.type === "game_start" && e.data?.desire) {
        const d = String(e.data.desire).toLowerCase().trim();
        desires[d] = (desires[d] || 0) + 1;
      }
    }
    return {
      db_connected: false,
      total_events: MEM_EVENTS.length,
      event_counts: counts,
      avg_death_age: deathCount > 0 ? Math.round(totalDeathAge / deathCount) : null,
      top_desires: Object.entries(desires).sort((a, b) => b[1] - a[1]).slice(0, 20)
        .map(([desire, count]) => ({ desire, count })),
    };
  }

  const [runsRes, deathRes, desiresRes, eventsRes, recentRes] = await Promise.all([
    pool.query(`SELECT COUNT(*) AS total, COUNT(death_age) AS completed FROM runs`),
    pool.query(`SELECT ROUND(AVG(death_age)) AS avg_age, MIN(death_age) AS min_age, MAX(death_age) AS max_age FROM runs WHERE death_age IS NOT NULL`),
    pool.query(`SELECT LOWER(TRIM(desire)) AS desire, COUNT(*) AS count FROM runs WHERE desire IS NOT NULL AND desire != '' GROUP BY LOWER(TRIM(desire)) ORDER BY count DESC LIMIT 30`),
    pool.query(`SELECT event_type, COUNT(*) AS count FROM events GROUP BY event_type ORDER BY count DESC`),
    pool.query(`SELECT run_id, city, desire, gender, death_age, death_cause, started_at FROM runs ORDER BY started_at DESC LIMIT 20`),
  ]);

  return {
    db_connected: true,
    total_runs: parseInt(runsRes.rows[0].total),
    completed_runs: parseInt(runsRes.rows[0].completed),
    avg_death_age: deathRes.rows[0].avg_age ? parseInt(deathRes.rows[0].avg_age) : null,
    min_death_age: deathRes.rows[0].min_age,
    max_death_age: deathRes.rows[0].max_age,
    top_desires: desiresRes.rows,
    event_counts: Object.fromEntries(eventsRes.rows.map(r => [r.event_type, parseInt(r.count)])),
    recent_runs: recentRes.rows,
  };
}

/** Get a single player's full journey */
export async function getPlayerJourney(run_id) {
  if (!dbReady) return null;

  const [runRes, turnsRes, snapshotsRes] = await Promise.all([
    pool.query(`SELECT * FROM runs WHERE run_id = $1`, [run_id]),
    pool.query(`SELECT * FROM turns WHERE run_id = $1 ORDER BY age ASC, created_at ASC`, [run_id]),
    pool.query(`SELECT * FROM stat_snapshots WHERE run_id = $1 ORDER BY age ASC`, [run_id]),
  ]);

  if (runRes.rows.length === 0) return null;

  return {
    run: runRes.rows[0],
    turns: turnsRes.rows,
    stat_arc: snapshotsRes.rows,
  };
}

/** Death leaderboard — oldest/youngest deaths, filtered */
export async function getDeathBoard({ sort = "oldest", limit = 50, city = null } = {}) {
  if (!dbReady) return [];

  let orderCol = "death_age";
  let orderDir = "DESC";
  if (sort === "youngest") { orderCol = "death_age"; orderDir = "ASC"; }
  else if (sort === "newest") { orderCol = "ended_at"; orderDir = "DESC NULLS LAST"; }

  const where = city ? `WHERE death_age IS NOT NULL AND LOWER(city) = LOWER($2)` : `WHERE death_age IS NOT NULL`;
  const params = city ? [limit, city] : [limit];

  const res = await pool.query(
    `SELECT run_id, city, desire, gender, death_age, death_cause, verdict, started_at
     FROM runs ${where}
     ORDER BY ${orderCol} ${orderDir}
     LIMIT $1`,
    params
  );
  return res.rows;
}

/** City breakdown */
export async function getCityStats() {
  if (!dbReady) return [];

  const res = await pool.query(`
    SELECT
      city,
      COUNT(*) AS total_runs,
      COUNT(death_age) AS completed,
      ROUND(AVG(death_age)) AS avg_death_age,
      MIN(death_age) AS youngest,
      MAX(death_age) AS oldest
    FROM runs
    WHERE city IS NOT NULL AND city != ''
    GROUP BY city
    ORDER BY total_runs DESC
    LIMIT 50
  `);
  return res.rows;
}

/** Choice analysis — what do people pick? */
export async function getChoicePatterns() {
  if (!dbReady) return [];

  const res = await pool.query(`
    SELECT
      age,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE chosen = 'A') AS chose_a,
      COUNT(*) FILTER (WHERE chosen = 'B') AS chose_b,
      ROUND(100.0 * COUNT(*) FILTER (WHERE chosen = 'A') / NULLIF(COUNT(*), 0)) AS pct_a
    FROM turns
    WHERE chosen IS NOT NULL
    GROUP BY age
    ORDER BY age
  `);
  return res.rows;
}

/** Stat averages by age — what does the "average life" look like? */
export async function getStatAverages() {
  if (!dbReady) return [];

  const res = await pool.query(`
    SELECT
      age,
      COUNT(*) AS sample_size,
      ROUND(AVG(money)::numeric, 3) AS money,
      ROUND(AVG(stability)::numeric, 3) AS stability,
      ROUND(AVG(status)::numeric, 3) AS status,
      ROUND(AVG(health)::numeric, 3) AS health,
      ROUND(AVG(stress)::numeric, 3) AS stress,
      ROUND(AVG(freedom)::numeric, 3) AS freedom,
      ROUND(AVG(exposure)::numeric, 3) AS exposure
    FROM stat_snapshots
    GROUP BY age
    ORDER BY age
  `);
  return res.rows;
}

export function isDbReady() {
  return dbReady;
}

/** Leaderboard — all the data the public leaderboard needs in one call */
export async function getLeaderboard() {
  if (!dbReady) return null;

  const [
    globalRes, oldestRes, youngestRes, recentRes,
    citiesRes, desiresRes, causeRes
  ] = await Promise.all([
    // Global stats
    pool.query(`
      SELECT COUNT(*) AS total_lives,
        COUNT(death_age) AS completed,
        ROUND(AVG(death_age)) AS avg_age,
        MIN(death_age) AS youngest,
        MAX(death_age) AS oldest,
        COUNT(DISTINCT city) AS unique_cities,
        COUNT(DISTINCT LOWER(TRIM(desire))) AS unique_desires
      FROM runs
    `),
    // Hall of Elders — top 20 longest lives
    pool.query(`
      SELECT run_id, city, desire, gender, death_age, death_cause, verdict
      FROM runs WHERE death_age IS NOT NULL
      ORDER BY death_age DESC LIMIT 20
    `),
    // Gone Too Soon — top 20 shortest lives
    pool.query(`
      SELECT run_id, city, desire, gender, death_age, death_cause, verdict
      FROM runs WHERE death_age IS NOT NULL
      ORDER BY death_age ASC LIMIT 20
    `),
    // Recent deaths
    pool.query(`
      SELECT run_id, city, desire, gender, death_age, death_cause, verdict, ended_at
      FROM runs WHERE death_age IS NOT NULL
      ORDER BY ended_at DESC NULLS LAST LIMIT 20
    `),
    // Most dangerous cities (show all with completed runs)
    pool.query(`
      SELECT city, COUNT(*) AS lives, ROUND(AVG(death_age)) AS avg_age,
        MIN(death_age) AS youngest, MAX(death_age) AS oldest
      FROM runs WHERE death_age IS NOT NULL AND city IS NOT NULL AND city != ''
      GROUP BY city
      ORDER BY AVG(death_age) ASC LIMIT 15
    `),
    // Most popular desires
    pool.query(`
      SELECT LOWER(TRIM(desire)) AS desire, COUNT(*) AS times,
        ROUND(AVG(death_age)) AS avg_age,
        COUNT(*) FILTER (WHERE death_age >= 70) AS elders,
        COUNT(*) FILTER (WHERE death_age < 25) AS cut_short
      FROM runs WHERE desire IS NOT NULL AND desire != ''
      GROUP BY LOWER(TRIM(desire))
      ORDER BY times DESC LIMIT 15
    `),
    // Epitaphs — the final verdicts (most recent, player-facing text)
    pool.query(`
      SELECT city, desire, death_age, verdict
      FROM runs
      WHERE verdict IS NOT NULL AND verdict != '' AND death_age IS NOT NULL
      ORDER BY ended_at DESC NULLS LAST LIMIT 20
    `),
  ]);

  return {
    global: globalRes.rows[0],
    oldest: oldestRes.rows,
    youngest: youngestRes.rows,
    recent: recentRes.rows,
    dangerous_cities: citiesRes.rows,
    popular_desires: desiresRes.rows,
    common_causes: causeRes.rows,
  };
}
