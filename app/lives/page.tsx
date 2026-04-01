"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { API_URL } from "@/lib/constants";

interface LifeEntry {
  id: string;
  gender: string;
  city: string;
  desire: string;
  death_age: number;
  death_cause: string;
  verdict: string;
  created_at: string;
}

interface LifeDetail {
  run: LifeEntry;
  turns: {
    age: number;
    narrative: string;
    choice_made: string;
    location: string;
  }[];
  stats: {
    age: number;
    money: number;
    stability: number;
    status: number;
    health: number;
    stress: number;
    freedom: number;
    exposure: number;
  }[];
}

export default function LivesGalleryPage() {
  const [lives, setLives] = useState<LifeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLife, setSelectedLife] = useState<LifeDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    const fetchLives = async () => {
      try {
        const response = await fetch(`${API_URL}/api/lives?page=${page}&limit=20`);
        if (response.ok) {
          const result = await response.json();
          if (page === 1) {
            setLives(result.lives || []);
          } else {
            setLives(prev => [...prev, ...(result.lives || [])]);
          }
          setHasMore(result.hasMore || false);
        }
      } catch (error) {
        console.error("Failed to fetch lives:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLives();
  }, [page]);

  const viewLifeDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    try {
      const response = await fetch(`${API_URL}/api/lives/${id}`);
      if (response.ok) {
        const result = await response.json();
        setSelectedLife(result);
      }
    } catch (error) {
      console.error("Failed to fetch life detail:", error);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#0f380f] overflow-hidden">
      {/* Background */}
      <div className="fixed inset-0 opacity-5 pointer-events-none">
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(139, 172, 15, 0.5) 1px, transparent 1px),
              linear-gradient(90deg, rgba(139, 172, 15, 0.5) 1px, transparent 1px)
            `,
            backgroundSize: '30px 30px',
          }}
        />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <header className="mb-8 text-center">
          <nav className="flex justify-center gap-4 mb-6">
            <Link href="/" className="gb-panel px-4 py-2 text-xs text-[#8bac0f] hover:text-[#9bbc0f]">
              <span className="animate-pulse">&#9664;</span> Game
            </Link>
            <Link href="/leaderboard" className="gb-panel px-4 py-2 text-xs text-[#8bac0f] hover:text-[#9bbc0f]">
              Leaderboard &#9733;
            </Link>
          </nav>
          
          <div className="gb-panel-glow p-6">
            <h1 className="font-pixel text-3xl md:text-4xl text-[#9bbc0f] mb-2 tracking-wider">
              LIVES LIVED
            </h1>
            <p className="text-[#8bac0f] text-xs font-mono">
              Browse the stories of those who came before
            </p>
          </div>
        </header>

        {/* Content */}
        {selectedLife ? (
          <LifeDetailView 
            life={selectedLife} 
            onClose={() => setSelectedLife(null)} 
          />
        ) : (
          <main>
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="flex gap-2 mb-4">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="size-3 bg-[#8bac0f] animate-bounce"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
                <p className="text-[#8bac0f] text-xs font-mono animate-pulse">
                  Loading lives...
                </p>
              </div>
            ) : lives.length === 0 ? (
              <div className="gb-panel-glow p-12 text-center">
                <div className="text-4xl text-[#306230] mb-4">&#9676;</div>
                <p className="text-[#8bac0f] text-sm font-mono mb-4">
                  No lives recorded yet
                </p>
                <Link href="/" className="gb-button-primary px-6 py-3">
                  Be the First
                </Link>
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {lives.map((life) => (
                    <LifeCard 
                      key={life.id} 
                      life={life} 
                      onClick={() => viewLifeDetail(life.id)}
                    />
                  ))}
                </div>
                
                {hasMore && (
                  <div className="mt-8 text-center">
                    <button
                      onClick={() => setPage(p => p + 1)}
                      className="gb-button px-6 py-3 text-sm"
                    >
                      Load More Lives
                    </button>
                  </div>
                )}
              </>
            )}
          </main>
        )}

        {/* Loading overlay for detail */}
        {loadingDetail && (
          <div className="fixed inset-0 bg-[#0f380f]/90 flex items-center justify-center z-50">
            <div className="flex flex-col items-center">
              <div className="flex gap-2 mb-4">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className="size-4 bg-[#8bac0f] animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
              <p className="text-[#8bac0f] font-mono animate-pulse">
                Loading life story...
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LifeCard({ life, onClick }: { life: LifeEntry; onClick: () => void }) {
  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
    return new Date(date).toLocaleDateString();
  };

  return (
    <button
      onClick={onClick}
      className="gb-panel p-4 text-left hover:bg-[#306230]/20 transition-all duration-300 group w-full"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[#8bac0f] text-lg">
            {life.gender === "male" ? "&#9794;" : "&#9792;"}
          </span>
          <span className="text-[#9bbc0f] font-pixel text-sm">{life.city}</span>
        </div>
        <div className="text-right">
          <div className="font-pixel text-2xl text-[#9bbc0f]">{life.death_age}</div>
          <div className="text-[10px] text-[#306230] font-mono">years</div>
        </div>
      </div>
      
      {/* Dream */}
      <div className="text-[#8bac0f] text-xs font-mono italic mb-3 line-clamp-2">
        &ldquo;{life.desire}&rdquo;
      </div>
      
      {/* Verdict */}
      {life.verdict && (
        <div className="pt-3 border-t border-[#306230]/50">
          <p className="text-[#8bac0f] text-[10px] font-mono line-clamp-2 italic">
            {life.verdict}
          </p>
        </div>
      )}
      
      {/* Footer */}
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[#306230] text-[10px] font-mono">
          {timeAgo(life.created_at)}
        </span>
        <span className="text-[#8bac0f] text-xs font-mono group-hover:text-[#9bbc0f] transition-colors">
          View Story &#9654;
        </span>
      </div>
    </button>
  );
}

function LifeDetailView({ life, onClose }: { life: LifeDetail; onClose: () => void }) {
  const [activeSection, setActiveSection] = useState<"story" | "stats">("story");
  
  return (
    <div className="animate-fade-in">
      {/* Back button */}
      <button
        onClick={onClose}
        className="gb-panel px-4 py-2 mb-6 text-xs text-[#8bac0f] hover:text-[#9bbc0f]"
      >
        <span className="animate-pulse">&#9664;</span> Back to Gallery
      </button>
      
      {/* Life summary */}
      <div className="gb-panel-glow p-6 mb-6 text-center">
        <div className="text-2xl text-[#8bac0f] mb-2">
          {life.run.gender === "male" ? "&#9794;" : "&#9792;"}
        </div>
        <h2 className="font-pixel text-2xl text-[#9bbc0f] mb-1">
          A Life in {life.run.city}
        </h2>
        <p className="text-[#8bac0f] text-sm font-mono italic mb-4">
          &ldquo;{life.run.desire}&rdquo;
        </p>
        <div className="flex items-center justify-center gap-6">
          <div>
            <div className="font-pixel text-3xl text-[#9bbc0f]">{life.run.death_age}</div>
            <div className="text-[10px] text-[#306230] font-mono uppercase">years lived</div>
          </div>
          <div className="h-8 w-px bg-[#306230]" />
          <div>
            <div className="font-pixel text-lg text-[#8bac0f]">{life.turns?.length || 0}</div>
            <div className="text-[10px] text-[#306230] font-mono uppercase">moments</div>
          </div>
        </div>
        
        {life.run.verdict && (
          <div className="mt-6 pt-4 border-t border-[#306230]">
            <p className="text-[#8bac0f] text-sm font-mono italic">
              &ldquo;{life.run.verdict}&rdquo;
            </p>
          </div>
        )}
      </div>
      
      {/* Section tabs */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveSection("story")}
          className={cn(
            "gb-panel px-4 py-2 text-xs font-mono transition-all",
            activeSection === "story"
              ? "bg-[#8bac0f] text-[#0f380f]"
              : "text-[#8bac0f] hover:text-[#9bbc0f]"
          )}
        >
          Life Story
        </button>
        <button
          onClick={() => setActiveSection("stats")}
          className={cn(
            "gb-panel px-4 py-2 text-xs font-mono transition-all",
            activeSection === "stats"
              ? "bg-[#8bac0f] text-[#0f380f]"
              : "text-[#8bac0f] hover:text-[#9bbc0f]"
          )}
        >
          Stat Journey
        </button>
      </div>
      
      {/* Story timeline */}
      {activeSection === "story" && (
        <div className="gb-panel p-4 max-h-[600px] overflow-y-auto">
          {life.turns && life.turns.length > 0 ? (
            <div className="space-y-4">
              {life.turns.map((turn, i) => (
                <div key={i} className="relative pl-8 pb-4 border-l-2 border-[#306230] last:border-l-transparent">
                  {/* Age marker */}
                  <div className="absolute left-0 top-0 -translate-x-1/2 size-4 rounded-full bg-[#306230] border-2 border-[#8bac0f] flex items-center justify-center">
                    <div className="size-1.5 bg-[#8bac0f] rounded-full" />
                  </div>
                  
                  {/* Content */}
                  <div className="bg-[#0f380f]/50 p-3 rounded">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-pixel text-[#9bbc0f]">Age {turn.age}</span>
                      {turn.location && (
                        <span className="text-[#306230] text-[10px] font-mono">
                          @ {turn.location}
                        </span>
                      )}
                    </div>
                    <p className="text-[#8bac0f] text-xs font-mono leading-relaxed mb-2">
                      {turn.narrative}
                    </p>
                    {turn.choice_made && (
                      <div className="pt-2 border-t border-[#306230]/50">
                        <span className="text-[#306230] text-[10px] font-mono">Choice: </span>
                        <span className="text-[#8bac0f] text-[10px] font-mono italic">
                          {turn.choice_made}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-[#8bac0f] text-sm font-mono py-8">
              Story details not available
            </p>
          )}
        </div>
      )}
      
      {/* Stats visualization */}
      {activeSection === "stats" && (
        <div className="gb-panel p-4">
          {life.stats && life.stats.length > 0 ? (
            <div className="space-y-4">
              <p className="text-[#8bac0f] text-xs font-mono mb-4 text-center">
                How their stats evolved over time
              </p>
              <StatChart stats={life.stats} />
            </div>
          ) : (
            <p className="text-center text-[#8bac0f] text-sm font-mono py-8">
              Stat history not available
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function StatChart({ stats }: { stats: LifeDetail["stats"] }) {
  const statNames = ["money", "stability", "status", "health", "stress", "freedom", "exposure"] as const;
  const statLabels: Record<string, string> = {
    money: "Money",
    stability: "Stability",
    status: "Status",
    health: "Health",
    stress: "Stress",
    freedom: "Freedom",
    exposure: "Exposure",
  };
  
  // Get final values
  const finalStats = stats[stats.length - 1] || {};
  
  return (
    <div className="space-y-3">
      {statNames.map((stat) => {
        const value = (finalStats as Record<string, number>)[stat] || 0;
        const isNegative = stat === "stress" || stat === "exposure";
        
        return (
          <div key={stat} className="flex items-center gap-3">
            <span className="text-[#8bac0f] text-xs font-mono w-20 text-right">
              {statLabels[stat]}
            </span>
            <div className="flex-1 h-4 bg-[#0f380f] rounded overflow-hidden">
              <div
                className={cn(
                  "h-full transition-all duration-500",
                  isNegative
                    ? "bg-gradient-to-r from-[#306230] to-[#8bac0f]"
                    : "bg-gradient-to-r from-[#306230] to-[#9bbc0f]"
                )}
                style={{ width: `${value}%` }}
              />
            </div>
            <span className="text-[#9bbc0f] font-pixel text-sm w-8 text-right">
              {value}
            </span>
          </div>
        );
      })}
    </div>
  );
}
