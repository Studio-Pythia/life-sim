"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface MilestonePopupProps {
  age: number;
  message: string;
  onDismiss: () => void;
}

const MILESTONE_CONFIG: Record<number, { title: string; symbol: string }> = {
  1: { title: "First Year", symbol: "I" },
  13: { title: "Coming of Age", symbol: "XIII" },
  18: { title: "Adulthood", symbol: "XVIII" },
  21: { title: "Full Maturity", symbol: "XXI" },
  30: { title: "Thirty Years", symbol: "XXX" },
  40: { title: "Midlife", symbol: "XL" },
  50: { title: "Half Century", symbol: "L" },
  65: { title: "Golden Years", symbol: "LXV" },
  75: { title: "Diamond Age", symbol: "LXXV" },
  100: { title: "Centenarian", symbol: "C" },
};

export function MilestonePopup({ age, message, onDismiss }: MilestonePopupProps) {
  const [visible, setVisible] = useState(false);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; delay: number }>>([]);

  const config = MILESTONE_CONFIG[age] || { title: `Age ${age}`, symbol: String(age) };

  useEffect(() => {
    // Generate particles
    setParticles(
      Array.from({ length: 30 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 1,
      }))
    );

    // Show animation
    const t1 = setTimeout(() => setVisible(true), 100);
    const t2 = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 500);
    }, 4000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center pointer-events-none">
      {/* Celebration particles */}
      <div className="absolute inset-0 overflow-hidden">
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute size-2 bg-[#8bac0f]"
            style={{
              left: `${p.x}%`,
              top: '-10%',
              opacity: 0.8,
              animation: `confetti 3s ease-out forwards`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>

      {/* Flash overlay */}
      <div 
        className={cn(
          "absolute inset-0 bg-[#9bbc0f] transition-opacity duration-300",
          visible ? "opacity-0" : "opacity-30"
        )}
      />

      {/* Content */}
      <div
        className={cn(
          "relative flex flex-col items-center transition-all duration-500",
          visible ? "opacity-100 scale-100" : "opacity-0 scale-75"
        )}
      >
        {/* Symbol with glow */}
        <div 
          className="font-pixel text-6xl md:text-7xl text-[#9bbc0f] mb-4"
          style={{
            textShadow: `
              0 0 20px rgba(155, 188, 15, 0.8),
              0 0 40px rgba(155, 188, 15, 0.6),
              0 0 60px rgba(155, 188, 15, 0.4)
            `,
          }}
        >
          {config.symbol}
        </div>

        {/* Title */}
        <h2 
          className="font-pixel text-xl md:text-2xl text-[#9bbc0f] mb-2"
          style={{
            textShadow: '0 0 20px rgba(155, 188, 15, 0.6)',
          }}
        >
          {config.title}
        </h2>

        {/* Message */}
        <p className="font-mono text-sm text-[#8bac0f] text-center max-w-xs">
          {message}
        </p>

        {/* Decorative lines */}
        <div className="flex items-center gap-4 mt-4">
          <div className="h-px w-16 bg-gradient-to-r from-transparent to-[#8bac0f]" />
          <div className="size-2 bg-[#8bac0f] rotate-45" />
          <div className="h-px w-16 bg-gradient-to-l from-transparent to-[#8bac0f]" />
        </div>
      </div>

      <style jsx>{`
        @keyframes confetti {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}

export function isMilestoneAge(age: number): boolean {
  return age in MILESTONE_CONFIG;
}

export function getMilestoneMessage(age: number): string {
  switch (age) {
    case 1: return "Your journey has just begun.";
    case 13: return "The world grows larger before you.";
    case 18: return "You step into adulthood.";
    case 21: return "Full independence awaits.";
    case 30: return "Wisdom begins to bloom.";
    case 40: return "The middle path unfolds.";
    case 50: return "Half a century of memories.";
    case 65: return "A life well-lived so far.";
    case 75: return "Few travel this far.";
    case 100: return "A century of existence. Legendary.";
    default: return `You have reached age ${age}.`;
  }
}
