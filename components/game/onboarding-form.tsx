"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { useGameStore } from "@/lib/game-store";
import { useAudioStore } from "@/lib/audio";
import { CITIES } from "@/lib/constants";

type OnboardingStep = "intro" | "gender" | "city" | "dream" | "confirm";

export function OnboardingForm() {
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

  const handleStart = () => {
    const finalCity = city === "custom" ? customCity : city;
    if (!gender || !finalCity || !dream) return;

    playSound("select");
    setMusicEnabled(true);
    startGame(gender, finalCity, dream);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Title */}
        <div className="mb-8 text-center">
          <h1 className="font-pixel text-2xl text-gb-darkest">DREAMLAND</h1>
          <p className="mt-2 font-mono text-xs text-gb-dark">A Life Simulation</p>
        </div>

        {/* Step: Intro */}
        {step === "intro" && (
          <div className="animate-fade-in space-y-6 text-center">
            <div className="border-4 border-gb-dark bg-gb-lightest p-6">
              <p className="font-mono text-sm leading-relaxed text-gb-darkest">
                You are about to live an entire life. From your first breath to your last,
                every choice will shape your journey toward your dream.
              </p>
            </div>
            <button
              onClick={() => handleNext("gender")}
              className="w-full border-2 border-gb-dark bg-gb-light p-3 font-mono text-sm text-gb-darkest transition-colors hover:bg-gb-dark hover:text-gb-lightest"
            >
              BEGIN YOUR LIFE
            </button>
          </div>
        )}

        {/* Step: Gender */}
        {step === "gender" && (
          <div className="animate-fade-in space-y-4">
            <p className="text-center font-mono text-sm text-gb-dark">
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
                  className={cn(
                    "border-2 border-gb-dark bg-gb-lightest p-6 font-mono text-lg capitalize transition-colors",
                    "hover:bg-gb-light",
                    gender === g && "bg-gb-light"
                  )}
                >
                  <span className="mb-2 block text-3xl">{g === "male" ? "♂" : "♀"}</span>
                  {g}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step: City */}
        {step === "city" && (
          <div className="animate-fade-in space-y-4">
            <p className="text-center font-mono text-sm text-gb-dark">
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
                  className={cn(
                    "border border-gb-dark bg-gb-lightest p-2 font-mono text-xs transition-colors",
                    "hover:bg-gb-light",
                    city === c && "bg-gb-dark text-gb-lightest"
                  )}
                >
                  {c}
                </button>
              ))}
              <button
                onClick={() => {
                  setCity("custom");
                  playSound("hover");
                }}
                className={cn(
                  "col-span-2 border border-gb-dark bg-gb-lightest p-2 font-mono text-xs transition-colors",
                  "hover:bg-gb-light",
                  city === "custom" && "bg-gb-dark text-gb-lightest"
                )}
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
                className="w-full border-2 border-gb-dark bg-gb-lightest p-2 font-mono text-sm text-gb-darkest placeholder:text-gb-dark focus:outline-none focus:ring-2 focus:ring-gb-dark"
              />
            )}

            {(city && city !== "custom") || (city === "custom" && customCity) ? (
              <button
                onClick={() => handleNext("dream")}
                className="w-full border-2 border-gb-dark bg-gb-light p-3 font-mono text-sm text-gb-darkest transition-colors hover:bg-gb-dark hover:text-gb-lightest"
              >
                CONTINUE
              </button>
            ) : null}
          </div>
        )}

        {/* Step: Dream */}
        {step === "dream" && (
          <div className="animate-fade-in space-y-4">
            <p className="text-center font-mono text-sm text-gb-dark">
              What is your life&apos;s dream?
            </p>
            <div className="border-4 border-gb-dark bg-gb-lightest p-4">
              <p className="mb-4 font-mono text-xs text-gb-dark">
                This dream will guide your entire journey. Every choice, every
                crossroad will lead you closer to or further from this goal.
              </p>
              <input
                type="text"
                value={dream}
                onChange={(e) => setDream(e.target.value)}
                placeholder="To become..."
                className="w-full border-2 border-gb-dark bg-gb-lightest p-3 font-mono text-sm text-gb-darkest placeholder:text-gb-dark focus:outline-none focus:ring-2 focus:ring-gb-dark"
                maxLength={100}
              />
              <p className="mt-2 text-right font-mono text-[8px] text-gb-dark">
                {dream.length}/100
              </p>
            </div>

            {dream.length >= 3 && (
              <button
                onClick={() => handleNext("confirm")}
                className="w-full border-2 border-gb-dark bg-gb-light p-3 font-mono text-sm text-gb-darkest transition-colors hover:bg-gb-dark hover:text-gb-lightest"
              >
                CONTINUE
              </button>
            )}
          </div>
        )}

        {/* Step: Confirm */}
        {step === "confirm" && (
          <div className="animate-fade-in space-y-4">
            <div className="border-4 border-gb-dark bg-gb-lightest p-6">
              <h2 className="mb-4 text-center font-pixel text-lg text-gb-darkest">
                Your Life Awaits
              </h2>
              <div className="space-y-3 font-mono text-sm">
                <div className="flex justify-between border-b border-gb-dark pb-2">
                  <span className="text-gb-dark">Gender:</span>
                  <span className="capitalize text-gb-darkest">{gender}</span>
                </div>
                <div className="flex justify-between border-b border-gb-dark pb-2">
                  <span className="text-gb-dark">Birthplace:</span>
                  <span className="text-gb-darkest">
                    {city === "custom" ? customCity : city}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gb-dark">Dream:</span>
                  <span className="max-w-[60%] text-right text-gb-darkest">{dream}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleStart}
              className="w-full border-2 border-gb-darkest bg-gb-dark p-4 font-pixel text-lg text-gb-lightest transition-colors hover:bg-gb-darkest"
            >
              LIVE YOUR LIFE
            </button>

            <button
              onClick={() => setStep("intro")}
              className="w-full p-2 font-mono text-xs text-gb-dark hover:text-gb-darkest"
            >
              Start Over
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
