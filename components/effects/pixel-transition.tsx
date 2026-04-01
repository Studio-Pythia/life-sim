"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface PixelTransitionProps {
  isTransitioning: boolean;
  onComplete?: () => void;
  type?: "dissolve" | "wipe" | "fade";
}

export function PixelTransition({
  isTransitioning,
  onComplete,
  type = "dissolve",
}: PixelTransitionProps) {
  const [phase, setPhase] = useState<"idle" | "out" | "in">("idle");
  const [pixels, setPixels] = useState<boolean[]>([]);

  useEffect(() => {
    if (isTransitioning && phase === "idle") {
      setPhase("out");

      // Generate random pixel order for dissolve effect
      if (type === "dissolve") {
        const totalPixels = 20 * 15; // Grid size
        const order = Array.from({ length: totalPixels }, (_, i) => i);
        // Shuffle
        for (let i = order.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [order[i], order[j]] = [order[j], order[i]];
        }
        setPixels(new Array(totalPixels).fill(false));

        // Animate pixels appearing
        order.forEach((pixelIndex, i) => {
          setTimeout(() => {
            setPixels((prev) => {
              const next = [...prev];
              next[pixelIndex] = true;
              return next;
            });
          }, i * 3);
        });
      }

      // Transition timing
      setTimeout(() => {
        setPhase("in");
        setTimeout(() => {
          setPhase("idle");
          setPixels([]);
          onComplete?.();
        }, 400);
      }, 400);
    }
  }, [isTransitioning, phase, type, onComplete]);

  if (phase === "idle") return null;

  if (type === "dissolve") {
    return (
      <div className="pointer-events-none fixed inset-0 z-40 grid grid-cols-[repeat(20,1fr)] grid-rows-[repeat(15,1fr)]">
        {pixels.map((visible, i) => (
          <div
            key={i}
            className={cn(
              "bg-gb-darkest transition-opacity duration-100",
              visible ? "opacity-100" : "opacity-0"
            )}
          />
        ))}
      </div>
    );
  }

  if (type === "wipe") {
    return (
      <div
        className={cn(
          "pointer-events-none fixed inset-0 z-40 bg-gb-darkest transition-transform duration-400 ease-in-out",
          phase === "out" ? "translate-x-0" : "translate-x-full"
        )}
        style={{
          transformOrigin: "left",
        }}
      />
    );
  }

  // Fade
  return (
    <div
      className={cn(
        "pointer-events-none fixed inset-0 z-40 bg-gb-darkest transition-opacity duration-300",
        phase === "out" ? "opacity-100" : "opacity-0"
      )}
    />
  );
}
