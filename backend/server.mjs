import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import OpenAI from "openai";
import { z } from "zod";

const app = express();
app.use(express.json({ limit: "1mb" }));

/**
 * CORS
 * Add your Vercel domains here (and localhost for dev)
 */
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:5173",
      "http://127.0.0.1:5500",
      "https://life-sim-chi.vercel.app", // <-- change to your real frontend domain(s)
    ],
    methods: ["POST", "GET", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);
app.options("*", cors());

/**
 * Rate limit
 */
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 60,
  })
);

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

if (!process.env.OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY is missing. Set it in Railway Variables.");
}

app.get("/health", (req, res) => {
  res.json({ ok: true, time: Date.now() });
});

/**
 * Helpers
 */
function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function jumpYears() {
  // 5–15 inclusive
  return Math.floor(5 + Math.random() * 11);
}

/**
 * Mortality:
 * - extremely low at birth/childhood
 * - rises with age
 * - influenced by hidden stats
 */
function computeMortalityChance(age, stats) {
  // near-zero during infancy + childhood
  if (age <= 1) return 0.0008;
  if (age <= 5) return 0.0004;
  if (age <= 12) return 0.0002;

  // base curve rising with age
  const base = Math.min(0.85, Math.pow(age / 112, 3) * 0.55);

  const healthPenalty = (1 - stats.health) * 0.30;
  const stressPenalty = stats.stress * 0.20;
  const exposurePenalty = stats.exposure * 0.20;

  const freedomBuffer = (stats.freedom - 0.5) * 0.05;

  const p = base + healthPenalty + stressPenalty + exposurePenalty - freedomBuffer;
  return Math.max(0.0002, Math.min(0.92, p));
}

/**
 * Strict output schema for the model (Structured Outputs)
 * This is the main fix.
 */
const ScenarioSchema = {
  name: "life_turn",
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      text: { type: "string" },
      options: {
        type: "array",
        minItems: 2,
        maxItems: 2,
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            label: { type: "string" },
            effects: {
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
          },
          required: ["label", "effects"],
        },
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
  strict: true,
};

/**
 * Validate incoming state from frontend
 */
const TurnSchema = z.object({
  state: z.object({
    session_id: z.string().min(1),
    run_id: z.string().min(1),
    age: z.number().min(0).max(112),
    gender: z.string().min(1),
    city: z.string().min(1),
    desire: z.string().min(1),
    stats: z.object({
      money: z.number().min(0).max(1),
      stability: z.number().min(0).max(1),
      status: z.number().min(0).max(1),
      health: z.number().min(0).max(1),
      stress: z.number().min(0).max(1),
      freedom: z.number().min(0).max(1),
      exposure: z.number().min(0).max(1),
    }),
    relationships: z.array(
      z.object({
        name: z.string(),
        role: z.string(),
      })
    ),
    history: z.array(z.string()).max(80),
  }),
});

/**
 * Main endpoint: generate the next moment
 */
app.post("/api/turn", async (req, res) => {
  try {
    const { state } = TurnSchema.parse(req.body);

    const years = jumpYears();
    const newAge = Math.min(112, state.age + years);

    // random nonce helps avoid repeats across users
    const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const system = `
You generate the next pivotal life moment in a binary-choice life simulator.

Hard rules:
- Address the player as "you"
- Short, fast prose. No headings. No lists. No odds. No tabulated stats.
- Make it difficult. Volatile. Real consequences.
- Present exactly TWO choices (A and B), explicit actions.
- Maintain exactly 3 relationships in "relationships".
- First names only. Roles should make sense for the age.
- When a new person appears, include role in parentheses the FIRST time they appear in the prose (e.g. "Maya (mother)").
- After they have appeared once, you may refer to them without parentheses.

Additional rules:
- Age 0 MUST set the start state of their life based on city + gender + desire.
- Birth stats must be realistic and derived from the start conditions.
- Effects: each stat change per option must be between -0.25 and +0.25.
- ALWAYS return JSON that matches the schema exactly.
`;

    const user = JSON.stringify({
      nonce,
      fromAge: state.age,
      toAge: newAge,
      gender: state.gender,
      city: state.city,
      desire: state.desire,
      currentStats: state.stats,
      relationships: state.relationships,
      recentHistory: state.history.slice(-20),
      instructions:
        state.age === 0
          ? "This is the beginning. Generate birth_stats + 3 caregiver relationships and an Age 0 moment with two options."
          : "Generate the next life-changing moment given this exact trajectory. Keep 3 relationships updated.",
    });

    const r = await client.responses.create({
      model: "gpt-5",
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      reasoning: { effort: "low" },
      temperature: 1.0,
      text: {
        format: {
          type: "json_schema",
          json_schema: ScenarioSchema,
        },
      },
    });

    const out = JSON.parse(r.output_text);

    // clamp effect values to safe range
    out.options = out.options.map((opt) => {
      const e = opt.effects;
      for (const k of Object.keys(e)) {
        e[k] = Math.max(-0.25, Math.min(0.25, e[k]));
      }
      return opt;
    });

    // clamp birth stats
    for (const k of Object.keys(out.birth_stats)) {
      out.birth_stats[k] = clamp01(out.birth_stats[k]);
    }

    return res.json({
      age_from: state.age,
      age_to: newAge,
      scenario: {
        text: out.text,
        options: out.options,
        death_cause_hint: out.death_cause_hint || "",
      },
      birth_stats: out.birth_stats,
      relationships: out.relationships,
    });
  } catch (err) {
    console.error("❌ /api/turn error:", err?.message || err);
    return res.status(500).json({
      error: "turn_failed",
      message: "Model failed to return valid JSON. Retry.",
    });
  }
});

/**
 * Apply effects + check death
 */
app.post("/api/apply", async (req, res) => {
  try {
    const schema = z.object({
      age: z.number().min(0).max(112),
      stats: z.object({
        money: z.number(),
        stability: z.number(),
        status: z.number(),
        health: z.number(),
        stress: z.number(),
        freedom: z.number(),
        exposure: z.number(),
      }),
      effects: z.object({
        money: z.number(),
        stability: z.number(),
        status: z.number(),
        health: z.number(),
        stress: z.number(),
        freedom: z.number(),
        exposure: z.number(),
      }),
      death_cause_hint: z.string().optional(),
    });

    const { age, stats, effects } = schema.parse(req.body);

    const next = { ...stats };
    for (const k of Object.keys(effects)) {
      next[k] = clamp01(next[k] + effects[k]);
    }

    const deathChance = computeMortalityChance(age, next);
    const roll = Math.random();

    const died = roll < deathChance;

    return res.json({
      next_stats: next,
      died,
    });
  } catch (err) {
    console.error("❌ /api/apply error:", err?.message || err);
    return res.status(400).json({ error: "bad_request" });
  }
});

/**
 * Epilogue generator (death explanation)
 */
app.post("/api/epilogue", async (req, res) => {
  try {
    const schema = z.object({
      age: z.number().min(0).max(112),
      gender: z.string(),
      city: z.string(),
      desire: z.string(),
      relationships: z.array(z.object({ name: z.string(), role: z.string() })),
      history: z.array(z.string()),
      cause: z.string(),
    });

    const payload = schema.parse(req.body);

    const system = `
Write a short ending in the same tone as the game.
Rules:
- Address as "you"
- 1 paragraph only
- Explain the death with context (not medical spam, but believable)
- Mention 1–2 relationships by first name (no full names)
- No headings, no odds, no lists
`;

    const user = JSON.stringify(payload);

    const r = await client.responses.create({
      model: "gpt-5",
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      reasoning: { effort: "low" },
      temperature: 1.0,
    });

    return res.json({ text: r.output_text.trim() });
  } catch (err) {
    console.error("❌ /api/epilogue error:", err?.message || err);
    return res.status(500).json({
      error: "epilogue_failed",
      message: "Could not generate epilogue.",
    });
  }
});

const port = process.env.PORT || 8787;
app.listen(port, () => {
  console.log(`✅ Server running on http://localhost:${port}`);
});
