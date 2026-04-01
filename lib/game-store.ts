import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Stats, Relationship, TurnData, Epilogue, MoodType, GameState as GameStateType } from "./types";
import { API_URL } from "./constants";

// ═══════════════════════════════════════════════
// INITIAL STATS
// ═══════════════════════════════════════════════

const INITIAL_STATS: Stats = {
  money: 50,
  stability: 50,
  status: 50,
  health: 50,
  stress: 50,
  freedom: 50,
  exposure: 50,
};

// ═══════════════════════════════════════════════
// STORE INTERFACE
// ═══════════════════════════════════════════════

interface GameStore {
  // Game state
  gameState: GameStateType;
  sessionId: string | null;
  runId: string | null;

  // Player config
  gender: "male" | "female" | null;
  city: string;
  dream: string;

  // Game data
  age: number;
  stats: Stats;
  previousStats: Stats | null;
  relationships: Relationship[];
  closeCalls: number;
  closeCallMessage: string | null;

  // Current turn
  currentTurn: TurnData | null;
  isLoading: boolean;
  error: string | null;

  // Death/epilogue
  epilogue: Epilogue | null;

  // UI state
  mood: MoodType;
  crtEnabled: boolean;

  // Actions
  startGame: (gender: "male" | "female", city: string, dream: string) => Promise<void>;
  makeChoice: (choiceIndex: number) => Promise<void>;
  resetGame: () => void;
  clearCloseCallMessage: () => void;
  toggleCRT: () => void;
  setMood: (mood: MoodType) => void;
}

// ═══════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════

function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

// ═══════════════════════════════════════════════
// GAME STORE
// ═══════════════════════════════════════════════

export const useGameStore = create<GameStore>()(
  persist(
    (set, get) => ({
      // Initial state
      gameState: "onboarding",
      sessionId: null,
      runId: null,
      gender: null,
      city: "",
      dream: "",
      age: 0,
      stats: { ...INITIAL_STATS },
      previousStats: null,
      relationships: [],
      closeCalls: 0,
      closeCallMessage: null,
      currentTurn: null,
      isLoading: false,
      error: null,
      epilogue: null,
      mood: "neutral",
      crtEnabled: true,

      // ─────────────────────────────────────────
      // START GAME
      // ─────────────────────────────────────────
      startGame: async (gender, city, dream) => {
        const sessionId = generateId();
        const runId = generateId();

        set({
          gameState: "loading",
          sessionId,
          runId,
          gender,
          city,
          dream,
          age: 0,
          stats: { ...INITIAL_STATS },
          previousStats: null,
          relationships: [],
          closeCalls: 0,
          closeCallMessage: null,
          currentTurn: null,
          isLoading: true,
          error: null,
          epilogue: null,
          mood: "neutral",
        });

        try {
          // Start a new game session with the backend
          const response = await fetch(`${API_URL}/api/start`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              gender,
              city,
              desire: dream,
              session_id: sessionId,
              run_id: runId,
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to start game");
          }

          const data = await response.json();

          // Get first turn
          await get().fetchNextTurn(data);
        } catch (error) {
          console.error("Start game error:", error);
          set({
            gameState: "onboarding",
            isLoading: false,
            error: "Failed to start game. Please try again.",
          });
        }
      },

      // ─────────────────────────────────────────
      // FETCH NEXT TURN (internal)
      // ─────────────────────────────────────────
      fetchNextTurn: async (startData?: { age?: number; stats?: Stats; relationships?: Relationship[] }) => {
        const state = get();

        set({ isLoading: true, error: null });

        try {
          const response = await fetch(`${API_URL}/api/turn`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              state: {
                gender: state.gender,
                city: state.city,
                desire: state.dream,
                location: state.city,
                age: startData?.age ?? state.age,
                stats: startData?.stats ?? state.stats,
                relationships: startData?.relationships ?? state.relationships,
                session_id: state.sessionId,
                run_id: state.runId,
              },
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to get next turn");
          }

          const data = await response.json();

          // Parse turn data
          const turnData: TurnData = {
            narrative: data.scenario?.text || data.text || "Something happened...",
            choices: data.scenario?.options?.map((o: { label: string }) => o.label) || data.options?.map((o: { label: string }) => o.label) || [],
            location: data.scenario?.location || data.location || state.city,
            rawOptions: data.scenario?.options || data.options || [],
          };

          // Update age if provided
          const newAge = data.age_to ?? data.age ?? state.age;

          // Update relationships if provided
          const newRelationships = data.relationships ?? state.relationships;

          // Update stats if birth stats provided
          const newStats = data.birth_stats
            ? { ...state.stats, ...normalizeStats(data.birth_stats) }
            : state.stats;

          set({
            gameState: "playing",
            age: newAge,
            stats: newStats,
            relationships: newRelationships,
            currentTurn: turnData,
            isLoading: false,
          });
        } catch (error) {
          console.error("Fetch turn error:", error);
          set({
            isLoading: false,
            error: "Connection error. Please try again.",
          });
        }
      },

      // ─────────────────────────────────────────
      // MAKE CHOICE
      // ─────────────────────────────────────────
      makeChoice: async (choiceIndex) => {
        const state = get();
        if (state.isLoading || !state.currentTurn) return;

        const option = state.currentTurn.rawOptions?.[choiceIndex];
        if (!option) return;

        set({
          isLoading: true,
          error: null,
          previousStats: { ...state.stats },
        });

        try {
          // Apply choice effects
          const response = await fetch(`${API_URL}/api/apply`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              age: state.age,
              stats: state.stats,
              effects: option.effects || {},
              session_id: state.sessionId,
              run_id: state.runId,
              death_cause_hint: "",
            }),
          });

          if (!response.ok) {
            throw new Error("Failed to apply choice");
          }

          const data = await response.json();

          // Update stats
          const newStats = data.next_stats
            ? normalizeStats(data.next_stats)
            : state.stats;

          // Check for death
          if (data.died) {
            set({ stats: newStats, mood: "danger" });
            await get().handleDeath(data.death_cause || "unknown causes");
            return;
          }

          // Check for close call
          if (data.close_call) {
            set({
              stats: newStats,
              closeCalls: data.close_call_count || state.closeCalls + 1,
              closeCallMessage: data.close_call_message || "You narrowly escaped death!",
              mood: "danger",
            });
          } else {
            // Determine mood based on stat changes
            const statDiff = Object.keys(newStats).reduce((acc, key) => {
              const k = key as keyof Stats;
              return acc + (newStats[k] - state.stats[k]);
            }, 0);

            set({
              stats: newStats,
              mood: statDiff > 10 ? "success" : statDiff < -10 ? "sad" : "neutral",
            });
          }

          // Fetch next turn
          await get().fetchNextTurn();
        } catch (error) {
          console.error("Make choice error:", error);
          set({
            isLoading: false,
            error: "Connection error. Please try again.",
          });
        }
      },

      // ─────────────────────────────────────────
      // HANDLE DEATH (internal)
      // ─────────────────────────────────────────
      handleDeath: async (cause: string) => {
        const state = get();

        set({ gameState: "loading", isLoading: true });

        try {
          const response = await fetch(`${API_URL}/api/epilogue`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              age: state.age,
              gender: state.gender,
              city: state.city,
              desire: state.dream,
              stats: state.stats,
              relationships: state.relationships,
              history: [],
              cause,
            }),
          });

          let epilogueData: Epilogue;

          if (response.ok) {
            const data = await response.json();
            epilogueData = {
              death_cause: cause,
              achievements: data.achievements || [],
              stat_arcs: data.stat_arcs || {},
              verdict: data.verdict || data.text || `Lived ${state.age} years.`,
            };
          } else {
            epilogueData = {
              death_cause: cause,
              achievements: [],
              stat_arcs: {},
              verdict: `Lived ${state.age} years. Rest in peace.`,
            };
          }

          set({
            gameState: "dead",
            epilogue: epilogueData,
            isLoading: false,
          });
        } catch (error) {
          console.error("Epilogue error:", error);
          set({
            gameState: "dead",
            epilogue: {
              death_cause: cause,
              achievements: [],
              stat_arcs: {},
              verdict: `Lived ${state.age} years. Rest in peace.`,
            },
            isLoading: false,
          });
        }
      },

      // ─────────────────────────────────────────
      // RESET GAME
      // ─────────────────────────────────────────
      resetGame: () => {
        set({
          gameState: "onboarding",
          sessionId: null,
          runId: null,
          gender: null,
          city: "",
          dream: "",
          age: 0,
          stats: { ...INITIAL_STATS },
          previousStats: null,
          relationships: [],
          closeCalls: 0,
          closeCallMessage: null,
          currentTurn: null,
          isLoading: false,
          error: null,
          epilogue: null,
          mood: "neutral",
        });
      },

      // ─────────────────────────────────────────
      // UI ACTIONS
      // ─────────────────────────────────────────
      clearCloseCallMessage: () => set({ closeCallMessage: null }),
      toggleCRT: () => set((s) => ({ crtEnabled: !s.crtEnabled })),
      setMood: (mood) => set({ mood }),
    }),
    {
      name: "dreamland-game-v2",
      partialize: (state) => ({
        crtEnabled: state.crtEnabled,
      }),
    }
  )
);

// ═══════════════════════════════════════════════
// HELPER: Normalize stats (handle 0-1 or 0-100)
// ═══════════════════════════════════════════════

function normalizeStats(stats: Partial<Stats>): Stats {
  const normalized: Stats = { ...INITIAL_STATS };

  for (const key of Object.keys(stats) as (keyof Stats)[]) {
    const value = stats[key];
    if (typeof value === "number") {
      // If value is between 0 and 1, scale to 0-100
      normalized[key] = value <= 1 ? value * 100 : value;
    }
  }

  return normalized;
}

// Add internal methods to the store type
declare module "zustand" {
  interface StoreMutatorIdentifier {
    "dreamland-game-v2": never;
  }
}

// Extend the store interface for internal methods
interface GameStoreInternal extends GameStore {
  fetchNextTurn: (startData?: { age?: number; stats?: Stats; relationships?: Relationship[] }) => Promise<void>;
  handleDeath: (cause: string) => Promise<void>;
}

// Type assertion for internal use
export const useGameStoreInternal = useGameStore as unknown as () => GameStoreInternal;
