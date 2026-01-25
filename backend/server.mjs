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
 * For now: allow all origins (fastest to stop "Failed to fetch" headaches)
 * Lock it down later to your Vercel domain(s).
 */
app.use(
  cors({
    origin: true,
    methods: ["POST", "GET", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);
app.options("*", cors());

/**
 * Basic abuse protection
 */
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 120,
  })
);

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

if (!process.env.OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY missing. Set it in Railway Variables.");
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

function clampEffect(x) {
  // effects must stay within [-0.25, +0.25]
  return Math.max(-0.25, Math.min(0.25, x));
}

function jumpYears() {
  // 5–15 inclusive
  return Math.floor(5 + Math.random() * 11);
}

/**
 * Mortality: intentionally low at birth/childhood.
 * We never show deathChance to user; only apply it.
 */
function computeMortalityChance(age, stats) {
  // Very low early life
  if (age <= 1) return 0.0006;
  if (age <= 5) return 0.0003;
  if (age <= 12) return 0.0002;
  if (age <= 18) return 0.0006;

  // base rises with age
  const base = Math.min(0.85, Math.pow(age / 112, 3) * 0.55);

  const healthPenalty = (1 - stats.health) * 0.30;
  const stressPenalty = stats.stress * 0.20;
  const exposurePenalty = stats.exposure * 0.20;

  // freedom buffer slight
  const freedomBuffer = (stats.freedom - 0.5) * 0.05;

  const p = base + healthPenalty + stressPenalty + exposurePenalty - freedomBuffer;
  return Math.max(0.0002, Math.min(0.92, p));
}

/**
 * STRICT Structured Output Schema
 * This is the fix for your "Model failed to return valid JSON"
 */
const ScenarioSchema = {
  name: "life_turn",
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
              required: [
                "money",
                "stability",
                "status",
                "health",
                "stress",
                "freedom",
                "exposure",
              ],
            },
          },
          required: ["label", "effects"],
        },
      },

      // always 3 people
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

      // computed from start condition, but always returned
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
        required: [
          "money",
          "stability",
          "status",
          "health",
          "stress",
          "freedom",
          "exposure",
        ],
      },

      // only used if plausibly lethal; otherwise empty string
      death_cause_hint: { type: "string" },
    },
    required: ["text", "options", "relationships", "birth_stats", "death_cause_hint"],
  },
};

/**
 * Validate incoming turn request
 * Keep it permissive enough to not brick your frontend.
 */
const TurnSchema = z.object({
  state: z.object({
    session_id: z.string().optional(),
    run_id: z.string().optional(),
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

    history: z.array(z.string()).max(120),
  }),
});

/**
 * /api/turn
 * Generates the next scenario + returns age_to, birth_stats and relationships.
 */
app.post("/api/turn", async (req, res) => {
  try {
    const { state } = TurnSchema.parse(req.body);

    // Determine new age (5–15 years jump)
    const years = jumpYears();
    const age_to = Math.min(112, state.age + years);

    // Random nonce reduces chances of repeat across sessions
    const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const system = `
You are generating the next pivotal life moment in a binary-choice life simulator.

Hard rules:
- Address the player as "you"
- One paragraph only. Prose. No headings. No lists. No odds. No stats tables.
- Short, fast. High stakes. Volatile.
- Include: living situation + source of income + lifestyle + next step crisis.
- Present exactly TWO options labeled A and B with explicit actions.
- Maintain exactly 3 relationships in the "relationships" array.
- First names only.
- When a person appears in the narrative for the first time, include role in parentheses: "Maya (mother)".
  After first appearance, you may refer without parentheses.
- The roles must fit the age (at age 0: caregivers; at adult ages: friends/partners/bosses etc).
- Effects must be between -0.25 and +0.25 for each stat.

Gameplay:
- Age jumps are always 5–15 years.
- Age 0 must generate the starting state based on city + gender + desire and include a decision.

Return VALID JSON ONLY matching the schema.
`;

    const user = JSON.stringify({
      nonce,
      fromAge: state.age,
      toAge: age_to,
      gender: state.gender,
      city: state.city,
      desire: state.desire,
      currentStats: state.stats,
      relationships: state.relationships,
      recentHistory: state.history.slice(-25),
      instruction:
        state.age === 0
          ? "This is the start of life. Generate birth_stats and 3 caregiver relationships and an Age 0 pivotal decision."
          : "Generate the next pivotal life moment based on trajectory. Keep relationships coherent.",
    });

    const response = await client.responses.create({
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

    // This WILL be valid JSON if the model succeeded
    const out = JSON.parse(response.output_text);

    // Clamp birth stats [0..1]
    for (const k of Object.keys(out.birth_stats)) {
      out.birth_stats[k] = clamp01(out.birth_stats[k]);
    }

    // Clamp effects
    out.options = out.options.map((opt) => {
      const e = opt.effects;
      for (const k of Object.keys(e)) {
        e[k] = clampEffect(e[k]);
      }
      return opt;
    });

    return res.json({
      age_from: state.age,
      age_to,
      scenario: {
        text: out.text,
        options: out.options,
        death_cause_hint: (out.death_cause_hint || "").trim(),
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
 * /api/apply
 * Applies option effects + performs mortality check.
 * Returns next_stats and died boolean.
 */
app.post("/api/apply", (req, res) => {
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
      next[k] = clamp01((next[k] ?? 0.5) + clampEffect(effects[k]));
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
 * /api/epilogue
 * Generates a death explanation paragraph.
 */
app.post("/api/epilogue", async (req, res) => {
  try {
    const schema = z.object({
      age: z.number().min(0).max(112),
      gender: z.string(),
      city: z.string(),
      desire: z.string(),
      relationships: z.array(z.object({ name: z.string(), role: z.string() })).max(3),
      history: z.array(z.string()).max(80),
      cause: z.string(),
    });

    const payload = schema.parse(req.body);

    const system = `
Write a single-paragraph ending for a life simulator.

Rules:
- Address as "you"
- One paragraph only, prose
- Mention 1–2 relationships by first name
- Explain the cause with believable context
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
  console.log(`✅ Server running on port ${port}`);
});
