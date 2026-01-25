// server.mjs
// Life Sim Backend (Express + OpenAI Structured Outputs)
// ✅ JSON-safe output via json_schema (no "invalid JSON" drift)
// ✅ Birth turn generates initial stats + 3 relationships
// ✅ Subsequent turns generate pivotal moments + 2 choices
// ✅ Hidden mortality (only reveals death when it happens)
// ✅ Prefetches next turn for A and B to reduce wait time
// ✅ Enforces: every person mentioned must be "Name (role)"

// ----------------------
// Setup
// ----------------------
import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import OpenAI from "openai";

const app = express();
app.use(express.json({ limit: "1mb" }));

const PORT = process.env.PORT || 8787;

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// In prod, replace origin:true with your frontend domain
app.use(
  cors({
    origin: true,
    methods: ["POST", "GET", "OPTIONS"],
  })
);

app.use(
  rateLimit({
    windowMs: 60_000,
    max: 60,
  })
);

app.get("/health", (_, res) => res.json({ ok: true, time: Date.now() }));

// ----------------------
// Utilities
// ----------------------
const STAT_KEYS = ["money", "stability", "status", "health", "stress", "freedom", "exposure"];

function clamp01(x) {
  const n = Number(x);
  if (Number.isNaN(n)) return 0.5;
  return Math.max(0, Math.min(1, n));
}

function randomInt(min, maxInclusive) {
  return Math.floor(min + Math.random() * (maxInclusive - min + 1));
}

// 5–15 years as requested
function jumpYears() {
  return randomInt(5, 15);
}

function runNonce() {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}

function normalizeStats(stats) {
  const out = {};
  for (const k of STAT_KEYS) out[k] = clamp01(stats?.[k] ?? 0.5);
  return out;
}

function normalizeEffects(effects) {
  // Effects must include ALL keys for schema stability.
  // If model ever misses, we fill.
  const out = {};
  for (const k of STAT_KEYS) out[k] = Number(effects?.[k] ?? 0);
  return out;
}

function applyEffects(stats, effects) {
  const base = normalizeStats(stats);
  const eff = normalizeEffects(effects);

  const next = {};
  for (const k of STAT_KEYS) {
    next[k] = clamp01(base[k] + eff[k]);
  }
  return next;
}

// Make sure relationships are always returned with display = "Name (role)"
function withDisplayRelationships(rels) {
  const arr = Array.isArray(rels) ? rels : [];
  return arr.slice(0, 3).map((p) => {
    const name = String(p?.name || "").trim();
    const role = String(p?.role || "").trim();
    const display = name && role ? `${name} (${role})` : name || role || "";
    return { name, role, display };
  });
}

/**
 * Hidden mortality:
 * - extremely low in early childhood (you should not be dying at 0 routinely)
 * - rises with age + low health + high stress + high exposure
 */
function computeMortalityChance(age, stats) {
  const a = Math.max(0, Math.min(112, Number(age) || 0));
  const s = normalizeStats(stats);

  // newborn/infancy: very small baseline
  if (a < 2) {
    const base = 0.00015;
    const exposure = s.exposure * 0.0006;
    const health = (1 - s.health) * 0.0009;
    return Math.min(0.01, base + exposure + health);
  }

  // childhood: still low
  if (a < 12) {
    const base = 0.00035;
    const exposure = s.exposure * 0.0012;
    const health = (1 - s.health) * 0.0016;
    return Math.min(0.02, base + exposure + health);
  }

  // adulthood: nonlinear rise
  const base = Math.min(0.65, Math.pow(a / 112, 3) * 0.55);
  const healthPenalty = (1 - s.health) * 0.22;
  const stressPenalty = s.stress * 0.14;
  const exposurePenalty = s.exposure * 0.16;

  const stabilityBuffer = (s.stability - 0.5) * 0.04;
  const freedomBuffer = (s.freedom - 0.5) * 0.03;

  const p = base + healthPenalty + stressPenalty + exposurePenalty - stabilityBuffer - freedomBuffer;
  return Math.max(0.002, Math.min(0.92, p));
}

// ----------------------
// Prefetch cache (MVP in-memory)
// ----------------------
const PREFETCH = new Map();
const PREFETCH_TTL_MS = 1000 * 60 * 10;

function prefetchKey(session_id, run_id, age, letter) {
  return `${session_id}:${run_id}:${age}:${letter}`;
}

function setPrefetch(k, payload) {
  PREFETCH.set(k, { ...payload, createdAt: Date.now() });
}

function getPrefetch(k) {
  const v = PREFETCH.get(k);
  if (!v) return null;
  if (Date.now() - v.createdAt > PREFETCH_TTL_MS) {
    PREFETCH.delete(k);
    return null;
  }
  return v;
}

// ----------------------
// Structured Outputs Schemas (STRICT)
// NOTE: required must contain all keys in "properties"
// ----------------------
const EFFECTS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    money: { type: "number" },
    stability: { type: "number" },
    status: { type: "number" },
    health: { type: "number" },
    stress: { type: "number" },
    freedom: { type: "number" },
    exposure: { type: "number" },
  },
  required: ["money", "stability", "status", "health", "stress", "freedom", "exposure"],
};

const OPTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    label: { type: "string" },
    effects: EFFECTS_SCHEMA,
  },
  required: ["label", "effects"],
};

const REL_CHANGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    replace_index: {
      anyOf: [{ type: "integer", minimum: 0, maximum: 2 }, { type: "null" }],
    },
    new_person: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            role: { type: "string" },
          },
          required: ["name", "role"],
        },
        { type: "null" },
      ],
    },
  },
  required: ["replace_index", "new_person"],
};

const TurnJSONSchema = {
  name: "LifeTurn",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      text: { type: "string" },
      options: {
        type: "array",
        minItems: 2,
        maxItems: 2,
        items: OPTION_SCHEMA,
      },
      relationship_changes: REL_CHANGE_SCHEMA,
      death_cause_hint: { type: "string" },
    },
    required: ["text", "options", "relationship_changes", "death_cause_hint"],
  },
};

const BirthJSONSchema = {
  name: "BirthTurn",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      text: { type: "string" },
      options: {
        type: "array",
        minItems: 2,
        maxItems: 2,
        items: OPTION_SCHEMA,
      },
      relationships: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            name: { type: "string" },
            role: { type: "string" },
          },
          required: ["name", "role"],
        },
      },
      birth_stats: {
        type: "object",
        additionalProperties: false,
        properties: {
          money: { type: "number" },
          stability: { type: "number" },
          status: { type: "number" },
          health: { type: "number" },
          stress: { type: "number" },
          freedom: { type: "number" },
          exposure: { type: "number" },
        },
        required: ["money", "stability", "status", "health", "stress", "freedom", "exposure"],
      },
      death_cause_hint: { type: "string" },
    },
    required: ["text", "options", "relationships", "birth_stats", "death_cause_hint"],
  },
};

// ----------------------
// Prompts (NO prewritten narrative)
// Only rules. Model creates everything.
// ----------------------
function systemPrompt() {
  return `
You generate pivotal life moments for a binary-choice life simulator.

Hard rules:
- Always address the player as "you".
- First names only.
- Any time you mention a person in prose, you MUST format as: Name (role).
  Example: "Maya (mother)", "Sam (friend)".
- No headings, no lists, no tables, no section labels.
- No odds, no "life report", never use the word "pivot".
- 1 paragraph of fast prose, max ~900 characters.
- Prose must include: living situation, source of income, lifestyle, and what happens next.
- Moment must be critical and volatile.
- Exactly 2 choices labeled A and B (short, explicit actions).
- Effects must be realistic; each between -0.25 and +0.25.
- Each option.effects MUST include ALL keys:
  money, stability, status, health, stress, freedom, exposure.
- Output must be valid JSON matching the given schema exactly.
`.trim();
}

function birthInstruction() {
  return `
This is the birth turn (Age 0).
You must:
- Infer plausible starting life context from: city, gender, desire.
- Generate 3 relationships (first name + role). Roles must be believable at birth.
- Compute birth_stats (0..1) for: money, stability, status, health, stress, freedom, exposure.
- Write prose describing birth context and the first defining decision.
- Provide 2 choices (A/B) as an early-life fork shaping the entire trajectory.

Remember: any person mentioned in prose must be "Name (role)".
`.trim();
}

// ----------------------
// OpenAI wrapper
// ----------------------
async function generateTurn({ isBirth, payload }) {
  const schema = isBirth ? BirthJSONSchema : TurnJSONSchema;

  const response = await client.responses.create({
    model: "gpt-4.1",
    input: [
      { role: "system", content: systemPrompt() },
      ...(isBirth ? [{ role: "user", content: birthInstruction() }] : []),
      { role: "user", content: JSON.stringify(payload) },
    ],
    max_output_tokens: 950,
    text: {
      format: {
        type: "json_schema",
        ...schema,
      },
    },
  });

  const raw = response.output_text;
  if (!raw) throw new Error("OpenAI returned empty output_text");

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Model output not parseable JSON");
  }
}

// ----------------------
// Routes
// ----------------------
app.post("/api/turn", async (req, res) => {
  const t0 = Date.now();

  try {
    const state = req.body?.state;
    if (!state) {
      return res.status(400).json({ error: "bad_request", message: "Missing state" });
    }

    const session_id = String(state.session_id || "").trim();
    const run_id = String(state.run_id || "").trim();
    if (!session_id || !run_id) {
      return res.status(400).json({ error: "bad_request", message: "Missing session_id/run_id" });
    }

    const age_from = Number(state.age ?? 0);
    const isBirth = age_from === 0 && (!state.history || state.history.length === 0);

    // If not birth, try serve prefetched result based on last choice letter
    if (!isBirth && Array.isArray(state.history) && state.history.length > 0) {
      const last = String(state.history[state.history.length - 1] || "").trim();
      const letter = last.startsWith("A") ? "A" : last.startsWith("B") ? "B" : null;

      if (letter) {
        const k = prefetchKey(session_id, run_id, age_from, letter);
        const cached = getPrefetch(k);
        if (cached?.scenario) {
          return res.json({
            age_from,
            age_to: cached.age_to,
            scenario: cached.scenario,
            relationships: cached.relationships || [],
            elapsed_ms: Date.now() - t0,
            used_prefetch: true,
          });
        }
      }
    }

    const age_to = isBirth ? 0 : Math.min(112, age_from + jumpYears());

    const payload = {
      nonce: runNonce(),
      session_id,
      run_id,
      age_from,
      age_to,
      gender: String(state.gender || "unspecified"),
      city: String(state.city || ""),
      desire: String(state.desire || ""),
      stats: normalizeStats(state.stats),
      relationships: withDisplayRelationships(state.relationships),
      history: Array.isArray(state.history) ? state.history.slice(-18) : [],
    };

    const out = await generateTurn({ isBirth, payload });

    // Normalize scenario (effects must contain all keys)
    const scenario = {
      text: String(out.text || ""),
      options: [
        { label: String(out.options?.[0]?.label || "A"), effects: normalizeEffects(out.options?.[0]?.effects) },
        { label: String(out.options?.[1]?.label || "B"), effects: normalizeEffects(out.options?.[1]?.effects) },
      ],
      relationship_changes: out.relationship_changes || { replace_index: null, new_person: null },
      death_cause_hint: String(out.death_cause_hint || ""),
    };

    // Relationships returned to client:
    let relationships = payload.relationships;

    // Apply model-driven relationship change (if any)
    const rc = scenario.relationship_changes;
    if (rc && rc.replace_index !== null && rc.new_person) {
      const idx = Number(rc.replace_index);
      if (idx >= 0 && idx <= 2 && relationships.length === 3) {
        const np = { name: String(rc.new_person.name || ""), role: String(rc.new_person.role || "") };
        const updated = [...relationships];
        updated[idx] = { ...np, display: `${np.name} (${np.role})` };
        relationships = updated;
      }
    }

    // Background prefetch next A and B (to make the next click instant)
    (async () => {
      try {
        const baseStats = payload.stats;

        const nextStatsA = applyEffects(baseStats, scenario.options[0].effects);
        const nextStatsB = applyEffects(baseStats, scenario.options[1].effects);

        const preYearsA = jumpYears();
        const preYearsB = jumpYears();

        const payloadA = {
          ...payload,
          nonce: runNonce(),
          stats: nextStatsA,
          relationships,
          history: [...payload.history, scenario.options[0].label].slice(-18),
          age_from,
          age_to: Math.min(112, age_from + preYearsA),
        };

        const payloadB = {
          ...payload,
          nonce: runNonce(),
          stats: nextStatsB,
          relationships,
          history: [...payload.history, scenario.options[1].label].slice(-18),
          age_from,
          age_to: Math.min(112, age_from + preYearsB),
        };

        const outA = await generateTurn({ isBirth: false, payload: payloadA });
        const outB = await generateTurn({ isBirth: false, payload: payloadB });

        const scA = {
          text: String(outA.text || ""),
          options: [
            { label: String(outA.options?.[0]?.label || "A"), effects: normalizeEffects(outA.options?.[0]?.effects) },
            { label: String(outA.options?.[1]?.label || "B"), effects: normalizeEffects(outA.options?.[1]?.effects) },
          ],
          relationship_changes: outA.relationship_changes || { replace_index: null, new_person: null },
          death_cause_hint: String(outA.death_cause_hint || ""),
        };

        const scB = {
          text: String(outB.text || ""),
          options: [
            { label: String(outB.options?.[0]?.label || "A"), effects: normalizeEffects(outB.options?.[0]?.effects) },
            { label: String(outB.options?.[1]?.label || "B"), effects: normalizeEffects(outB.options?.[1]?.effects) },
          ],
          relationship_changes: outB.relationship_changes || { replace_index: null, new_person: null },
          death_cause_hint: String(outB.death_cause_hint || ""),
        };

        setPrefetch(prefetchKey(session_id, run_id, age_from, "A"), {
          age_to: payloadA.age_to,
          scenario: scA,
          relationships,
        });

        setPrefetch(prefetchKey(session_id, run_id, age_from, "B"), {
          age_to: payloadB.age_to,
          scenario: scB,
          relationships,
        });
      } catch {
        // prefetch silently fails; main turn remains fine
      }
    })();

    // Birth response includes initial stats + relationships for frontend state
    if (isBirth) {
      return res.json({
        age_from,
        age_to,
        scenario,
        birth_stats: normalizeStats(out.birth_stats),
        relationships: withDisplayRelationships(out.relationships),
        elapsed_ms: Date.now() - t0,
        used_prefetch: false,
      });
    }

    return res.json({
      age_from,
      age_to,
      scenario,
      relationships,
      elapsed_ms: Date.now() - t0,
      used_prefetch: false,
    });
  } catch (err) {
    console.error("TURN FAILED:", err);
    return res.status(500).json({
      error: "turn_failed",
      message: err?.message || String(err),
      elapsed_ms: Date.now() - t0,
      code: err?.code || null,
      status: err?.status || null,
    });
  }
});

app.post("/api/apply", (req, res) => {
  try {
    const age = Number(req.body?.age ?? 0);
    const stats = req.body?.stats;
    const effects = req.body?.effects;

    if (!stats || typeof stats !== "object") {
      return res.status(400).json({ error: "bad_request", message: "Missing stats" });
    }
    if (!effects || typeof effects !== "object") {
      return res.status(400).json({ error: "bad_request", message: "Missing effects" });
    }

    const next_stats = applyEffects(stats, effects);

    const pDeath = computeMortalityChance(age, next_stats);
    const died = Math.random() < pDeath;

    return res.json({ next_stats, died });
  } catch (err) {
    return res.status(500).json({
      error: "apply_failed",
      message: err?.message || String(err),
    });
  }
});

app.post("/api/epilogue", async (req, res) => {
  try {
    const age = Number(req.body?.age ?? 0);
    const gender = String(req.body?.gender || "unspecified");
    const city = String(req.body?.city || "");
    const desire = String(req.body?.desire || "");
    const cause = String(req.body?.cause || "complications");

    const relationships = withDisplayRelationships(req.body?.relationships || []);
    const history = Array.isArray(req.body?.history) ? req.body.history.slice(-20) : [];

    const sys = `
Write a short death epilogue (1 paragraph).

Rules:
- Address the player as "you".
- Any person mentioned must be formatted: Name (role).
- No headings, no lists, no odds.
- Max ~700 characters.
`.trim();

    const user = JSON.stringify({
      nonce: runNonce(),
      age,
      gender,
      city,
      desire,
      cause,
      relationships,
      history,
    });

    const r = await client.responses.create({
      model: "gpt-4.1",
      input: [
        { role: "system", content: sys },
        { role: "user", content: user },
      ],
      max_output_tokens: 240,
    });

    const text = (r.output_text || "").trim() || `You die at ${age}. Cause: ${cause}.`;
    res.json({ text });
  } catch (err) {
    res.status(500).json({
      error: "epilogue_failed",
      message: err?.message || String(err),
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
