// server.mjs — Phase 3: CLOSE CALLS
// Life Sim Backend (Express + OpenAI Structured Outputs)
//
// Phase 1 upgrades:
// ✅ Dramatically more volatile lives — bigger stat swings, wilder stories
// ✅ Parent deaths modeled: linear increasing probability between player age 4–40
// ✅ Stats deeply connected to narrative — AI references stat levels in prose
// ✅ Effect ranges widened: -0.40 to +0.40 for bold choices
// ✅ All Phase 0 features preserved (sessions, retry, analytics, prefetch)
//
// Phase 2 upgrades:
// ✅ Enhanced epilogue: structured output with achievements, stat arc, verdict
// ✅ Accepts stat_history for richer retrospective analysis
// ✅ Desire callback in epilogue — the gap between wanting and getting
//
// Phase 3 upgrades:
// ✅ CLOSE CALL SYSTEM — near-death experiences replace instant death
// ✅ No death before age 17 (hard floor)
// ✅ Close calls accumulate: 0=immune, 1=25% lethal, 2=60%, 3+=90%
// ✅ Each close call hits stats hard (health -0.20, stress +0.25)
// ✅ AI writes close call aftermath into the next turn's narrative
// ✅ Natural death (90+) bypasses close call shield progressively
// ✅ Age 111: guaranteed death (hard cap)
// ✅ Frontend receives close_call + close_call_count for UI feedback

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
app.set("trust proxy", 1);
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
  // Tight jumps = more decisions = more dream progress
  if (currentAge < 1) return randomInt(3, 5);       // birth → early childhood
  if (currentAge < 14) return randomInt(3, 6);       // childhood — move fast
  if (currentAge < 25) return randomInt(2, 5);       // teen/young adult — TIGHTEST, peak dream-chasing
  if (currentAge < 40) return randomInt(3, 7);       // prime years — still tight
  if (currentAge < 60) return randomInt(4, 8);       // middle age
  if (currentAge < 80) return randomInt(5, 10);      // senior
  return randomInt(6, 12);                            // elderly
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
 * Build narrative context about close calls for the AI
 */
function buildCloseCallContext(closeCallCount, justHadCloseCall) {
  if (closeCallCount === 0 && !justHadCloseCall) return "";

  const lines = [];
  lines.push("═══════════════════════════════════════════════════");
  lines.push("CLOSE CALLS — NEAR-DEATH EXPERIENCES");
  lines.push("═══════════════════════════════════════════════════");

  if (justHadCloseCall) {
    lines.push("");
    lines.push("⚠️  THE PLAYER JUST HAD A CLOSE CALL — A NEAR-DEATH EXPERIENCE.");
    lines.push("This MUST be the opening of the scenario. They almost died. Describe the aftermath:");
    lines.push("- What happened? A car swerving, a knife missing by inches, a collapsed lung, an overdose they barely survived, a fall they somehow walked away from.");
    lines.push("- How did they survive? Someone found them, they woke up in a hospital, they crawled out, dumb luck.");
    lines.push("- What does it FEEL like? The terror, the numbness, the strange euphoria of still being alive.");
    lines.push("- Reference the physical toll: scars, shaking hands, a limp, nightmares, a new prescription.");
    lines.push("- This is a PIVOTAL MOMENT. The choices should reflect the fork: do they change, or do they keep going?");
  }

  if (closeCallCount >= 1) {
    lines.push("");
    lines.push(`CLOSE CALL COUNT: ${closeCallCount}`);
    if (closeCallCount === 1) {
      lines.push("They've brushed with death once. There's a scar — physical or psychological. They know they're not invincible anymore. The world feels slightly more fragile. Reference this awareness in the prose.");
    } else if (closeCallCount === 2) {
      lines.push("They've cheated death TWICE. People around them are worried — or have given up worrying. There's a recklessness OR a paranoia that comes with surviving what should have killed you. They carry it in their body. Friends have started using past tense about them. Reference this weight.");
    } else {
      lines.push(`They've had ${closeCallCount} close calls. They are LIVING ON BORROWED TIME and everyone knows it. They're either fearless or falling apart. Their body is a map of near-misses. People either marvel at them or can't stand to watch anymore. This should permeate everything.`);
    }
  }

  return lines.join("\n");
}

/**
 * Parent death check — should a parent die this turn?
 * Linear probability increase from age 4 to age 40.
 * At age 4: ~3% chance per turn. At age 40: ~60% chance per turn.
 * Random and organic — sometimes early, sometimes late.
 */
function shouldParentDie(playerAge) {
  if (playerAge < 4 || playerAge > 40) return false;
  // Linear ramp: 0.03 at age 4, up to 0.83 at age 40
  const t = (playerAge - 4) / (40 - 17); // 0..1
  const probability = 0.03 + t * 0.8;   // 0.03..0.60
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
 * ══════════════════════════════════════════════════════════
 * MORTALITY SYSTEM — "CLOSE CALLS"
 * ══════════════════════════════════════════════════════════
 *
 * Philosophy: Players should feel FREE to take risks. Death
 * shouldn't be a random gotcha — it should be EARNED through
 * sustained reckless living. The system works like arcade lives:
 *
 * 1. UNDER 17: Totally immune. Kids don't die in this game.
 *
 * 2. 17+: When a "death check" triggers, instead of dying,
 *    you get a CLOSE CALL — a near-death experience. You survive
 *    but take harsh penalties (health tanks, stress spikes).
 *
 * 3. CLOSE CALLS STACK — each one makes the next more dangerous:
 *    - 0 close calls: always survives (100% shield)
 *    - 1 close call:  75% shield, 25% real death
 *    - 2 close calls: 40% shield, 60% real death
 *    - 3+ close calls: 10% shield, 90% real death
 *
 * 4. AGE 90+: Natural death bypasses close call shield entirely.
 *    Old age can kill you regardless of close call count.
 *
 * 5. AGE 111: Guaranteed death. Hard cap.
 *
 * This means a young player with 0 close calls can max out
 * exposure, tank health, live on the edge — and they'll get
 * dramatic close calls but WON'T die. The tension builds as
 * close calls accumulate. By the 3rd close call, every risky
 * move could be their last.
 */

// How likely is a "death event" to trigger? (not actual death — just the check)
function computeDeathCheckChance(age, stats) {
  const a = Math.max(0, Math.min(111, Number(age) || 0));
  const s = normalizeStats(stats);

  // Hard cap
  if (a >= 111) return 1.0;

  // Under 17: no death checks at all
  if (a < 17) return 0;

  // ---- RISK-BASED TRIGGER ----
  // Only really fires when stats are EXTREME. Moderate-high is fine.
  // Need MULTIPLE extreme stats to be in real danger — no single stat kills you.
  const exposureDanger = Math.pow(s.exposure, 3) * 0.20;        // cube — gentle until 0.8+
  const healthCrisis = Math.pow(1 - s.health, 3) * 0.10;        // softened — low health alone won't kill
  const stressCrack = Math.pow(s.stress, 3) * 0.06;             // minor contributor
  const riskTrigger = exposureDanger + healthCrisis + stressCrack; // max theoretical ~0.36

  // ---- AGE-BASED NATURAL TRIGGER (gentle, only bites past 80+) ----
  let naturalTrigger = 0;
  if (a < 50) {
    naturalTrigger = 0.001;
  } else if (a < 70) {
    naturalTrigger = 0.005 + ((a - 50) / 20) * 0.02;
  } else if (a < 85) {
    naturalTrigger = 0.025 + ((a - 70) / 15) * 0.075;
  } else if (a < 95) {
    naturalTrigger = 0.10 + ((a - 85) / 10) * 0.25;
  } else if (a < 105) {
    naturalTrigger = 0.35 + ((a - 95) / 10) * 0.35;
  } else {
    naturalTrigger = 0.70 + ((a - 105) / 6) * 0.25;
  }

  // Buffers from stability/freedom
  const stabilityBuffer = Math.max(0, (s.stability - 0.5) * 0.05);
  const combined = Math.max(naturalTrigger, riskTrigger) + Math.min(naturalTrigger, riskTrigger) * 0.2;
  return Math.max(0, Math.min(0.95, combined - stabilityBuffer));
}

// Given a death check triggered, does the close call shield save you?
function resolveDeathCheck(age, closeCallCount, isNaturalAge) {
  // Age 111+: guaranteed death
  if (age >= 111) return { died: true, closeCall: false };

  // Natural death (age 90+) bypasses close call shield
  // The older you are, the less the shield helps
  if (isNaturalAge && age >= 90) {
    // At 90 the shield still partially works; by 105 it's basically gone
    const ageBypass = Math.min(1.0, (age - 90) / 20); // 0 at 90, 1.0 at 110
    if (Math.random() < ageBypass) {
      return { died: true, closeCall: false };
    }
  }

  // Close call shield based on count
  const shieldChance = [
    1.00,  // 0 close calls — always survives
    0.85,  // 1 close call  — 85% chance of another close call
    0.55,  // 2 close calls — 55% chance
    0.20,  // 3+ close calls — 20% chance (very dangerous)
  ];
  const shield = shieldChance[Math.min(closeCallCount, 3)];

  if (Math.random() < shield) {
    // Survived — this becomes a close call
    return { died: false, closeCall: true };
  } else {
    // Shield failed — actual death
    return { died: true, closeCall: false };
  }
}

// Close call stat penalties — surviving has a cost, but shouldn't doom you
function closeCallPenalties() {
  return {
    health: -0.10,    // bruised, not broken
    stress: +0.20,    // shaken up
    exposure: -0.15,  // you pull back from danger
    stability: -0.05, // life rattled
  };
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
      location: { type: "string" },
      options: { type: "array", minItems: 2, maxItems: 2, items: OPTION_SCHEMA },
      relationship_changes: REL_CHANGE_SCHEMA,
      death_cause_hint: { type: "string" },
    },
    required: ["text", "location", "options", "relationship_changes", "death_cause_hint"],
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
      location: { type: "string" },
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
    required: ["text", "location", "options", "relationships", "birth_stats", "death_cause_hint"],
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
function systemPrompt(statContext, closeCallContext) {
  return `
You write turns for a life simulator where the player is chasing a dream. Every turn is a decision on the road to what they want to become. This is not a biography — it's a chase.

VOICE:
- Second person, present tense. Short sentences. Punchy.
- Write like someone telling a story at a bar, not narrating a novel.
- No flowery language. No "the weight of the world settles upon your shoulders." Just say what happens.
- Specific details only. Names, places, objects, amounts. "You owe Rina 4,000" not "you're in financial trouble."
- Max 500 characters. Tighter is better. Every word earns its place.

${closeCallContext || ""}

THE DREAM IS EVERYTHING:
The player's desire is the ENTIRE POINT of the game. Read it carefully. EVERY turn MUST directly involve pursuing it.

HARD RULE: If the player wants to be "a famous musician" — every turn involves music. Gigs, studios, labels, tours, rivalries, creative blocks, fans, breakdowns on stage. NOT a fish shop. NOT a random office job. NOT generic life events that could happen to anyone. The dream is the PLOT.

How the dream drives turns:
- Opportunity: someone offers a shortcut toward the dream, but it costs something (money, loyalty, safety, health)
- Threat: something could destroy their progress — a rival, a scandal, an injury, losing a key ally
- Breakthrough: they're THIS close — one more step, one more sacrifice, one more risk
- Setback: they got knocked back. Now what? Give up a piece of the dream or double down?
- The dream should feel CLOSE sometimes and IMPOSSIBLE other times
- Even setbacks connect to the dream: "You're broke" → "You can't afford the studio time"

NEVER generate a turn that doesn't reference the player's specific dream. A turn about a fish shop when they want to be a musician is a FAILURE. Every scenario, every choice, every new character exists because of the dream.

${statContext}

STAT-STORY RULES:
- Low money = can't fund the dream. Concretely: can't book the studio, can't fly to the meeting, can't pay the deposit.
- Low health = body failing at the worst time. Missing the audition, collapsing during the performance.
- High stress = sabotaging your own dream. Blowing up at the person who was going to help you.
- High exposure = the dream attracted dangerous attention. Shady deals, stalkers, legal trouble.
- Low freedom = someone else controls your path. A bad contract, a controlling partner, debt to the wrong person.
- Low stability = no base to build from. Can't focus on the dream when you don't know where you're sleeping.
- High status = the dream is WORKING. But fame brings new problems.
- Moderate everything = BORING. Someone appears with an offer that could change everything.

PEOPLE — FAST TURNOVER:
- 3 slots. Whoever matters for the dream RIGHT NOW.
- Swap every 1-2 turns after age 14. People cycle fast when you're chasing something.
- New arrivals MUST connect to the dream: a manager, a rival, a collaborator, a patron, a lover who believes in you, someone offering a dangerous shortcut.
- Family exits slots by age 18-22 unless they're directly blocking or funding the dream.
- Specific roles tied to the dream: "booking agent," "label scout," "competing applicant," "the drummer who keeps flaking."
- People leaving get a line in prose. Don't just vanish them.

TRAVEL & MOVEMENT:
- Dream-chasers MOVE. New cities for opportunity, tours, relocations, running from trouble.
- Change location when the dream demands it: the industry is in LA, the opportunity is in London, the contact is in Tokyo.
- Location = real place. "Brooklyn" not "your apartment."
- New city = no connections, fresh start or fresh disaster.

CHOICES — RISK MUST BE REWARDING:
- 2 options. Short labels (under 55 chars). Start with a verb.
- THE RISKY OPTION MUST HAVE A HUGE UPSIDE. Risk without reward is not a real choice.
  Example: "Take the shady record deal" = money +0.30, status +0.20, BUT exposure +0.30, freedom -0.25
  Example: "Perform despite the injury" = status +0.25, BUT health -0.20, stress +0.15
  The player should WANT to take the risk. Make the reward genuinely tempting.
- THE SAFE OPTION should protect something but slow the dream or close a door.
  It should still move stats, just less dramatically. ±0.05 to ±0.15.
- NEVER make both options punishing. One should feel like it could pay off big.
- NEVER make both options safe. At least one should be a genuine gamble.
- Bold choices: dream-relevant stats swing +0.15 to +0.35 positive, with costs on other stats.
- Every choice moves at least 3 stats.

LOCATION:
- Output a "location" field: city/place where this turn happens.
- Start with birth city, but MOVE them when the dream demands it.

DEATH_CAUSE_HINT:
- Short, specific. "Overdose in a tour bus," "stabbed at the after-party," "heart attack mid-set."

Output valid JSON matching the schema.
`.trim();
}

function birthInstruction() {
  return `
BIRTH TURN (Age 0). Player entered: city, gender, what they want to become.

Rules:
- READ THE DESIRE CAREFULLY. It is the entire plot of this game. If they want to be "a famous musician" then music must appear in every turn for the rest of their life. If they want to be "rich" then money and deals drive every turn.
- The desire shapes the starting context. A kid born wanting to be a rapper in Detroit ≠ a kid wanting to be a doctor in Mumbai. Infer the world they'll grow up in.
- 3 relationships at birth: family. One trait each hinting at how they connect to the dream (supportive, obstructive, indifferent, inspiring).
- Birth stats: BOLD. Rough start = 0.15 money. Privileged = 0.80+. Don't default to 0.5.
- Prose: where you are, who's there, the first hint of the dream. Under 400 characters.
- First choice should already point toward the dream.
- Location: the birth city.
- Format: "Name (role)" for every person.
`.trim();
}


// ----------------------
// OpenAI wrapper (with retry)
// ----------------------
async function generateTurn({ isBirth, payload }) {
  const schema = isBirth ? BirthJSONSchema : TurnJSONSchema;
  const statContext = isBirth ? "Birth turn — stats not yet established." : buildStatContext(payload.stats);
  const closeCallContext = isBirth ? "" : buildCloseCallContext(
    payload.close_calls || 0,
    payload.just_had_close_call || false
  );

  // Inject the dream directly so the AI can't miss it
  const dreamReminder = payload.desire
    ? `\n⚡ THE PLAYER'S DREAM: "${payload.desire}" — this turn MUST involve this. Every choice, every character, every event connects to "${payload.desire}". Do NOT generate unrelated life events.\n`
    : "";

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
        { role: "system", content: systemPrompt(statContext, closeCallContext) + dreamReminder + parentDeathDirective },
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
    close_calls: session.close_calls || 0,
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

// Leaderboard data (public)
app.get("/api/leaderboard", async (_, res) => {
  try {
    const data = await analytics.getLeaderboard();
    if (!data) return res.json({ db_connected: false });
    return res.json({ db_connected: true, ...data });
  } catch (err) {
    return res.status(500).json({ error: "leaderboard_failed", message: err?.message });
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
          // Preserve close_calls from existing session
          const prevSession = getSession(session_id, run_id);
          const prevCloseCalls = prevSession?.close_calls || 0;

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
            close_calls: prevCloseCalls,
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

    // Get close call state from session
    let closeCallCount = 0;
    let justHadCloseCall = false;
    if (!isBirth && session_id && run_id) {
      const existingSession = getSession(session_id, run_id);
      if (existingSession) {
        closeCallCount = existingSession.close_calls || 0;
        justHadCloseCall = existingSession.just_had_close_call || false;
        // Clear the "just had" flag after reading it
        if (justHadCloseCall) {
          existingSession.just_had_close_call = false;
          setSession(session_id, run_id, existingSession);
        }
      }
    }

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
      close_calls: closeCallCount,
      just_had_close_call: justHadCloseCall,
    };

    // Add parent death directive to payload if applicable
    if (parentDeathIndex >= 0) {
      payload.parent_death_index = parentDeathIndex;
    }

    const out = await generateTurn({ isBirth, payload });

    const scenario = {
      text: String(out.text || ""),
      location: String(out.location || payload.city || ""),
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
      close_calls: closeCallCount,
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
          location: String(outA.location || payload.city || ""),
          options: [
            { label: String(outA.options?.[0]?.label || "A"), effects: normalizeEffects(outA.options?.[0]?.effects) },
            { label: String(outA.options?.[1]?.label || "B"), effects: normalizeEffects(outA.options?.[1]?.effects) },
          ],
          relationship_changes: outA.relationship_changes || { replace_index: null, new_person: null },
          death_cause_hint: String(outA.death_cause_hint || ""),
        };

        const scB = {
          text: String(outB.text || ""),
          location: String(outB.location || payload.city || ""),
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
      close_calls: closeCallCount,
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

    let next_stats = applyEffects(stats, effects);

    // Get close call count from session
    let closeCallCount = 0;
    let session = null;
    if (session_id && run_id) {
      session = getSession(session_id, run_id);
      if (session) {
        closeCallCount = session.close_calls || 0;
      }
    }

    // Run the death check
    const pDeathCheck = computeDeathCheckChance(age, next_stats);
    const deathCheckTriggered = Math.random() < pDeathCheck;

    let died = false;
    let closeCall = false;

    if (deathCheckTriggered) {
      // Is this primarily age-based? (affects whether shield applies)
      const isNaturalAge = age >= 90;
      const result = resolveDeathCheck(age, closeCallCount, isNaturalAge);
      died = result.died;
      closeCall = result.closeCall;

      if (closeCall) {
        // Apply close call penalties on top of the choice effects
        const penalties = closeCallPenalties();
        for (const k of STAT_KEYS) {
          if (penalties[k]) {
            next_stats[k] = clamp01(next_stats[k] + penalties[k]);
          }
        }
        // Health floor — close calls shouldn't doom you to 0 health
        if (next_stats.health < 0.10) next_stats.health = 0.10;
        closeCallCount++;
      }
    }

    // Age 111 hard cap
    if (age >= 111) died = true;

    // Update session
    if (session) {
      session.stats = next_stats;
      session.close_calls = closeCallCount;
      if (closeCall) session.just_had_close_call = true;
      if (died) session.died = true;
      setSession(session_id, run_id, session);
    }

    // Log events
    if (died) {
      logEvent({
        type: "death",
        session_id,
        run_id,
        data: { age, close_calls: closeCallCount, death_check_chance: pDeathCheck },
      });

      analytics.logDeath({
        run_id,
        age,
        cause: req.body?.death_cause_hint || "unknown",
        final_stats: next_stats,
      });
    }

    if (closeCall) {
      logEvent({
        type: "close_call",
        session_id,
        run_id,
        data: { age, close_call_number: closeCallCount, death_check_chance: pDeathCheck },
      });
    }

    return res.json({
      next_stats,
      died,
      close_call: closeCall,
      close_call_count: closeCallCount,
      death_check_chance: pDeathCheck,
    });
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
