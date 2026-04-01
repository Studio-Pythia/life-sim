"use client";

import { useEffect, useState, useMemo } from "react";

interface AtmosphereParticle {
  id: number;
  x: number;
  y: number;
  size: number;
  opacity: number;
  speed: number;
  delay: number;
  type: "dust" | "sparkle" | "float" | "rain" | "snow";
}

interface SceneAtmosphereProps {
  location: string;
  mood?: "neutral" | "danger" | "success" | "sad" | "happy";
  intensity?: number;
}

// Location-based atmosphere configuration
const ATMOSPHERE_CONFIG: Record<string, { 
  particles: AtmosphereParticle["type"][]; 
  density: number;
  ambientAnimation?: string;
}> = {
  nursery: { particles: ["dust", "sparkle"], density: 8, ambientAnimation: "gentle-glow" },
  kitchen: { particles: ["dust"], density: 5, ambientAnimation: "warm-flicker" },
  classroom: { particles: ["dust", "float"], density: 6 },
  bedroom: { particles: ["dust"], density: 4 },
  dorm: { particles: ["dust"], density: 5 },
  office: { particles: ["dust", "float"], density: 4, ambientAnimation: "fluorescent" },
  nice_home: { particles: ["sparkle", "dust"], density: 10, ambientAnimation: "gentle-glow" },
  rundown: { particles: ["dust"], density: 12 },
  prison: { particles: ["dust"], density: 3 },
  hospital: { particles: ["dust", "sparkle"], density: 4, ambientAnimation: "monitor-blink" },
  bar: { particles: ["dust", "sparkle"], density: 8, ambientAnimation: "neon-flicker" },
  park: { particles: ["float", "sparkle"], density: 15, ambientAnimation: "leaves" },
};

function generateParticles(
  types: AtmosphereParticle["type"][],
  count: number
): AtmosphereParticle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 2 + Math.random() * 4,
    opacity: 0.2 + Math.random() * 0.4,
    speed: 10 + Math.random() * 20,
    delay: Math.random() * 10,
    type: types[Math.floor(Math.random() * types.length)],
  }));
}

export function SceneAtmosphere({ 
  location, 
  mood = "neutral",
  intensity = 1 
}: SceneAtmosphereProps) {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const config = ATMOSPHERE_CONFIG[location] || ATMOSPHERE_CONFIG.bedroom;
  
  const particles = useMemo(() => {
    return generateParticles(
      config.particles, 
      Math.floor(config.density * intensity)
    );
  }, [config.particles, config.density, intensity]);

  if (!mounted) return null;

  const moodOverlay = {
    neutral: "bg-transparent",
    danger: "bg-red-900/10",
    success: "bg-green-400/5",
    sad: "bg-blue-900/10",
    happy: "bg-yellow-400/5",
  };

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Mood overlay */}
      <div 
        className={`absolute inset-0 transition-colors duration-1000 ${moodOverlay[mood]}`} 
      />
      
      {/* Floating particles */}
      {particles.map((particle) => (
        <div
          key={particle.id}
          className="absolute rounded-full"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: `${particle.size}px`,
            height: `${particle.size}px`,
            opacity: particle.opacity,
            backgroundColor: particle.type === "sparkle" 
              ? "#9bbc0f" 
              : particle.type === "rain" 
              ? "#8bac0f"
              : "#306230",
            animation: getParticleAnimation(particle),
            animationDelay: `${particle.delay}s`,
          }}
        />
      ))}

      {/* Ambient lighting effects */}
      {config.ambientAnimation === "gentle-glow" && (
        <div 
          className="absolute inset-0 animate-pulse"
          style={{
            background: "radial-gradient(ellipse at 70% 30%, rgba(155, 188, 15, 0.05) 0%, transparent 50%)",
            animationDuration: "4s",
          }}
        />
      )}
      
      {config.ambientAnimation === "warm-flicker" && (
        <div 
          className="absolute inset-0"
          style={{
            background: "radial-gradient(ellipse at 30% 80%, rgba(139, 172, 15, 0.08) 0%, transparent 40%)",
            animation: "flicker 3s ease-in-out infinite",
          }}
        />
      )}
      
      {config.ambientAnimation === "fluorescent" && (
        <div 
          className="absolute inset-0"
          style={{
            background: "linear-gradient(180deg, rgba(155, 188, 15, 0.03) 0%, transparent 20%)",
            animation: "fluorescent-hum 0.1s linear infinite",
          }}
        />
      )}
      
      {config.ambientAnimation === "neon-flicker" && (
        <>
          <div 
            className="absolute right-4 top-4 size-3 rounded-full"
            style={{
              backgroundColor: "#9bbc0f",
              boxShadow: "0 0 10px #9bbc0f, 0 0 20px #8bac0f",
              animation: "neon-flicker 2s ease-in-out infinite",
            }}
          />
          <div 
            className="absolute left-8 top-8 size-2 rounded-full"
            style={{
              backgroundColor: "#8bac0f",
              boxShadow: "0 0 8px #8bac0f",
              animation: "neon-flicker 3s ease-in-out infinite",
              animationDelay: "1s",
            }}
          />
        </>
      )}
      
      {config.ambientAnimation === "monitor-blink" && (
        <div 
          className="absolute right-8 top-12 size-2 rounded-full"
          style={{
            backgroundColor: "#9bbc0f",
            animation: "monitor-blink 1s step-end infinite",
          }}
        />
      )}
      
      {config.ambientAnimation === "leaves" && (
        <>
          {[...Array(5)].map((_, i) => (
            <div
              key={`leaf-${i}`}
              className="absolute size-2"
              style={{
                left: `${20 + i * 15}%`,
                top: "-10px",
                backgroundColor: "#306230",
                borderRadius: "50% 0",
                transform: "rotate(45deg)",
                animation: `fall ${8 + i * 2}s linear infinite`,
                animationDelay: `${i * 2}s`,
              }}
            />
          ))}
        </>
      )}

      {/* Vignette effect */}
      <div 
        className="absolute inset-0"
        style={{
          boxShadow: "inset 0 0 100px rgba(15, 56, 15, 0.5)",
          pointerEvents: "none",
        }}
      />

      <style jsx>{`
        @keyframes float-up {
          0% {
            transform: translateY(0) translateX(0);
            opacity: 0;
          }
          10% {
            opacity: var(--particle-opacity, 0.3);
          }
          90% {
            opacity: var(--particle-opacity, 0.3);
          }
          100% {
            transform: translateY(-100vh) translateX(20px);
            opacity: 0;
          }
        }
        
        @keyframes drift {
          0%, 100% {
            transform: translateX(0) translateY(0);
          }
          25% {
            transform: translateX(10px) translateY(-5px);
          }
          50% {
            transform: translateX(5px) translateY(5px);
          }
          75% {
            transform: translateX(-5px) translateY(-3px);
          }
        }
        
        @keyframes sparkle {
          0%, 100% {
            opacity: 0.2;
            transform: scale(1);
          }
          50% {
            opacity: 0.6;
            transform: scale(1.2);
          }
        }
        
        @keyframes fall {
          0% {
            transform: translateY(-20px) translateX(0) rotate(0deg);
            opacity: 0;
          }
          10% {
            opacity: 0.6;
          }
          90% {
            opacity: 0.6;
          }
          100% {
            transform: translateY(100vh) translateX(30px) rotate(360deg);
            opacity: 0;
          }
        }
        
        @keyframes flicker {
          0%, 100% { opacity: 0.08; }
          50% { opacity: 0.12; }
          75% { opacity: 0.06; }
        }
        
        @keyframes fluorescent-hum {
          0%, 100% { opacity: 0.03; }
          50% { opacity: 0.035; }
        }
        
        @keyframes neon-flicker {
          0%, 100% { opacity: 1; }
          92% { opacity: 1; }
          93% { opacity: 0.3; }
          94% { opacity: 1; }
          96% { opacity: 0.5; }
          97% { opacity: 1; }
        }
        
        @keyframes monitor-blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

function getParticleAnimation(particle: AtmosphereParticle): string {
  switch (particle.type) {
    case "dust":
      return `drift ${particle.speed}s ease-in-out infinite`;
    case "sparkle":
      return `sparkle ${particle.speed / 3}s ease-in-out infinite`;
    case "float":
      return `float-up ${particle.speed}s linear infinite`;
    case "rain":
      return `fall ${particle.speed / 4}s linear infinite`;
    case "snow":
      return `fall ${particle.speed}s linear infinite`;
    default:
      return `drift ${particle.speed}s ease-in-out infinite`;
  }
}

export default SceneAtmosphere;
