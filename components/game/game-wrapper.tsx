"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/lib/game-store";
import { useAudioStore } from "@/lib/audio";
import { OnboardingForm } from "./onboarding-form";
import { GameCanvas } from "./game-canvas";
import { GameHUD } from "./game-hud";
import { StatsPanel } from "./stats-panel";
import { RelationshipsPanel } from "./relationships-panel";
import { TurnDisplay } from "./turn-display";
import { DeathScreen } from "./death-screen";
import { CloseCallOverlay } from "./close-call-overlay";
import { CRTEffect } from "@/components/effects/crt-effect";
import { PixelTransition } from "@/components/effects/pixel-transition";
import { cn } from "@/lib/utils";

export function GameWrapper() {
  const gameState = useGameStore((state) => state.gameState);
  const age = useGameStore((state) => state.age);
  const closeCallMessage = useGameStore((state) => state.closeCallMessage);
  const clearCloseCallMessage = useGameStore((state) => state.clearCloseCallMessage);

  const { initAudio, updateMusicForAge } = useAudioStore();

  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showCloseCall, setShowCloseCall] = useState(false);

  // Initialize audio on mount
  useEffect(() => {
    initAudio();
  }, [initAudio]);

  // Update music based on age
  useEffect(() => {
    if (gameState === "playing") {
      updateMusicForAge(age);
    }
  }, [age, gameState, updateMusicForAge]);

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

  // Handle scene transitions
  useEffect(() => {
    const handleTransition = () => {
      setIsTransitioning(true);
      setTimeout(() => setIsTransitioning(false), 600);
    };

    // Listen for age changes to trigger transitions
    if (gameState === "playing") {
      handleTransition();
    }
  }, [age, gameState]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gb-lightest">
      {/* CRT Effect overlay */}
      <CRTEffect />

      {/* Pixel transition effect */}
      <PixelTransition isTransitioning={isTransitioning} type="dissolve" />

      {/* Close call overlay */}
      {showCloseCall && closeCallMessage && (
        <CloseCallOverlay message={closeCallMessage} onComplete={handleCloseCallComplete} />
      )}

      {/* Main content based on game state */}
      {gameState === "onboarding" && <OnboardingForm />}

      {gameState === "playing" && (
        <div className="flex min-h-screen flex-col">
          {/* Top HUD */}
          <div className="border-b-2 border-gb-dark bg-gb-lightest p-2">
            <GameHUD />
          </div>

          {/* Main game area */}
          <div className="flex flex-1 flex-col lg:flex-row">
            {/* Left sidebar - Stats (desktop) */}
            <div className="hidden w-64 border-r-2 border-gb-dark bg-gb-lightest/50 p-4 lg:block">
              <StatsPanel />
              <RelationshipsPanel className="mt-4" />
            </div>

            {/* Center - Game canvas and narrative */}
            <div className="flex flex-1 flex-col">
              {/* Game canvas */}
              <div className="relative aspect-[3/2] w-full border-b-2 border-gb-dark">
                <GameCanvas className="absolute inset-0" />

                {/* Mobile stats overlay */}
                <div className="absolute bottom-2 left-2 right-2 lg:hidden">
                  <StatsPanel compact />
                </div>
              </div>

              {/* Narrative and choices */}
              <div className="flex-1 p-4">
                <TurnDisplay />
              </div>
            </div>

            {/* Right sidebar - Relationships (desktop) */}
            <div className="hidden w-64 border-l-2 border-gb-dark bg-gb-lightest/50 p-4 xl:block">
              <div className="sticky top-4">
                <h3 className="mb-2 font-mono text-xs uppercase text-gb-dark">Your Dream</h3>
                <div className="border-2 border-gb-dark bg-gb-lightest p-3">
                  <p className="font-mono text-sm italic text-gb-darkest">
                    &quot;{useGameStore.getState().dream}&quot;
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile relationships bar */}
          <div className="border-t-2 border-gb-dark p-2 lg:hidden">
            <RelationshipsPanel compact />
          </div>
        </div>
      )}

      {gameState === "dead" && <DeathScreen />}

      {/* Loading overlay */}
      {gameState === "loading" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gb-darkest">
          <div className="text-center">
            <div className="mb-4 flex justify-center gap-2">
              <div className="size-3 animate-bounce bg-gb-light" style={{ animationDelay: "0ms" }} />
              <div className="size-3 animate-bounce bg-gb-light" style={{ animationDelay: "150ms" }} />
              <div className="size-3 animate-bounce bg-gb-light" style={{ animationDelay: "300ms" }} />
            </div>
            <p className="font-mono text-sm text-gb-light">Generating your story...</p>
          </div>
        </div>
      )}
    </div>
  );
}
