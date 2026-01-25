// server.mjs
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import OpenAI from "openai";
import crypto from "crypto";

const app = express();
app.use(express.json({ limit: "1mb" }));

app.use(cors({
  origin: ["https://life-sim-chi.vercel.app"],
  methods: ["POST", "GET"]
}));

app.use(
  rateLimit({
    windowMs: 60_000,
    max: 120,
  })
);

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* -----------------------------
   Utilities
-------------------------------- */

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

// 5–15 years inclusive
function jumpYears() {
  return Math.floor(5 + Math.random() * 11);
}

// Hidden mortality engine (backend only)
function computeMortalityChance(age, stats) {
  const base = Math.min(0.85, Math.pow(age / 112, 3) * 0.55);
  const healthPenalty = (1 - (stats.health ?? 0.5)) * 0.35;
  const stressPenalty = (stats.stress ?? 0.5) * 0.20;
  const exposurePenalty = (stats.exposure ?? 0.5) * 0.22;
  const freedomBuffer = ((stats.freedom ?? 0.5) - 0.5) * 0.05;

  const p = base + healthPenalty + stressPenalty + exposurePenalty - freedomBuffer;
  return Math.max(0.001, Math.min(0.92, p));
}

function safeParseJSON(maybeJSONText) {
  const txt = (maybeJSONText ?? "").toString();
  try {
    return JSON.parse(txt);
  } catch {}

  const first = txt.indexOf("{");
  const last = txt.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return JSON.parse(txt.slice(first, last + 1));
  }

  throw new Error("Could not parse JSON output");
}

function normalizeEffects(effects) {
  const allowed = new Set([
    "money",
    "stability",
    "status",
    "health",
    "stress",
    "freedom",
    "exposure",
  ]);

  const out = {};
  if (!effects || typeof effects !== "object") return out;

  for (const [k, v] of Object.entries(effects)) {
    if (!allowed.has(k)) continue;
    const n = Number(v);
    if (!Number.isFinite(n)) continue;
    out[k] = Math.max(-0.25, Math.min(0.25, n));
  }

  return out;
}

function normalizeStats(stats) {
  const keys = ["money", "stability", "status", "health", "stress", "freedom", "exposure"];
  const out = {};
  for (const k of keys) {
    out[k] = clamp01(Number(stats?.[k] ?? 0.5));
  }
  return out;
}

function normalizeRelationships(rels) {
  const arr = Array.isArray(rels) ? rels : [];
  const cleaned = arr
    .slice(0, 3)
    .map((p) => ({
      name: String(p?.name ?? "").trim().replace(/\s+/g, " "),
      role: String(p?.role ?? "").trim().replace(/\s+/g, " "),
    }))
    .filter((p) => p.name.length > 0 && p.role.length > 0);

  // if model gives fewer than 3, still return what it did give
  return cleaned;
}

function normalizeScenario(s) {
  const text = String(s?.text ?? "").trim();
  const options = Array.isArray(s?.options) ? s.options : [];

  if (!text || options.length !== 2) {
    throw new Error("Scenario missing required fields");
  }

  const o0 = options[0] ?? {};
  const o1 = options[1] ?? {};

  const normLabel = (label, prefix) => {
    const raw = String(label ?? "").trim();
    const fixed = raw.replace(/^([AB])\s*[-–—:]?\s*/i, `${prefix} - `);
    return fixed.toUpperCase().startsWith(prefix + " -") ? fixed : `${prefix} - ${fixed}`;
  };

  return {
    text,
    options: [
      { label: normLabel(o0.label, "A"), effects: normalizeEffects(o0.effects) },
      { label: normLabel(o1.label, "B"), effects: normalizeEffects(o1.effects) },
    ],
    death_cause_hint: String(s?.death_cause_hint ?? "").trim(),
  };
}

/* -----------------------------
   OpenAI: JSON generator
-------------------------------- */

async function callModelJSON({ state, age_from, age_to, is_birth }) {
  // NO pre-written narrative text here.
  // Only strict instructions + schema.
  const system = `
You are the world-simulator for a binary-choice life game.

ABSOLUTE RULES:
- Output MUST be valid JSON only. No markdown.
- Address the player as "you".
- 1 paragraph only in "scenario.text".
- No headings. No sections. No lists.
- Do NOT use the word "pivot" or "pivotal".
- Choices must be explicit actions and irreversible.
- Make it hard. Volatile. Consequences real.
- Time jump is already decided: from age_from to age_to.
- Provide ALL start-state info in prose inside scenario.text:
  living situation, source of income, lifestyle, and the immediate crisis driving the decision.

RELATIONSHIP RULES (strict):
- Exactly 3 relationships in relationships[].
- Roles MUST be realistic for the current age.
- At Age 0: do NOT use "guardian" unless the player is explicitly in care / custody / legal supervision.
- Prefer these Age 0 role sets:
  - mother, father, grandparent
  - mother, father, midwife
  - mother, father, older sibling
  - mother, social_worker, foster_carer (only if explained)
- At ages 5–18: prefer roles like parent, sibling, teacher, friend, coach, neighbour.
- At adult ages: friend, partner, boss, colleague, landlord, mentor, dealer, client, rival, etc.
- If a role would imply custody/legal control, the scenario.text MUST explicitly justify it.

STATS:
- For birth turns (age 0), you MUST compute a realistic start-state stats profile
  based on city, gender, desire, and plausible family circumstance.
- Stats must be floats in [0,1].

UNIQUENESS (strict):
- Use nonce + session_id to make each run distinct, even if inputs match.
- Never mention nonce or session_id in the text.
- Avoid reusing the same names, places, or phrasing across different lives.

OUTPUT JSON SCHEMA (must match exactly):
{
  "birth_stats": { "money":0-1,"stability":0-1,"status":0-1,"health":0-1,"stress":0-1,"freedom":0-1,"exposure":0-1 } | null,
  "relationships": [
    { "name":"FirstName", "role":"role" },
    { "name":"FirstName", "role":"role" },
    { "name":"FirstName", "role":"role" }
  ],
  "scenario": {
    "text": "one paragraph prose",
    "options": [
      { "label": "A - ...", "effects": { "money":-0.25..0.25, ... } },
      { "label": "B - ...", "effects": { ... } }
    ],
    "death_cause_hint": "string"
  }
}

Effects keys allowed: money, stability, status, health, stress, freedom, exposure.
Each effect value MUST be a number between -0.25 and +0.25.
Effects MUST exist on both options (can be {}).
`;

  const user = {
  nonce,
  session_id: state.session_id || null,
  is_birth,
  age_from,
  age_to,
  player: {
    gender: String(state.gender ?? "unspecified"),
    city: String(state.city ?? "London"),
    desire: String(state.desire ?? "free"),
  },
  current_stats: state.stats ?? null,
  current_relationships: state.relationships ?? [],
  recent_history: Array.isArray(state.history) ? state.history.slice(-20) : [],
};

  const r = await client.responses.create({
    model: "gpt-5",
    input: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(user) },
    ],
    text: { format: { type: "json_object" } },
  });

  const raw = r.output_text || "";
  return safeParseJSON(raw);
}

/* -----------------------------
   Routes
-------------------------------- */

app.get("/health", (req, res) => {
  res.json({ ok: true, time: Date.now() });
});

app.post("/api/turn", async (req, res) => {
  try {
    const nonce = crypto.randomUUID();
    const state = req?.body?.state || {};
    const age_from = Number(state.age ?? 0);
    const history = Array.isArray(state.history) ? state.history : [];

    const is_birth = age_from === 0 && history.length === 0;
    const age_to = is_birth ? 0 : Math.min(112, age_from + jumpYears());

    // Ask OpenAI for everything (no backend narrative)
    let out = await callModelJSON({ state, age_from, age_to, is_birth });

    // Validate / normalize hard
    const relationships = normalizeRelationships(out.relationships);
    const scenario = normalizeScenario(out.scenario);
    const birth_stats = out.birth_stats ? normalizeStats(out.birth_stats) : null;

    // Enforce 3 relationships on birth (required)
    if (is_birth && relationships.length !== 3) {
      // If model failed to provide 3, ask it again (repair pass) — still no fallback narrative
      out = await callModelJSON({ state, age_from, age_to, is_birth });
    }

    const relationships2 = normalizeRelationships(out.relationships);
    const scenario2 = normalizeScenario(out.scenario);
    const birth_stats2 = out.birth_stats ? normalizeStats(out.birth_stats) : null;

    return res.json({
      age_from,
      age_to,
      birth_stats: birth_stats2,
      relationships: relationships2,
      scenario: scenario2,
    });
  } catch (err) {
    console.error("TURN ERROR:", err);
    // No pre-written narrative fallback.
    return res.status(503).json({
      error: "turn_failed",
      message: "Model failed to return valid JSON. Retry.",
    });
  }
});

app.post("/api/apply", (req, res) => {
  try {
    const age = Number(req?.body?.age ?? 0);

    const statsIn = req?.body?.stats ?? {};
    const effectsIn = req?.body?.effects ?? {};

    const stats = normalizeStats(statsIn);

    const allowed = new Set(["money", "stability", "status", "health", "stress", "freedom", "exposure"]);
    const next = { ...stats };

    for (const [k, v] of Object.entries(effectsIn || {})) {
      if (!allowed.has(k)) continue;
      const n = Number(v);
      if (!Number.isFinite(n)) continue;
      const clamped = Math.max(-0.25, Math.min(0.25, n));
      next[k] = clamp01((next[k] ?? 0.5) + clamped);
    }

    const deathChance = computeMortalityChance(age, next);
    const died = Math.random() < deathChance;

    return res.json({
      next_stats: next,
      died,
      deathChance, // keep hidden client-side unless you die
    });
  } catch (err) {
    console.error("APPLY ERROR:", err);
    return res.status(400).json({ error: "bad_request" });
  }
});

const port = process.env.PORT || 8787;
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
