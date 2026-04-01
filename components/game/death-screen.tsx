"use client";

import { useState, useEffect } from "react";
import { useGameStore } from "@/lib/game-store";
import { useAudioStore } from "@/lib/audio";
import { Particles } from "@/components/effects/particles";
import { cn } from "@/lib/utils";

interface DeathScreenProps {
  onPlayAgain?: () => void;
}

export function DeathScreen({ onPlayAgain }: DeathScreenProps) {
  const epilogue = useGameStore((state) => state.epilogue);
  const age = useGameStore((state) => state.age);
  const dream = useGameStore((state) => state.dream);
  const resetGame = useGameStore((state) => state.resetGame);

  const { playSound } = useAudioStore();

  const [showParticles, setShowParticles] = useState(true);
  const [fadeIn, setFadeIn] = useState(false);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    // Play death sound
    playSound("death");

    // Fade in sequence
    setTimeout(() => setFadeIn(true), 500);
    setTimeout(() => setShowContent(true), 1500);
  }, [playSound]);

  const handlePlayAgain = () => {
    playSound("select");
    resetGame();
    onPlayAgain?.();
  };

  if (!epilogue) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center bg-gb-darkest transition-opacity duration-1000",
        fadeIn ? "opacity-100" : "opacity-0"
      )}
    >
      {/* Death particles */}
      <Particles
        type="death"
        x={50}
        y={30}
        active={showParticles}
        onComplete={() => setShowParticles(false)}
      />

      <div
        className={cn(
          "mx-4 max-h-[90vh] w-full max-w-lg overflow-y-auto transition-all duration-700",
          showContent ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
        )}
      >
        {/* Memorial header */}
        <div className="mb-6 text-center">
          <div className="mb-2 text-4xl">✝</div>
          <h1 className="font-pixel text-xl text-gb-lightest">REST IN PEACE</h1>
          <p className="mt-2 font-mono text-sm text-gb-light">
            Lived {age} {age === 1 ? "year" : "years"}
          </p>
        </div>

        {/* Epilogue content */}
        <div className="border-4 border-gb-dark bg-gb-lightest p-6">
          {/* Death cause */}
          <div className="mb-4 border-b border-gb-dark pb-4">
            <h2 className="mb-2 font-mono text-xs uppercase text-gb-dark">Cause of Death</h2>
            <p className="font-mono text-sm text-gb-darkest">{epilogue.death_cause}</p>
          </div>

          {/* Dream */}
          <div className="mb-4 border-b border-gb-dark pb-4">
            <h2 className="mb-2 font-mono text-xs uppercase text-gb-dark">Life&apos;s Dream</h2>
            <p className="font-mono text-sm italic text-gb-darkest">&quot;{dream}&quot;</p>
          </div>

          {/* Achievements */}
          {epilogue.achievements && epilogue.achievements.length > 0 && (
            <div className="mb-4 border-b border-gb-dark pb-4">
              <h2 className="mb-2 font-mono text-xs uppercase text-gb-dark">Achievements</h2>
              <ul className="space-y-1">
                {epilogue.achievements.map((achievement, i) => (
                  <li key={i} className="flex items-start gap-2 font-mono text-xs text-gb-darkest">
                    <span className="text-gb-dark">★</span>
                    {achievement}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Stat arcs */}
          {epilogue.stat_arcs && (
            <div className="mb-4 border-b border-gb-dark pb-4">
              <h2 className="mb-2 font-mono text-xs uppercase text-gb-dark">Life Journey</h2>
              <div className="space-y-2">
                {Object.entries(epilogue.stat_arcs).map(([stat, description]) => (
                  <div key={stat} className="font-mono text-xs">
                    <span className="font-bold capitalize text-gb-dark">{stat}:</span>{" "}
                    <span className="text-gb-darkest">{description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Final verdict */}
          <div className="text-center">
            <h2 className="mb-2 font-mono text-xs uppercase text-gb-dark">Epitaph</h2>
            <p className="font-mono text-lg italic text-gb-darkest">
              &quot;{epilogue.verdict}&quot;
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={handlePlayAgain}
            className="w-full border-2 border-gb-light bg-gb-dark p-3 font-pixel text-sm text-gb-lightest transition-colors hover:bg-gb-light hover:text-gb-darkest"
          >
            LIVE ANOTHER LIFE
          </button>

          <a
            href="/leaderboard"
            className="block w-full border-2 border-gb-dark bg-gb-lightest p-3 text-center font-mono text-xs text-gb-darkest transition-colors hover:bg-gb-light"
          >
            View Leaderboard
          </a>
        </div>
      </div>
    </div>
  );
}
