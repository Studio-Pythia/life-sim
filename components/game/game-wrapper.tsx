"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/lib/game-store";
import { useAudioStore } from "@/lib/audio";
import { TitleScreen } from "./title-screen";
import { OnboardingForm } from "./onboarding-form";
import { GameCanvas } from "./game-canvas";
import { GameHUD } from "./game-hud";
import { StatsPanel } from "./stats-panel";
import { RelationshipsPanel } from "./relationships-panel";
import { TurnDisplay } from "./turn-display";
import { DeathScreen } from "./death-screen";
import { CloseCallOverlay } from "./close-call-overlay";
import { CharacterDisplay } from "./character-display";
import { SceneAtmosphere } from "@/components/effects/scene-atmosphere";
import { cn } from "@/lib/utils";

type ScreenState = "title" | "onboarding" | "playing" | "dead" | "loading";

export function GameWrapper() {
  const router = useRouter();
  const gameState = useGameStore((state) => state.gameState);
  const age = useGameStore((state) => state.age);
  const gender = useGameStore((state) => state.gender);
  const location = useGameStore((state) => state.currentTurn?.location);
  const dream = useGameStore((state) => state.dream);
  const closeCallMessage = useGameStore((state) => state.closeCallMessage);
  const clearCloseCallMessage = useGameStore((state) => state.clearCloseCallMessage);
  const setGameState = useGameStore((state) => state.setGameState);

  const { initAudio, updateMusicForAge } = useAudioStore();

  const [screenState, setScreenState] = useState<ScreenState>("title");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showCloseCall, setShowCloseCall] = useState(false);
  const [prevAge, setPrevAge] = useState(age);

  // Sync screen state with game state
  useEffect(() => {
    if (gameState === "onboarding") {
      setScreenState("onboarding");
    } else if (gameState === "playing") {
      setScreenState("playing");
    } else if (gameState === "dead") {
      setScreenState("dead");
    } else if (gameState === "loading") {
      setScreenState("loading");
    }
  }, [gameState]);

  // Initialize audio on mount
  useEffect(() => {
    initAudio();
  }, [initAudio]);

  // Update music based on age
  useEffect(() => {
    if (screenState === "playing") {
      updateMusicForAge(age);
    }
  }, [age, screenState, updateMusicForAge]);

  // Handle close call messages
  useEffect(() => {
    if (closeCallMessage) {
      setShowCloseCall(true);
    }
  }, [closeCallMessage]);

  const handleCloseCallComplete = () => {
    setShowCloseCall(false);
    clearCloseCallMessage();
  };

  // Handle scene transitions on age change
  useEffect(() => {
    if (age !== prevAge && screenState === "playing") {
      setIsTransitioning(true);
      setTimeout(() => {
        setIsTransitioning(false);
        setPrevAge(age);
      }, 600);
    }
  }, [age, prevAge, screenState]);

  // Title screen handlers
  const handleStartGame = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setScreenState("onboarding");
      setGameState("onboarding");
      setIsTransitioning(false);
    }, 500);
  };

  const handleLeaderboard = () => {
    router.push("/leaderboard");
  };

  // Determine mood based on game state
  const getMood = (): "neutral" | "danger" | "success" | "sad" | "happy" => {
    if (screenState === "dead") return "sad";
    if (showCloseCall) return "danger";
    return "neutral";
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gb-darkest">
      {/* Global CRT scanlines */}
      <div className="fixed inset-0 pointer-events-none z-[100] crt-scanlines opacity-60" />

      {/* Close call overlay */}
      {showCloseCall && closeCallMessage && (
        <CloseCallOverlay message={closeCallMessage} onComplete={handleCloseCallComplete} />
      )}

      {/* Title Screen */}
      {screenState === "title" && (
        <TitleScreen onStart={handleStartGame} onLeaderboard={handleLeaderboard} />
      )}

      {/* Onboarding */}
      {screenState === "onboarding" && <OnboardingForm />}

      {/* Main Game */}
      {screenState === "playing" && (
        <div className="flex min-h-screen flex-col bg-gb-darkest">
          {/* Top HUD with glow */}
          <header 
            className="relative z-20 border-b-2 border-gb-dark p-2"
            style={{
              background: 'linear-gradient(180deg, rgba(48, 98, 48, 0.8) 0%, rgba(15, 56, 15, 0.9) 100%)',
              boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5), inset 0 -1px 0 rgba(139, 172, 15, 0.2)',
            }}
          >
            <GameHUD />
          </header>

          {/* Main game area */}
          <div className="flex flex-1 flex-col lg:flex-row">
            {/* Left sidebar - Stats and Character (desktop) */}
            <aside 
              className="hidden w-72 flex-col gap-4 border-r-2 border-gb-dark p-4 lg:flex"
              style={{
                background: 'linear-gradient(90deg, rgba(15, 56, 15, 0.95) 0%, rgba(15, 56, 15, 0.8) 100%)',
              }}
            >
              {/* Character display */}
              {gender && (
                <div 
                  className="flex justify-center pb-4 mb-2 border-b border-gb-dark/50"
                >
                  <CharacterDisplay
                    gender={gender as "male" | "female"}
                    age={age}
                    size="lg"
                    showLabel
                  />
                </div>
              )}
              
              <StatsPanel />
              
              <div className="mt-auto">
                <RelationshipsPanel />
              </div>
            </aside>

            {/* Center - Game canvas and narrative */}
            <main className="flex flex-1 flex-col relative">
              {/* Game canvas with atmosphere */}
              <div 
                className={cn(
                  "relative aspect-[3/2] w-full border-b-2 border-gb-dark overflow-hidden transition-all duration-500",
                  isTransitioning && "opacity-80 scale-[1.02]"
                )}
              >
                <GameCanvas className="absolute inset-0" />
                
                {/* Scene atmosphere overlay */}
                <SceneAtmosphere 
                  location={location || "bedroom"} 
                  mood={getMood()}
                  intensity={1}
                />

                {/* Mobile character display */}
                {gender && (
                  <div className="absolute bottom-3 right-3 lg:hidden">
                    <CharacterDisplay
                      gender={gender as "male" | "female"}
                      age={age}
                      size="sm"
                    />
                  </div>
                )}

                {/* Mobile stats overlay */}
                <div className="absolute bottom-3 left-3 right-20 lg:hidden">
                  <StatsPanel compact />
                </div>
              </div>

              {/* Narrative and choices */}
              <div 
                className="flex-1 p-4 lg:p-6"
                style={{
                  background: 'linear-gradient(180deg, rgba(15, 56, 15, 0.95) 0%, rgba(7, 31, 7, 0.98) 100%)',
                }}
              >
                <TurnDisplay />
              </div>
            </main>

            {/* Right sidebar - Dream display (desktop) */}
            <aside 
              className="hidden w-64 border-l-2 border-gb-dark p-4 xl:flex xl:flex-col"
              style={{
                background: 'linear-gradient(270deg, rgba(15, 56, 15, 0.95) 0%, rgba(15, 56, 15, 0.8) 100%)',
              }}
            >
              <div className="sticky top-4">
                {/* Dream card */}
                <div className="glow-border p-4 mb-6">
                  <h3 className="mb-3 font-pixel text-[9px] uppercase tracking-wider text-gb-light border-b border-gb-dark/50 pb-2">
                    Your Dream
                  </h3>
                  <p className="font-pixel text-[10px] italic leading-relaxed text-gb-lightest">
                    &quot;{dream}&quot;
                  </p>
                </div>
                
                {/* Life progress indicator */}
                <div className="panel-inset p-3">
                  <h3 className="mb-3 font-pixel text-[9px] uppercase tracking-wider text-gb-light">
                    Life Journey
                  </h3>
                  
                  {/* Progress bar */}
                  <div className="relative h-4 w-full overflow-hidden border-2 border-gb-dark bg-gb-shadow">
                    <div 
                      className="h-full transition-all duration-700 ease-out"
                      style={{ 
                        width: `${Math.min((age / 100) * 100, 100)}%`,
                        background: 'linear-gradient(90deg, #306230, #8bac0f, #9bbc0f)',
                        boxShadow: '0 0 10px rgba(139, 172, 15, 0.5)',
                      }}
                    />
                    {/* Milestone markers */}
                    <div className="absolute inset-0 flex">
                      {[18, 40, 65, 100].map((milestone) => (
                        <div 
                          key={milestone}
                          className="absolute top-0 bottom-0 w-px bg-gb-dark/50"
                          style={{ left: `${milestone}%` }}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div className="mt-2 flex justify-between">
                    <span className="font-pixel text-[8px] text-gb-dark">0</span>
                    <span 
                      className="font-pixel text-[10px] text-gb-light"
                      style={{ textShadow: '0 0 8px rgba(139, 172, 15, 0.6)' }}
                    >
                      Age {age}
                    </span>
                    <span className="font-pixel text-[8px] text-gb-dark">100+</span>
                  </div>
                  
                  {/* Life stage label */}
                  <div className="mt-3 text-center">
                    <span className="font-pixel text-[8px] uppercase tracking-wider text-gb-dark">
                      {age < 13 ? "Childhood" : 
                       age < 20 ? "Adolescence" : 
                       age < 40 ? "Young Adult" : 
                       age < 65 ? "Midlife" : "Elder Years"}
                    </span>
                  </div>
                </div>
              </div>
            </aside>
          </div>

          {/* Mobile relationships bar */}
          <footer 
            className="border-t-2 border-gb-dark p-2 lg:hidden"
            style={{
              background: 'linear-gradient(0deg, rgba(48, 98, 48, 0.8) 0%, rgba(15, 56, 15, 0.9) 100%)',
            }}
          >
            <RelationshipsPanel compact />
          </footer>
        </div>
      )}

      {/* Death Screen */}
      {screenState === "dead" && (
        <DeathScreen onPlayAgain={() => setScreenState("title")} />
      )}

      {/* Loading overlay */}
      {screenState === "loading" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gb-darkest">
          <div className="text-center">
            <div className="mb-4 flex justify-center gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="size-4 bg-gb-light"
                  style={{
                    animation: 'bounce 0.6s ease-in-out infinite',
                    animationDelay: `${i * 0.15}s`,
                    boxShadow: '0 0 15px rgba(139, 172, 15, 0.6)',
                  }}
                />
              ))}
            </div>
            <p 
              className="font-pixel text-sm text-gb-light"
              style={{ textShadow: '0 0 10px rgba(139, 172, 15, 0.5)' }}
            >
              Generating your story...
            </p>
          </div>
        </div>
      )}

      {/* Transition overlay */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-gb-darkest pointer-events-none transition-opacity duration-500",
          isTransitioning ? "opacity-100" : "opacity-0"
        )}
      />

      <style jsx>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
      `}</style>
    </div>
  );
}

export default GameWrapper;
