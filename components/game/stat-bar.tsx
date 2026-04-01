"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { StatType } from "@/lib/types";
import { STAT_CONFIG } from "@/lib/constants";

interface StatBarProps {
  stat: StatType;
  value: number;
  previousValue?: number;
  showLabel?: boolean;
  compact?: boolean;
}

export function StatBar({
  stat,
  value,
  previousValue,
  showLabel = true,
  compact = false,
}: StatBarProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const [changeDirection, setChangeDirection] = useState<"up" | "down" | null>(null);

  const config = STAT_CONFIG[stat];
  const clampedValue = Math.max(0, Math.min(100, displayValue));

  useEffect(() => {
    if (previousValue !== undefined && previousValue !== value) {
      setIsAnimating(true);
      setChangeDirection(value > previousValue ? "up" : "down");

      // Animate the value change
      const startValue = previousValue;
      const endValue = value;
      const duration = 500;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // Ease out cubic

        setDisplayValue(startValue + (endValue - startValue) * eased);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setIsAnimating(false);
          setTimeout(() => setChangeDirection(null), 300);
        }
      };

      requestAnimationFrame(animate);
    } else {
      setDisplayValue(value);
    }
  }, [value, previousValue]);

  // Determine bar color based on stat type and value
  const getBarColor = () => {
    // High exposure or stress is bad
    if (stat === "exposure" || stat === "stress") {
      if (clampedValue >= 70) return "bg-gb-darkest";
      if (clampedValue >= 40) return "bg-gb-dark";
      return "bg-gb-light";
    }
    // Low health is bad
    if (stat === "health") {
      if (clampedValue <= 30) return "bg-gb-darkest";
      if (clampedValue <= 60) return "bg-gb-dark";
      return "bg-gb-light";
    }
    // Default: higher is better
    if (clampedValue >= 70) return "bg-gb-light";
    if (clampedValue >= 40) return "bg-gb-dark";
    return "bg-gb-darkest";
  };

  return (
    <div
      className={cn(
        "flex items-center gap-2",
        compact ? "gap-1" : "gap-2"
      )}
    >
      {showLabel && (
        <div
          className={cn(
            "flex items-center gap-1 font-mono uppercase",
            compact ? "w-16 text-[8px]" : "w-20 text-[10px]"
          )}
        >
          <span className="text-base leading-none">{config.icon}</span>
          <span className="truncate text-gb-dark">{config.label}</span>
        </div>
      )}

      <div className="relative flex-1">
        {/* Background track */}
        <div
          className={cn(
            "w-full border-2 border-gb-dark bg-gb-lightest",
            compact ? "h-2" : "h-3"
          )}
        >
          {/* Filled portion */}
          <div
            className={cn(
              "h-full transition-all duration-300",
              getBarColor(),
              isAnimating && "animate-pulse"
            )}
            style={{ width: `${clampedValue}%` }}
          />
        </div>

        {/* Change indicator */}
        {changeDirection && (
          <div
            className={cn(
              "absolute -right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold transition-opacity",
              changeDirection === "up" ? "text-gb-light" : "text-gb-darkest"
            )}
          >
            {changeDirection === "up" ? "▲" : "▼"}
          </div>
        )}
      </div>

      {/* Value display */}
      <div
        className={cn(
          "w-8 text-right font-mono text-gb-dark",
          compact ? "text-[8px]" : "text-[10px]"
        )}
      >
        {Math.round(clampedValue)}
      </div>
    </div>
  );
}
