// server.mjs — Phase 2: MUSEUM QUALITY
// Life Sim Backend (Express + OpenAI Structured Outputs)
//
// Phase 1 upgrades:
// ✅ Dramatically more volatile lives — bigger stat swings, wilder stories
// ✅ Death from natural causes is RARE — only guaranteed by age 111
// ✅ Death from risky behavior scales hard — max exposure + low health = real danger
// ✅ Parent deaths modeled: linear increasing probability between player age 4–40
// ✅ Stats deeply connected to narrative — AI references stat levels in prose
// ✅ Effect ranges widened: -0.40 to +0.40 for bold choices
// ✅ All Phase 0 features preserved (sessions, retry, analytics, prefetch)
//
// Phase 2 upgrades:
// ✅ Enhanced epilogue: structured output with achievements, stat arc, verdict
// ✅ Accepts stat_history for richer retrospective analysis
// ✅ Desire callback in epilogue — the gap between wanting and getting

import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import OpenAI from "openai";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import * as analytics from "./analytics.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(express.json({ limit: "2mb" }));

const PORT = process.env.PORT || 8787;

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(
  cors({
    origin: true,
    methods: ["POST", "GET", "OPTIONS"],
  })
);

app.use(
  rateLimit({
    windowMs: 60_000,
    max: 90,
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

function jumpYears(currentAge) {
  // Tighter jumps everywhere = more turns = more drama
  if (currentAge < 1) return randomInt(3, 6);       // birth → early childhood
  if (currentAge < 14) return randomInt(3, 6);       // childhood → teen
  if (currentAge < 25) return randomInt(1, 4);       // teen/young adult — TIGHTEST, most drama
  if (currentAge < 40) return randomInt(2, 5);       // prime years — still tight
  if (currentAge < 60) return randomInt(3, 7);       // middle age
  if (currentAge < 80) return randomInt(2, 6);       // senior years — tighter for late-life drama
  return randomInt(2, 5);                             // elderly — each year counts
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
  const out = {};
  for (const k of STAT_KEYS) out[k] = Number(effects?.[k] ?? 0);
  return out;
}

function applyEffects(stats, effects) {
  const base = normalizeStats(stats);
  const eff = normalizeEffects(effects);
  const next = {};
  for (const k of STAT_KEYS) next[k] = clamp01(base[k] + eff[k]);
  return next;
}

function withDisplayRelationships(rels) {
  const arr = Array.isArray(rels) ? rels : [];
  return arr.slice(0, 3).map((p) => {
    const name = String(p?.name || "").trim();
    const role = String(p?.role || "").trim();
    const display = name && role ? `${name} (${role})` : "";
    return { name, role, display };
  });
}

// ----------------------
// Stat summary for AI context
// ----------------------
function describeStatLevel(value) {
  if (value <= 0.10) return "critically low";
  if (value <= 0.25) return "very low";
  if (value <= 0.40) return "low";
  if (value <= 0.60) return "moderate";
  if (value <= 0.75) return "high";
  if (value <= 0.90) return "very high";
  return "extreme";
}

function buildStatContext(stats) {
  const s = normalizeStats(stats);
  const lines = [];

  // Only call out stats that are notably high or low — the AI should weave these in
  if (s.money <= 0.20) lines.push(`MONEY is ${describeStatLevel(s.money)} (${s.money.toFixed(2)}) — they are broke, scraping by, desperate for cash`);
  else if (s.money >= 0.80) lines.push(`MONEY is ${describeStatLevel(s.money)} (${s.money.toFixed(2)}) — they are wealthy, doors open, temptation everywhere`);

  if (s.stability <= 0.20) lines.push(`STABILITY is ${describeStatLevel(s.stability)} (${s.stability.toFixed(2)}) — life is chaotic, nothing is anchored, they could lose everything`);
  else if (s.stability >= 0.80) lines.push(`STABILITY is ${describeStatLevel(s.stability)} (${s.stability.toFixed(2)}) — life is locked in, routine, maybe suffocating`);

  if (s.status <= 0.20) lines.push(`STATUS is ${describeStatLevel(s.status)} (${s.status.toFixed(2)}) — they are invisible, overlooked, nobody`);
  else if (s.status >= 0.80) lines.push(`STATUS is ${describeStatLevel(s.status)} (${s.status.toFixed(2)}) — they are known, watched, scrutinized`);

  if (s.health <= 0.20) lines.push(`HEALTH is ${describeStatLevel(s.health)} (${s.health.toFixed(2)}) — they are falling apart physically, every risk could be fatal`);
  else if (s.health >= 0.80) lines.push(`HEALTH is ${describeStatLevel(s.health)} (${s.health.toFixed(2)}) — they are strong, vital, physically invincible-feeling`);

  if (s.stress >= 0.75) lines.push(`STRESS is ${describeStatLevel(s.stress)} (${s.stress.toFixed(2)}) — they are cracking, making bad decisions, near breaking point`);
  else if (s.stress <= 0.15) lines.push(`STRESS is ${describeStatLevel(s.stress)} (${s.stress.toFixed(2)}) — eerily calm, maybe detached, maybe at peace`);

  if (s.freedom <= 0.20) lines.push(`FREEDOM is ${describeStatLevel(s.freedom)} (${s.freedom.toFixed(2)}) — they are trapped, controlled, desperate to escape`);
  else if (s.freedom >= 0.80) lines.push(`FREEDOM is ${describeStatLevel(s.freedom)} (${s.freedom.toFixed(2)}) — they answer to nobody, unmoored, dangerously free`);

  if (s.exposure >= 0.75) lines.push(`EXPOSURE is ${describeStatLevel(s.exposure)} (${s.exposure.toFixed(2)}) — they are living dangerously, one wrong move from catastrophe`);
  else if (s.exposure <= 0.15) lines.push(`EXPOSURE is ${describeStatLevel(s.exposure)} (${s.exposure.toFixed(2)}) — they are hidden, safe, unknown`);

  if (lines.length === 0) {
    return "All stats are in the moderate range — life is stable but something needs to shake it up. CREATE CONFLICT.";
  }

  return "CURRENT STAT CONTEXT (weave these into the narrative — the story MUST reflect these realities):\n" + lines.join("\n");
}

/**
 * Parent death check — should a parent die this turn?
 * Linear probability increase from age 4 to age 40.
 * At age 4: ~3% chance per turn. At age 40: ~60% chance per turn.
 * Random and organic — sometimes early, sometimes late.
 */
function shouldParentDie(playerAge) {
  if (playerAge < 17 || playerAge > 50) return false;
  // Linear ramp: 0.03 at age 4, up to 0.60 at age 40
  const t = (playerAge - 17) / (50 - 17); // 0..1
  const probability = 0.03 + t * 0.57;   // 0.03..0.60
  return Math.random() < probability;
}

/**
 * Find a living parent in the relationship slots.
 * Returns the index, or -1 if no living parent found.
 */
function findLivingParentIndex(relationships) {
  const parentRoles = ["mother", "father", "mom", "dad", "parent", "guardian", "grandmother", "grandfather", "grandma", "grandpa"];
  for (let i = 0; i < relationships.length; i++) {
    const role = (relationships[i]?.role || "").toLowerCase();
    if (role.includes("deceased") || role.includes("dead") || role.includes("late ")) continue;
    if (parentRoles.some(pr => role.includes(pr))) return i;
  }
  return -1;
}

/**
 * Mortality: DRAMATICALLY reduced for natural causes.
 * Death is almost impossible from aging alone until very old.
 * But risky behavior (high exposure + low health + high stress) can kill at any age.
 * Hard cap: guaranteed death at age 111.
 */
function computeMortalityChance(age, stats) {
  const a = Math.max(0, Math.min(111, Number(age) || 0));
  const s = normalizeStats(stats);

  // Hard cap — you WILL die at 111
  if (a >= 111) return 1.0;

  // ---- RISK-BASED DEATH (can happen at any age if you live dangerously) ----
  // This is the "you played with fire" component
  const exposureDanger = Math.pow(s.exposure, 2.5) * 0.35;       // exposure 1.0 → 0.35
  const healthCrisis = Math.pow(1 - s.health, 3) * 0.30;         // health 0.0 → 0.30
  const stressCrack = Math.pow(s.stress, 3) * 0.15;              // stress 1.0 → 0.15
  const riskDeath = exposureDanger + healthCrisis + stressCrack;  // max theoretical ~0.80

  // ---- AGE-BASED NATURAL DEATH (very gentle curve, only real threat past 85+) ----
  let naturalDeath = 0;
  if (a < 5) {
    // Infant/toddler — essentially zero
    naturalDeath = 0.0001;
  } else if (a < 30) {
    // Young — almost zero from natural causes
    naturalDeath = 0.0003;
  } else if (a < 50) {
    // Prime — still extremely low
    naturalDeath = 0.001;
  } else if (a < 65) {
    // Middle age — barely noticeable
    naturalDeath = 0.005 + ((a - 50) / 15) * 0.015; // 0.005..0.020
  } else if (a < 80) {
    // Senior — starting to creep up
    naturalDeath = 0.02 + ((a - 65) / 15) * 0.08; // 0.02..0.10
  } else if (a < 95) {
    // Elderly — moderate
    naturalDeath = 0.10 + ((a - 80) / 15) * 0.25; // 0.10..0.35
  } else if (a < 105) {
    // Very old — significant
    naturalDeath = 0.35 + ((a - 95) / 10) * 0.30; // 0.35..0.65
  } else {
    // 105-110 — high but not guaranteed
    naturalDeath = 0.65 + ((a - 105) / 6) * 0.30; // 0.65..0.95
  }

  // Stability and freedom provide small buffers against risk death only
  const stabilityBuffer = Math.max(0, (s.stability - 0.5) * 0.06);
  const freedomBuffer = Math.max(0, (s.freedom - 0.4) * 0.04);

  // Combine: natural death OR risk death (whichever is more relevant)
  // They don't simply add — use a "worst of" approach with some blending
  const combined = Math.max(naturalDeath, riskDeath) + Math.min(naturalDeath, riskDeath) * 0.3;
  const final = combined - stabilityBuffer - freedomBuffer;

  return Math.max(0.0001, Math.min(0.98, final));
}

// ----------------------
// Server-side session store (in-memory)
// ----------------------
const SESSIONS = new Map();
const SESSION_TTL_MS = 1000 * 60 * 60 * 2; // 2 hours

function getSession(sessionId, runId) {
  const key = `${sessionId}:${runId}`;
  const s = SESSIONS.get(key);
  if (!s) return null;
  if (Date.now() - s.updatedAt > SESSION_TTL_MS) {
    SESSIONS.delete(key);
    return null;
  }
  return s;
}

function setSession(sessionId, runId, data) {
  const key = `${sessionId}:${runId}`;
  SESSIONS.set(key, { ...data, updatedAt: Date.now() });
}

// Clean expired sessions every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of SESSIONS) {
    if (now - v.updatedAt > SESSION_TTL_MS) SESSIONS.delete(k);
  }
}, 1000 * 60 * 10);

// ----------------------
// Prefetch cache (in-memory)
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

// Clean expired prefetch every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of PREFETCH) {
    if (now - v.createdAt > PREFETCH_TTL_MS) PREFETCH.delete(k);
  }
}, 1000 * 60 * 5);

// ----------------------
// Analytics (persistent via PostgreSQL, fallback to in-memory)
// ----------------------
// The analytics module handles both DB and in-memory fallback.
// We keep the legacy logEvent signature for backward compat.
function logEvent(event) {
  analytics.logEvent({
    type: event.type,
    session_id: event.session_id,
    run_id: event.run_id,
    data: event.data,
  });
}

// ----------------------
// Retry with exponential backoff
// ----------------------
async function withRetry(fn, { maxAttempts = 3, baseDelay = 1000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.error(`Attempt ${attempt}/${maxAttempts} failed:`, err?.message || err);

      // Don't retry on 4xx client errors
      if (err?.status >= 400 && err?.status < 500) throw err;

      if (attempt < maxAttempts) {
        const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 500;
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }
  throw lastError;
}

// ----------------------
// Structured Outputs Schemas (STRICT)
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
      options: { type: "array", minItems: 2, maxItems: 2, items: OPTION_SCHEMA },
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
      options: { type: "array", minItems: 2, maxItems: 2, items: OPTION_SCHEMA },
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
// Epilogue structured output schema (Phase 2)
// ----------------------
const STAT_ARC_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    money: { type: "string" },
    stability: { type: "string" },
    status: { type: "string" },
    health: { type: "string" },
    stress: { type: "string" },
    freedom: { type: "string" },
    exposure: { type: "string" },
  },
  required: ["money", "stability", "status", "health", "stress", "freedom", "exposure"],
};

const EpilogueJSONSchema = {
  name: "Epilogue",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      text: { type: "string" },
      achievements: { type: "string" },
      stat_arc: STAT_ARC_SCHEMA,
      verdict: { type: "string" },
    },
    required: ["text", "achievements", "stat_arc", "verdict"],
  },
};

// ----------------------
// Prompts — PHASE 1: VOLATILE LIVES
// ----------------------
function systemPrompt(statContext) {
  return `
You generate raw, unpredictable life moments for a binary-choice simulator. Every life should feel singular — strange, beautiful, ugly, surprising. You are writing a life, not a career plan.

TONE:
- Gritty literary fiction, not YA or self-help. Think: Denis Johnson, Ottessa Moshfegh, Hanya Yanagihara, Roberto Bolaño.
- Lives should feel messy, contradictory, and real. People make terrible decisions. Good things happen to bad people. Kindness appears in unexpected places.
- Not every moment is dramatic — sometimes the most important scenes are quiet (a conversation at 3am, a letter never sent, the smell of a kitchen).
- But also: do NOT be boring. These lives should make players lean forward.

═══════════════════════════════════════════════════
STATS ARE THE SPINE OF THE STORY — THIS IS CRITICAL
═══════════════════════════════════════════════════

The player's stats are not just numbers — they ARE the story. Every scenario MUST reflect the player's current stat reality:

${statContext}

STAT-STORY INTEGRATION RULES:
- If money is critically low, the character is VISIBLY desperate — skipping meals, borrowing from dangerous people, sleeping in cars, selling possessions. The scenario MUST show this.
- If health is very low, the character is PHYSICALLY falling apart — can't climb stairs, coughing blood, trembling hands, hospital visits. Reference the body.
- If stress is extreme, the character is MENTALLY cracking — paranoia, insomnia, lashing out at loved ones, substance use to cope, bad snap decisions.
- If exposure is high, the scenario should involve DANGEROUS situations — you're known to the wrong people, you're in over your head, someone's watching you.
- If freedom is low, the character is TRAPPED — controlled by a partner, institution, debt, obligation, addiction, or contract. They can't just leave.
- If stability is low, everything is PRECARIOUS — the apartment is temporary, the job could end tomorrow, one bad day ruins everything.
- If status is high, people RECOGNIZE them — fame, notoriety, reputation. This creates problems AND opportunities.
- If multiple stats are extreme, COMBINE them. Broke + high stress + low health = someone spiraling. Rich + high exposure + low stability = empire about to crumble.
- MODERATE stats are BORING. When all stats are moderate, your job is to CREATE the event that pushes something to an extreme. Moderate lives need disruption.

VOLATILITY RULES — EVERYTHING TURNED UP:
- ~30% of turns should involve something DRASTICALLY unexpected: sudden wealth, devastating loss, a crime, a betrayal, an accident, falling in love with the wrong person, a secret revealed, getting fired, a pregnancy, an arrest, a windfall, an addiction spiral, fleeing a country, a viral moment, a natural disaster, a diagnosis, a robbery, a fire, witnessing something you can't forget.
- ~25% should be slow-burn turning points with TEETH: not "your relationship is getting complicated" but "you find the messages on their phone and your hands are shaking."
- ~25% should involve genuine moral dilemmas where BOTH options cost something real.
- ~20% should be character-driven eruptions: someone in your life does something unforgivable, or unbearably kind.
- NEVER generate a "your career is going well, do you want to push harder or relax?" turn. That is BANNED. Find the conflict, the betrayal, the secret, the disaster, the opportunity that could destroy everything.
- The COMFORTABLE MIDDLE is the enemy. If life is going well, BREAK something. If life is terrible, offer a terrible temptation.

EFFECT MAGNITUDE RULES — GO BIG:
- Effects range from -0.40 to +0.40. USE THE FULL RANGE.
- Safe, boring choices should still move stats by ±0.05 to ±0.15. Nothing is free.
- Bold choices MUST have bold effects. Minimum ±0.15, ideally ±0.20 to ±0.35.
- RECKLESS choices (rob someone, start an affair, take the drug deal, bet everything) should have EXTREME effects: ±0.25 to ±0.40 on multiple stats.
- Every choice should move at least 3 stats meaningfully (±0.08+).
- If a choice involves physical danger, exposure MUST increase significantly (+0.15 to +0.35).
- If a choice involves financial risk, money should swing hard.
- Stress should move on almost every choice. Life is stressful.
- ASYMMETRIC effects are great: a choice that gives +0.30 money but +0.25 exposure and -0.20 stability is a real dilemma.
- Choices should NEVER both be "sensible." At least one should be reckless, emotional, impulsive, or morally grey.

RELATIONSHIP RULES — CRITICAL:
- You have 3 relationship slots. These are the most important people in the player's life RIGHT NOW.
- People MUST change over time. A 40-year-old should NOT still have "mother" and "father" as 2 of their 3 slots unless those relationships are actively central to the drama.
- USE relationship_changes to rotate characters in and out:
  • Friendships end. Partners leave. Children grow distant. Mentors disappear.
  • New people arrive: lovers, rivals, cellmates, business partners, neighbors who change your life, a child you didn't expect.
  • When setting new_person to null, the death/departure MUST be referenced in the prose text.
  • Aim to rotate at least 1 relationship every 2-3 turns after age 20.
- Relationship roles should be specific and evocative: not just "friend" but "childhood friend," "cellmate," "business rival," "estranged sister," "AA sponsor," "affair," "parole officer," "the one who got away."

PROSE RULES:
- Always address the player as "you."
- First names only. Every person mentioned: Name (role). Role AFTER name.
- One paragraph, max ~900 characters. No headings, no lists, no tables.
- Include sensory details: a sound, a smell, a texture, a weather detail, a specific object.
- The prose MUST reflect the stat context above. If they're broke, show it. If they're sick, show it. If they're stressed, show it in their behavior.
- The prose should make the player FEEL something — dread, hope, guilt, nostalgia, excitement, shame, rage.
- Include the player's living situation, how they survive financially, and what's happening RIGHT NOW.
- Never use the word "pivot."

CHOICE RULES:
- Exactly 2 choices. Keep labels SHORT (under 65 chars). Start with a verb.
- Choices should be genuinely different paths with genuinely different consequences.
- At least one choice should carry REAL risk — moral, financial, relational, physical, legal.
- The "safe" choice should still cost something. Safety has a price.

DEATH_CAUSE_HINT:
- Always provide a plausible cause of death relevant to the current scenario AND stat levels.
- If health is low, reference the body failing. If exposure is high, reference the danger catching up.
- Make it specific: not "health complications" but "liver failure," "car accident on the coast road," "overdose in a motel bathroom," "heart attack while arguing," "stabbed outside the bar," "fell from the scaffolding."

Output must be valid JSON matching the schema exactly.
`.trim();
}

function birthInstruction() {
  return `
This is the BIRTH turn (Age 0). The player has just entered their city, gender, and what they want to become.

You must:
- Infer a vivid, specific starting context from city + gender + desire.
- Don't be generic. A birth in Lagos is different from a birth in Oslo. A kid who wants to be "free" is different from one who wants to be "rich."
- Generate 3 relationships (first name + role). These must make sense at birth:
  Example roles: mother, father, grandmother, guardian, older sibling, family friend, midwife, neighbor.
  Give them PERSONALITY through the prose — one sentence about each that hints at who they are.
- Compute birth_stats (0..1) for all 7 stats. These should reflect the starting circumstances:
  A birth into poverty in a war zone ≠ a birth into stability in suburban Connecticut.
  Be BOLD with birth stats — don't default to 0.5. A rough start should have 0.15 money, 0.20 stability. A privileged start should have 0.85 money.
- Write prose describing the birth context. Make it atmospheric — the room, the sounds, who's there, what the city smells like.
- The first choice should be meaningful and hint at the life to come. Not trivial.
- Effects on the first choice should already be SIGNIFICANT (±0.10 to ±0.25). The first choice matters.

Remember: any person mentioned must be "Name (role)".
`.trim();
}


// ----------------------
// OpenAI wrapper (with retry)
// ----------------------
async function generateTurn({ isBirth, payload }) {
  const schema = isBirth ? BirthJSONSchema : TurnJSONSchema;
  const statContext = isBirth ? "Birth turn — stats not yet established." : buildStatContext(payload.stats);

  // Build the parent death directive if applicable
  let parentDeathDirective = "";
  if (!isBirth && payload.parent_death_index !== undefined && payload.parent_death_index >= 0) {
    const parent = payload.relationships?.[payload.parent_death_index];
    if (parent?.name && parent?.role) {
      parentDeathDirective = `
MANDATORY PARENT DEATH: ${parent.name} (${parent.role}) MUST die in this turn's prose. Work their death into the scenario naturally — it can be the central event or happen alongside other events. Set relationship_changes to: replace_index=${payload.parent_death_index}, new_person=null. Reference how their death affects the player emotionally. This is not optional.`;
    }
  }

  return withRetry(async () => {
    const response = await client.responses.create({
      model: "gpt-4.1",
      input: [
        { role: "system", content: systemPrompt(statContext) + parentDeathDirective },
        ...(isBirth ? [{ role: "user", content: birthInstruction() }] : []),
        { role: "user", content: JSON.stringify(payload) },
      ],
      max_output_tokens: 1200,
      text: {
        format: {
          type: "json_schema",
          name: schema.name,
          strict: true,
          schema: schema.schema,
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
  });
}

// ----------------------
// Session recovery endpoint
// ----------------------
app.get("/api/session/:sessionId/:runId", (req, res) => {
  const { sessionId, runId } = req.params;
  const session = getSession(sessionId, runId);

  if (!session) {
    return res.status(404).json({ error: "session_not_found" });
  }

  return res.json({
    age: session.age,
    gender: session.gender,
    city: session.city,
    desire: session.desire,
    stats: session.stats,
    relationships: session.relationships,
    history: session.history,
    currentScenario: session.currentScenario,
    died: session.died || false,
  });
});

// ----------------------
// Analytics endpoints
// ----------------------
app.post("/api/analytics", (req, res) => {
  const event = req.body;
  if (!event?.type) {
    return res.status(400).json({ error: "missing event type" });
  }
  logEvent({
    type: String(event.type),
    session_id: String(event.session_id || ""),
    run_id: String(event.run_id || ""),
    data: event.data || {},
  });
  return res.json({ ok: true });
});

// Summary (backward compatible + enhanced)
app.get("/api/analytics/summary", async (_, res) => {
  try {
    const summary = await analytics.getSummary();
    // Add legacy fields for backward compat
    summary.active_sessions = SESSIONS.size;
    summary.prefetch_entries = PREFETCH.size;
    return res.json(summary);
  } catch (err) {
    return res.status(500).json({ error: "summary_failed", message: err?.message });
  }
});

// Player journey — follow one player's entire life
app.get("/api/analytics/journey/:runId", async (req, res) => {
  try {
    const journey = await analytics.getPlayerJourney(req.params.runId);
    if (!journey) return res.status(404).json({ error: "not_found" });
    return res.json(journey);
  } catch (err) {
    return res.status(500).json({ error: "journey_failed", message: err?.message });
  }
});

// Death board
app.get("/api/analytics/deaths", async (req, res) => {
  try {
    const sort = req.query.sort === "youngest" ? "youngest" : req.query.sort === "newest" ? "newest" : "oldest";
    const limit = Math.min(parseInt(req.query.limit) || 50, 500);
    const city = req.query.city || null;
    const deaths = await analytics.getDeathBoard({ sort, limit, city });
    return res.json(deaths);
  } catch (err) {
    return res.status(500).json({ error: "deaths_failed", message: err?.message });
  }
});

// City stats
app.get("/api/analytics/cities", async (_, res) => {
  try {
    return res.json(await analytics.getCityStats());
  } catch (err) {
    return res.status(500).json({ error: "cities_failed", message: err?.message });
  }
});

// Choice patterns
app.get("/api/analytics/choices", async (_, res) => {
  try {
    return res.json(await analytics.getChoicePatterns());
  } catch (err) {
    return res.status(500).json({ error: "choices_failed", message: err?.message });
  }
});

// Stat averages by age
app.get("/api/analytics/stat-averages", async (_, res) => {
  try {
    return res.json(await analytics.getStatAverages());
  } catch (err) {
    return res.status(500).json({ error: "stats_failed", message: err?.message });
  }
});

// ─── Dashboard ───
app.get("/dashboard", (_, res) => {
  // Try multiple paths — Railway's cwd may differ from __dirname
  const paths = [
    join(__dirname, "dashboard.html"),
    join(process.cwd(), "dashboard.html"),
    "/app/dashboard.html",
  ];
  for (const p of paths) {
    try {
      const html = readFileSync(p, "utf-8");
      res.setHeader("Content-Type", "text/html");
      return res.send(html);
    } catch { /* try next */ }
  }
  return res.status(500).send(
    "dashboard.html not found. Make sure it's committed to your repo root alongside server.mjs. Tried: " + paths.join(", ")
  );
});

// ----------------------
// Main turn endpoint
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

    // Serve prefetched turn if available
    if (!isBirth && Array.isArray(state.history) && state.history.length > 0) {
      const last = String(state.history[state.history.length - 1] || "").trim();
      const letter = last.startsWith("A") ? "A" : last.startsWith("B") ? "B" : null;

      if (letter) {
        const k = prefetchKey(session_id, run_id, age_from, letter);
        const cached = getPrefetch(k);
        if (cached?.scenario) {
          // Save to session store
          setSession(session_id, run_id, {
            age: cached.age_to,
            gender: state.gender,
            city: state.city,
            desire: state.desire,
            stats: normalizeStats(state.stats),
            relationships: cached.relationships || [],
            history: Array.isArray(state.history) ? state.history.slice(-18) : [],
            currentScenario: cached.scenario,
          });

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

    const age_to = isBirth ? 0 : Math.min(111, age_from + jumpYears(age_from));

    // Check if a parent should die this turn
    let parentDeathIndex = -1;
    const currentRelationships = withDisplayRelationships(state.relationships);
    if (!isBirth && shouldParentDie(age_to)) {
      parentDeathIndex = findLivingParentIndex(currentRelationships);
    }

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
      relationships: currentRelationships,
      history: Array.isArray(state.history) ? state.history.slice(-18) : [],
    };

    // Add parent death directive to payload if applicable
    if (parentDeathIndex >= 0) {
      payload.parent_death_index = parentDeathIndex;
    }

    const out = await generateTurn({ isBirth, payload });

    const scenario = {
      text: String(out.text || ""),
      options: [
        {
          label: String(out.options?.[0]?.label || "A"),
          effects: normalizeEffects(out.options?.[0]?.effects),
        },
        {
          label: String(out.options?.[1]?.label || "B"),
          effects: normalizeEffects(out.options?.[1]?.effects),
        },
      ],
      relationship_changes: out.relationship_changes || { replace_index: null, new_person: null },
      death_cause_hint: String(out.death_cause_hint || ""),
    };

    let relationships = payload.relationships;

    // Apply relationship changes
    const rc = scenario.relationship_changes;
    if (rc && rc.replace_index !== null) {
      const idx = Number(rc.replace_index);
      if (idx >= 0 && idx <= 2 && relationships.length === 3) {
        const updated = [...relationships];

        if (rc.new_person === null) {
          const old = updated[idx];
          if (old?.name && old?.role) {
            const deceasedRole = `${old.role}, deceased`;
            updated[idx] = {
              name: old.name,
              role: deceasedRole,
              display: `${old.name} (${deceasedRole})`,
            };
          } else {
            updated[idx] = { name: "", role: "", display: "" };
          }
        } else {
          const np = {
            name: String(rc.new_person?.name || "").trim(),
            role: String(rc.new_person?.role || "").trim(),
          };
          updated[idx] = { ...np, display: `${np.name} (${np.role})` };
        }

        relationships = updated;
      }
    }

    // Save session state
    const sessionData = {
      age: age_to,
      gender: payload.gender,
      city: payload.city,
      desire: payload.desire,
      stats: payload.stats,
      relationships,
      history: payload.history,
      currentScenario: scenario,
    };

    if (isBirth) {
      sessionData.stats = normalizeStats(out.birth_stats);
      sessionData.relationships = withDisplayRelationships(out.relationships);
    }

    setSession(session_id, run_id, sessionData);

    // Log analytics
    if (isBirth) {
      analytics.logGameStart({
        session_id,
        run_id,
        gender: payload.gender,
        city: payload.city,
        desire: payload.desire,
      });
    }

    // Log this turn to the database
    analytics.logTurn({
      run_id,
      age: age_to,
      scenario_text: scenario.text,
      option_a: scenario.options[0]?.label,
      option_b: scenario.options[1]?.label,
      stats_before: isBirth ? normalizeStats(out.birth_stats) : payload.stats,
      relationships,
      death_cause_hint: scenario.death_cause_hint,
    });

    // Prefetch next A + B in background
    (async () => {
      try {
        const baseStats = payload.stats;

        const nextStatsA = applyEffects(baseStats, scenario.options[0].effects);
        const nextStatsB = applyEffects(baseStats, scenario.options[1].effects);

        const yearsA = jumpYears(age_to);
        const yearsB = jumpYears(age_to);

        // Check parent death for prefetched turns too
        const nextAgeA = Math.min(111, age_to + yearsA);
        const nextAgeB = Math.min(111, age_to + yearsB);

        let parentDeathA = -1;
        let parentDeathB = -1;
        if (shouldParentDie(nextAgeA)) {
          parentDeathA = findLivingParentIndex(relationships);
        }
        if (shouldParentDie(nextAgeB)) {
          parentDeathB = findLivingParentIndex(relationships);
        }

        const payloadA = {
          ...payload,
          nonce: runNonce(),
          stats: nextStatsA,
          relationships,
          history: [...payload.history, scenario.options[0].label].slice(-18),
          age_from: age_to,
          age_to: nextAgeA,
        };
        if (parentDeathA >= 0) payloadA.parent_death_index = parentDeathA;

        const payloadB = {
          ...payload,
          nonce: runNonce(),
          stats: nextStatsB,
          relationships,
          history: [...payload.history, scenario.options[1].label].slice(-18),
          age_from: age_to,
          age_to: nextAgeB,
        };
        if (parentDeathB >= 0) payloadB.parent_death_index = parentDeathB;

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

        // Apply relationship changes for prefetched turns
        let relsA = [...relationships];
        const rcA = scA.relationship_changes;
        if (rcA && rcA.replace_index !== null) {
          const idx = Number(rcA.replace_index);
          if (idx >= 0 && idx <= 2 && relsA.length === 3) {
            if (rcA.new_person === null) {
              const old = relsA[idx];
              if (old?.name && old?.role) {
                relsA[idx] = { name: old.name, role: `${old.role}, deceased`, display: `${old.name} (${old.role}, deceased)` };
              }
            } else {
              const np = { name: String(rcA.new_person?.name || ""), role: String(rcA.new_person?.role || "") };
              relsA[idx] = { ...np, display: `${np.name} (${np.role})` };
            }
          }
        }

        let relsB = [...relationships];
        const rcB = scB.relationship_changes;
        if (rcB && rcB.replace_index !== null) {
          const idx = Number(rcB.replace_index);
          if (idx >= 0 && idx <= 2 && relsB.length === 3) {
            if (rcB.new_person === null) {
              const old = relsB[idx];
              if (old?.name && old?.role) {
                relsB[idx] = { name: old.name, role: `${old.role}, deceased`, display: `${old.name} (${old.role}, deceased)` };
              }
            } else {
              const np = { name: String(rcB.new_person?.name || ""), role: String(rcB.new_person?.role || "") };
              relsB[idx] = { ...np, display: `${np.name} (${np.role})` };
            }
          }
        }

        setPrefetch(prefetchKey(session_id, run_id, age_to, "A"), {
          age_to: payloadA.age_to,
          scenario: scA,
          relationships: relsA,
        });

        setPrefetch(prefetchKey(session_id, run_id, age_to, "B"), {
          age_to: payloadB.age_to,
          scenario: scB,
          relationships: relsB,
        });
      } catch {
        // silently ignore prefetch failures
      }
    })();

    // Birth: return birth_stats + relationships
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

// Apply effects + decide death
app.post("/api/apply", (req, res) => {
  try {
    const age = Number(req.body?.age ?? 0);
    const stats = req.body?.stats;
    const effects = req.body?.effects;
    const session_id = String(req.body?.session_id || "").trim();
    const run_id = String(req.body?.run_id || "").trim();

    if (!stats || typeof stats !== "object") {
      return res.status(400).json({ error: "bad_request", message: "Missing stats" });
    }
    if (!effects || typeof effects !== "object") {
      return res.status(400).json({ error: "bad_request", message: "Missing effects" });
    }

    const next_stats = applyEffects(stats, effects);
    const pDeath = computeMortalityChance(age, next_stats);
    const died = Math.random() < pDeath;

    // Update session with new stats
    if (session_id && run_id) {
      const session = getSession(session_id, run_id);
      if (session) {
        session.stats = next_stats;
        if (died) session.died = true;
        setSession(session_id, run_id, session);
      }
    }

    // Log death
    if (died) {
      logEvent({
        type: "death",
        session_id,
        run_id,
        data: { age, probability: pDeath },
      });

      // Persistent: mark the run as ended
      analytics.logDeath({
        run_id,
        age,
        cause: req.body?.death_cause_hint || "unknown",
        final_stats: next_stats,
      });
    }

    return res.json({ next_stats, died, death_probability: pDeath });
  } catch (err) {
    return res.status(500).json({
      error: "apply_failed",
      message: err?.message || String(err),
    });
  }
});

// Log choices
app.post("/api/choice", (req, res) => {
  const { session_id, run_id, age, choice_index, label, effects, stats_after } = req.body || {};

  // Legacy event log
  logEvent({
    type: "choice",
    session_id: String(session_id || ""),
    run_id: String(run_id || ""),
    data: { age: Number(age || 0), choice_index, label: String(label || "") },
  });

  // Rich analytics — log the choice with stat changes
  analytics.logChoice({
    run_id: String(run_id || ""),
    age: Number(age || 0),
    chosen: choice_index === 0 ? "A" : "B",
    chosen_label: String(label || ""),
    effects: effects || {},
    stats_after: stats_after || {},
  });

  return res.json({ ok: true });
});

// ----------------------
// Stat arc helper — compute trajectory words from stat history
// ----------------------
function computeStatArcHints(statHistory, finalStats) {
  if (!Array.isArray(statHistory) || statHistory.length < 2) return null;
  const hints = {};
  for (const k of STAT_KEYS) {
    const values = statHistory.map(s => s.stats?.[k] ?? 0.5);
    const first = values[0];
    const last = finalStats?.[k] ?? values[values.length - 1];
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min;
    const delta = last - first;
    // Compute a human-readable trajectory hint for the AI
    if (range > 0.5 && Math.abs(delta) < 0.15) hints[k] = "volatile";
    else if (delta > 0.25) hints[k] = "rose significantly";
    else if (delta > 0.10) hints[k] = "slow climb";
    else if (delta < -0.25) hints[k] = "collapsed";
    else if (delta < -0.10) hints[k] = "declined";
    else if (max - last > 0.30 && max > first + 0.15) hints[k] = "peaked then fell";
    else if (last - min > 0.30 && min < first - 0.15) hints[k] = "hit bottom then recovered";
    else hints[k] = "steady";
  }
  return hints;
}

// Death epilogue — Phase 2: structured output with achievements, stat arc, verdict
app.post("/api/epilogue", async (req, res) => {
  try {
    const age = Number(req.body?.age ?? 0);
    const gender = String(req.body?.gender || "unspecified");
    const city = String(req.body?.city || "");
    const desire = String(req.body?.desire || "");
    const cause = String(req.body?.cause || "complications");
    const stats = normalizeStats(req.body?.stats);

    const relationships = withDisplayRelationships(req.body?.relationships || []);
    const history = Array.isArray(req.body?.history) ? req.body.history.slice(-20) : [];

    // Phase 2: accept stat_history for richer epilogue
    const statHistory = Array.isArray(req.body?.stat_history) ? req.body.stat_history.slice(-30) : [];
    const birthStats = statHistory.length > 0 ? normalizeStats(statHistory[0]?.stats) : null;
    const arcHints = computeStatArcHints(statHistory, stats);

    const statSummary = buildStatContext(stats);

    // Build stat trajectory context for the AI
    let statTrajectory = "";
    if (birthStats && arcHints) {
      statTrajectory = `\nSTAT TRAJECTORIES (birth → death):\n`;
      for (const k of STAT_KEYS) {
        statTrajectory += `  ${k.toUpperCase()}: ${birthStats[k].toFixed(2)} → ${stats[k].toFixed(2)} (${arcHints[k]})\n`;
      }
    }

    const sys = `
Write a death epilogue for a life simulator. This is the final screen the player sees. Make it count.

The player was born in ${city}. They were ${gender}. They wanted to become: "${desire}".
They died at age ${age}. Cause of death: ${cause}.

${statSummary}
${statTrajectory}

You must generate FOUR fields in your JSON response:

1. "text": The death prose (500–900 characters).
   - Address the player as "you."
   - Any person mentioned: Name (role).
   - No headings, no lists, no moralising, no "lessons learned."
   - Open with the immediate moment of death — where you are, what you see, who's there (or who isn't).
   - The death scene MUST reflect the final stats. If health was critically low, the body was already failing. If exposure was extreme, the danger finally caught up. If they were rich, describe the expensive room they die in. If they were broke, describe the bare walls.
   - Include 2–3 specific sensory details from the life: a recurring smell, a room you always returned to, a song, a piece of clothing, a food, a view from a window.
   - Reference at least one relationship — what they meant, what was left unsaid, or where they are now.
   - State the cause of death plainly in one sentence.
   - End with one image — not a moral, not a summary, just a single concrete image that lingers.
   - Do NOT use phrases like "the universe," "your story," "your journey," "chapter."

2. "achievements": A single paragraph (200–400 characters) of what this person actually accomplished — not aspirational, not kind. Brutally honest. Did they get what they wanted? Did they get something else instead? Did they waste it? Reference specific things from the life — the city, the relationships, the choices. This is an obituary written by someone who doesn't owe the dead anything.

3. "stat_arc": For each of the 7 stats, a SHORT phrase (2-4 words max) describing the trajectory across the whole life. Examples: "rose steadily", "collapsed early", "always volatile", "peaked then fell", "never recovered", "slow steady climb", "rock bottom". Base this on the stat trajectories provided above.

4. "verdict": One sentence. Not a moral. A factual, devastating observation about the gap between what they wanted and what they got. Example: "You wanted to be a famous musician; you died a landlord in Reno with a guitar you hadn't touched in twenty years." Reference their specific desire ("${desire}") and their actual outcome based on final stats and life history. If they actually achieved it, acknowledge it — but note what it cost.

Output must be valid JSON matching the schema exactly.
`.trim();

    const user = JSON.stringify({
      nonce: runNonce(),
      age,
      gender,
      city,
      desire,
      cause,
      stats,
      relationships,
      history,
    });

    const result = await withRetry(async () => {
      const r = await client.responses.create({
        model: "gpt-4.1",
        input: [
          { role: "system", content: sys },
          { role: "user", content: user },
        ],
        max_output_tokens: 900,
        text: {
          format: {
            type: "json_schema",
            name: EpilogueJSONSchema.name,
            strict: true,
            schema: EpilogueJSONSchema.schema,
          },
        },
      });
      const raw = r.output_text;
      if (!raw) throw new Error("OpenAI returned empty output_text");
      try {
        return JSON.parse(raw);
      } catch {
        throw new Error("Epilogue output not parseable JSON");
      }
    });

    // Return structured epilogue
    const epilogueResult = {
      text: String(result.text || `You die at ${age}. Cause: ${cause}.`),
      achievements: String(result.achievements || ""),
      stat_arc: result.stat_arc || {},
      verdict: String(result.verdict || ""),
    };

    // Persist verdict + achievements to the run record
    const run_id = String(req.body?.run_id || "");
    if (run_id) {
      analytics.logDeath({
        run_id,
        age,
        cause,
        final_stats: stats,
        verdict: epilogueResult.verdict,
        achievements: epilogueResult.achievements,
      });
    }

    res.json(epilogueResult);
  } catch (err) {
    console.error("EPILOGUE FAILED:", err);
    res.status(500).json({
      error: "epilogue_failed",
      message: err?.message || String(err),
    });
  }
});

// Initialize analytics DB then start server
analytics.initAnalytics().then((dbOk) => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Phase 1: volatile lives, rare natural death, parent mortality, stat-driven stories`);
    console.log(`Phase 2: enhanced epilogue (achievements, stat arc, verdict)`);
    console.log(`Analytics: ${dbOk ? "PostgreSQL connected — persistent" : "in-memory only (set DATABASE_URL for persistence)"}`);
    console.log(`Dashboard: http://localhost:${PORT}/dashboard`);
  });
});
