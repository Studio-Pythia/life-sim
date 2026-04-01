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

const STAT_COLORS: Record<StatType, { gradient: string; glow: string }> = {
  money: { 
    gradient: "linear-gradient(90deg, #b8860b, #ffd700, #ffe44d)", 
    glow: "0 0 12px rgba(255, 215, 0, 0.6)" 
  },
  stability: { 
    gradient: "linear-gradient(90deg, #1976d2, #4fc3f7, #81d4fa)", 
    glow: "0 0 12px rgba(79, 195, 247, 0.6)" 
  },
  status: { 
    gradient: "linear-gradient(90deg, #7b1fa2, #e040fb, #ea80fc)", 
    glow: "0 0 12px rgba(224, 64, 251, 0.6)" 
  },
  health: { 
    gradient: "linear-gradient(90deg, #2e7d32, #66bb6a, #81c784)", 
    glow: "0 0 12px rgba(102, 187, 106, 0.6)" 
  },
  stress: { 
    gradient: "linear-gradient(90deg, #c62828, #ef5350, #e57373)", 
    glow: "0 0 12px rgba(239, 83, 80, 0.6)" 
  },
  freedom: { 
    gradient: "linear-gradient(90deg, #e65100, #ff9800, #ffb74d)", 
    glow: "0 0 12px rgba(255, 152, 0, 0.6)" 
  },
  exposure: { 
    gradient: "linear-gradient(90deg, #424242, #9e9e9e, #bdbdbd)", 
    glow: "0 0 12px rgba(158, 158, 158, 0.4)" 
  },
};

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
  const [showFlash, setShowFlash] = useState(false);

  const config = STAT_CONFIG[stat];
  const colors = STAT_COLORS[stat];
  const clampedValue = Math.max(0, Math.min(100, displayValue));

  useEffect(() => {
    if (previousValue !== undefined && previousValue !== value) {
      setIsAnimating(true);
      setChangeDirection(value > previousValue ? "up" : "down");
      setShowFlash(true);

      // Animate the value change
      const startValue = previousValue;
      const endValue = value;
      const duration = 600;
      const startTime = Date.now();

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);

        setDisplayValue(startValue + (endValue - startValue) * eased);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setIsAnimating(false);
          setTimeout(() => {
            setChangeDirection(null);
            setShowFlash(false);
          }, 400);
        }
      };

      requestAnimationFrame(animate);
    } else {
      setDisplayValue(value);
    }
  }, [value, previousValue]);

  // Warning state for dangerous values
  const isWarning = 
    (stat === "stress" && clampedValue >= 70) ||
    (stat === "exposure" && clampedValue >= 70) ||
    (stat === "health" && clampedValue <= 30);

  return (
    <div
      className={cn(
        "flex items-center gap-2 transition-all duration-200",
        compact ? "gap-1" : "gap-2",
        showFlash && changeDirection === "up" && "translate-x-0.5",
        showFlash && changeDirection === "down" && "-translate-x-0.5"
      )}
    >
      {showLabel && (
        <div
          className={cn(
            "flex items-center gap-1 font-pixel uppercase",
            compact ? "w-14 text-[7px]" : "w-16 text-[8px]"
          )}
        >
          <span 
            className={cn(
              "text-sm leading-none transition-transform duration-200",
              showFlash && "scale-125"
            )}
            style={{
              filter: isWarning ? 'drop-shadow(0 0 4px rgba(239, 83, 80, 0.8))' : undefined
            }}
          >
            {config.icon}
          </span>
          <span className="truncate text-gb-light/80">{config.label}</span>
        </div>
      )}

      <div className="relative flex-1">
        {/* Background track with depth */}
        <div
          className={cn(
            "stat-bar-container w-full",
            compact ? "h-3" : "h-4",
            isWarning && "warning-pulse"
          )}
        >
          {/* Filled portion with gradient */}
          <div
            className={cn(
              "stat-bar-fill h-full transition-all duration-300",
              isAnimating && "animate-pulse"
            )}
            style={{ 
              width: `${clampedValue}%`,
              background: colors.gradient,
              boxShadow: clampedValue > 10 ? colors.glow : 'none'
            }}
          />
        </div>

        {/* Change indicator with animation */}
        {changeDirection && (
          <div
            className={cn(
              "absolute -right-5 top-1/2 -translate-y-1/2 font-pixel text-[10px] font-bold",
              "transition-all duration-200",
              changeDirection === "up" 
                ? "text-green-400 animate-bounce" 
                : "text-red-400 animate-bounce"
            )}
            style={{
              textShadow: changeDirection === "up" 
                ? '0 0 8px rgba(74, 222, 128, 0.8)'
                : '0 0 8px rgba(248, 113, 113, 0.8)'
            }}
          >
            {changeDirection === "up" ? "+" : "-"}
          </div>
        )}
      </div>

      {/* Value display with glow on change */}
      <div
        className={cn(
          "w-7 text-right font-pixel text-gb-light",
          compact ? "text-[7px]" : "text-[8px]",
          showFlash && "brightness-150"
        )}
        style={{
          textShadow: showFlash ? '0 0 8px rgba(155, 188, 15, 0.8)' : undefined,
          transition: 'all 0.2s ease'
        }}
      >
        {Math.round(clampedValue)}
      </div>
    </div>
  );
}
