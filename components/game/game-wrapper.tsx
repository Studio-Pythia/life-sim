"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/lib/game-store";
import { useAudioStore } from "@/lib/audio";
import { TitleScreen } from "./title-screen";
import { OnboardingForm } from "./onboarding-form";
import { GameCanvas } from "./game-canvas";
import { TurnDisplay } from "./turn-display";
import { DeathScreen } from "./death-screen";
import { CloseCallOverlay } from "./close-call-overlay";
import { IntroSequence } from "./intro-sequence";
import { MilestonePopup, isMilestoneAge, getMilestoneMessage } from "./milestone-popup";
import { StatsPanel } from "./stats-panel";
import { cn } from "@/lib/utils";

type ScreenState = "title" | "onboarding" | "intro" | "playing" | "dead" | "loading";

export function GameWrapper() {
  const router = useRouter();
  const gameState = useGameStore((state) => state.gameState);
  const age = useGameStore((state) => state.age);
  const gender = useGameStore((state) => state.gender);
  const city = useGameStore((state) => state.city);
  const dream = useGameStore((state) => state.dream);
  const relationships = useGameStore((state) => state.relationships);
  const closeCallMessage = useGameStore((state) => state.closeCallMessage);
  const clearCloseCallMessage = useGameStore((state) => state.clearCloseCallMessage);
  const setGameState = useGameStore((state) => state.setGameState);

  const { initAudio, updateMusicForAge } = useAudioStore();

  const [screenState, setScreenState] = useState<ScreenState>("title");
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showCloseCall, setShowCloseCall] = useState(false);
  const [prevAge, setPrevAge] = useState(age);
  const [showMilestone, setShowMilestone] = useState(false);
  const [milestoneAge, setMilestoneAge] = useState(0);
  const [showStats, setShowStats] = useState(false);

  // Sync screen state with game state
  useEffect(() => {
    if (gameState === "onboarding") setScreenState("onboarding");
    else if (gameState === "playing") setScreenState("playing");
    else if (gameState === "dead") setScreenState("dead");
    else if (gameState === "loading") setScreenState("loading");
  }, [gameState]);

  // Initialize audio on mount
  useEffect(() => {
    initAudio();
  }, [initAudio]);

  // Update music based on age
  useEffect(() => {
    if (screenState === "playing") updateMusicForAge(age);
  }, [age, screenState, updateMusicForAge]);

  // Handle close call messages
  useEffect(() => {
    if (closeCallMessage) setShowCloseCall(true);
  }, [closeCallMessage]);

  const handleCloseCallComplete = () => {
    setShowCloseCall(false);
    clearCloseCallMessage();
  };

  // Handle scene transitions on age change
  useEffect(() => {
    if (age !== prevAge && screenState === "playing") {
      setIsTransitioning(true);
      if (isMilestoneAge(age) && age > 1) {
        setMilestoneAge(age);
        setShowMilestone(true);
      }
      setTimeout(() => {
        setIsTransitioning(false);
        setPrevAge(age);
      }, 600);
    }
  }, [age, prevAge, screenState]);

  const handleMilestoneDismiss = () => {
    setShowMilestone(false);
    setMilestoneAge(0);
  };

  const handleStartGame = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setScreenState("onboarding");
      setGameState("onboarding");
      setIsTransitioning(false);
    }, 500);
  };

  const handleGameStarted = () => {
    setScreenState("intro");
  };

  const handleIntroComplete = () => {
    setScreenState("playing");
  };

  const handleLeaderboard = () => {
    router.push("/leaderboard");
  };

  return (
    <div 
      className="relative w-full h-screen overflow-hidden"
      style={{ backgroundColor: "#0f380f" }}
    >
      {/* CRT scanlines */}
      <div 
        className="fixed inset-0 pointer-events-none z-[100]"
        style={{
          background: "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.08) 1px, rgba(0,0,0,0.08) 2px)",
        }}
      />

      {/* Close call overlay */}
      {showCloseCall && closeCallMessage && (
        <CloseCallOverlay message={closeCallMessage} onComplete={handleCloseCallComplete} />
      )}

      {/* Milestone celebration */}
      {showMilestone && milestoneAge > 0 && (
        <MilestonePopup 
          age={milestoneAge} 
          message={getMilestoneMessage(milestoneAge)} 
          onDismiss={handleMilestoneDismiss} 
        />
      )}

      {/* Title Screen */}
      {screenState === "title" && (
        <TitleScreen onStart={handleStartGame} onLeaderboard={handleLeaderboard} />
      )}

      {/* Onboarding */}
      {screenState === "onboarding" && <OnboardingForm onGameStarted={handleGameStarted} />}

      {/* Intro Sequence */}
      {screenState === "intro" && city && dream && gender && (
        <IntroSequence 
          city={city}
          dream={dream}
          gender={gender as "male" | "female"}
          onComplete={handleIntroComplete}
        />
      )}

      {/* Main Game - Matches old HTML layout exactly */}
      {screenState === "playing" && (
        <div className="relative w-full h-full flex flex-col">
          {/* Game canvas fills the screen - sprite is rendered INSIDE */}
          <div 
            className={cn(
              "relative flex-1 transition-opacity duration-500",
              isTransitioning && "opacity-80"
            )}
          >
            <GameCanvas className="absolute inset-0" />

            {/* UI OVERLAY - on top of canvas */}
            <div className="absolute inset-0 pointer-events-none">
              {/* TOP HUD - Age on left, location/dream on right */}
              <div className="pointer-events-auto flex items-start justify-between p-2 sm:p-3">
                {/* Age badge */}
                <div 
                  className="px-2 py-1 border-2"
                  style={{
                    backgroundColor: "rgba(15, 56, 15, 0.9)",
                    borderColor: "#306230"
                  }}
                >
                  <span 
                    className="text-xs sm:text-sm"
                    style={{ 
                      fontFamily: '"Press Start 2P", monospace',
                      color: "#9bbc0f" 
                    }}
                  >
                    AGE {age}
                  </span>
                </div>

                {/* Right side - city + dream */}
                <div 
                  className="text-right px-2 py-1"
                  style={{
                    backgroundColor: "rgba(15, 56, 15, 0.9)",
                  }}
                >
                  <span 
                    className="text-[8px] sm:text-[10px] uppercase tracking-wider"
                    style={{ 
                      fontFamily: '"Press Start 2P", monospace',
                      color: "#8bac0f" 
                    }}
                  >
                    {city?.toUpperCase()} · {dream && dream.length > 15 ? dream.slice(0, 15) + "..." : dream}
                  </span>
                </div>
              </div>

              {/* LEFT SIDE - Relationships panel */}
              {relationships && relationships.length > 0 && (
                <div 
                  className="pointer-events-auto absolute left-2 top-12 sm:top-14 max-w-[180px] sm:max-w-[220px]"
                >
                  <div 
                    className="p-2 border-2 space-y-1 max-h-[30vh] overflow-y-auto"
                    style={{
                      backgroundColor: "rgba(15, 56, 15, 0.95)",
                      borderColor: "#306230"
                    }}
                  >
                    {relationships.slice(0, 5).map((rel, i) => {
                      const isDeceased = rel.role?.toLowerCase().includes("deceased") || 
                                         rel.display?.toLowerCase().includes("deceased");
                      return (
                        <div 
                          key={i}
                          className="px-2 py-1 border"
                          style={{
                            backgroundColor: isDeceased ? "rgba(48, 98, 48, 0.5)" : "#306230",
                            borderColor: "#8bac0f"
                          }}
                        >
                          <div 
                            className="text-[6px] sm:text-[8px] uppercase truncate"
                            style={{ 
                              fontFamily: '"Press Start 2P", monospace',
                              color: "#8bac0f" 
                            }}
                          >
                            {rel.relation || rel.role}
                          </div>
                          <div 
                            className="text-[8px] sm:text-[10px] truncate"
                            style={{ 
                              fontFamily: '"Press Start 2P", monospace',
                              color: "#9bbc0f" 
                            }}
                          >
                            {rel.name}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* RIGHT SIDE - Stats toggle button */}
              <button
                onClick={() => setShowStats(true)}
                className="pointer-events-auto absolute right-2 top-12 sm:top-14 px-3 py-2 border-2 transition-all hover:border-gb-light"
                style={{
                  backgroundColor: "#306230",
                  borderColor: "#8bac0f",
                  fontFamily: '"Press Start 2P", monospace',
                  fontSize: "10px",
                  color: "#9bbc0f"
                }}
              >
                STATS
              </button>
            </div>
          </div>

          {/* BOTTOM - Dialogue and choices */}
          <div 
            className="relative z-10 border-t-2"
            style={{
              backgroundColor: "#0f380f",
              borderColor: "#306230"
            }}
          >
            <TurnDisplay />
          </div>
        </div>
      )}

      {/* Stats overlay panel */}
      {showStats && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(15, 56, 15, 0.95)" }}
          onClick={() => setShowStats(false)}
        >
          <div 
            className="w-full max-w-md p-4 border-4"
            style={{
              backgroundColor: "#0f380f",
              borderColor: "#8bac0f"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <StatsPanel />
            <button
              onClick={() => setShowStats(false)}
              className="mt-4 w-full py-2 border-2 transition-all hover:bg-gb-dark"
              style={{
                backgroundColor: "#306230",
                borderColor: "#8bac0f",
                fontFamily: '"Press Start 2P", monospace',
                fontSize: "10px",
                color: "#9bbc0f"
              }}
            >
              CLOSE
            </button>
          </div>
        </div>
      )}

      {/* Death Screen */}
      {screenState === "dead" && (
        <DeathScreen onPlayAgain={() => setScreenState("title")} />
      )}

      {/* Loading overlay */}
      {screenState === "loading" && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: "#0f380f" }}
        >
          <div className="text-center">
            <div className="mb-4 flex justify-center gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="size-3"
                  style={{
                    backgroundColor: "#8bac0f",
                    animation: 'bounce 0.6s ease-in-out infinite',
                    animationDelay: `${i * 0.15}s`,
                  }}
                />
              ))}
            </div>
            <p 
              className="text-[10px] animate-pulse"
              style={{ 
                fontFamily: '"Press Start 2P", monospace',
                color: "#8bac0f" 
              }}
            >
              Loading your story...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
