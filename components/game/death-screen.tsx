"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "@/lib/game-store";
import { useAudioStore } from "@/lib/audio";
import { cn } from "@/lib/utils";

interface DeathScreenProps {
  onPlayAgain?: () => void;
}

export function DeathScreen({ onPlayAgain }: DeathScreenProps) {
  const router = useRouter();
  const epilogue = useGameStore((state) => state.epilogue);
  const age = useGameStore((state) => state.age);
  const dream = useGameStore((state) => state.dream);
  const gender = useGameStore((state) => state.gender);
  const resetGame = useGameStore((state) => state.resetGame);

  const { playSound } = useAudioStore();

  const [phase, setPhase] = useState<"dark" | "reveal" | "content">("dark");
  const [showParticles, setShowParticles] = useState(false);

  useEffect(() => {
    playSound("death");
    
    // Dramatic reveal sequence
    const t1 = setTimeout(() => {
      setPhase("reveal");
      setShowParticles(true);
    }, 800);
    const t2 = setTimeout(() => setPhase("content"), 2000);
    
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [playSound]);

  const handlePlayAgain = () => {
    playSound("select");
    resetGame();
    onPlayAgain?.();
  };

  const handleViewLeaderboard = () => {
    playSound("select");
    router.push("/leaderboard");
  };

  if (!epilogue) return null;

  // Life stage description
  const getLifeStage = (age: number) => {
    if (age < 13) return "child";
    if (age < 20) return "teenager";
    if (age < 40) return "adult";
    if (age < 65) return "middle-aged";
    return "elder";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-gb-darkest">
      {/* Animated background particles */}
      {showParticles && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(30)].map((_, i) => (
            <div
              key={i}
              className="death-particle"
              style={{
                left: `${10 + Math.random() * 80}%`,
                bottom: `${-10}%`,
                animationDelay: `${Math.random() * 4}s`,
                animationDuration: `${3 + Math.random() * 3}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Vignette overlay */}
      <div 
        className={cn(
          "absolute inset-0 pointer-events-none transition-opacity duration-2000",
          phase === "dark" ? "opacity-100" : "opacity-70"
        )}
        style={{
          background: 'radial-gradient(ellipse at center, transparent 20%, rgba(7, 31, 7, 0.9) 100%)',
        }}
      />

      {/* CRT scanlines */}
      <div className="absolute inset-0 pointer-events-none crt-scanlines opacity-50" />

      {/* Main content */}
      <div
        className={cn(
          "relative mx-4 max-h-[90vh] w-full max-w-xl overflow-y-auto px-4 py-8 transition-all duration-1000",
          phase === "dark" && "opacity-0 scale-90",
          phase === "reveal" && "opacity-100 scale-100",
          phase === "content" && "opacity-100 scale-100"
        )}
      >
        {/* Memorial header */}
        <div 
          className={cn(
            "mb-8 text-center transition-all duration-700 delay-300",
            phase !== "content" ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
          )}
        >
          {/* Cross symbol with glow */}
          <div 
            className="mb-4 text-5xl text-gb-light"
            style={{
              textShadow: '0 0 30px rgba(139, 172, 15, 0.8), 0 0 60px rgba(139, 172, 15, 0.4)',
            }}
          >
            ✝
          </div>
          
          <h1 
            className="font-pixel text-2xl tracking-wider text-gb-lightest"
            style={{
              textShadow: '0 0 20px rgba(155, 188, 15, 0.6)',
            }}
          >
            REST IN PEACE
          </h1>
          
          <p className="mt-3 font-pixel text-sm text-gb-light">
            A {getLifeStage(age)} who lived {age} {age === 1 ? "year" : "years"}
          </p>
        </div>

        {/* Memorial card */}
        <div
          className={cn(
            "memorial-card p-6 transition-all duration-700 delay-500",
            phase !== "content" ? "opacity-0 translate-y-8" : "opacity-100 translate-y-0"
          )}
        >
          {/* Inner decorative border */}
          <div className="absolute inset-3 border border-gb-dark/30 pointer-events-none" />
          
          {/* Death cause */}
          <div className="mb-5 pb-4 border-b border-gb-dark/50 relative">
            <h2 className="mb-2 font-pixel text-[9px] uppercase tracking-widest text-gb-dark">
              Cause of Death
            </h2>
            <p className="font-pixel text-xs leading-relaxed text-gb-light">
              {epilogue.death_cause}
            </p>
          </div>

          {/* Dream */}
          <div className="mb-5 pb-4 border-b border-gb-dark/50">
            <h2 className="mb-2 font-pixel text-[9px] uppercase tracking-widest text-gb-dark">
              Life&apos;s Dream
            </h2>
            <p className="font-pixel text-xs italic text-gb-light/80">
              &quot;{dream}&quot;
            </p>
          </div>

          {/* Achievements */}
          {epilogue.achievements && epilogue.achievements.length > 0 && (
            <div className="mb-5 pb-4 border-b border-gb-dark/50">
              <h2 className="mb-3 font-pixel text-[9px] uppercase tracking-widest text-gb-dark">
                Achievements
              </h2>
              <ul className="space-y-2">
                {epilogue.achievements.map((achievement, i) => (
                  <li 
                    key={i} 
                    className="flex items-start gap-2 font-pixel text-[10px] text-gb-light"
                    style={{
                      animation: `fade-in 0.5s ease-out forwards`,
                      animationDelay: `${0.8 + i * 0.15}s`,
                      opacity: 0,
                    }}
                  >
                    <span 
                      className="text-gb-glow"
                      style={{ textShadow: '0 0 8px rgba(197, 224, 99, 0.8)' }}
                    >
                      ★
                    </span>
                    {achievement}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Stat arcs */}
          {epilogue.stat_arcs && Object.keys(epilogue.stat_arcs).length > 0 && (
            <div className="mb-5 pb-4 border-b border-gb-dark/50">
              <h2 className="mb-3 font-pixel text-[9px] uppercase tracking-widest text-gb-dark">
                Life Journey
              </h2>
              <div className="space-y-2">
                {Object.entries(epilogue.stat_arcs).slice(0, 4).map(([stat, description]) => (
                  <div key={stat} className="font-pixel text-[10px]">
                    <span className="capitalize text-gb-light">{stat}:</span>{" "}
                    <span className="text-gb-dark">{description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Final verdict / Epitaph */}
          <div className="text-center pt-2">
            <h2 className="mb-3 font-pixel text-[9px] uppercase tracking-widest text-gb-dark">
              Epitaph
            </h2>
            <p 
              className="font-pixel text-sm italic leading-relaxed text-gb-lightest"
              style={{
                textShadow: '0 0 15px rgba(155, 188, 15, 0.4)',
              }}
            >
              &quot;{epilogue.verdict}&quot;
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div 
          className={cn(
            "mt-8 flex flex-col gap-3 transition-all duration-700 delay-700",
            phase !== "content" ? "opacity-0 translate-y-4" : "opacity-100 translate-y-0"
          )}
        >
          <button
            onClick={handlePlayAgain}
            className="btn-pixel w-full glow-pulse"
          >
            LIVE ANOTHER LIFE
          </button>

          <button
            onClick={handleViewLeaderboard}
            className="w-full p-3 font-pixel text-[10px] uppercase tracking-wider text-gb-light border-2 border-gb-dark bg-gb-darkest transition-all duration-200 hover:border-gb-light hover:bg-gb-dark hover:shadow-[0_0_20px_rgba(139,172,15,0.3)]"
          >
            View Leaderboard
          </button>

          <button
            onClick={() => {
              playSound("select");
              router.push("/lives");
            }}
            className="w-full p-3 font-pixel text-[10px] uppercase tracking-wider text-gb-dark border-2 border-gb-dark/50 bg-transparent transition-all duration-200 hover:border-gb-dark hover:text-gb-light"
          >
            Browse All Lives
          </button>
        </div>

        {/* Decorative footer */}
        <div 
          className={cn(
            "mt-8 text-center transition-all duration-700 delay-1000",
            phase !== "content" ? "opacity-0" : "opacity-100"
          )}
        >
          <div className="flex items-center justify-center gap-4">
            <div className="h-px w-12 bg-gradient-to-r from-transparent to-gb-dark/50" />
            <span className="font-pixel text-[8px] text-gb-dark/60">
              {gender === "male" ? "1" : "2"}926 - {new Date().getFullYear()}
            </span>
            <div className="h-px w-12 bg-gradient-to-l from-transparent to-gb-dark/50" />
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
