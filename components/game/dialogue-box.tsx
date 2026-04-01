"use client";

import { useTypewriter } from "@/hooks/use-typewriter";
import { cn } from "@/lib/utils";
import { useAudioStore } from "@/lib/audio";
import { useEffect, useRef } from "react";

interface DialogueBoxProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
  className?: string;
  showCursor?: boolean;
  instant?: boolean;
}

export function DialogueBox({
  text,
  speed = 30,
  onComplete,
  className,
  showCursor = true,
  instant = false,
}: DialogueBoxProps) {
  const { displayedText, isComplete, skip } = useTypewriter({
    text,
    speed,
    onComplete,
    instant,
  });

  const { playSound } = useAudioStore();
  const lastLength = useRef(0);

  // Play typing sound effect
  useEffect(() => {
    if (displayedText.length > lastLength.current && !instant) {
      // Play sound every few characters to not be annoying
      if (displayedText.length % 3 === 0) {
        playSound("text");
      }
    }
    lastLength.current = displayedText.length;
  }, [displayedText, instant, playSound]);

  return (
    <div
      className={cn(
        "relative border-4 border-gb-dark bg-gb-lightest p-4",
        "font-mono text-sm leading-relaxed text-gb-darkest",
        "cursor-pointer select-none",
        className
      )}
      onClick={skip}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          skip();
        }
      }}
    >
      {/* Corner decorations */}
      <div className="absolute -left-1 -top-1 size-2 bg-gb-dark" />
      <div className="absolute -right-1 -top-1 size-2 bg-gb-dark" />
      <div className="absolute -bottom-1 -left-1 size-2 bg-gb-dark" />
      <div className="absolute -bottom-1 -right-1 size-2 bg-gb-dark" />

      {/* Text content */}
      <p className="min-h-[3em]">
        {displayedText}
        {showCursor && !isComplete && (
          <span className="animate-blink ml-0.5 inline-block h-4 w-2 bg-gb-darkest" />
        )}
      </p>

      {/* Click to continue indicator */}
      {isComplete && (
        <div className="absolute bottom-2 right-4 animate-bounce text-xs text-gb-dark">
          ▼
        </div>
      )}
    </div>
  );
}
