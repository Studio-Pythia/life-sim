"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useGameStore } from "@/lib/game-store";
import { useAudioStore } from "@/lib/audio";
import { CITIES } from "@/lib/constants";

type OnboardingStep = "intro" | "gender" | "city" | "dream" | "confirm";

interface OnboardingFormProps {
  onGameStarted?: () => void;
}

export function OnboardingForm({ onGameStarted }: OnboardingFormProps) {
  const [step, setStep] = useState<OnboardingStep>("intro");
  const [gender, setGender] = useState<"male" | "female" | null>(null);
  const [city, setCity] = useState<string>("");
  const [customCity, setCustomCity] = useState("");
  const [dream, setDream] = useState("");

  const startGame = useGameStore((state) => state.startGame);
  const { playSound, setMusicEnabled } = useAudioStore();

  const handleNext = (nextStep: OnboardingStep) => {
    playSound("select");
    setStep(nextStep);
  };

  const handleStart = async () => {
    const finalCity = city === "custom" ? customCity : city;
    if (!gender || !finalCity || !dream) return;

    playSound("select");
    setMusicEnabled(true);
    await startGame(gender, finalCity, dream);
    onGameStarted?.();
  };

  return (
    <div 
      className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6"
      style={{ backgroundColor: "#0f380f" }}
    >
      <div className="w-full max-w-lg">
        {/* Title - Always visible */}
        <div className="mb-6 text-center">
          <h1 
            className="text-xl sm:text-2xl tracking-wider"
            style={{ 
              fontFamily: '"Press Start 2P", monospace',
              color: "#9bbc0f",
              textShadow: "2px 2px 0 #306230"
            }}
          >
            DREAMLAND
          </h1>
          <p 
            className="mt-2 text-[10px] sm:text-xs tracking-wide"
            style={{ 
              fontFamily: '"Press Start 2P", monospace',
              color: "#306230" 
            }}
          >
            A Life Simulation
          </p>
        </div>

        {/* Step: Intro */}
        {step === "intro" && (
          <div className="space-y-6 text-center animate-fade-in">
            <div 
              className="p-4 sm:p-6 border-4"
              style={{ 
                backgroundColor: "#9bbc0f",
                borderColor: "#306230"
              }}
            >
              <p 
                className="text-[10px] sm:text-xs leading-relaxed"
                style={{ 
                  fontFamily: '"Press Start 2P", monospace',
                  color: "#0f380f",
                  lineHeight: "1.8"
                }}
              >
                You are about to live an entire life. From your first breath to your last,
                every choice will shape your journey toward your dream.
              </p>
            </div>
            <button
              onClick={() => handleNext("gender")}
              className="w-full p-4 border-4 transition-all active:translate-y-1"
              style={{ 
                fontFamily: '"Press Start 2P", monospace',
                backgroundColor: "#8bac0f",
                borderColor: "#306230",
                color: "#0f380f",
                fontSize: "12px"
              }}
            >
              BEGIN YOUR LIFE
            </button>
          </div>
        )}

        {/* Step: Gender */}
        {step === "gender" && (
          <div className="space-y-4 animate-fade-in">
            <p 
              className="text-center text-[10px] sm:text-xs"
              style={{ 
                fontFamily: '"Press Start 2P", monospace',
                color: "#8bac0f" 
              }}
            >
              A new life begins...
            </p>
            <div className="grid grid-cols-2 gap-4">
              {(["male", "female"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => {
                    setGender(g);
                    handleNext("city");
                  }}
                  className="p-6 sm:p-8 border-4 transition-all active:translate-y-1"
                  style={{ 
                    fontFamily: '"Press Start 2P", monospace',
                    backgroundColor: gender === g ? "#8bac0f" : "#9bbc0f",
                    borderColor: "#306230",
                    color: "#0f380f"
                  }}
                >
                  <span className="block text-4xl sm:text-5xl mb-3">{g === "male" ? "♂" : "♀"}</span>
                  <span className="text-xs sm:text-sm uppercase">{g}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: City */}
        {step === "city" && (
          <div className="space-y-4 animate-fade-in">
            <p 
              className="text-center text-[10px] sm:text-xs"
              style={{ 
                fontFamily: '"Press Start 2P", monospace',
                color: "#8bac0f" 
              }}
            >
              Where were you born?
            </p>
            <div className="grid grid-cols-2 gap-2">
              {CITIES.map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setCity(c);
                    playSound("hover");
                  }}
                  className="p-3 border-2 transition-all active:translate-y-0.5"
                  style={{ 
                    fontFamily: '"Press Start 2P", monospace',
                    backgroundColor: city === c ? "#306230" : "#9bbc0f",
                    borderColor: "#306230",
                    color: city === c ? "#9bbc0f" : "#0f380f",
                    fontSize: "9px"
                  }}
                >
                  {c}
                </button>
              ))}
              <button
                onClick={() => {
                  setCity("custom");
                  playSound("hover");
                }}
                className="col-span-2 p-3 border-2 transition-all active:translate-y-0.5"
                style={{ 
                  fontFamily: '"Press Start 2P", monospace',
                  backgroundColor: city === "custom" ? "#306230" : "#8bac0f",
                  borderColor: "#306230",
                  color: city === "custom" ? "#9bbc0f" : "#0f380f",
                  fontSize: "10px"
                }}
              >
                Other City...
              </button>
            </div>

            {city === "custom" && (
              <input
                type="text"
                value={customCity}
                onChange={(e) => setCustomCity(e.target.value)}
                placeholder="Enter city name"
                className="w-full p-3 border-4 outline-none"
                style={{ 
                  fontFamily: '"Press Start 2P", monospace',
                  backgroundColor: "#9bbc0f",
                  borderColor: "#306230",
                  color: "#0f380f",
                  fontSize: "11px"
                }}
              />
            )}

            {(city && city !== "custom") || (city === "custom" && customCity) ? (
              <button
                onClick={() => handleNext("dream")}
                className="w-full p-4 border-4 transition-all active:translate-y-1"
                style={{ 
                  fontFamily: '"Press Start 2P", monospace',
                  backgroundColor: "#8bac0f",
                  borderColor: "#306230",
                  color: "#0f380f",
                  fontSize: "11px"
                }}
              >
                CONTINUE
              </button>
            ) : null}
          </div>
        )}

        {/* Step: Dream */}
        {step === "dream" && (
          <div className="space-y-4 animate-fade-in">
            <p 
              className="text-center text-[10px] sm:text-xs"
              style={{ 
                fontFamily: '"Press Start 2P", monospace',
                color: "#8bac0f" 
              }}
            >
              {"What is your life's dream?"}
            </p>
            <div 
              className="p-4 border-4"
              style={{ 
                backgroundColor: "#9bbc0f",
                borderColor: "#306230"
              }}
            >
              <p 
                className="mb-4 text-[9px] sm:text-[10px] leading-relaxed"
                style={{ 
                  fontFamily: '"Press Start 2P", monospace',
                  color: "#306230",
                  lineHeight: "1.8"
                }}
              >
                This dream will guide your entire journey. Every choice will lead you closer to or further from this goal.
              </p>
              <div className="relative">
                <span 
                  className="absolute left-3 top-3 text-[10px]"
                  style={{ 
                    fontFamily: '"Press Start 2P", monospace',
                    color: "#306230"
                  }}
                >
                  I dream of...
                </span>
                <input
                  type="text"
                  value={dream}
                  onChange={(e) => setDream(e.target.value)}
                  placeholder=""
                  className="w-full p-3 pt-8 border-4 outline-none"
                  style={{ 
                    fontFamily: '"Press Start 2P", monospace',
                    backgroundColor: "#8bac0f",
                    borderColor: "#306230",
                    color: "#0f380f",
                    fontSize: "11px"
                  }}
                  maxLength={100}
                />
              </div>
              <p 
                className="mt-2 text-right text-[8px]"
                style={{ 
                  fontFamily: '"Press Start 2P", monospace',
                  color: "#306230" 
                }}
              >
                {dream.length}/100
              </p>
            </div>

            {dream.length >= 3 && (
              <button
                onClick={() => handleNext("confirm")}
                className="w-full p-4 border-4 transition-all active:translate-y-1"
                style={{ 
                  fontFamily: '"Press Start 2P", monospace',
                  backgroundColor: "#8bac0f",
                  borderColor: "#306230",
                  color: "#0f380f",
                  fontSize: "11px"
                }}
              >
                CONTINUE
              </button>
            )}
          </div>
        )}

        {/* Step: Confirm */}
        {step === "confirm" && (
          <div className="space-y-4 animate-fade-in">
            <div 
              className="p-4 sm:p-6 border-4"
              style={{ 
                backgroundColor: "#9bbc0f",
                borderColor: "#306230"
              }}
            >
              <h2 
                className="mb-4 text-center text-sm sm:text-base"
                style={{ 
                  fontFamily: '"Press Start 2P", monospace',
                  color: "#0f380f"
                }}
              >
                Your Life Awaits
              </h2>
              <div className="space-y-3">
                <div 
                  className="flex justify-between pb-2 border-b-2"
                  style={{ borderColor: "#306230" }}
                >
                  <span 
                    className="text-[10px]"
                    style={{ 
                      fontFamily: '"Press Start 2P", monospace',
                      color: "#306230" 
                    }}
                  >
                    Gender:
                  </span>
                  <span 
                    className="text-[10px] capitalize"
                    style={{ 
                      fontFamily: '"Press Start 2P", monospace',
                      color: "#0f380f" 
                    }}
                  >
                    {gender}
                  </span>
                </div>
                <div 
                  className="flex justify-between pb-2 border-b-2"
                  style={{ borderColor: "#306230" }}
                >
                  <span 
                    className="text-[10px]"
                    style={{ 
                      fontFamily: '"Press Start 2P", monospace',
                      color: "#306230" 
                    }}
                  >
                    Birthplace:
                  </span>
                  <span 
                    className="text-[10px]"
                    style={{ 
                      fontFamily: '"Press Start 2P", monospace',
                      color: "#0f380f" 
                    }}
                  >
                    {city === "custom" ? customCity : city}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span 
                    className="text-[10px]"
                    style={{ 
                      fontFamily: '"Press Start 2P", monospace',
                      color: "#306230" 
                    }}
                  >
                    Dream:
                  </span>
                  <span 
                    className="text-[10px] text-right max-w-[60%]"
                    style={{ 
                      fontFamily: '"Press Start 2P", monospace',
                      color: "#0f380f" 
                    }}
                  >
                    {dream}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={handleStart}
              className="w-full p-4 border-4 transition-all active:translate-y-1"
              style={{ 
                fontFamily: '"Press Start 2P", monospace',
                backgroundColor: "#306230",
                borderColor: "#0f380f",
                color: "#9bbc0f",
                fontSize: "12px"
              }}
            >
              LIVE YOUR LIFE
            </button>

            <button
              onClick={() => setStep("intro")}
              className="w-full p-2"
              style={{ 
                fontFamily: '"Press Start 2P", monospace',
                backgroundColor: "transparent",
                color: "#306230",
                fontSize: "9px"
              }}
            >
              Start Over
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
