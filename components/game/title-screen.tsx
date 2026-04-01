"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { CRTEffect } from "@/components/effects/crt-effect";

interface TitleScreenProps {
  onStart: () => void;
  onLeaderboard: () => void;
}

export function TitleScreen({ onStart, onLeaderboard }: TitleScreenProps) {
  const [mounted, setMounted] = useState(false);
  const [showPressStart, setShowPressStart] = useState(false);
  const [selectedOption, setSelectedOption] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const options = [
    { label: "NEW LIFE", action: onStart },
    { label: "LEADERBOARD", action: onLeaderboard },
  ];

  useEffect(() => {
    setMounted(true);
    const timer = setTimeout(() => setShowPressStart(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTransitioning) return;

      switch (e.key) {
        case "ArrowUp":
        case "w":
        case "W":
          setSelectedOption((prev) => (prev - 1 + options.length) % options.length);
          break;
        case "ArrowDown":
        case "s":
        case "S":
          setSelectedOption((prev) => (prev + 1) % options.length);
          break;
        case "Enter":
        case " ":
          handleSelect(selectedOption);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedOption, isTransitioning, options.length]);

  const handleSelect = useCallback((index: number) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    
    // Play select sound effect if audio is available
    setTimeout(() => {
      options[index].action();
    }, 500);
  }, [isTransitioning, options]);

  if (!mounted) return null;

  return (
    <div className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden bg-gb-darkest">
      {/* Background image */}
      <div className="absolute inset-0">
        <Image
          src="/ui/title-bg.jpg"
          alt="Title background"
          fill
          className="object-cover opacity-60"
          style={{ imageRendering: "pixelated" }}
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-gb-darkest via-transparent to-gb-darkest/50" />
      </div>

      {/* Animated stars/particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute size-1 rounded-full bg-gb-lightest"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `twinkle ${2 + Math.random() * 3}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 2}s`,
            }}
          />
        ))}
      </div>

      {/* Main content */}
      <div
        className={cn(
          "relative z-10 flex flex-col items-center gap-8 transition-all duration-1000",
          mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        )}
      >
        {/* Logo */}
        <div className="relative">
          <Image
            src="/ui/title-logo.jpg"
            alt="DREAMLAND"
            width={320}
            height={80}
            className="drop-shadow-[0_0_20px_rgba(155,188,15,0.5)]"
            style={{ imageRendering: "pixelated" }}
            priority
          />
          
          {/* Subtitle */}
          <p
            className={cn(
              "mt-2 text-center font-pixel text-[10px] tracking-wider text-gb-light transition-opacity duration-1000",
              mounted ? "opacity-100" : "opacity-0"
            )}
            style={{ animationDelay: "0.5s" }}
          >
            A LIFE SIMULATOR
          </p>
        </div>

        {/* Menu options */}
        {showPressStart && (
          <div
            className={cn(
              "flex flex-col items-center gap-3 transition-all duration-500",
              showPressStart ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            )}
          >
            {options.map((option, index) => (
              <button
                key={option.label}
                onClick={() => handleSelect(index)}
                onMouseEnter={() => setSelectedOption(index)}
                className={cn(
                  "group relative flex items-center gap-3 px-6 py-2 font-pixel text-sm transition-all duration-200",
                  selectedOption === index
                    ? "text-gb-lightest scale-110"
                    : "text-gb-dark hover:text-gb-light"
                )}
                disabled={isTransitioning}
              >
                {/* Selection indicator */}
                <span
                  className={cn(
                    "absolute -left-4 font-pixel text-gb-lightest transition-opacity",
                    selectedOption === index ? "opacity-100 animate-blink" : "opacity-0"
                  )}
                >
                  {">"}
                </span>
                
                {option.label}
                
                {/* Selection indicator right */}
                <span
                  className={cn(
                    "absolute -right-4 font-pixel text-gb-lightest transition-opacity",
                    selectedOption === index ? "opacity-100 animate-blink" : "opacity-0"
                  )}
                >
                  {"<"}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Controls hint */}
        <div
          className={cn(
            "mt-8 flex flex-col items-center gap-1 font-pixel text-[8px] text-gb-dark transition-opacity duration-1000",
            showPressStart ? "opacity-100" : "opacity-0"
          )}
        >
          <p>USE ARROW KEYS OR CLICK</p>
          <p>PRESS ENTER TO SELECT</p>
        </div>
      </div>

      {/* Version info */}
      <div className="absolute bottom-4 left-4 font-pixel text-[8px] text-gb-dark">
        v2.0 MUSEUM EDITION
      </div>

      {/* Copyright */}
      <div className="absolute bottom-4 right-4 font-pixel text-[8px] text-gb-dark">
        STUDIO PYTHIA 2026
      </div>

      {/* Transition overlay */}
      {isTransitioning && (
        <div
          className="absolute inset-0 z-50 bg-gb-darkest transition-opacity duration-500"
          style={{
            animation: "fade-in 0.5s ease-out forwards",
          }}
        />
      )}

      {/* CRT overlay */}
      <CRTEffect intensity={0.3} />

      <style jsx>{`
        @keyframes twinkle {
          0%, 100% {
            opacity: 0.3;
            transform: scale(1);
          }
          50% {
            opacity: 1;
            transform: scale(1.5);
          }
        }
        
        @keyframes blink {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0;
          }
        }
        
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}

export default TitleScreen;
