// server.mjs
import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import OpenAI from "openai";
import { z } from "zod";
import crypto from "crypto";

const app = express();
app.use(express.json({ limit: "1mb" }));

/**
 * ✅ CORS
 * In production, lock this to your frontend domains:
 * origin: ["https://your-vercel-app.vercel.app"]
 */
app.use(cors({
  origin: [
    "https://life-sim-chi.vercel.app",   // your Vercel domain
    "http://localhost:3000"
  ],
  methods: ["POST", "GET", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
}));
app.options("*", cors());

/**
 * ✅ Rate limit
 * Prefetch increases requests, so allow more.
 */
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// -----------------------------
// Schemas
// -----------------------------

const StatsSchema = z
  .object({
    money: z.number().min(0).max(1),
    stability: z.number().min(0).max(1),
    status: z.number().min(0).max(1),
    health: z.number().min(0).max(1),
    stress: z.number().min(0).max(1),
    freedom: z.number().min(0).max(1),
    exposure: z.number().min(0).max(1),
  })
  .strict();

const RelationshipSchema = z
  .object({
    name: z.string().min(1).max(24),
    role: z.string().min(1).max(40),
  })
  .strict();

const EffectsSchema = z
  .object({
    money: z.number().min(-0.25).max(0.25).optional(),
    stability: z.number().min(-0.25).max(0.25).optional(),
    status: z.number().min(-0.25).max(0.25).optional(),
    health: z.number().min(-0.25).max(0.25).optional(),
    stress: z.number().min(-0.25).max(0.25).optional(),
    freedom: z.number().min(-0.25).max(0.25).optional(),
    exposure: z.number().min(-0.25).max(0.25).optional(),
  })
  .strict();

const IncomingStateSchema = z
  .object({
    session_id: z.string().optional(),
    run_id: z.string().optional(),

    age: z.number().min(0).max(112),
    gender: z.string().min(1).max(24),
    city: z.string().min(1).max(60),
    desire: z.string().min(1).max(80),

    stats: StatsSchema,
    relationships: z.array(RelationshipSchema).max(3),
    history: z.array(z.string()).max(120),
  })
  .strict();

const TurnRequestSchema = z
  .object({
    state: IncomingStateSchema,
  })
  .strict();

const ModelScenarioSchema = z
  .object({
    text: z.string().min(1),
    options: z
      .array(
        z
          .object({
            label: z.string().min(3),
            effects: EffectsSchema,
          })
          .strict()
      )
      .length(2),

    relationships: z.array(RelationshipSchema).length(3),

    birth_stats: StatsSchema.optional(),
    death_cause_hint: z.string().optional(),
  })
  .strict();

// -----------------------------
// Prefetch cache (in-memory)
// Swap this to Redis later.
// -----------------------------

const PREFETCH = new Map(); // token -> { data, expiresAt }

function putPrefetch(token, data, ttlMs = 2 * 60_000) {
  PREFETCH.set(token, { data, expiresAt: Date.now() + ttlMs });
}

function getPrefetch(token) {
  const hit = PREFETCH.get(token);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    PREFETCH.delete(token);
    return null;
  }
  return hit.data;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of PREFETCH.entries()) {
    if (now > v.expiresAt) PREFETCH.delete(k);
  }
}, 30_000);

// -----------------------------
// Helpers
// -----------------------------

const EFFECT_KEYS = [
  "money",
  "stability",
  "status",
  "health",
  "stress",
  "freedom",
  "exposure",
];

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function applyEffectsToStats(stats, effects) {
  const next = { ...stats };
  for (const k of EFFECT_KEYS) {
    if (typeof effects?.[k] === "number") {
      next[k] = clamp01(next[k] + effects[k]);
    }
  }
  return next;
}

function jumpYears() {
  // 5–15 years
  return Math.floor(5 + Math.random() * 11);
}

/**
 * Hidden mortality chance
 * - Age 0 death is effectively impossible unless narrative is explicitly lethal.
 */
function computeMortalityChance(age, stats, lethalHint = "") {
  const isLethalMoment = Boolean(lethalHint && lethalHint.trim().length > 0);

  if (age === 0 && !isLethalMoment) return 0.000001;
  if (age > 0 && age < 6 && !isLethalMoment) return 0.00001;

  let base = Math.min(0.85, Math.pow(age / 112, 3) * 0.55);

  if (age < 18 && !isLethalMoment) base *= 0.15;

  const healthPenalty = (1 - stats.health) * 0.35;
  const stressPenalty = stats.stress * 0.20;
  const exposurePenalty = stats.exposure * 0.22;
  const freedomBuffer = (stats.freedom - 0.5) * 0.05;

  let p = base + healthPenalty + stressPenalty + exposurePenalty - freedomBuffer;

  if (isLethalMoment) p *= 1.35;

  return Math.max(0.000001, Math.min(0.92, p));
}

function extractJSONObject(text) {
  if (!text) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

async function callModelJSON({ system, user, model = "gpt-5" }) {
  const r = await client.responses.create({
    model,
    reasoning: { effort: "low" },
    input: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(user) },
    ],
    text: { format: { type: "json_object" } },
  });

  const raw = r.output_text || "";
  const maybe = extractJSONObject(raw) || raw;

  try {
    return JSON.parse(maybe);
  } catch {
    // Repair pass
    const repair = await client.responses.create({
      model,
      reasoning: { effort: "low" },
      input: [
        {
          role: "system",
          content:
            "Repair the following into VALID JSON ONLY. No markdown. No commentary.",
        },
        { role: "user", content: raw.slice(0, 8000) },
      ],
      text: { format: { type: "json_object" } },
    });

    const repaired = repair.output_text || "";
    return JSON.parse(extractJSONObject(repaired) || repaired);
  }
}

async function callModelJSONWithRetries(payload, tries = 3) {
  let lastErr = null;
  for (let i = 0; i < tries; i++) {
    try {
      return await callModelJSON(payload);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

/**
 * Build a "moment" (scenario) for a given state & age jump.
 * Returns:
 * { age_from, age_to, scenario, relationships, birth_stats? }
 */
async function generateMoment({
  state,
  age_from,
  age_to,
  is_birth,
  introducedNames = [],
}) {
  const nonce = crypto.randomUUID();

  const system = `
You generate the next moment in a binary-choice life simulator.

Hard rules:
- Address the player as "you"
- One paragraph only. No headings. No sections. No lists.
- Concrete, factual, fast prose. No soft reassurance.
- Always include: living situation, income source, lifestyle, the immediate crisis/next step.
- Present EXACTLY two choices, labelled A and B, as explicit actions.
- Do NOT show odds, probabilities, stats, scores, or internal calculations.
- No mention of the word "pivot".

Uniqueness:
- Use nonce + run_id + session_id to make each run distinct.
- Never mention nonce/run_id/session_id.

Relationships:
- Always output exactly 3 relationships in relationships[].
- Roles must be realistic for the age.
- Known names already introduced: ${introducedNames.join(", ") || "(none)"}.
- Only include "(role)" in the prose the FIRST time a person appears in the whole life.
  If name already introduced, mention name only.

Birth turn (if age_to === 0):
- Create starting state from city/gender/desire.
- Generate birth_stats (0..1).
- Generate 3 relationships that make sense at birth.
- Two choices must be a fundamental early fork.

Output JSON only:
{
  "text": "string",
  "options": [
    { "label": "A - ...", "effects": { "money": 0.05, ... } },
    { "label": "B - ...", "effects": { ... } }
  ],
  "relationships": [
    { "name": "FirstName", "role": "role" },
    { "name": "FirstName", "role": "role" },
    { "name": "FirstName", "role": "role" }
  ],
  "birth_stats": { "money":0.5,"stability":0.5,"status":0.5,"health":0.5,"stress":0.5,"freedom":0.5,"exposure":0.5 },
  "death_cause_hint": "string"
}

Effects keys limited to: money, stability, status, health, stress, freedom, exposure.
Each effect must be between -0.25 and +0.25.
`;

  const user = {
    nonce,
    session_id: state.session_id || null,
    run_id: state.run_id || null,

    is_birth,
    age_from,
    age_to,

    gender: state.gender,
    city: state.city,
    desire: state.desire,

    stats: state.stats,
    relationships: state.relationships,
    history: (state.history || []).slice(-25),
  };

  const raw = await callModelJSONWithRetries(
    { system, user, model: "gpt-5" },
    3
  );

  const parsed = ModelScenarioSchema.parse(raw);

  return {
    age_from,
    age_to,
    scenario: {
      text: parsed.text,
      options: parsed.options,
      death_cause_hint: parsed.death_cause_hint || "",
    },
    relationships: parsed.relationships,
    birth_stats: parsed.birth_stats || null,
  };
}

/**
 * Prefetch next moments for option A and B and store them in cache.
 * Returns tokens { A, B }.
 */
async function prefetchBranches({ baseState, currentAge, currentOut }) {
  const tokenA = "tok_" + crypto.randomUUID();
  const tokenB = "tok_" + crypto.randomUUID();

  // Use relationships returned by the model (canonical)
  const rels = currentOut.relationships;

  const optA = currentOut.scenario.options[0];
  const optB = currentOut.scenario.options[1];

  // Project stats if user picks A/B
  const statsA = applyEffectsToStats(baseState.stats, optA.effects || {});
  const statsB = applyEffectsToStats(baseState.stats, optB.effects || {});

  const age_from_A = currentAge;
  const age_from_B = currentAge;

  const age_to_A = Math.min(112, currentAge + jumpYears());
  const age_to_B = Math.min(112, currentAge + jumpYears());

  const introducedNames = (baseState.relationships || []).map((r) => r.name);

  const branchStateA = {
    ...baseState,
    age: age_from_A,
    stats: statsA,
    relationships: rels,
    history: [...(baseState.history || []), optA.label].slice(-60),
  };

  const branchStateB = {
    ...baseState,
    age: age_from_B,
    stats: statsB,
    relationships: rels,
    history: [...(baseState.history || []), optB.label].slice(-60),
  };

  // Generate both in parallel
  const [nextA, nextB] = await Promise.all([
    generateMoment({
      state: branchStateA,
      age_from: age_from_A,
      age_to: age_to_A,
      is_birth: false,
      introducedNames,
    }),
    generateMoment({
      state: branchStateB,
      age_from: age_from_B,
      age_to: age_to_B,
      is_birth: false,
      introducedNames,
    }),
  ]);

  // Store cached next moments
  putPrefetch(tokenA, nextA);
  putPrefetch(tokenB, nextB);

  return { A: tokenA, B: tokenB };
}

// -----------------------------
// Routes
// -----------------------------

app.get("/health", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ ok: true, time: Date.now() });
});

/**
 * /api/turn
 * - Generates the current moment
 * - Prefetches next moments for A and B
 */
app.post("/api/turn", async (req, res) => {
  res.set("Cache-Control", "no-store");

  try {
    const { state } = TurnRequestSchema.parse(req.body);

    const is_birth =
      state.age === 0 &&
      (state.history?.length ?? 0) === 0 &&
      (state.relationships?.length ?? 0) === 0;

    const age_from = state.age;
    const age_to = is_birth ? 0 : Math.min(112, age_from + jumpYears());

    const introducedNames = (state.relationships || []).map((r) => r.name);

    // Generate current moment
    const out = await generateMoment({
      state,
      age_from,
      age_to,
      is_birth,
      introducedNames,
    });

    // Prefetch branches (this is the expensive bit that makes it feel instant)
    const prefetch = await prefetchBranches({
      baseState: {
        ...state,
        // important: carry forward birth_stats if this was birth
        stats: out.birth_stats || state.stats,
        relationships: out.relationships,
      },
      currentAge: out.age_to,
      currentOut: out,
    });

    return res.json({
      age_from: out.age_from,
      age_to: out.age_to,
      scenario: out.scenario,
      relationships: out.relationships,
      birth_stats: out.birth_stats,
      prefetch,
    });
  } catch (err) {
    console.error("❌ /api/turn failed:", err);
    return res.status(400).json({
      error: "bad_request",
      message: "Model failed to return valid JSON. Retry.",
    });
  }
});

/**
 * /api/next
 * - Apply chosen effects
 * - Check mortality
 * - Serve cached next moment instantly if token exists
 * - If cache miss, generate on-demand
 */
app.post("/api/next", async (req, res) => {
  res.set("Cache-Control", "no-store");

  try {
    const schema = z
      .object({
        token: z.string().min(1),
        // state snapshot
        state: IncomingStateSchema,
        // chosen option effects
        effects: EffectsSchema,
        death_cause_hint: z.string().optional(),
      })
      .strict();

    const { token, state, effects, death_cause_hint } = schema.parse(req.body);

    // Apply effects
    const nextStats = applyEffectsToStats(state.stats, effects);

    // Mortality check (hidden)
    const deathChance = computeMortalityChance(
      state.age,
      nextStats,
      death_cause_hint || ""
    );
    const died = Math.random() < deathChance;

    if (died) {
      return res.json({ died: true, next_stats: nextStats });
    }

    // Try cache
    const cached = getPrefetch(token);

    if (cached) {
      // ✅ cached already includes scenario + relationships + ages
      // Prefetch from the cached node (so next click is also instant)
      // NOTE: this adds cost but keeps the feeling "instant every time".
      const prefetch = await prefetchBranches({
        baseState: {
          ...state,
          age: cached.age_to,
          stats: nextStats,
          relationships: cached.relationships,
          history: (state.history || []).slice(-60),
        },
        currentAge: cached.age_to,
        currentOut: cached,
      });

      return res.json({
        died: false,
        next_stats: nextStats,
        age_from: cached.age_from,
        age_to: cached.age_to,
        scenario: cached.scenario,
        relationships: cached.relationships,
        prefetch,
      });
    }

    // Cache miss fallback (rare)
    const age_from = state.age;
    const age_to = Math.min(112, age_from + jumpYears());

    const out = await generateMoment({
      state: { ...state, stats: nextStats },
      age_from,
      age_to,
      is_birth: false,
      introducedNames: (state.relationships || []).map((r) => r.name),
    });

    const prefetch = await prefetchBranches({
      baseState: { ...state, stats: nextStats, relationships: out.relationships },
      currentAge: out.age_to,
      currentOut: out,
    });

    return res.json({
      died: false,
      next_stats: nextStats,
      age_from: out.age_from,
      age_to: out.age_to,
      scenario: out.scenario,
      relationships: out.relationships,
      prefetch,
      cache_miss: true,
    });
  } catch (err) {
    console.error("❌ /api/next failed:", err);
    return res.status(400).json({ error: "bad_request" });
  }
});

/**
 * Optional: death epilogue (full ending)
 */
app.post("/api/epilogue", async (req, res) => {
  res.set("Cache-Control", "no-store");

  try {
    const schema = z
      .object({
        age: z.number().min(0).max(112),
        gender: z.string(),
        city: z.string(),
        desire: z.string(),
        relationships: z.array(RelationshipSchema).max(3),
        history: z.array(z.string()).max(60),
        cause: z.string().min(1),
      })
      .strict();

    const payload = schema.parse(req.body);

    const system = `
You write a death ending for a life simulator.

Rules:
- Address the player as "you"
- 2 short paragraphs max
- Concrete, factual, unsentimental
- Explain what happened and why it mattered
- Mention 1–2 relationships by first name (no full names)
- No odds, no stats, no moral lesson
- No headings, no lists

Return JSON only:
{ "text": "..." }
`;

    const r = await client.responses.create({
      model: "gpt-5",
      reasoning: { effort: "low" },
      input: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(payload) },
      ],
      text: { format: { type: "json_object" } },
    });

    const out = JSON.parse(extractJSONObject(r.output_text) || r.output_text);
    return res.json({ text: out.text || `You die. Cause: ${payload.cause}.` });
  } catch (err) {
    console.error("❌ /api/epilogue failed:", err);
    return res.status(400).json({ error: "bad_request" });
  }
});

const port = process.env.PORT || 8787;
app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
});
