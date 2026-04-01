import { create } from "zustand";
import { persist } from "zustand/middleware";
import { generateId } from "./utils";
import { INITIAL_STATS } from "./constants";
import { apiTurn, apiApply, apiEpilogue, logAnalytics } from "./api";
import type {
  Stats,
  Relationship,
  Scenario,
  StatSnapshot,
  GameConfig,
  GamePhase,
} from "./types";

interface GameState {
  // Player configuration
  gender: "male" | "female";
  city: string;
  desire: string;

  // Game state
  age: number;
  stats: Stats;
  relationships: Relationship[];
  history: string[];
  statHistory: StatSnapshot[];
  location: string;

  // Session tracking
  sessionId: string;
  runId: string;

  // UI state
  phase: GamePhase;
  currentScenario: Scenario | null;
  isLoading: boolean;
  error: string | null;
  showStats: boolean;
  closeCallCount: number;
  showCloseCall: boolean;
  deathCause: string;
  epilogueText: string;

  // Audio state
  isMuted: boolean;
  volume: number;

  // Actions
  startGame: (config: GameConfig) => Promise<void>;
  makeChoice: (index: number) => Promise<void>;
  resetGame: () => void;
  setShowStats: (show: boolean) => void;
  setMuted: (muted: boolean) => void;
  setVolume: (volume: number) => void;
  clearError: () => void;
  retryLastAction: () => void;
}

// Store last failed action for retry
let lastFailedAction: (() => Promise<void>) | null = null;

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      // Initial state
      gender: "female",
      city: "",
      desire: "",
      age: 0,
      stats: { ...INITIAL_STATS },
      relationships: [],
      history: [],
      statHistory: [],
      location: "",
      sessionId: "",
      runId: "",
      phase: "onboarding",
      currentScenario: null,
      isLoading: false,
      error: null,
      showStats: false,
      closeCallCount: 0,
      showCloseCall: false,
      deathCause: "",
      epilogueText: "",
      isMuted: false,
      volume: 0.5,

      startGame: async (config: GameConfig) => {
        const runId = generateId();
        const sessionId = generateId();

        set({
          gender: config.gender,
          city: config.city || "New York",
          desire: config.desire || "a happy life",
          location: config.city || "New York",
          age: 0,
          stats: { ...INITIAL_STATS },
          relationships: [],
          history: [],
          statHistory: [],
          runId,
          sessionId,
          phase: "playing",
          currentScenario: null,
          isLoading: true,
          error: null,
          closeCallCount: 0,
          showCloseCall: false,
          deathCause: "",
          epilogueText: "",
        });

        logAnalytics({
          type: "game_start",
          session_id: sessionId,
          run_id: runId,
          data: { gender: config.gender, city: config.city, desire: config.desire },
        });

        await get().doTurn();
      },

      doTurn: async () => {
        const state = get();
        set({ isLoading: true, error: null });

        try {
          const turnData = await apiTurn({
            state: {
              gender: state.gender,
              city: state.city,
              desire: state.desire,
              location: state.location,
              age: state.age,
              stats: state.stats,
              relationships: state.relationships,
              history: state.history,
              session_id: state.sessionId,
              run_id: state.runId,
            },
          });

          if (turnData.error) {
            throw new Error(turnData.error);
          }

          const newAge = turnData.age_to ?? turnData.age ?? state.age;
          const newStats = turnData.birth_stats
            ? { ...state.stats, ...turnData.birth_stats }
            : state.stats;
          const newRelationships = turnData.relationships ?? state.relationships;

          // Record stat snapshot
          const snapshot: StatSnapshot = {
            age: newAge,
            ...newStats,
          };

          const scenario: Scenario = turnData.scenario ?? {
            text: turnData.text || "Something happened...",
            location: turnData.location || state.location,
            options: turnData.options || [],
          };

          set({
            age: newAge,
            stats: newStats,
            relationships: newRelationships,
            statHistory: [...state.statHistory, snapshot],
            location: scenario.location || state.location,
            currentScenario: scenario,
            isLoading: false,
          });
        } catch (error) {
          console.error("Turn error:", error);
          lastFailedAction = () => get().doTurn();
          set({
            isLoading: false,
            error: "Connection error. Please retry.",
          });
        }
      },

      makeChoice: async (index: number) => {
        const state = get();
        if (state.isLoading || !state.currentScenario?.options?.[index]) return;

        const option = state.currentScenario.options[index];
        set({ isLoading: true, error: null });

        // Record choice in history
        const newHistory = [...state.history, option.label];
        set({ history: newHistory });

        logAnalytics({
          type: "choice",
          session_id: state.sessionId,
          run_id: state.runId,
          data: { age: state.age, choice: option.label },
        });

        try {
          const applyData = await apiApply({
            age: state.age,
            stats: state.stats,
            effects: option.effects || {},
            session_id: state.sessionId,
            run_id: state.runId,
            death_cause_hint: state.currentScenario.death_cause_hint || "",
          });

          if (applyData.error) {
            throw new Error(applyData.error);
          }

          // Update stats
          const newStats = applyData.next_stats
            ? { ...state.stats, ...applyData.next_stats }
            : state.stats;
          set({ stats: newStats });

          // Check for death
          if (applyData.died) {
            // Record final snapshot
            const finalSnapshot: StatSnapshot = {
              age: state.age,
              ...newStats,
            };
            set({
              statHistory: [...get().statHistory, finalSnapshot],
            });

            logAnalytics({
              type: "death",
              session_id: state.sessionId,
              run_id: state.runId,
              data: { age: state.age, cause: applyData.death_cause || "unknown" },
            });

            await get().handleDeath(applyData.death_cause || "");
            return;
          }

          // Handle close call
          if (applyData.close_call) {
            logAnalytics({
              type: "close_call",
              session_id: state.sessionId,
              run_id: state.runId,
              data: { age: state.age, count: applyData.close_call_count },
            });
            set({
              closeCallCount: applyData.close_call_count || 0,
              showCloseCall: true,
            });
            // Hide after animation
            setTimeout(() => set({ showCloseCall: false }), 2200);
          }

          // Handle relationship changes
          if (state.currentScenario.relationship_changes) {
            const rc = state.currentScenario.relationship_changes;
            if (rc.replace_index !== null && rc.replace_index !== undefined) {
              const relationships = [...get().relationships];
              const i = Number(rc.replace_index);
              if (i >= 0 && i < relationships.length) {
                if (rc.new_person === null) {
                  const old = relationships[i];
                  relationships[i] = {
                    name: old.name,
                    role: `${old.role || ""}, deceased`,
                    display: `${old.name} (deceased)`,
                  };
                } else if (rc.new_person) {
                  relationships[i] = {
                    name: rc.new_person.name || "",
                    role: rc.new_person.role || "",
                    display: `${rc.new_person.name} (${rc.new_person.role})`,
                  };
                }
                set({ relationships });
              }
            }
          }

          set({ isLoading: false });

          // Next turn
          await get().doTurn();
        } catch (error) {
          console.error("Apply error:", error);
          lastFailedAction = () => get().makeChoice(index);
          set({
            isLoading: false,
            error: "Connection error. Please retry.",
          });
        }
      },

      handleDeath: async (cause: string) => {
        const state = get();
        set({
          phase: "dead",
          deathCause: cause,
          isLoading: true,
        });

        try {
          const epilogueData = await apiEpilogue({
            age: state.age,
            gender: state.gender,
            city: state.city,
            desire: state.desire,
            stats: state.stats,
            relationships: state.relationships,
            history: state.history.slice(-30),
            cause,
          });

          set({
            epilogueText: epilogueData.text || `You lived to age ${state.age}. Rest in peace.`,
            isLoading: false,
          });
        } catch (error) {
          console.error("Epilogue error:", error);
          set({
            epilogueText: `You lived to age ${state.age}. Rest in peace.`,
            isLoading: false,
          });
        }
      },

      resetGame: () => {
        lastFailedAction = null;
        set({
          gender: "female",
          city: "",
          desire: "",
          age: 0,
          stats: { ...INITIAL_STATS },
          relationships: [],
          history: [],
          statHistory: [],
          location: "",
          sessionId: "",
          runId: "",
          phase: "onboarding",
          currentScenario: null,
          isLoading: false,
          error: null,
          showStats: false,
          closeCallCount: 0,
          showCloseCall: false,
          deathCause: "",
          epilogueText: "",
        });
      },

      setShowStats: (show: boolean) => set({ showStats: show }),
      setMuted: (muted: boolean) => set({ isMuted: muted }),
      setVolume: (volume: number) => set({ volume }),
      clearError: () => set({ error: null }),

      retryLastAction: () => {
        if (lastFailedAction) {
          const action = lastFailedAction;
          lastFailedAction = null;
          action();
        }
      },
    }),
    {
      name: "dreamland-game",
      partialize: (state) => ({
        isMuted: state.isMuted,
        volume: state.volume,
      }),
    }
  )
);

// Extend the store with the doTurn and handleDeath methods
type GameStateWithMethods = GameState & {
  doTurn: () => Promise<void>;
  handleDeath: (cause: string) => Promise<void>;
};

// Augment the store type
declare module "zustand" {
  interface StoreApi<T> {
    getState: () => T & GameStateWithMethods;
  }
}
