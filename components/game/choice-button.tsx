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
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      disabled={disabled}
      className={cn(
        "group relative w-full text-left overflow-hidden",
        "font-pixel text-[10px] leading-snug",
        "transition-all duration-150",
        "focus:outline-none",
        disabled && "cursor-not-allowed opacity-40",
        className
      )}
      style={{
        background: isPressed && !disabled
          ? 'linear-gradient(180deg, #306230 0%, #0f380f 100%)'
          : isHovered && !disabled
            ? 'linear-gradient(180deg, #8bac0f 0%, #306230 100%)'
            : 'linear-gradient(180deg, #306230 0%, #0f380f 100%)',
        border: '3px solid',
        borderColor: isHovered && !disabled ? '#9bbc0f' : '#8bac0f',
        color: isPressed && !disabled 
          ? '#9bbc0f' 
          : isHovered && !disabled 
            ? '#0f380f' 
            : '#9bbc0f',
        padding: '12px 16px',
        boxShadow: isPressed && !disabled
          ? 'inset 2px 2px 0 #071f07, 2px 2px 0 #071f07'
          : isHovered && !disabled
            ? '0 0 20px rgba(139, 172, 15, 0.5), 4px 4px 0 #071f07, inset 0 1px 0 rgba(197, 224, 99, 0.3)'
            : '4px 4px 0 #071f07, inset 0 1px 0 rgba(139, 172, 15, 0.2)',
        transform: isPressed && !disabled ? 'translate(2px, 2px)' : 'translate(0, 0)',
      }}
    >
      {/* Inner glow on hover */}
      {isHovered && !disabled && (
        <div 
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse at center, rgba(155, 188, 15, 0.2) 0%, transparent 70%)',
          }}
        />
      )}

      {/* Content wrapper */}
      <div className="relative flex items-center gap-3">
        {/* Choice number badge */}
        <span
          className="inline-flex items-center justify-center min-w-[24px] h-6 px-1"
          style={{
            background: isPressed && !disabled
              ? '#8bac0f'
              : isHovered && !disabled
                ? '#0f380f'
                : '#0f380f',
            border: '2px solid',
            borderColor: isHovered && !disabled ? '#0f380f' : '#8bac0f',
            color: isPressed && !disabled
              ? '#0f380f'
              : isHovered && !disabled
                ? '#9bbc0f'
                : '#8bac0f',
            boxShadow: 'inset 1px 1px 0 rgba(0,0,0,0.3)',
            fontSize: '10px',
          }}
        >
          {index + 1}
        </span>

        {/* Choice text */}
        <span className="flex-1">{label}</span>

        {/* Selection arrow */}
        <span
          className={cn(
            "text-sm transition-all duration-200",
            isHovered && !disabled 
              ? "opacity-100 translate-x-0" 
              : "opacity-0 -translate-x-2"
          )}
          style={{
            textShadow: isHovered ? '0 0 8px rgba(15, 56, 15, 0.8)' : 'none',
            animation: isHovered && !disabled ? 'blink 0.8s step-end infinite' : 'none',
          }}
        >
          {"◄"}
        </span>
      </div>

      {/* Keyboard hint */}
      <div
        className={cn(
          "absolute bottom-1 right-2 font-pixel text-[7px] transition-opacity duration-200",
          isHovered && !disabled ? "opacity-60" : "opacity-0"
        )}
      >
        Press {index + 1}
      </div>

      <style jsx>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </button>
  );
}
