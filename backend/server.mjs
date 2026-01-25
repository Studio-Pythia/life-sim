import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import OpenAI from "openai";
import crypto from "crypto";

const app = express();
app.use(express.json({ limit: "1mb" }));

/**
 * ✅ CORS
 * In production, lock this down to your Vercel domain:
 * origin: ["https://life-sim-chi.vercel.app"]
 */
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

/**
 * ✅ Rate limit to avoid abuse
 */
app.use(
  rateLimit({
    windowMs: 60_000,
    max: 60,
  })
);

if (!process.env.OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY is missing. Add it in Railway Variables.");
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * ---------------------------
 * Helpers
 * ---------------------------
 */

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

function jumpYears() {
  // 5–15 years
  return Math.floor(5 + Math.random() * 11);
}

// Much lower chance of dying at age 0–10.
// Mortality rises gradually and responds to stats.
function computeMortalityChance(age, stats) {
  // base curve: tiny for kids, ramps later
  let base;
  if (age <= 1) base = 0.0002;
  else if (age <= 10) base = 0.0005;
  else if (age <= 25) base = 0.002;
  else if (age <= 45) base = 0.006;
  else if (age <= 65) base = 0.02;
  else if (age <= 80) base = 0.06;
  else base = 0.12 + Math.pow((age - 80) / 32, 2) * 0.35;

  const healthPenalty = (1 - (stats.health ?? 0.5)) * 0.18;
  const stressPenalty = (stats.stress ?? 0.5) * 0.08;
  const exposurePenalty = (stats.exposure ?? 0.5) * 0.10;

  // freedom gives a tiny buffer (agency/escape choices)
  const freedomBuffer = ((stats.freedom ?? 0.5) - 0.5) * 0.03;

  const p = base + healthPenalty + stressPenalty + exposurePenalty - freedomBuffer;

  // keep sane limits
  return Math.max(0.0001, Math.min(0.85, p));
}

function nonce() {
  return crypto.randomBytes(8).toString("hex");
}

/**
 * ---------------------------
 * Structured Output Schemas
 * ---------------------------
 */

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
            },
          },
          required: ["label", "effects"],
        },
      },
      relationship_changes: {
        type: "object",
        additionalProperties: false,
        properties: {
          replace_index: {
            anyOf: [
              { type: "integer", minimum: 0, maximum: 2 },
              { type: "null" },
            ],
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
      },
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
      options: TurnJSONSchema.schema.properties.options,
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

/**
 * ---------------------------
 * Prompt Builders
 * ---------------------------
 */

function systemPrompt() {
  return `
You are generating a pivotal life moment in a binary-choice life simulator.

Hard rules:
- Address the player as "you"
- Short, fast prose. 1 paragraph only.
- No headings, no lists, no odds, no "life report"
- Must imply: living situation, source of income, lifestyle, next step crisis
- Make it difficult. Volatile. Consequences are real.
- Present exactly two choices A and B as explicit actions.
- Names must be FIRST NAMES ONLY.
- When a character appears for the FIRST TIME, write them as: Name (role)
- After first appearance, do NOT repeat (role) again for that same person.
- Return VALID JSON ONLY, matching the schema exactly.

Effects rules:
- effects can only use keys: money, stability, status, health, stress, freedom, exposure
- Each effect must be between -0.25 and +0.25 (inclusive)
`.trim();
}

function birthPrompt() {
  return `
You are generating the birth + infancy start-state.

Rules:
- Must use the provided city, gender, desire.
- You MUST produce 3 relationships, realistic for the context (avoid nonsense like "guardian" unless it makes sense).
- You MUST set birth_stats realistically (0..1 floats, not all 0.5).
- The prose must be specific, factual-feeling, and grounded.
- Provide two options that genuinely shape the next 5–15 years.

Return JSON matching schema exactly.
`.trim();
}

/**
 * ---------------------------
 * Routes
 * ---------------------------
 */

app.get("/health", (req, res) => res.json({ ok: true }));

app.post("/api/turn", async (req, res) => {
  try {
    const state = req.body?.state;
    if (!state) {
      return res.status(400).json({ error: "bad_request", message: "Missing state" });
    }

    const isBirth = state.age === 0 && (!state.history || state.history.length === 0);

    const years = isBirth ? 0 : jumpYears();
    const newAge = Math.min(112, state.age + years);

    const payload = {
      nonce: nonce(),
      session_id: state.session_id || "",
      run_id: state.run_id || "",
      age_from: state.age,
      age_to: newAge,
      gender: state.gender,
      city: state.city,
      desire: state.desire,
      stats: state.stats,
      relationships: state.relationships || [],
      history: (state.history || []).slice(-18),
    };

    const response = await client.responses.create({
      model: "gpt-4.1", // ✅ reliable + high quality + structured outputs support
      input: [
        { role: "system", content: systemPrompt() },
        {
          role: "user",
          content: isBirth ? birthPrompt() : "Generate the next pivotal moment.",
        },
        { role: "user", content: JSON.stringify(payload) },
      ],
      max_output_tokens: 900,
      text: {
        format: {
          type: "json_schema",
          ...(isBirth ? BirthJSONSchema : TurnJSONSchema),
        },
      },
    });

    const raw = response.output_text; // ✅ official helper
    if (!raw) {
      return res.status(500).json({
        error: "model_no_output",
        message: "Model returned no output_text",
        request_id: response._request_id || null,
      });
    }

    const out = JSON.parse(raw);

    // clamp effects safety
    if (out?.options?.length === 2) {
      for (const opt of out.options) {
        for (const k of Object.keys(opt.effects || {})) {
          opt.effects[k] = Math.max(-0.25, Math.min(0.25, opt.effects[k]));
        }
      }
    }

    // birth stats clamp
    if (out.birth_stats) {
      for (const k of Object.keys(out.birth_stats)) {
        out.birth_stats[k] = clamp01(out.birth_stats[k]);
      }
    }

    return res.json({
      age_from: state.age,
      age_to: newAge,
      scenario: {
        text: out.text,
        options: out.options,
        relationship_changes: out.relationship_changes || { replace_index: null, new_person: null },
        death_cause_hint: out.death_cause_hint || "",
      },
      ...(isBirth
        ? {
            birth_stats: out.birth_stats,
            relationships: out.relationships,
          }
        : {}),
      request_id: response._request_id || null,
    });
  } catch (err) {
    console.error("TURN ERROR:", err?.message || err);

    return res.status(500).json({
      error: "turn_failed",
      message: "Model failed to return valid JSON. Retry.",
    });
  }
});

app.post("/api/apply", (req, res) => {
  try {
    const { age, stats, effects, death_cause_hint } = req.body || {};
    if (typeof age !== "number" || !stats || !effects) {
      return res.status(400).json({ error: "bad_request", message: "Invalid apply payload" });
    }

    const next = { ...stats };

    for (const k of Object.keys(effects)) {
      next[k] = clamp01((next[k] ?? 0.5) + effects[k]);
    }

    // Infant protection (unless story strongly implies lethal)
    let deathChance = computeMortalityChance(age, next);
    if (age <= 1) deathChance = Math.min(deathChance, 0.001);

    const roll = Math.random();
    const died = roll < deathChance;

    return res.json({
      next_stats: next,
      died,
      cause_hint: died ? (death_cause_hint || "complications") : "",
    });
  } catch (err) {
    console.error("APPLY ERROR:", err?.message || err);
    return res.status(400).json({ error: "bad_request", message: "Apply failed" });
  }
});

app.post("/api/epilogue", async (req, res) => {
  try {
    const body = req.body || {};
    const prompt = `
Write a final short epilogue as 1 paragraph.
Address "you".
Explain what happened and why (grounded, factual-feeling).
Include cause of death as the final beat.
No headings. No lists. No sentimentality.
`.trim();

    const response = await client.responses.create({
      model: "gpt-4.1",
      input: [
        { role: "system", content: "You write hard, grounded endings." },
        { role: "user", content: prompt },
        { role: "user", content: JSON.stringify({ nonce: nonce(), ...body }) },
      ],
      max_output_tokens: 300,
    });

    return res.json({
      text: response.output_text || `You die at ${body.age}. Cause: ${body.cause || "complications"}.`,
    });
  } catch (err) {
    console.error("EPILOGUE ERROR:", err?.message || err);
    return res.status(500).json({ error: "epilogue_failed" });
  }
});

const port = process.env.PORT || 8787;
app.listen(port, () => console.log(`✅ Server running on http://localhost:${port}`));
