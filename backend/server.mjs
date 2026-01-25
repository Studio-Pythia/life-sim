// server.mjs
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import OpenAI from "openai";
import { z } from "zod";
import crypto from "crypto";

const app = express();
app.use(express.json({ limit: "1mb" }));

/**
 * CORS
 * ✅ In production: lock this to your Vercel domain(s)
 * Example:
 * origin: ["https://life-sim-chi.vercel.app"]
 */
app.use(
  cors({
    origin: true,
    methods: ["POST", "GET"],
    allowedHeaders: ["Content-Type"],
  })
);

/**
 * Rate limit (basic abuse protection)
 */
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 30, // 30 requests/minute/IP
    standardHeaders: true,
    legacyHeaders: false,
  })
);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error("❌ Missing OPENAI_API_KEY environment variable.");
}

const client = new OpenAI({ apiKey: OPENAI_API_KEY });

// -----------------------------
// Schemas
// -----------------------------

const StatsSchema = z.object({
  money: z.number().min(0).max(1),
  stability: z.number().min(0).max(1),
  status: z.number().min(0).max(1),
  health: z.number().min(0).max(1),
  stress: z.number().min(0).max(1),
  freedom: z.number().min(0).max(1),
  exposure: z.number().min(0).max(1),
});

const RelationshipSchema = z.object({
  name: z.string().min(1).max(24),
  role: z.string().min(1).max(40),
});

const IncomingStateSchema = z.object({
  session_id: z.string().optional(),
  run_id: z.string().optional(),

  age: z.number().min(0).max(112),
  gender: z.string().min(1).max(24),
  city: z.string().min(1).max(60),
  desire: z.string().min(1).max(80),

  stats: StatsSchema,
  relationships: z.array(RelationshipSchema).max(3),
  history: z.array(z.string()).max(80),
});

const TurnRequestSchema = z.object({
  state: IncomingStateSchema,
});

const EffectKeys = [
  "money",
  "stability",
  "status",
  "health",
  "stress",
  "freedom",
  "exposure",
];

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

const ModelScenarioSchema = z.object({
  text: z.string().min(1),
  options: z
    .array(
      z.object({
        label: z.string().min(3),
        effects: EffectsSchema,
      })
    )
    .length(2),

  // Always return 3 relationships (new or updated)
  relationships: z.array(RelationshipSchema).length(3),

  // Birth stats only (return always; frontend uses it only at birth)
  birth_stats: StatsSchema.optional(),

  // Optional hint only used on death
  death_cause_hint: z.string().optional(),
});

// -----------------------------
// Helpers
// -----------------------------

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function jumpYears() {
  // 5–15 year jumps
  return Math.floor(5 + Math.random() * 11); // 5..15
}

function computeMortalityChance(age, stats, lethalHint = "") {
  // If the narrative isn't plausibly lethal, reduce risk massively while young.
  const isLethalMoment = Boolean(lethalHint && lethalHint.trim().length > 0);

  // Hard protections: early death should be ultra rare unless explicitly lethal.
  if (age === 0 && !isLethalMoment) return 0.0001; // effectively never
  if (age > 0 && age < 6 && !isLethalMoment) return 0.001;

  // Base rises with age (non-linear)
  let base = Math.min(0.85, Math.pow(age / 112, 3) * 0.55);

  // Youth protection (still allows freak accidents later)
  if (age < 18 && !isLethalMoment) base *= 0.15;

  // Score modifiers
  const healthPenalty = (1 - stats.health) * 0.35;
  const stressPenalty = stats.stress * 0.20;
  const exposurePenalty = stats.exposure * 0.22;
  const freedomBuffer = (stats.freedom - 0.5) * 0.05;

  let p = base + healthPenalty + stressPenalty + exposurePenalty - freedomBuffer;

  // If the moment IS lethal, let the risk be meaningfully higher
  if (isLethalMoment) p *= 1.35;

  return Math.max(0.000001, Math.min(0.92, p));
}

/**
 * Attempt to extract the first valid JSON object substring from a model output
 */
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
    reasoning: { effort: "low" }, // keep quality; not "minimal"
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
  } catch (e) {
    // Fallback: repair pass (same model, strict JSON)
    const repair = await client.responses.create({
      model,
      reasoning: { effort: "low" },
      input: [
        {
          role: "system",
          content:
            "You repair invalid JSON into valid JSON. Output ONLY valid JSON. No markdown. No commentary.",
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
      const out = await callModelJSON(payload);
      return out;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

// -----------------------------
// Routes
// -----------------------------

app.get("/health", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ ok: true, time: Date.now() });
});

app.post("/api/turn", async (req, res) => {
  res.set("Cache-Control", "no-store");

  try {
    const { state } = TurnRequestSchema.parse(req.body);

    const is_birth =
      state.age === 0 &&
      (state.history?.length ?? 0) === 0 &&
      (state.relationships?.length ?? 0) === 0;

    // Age progression:
    // - Birth turn stays at age 0
    // - After birth, jump 5–15 years each turn
    const years = is_birth ? 0 : jumpYears();
    const age_from = state.age;
    const age_to = Math.min(112, age_from + years);

    const introducedNames = (state.relationships || []).map((r) => r.name);

    const nonce = crypto.randomUUID();

    const system = `
You generate the next pivotal life moment in a binary-choice life simulator.

ABSOLUTE RULES:
- Address the player as "you" only.
- One paragraph only. No headings. No lists. No sections. No tables.
- Fast, factual, concrete prose. No soft reassurance.
- Always include living situation, income source, lifestyle, and the immediate crisis/next step.
- Present EXACTLY two choices, labelled A and B, with explicit actions.
- Do NOT show odds, probabilities, stats, scores, or internal calculations.
- The moment must feel life-defining. Volatile, consequential, believable.

UNIQUENESS (STRICT):
- Use nonce + run_id + session_id to make each run distinct, even if city/desire match.
- Avoid reusing the same names/roles/phrasing across different runs.
- Never mention nonce/run_id/session_id.

RELATIONSHIPS (STRICT):
- Always output exactly 3 relationships in relationships[].
- Roles must be realistic for the current age.
- At Age 0, do NOT use "guardian" unless the story explicitly justifies custody/legal supervision.
- Prefer realistic Age 0 roles like: mother, father, midwife, grandparent, older_sibling, aunt, uncle, social_worker (only if justified).
- Only include "(role)" in the prose the FIRST time a person appears in the whole life.
  If a person is already known, mention name only.
- Known names already introduced: ${introducedNames.join(", ") || "(none)"}.

BIRTH TURN (IF age_to is 0):
- You must create the starting state from the player's inputs.
- Generate birth_stats (0..1 values) informed by city/desire/gender + implied context.
- Generate 3 relationships that make sense at birth.
- The two choices must be about a fundamental early-life fork that shapes trajectory.

OUTPUT FORMAT:
Return VALID JSON ONLY. No markdown.
Schema:
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

EFFECTS RULES:
- effects keys limited to: money, stability, status, health, stress, freedom, exposure.
- Each effect value must be between -0.25 and +0.25.
- death_cause_hint only if the moment is plausibly lethal.
`;

    const user = {
      nonce,
      session_id: state.session_id || null,
      run_id: state.run_id || null,

      age_from,
      age_to,
      is_birth,

      gender: state.gender,
      city: state.city,
      desire: state.desire,

      stats: state.stats,
      relationships: state.relationships,
      history: (state.history || []).slice(-20),
    };

    const rawOut = await callModelJSONWithRetries(
      { system, user, model: "gpt-5" },
      3
    );

    // Validate shape strictly
    const scenario = ModelScenarioSchema.parse(rawOut);

    // If not birth, ensure we do NOT accidentally return birth_stats
    if (!is_birth) delete scenario.birth_stats;

    return res.json({
      age_from,
      age_to,
      scenario: {
        text: scenario.text,
        options: scenario.options,
        death_cause_hint: scenario.death_cause_hint || "",
      },
      relationships: scenario.relationships,
      birth_stats: scenario.birth_stats || null,
    });
  } catch (err) {
    console.error("❌ /api/turn failed:", err);
    return res.status(400).json({
      error: "bad_request",
      message: "Model failed to return valid JSON. Retry.",
    });
  }
});

app.post("/api/apply", (req, res) => {
  res.set("Cache-Control", "no-store");

  try {
    const schema = z
      .object({
        age: z.number().min(0).max(112),
        stats: StatsSchema,
        effects: EffectsSchema,
        death_cause_hint: z.string().optional()
      })
      .strict();

    const { age, stats, effects, death_cause_hint } = schema.parse(req.body);

    const next = { ...stats };
    for (const k of EffectKeys) {
      if (typeof effects[k] === "number") {
        next[k] = clamp01(next[k] + effects[k]);
      }
    }

    const deathChance = computeMortalityChance(age, next, death_cause_hint || "");
    const roll = Math.random();
    const died = roll < deathChance;

    return res.json({
      next_stats: next,
      died,
      // Do NOT expose deathChance to client (keep hidden)
    });
  } catch (err) {
    console.error("❌ /api/apply failed:", err);
    return res.status(400).json({ error: "bad_request" });
  }
});

app.post("/api/epilogue", async (req, res) => {
  res.set("Cache-Control", "no-store");

  try {
    const schema = z.object({
      age: z.number().min(0).max(112),
      gender: z.string(),
      city: z.string(),
      desire: z.string(),
      relationships: z.array(RelationshipSchema).max(3),
      history: z.array(z.string()).max(60),
      cause: z.string().min(1)
    }).strict();

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

    const user = {
      ...payload,
      note: "Make it feel complete. Give closure without sentimentality."
    };

    const out = await client.responses.create({
      model: "gpt-5",
      reasoning: { effort: "low" },
      input: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(user) }
      ],
      text: { format: { type: "json_object" } }
    });

    const json = JSON.parse(out.output_text);
    return res.json({ text: json.text || `You die. Cause: ${payload.cause}.` });

  } catch (err) {
    console.error("❌ /api/epilogue failed:", err);
    return res.status(400).json({ error: "bad_request" });
  }
});

const port = process.env.PORT || 8787;
app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
});
