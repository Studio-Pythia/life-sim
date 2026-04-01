"use client";

import { useEffect, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  type: "spark" | "dust" | "glow";
}

interface ParticlesProps {
  type: "death" | "close-call" | "achievement" | "stat-up" | "stat-down";
  x?: number;
  y?: number;
  active: boolean;
  onComplete?: () => void;
}

const particleConfigs = {
  death: {
    count: 30,
    colors: ["#0f380f", "#306230"],
    types: ["dust", "glow"] as const,
    gravity: 0.05,
    spread: 3,
    life: 80,
  },
  "close-call": {
    count: 20,
    colors: ["#9bbc0f", "#8bac0f"],
    types: ["spark"] as const,
    gravity: -0.02,
    spread: 4,
    life: 60,
  },
  achievement: {
    count: 25,
    colors: ["#9bbc0f", "#8bac0f", "#306230"],
    types: ["spark", "glow"] as const,
    gravity: -0.03,
    spread: 5,
    life: 70,
  },
  "stat-up": {
    count: 8,
    colors: ["#9bbc0f"],
    types: ["spark"] as const,
    gravity: -0.08,
    spread: 1,
    life: 40,
  },
  "stat-down": {
    count: 8,
    colors: ["#306230"],
    types: ["dust"] as const,
    gravity: 0.08,
    spread: 1,
    life: 40,
  },
};

export function Particles({ type, x = 50, y = 50, active, onComplete }: ParticlesProps) {
  const [particles, setParticles] = useState<Particle[]>([]);

  const createParticles = useCallback(() => {
    const config = particleConfigs[type];
    const newParticles: Particle[] = [];

    for (let i = 0; i < config.count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * config.spread;
      newParticles.push({
        id: Date.now() + i,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: config.life + Math.random() * 20,
        maxLife: config.life + Math.random() * 20,
        size: 2 + Math.random() * 4,
        type: config.types[Math.floor(Math.random() * config.types.length)],
      });
    }

    setParticles(newParticles);
  }, [type, x, y]);

  useEffect(() => {
    if (active) {
      createParticles();
    }
  }, [active, createParticles]);

  useEffect(() => {
    if (particles.length === 0) return;

    const config = particleConfigs[type];
    const interval = setInterval(() => {
      setParticles((prev) => {
        const next = prev
          .map((p) => ({
            ...p,
            x: p.x + p.vx,
            y: p.y + p.vy,
            vy: p.vy + config.gravity,
            life: p.life - 1,
          }))
          .filter((p) => p.life > 0);

        if (next.length === 0) {
          onComplete?.();
        }

        return next;
      });
    }, 16);

    return () => clearInterval(interval);
  }, [particles.length, type, onComplete]);

  const config = particleConfigs[type];

  return (
    <div className="pointer-events-none fixed inset-0 z-30 overflow-hidden">
      {particles.map((p) => {
        const opacity = p.life / p.maxLife;
        const color = config.colors[Math.floor(Math.random() * config.colors.length)];

        return (
          <div
            key={p.id}
            className={cn(
              "absolute",
              p.type === "spark" && "rounded-none",
              p.type === "dust" && "rounded-sm",
              p.type === "glow" && "rounded-full blur-[1px]"
            )}
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
              backgroundColor: color,
              opacity,
              transform: "translate(-50%, -50%)",
            }}
          />
        );
      })}
    </div>
  );
}
