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
      // Clear canvas
      ctx.fillStyle = "#9bbc0f";
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
        ctx.globalAlpha = 0.15;
        switch (mood) {
          case "danger":
            ctx.fillStyle = "#8b0000";
            break;
          case "success":
            ctx.fillStyle = "#9bbc0f";
            break;
          case "sad":
            ctx.fillStyle = "#0f380f";
            break;
          case "happy":
            ctx.fillStyle = "#8bac0f";
            break;
        }
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1;
      }

      // Pixelate effect (optional, for extra retro feel)
      // This is a subtle effect that makes the scene feel more Game Boy-like
    };

    draw();
  }, [isLoaded, currentBg, mood]);

  return (
    <div className={cn("relative overflow-hidden", className)}>
      <canvas
        ref={canvasRef}
        width={480}
        height={320}
        className={cn(
          "h-full w-full object-cover transition-opacity duration-200",
          transitioning && "opacity-50"
        )}
        style={{
          imageRendering: "pixelated",
        }}
      />

      {/* Loading state */}
      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gb-lightest">
          <div className="animate-pulse font-mono text-sm text-gb-dark">Loading...</div>
        </div>
      )}
    </div>
  );
}
