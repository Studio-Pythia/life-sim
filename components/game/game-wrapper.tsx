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
import { CharacterDisplay } from "./character-display";
import { IntroSequence } from "./intro-sequence";
import { MilestonePopup, isMilestoneAge, getMilestoneMessage } from "./milestone-popup";
import { cn } from "@/lib/utils";

type ScreenState = "title" | "onboarding" | "intro" | "playing" | "dead" | "loading";

export function GameWrapper() {
  const router = useRouter();
  const gameState = useGameStore((state) => state.gameState);
  const age = useGameStore((state) => state.age);
  const gender = useGameStore((state) => state.gender);
  const city = useGameStore((state) => state.city);
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
  const [showMilestone, setShowMilestone] = useState(false);
  const [milestoneAge, setMilestoneAge] = useState(0);

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
      
      // Check for milestone ages
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

  // Handle milestone dismissal
  const handleMilestoneDismiss = () => {
    setShowMilestone(false);
    setMilestoneAge(0);
  };

  // Title screen handlers
  const handleStartGame = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setScreenState("onboarding");
      setGameState("onboarding");
      setIsTransitioning(false);
    }, 500);
  };

  // When game starts, show intro sequence
  const handleGameStarted = () => {
    setScreenState("intro");
  };

  // After intro completes, go to playing
  const handleIntroComplete = () => {
    setScreenState("playing");
  };

  const handleLeaderboard = () => {
    router.push("/leaderboard");
  };

  // Get life stage label
  const getLifeStage = () => {
    if (age < 4) return "Baby";
    if (age < 13) return "Child";
    if (age < 20) return "Teen";
    if (age < 40) return "Adult";
    if (age < 65) return "Middle Age";
    return "Elder";
  };

  return (
    <div 
      className="relative min-h-screen overflow-hidden"
      style={{ backgroundColor: "#0f380f" }}
    >
      {/* Global CRT scanlines */}
      <div 
        className="fixed inset-0 pointer-events-none z-[100]"
        style={{
          background: "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.1) 1px, rgba(0,0,0,0.1) 2px)",
          opacity: 0.5
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

      {/* Main Game - Clean mobile-first layout */}
      {screenState === "playing" && (
        <div className="flex min-h-screen flex-col">
          {/* Minimal top bar - just age and dream */}
          <header 
            className="relative z-20 flex items-center justify-between p-2 sm:p-3 border-b-2"
            style={{
              backgroundColor: "#0f380f",
              borderColor: "#306230"
            }}
          >
            {/* Age badge */}
            <div 
              className="flex items-center gap-2 px-3 py-1 border-2"
              style={{
                backgroundColor: "#306230",
                borderColor: "#8bac0f"
              }}
            >
              <span 
                className="text-[10px] sm:text-xs"
                style={{ 
                  fontFamily: '"Press Start 2P", monospace',
                  color: "#9bbc0f" 
                }}
              >
                AGE
              </span>
              <span 
                className="text-sm sm:text-lg"
                style={{ 
                  fontFamily: '"Press Start 2P", monospace',
                  color: "#9bbc0f",
                  textShadow: "0 0 10px rgba(155, 188, 15, 0.5)"
                }}
              >
                {age}
              </span>
            </div>

            {/* Dream reminder - truncated on mobile */}
            <div 
              className="flex-1 mx-2 sm:mx-4 text-right truncate"
              title={`Dream: ${dream}`}
            >
              <span 
                className="text-[8px] sm:text-[10px] uppercase tracking-wider"
                style={{ 
                  fontFamily: '"Press Start 2P", monospace',
                  color: "#306230" 
                }}
              >
                Dream:{" "}
              </span>
              <span 
                className="text-[8px] sm:text-[10px] italic"
                style={{ 
                  fontFamily: '"Press Start 2P", monospace',
                  color: "#8bac0f" 
                }}
              >
                {dream && dream.length > 20 ? dream.slice(0, 20) + "..." : dream}
              </span>
            </div>
          </header>

          {/* Main game area - Scene with character */}
          <div className="flex-1 flex flex-col">
            {/* Game canvas with character overlay */}
            <div 
              className={cn(
                "relative w-full transition-all duration-500",
                isTransitioning && "opacity-80"
              )}
              style={{ 
                aspectRatio: "16/10",
                maxHeight: "50vh"
              }}
            >
              <GameCanvas className="absolute inset-0" />
              
              {/* Character sprite positioned on the scene */}
              {gender && (
                <div 
                  className="absolute left-1/2 -translate-x-1/2"
                  style={{ 
                    bottom: "15%",
                  }}
                >
                  <CharacterDisplay
                    gender={gender as "male" | "female"}
                    age={age}
                    size="lg"
                  />
                  {/* Life stage label below character */}
                  <div className="text-center mt-1">
                    <span 
                      className="text-[8px] px-2 py-0.5 border"
                      style={{ 
                        fontFamily: '"Press Start 2P", monospace',
                        backgroundColor: "rgba(15, 56, 15, 0.85)",
                        borderColor: "#306230",
                        color: "#8bac0f" 
                      }}
                    >
                      {getLifeStage()}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Narrative and choices area */}
            <div 
              className="flex-1 p-3 sm:p-4 overflow-y-auto"
              style={{
                backgroundColor: "#0f380f"
              }}
            >
              <TurnDisplay />
            </div>
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
                  className="size-3 sm:size-4"
                  style={{
                    backgroundColor: "#8bac0f",
                    animation: 'bounce 0.6s ease-in-out infinite',
                    animationDelay: `${i * 0.15}s`,
                    boxShadow: '0 0 15px rgba(139, 172, 15, 0.6)',
                  }}
                />
              ))}
            </div>
            <p 
              className="text-[10px] sm:text-xs animate-pulse"
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
