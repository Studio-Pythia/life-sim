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
      if (displayedText.length % 3 === 0) {
        playSound("text");
      }
    }
    lastLength.current = displayedText.length;
  }, [displayedText, instant, playSound]);

  return (
    <div
      className={cn(
        "dialogue-box relative",
        "font-pixel text-sm leading-relaxed text-gb-lightest",
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
      {/* Decorative corner pieces */}
      <div className="absolute -left-1 -top-1 w-3 h-3 border-l-2 border-t-2 border-gb-glow opacity-60" />
      <div className="absolute -right-1 -top-1 w-3 h-3 border-r-2 border-t-2 border-gb-glow opacity-60" />
      <div className="absolute -bottom-1 -left-1 w-3 h-3 border-l-2 border-b-2 border-gb-glow opacity-60" />
      <div className="absolute -bottom-1 -right-1 w-3 h-3 border-r-2 border-b-2 border-gb-glow opacity-60" />

      {/* Text content */}
      <p className="min-h-[4em] relative z-10">
        {displayedText}
        {showCursor && !isComplete && (
          <span 
            className="cursor-blink ml-1"
            style={{ verticalAlign: 'middle' }}
          />
        )}
      </p>

      {/* Click to continue indicator */}
      {isComplete && (
        <div 
          className="absolute bottom-3 right-4 text-gb-light"
          style={{
            animation: 'float 1s ease-in-out infinite',
            textShadow: '0 0 10px rgba(139, 172, 15, 0.6)'
          }}
        >
          <span className="font-pixel text-xs">▼</span>
        </div>
      )}

      {/* Subtle inner glow */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-gb-light/5 via-transparent to-transparent" />
    </div>
  );
}
