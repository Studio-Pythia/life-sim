"use client";

import { useGameStore } from "@/lib/game-store";
import { useAudioStore } from "@/lib/audio";
import { cn } from "@/lib/utils";

interface GameHUDProps {
  className?: string;
}

export function GameHUD({ className }: GameHUDProps) {
  const age = useGameStore((state) => state.age);
  const dream = useGameStore((state) => state.dream);
  const closeCalls = useGameStore((state) => state.closeCalls);
  const crtEnabled = useGameStore((state) => state.crtEnabled);
  const toggleCRT = useGameStore((state) => state.toggleCRT);

  const { musicEnabled, soundEnabled, setMusicEnabled, setSoundEnabled, volume, setVolume } =
    useAudioStore();

  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      {/* Left side: Age and dream */}
      <div className="flex items-center gap-4">
        {/* Age display */}
        <div className="border-2 border-gb-dark bg-gb-lightest px-3 py-1">
          <span className="font-mono text-[10px] uppercase text-gb-dark">Age</span>
          <span className="ml-2 font-pixel text-lg text-gb-darkest">{age}</span>
        </div>

        {/* Close calls indicator */}
        {closeCalls > 0 && (
          <div className="flex items-center gap-1 border-2 border-gb-darkest bg-gb-dark px-2 py-1">
            <span className="text-sm">💀</span>
            <span className="font-mono text-xs text-gb-lightest">×{closeCalls}</span>
          </div>
        )}

        {/* Dream reminder */}
        <div className="hidden max-w-[200px] truncate font-mono text-[10px] text-gb-dark md:block">
          Dream: {dream}
        </div>
      </div>

      {/* Right side: Controls */}
      <div className="flex items-center gap-2">
        {/* Volume slider */}
        <div className="hidden items-center gap-1 md:flex">
          <span className="text-sm">🔊</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="h-1 w-16 cursor-pointer appearance-none bg-gb-dark"
          />
        </div>

        {/* Toggle buttons */}
        <button
          onClick={() => setMusicEnabled(!musicEnabled)}
          className={cn(
            "border border-gb-dark p-1 text-sm transition-colors",
            musicEnabled ? "bg-gb-light" : "bg-gb-lightest opacity-50"
          )}
          title={musicEnabled ? "Mute music" : "Enable music"}
        >
          🎵
        </button>

        <button
          onClick={() => setSoundEnabled(!soundEnabled)}
          className={cn(
            "border border-gb-dark p-1 text-sm transition-colors",
            soundEnabled ? "bg-gb-light" : "bg-gb-lightest opacity-50"
          )}
          title={soundEnabled ? "Mute sounds" : "Enable sounds"}
        >
          🔔
        </button>

        <button
          onClick={toggleCRT}
          className={cn(
            "border border-gb-dark p-1 text-sm transition-colors",
            crtEnabled ? "bg-gb-light" : "bg-gb-lightest opacity-50"
          )}
          title={crtEnabled ? "Disable CRT effect" : "Enable CRT effect"}
        >
          📺
        </button>
      </div>
    </div>
  );
}
