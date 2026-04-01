"use client";

import { cn } from "@/lib/utils";
import type { Relationship } from "@/lib/types";

interface RelationshipChipProps {
  relationship: Relationship;
  compact?: boolean;
  className?: string;
}

export function RelationshipChip({
  relationship,
  compact = false,
  className,
}: RelationshipChipProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 border border-gb-dark bg-gb-lightest",
        compact ? "px-1 py-0.5" : "px-2 py-1",
        className
      )}
    >
      {/* Relationship type icon */}
      <span className={cn("text-sm", compact && "text-xs")}>
        {getRelationshipIcon(relationship.relation)}
      </span>

      {/* Name and relation */}
      <div className={cn("flex flex-col", compact && "flex-row gap-1")}>
        <span
          className={cn(
            "font-mono font-bold text-gb-darkest",
            compact ? "text-[8px]" : "text-[10px]"
          )}
        >
          {relationship.name}
        </span>
        {!compact && (
          <span className="font-mono text-[8px] uppercase text-gb-dark">
            {relationship.relation}
          </span>
        )}
      </div>
    </div>
  );
}

function getRelationshipIcon(relation: string): string {
  const lower = relation.toLowerCase();

  if (lower.includes("mother") || lower.includes("mom")) return "👩";
  if (lower.includes("father") || lower.includes("dad")) return "👨";
  if (lower.includes("sister")) return "👧";
  if (lower.includes("brother")) return "👦";
  if (lower.includes("friend")) return "🤝";
  if (lower.includes("partner") || lower.includes("spouse") || lower.includes("wife") || lower.includes("husband"))
    return "💑";
  if (lower.includes("boss") || lower.includes("manager")) return "👔";
  if (lower.includes("teacher") || lower.includes("professor")) return "📚";
  if (lower.includes("doctor")) return "⚕️";
  if (lower.includes("child") || lower.includes("son") || lower.includes("daughter")) return "👶";
  if (lower.includes("colleague") || lower.includes("coworker")) return "🏢";

  return "👤";
}
