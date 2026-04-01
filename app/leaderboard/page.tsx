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
    { key: "elders", label: "Hall of Elders", shortLabel: "Elders" },
    { key: "young", label: "Gone Too Soon", shortLabel: "Young" },
    { key: "recent", label: "Recently Departed", shortLabel: "Recent" },
    { key: "cities", label: "Deadliest Cities", shortLabel: "Cities" },
    { key: "dreams", label: "Popular Dreams", shortLabel: "Dreams" },
  ] as const;

  return (
    <div className="min-h-screen bg-[#0f380f] overflow-hidden">
      {/* Animated background grid */}
      <div className="fixed inset-0 opacity-10 pointer-events-none">
        <div 
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(139, 172, 15, 0.3) 1px, transparent 1px),
              linear-gradient(90deg, rgba(139, 172, 15, 0.3) 1px, transparent 1px)
            `,
            backgroundSize: '20px 20px',
          }}
        />
      </div>

      {/* Floating particles */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <div
            key={i}
            className="absolute size-1 bg-[#8bac0f] rounded-full opacity-30"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animation: `float ${8 + Math.random() * 4}s ease-in-out infinite`,
              animationDelay: `${Math.random() * 5}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto max-w-4xl px-4 py-8">
        {/* Header */}
        <header className="mb-8 text-center">
          <Link
            href="/"
            className="gb-panel inline-flex items-center gap-2 px-4 py-2 mb-6 text-xs text-[#8bac0f] hover:text-[#9bbc0f] transition-colors"
          >
            <span className="animate-pulse">&#9664;</span>
            <span>Return to Game</span>
          </Link>
          
          <div className="gb-panel-glow p-6 mb-4">
            <h1 className="font-pixel text-3xl md:text-4xl text-[#9bbc0f] mb-2 tracking-wider">
              MEMORIAL HALL
            </h1>
            <div className="flex items-center justify-center gap-4 text-[#8bac0f]">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#306230] to-transparent" />
              <span className="text-xs font-mono">DREAMLAND ARCHIVES</span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#306230] to-transparent" />
            </div>
          </div>
        </header>

        {/* Tabs */}
        <nav className="mb-6">
          <div className="gb-panel p-2 flex flex-wrap justify-center gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "px-4 py-2 font-mono text-xs transition-all duration-300 border-2",
                  activeTab === tab.key
                    ? "bg-[#8bac0f] border-[#9bbc0f] text-[#0f380f] shadow-[0_0_10px_rgba(139,172,15,0.5)]"
                    : "bg-transparent border-[#306230] text-[#8bac0f] hover:border-[#8bac0f] hover:bg-[#306230]/30"
                )}
              >
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.shortLabel}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* Content */}
        <main className="gb-panel-glow p-4 md:p-6 min-h-[400px]">
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
                Loading memorial records...
              </p>
            </div>
          ) : !data ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="text-4xl mb-4">&#9760;</div>
              <p className="text-[#8bac0f] text-sm font-mono">
                Failed to connect to the archives
              </p>
              <button 
                onClick={() => window.location.reload()}
                className="mt-4 gb-button px-4 py-2"
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="animate-fade-in">
              {/* Elders */}
              {activeTab === "elders" && (
                <TabContent
                  title="Hall of Elders"
                  subtitle="Those who lived the longest lives"
                  icon="&#9733;"
                >
                  <div className="space-y-3">
                    {data.elders.map((entry, i) => (
                      <LeaderboardRow key={entry.id} entry={entry} rank={i + 1} />
                    ))}
                    {data.elders.length === 0 && <EmptyState />}
                  </div>
                </TabContent>
              )}

              {/* Young deaths */}
              {activeTab === "young" && (
                <TabContent
                  title="Gone Too Soon"
                  subtitle="Lives cut tragically short"
                  icon="&#9829;"
                >
                  <div className="space-y-3">
                    {data.youngDeaths.map((entry, i) => (
                      <LeaderboardRow key={entry.id} entry={entry} rank={i + 1} />
                    ))}
                    {data.youngDeaths.length === 0 && <EmptyState />}
                  </div>
                </TabContent>
              )}

              {/* Recent */}
              {activeTab === "recent" && (
                <TabContent
                  title="Recently Departed"
                  subtitle="The most recent souls to pass"
                  icon="&#9670;"
                >
                  <div className="space-y-3">
                    {data.recent.map((entry, i) => (
                      <LeaderboardRow key={entry.id} entry={entry} rank={i + 1} showTime />
                    ))}
                    {data.recent.length === 0 && <EmptyState />}
                  </div>
                </TabContent>
              )}

              {/* Cities */}
              {activeTab === "cities" && (
                <TabContent
                  title="Deadliest Cities"
                  subtitle="Where dreams face the greatest challenges"
                  icon="&#9962;"
                >
                  <div className="space-y-3">
                    {data.deadliestCities.map((city, i) => (
                      <CityRow key={city.city} city={city} rank={i + 1} />
                    ))}
                    {data.deadliestCities.length === 0 && <EmptyState />}
                  </div>
                </TabContent>
              )}

              {/* Dreams */}
              {activeTab === "dreams" && (
                <TabContent
                  title="Popular Dreams"
                  subtitle="What souls aspire to become"
                  icon="&#10022;"
                >
                  <div className="space-y-3">
                    {data.popularDreams.map((dream, i) => (
                      <DreamRow key={dream.desire} dream={dream} rank={i + 1} />
                    ))}
                    {data.popularDreams.length === 0 && <EmptyState />}
                  </div>
                </TabContent>
              )}
            </div>
          )}
        </main>

        {/* Footer CTA */}
        <footer className="mt-8 text-center">
          <Link href="/" className="gb-button-primary inline-block px-8 py-4 text-sm">
            <span className="flex items-center gap-3">
              <span>&#9658;</span>
              <span>START A NEW LIFE</span>
              <span>&#9668;</span>
            </span>
          </Link>
          <p className="mt-4 text-[#306230] text-xs font-mono">
            Your story awaits...
          </p>
        </footer>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0) translateX(0); opacity: 0.3; }
          50% { transform: translateY(-20px) translateX(10px); opacity: 0.6; }
        }
        
        .animate-fade-in {
          animation: fadeIn 0.5s ease-out forwards;
        }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

function TabContent({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-6 text-center">
        <div className="text-3xl text-[#8bac0f] mb-2">{icon}</div>
        <h2 className="font-pixel text-xl text-[#9bbc0f] mb-1">{title}</h2>
        <p className="text-[#8bac0f] text-xs font-mono">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-8">
      <div className="text-2xl text-[#306230] mb-2">&#9676;</div>
      <p className="text-[#8bac0f] text-sm font-mono">No records found</p>
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

  const getRankStyle = (r: number) => {
    if (r === 1) return "text-[#9bbc0f] animate-pulse";
    if (r === 2) return "text-[#8bac0f]";
    if (r === 3) return "text-[#8bac0f]/80";
    return "text-[#306230]";
  };

  return (
    <div className="group gb-panel p-4 hover:bg-[#306230]/20 transition-all duration-300 cursor-pointer">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {/* Rank */}
          <div className={cn("font-pixel text-2xl w-10", getRankStyle(rank))}>
            {rank === 1 ? "I" : rank === 2 ? "II" : rank === 3 ? "III" : `#${rank}`}
          </div>
          
          {/* Info */}
          <div>
            <div className="flex items-center gap-2 text-[#9bbc0f] font-mono text-sm">
              <span>{entry.gender === "male" ? "&#9794;" : "&#9792;"}</span>
              <span className="font-bold">{entry.city}</span>
            </div>
            <div className="text-[#8bac0f] text-xs font-mono mt-1 italic">
              &ldquo;{entry.desire}&rdquo;
            </div>
          </div>
        </div>
        
        {/* Age */}
        <div className="text-right">
          <div className="font-pixel text-2xl text-[#9bbc0f]">{entry.death_age}</div>
          <div className="text-[#306230] text-[10px] font-mono uppercase">years</div>
          {showTime && (
            <div className="text-[#8bac0f] text-[10px] font-mono mt-1">
              {timeAgo(entry.created_at)}
            </div>
          )}
        </div>
      </div>
      
      {/* Verdict */}
      {entry.verdict && (
        <div className="mt-3 pt-3 border-t border-[#306230]/50">
          <p className="text-[#8bac0f] text-xs font-mono italic leading-relaxed">
            &ldquo;{entry.verdict}&rdquo;
          </p>
        </div>
      )}
      
      {/* Death cause */}
      {entry.death_cause && (
        <div className="mt-2 text-[#306230] text-[10px] font-mono">
          Cause: {entry.death_cause}
        </div>
      )}
    </div>
  );
}

function CityRow({
  city,
  rank,
}: {
  city: { city: string; count: number; avg_age: number };
  rank: number;
}) {
  const dangerLevel = Math.min(100, (city.count / 10) * 100);
  
  return (
    <div className="gb-panel p-4 hover:bg-[#306230]/20 transition-all duration-300">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="font-pixel text-xl text-[#306230] w-8">#{rank}</div>
          <div>
            <div className="font-pixel text-lg text-[#9bbc0f]">{city.city}</div>
            <div className="text-[#8bac0f] text-xs font-mono">
              Average lifespan: {city.avg_age} years
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="font-pixel text-xl text-[#9bbc0f]">{city.count}</div>
          <div className="text-[#306230] text-[10px] font-mono">deaths</div>
        </div>
      </div>
      
      {/* Danger bar */}
      <div className="mt-3 h-2 bg-[#0f380f] rounded-full overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-[#306230] to-[#8bac0f] transition-all duration-500"
          style={{ width: `${dangerLevel}%` }}
        />
      </div>
    </div>
  );
}

function DreamRow({
  dream,
  rank,
}: {
  dream: { desire: string; count: number };
  rank: number;
}) {
  return (
    <div className="gb-panel p-4 hover:bg-[#306230]/20 transition-all duration-300">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="font-pixel text-xl text-[#306230] w-8">#{rank}</div>
          <div className="text-[#9bbc0f] font-mono italic">
            &ldquo;{dream.desire}&rdquo;
          </div>
        </div>
        <div className="text-right">
          <div className="font-pixel text-xl text-[#9bbc0f]">{dream.count}</div>
          <div className="text-[#306230] text-[10px] font-mono">dreamers</div>
        </div>
      </div>
    </div>
  );
}
