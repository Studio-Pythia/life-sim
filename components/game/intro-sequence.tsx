"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface IntroSequenceProps {
  city: string;
  dream: string;
  gender: "male" | "female";
  onComplete: () => void;
}

export function IntroSequence({ city, dream, gender, onComplete }: IntroSequenceProps) {
  const [phase, setPhase] = useState(0);
  const [textVisible, setTextVisible] = useState(false);

  useEffect(() => {
    const phases = [
      { delay: 500, action: () => setTextVisible(true) },
      { delay: 2500, action: () => setPhase(1) },
      { delay: 4500, action: () => setPhase(2) },
      { delay: 6500, action: () => setPhase(3) },
      { delay: 8000, action: () => onComplete() },
    ];

    const timeouts = phases.map(({ delay, action }) => setTimeout(action, delay));
    return () => timeouts.forEach(clearTimeout);
  }, [onComplete]);

  const messages = [
    { text: `A new soul enters the world...`, sub: city },
    { text: `With a dream in their heart...`, sub: `"${dream}"` },
    { text: `Their story begins now.`, sub: gender === "male" ? "A boy is born." : "A girl is born." },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0f380f] overflow-hidden">
      {/* Animated background rays */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div 
          className="absolute inset-0"
          style={{
            background: `
              repeating-conic-gradient(
                from 0deg at 50% 50%,
                transparent 0deg,
                rgba(139, 172, 15, 0.1) 1deg,
                transparent 2deg,
                transparent 30deg
              )
            `,
            animation: 'spin 60s linear infinite',
          }}
        />
      </div>

      {/* Particles floating up */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 40 }).map((_, i) => (
          <div
            key={i}
            className="absolute size-1 bg-[#8bac0f] rounded-full"
            style={{
              left: `${Math.random() * 100}%`,
              bottom: '-5%',
              opacity: 0.3 + Math.random() * 0.5,
              animation: `rise ${6 + Math.random() * 6}s ease-out infinite`,
              animationDelay: `${Math.random() * 4}s`,
            }}
          />
        ))}
      </div>

      {/* Vignette */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 30%, rgba(7, 31, 7, 0.8) 100%)',
        }}
      />

      {/* Content */}
      <div className="relative text-center px-8 max-w-xl">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "absolute inset-0 flex flex-col items-center justify-center transition-all duration-1000",
              phase === i && textVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"
            )}
          >
            <p 
              className="font-pixel text-lg md:text-xl text-[#9bbc0f] mb-4 tracking-wide"
              style={{
                textShadow: '0 0 30px rgba(155, 188, 15, 0.6)',
              }}
            >
              {msg.text}
            </p>
            <p 
              className="font-pixel text-sm md:text-base text-[#8bac0f] italic"
              style={{
                textShadow: '0 0 20px rgba(139, 172, 15, 0.4)',
              }}
            >
              {msg.sub}
            </p>
          </div>
        ))}

        {/* Progress dots */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-20 flex gap-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={cn(
                "size-2 rounded-full transition-all duration-500",
                phase >= i 
                  ? "bg-[#8bac0f] shadow-[0_0_10px_rgba(139,172,15,0.8)]" 
                  : "bg-[#306230]"
              )}
            />
          ))}
        </div>
      </div>

      <style jsx>{`
        @keyframes rise {
          0% {
            transform: translateY(0) translateX(0);
            opacity: 0;
          }
          10% {
            opacity: 0.6;
          }
          90% {
            opacity: 0.2;
          }
          100% {
            transform: translateY(-100vh) translateX(20px);
            opacity: 0;
          }
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
