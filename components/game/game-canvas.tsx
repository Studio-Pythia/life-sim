"use client";

import { useEffect, useRef, useState } from "react";
import { useGameStore } from "@/lib/game-store";
import { BACKGROUNDS, BACKGROUND_MAPPING } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface GameCanvasProps {
  className?: string;
}

export function GameCanvas({ className }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [currentBg, setCurrentBg] = useState<string>("nursery");
  const [transitioning, setTransitioning] = useState(false);

  const age = useGameStore((state) => state.age);
  const location = useGameStore((state) => state.currentTurn?.location);
  const mood = useGameStore((state) => state.mood);

  // Load and cache background images
  const imagesRef = useRef<Map<string, HTMLImageElement>>(new Map());

  useEffect(() => {
    const loadImages = async () => {
      const loadPromises = Object.entries(BACKGROUNDS).map(([key, path]) => {
        return new Promise<void>((resolve) => {
          const img = new Image();
          img.crossOrigin = "anonymous";
          img.onload = () => {
            imagesRef.current.set(key, img);
            resolve();
          };
          img.onerror = () => {
            console.warn(`Failed to load background: ${key}`);
            resolve();
          };
          img.src = path;
        });
      });

      await Promise.all(loadPromises);
      setIsLoaded(true);
    };

    loadImages();
  }, []);

  // Determine background based on location or age
  useEffect(() => {
    let targetBg = "park"; // Default fallback

    if (location) {
      // Check if location matches any mapping keywords
      const lowerLocation = location.toLowerCase();
      for (const [keywords, bg] of Object.entries(BACKGROUND_MAPPING)) {
        const keywordList = keywords.split(",");
        if (keywordList.some((kw) => lowerLocation.includes(kw.trim()))) {
          targetBg = bg;
          break;
        }
      }
    } else {
      // Age-based default backgrounds
      if (age <= 4) targetBg = "nursery";
      else if (age <= 12) targetBg = "classroom";
      else if (age <= 18) targetBg = "bedroom";
      else if (age <= 25) targetBg = "dorm";
      else if (age <= 60) targetBg = "office";
      else targetBg = "nice_home";
    }

    if (targetBg !== currentBg) {
      setTransitioning(true);
      setTimeout(() => {
        setCurrentBg(targetBg);
        setTransitioning(false);
      }, 200);
    }
  }, [location, age, currentBg]);

  // Draw the canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isLoaded) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      // Clear canvas with Game Boy darkest color
      ctx.fillStyle = "#0f380f";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw background image
      const bgImage = imagesRef.current.get(currentBg);
      if (bgImage) {
        // Calculate scaling to cover canvas while maintaining aspect ratio
        const scale = Math.max(
          canvas.width / bgImage.width,
          canvas.height / bgImage.height
        );
        const x = (canvas.width - bgImage.width * scale) / 2;
        const y = (canvas.height - bgImage.height * scale) / 2;

        ctx.drawImage(bgImage, x, y, bgImage.width * scale, bgImage.height * scale);
      }

      // Apply mood color overlay
      if (mood !== "neutral") {
        ctx.globalAlpha = 0.2;
        switch (mood) {
          case "danger":
            ctx.fillStyle = "#ff4444";
            break;
          case "success":
            ctx.fillStyle = "#44ff66";
            break;
          case "sad":
            ctx.fillStyle = "#4466ff";
            break;
          case "happy":
            ctx.fillStyle = "#ffff44";
            break;
        }
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
      }
    };

    draw();
  }, [isLoaded, currentBg, mood]);

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* Main canvas */}
      <canvas
        ref={canvasRef}
        width={480}
        height={320}
        className={cn(
          "h-full w-full object-cover transition-all duration-300",
          transitioning && "opacity-0 scale-105"
        )}
        style={{
          imageRendering: "pixelated",
        }}
      />

      {/* Ambient vignette overlay */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(15, 56, 15, 0.6) 100%)',
        }}
      />

      {/* Top gradient for UI readability */}
      <div 
        className="absolute top-0 inset-x-0 h-16 pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, rgba(15, 56, 15, 0.5) 0%, transparent 100%)',
        }}
      />

      {/* Bottom gradient for UI readability */}
      <div 
        className="absolute bottom-0 inset-x-0 h-20 pointer-events-none"
        style={{
          background: 'linear-gradient(0deg, rgba(15, 56, 15, 0.7) 0%, transparent 100%)',
        }}
      />

      {/* Corner decorations */}
      <div className="absolute top-2 left-2 w-4 h-4 border-l-2 border-t-2 border-gb-light/30" />
      <div className="absolute top-2 right-2 w-4 h-4 border-r-2 border-t-2 border-gb-light/30" />
      <div className="absolute bottom-2 left-2 w-4 h-4 border-l-2 border-b-2 border-gb-light/30" />
      <div className="absolute bottom-2 right-2 w-4 h-4 border-r-2 border-b-2 border-gb-light/30" />

      {/* Subtle scanline effect */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-30"
        style={{
          background: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)',
        }}
      />

      {/* Loading state */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gb-darkest">
          <div className="flex flex-col items-center gap-3">
            <div className="flex gap-2">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-3 h-3 bg-gb-light"
                  style={{
                    animation: 'float 0.6s ease-in-out infinite',
                    animationDelay: `${i * 0.15}s`,
                    boxShadow: '0 0 10px rgba(139, 172, 15, 0.6)',
                  }}
                />
              ))}
            </div>
            <p className="font-pixel text-[10px] text-gb-light">Loading world...</p>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}
