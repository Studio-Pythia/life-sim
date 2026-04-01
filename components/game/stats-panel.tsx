"use client";

import { useGameStore } from "@/lib/game-store";
import { StatBar } from "./stat-bar";
import type { StatType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface StatsPanelProps {
  compact?: boolean;
  className?: string;
}

const STAT_ORDER: StatType[] = [
  "money",
  "stability",
  "status",
  "health",
  "stress",
  "freedom",
  "exposure",
];

export function StatsPanel({ compact = false, className }: StatsPanelProps) {
  const stats = useGameStore((state) => state.stats);
  const previousStats = useGameStore((state) => state.previousStats);

  return (
    <div
      className={cn(
        "flex flex-col gap-1 border-2 border-gb-dark bg-gb-lightest/80 p-2",
        compact && "gap-0.5 p-1",
        className
      )}
    >
      {STAT_ORDER.map((stat) => (
        <StatBar
          key={stat}
          stat={stat}
          value={stats[stat]}
          previousValue={previousStats?.[stat]}
          compact={compact}
        />
      ))}
    </div>
  );
}
