"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { API_URL } from "@/lib/constants";

interface LeaderboardEntry {
  id: string;
  gender: string;
  city: string;
  desire: string;
  death_age: number;
  death_cause: string;
  verdict: string;
  created_at: string;
}

interface LeaderboardData {
  elders: LeaderboardEntry[];
  youngDeaths: LeaderboardEntry[];
  recent: LeaderboardEntry[];
  deadliestCities: { city: string; count: number; avg_age: number }[];
  popularDreams: { desire: string; count: number }[];
}

export default function LeaderboardPage() {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<
    "elders" | "young" | "recent" | "cities" | "dreams"
  >("elders");

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await fetch(`${API_URL}/api/leaderboard`);
        if (response.ok) {
          const result = await response.json();
          setData(result);
        }
      } catch (error) {
        console.error("Failed to fetch leaderboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  const tabs = [
    { key: "elders", label: "Hall of Elders", icon: "👴" },
    { key: "young", label: "Gone Too Soon", icon: "💔" },
    { key: "recent", label: "Recently Departed", icon: "🕯️" },
    { key: "cities", label: "Deadliest Cities", icon: "🏙️" },
    { key: "dreams", label: "Popular Dreams", icon: "✨" },
  ] as const;

  return (
    <div className="min-h-screen bg-gb-lightest p-4">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <Link
            href="/"
            className="mb-4 inline-block font-mono text-xs text-gb-dark hover:text-gb-darkest"
          >
            ← Back to Game
          </Link>
          <h1 className="font-pixel text-2xl text-gb-darkest">DREAMLAND</h1>
          <p className="mt-2 font-mono text-sm text-gb-dark">Memorial Hall</p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex flex-wrap justify-center gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "flex items-center gap-1 border-2 px-3 py-2 font-mono text-xs transition-colors",
                activeTab === tab.key
                  ? "border-gb-darkest bg-gb-dark text-gb-lightest"
                  : "border-gb-dark bg-gb-lightest text-gb-darkest hover:bg-gb-light"
              )}
            >
              <span>{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="border-4 border-gb-dark bg-gb-lightest p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex gap-2">
                <div className="size-3 animate-bounce bg-gb-dark" style={{ animationDelay: "0ms" }} />
                <div className="size-3 animate-bounce bg-gb-dark" style={{ animationDelay: "150ms" }} />
                <div className="size-3 animate-bounce bg-gb-dark" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          ) : !data ? (
            <div className="py-12 text-center font-mono text-sm text-gb-dark">
              Failed to load leaderboard data
            </div>
          ) : (
            <>
              {/* Elders */}
              {activeTab === "elders" && (
                <div className="space-y-4">
                  <h2 className="font-pixel text-lg text-gb-darkest">🏆 Hall of Elders</h2>
                  <p className="font-mono text-xs text-gb-dark">
                    Those who lived the longest lives
                  </p>
                  <div className="space-y-2">
                    {data.elders.map((entry, i) => (
                      <LeaderboardRow key={entry.id} entry={entry} rank={i + 1} />
                    ))}
                  </div>
                </div>
              )}

              {/* Young deaths */}
              {activeTab === "young" && (
                <div className="space-y-4">
                  <h2 className="font-pixel text-lg text-gb-darkest">💔 Gone Too Soon</h2>
                  <p className="font-mono text-xs text-gb-dark">
                    Lives cut tragically short
                  </p>
                  <div className="space-y-2">
                    {data.youngDeaths.map((entry, i) => (
                      <LeaderboardRow key={entry.id} entry={entry} rank={i + 1} />
                    ))}
                  </div>
                </div>
              )}

              {/* Recent */}
              {activeTab === "recent" && (
                <div className="space-y-4">
                  <h2 className="font-pixel text-lg text-gb-darkest">🕯️ Recently Departed</h2>
                  <p className="font-mono text-xs text-gb-dark">
                    The most recent souls to pass
                  </p>
                  <div className="space-y-2">
                    {data.recent.map((entry, i) => (
                      <LeaderboardRow key={entry.id} entry={entry} rank={i + 1} showTime />
                    ))}
                  </div>
                </div>
              )}

              {/* Cities */}
              {activeTab === "cities" && (
                <div className="space-y-4">
                  <h2 className="font-pixel text-lg text-gb-darkest">🏙️ Deadliest Cities</h2>
                  <p className="font-mono text-xs text-gb-dark">
                    Where dreams go to die
                  </p>
                  <div className="space-y-2">
                    {data.deadliestCities.map((city, i) => (
                      <div
                        key={city.city}
                        className="flex items-center justify-between border border-gb-dark bg-gb-light/30 p-3"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-pixel text-lg text-gb-dark">#{i + 1}</span>
                          <span className="font-mono text-sm font-bold text-gb-darkest">
                            {city.city}
                          </span>
                        </div>
                        <div className="text-right font-mono text-xs">
                          <div className="text-gb-darkest">{city.count} deaths</div>
                          <div className="text-gb-dark">Avg age: {city.avg_age}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dreams */}
              {activeTab === "dreams" && (
                <div className="space-y-4">
                  <h2 className="font-pixel text-lg text-gb-darkest">✨ Popular Dreams</h2>
                  <p className="font-mono text-xs text-gb-dark">
                    What people aspire to become
                  </p>
                  <div className="space-y-2">
                    {data.popularDreams.map((dream, i) => (
                      <div
                        key={dream.desire}
                        className="flex items-center justify-between border border-gb-dark bg-gb-light/30 p-3"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-pixel text-lg text-gb-dark">#{i + 1}</span>
                          <span className="font-mono text-sm italic text-gb-darkest">
                            &quot;{dream.desire}&quot;
                          </span>
                        </div>
                        <div className="font-mono text-xs text-gb-dark">
                          {dream.count} dreamers
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <Link
            href="/"
            className="inline-block border-2 border-gb-dark bg-gb-light px-6 py-3 font-pixel text-sm text-gb-darkest transition-colors hover:bg-gb-dark hover:text-gb-lightest"
          >
            START A NEW LIFE
          </Link>
        </div>
      </div>
    </div>
  );
}

function LeaderboardRow({
  entry,
  rank,
  showTime = false,
}: {
  entry: LeaderboardEntry;
  rank: number;
  showTime?: boolean;
}) {
  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="border border-gb-dark bg-gb-light/30 p-3">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="font-pixel text-lg text-gb-dark">#{rank}</span>
          <div>
            <div className="font-mono text-sm font-bold text-gb-darkest">
              {entry.gender === "male" ? "♂" : "♀"} from {entry.city}
            </div>
            <div className="font-mono text-xs italic text-gb-dark">
              Dream: &quot;{entry.desire}&quot;
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-pixel text-lg text-gb-darkest">{entry.death_age}</div>
          <div className="font-mono text-[10px] text-gb-dark">years</div>
          {showTime && (
            <div className="font-mono text-[10px] text-gb-dark">{timeAgo(entry.created_at)}</div>
          )}
        </div>
      </div>
      {entry.verdict && (
        <div className="mt-2 border-t border-gb-dark pt-2 font-mono text-xs italic text-gb-darkest">
          &quot;{entry.verdict}&quot;
        </div>
      )}
    </div>
  );
}
