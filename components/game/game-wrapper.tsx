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
import { CRTEffect } from "@/components/effects/crt-effect";
import { PixelTransition } from "@/components/effects/pixel-transition";
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
      {/* CRT Effect overlay - always present */}
      <CRTEffect intensity={screenState === "title" ? 0.4 : 0.3} />

      {/* Pixel transition effect */}
      <PixelTransition isTransitioning={isTransitioning} type="dissolve" />

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
        <div className="flex min-h-screen flex-col bg-gb-lightest">
          {/* Top HUD */}
          <header className="border-b-2 border-gb-dark bg-gb-lightest p-2">
            <GameHUD />
          </header>

          {/* Main game area */}
          <div className="flex flex-1 flex-col lg:flex-row">
            {/* Left sidebar - Stats and Character (desktop) */}
            <aside className="hidden w-64 flex-col gap-4 border-r-2 border-gb-dark bg-gb-lightest/50 p-4 lg:flex">
              {/* Character display */}
              {gender && (
                <div className="flex justify-center border-b-2 border-gb-dark pb-4">
                  <CharacterDisplay
                    gender={gender as "male" | "female"}
                    age={age}
                    size="lg"
                    showLabel
                  />
                </div>
              )}
              <StatsPanel />
              <RelationshipsPanel />
            </aside>

            {/* Center - Game canvas and narrative */}
            <main className="flex flex-1 flex-col">
              {/* Game canvas with atmosphere */}
              <div className="relative aspect-[3/2] w-full border-b-2 border-gb-dark">
                <GameCanvas className="absolute inset-0" />
                
                {/* Scene atmosphere overlay */}
                <SceneAtmosphere 
                  location={location || "bedroom"} 
                  mood={getMood()}
                  intensity={1}
                />

                {/* Mobile character display */}
                {gender && (
                  <div className="absolute bottom-2 right-2 lg:hidden">
                    <CharacterDisplay
                      gender={gender as "male" | "female"}
                      age={age}
                      size="sm"
                    />
                  </div>
                )}

                {/* Mobile stats overlay */}
                <div className="absolute bottom-2 left-2 right-16 lg:hidden">
                  <StatsPanel compact />
                </div>
              </div>

              {/* Narrative and choices */}
              <div className="flex-1 bg-gb-lightest p-4">
                <TurnDisplay />
              </div>
            </main>

            {/* Right sidebar - Dream display (desktop) */}
            <aside className="hidden w-64 border-l-2 border-gb-dark bg-gb-lightest/50 p-4 xl:flex xl:flex-col">
              <div className="sticky top-4">
                <h3 className="mb-2 font-pixel text-[10px] uppercase tracking-wider text-gb-dark">
                  Your Dream
                </h3>
                <div className="border-2 border-gb-dark bg-gb-darkest p-3">
                  <p className="font-pixel text-xs italic leading-relaxed text-gb-light">
                    &quot;{dream}&quot;
                  </p>
                </div>
                
                {/* Life progress indicator */}
                <div className="mt-4">
                  <h3 className="mb-2 font-pixel text-[10px] uppercase tracking-wider text-gb-dark">
                    Life Journey
                  </h3>
                  <div className="h-2 w-full overflow-hidden rounded-full border border-gb-dark bg-gb-darkest">
                    <div 
                      className="h-full bg-gb-light transition-all duration-500"
                      style={{ width: `${Math.min((age / 100) * 100, 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-center font-pixel text-[8px] text-gb-dark">
                    {age} / 100+ years
                  </p>
                </div>
              </div>
            </aside>
          </div>

          {/* Mobile relationships bar */}
          <footer className="border-t-2 border-gb-dark bg-gb-lightest p-2 lg:hidden">
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
                  className="size-3 animate-bounce bg-gb-light"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
            <p className="font-pixel text-sm text-gb-light">Generating your story...</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default GameWrapper;
