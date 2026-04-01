"use client";

import { useEffect, useState } from "react";
import { useAudioStore } from "@/lib/audio";
import { Particles } from "@/components/effects/particles";
import { cn } from "@/lib/utils";

interface CloseCallOverlayProps {
  message: string;
  onComplete: () => void;
}

export function CloseCallOverlay({ message, onComplete }: CloseCallOverlayProps) {
  const [phase, setPhase] = useState<"flash" | "message" | "fade">("flash");
  const [showParticles, setShowParticles] = useState(true);
  const { playSound } = useAudioStore();

  useEffect(() => {
    playSound("closeCall");

    // Phase sequence
    const timer1 = setTimeout(() => setPhase("message"), 300);
    const timer2 = setTimeout(() => setPhase("fade"), 2500);
    const timer3 = setTimeout(onComplete, 3000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [onComplete, playSound]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-40 flex items-center justify-center transition-all duration-300",
        phase === "flash" && "bg-gb-darkest",
        phase === "message" && "bg-gb-darkest/90",
        phase === "fade" && "bg-transparent opacity-0"
      )}
    >
      {/* Warning particles */}
      <Particles
        type="close-call"
        x={50}
        y={50}
        active={showParticles}
        onComplete={() => setShowParticles(false)}
      />

      {/* Close call message */}
      <div
        className={cn(
          "max-w-md px-4 text-center transition-all duration-300",
          phase === "flash" && "scale-150 opacity-0",
          phase === "message" && "scale-100 opacity-100",
          phase === "fade" && "scale-95 opacity-0"
        )}
      >
        {/* Skull icon */}
        <div className="mb-4 animate-pulse text-6xl">💀</div>

        {/* Title */}
        <h2 className="mb-2 font-pixel text-xl text-gb-light">CLOSE CALL</h2>

        {/* Message */}
        <p className="font-mono text-sm text-gb-lightest">{message}</p>

        {/* Warning */}
        <p className="mt-4 font-mono text-xs text-gb-dark">
          You survived... this time.
        </p>
      </div>

      {/* Screen shake effect via CSS animation */}
      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-4px); }
          20%, 40%, 60%, 80% { transform: translateX(4px); }
        }
        div {
          animation: ${phase === "flash" ? "shake 0.3s ease-in-out" : "none"};
        }
      `}</style>
    </div>
  );
}
