"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getSpriteForAge } from "@/lib/sprites";
import { cn } from "@/lib/utils";

interface CharacterDisplayProps {
  gender: "male" | "female";
  age: number;
  className?: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  animate?: boolean;
}

export function CharacterDisplay({
  gender,
  age,
  className,
  size = "md",
  showLabel = false,
  animate = true,
}: CharacterDisplayProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [prevAge, setPrevAge] = useState(age);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const sprite = getSpriteForAge(gender, age);

  // Handle age transitions
  useEffect(() => {
    if (age !== prevAge) {
      const prevSprite = getSpriteForAge(gender, prevAge);
      if (prevSprite.path !== sprite.path) {
        // Sprite changed - trigger transition
        setIsTransitioning(true);
        setTimeout(() => {
          setPrevAge(age);
          setIsTransitioning(false);
        }, 300);
      } else {
        setPrevAge(age);
      }
    }
  }, [age, prevAge, gender, sprite.path]);

  // Initial mount animation
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const sizeClasses = {
    sm: "size-16",
    md: "size-24",
    lg: "size-32",
  };

  const labelSizeClasses = {
    sm: "text-[6px]",
    md: "text-[8px]",
    lg: "text-xs",
  };

  return (
    <div
      className={cn(
        "relative flex flex-col items-center gap-1",
        className
      )}
    >
      {/* Character sprite container */}
      <div
        className={cn(
          "relative overflow-hidden rounded-sm border-2 border-gb-dark bg-gb-darkest",
          sizeClasses[size],
          "transition-all duration-300",
          isVisible ? "opacity-100 scale-100" : "opacity-0 scale-90",
          isTransitioning && "animate-pulse",
          animate && "hover:scale-105"
        )}
        style={{
          imageRendering: "pixelated",
        }}
      >
        {/* Sprite image */}
        <Image
          src={sprite.path}
          alt={`${sprite.label} character`}
          fill
          className={cn(
            "object-cover transition-opacity duration-300",
            isTransitioning ? "opacity-50" : "opacity-100"
          )}
          style={{
            imageRendering: "pixelated",
          }}
        />

        {/* Idle animation overlay */}
        {animate && (
          <div
            className="absolute inset-0"
            style={{
              animation: "character-idle 2s ease-in-out infinite",
            }}
          />
        )}

        {/* Border glow effect */}
        <div
          className="pointer-events-none absolute inset-0 rounded-sm"
          style={{
            boxShadow: "inset 0 0 10px rgba(155, 188, 15, 0.2)",
          }}
        />
      </div>

      {/* Life stage label */}
      {showLabel && (
        <span
          className={cn(
            "font-pixel text-gb-light transition-opacity duration-300",
            labelSizeClasses[size],
            isVisible ? "opacity-100" : "opacity-0"
          )}
        >
          {sprite.label}
        </span>
      )}

      {/* Age indicator */}
      <div
        className={cn(
          "absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full border border-gb-dark bg-gb-darkest font-pixel text-[8px] text-gb-lightest",
          size === "sm" && "size-4 text-[6px]",
          size === "lg" && "size-8 text-[10px]"
        )}
      >
        {age}
      </div>

      <style jsx>{`
        @keyframes character-idle {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-2px);
          }
        }
      `}</style>
    </div>
  );
}

export default CharacterDisplay;
