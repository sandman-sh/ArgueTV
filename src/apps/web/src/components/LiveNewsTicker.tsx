import { useRef, useEffect, useState, useCallback } from "react";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

type TickerArticle = { title: string; url: string; source: string; category: string };

const CATEGORY_COLORS: Record<string, { dot: string; label: string }> = {
  Politics:   { dot: "bg-red-500",    label: "text-red-400"    },
  Technology: { dot: "bg-blue-500",   label: "text-blue-400"   },
  Business:   { dot: "bg-yellow-500", label: "text-yellow-400" },
  Science:    { dot: "bg-green-500",  label: "text-green-400"  },
  World:      { dot: "bg-orange-500", label: "text-orange-400" },
  Society:    { dot: "bg-purple-500", label: "text-purple-400" },
};

const REFRESH_MS = 5 * 60 * 1000; // 5 min

export function LiveNewsTicker() {
  const [articles, setArticles] = useState<TickerArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const trackRef = useRef<HTMLDivElement>(null);
  const animRef = useRef<Animation | null>(null);

  const fetchArticles = useCallback(async () => {
    try {
      const res = await fetch(`${BASE}/api/debate/ticker`);
      if (!res.ok) return;
      const data = (await res.json()) as { articles?: TickerArticle[] };
      if (data.articles && data.articles.length > 0) {
        setArticles(data.articles);
      }
    } catch {
      // keep existing articles
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + auto-refresh every 5 min
  useEffect(() => {
    fetchArticles();
    const id = setInterval(fetchArticles, REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchArticles]);

  // CSS animation approach (smooth, pausable on hover)
  if (loading) {
    return (
      <div className="relative flex items-center border-t border-white/8 bg-black/80 h-9 shrink-0 overflow-hidden">
        <div className="flex items-center gap-2 px-3 bg-red-600 border-r border-red-700 shrink-0 h-full">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white whitespace-nowrap">
            LIVE
          </span>
        </div>
        <div className="flex items-center px-3 border-r border-white/8 shrink-0 h-full bg-white/[0.04]">
          <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/50 whitespace-nowrap">
            ArgueTV News Network
          </span>
        </div>
        <div className="flex items-center gap-6 px-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-3 rounded animate-pulse bg-white/8" style={{ width: 140 + i * 30 }} />
          ))}
        </div>
      </div>
    );
  }

  if (articles.length === 0) return null;

  // Triple the list so the seamless loop has plenty of runway
  const items = [...articles, ...articles, ...articles];
  // Speed: roughly 80px per second — tune via duration
  const SPEED_PX_PER_S = 70;

  return (
    <div className="relative flex items-stretch border-t border-white/8 bg-black/90 h-9 shrink-0 overflow-hidden select-none">
      {/* LIVE label */}
      <div className="flex items-center gap-2 px-3 bg-red-600 border-r border-red-700 shrink-0 z-10">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
        </span>
        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white whitespace-nowrap">
          LIVE
        </span>
      </div>

      {/* Network name */}
      <div className="flex items-center px-3 border-r border-white/8 shrink-0 z-10 bg-white/[0.04]">
        <span className="text-[9px] font-bold uppercase tracking-[0.18em] text-white/50 whitespace-nowrap">
          ArgueTV News Network
        </span>
      </div>

      {/* Scrolling track */}
      <div className="flex-1 overflow-hidden relative">
        {/* Left fade */}
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-black/90 to-transparent z-10 pointer-events-none" />
        {/* Right fade */}
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-black/90 to-transparent z-10 pointer-events-none" />

        <div
          ref={trackRef}
          className="flex items-center h-9 whitespace-nowrap ticker-track"
          style={{ width: "max-content" }}
        >
          {items.map((article, i) => {
            const cat = CATEGORY_COLORS[article.category];
            return (
              <a
                key={`${article.url}-${i}`}
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                title={article.title}
                className="inline-flex items-center gap-2.5 px-5 h-9 group cursor-pointer hover:bg-white/5 transition-colors border-r border-white/6"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Category dot */}
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cat?.dot ?? "bg-white/30"}`} />

                {/* Category label */}
                <span className={`text-[9px] font-bold uppercase tracking-wider shrink-0 ${cat?.label ?? "text-white/40"}`}>
                  {article.category}
                </span>

                {/* Separator */}
                <span className="text-white/20 text-xs shrink-0">·</span>

                {/* Headline */}
                <span className="text-[11px] font-medium text-white/70 group-hover:text-white transition-colors truncate max-w-[280px]">
                  {article.title}
                </span>

                {/* Source */}
                <span className="text-[9px] text-white/25 group-hover:text-white/50 transition-colors shrink-0 ml-1">
                  {article.source}
                </span>

                <span className="text-white/10 text-xs ml-3 shrink-0">▶</span>
              </a>
            );
          })}
        </div>
      </div>

      {/* Inline keyframes — computed per render so speed is consistent */}
      <style>{`
        .ticker-track {
          animation: ticker-scroll linear infinite;
          animation-duration: ${Math.round((articles.length * 320) / SPEED_PX_PER_S)}s;
        }
        .ticker-track:hover {
          animation-play-state: paused;
        }
        @keyframes ticker-scroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
      `}</style>
    </div>
  );
}
