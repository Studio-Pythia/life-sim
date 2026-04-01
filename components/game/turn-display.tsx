"use client";

import { useState, useCallback } from "react";
import { useGameStore } from "@/lib/game-store";
import { DialogueBox } from "./dialogue-box";
import { ChoiceButton } from "./choice-button";
import { cn } from "@/lib/utils";

interface TurnDisplayProps {
  className?: string;
}

export function TurnDisplay({ className }: TurnDisplayProps) {
  const currentTurn = useGameStore((state) => state.currentTurn);
  const isLoading = useGameStore((state) => state.isLoading);
  const makeChoice = useGameStore((state) => state.makeChoice);

  const [narrativeComplete, setNarrativeComplete] = useState(false);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);

  const handleNarrativeComplete = useCallback(() => {
    setNarrativeComplete(true);
  }, []);

  const handleChoice = useCallback(
    async (choiceIndex: number) => {
      if (isLoading || selectedChoice !== null) return;
      setSelectedChoice(choiceIndex);

      // Small delay for visual feedback
      await new Promise((resolve) => setTimeout(resolve, 300));

      await makeChoice(choiceIndex);

      // Reset for next turn
      setNarrativeComplete(false);
      setSelectedChoice(null);
    },
    [isLoading, selectedChoice, makeChoice]
  );

  if (!currentTurn) {
    return (
      <div className={cn("flex items-center justify-center", className)}>
        <div className="animate-pulse font-mono text-sm text-gb-dark">Loading your story...</div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Narrative text */}
      <DialogueBox
        text={currentTurn.narrative}
        onComplete={handleNarrativeComplete}
        speed={25}
      />

      {/* Choices */}
      <div
        className={cn(
          "flex flex-col gap-2 transition-opacity duration-300",
          narrativeComplete ? "opacity-100" : "pointer-events-none opacity-0"
        )}
      >
        {currentTurn.choices.map((choice, index) => (
          <ChoiceButton
            key={index}
            label={choice}
            index={index}
            onClick={() => handleChoice(index)}
            disabled={isLoading || selectedChoice !== null}
            className={cn(
              selectedChoice === index && "ring-2 ring-gb-darkest",
              selectedChoice !== null && selectedChoice !== index && "opacity-50"
            )}
          />
        ))}
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-2">
          <div className="size-2 animate-bounce bg-gb-dark" style={{ animationDelay: "0ms" }} />
          <div className="size-2 animate-bounce bg-gb-dark" style={{ animationDelay: "150ms" }} />
          <div className="size-2 animate-bounce bg-gb-dark" style={{ animationDelay: "300ms" }} />
        </div>
      )}
    </div>
  );
}
