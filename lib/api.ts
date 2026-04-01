import { API_BASE } from "./constants";
import type {
  Stats,
  Relationship,
  TurnResponse,
  ApplyResponse,
  EpilogueResponse,
} from "./types";

interface TurnPayload {
  state: {
    gender: string;
    city: string;
    desire: string;
    location: string;
    age: number;
    stats: Stats;
    relationships: Relationship[];
    history: string[];
    session_id: string;
    run_id: string;
  };
}

interface ApplyPayload {
  age: number;
  stats: Stats;
  effects: Partial<Stats>;
  session_id: string;
  run_id: string;
  death_cause_hint: string;
}

interface EpiloguePayload {
  age: number;
  gender: string;
  city: string;
  desire: string;
  stats: Stats;
  relationships: Relationship[];
  history: string[];
  cause: string;
}

interface AnalyticsPayload {
  type: string;
  session_id: string;
  run_id: string;
  data: Record<string, unknown>;
}

export async function apiTurn(payload: TurnPayload): Promise<TurnResponse> {
  const response = await fetch(`${API_BASE}/api/turn`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.message || "turn_failed");
  }

  return data;
}

export async function apiApply(payload: ApplyPayload): Promise<ApplyResponse> {
  const response = await fetch(`${API_BASE}/api/apply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || "apply_failed");
  }

  return data;
}

export async function apiEpilogue(
  payload: EpiloguePayload
): Promise<EpilogueResponse> {
  const response = await fetch(`${API_BASE}/api/epilogue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || "epilogue_failed");
  }

  return data;
}

export function logAnalytics(payload: AnalyticsPayload): void {
  fetch(`${API_BASE}/api/analytics`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Silent fail for analytics
  });
}
