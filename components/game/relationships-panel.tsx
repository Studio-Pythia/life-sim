"use client";

import { useGameStore } from "@/lib/game-store";
import { RelationshipChip } from "./relationship-chip";
import { cn } from "@/lib/utils";

interface RelationshipsPanelProps {
  compact?: boolean;
  className?: string;
}

export function RelationshipsPanel({ compact = false, className }: RelationshipsPanelProps) {
  const relationships = useGameStore((state) => state.relationships);

  if (relationships.length === 0) return null;

  return (
    <div
      className={cn(
        "flex flex-wrap gap-1 border-2 border-gb-dark bg-gb-lightest/80 p-2",
        compact && "gap-0.5 p-1",
        className
      )}
    >
      <div className="w-full font-mono text-[8px] uppercase tracking-wider text-gb-dark">
        Relationships
      </div>
      {relationships.map((rel, i) => (
        <RelationshipChip key={`${rel.name}-${i}`} relationship={rel} compact={compact} />
      ))}
    </div>
  );
}
