"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface TitleScreenProps {
  onStart: () => void;
  onLeaderboard: () => void;
}

export function TitleScreen({ onStart, onLeaderboard }: TitleScreenProps) {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<"loading" | "reveal" | "ready">("loading");
  const [selectedOption, setSelectedOption] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const options = [
    { label: "NEW LIFE", action: onStart, description: "Begin your journey" },
    { label: "HALL OF LIVES", action: onLeaderboard, description: "View past lives" },
  ];

  useEffect(() => {
    setMounted(true);
    // Dramatic intro sequence
    const t1 = setTimeout(() => setPhase("reveal"), 500);
    const t2 = setTimeout(() => setPhase("ready"), 2000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTransitioning || phase !== "ready") return;

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
  }, [selectedOption, isTransitioning, phase, options.length]);

  const handleSelect = useCallback((index: number) => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setTimeout(() => {
      options[index].action();
    }, 600);
  }, [isTransitioning, options]);

  if (!mounted) return null;

  return (
    <div className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden bg-gb-darkest">
      {/* Animated background */}
      <div className="absolute inset-0">
        <Image
          src="/ui/title-bg.jpg"
          alt=""
          fill
          className={cn(
            "object-cover transition-all duration-1000",
            phase === "loading" ? "opacity-0 scale-110" : "opacity-70 scale-100"
          )}
          style={{ imageRendering: "pixelated" }}
          priority
        />
        {/* Gradient overlays for depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-gb-darkest via-transparent to-gb-darkest/80" />
        <div className="absolute inset-0 bg-gradient-to-r from-gb-darkest/50 via-transparent to-gb-darkest/50" />
      </div>

      {/* Animated stars/particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(40)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-gb-lightest"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              width: `${2 + Math.random() * 3}px`,
              height: `${2 + Math.random() * 3}px`,
              animation: `twinkle ${2 + Math.random() * 4}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 3}s`,
              boxShadow: '0 0 6px rgba(155, 188, 15, 0.8)',
            }}
          />
        ))}
      </div>

      {/* Floating particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(15)].map((_, i) => (
          <div
            key={`float-${i}`}
            className="absolute w-1 h-1 bg-gb-light rounded-full opacity-40"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float ${4 + Math.random() * 4}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 4}s`,
            }}
          />
        ))}
      </div>

      {/* CRT vignette */}
      <div className="absolute inset-0 pointer-events-none crt-vignette" />

      {/* Scanlines */}
      <div className="absolute inset-0 pointer-events-none crt-scanlines" />

      {/* Main content */}
      <div className="relative z-10 flex flex-col items-center gap-8 px-4">
        {/* Logo with dramatic reveal */}
        <div
          className={cn(
            "relative transition-all duration-1000",
            phase === "loading" && "opacity-0 scale-75 blur-sm",
            phase === "reveal" && "opacity-100 scale-100 blur-0",
            phase === "ready" && "opacity-100 scale-100"
          )}
        >
          {/* Glow behind logo */}
          <div className="absolute inset-0 blur-3xl opacity-50">
            <div className="w-full h-full bg-gb-light rounded-full" />
          </div>
          
          <Image
            src="/ui/title-logo.jpg"
            alt="DREAMLAND"
            width={400}
            height={100}
            className="relative drop-shadow-[0_0_40px_rgba(155,188,15,0.6)]"
            style={{ imageRendering: "pixelated" }}
            priority
          />
          
          {/* Subtitle */}
          <p
            className={cn(
              "mt-4 text-center font-pixel text-[10px] tracking-[0.3em] text-gb-light transition-all duration-700 delay-500",
              phase !== "ready" ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
            )}
          >
            A LIFE SIMULATOR
          </p>
        </div>

        {/* Decorative line */}
        <div
          className={cn(
            "w-64 h-[2px] bg-gradient-to-r from-transparent via-gb-light to-transparent transition-all duration-700 delay-700",
            phase !== "ready" ? "opacity-0 scale-x-0" : "opacity-100 scale-x-100"
          )}
        />

        {/* Menu options */}
        <div
          className={cn(
            "flex flex-col items-center gap-4 transition-all duration-700 delay-1000",
            phase !== "ready" ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
          )}
        >
          {options.map((option, index) => (
            <button
              key={option.label}
              onClick={() => handleSelect(index)}
              onMouseEnter={() => setSelectedOption(index)}
              disabled={isTransitioning || phase !== "ready"}
              className={cn(
                "group relative flex flex-col items-center gap-1 px-8 py-3 transition-all duration-200",
                selectedOption === index && "scale-105"
              )}
            >
              {/* Selection glow background */}
              <div
                className={cn(
                  "absolute inset-0 rounded transition-all duration-300",
                  selectedOption === index
                    ? "bg-gb-dark/50 shadow-[0_0_30px_rgba(139,172,15,0.4)]"
                    : "bg-transparent"
                )}
              />
              
              {/* Selection indicators */}
              <div className="absolute inset-y-0 -left-8 flex items-center">
                <span
                  className={cn(
                    "font-pixel text-lg text-gb-lightest transition-all duration-200",
                    selectedOption === index 
                      ? "opacity-100 translate-x-0" 
                      : "opacity-0 -translate-x-2"
                  )}
                  style={{ 
                    textShadow: '0 0 10px rgba(155, 188, 15, 0.8)',
                    animation: selectedOption === index ? 'blink 0.8s step-end infinite' : 'none'
                  }}
                >
                  {">"}
                </span>
              </div>
              
              <div className="absolute inset-y-0 -right-8 flex items-center">
                <span
                  className={cn(
                    "font-pixel text-lg text-gb-lightest transition-all duration-200",
                    selectedOption === index 
                      ? "opacity-100 translate-x-0" 
                      : "opacity-0 translate-x-2"
                  )}
                  style={{ 
                    textShadow: '0 0 10px rgba(155, 188, 15, 0.8)',
                    animation: selectedOption === index ? 'blink 0.8s step-end infinite' : 'none'
                  }}
                >
                  {"<"}
                </span>
              </div>

              {/* Label */}
              <span
                className={cn(
                  "relative font-pixel text-sm tracking-wider transition-all duration-200",
                  selectedOption === index
                    ? "text-gb-lightest"
                    : "text-gb-dark"
                )}
                style={{
                  textShadow: selectedOption === index 
                    ? '0 0 20px rgba(155, 188, 15, 0.8)' 
                    : 'none'
                }}
              >
                {option.label}
              </span>
              
              {/* Description */}
              <span
                className={cn(
                  "relative font-pixel text-[8px] tracking-wide transition-all duration-200",
                  selectedOption === index
                    ? "text-gb-light opacity-100"
                    : "text-gb-dark opacity-0"
                )}
              >
                {option.description}
              </span>
            </button>
          ))}
        </div>

        {/* Controls hint */}
        <div
          className={cn(
            "mt-8 flex flex-col items-center gap-2 transition-all duration-700 delay-1200",
            phase !== "ready" ? "opacity-0" : "opacity-100"
          )}
        >
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <kbd className="px-2 py-1 border border-gb-dark bg-gb-darkest font-pixel text-[8px] text-gb-light">
                W
              </kbd>
              <kbd className="px-2 py-1 border border-gb-dark bg-gb-darkest font-pixel text-[8px] text-gb-light">
                S
              </kbd>
            </div>
            <span className="font-pixel text-[8px] text-gb-dark">or</span>
            <div className="flex items-center gap-1">
              <kbd className="px-2 py-1 border border-gb-dark bg-gb-darkest font-pixel text-[8px] text-gb-light">
                ↑
              </kbd>
              <kbd className="px-2 py-1 border border-gb-dark bg-gb-darkest font-pixel text-[8px] text-gb-light">
                ↓
              </kbd>
            </div>
          </div>
          <p className="font-pixel text-[8px] text-gb-dark tracking-wider">
            PRESS ENTER TO SELECT
          </p>
        </div>
      </div>

      {/* Version & Copyright */}
      <div className="absolute bottom-4 left-4 font-pixel text-[8px] text-gb-dark/60">
        v2.0 MUSEUM EDITION
      </div>
      <div className="absolute bottom-4 right-4 font-pixel text-[8px] text-gb-dark/60">
        STUDIO PYTHIA 2026
      </div>

      {/* Transition overlay */}
      <div
        className={cn(
          "absolute inset-0 z-50 bg-gb-darkest pointer-events-none transition-opacity duration-500",
          isTransitioning ? "opacity-100" : "opacity-0"
        )}
      />

      {/* Loading state */}
      {phase === "loading" && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-gb-darkest">
          <div className="flex gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-3 h-3 bg-gb-light"
                style={{
                  animation: 'float 0.6s ease-in-out infinite',
                  animationDelay: `${i * 0.15}s`,
                  boxShadow: '0 0 10px rgba(139, 172, 15, 0.6)'
                }}
              />
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes twinkle {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.3); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}

export default TitleScreen;
