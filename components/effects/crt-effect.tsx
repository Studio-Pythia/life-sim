"use client";

import { useGameStore } from "@/lib/game-store";

export function CRTEffect() {
  const crtEnabled = useGameStore((state) => state.crtEnabled);

  if (!crtEnabled) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-50">
      {/* Scanlines */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(0,0,0,0.3) 1px, rgba(0,0,0,0.3) 2px)",
          backgroundSize: "100% 2px",
        }}
      />

      {/* Screen curvature vignette */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 0%, transparent 60%, rgba(0,0,0,0.4) 100%)",
        }}
      />

      {/* Slight color fringing on edges */}
      <div
        className="absolute inset-0 mix-blend-screen opacity-[0.02]"
        style={{
          background:
            "linear-gradient(90deg, rgba(255,0,0,0.1) 0%, transparent 3%, transparent 97%, rgba(0,255,255,0.1) 100%)",
        }}
      />

      {/* Subtle flicker animation */}
      <div className="absolute inset-0 animate-crt-flicker bg-white opacity-[0.01]" />
    </div>
  );
}
