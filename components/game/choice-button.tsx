"use client";

import { cn } from "@/lib/utils";
import { useAudioStore } from "@/lib/audio";
import { useState } from "react";

interface ChoiceButtonProps {
  label: string;
  index: number;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export function ChoiceButton({
  label,
  index,
  onClick,
  disabled = false,
  className,
}: ChoiceButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const { playSound } = useAudioStore();

  const handleClick = () => {
    if (disabled) return;
    playSound("select");
    onClick();
  };

  const handleMouseEnter = () => {
    if (!disabled) {
      setIsHovered(true);
      playSound("hover");
    }
  };

  return (
    <button
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setIsHovered(false)}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      disabled={disabled}
      className={cn(
        "group relative w-full text-left",
        "border-2 border-gb-dark bg-gb-lightest p-3",
        "font-mono text-xs leading-snug text-gb-darkest",
        "transition-all duration-100",
        "focus:outline-none focus:ring-2 focus:ring-gb-dark focus:ring-offset-2 focus:ring-offset-gb-lightest",
        isHovered && !disabled && "border-gb-darkest bg-gb-light",
        isPressed && !disabled && "translate-y-0.5 bg-gb-dark text-gb-lightest",
        disabled && "cursor-not-allowed opacity-50",
        className
      )}
    >
      {/* Choice number indicator */}
      <span
        className={cn(
          "mr-2 inline-flex size-5 items-center justify-center",
          "border border-gb-dark bg-gb-light text-[10px] font-bold",
          isPressed && !disabled && "border-gb-light bg-gb-darkest text-gb-light"
        )}
      >
        {index + 1}
      </span>

      {/* Choice text */}
      <span className="flex-1">{label}</span>

      {/* Selection arrow */}
      {isHovered && !disabled && (
        <span className="absolute right-3 top-1/2 -translate-y-1/2 animate-pulse text-gb-darkest">
          ◄
        </span>
      )}
    </button>
  );
}
