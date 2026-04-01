// ═══════════════════════════════════════════════
// DREAMLAND TYPE DEFINITIONS
// ═══════════════════════════════════════════════

export interface Stats {
  money: number;
  stability: number;
  status: number;
  health: number;
  stress: number;
  freedom: number;
  exposure: number;
}

export interface Relationship {
  name: string;
  role: string;
  display?: string;
}

export interface RelationshipChange {
  replace_index: number | null;
  new_person: {
    name: string;
    role: string;
  } | null;
}

export interface ChoiceOption {
  label: string;
  effects: Partial<Stats>;
}

export interface Scenario {
  text: string;
  location: string;
  options: ChoiceOption[];
  relationship_changes?: RelationshipChange;
  death_cause_hint?: string;
}

export interface StatSnapshot {
  age: number;
  money: number;
  stability: number;
  status: number;
  health: number;
  stress: number;
  freedom: number;
  exposure: number;
}

export interface TurnResponse {
  age_to?: number;
  age?: number;
  birth_stats?: Partial<Stats>;
  relationships?: Relationship[];
  scenario?: Scenario;
  text?: string;
  location?: string;
  options?: ChoiceOption[];
  error?: string;
}

export interface ApplyResponse {
  next_stats?: Stats;
  died?: boolean;
  death_cause?: string;
  close_call?: boolean;
  close_call_count?: number;
  error?: string;
}

export interface EpilogueResponse {
  text?: string;
  error?: string;
}

export interface GameConfig {
  gender: "male" | "female";
  city: string;
  desire: string;
}

export type GamePhase = "onboarding" | "playing" | "dead";
