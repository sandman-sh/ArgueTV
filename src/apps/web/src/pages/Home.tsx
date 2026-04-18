import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, ArrowRight, Loader2, Activity, Download, Share2,
  PlayCircle, TrendingUp, CheckCircle, ShieldCheck, Video, Film,
} from "lucide-react";
import { useStartDebate, useGenerateAudio } from "@workspace/api-client-react";
import { useDebatePlayer } from "../hooks/use-debate-player";
import { AgentCard } from "../components/AgentCard";
import { FactCheckOverlay, type FactCheckState } from "../components/FactCheckOverlay";
import { LiveNewsTicker } from "../components/LiveNewsTicker";
import { fetchFactCheck, fetchTrendingTopics, fetchDebateVerdict, fetchLiveNews, type DebateVerdictResult, type LiveNewsItem } from "../lib/api";
import { DebateVerdictPanel } from "../components/DebateVerdictPanel";
import { useScreenRecorder } from "../hooks/use-screen-recorder";
import type { DebateResponse } from "@workspace/api-client-react";

type NewsHighlight = { title: string; snippet: string; url: string };

const LANGUAGES = [
  { code: "English",    flag: "🇺🇸", label: "English"    },
  { code: "Spanish",    flag: "🇪🇸", label: "Español"    },
  { code: "French",     flag: "🇫🇷", label: "Français"   },
  { code: "German",     flag: "🇩🇪", label: "Deutsch"    },
  { code: "Portuguese", flag: "🇧🇷", label: "Português"  },
  { code: "Italian",    flag: "🇮🇹", label: "Italiano"   },
  { code: "Japanese",   flag: "🇯🇵", label: "日本語"     },
  { code: "Korean",     flag: "🇰🇷", label: "한국어"     },
  { code: "Chinese",    flag: "🇨🇳", label: "中文"       },
  { code: "Arabic",     flag: "🇸🇦", label: "العربية"   },
  { code: "Hindi",      flag: "🇮🇳", label: "हिन्दी"    },
  { code: "Turkish",    flag: "🇹🇷", label: "Türkçe"    },
];

const NEWS_COUNTRIES = [
  { code: "global",    flag: "🌍", label: "Global"         },
  { code: "us",        flag: "🇺🇸", label: "United States" },
  { code: "uk",        flag: "🇬🇧", label: "United Kingdom"},
  { code: "india",     flag: "🇮🇳", label: "India"         },
  { code: "germany",   flag: "🇩🇪", label: "Germany"       },
  { code: "france",    flag: "🇫🇷", label: "France"        },
  { code: "australia", flag: "🇦🇺", label: "Australia"     },
  { code: "canada",    flag: "🇨🇦", label: "Canada"        },
  { code: "japan",     flag: "🇯🇵", label: "Japan"         },
];

const NEWS_CATEGORIES = [
  { code: "all",        label: "All",        active: "bg-white/15 border-white/30 text-white",          inactive: "bg-white/[0.03] border-white/8 text-white/40" },
  { code: "Politics",   label: "Politics",   active: "bg-red-500/20 border-red-500/50 text-red-400",    inactive: "bg-white/[0.03] border-white/8 text-white/40" },
  { code: "Technology", label: "Technology", active: "bg-blue-500/20 border-blue-500/50 text-blue-400", inactive: "bg-white/[0.03] border-white/8 text-white/40" },
  { code: "Business",   label: "Business",   active: "bg-yellow-500/20 border-yellow-500/50 text-yellow-400", inactive: "bg-white/[0.03] border-white/8 text-white/40" },
  { code: "Science",    label: "Science",    active: "bg-green-500/20 border-green-500/50 text-green-400",  inactive: "bg-white/[0.03] border-white/8 text-white/40" },
  { code: "Society",    label: "Society",    active: "bg-purple-500/20 border-purple-500/50 text-purple-400", inactive: "bg-white/[0.03] border-white/8 text-white/40" },
  { code: "World",      label: "World",      active: "bg-orange-500/20 border-orange-500/50 text-orange-400", inactive: "bg-white/[0.03] border-white/8 text-white/40" },
];

const PARTICLE_COUNT = 8;

function FloatingParticles() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {Array.from({ length: PARTICLE_COUNT }).map((_, i) => {
        const angle = (i / PARTICLE_COUNT) * 2 * Math.PI;
        const radius = 80 + (i % 3) * 20;
        const startX = Math.cos(angle) * radius;
        const startY = Math.sin(angle) * radius;
        const endX = Math.cos(angle + Math.PI) * (radius * 0.6);
        const endY = Math.sin(angle + Math.PI) * (radius * 0.6);
        const size = i % 2 === 0 ? 3 : 5;
        return (
          <motion.div
            key={i}
            className="absolute top-1/2 left-1/2 rounded-full bg-white"
            style={{ width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }}
            initial={{ x: startX, y: startY, opacity: 0 }}
            animate={{ x: [startX, endX, startX], y: [startY, endY, startY], opacity: [0, 0.5, 0.15, 0.5, 0], scale: [0.8, 1.3, 0.8] }}
            transition={{ duration: 2.4 + i * 0.25, repeat: Infinity, delay: i * 0.28, ease: "easeInOut" }}
          />
        );
      })}
    </div>
  );
}

function VsDivider({ currentSpeaker }: { currentSpeaker: "agent1" | "agent2" }) {
  return (
    <div className="hidden md:flex flex-col justify-center items-center relative">
      <div className="relative w-[1px] h-32 bg-gradient-to-b from-transparent via-border to-transparent overflow-visible">
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 w-2 h-2 rounded-full"
          style={{
            background: currentSpeaker === "agent1" ? "rgba(115,60,255,0.9)" : "rgba(255,136,0,0.9)",
            boxShadow: currentSpeaker === "agent1" ? "0 0 10px 4px rgba(115,60,255,0.4)" : "0 0 10px 4px rgba(255,136,0,0.4)",
          }}
          animate={{ top: currentSpeaker === "agent1" ? "0%" : "100%" }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        />
      </div>
      <motion.div
        className="w-12 h-12 rounded-full bg-secondary border flex items-center justify-center font-serif italic text-muted-foreground z-10 shadow-xl"
        animate={{
          borderColor: currentSpeaker === "agent1" ? "rgba(115,60,255,0.4)" : "rgba(255,136,0,0.4)",
          boxShadow: currentSpeaker === "agent1" ? "0 0 16px 2px rgba(115,60,255,0.15)" : "0 0 16px 2px rgba(255,136,0,0.15)",
        }}
        transition={{ duration: 0.5 }}
      >
        VS
      </motion.div>
      <div className="relative w-[1px] h-32 bg-gradient-to-b from-border via-border to-transparent overflow-visible">
        <motion.div
          className="absolute left-1/2 -translate-x-1/2 w-2 h-2 rounded-full"
          style={{
            background: currentSpeaker === "agent2" ? "rgba(255,136,0,0.9)" : "rgba(115,60,255,0.9)",
            boxShadow: currentSpeaker === "agent2" ? "0 0 10px 4px rgba(255,136,0,0.4)" : "0 0 10px 4px rgba(115,60,255,0.4)",
          }}
          animate={{ top: currentSpeaker === "agent2" ? "100%" : "0%" }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        />
      </div>
    </div>
  );
}

function ReplayButton({ text, voice }: { text: string; voice: string }) {
  const { mutateAsync: generateAudio, isPending } = useGenerateAudio();
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const handleReplay = async () => {
    if (isPending) return;
    try {
      const res = await generateAudio({ data: { text, voice } });
      const byteStr = atob(res.audioBase64);
      const bytes = new Uint8Array(byteStr.length);
      for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i);
      const blob = new Blob([bytes], { type: res.mimeType });
      const url = URL.createObjectURL(blob);
      if (audioRef.current) { audioRef.current.pause(); }
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.play().catch(() => {});
      audio.onended = () => URL.revokeObjectURL(url);
    } catch {
      /* silent fail */
    }
  };

  return (
    <button
      onClick={handleReplay}
      disabled={isPending}
      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white transition-colors disabled:opacity-50"
    >
      {isPending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <PlayCircle className="w-3.5 h-3.5" />
      )}
      Replay
    </button>
  );
}

const INITIAL_FACTCHECK: FactCheckState = {
  isVisible: false,
  isLoading: false,
  verdict: null,
  explanation: "",
  claim: "",
  roundName: "",
  audioBase64: null,
  mimeType: "audio/mpeg",
};

export default function Home() {
  const [topic, setTopic] = useState("");
  const [debateData, setDebateData] = useState<DebateResponse | null>(null);
  const [newsHighlights, setNewsHighlights] = useState<NewsHighlight[]>([]);
  const [vote, setVote] = useState<string | null>(null);
  const [factCheckState, setFactCheckState] = useState<FactCheckState>(INITIAL_FACTCHECK);
  const [trendingTopics, setTrendingTopics] = useState<string[]>([]);
  const [isTrendingLoading, setIsTrendingLoading] = useState(false);
  const [liveNews, setLiveNews] = useState<LiveNewsItem[]>([]);
  const [newsPage, setNewsPage] = useState(1);
  const [hasMoreNews, setHasMoreNews] = useState(false);
  const [isNewsLoading, setIsNewsLoading] = useState(false);
  const [isLoadingMoreNews, setIsLoadingMoreNews] = useState(false);
  const [newsCountry, setNewsCountry] = useState("global");
  const [newsCategory, setNewsCategory] = useState("all");
  const newsLoadMoreRef = useRef<HTMLDivElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [isFactChecking, setIsFactChecking] = useState(false);
  const [verdictData, setVerdictData] = useState<DebateVerdictResult | null>(null);
  const [isVerdictLoading, setIsVerdictLoading] = useState(false);
  const [verdictError, setVerdictError] = useState<string | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState("English");

  const { mutateAsync: startDebate, isPending: isStarting } = useStartDebate();

  // ── Debate prep progress bar ──────────────────────────────────────────────
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadStepIdx, setLoadStepIdx] = useState(0);

  const LOAD_STEPS = [
    { label: "Scanning live news sources...",        until: 18  },
    { label: "Researching your topic...",             until: 42  },
    { label: "Briefing Alex Mercer...",               until: 62  },
    { label: "Briefing Jordan Blake...",              until: 80  },
    { label: "Anchors writing arguments...",          until: 93  },
    { label: "Going live in a moment...",             until: 99  },
  ];

  useEffect(() => {
    if (!isStarting) {
      setLoadProgress(0);
      setLoadStepIdx(0);
      return;
    }
    const TOTAL_MS = 13000; // expected wait
    const TICK_MS  = 80;
    const start = Date.now();
    const steps = [18, 42, 62, 80, 93, 99];
    const id = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(99, (elapsed / TOTAL_MS) * 100);
      setLoadProgress(pct);
      const step = steps.findIndex((until) => pct < until);
      setLoadStepIdx(step === -1 ? steps.length - 1 : step);
    }, TICK_MS);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isStarting]);

  const {
    status,
    currentRoundIndex,
    currentSpeaker,
    isAudioLoading,
    currentRoundData,
    hasRecording,
    downloadDebate,
  } = useDebatePlayer(debateData?.rounds, !!debateData, selectedLanguage);

  const {
    isRecording,
    hasVideo,
    error: recorderError,
    status: recorderStatus,
    startRecording,
    stopRecording,
    downloadVideo,
  } = useScreenRecorder();

  // Auto-stop screen recording when debate ends
  useEffect(() => {
    if (status === "completed" && isRecording) {
      stopRecording();
    }
  }, [status, isRecording, stopRecording]);

  // Auto-trigger AI fact-check verdict when debate ends
  useEffect(() => {
    if (status === "completed" && debateData && !verdictData && !isVerdictLoading) {
      setIsVerdictLoading(true);
      setVerdictError(null);
      fetchDebateVerdict(debateData.topic ?? "", debateData.rounds ?? [])
        .then((result) => {
          setVerdictData(result);
        })
        .catch((err: unknown) => {
          setVerdictError(err instanceof Error ? err.message : "Unknown error");
        })
        .finally(() => {
          setIsVerdictLoading(false);
        });
    }
  }, [status, debateData, verdictData, isVerdictLoading]);

  // ── Fetch live news on mount + when country changes + auto-rotate ─────────
  useEffect(() => {
    setLiveNews([]);
    setNewsPage(1);
    setHasMoreNews(false);
    setNewsCategory("all"); // reset category filter when country changes
    const load = (showSpinner: boolean) => {
      if (showSpinner) setIsNewsLoading(true);
      fetchLiveNews(1, newsCountry)
        .then((r) => {
          if (r.news.length > 0) {
            setLiveNews(r.news);
            setHasMoreNews(r.hasMore ?? false);
            setNewsPage(1);
          }
        })
        .catch(() => {})
        .finally(() => setIsNewsLoading(false));
    };
    load(true);
    const id = setInterval(() => load(false), 2 * 60 * 1000);
    return () => clearInterval(id);
  }, [newsCountry]);

  // ── Load more news (called by IntersectionObserver) ───────────────────────
  const loadMoreNews = useCallback(async () => {
    if (isLoadingMoreNews || !hasMoreNews) return;
    const nextPage = newsPage + 1;
    setIsLoadingMoreNews(true);
    try {
      const r = await fetchLiveNews(nextPage, newsCountry);
      setLiveNews((prev) => [...prev, ...r.news]);
      setHasMoreNews(r.hasMore ?? false);
      setNewsPage(nextPage);
    } catch { /* silent */ }
    finally { setIsLoadingMoreNews(false); }
  }, [isLoadingMoreNews, hasMoreNews, newsPage, newsCountry]);

  // ── IntersectionObserver — trigger load when sentinel scrolls into view ───
  useEffect(() => {
    const el = newsLoadMoreRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) loadMoreNews(); },
      { rootMargin: "200px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [loadMoreNews]);

  // ── Fetch trending topics on mount ────────────────────────────────────────
  useEffect(() => {
    setIsTrendingLoading(true);
    fetchTrendingTopics()
      .then((r) => setTrendingTopics(r.topics))
      .catch(() => {})
      .finally(() => setIsTrendingLoading(false));
  }, []);

  const dismissFactCheck = useCallback(() => {
    setFactCheckState((prev) => ({ ...prev, isVisible: false }));
  }, []);

  // ── Manual fact-check trigger ─────────────────────────────────────────────
  const handleFactCheck = useCallback(async () => {
    if (!debateData || isFactChecking) return;
    const round = debateData.rounds[currentRoundIndex] ?? debateData.rounds[0];
    if (!round) return;

    const claim = round.agent1.split(".")[0]?.trim() || round.agent1.slice(0, 120);
    setIsFactChecking(true);
    setFactCheckState({
      isVisible: true,
      isLoading: true,
      verdict: null,
      explanation: "",
      claim,
      roundName: round.roundName,
      audioBase64: null,
      mimeType: "audio/mpeg",
    });

    try {
      const result = await fetchFactCheck(claim, debateData.topic);
      setFactCheckState((prev) => ({
        ...prev,
        isLoading: false,
        verdict: result.verdict,
        explanation: result.explanation,
        audioBase64: result.audioBase64,
        mimeType: result.mimeType,
      }));
    } catch {
      setFactCheckState((prev) => ({ ...prev, isVisible: false }));
    } finally {
      setIsFactChecking(false);
    }
  }, [debateData, currentRoundIndex, isFactChecking]);

  // ── Share ─────────────────────────────────────────────────────────────────
  const handleShare = async () => {
    const text = debateData
      ? `I just watched an AI debate on ArgueTV!\n\nTopic: "${debateData.topic}"\n\nKey argument: "${debateData.rounds[0]?.agent1?.slice(0, 120)}..."\n\nTry ArgueTV for live AI debates on any topic!`
      : "Check out ArgueTV — live AI debates powered by real web data!";

    if (navigator.share) {
      try {
        await navigator.share({ title: "ArgueTV Debate", text });
        return;
      } catch {
        /* fall through to clipboard */
      }
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleDebateNews = useCallback(async (newsItem: LiveNewsItem) => {
    if (isStarting) return;
    const t = newsItem.debateTopic;
    setTopic(t);
    setFactCheckState(INITIAL_FACTCHECK);
    setNewsHighlights([]);
    setVerdictData(null);
    try {
      const result = await startDebate({ data: { topic: t, language: selectedLanguage } as { topic: string } });
      setDebateData(result);
      const extra = result as typeof result & { newsHighlights?: NewsHighlight[] };
      setNewsHighlights(extra.newsHighlights ?? []);
    } catch (err) {
      console.error("Failed to start debate", err);
    }
  }, [isStarting, selectedLanguage, startDebate]);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || isStarting) return;
    setFactCheckState(INITIAL_FACTCHECK);
    setNewsHighlights([]);
    try {
      const result = await startDebate({ data: { topic, language: selectedLanguage } as { topic: string } });
      setDebateData(result);
      const extra = result as typeof result & { newsHighlights?: NewsHighlight[] };
      setNewsHighlights(extra.newsHighlights ?? []);
    } catch (err) {
      console.error("Failed to start debate", err);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 1. HOME STATE
  // ─────────────────────────────────────────────────────────────────────────
  const CATEGORY_COLORS: Record<string, string> = {
    Politics:   "bg-red-500/15 text-red-400 border-red-500/25",
    Technology: "bg-blue-500/15 text-blue-400 border-blue-500/25",
    Business:   "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
    Science:    "bg-green-500/15 text-green-400 border-green-500/25",
    Society:    "bg-purple-500/15 text-purple-400 border-purple-500/25",
    World:      "bg-orange-500/15 text-orange-400 border-orange-500/25",
  };

  if (!debateData && !isStarting) {
    return (
      <div className="h-screen flex flex-col relative overflow-x-hidden">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[500px] bg-white/[0.015] blur-[140px] rounded-full pointer-events-none" />

        <div className="flex-1 flex flex-col items-center p-6 pt-12 overflow-y-auto min-h-0">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="w-full max-w-4xl space-y-8 z-10"
        >
          {/* Header */}
          <div className="text-center space-y-4">
            {/* Network bug — top of screen like a real broadcast */}
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-red-400">Live Broadcast</span>
              <span className="text-white/20 text-[10px]">·</span>
              <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">ArgueTV News Network</span>
            </div>

            <h1 className="text-6xl md:text-8xl font-bold tracking-tighter text-glow">ArgueTV</h1>

            {/* News-network tagline */}
            <div className="space-y-1">
              <p className="text-lg md:text-xl text-white/70 font-medium tracking-wide">
                Where AI News Anchors Debate Breaking Stories Live
              </p>
              <p className="text-xs text-white/35 uppercase tracking-[0.2em] font-light">
                Powered by Live Web Research · Fact-Checked · Real Voices
              </p>
            </div>
          </div>

          {/* Custom topic input */}
          <form onSubmit={handleStart} className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-agent1/20 to-agent2/20 rounded-2xl blur opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition duration-500" />
            <div className="relative flex items-center bg-card border border-border rounded-2xl p-2 shadow-2xl">
              <div className="pl-4 text-muted-foreground">
                <Mic className="w-5 h-5" />
              </div>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Or type any topic to debate…"
                className="w-full bg-transparent border-none outline-none text-foreground text-lg px-4 py-3.5 placeholder:text-muted-foreground/50"
                autoFocus
              />
              <button
                type="submit"
                disabled={!topic.trim()}
                className="bg-white text-black px-6 py-3 rounded-xl font-medium flex items-center gap-2 hover:bg-gray-200 disabled:opacity-50 disabled:hover:bg-white transition-all active:scale-95 shrink-0"
              >
                Start Debate
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </form>

          {/* Language Selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/50 uppercase tracking-widest">
              <span>🌐</span>
              <span>Debate Language</span>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {LANGUAGES.map((lang) => {
                const isSelected = selectedLanguage === lang.code;
                return (
                  <motion.button
                    key={lang.code}
                    onClick={() => setSelectedLanguage(lang.code)}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border
                      ${isSelected
                        ? "bg-white/10 border-white/30 text-white"
                        : "bg-white/3 border-white/8 text-white/40 hover:text-white/70 hover:border-white/20"
                      }`}
                  >
                    <span>{lang.flag}</span>
                    <span>{lang.label}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* ── LIVE NEWS SECTION ── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                </span>
                <span className="text-xs font-bold text-red-400 uppercase tracking-[0.2em]">Live News</span>
                <span className="text-xs text-muted-foreground/40">· Click any story to start a debate</span>
              </div>
              <div className="flex items-center gap-2">
                {/* Country selector */}
                <div className="relative">
                  <select
                    value={newsCountry}
                    onChange={(e) => setNewsCountry(e.target.value)}
                    className="appearance-none bg-white/[0.04] border border-white/10 text-white/60 text-[11px] rounded-lg pl-2 pr-6 py-1 hover:bg-white/[0.07] hover:text-white/80 transition-colors cursor-pointer focus:outline-none focus:border-white/25"
                  >
                    {NEWS_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code} className="bg-neutral-900 text-white">
                        {c.flag} {c.label}
                      </option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-white/30 text-[9px]">▾</span>
                </div>

                {/* Refresh */}
                {!isNewsLoading && liveNews.length > 0 && (
                  <button
                    onClick={() => {
                      setIsNewsLoading(true);
                      fetchLiveNews(1, newsCountry)
                        .then((r) => { setLiveNews(r.news); setHasMoreNews(r.hasMore ?? false); setNewsPage(1); })
                        .catch(() => {})
                        .finally(() => setIsNewsLoading(false));
                    }}
                    className="text-xs text-muted-foreground/40 hover:text-white/60 transition-colors flex items-center gap-1"
                  >
                    <Activity className="w-3 h-3" />
                    Refresh
                  </button>
                )}
              </div>
            </div>

            {/* ── Category filter pills ── */}
            {!isNewsLoading && liveNews.length > 0 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {NEWS_CATEGORIES.map((cat) => (
                  <button
                    key={cat.code}
                    onClick={() => setNewsCategory(cat.code)}
                    className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border transition-all duration-150 ${
                      newsCategory === cat.code ? cat.active : cat.inactive + " hover:text-white/60 hover:border-white/15"
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            )}

            {isNewsLoading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 space-y-3 animate-pulse">
                    <div className="h-4 w-20 rounded-full bg-white/5" />
                    <div className="space-y-2">
                      <div className="h-4 w-full rounded bg-white/5" />
                      <div className="h-4 w-4/5 rounded bg-white/5" />
                    </div>
                    <div className="h-3 w-3/5 rounded bg-white/5" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(liveNews.length > 0 ? liveNews : [
                  { title: "AI threatens millions of jobs", snippet: "Automation outpaces job creation globally", source: "Tech Insider", category: "Technology", debateTopic: "Should AI development be regulated to protect jobs?" },
                  { title: "Central banks raise rates again", snippet: "Economists split on recession risk", source: "Financial Times", category: "Business", debateTopic: "Are interest rate hikes hurting working people?" },
                  { title: "Climate summit ends in stalemate", snippet: "Nations failed on binding emissions targets", source: "Reuters", category: "Science", debateTopic: "Should wealthy nations pay climate reparations?" },
                  { title: "Social media age ban proposed", snippet: "Lawmakers push to ban teens from platforms", source: "BBC News", category: "Society", debateTopic: "Should social media be banned for under-16s?" },
                  { title: "Crypto market hits new record", snippet: "Bitcoin surges on institutional buying", source: "CoinDesk", category: "Business", debateTopic: "Will cryptocurrency replace traditional banking?" },
                  { title: "Immigration sparks street protests", snippet: "New border rules draw mass demonstrations", source: "AP News", category: "Politics", debateTopic: "Should countries have stricter immigration policies?" },
                ]).filter((item) => newsCategory === "all" || item.category === newsCategory).map((item, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.4 }}
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleDebateNews(item)}
                    className="group relative text-left rounded-2xl border border-white/8 bg-white/[0.025] hover:bg-white/[0.05] hover:border-white/15 p-4 space-y-3 transition-all duration-200 overflow-hidden"
                  >
                    {/* Subtle hover glow */}
                    <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />

                    <div className="flex items-start justify-between gap-2 relative z-10">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border ${CATEGORY_COLORS[item.category] ?? "bg-white/10 text-white/50 border-white/10"}`}>
                        {item.category}
                      </span>
                      <span className="text-[10px] text-muted-foreground/40 shrink-0 mt-0.5">{item.source}</span>
                    </div>

                    <div className="space-y-1.5 relative z-10">
                      <p className="text-sm font-semibold text-white/90 leading-snug group-hover:text-white transition-colors">
                        {item.title}
                      </p>
                      <p className="text-xs text-muted-foreground/60 leading-relaxed line-clamp-2">
                        {item.snippet}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-1 relative z-10">
                      <span className="text-[11px] text-muted-foreground/40 italic line-clamp-1 flex-1 pr-2">
                        "{item.debateTopic}"
                      </span>
                      <span className="shrink-0 flex items-center gap-1 text-[11px] font-medium text-white/40 group-hover:text-white/80 transition-colors">
                        Debate
                        <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </div>
                  </motion.button>
                ))}
              </div>
            )}

            {/* ── Empty state when category filter has no matches yet ── */}
            {!isNewsLoading && !isLoadingMoreNews && newsCategory !== "all" &&
              liveNews.filter((n) => n.category === newsCategory).length === 0 && liveNews.length > 0 && (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <p className="text-sm text-white/40">No <span className="text-white/60 font-medium">{newsCategory}</span> stories in this batch</p>
                <p className="text-xs text-white/25">{hasMoreNews ? "Loading more articles…" : "Try a different country or category"}</p>
              </div>
            )}

            {/* ── Load-more skeleton (3 cards while fetching next page) ── */}
            {isLoadingMoreNews && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 space-y-3 animate-pulse">
                    <div className="h-4 w-20 rounded-full bg-white/5" />
                    <div className="space-y-2">
                      <div className="h-4 w-full rounded bg-white/5" />
                      <div className="h-4 w-4/5 rounded bg-white/5" />
                    </div>
                    <div className="h-3 w-3/5 rounded bg-white/5" />
                  </div>
                ))}
              </div>
            )}

            {/* ── Sentinel — triggers IntersectionObserver ── */}
            <div ref={newsLoadMoreRef} className="h-1" />

            {/* ── All caught up ── */}
            {!hasMoreNews && !isNewsLoading && liveNews.length > 0 && (
              <p className="text-center text-[11px] text-muted-foreground/25 py-3 tracking-widest uppercase">
                All stories loaded · {liveNews.length} articles
              </p>
            )}
          </div>

          {/* Trending topics — secondary */}
          <div className="space-y-2.5 pb-8">
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground/40 uppercase tracking-widest">
              <TrendingUp className="w-3 h-3" />
              <span>Trending</span>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {isTrendingLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="h-7 w-32 rounded-full bg-white/5 animate-pulse" />
                  ))
                : (trendingTopics.length > 0
                    ? trendingTopics
                    : ["Universal Basic Income", "Remote Work vs Office", "Nuclear Energy"]
                  ).map((t) => (
                    <motion.button
                      key={t}
                      type="button"
                      whileHover={{ scale: 1.04 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => setTopic(t)}
                      className="text-xs text-muted-foreground/50 hover:text-white transition-colors border border-border/30 rounded-full px-4 py-1.5 hover:bg-white/5 hover:border-white/15"
                    >
                      {t}
                    </motion.button>
                  ))}
            </div>
          </div>
        </motion.div>
        </div>

      {/* Live ticker pinned at the very bottom */}
      <LiveNewsTicker />
    </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. LOADING STATE — cinematic progress bar
  // ─────────────────────────────────────────────────────────────────────────
  if (isStarting) {
    const currentStep = LOAD_STEPS[loadStepIdx];
    const isLastStep = loadStepIdx === LOAD_STEPS.length - 1;

    return (
      <div className="min-h-screen flex flex-col items-center justify-center overflow-hidden px-6">
        <FloatingParticles />
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative flex flex-col items-center gap-10 w-full max-w-md"
        >
          {/* Network bug */}
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-red-600 text-white text-[10px] font-bold tracking-widest uppercase">
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              LIVE
            </span>
            <span className="text-xs text-white/40 font-medium tracking-widest uppercase">ArgueTV News Network</span>
          </div>

          {/* Headline */}
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-semibold tracking-tight">Preparing the Debate</h2>
            <p className="text-sm text-white/40">
              Topic: <span className="text-white/70 italic">{topic}</span>
            </p>
          </div>

          {/* Step list */}
          <div className="w-full space-y-3">
            {LOAD_STEPS.map((step, i) => {
              const isDone    = i < loadStepIdx;
              const isCurrent = i === loadStepIdx;
              return (
                <motion.div
                  key={step.label}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.3 }}
                  className={`flex items-center gap-3 text-sm transition-colors duration-500 ${
                    isDone    ? "text-white/35 line-through" :
                    isCurrent ? "text-white font-medium"    :
                                "text-white/20"
                  }`}
                >
                  <span className="shrink-0 w-4 h-4 flex items-center justify-center">
                    {isDone ? (
                      <svg viewBox="0 0 14 14" className="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M2 7l4 4 6-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : isCurrent ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-white/20" />
                    )}
                  </span>
                  {step.label}
                </motion.div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="w-full space-y-2">
            <div className="relative h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
              <motion.div
                className={`absolute inset-y-0 left-0 rounded-full ${isLastStep ? "bg-red-500" : "bg-white"}`}
                animate={{ width: `${loadProgress}%` }}
                transition={{ duration: 0.12, ease: "linear" }}
              />
              {/* shimmer */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_1.5s_infinite]" />
            </div>
            <div className="flex justify-between text-[10px] text-white/30 tabular-nums">
              <span>{currentStep?.label ?? "Preparing…"}</span>
              <span>{Math.round(loadProgress)}%</span>
            </div>
          </div>

          {/* Pulse ring (decorative) */}
          <motion.div
            className="absolute -z-10 w-64 h-64 rounded-full border border-white/5"
            animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.1, 0.4] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
        </motion.div>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3 & 4. DEBATE & VOTING STATE
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="h-screen flex flex-col bg-black overflow-x-hidden">
      {/* Fact-Check Overlay */}
      <FactCheckOverlay state={factCheckState} onDismiss={dismissFactCheck} />

      {/* Top Bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-background/80 backdrop-blur-md z-50">
        <div className="flex items-center gap-3">
          <Activity className="w-5 h-5 text-white" />
          <span className="font-bold tracking-tight">ArgueTV</span>
        </div>
        <div className="flex items-center gap-3">
          {/* Screen Record controls */}
          <AnimatePresence mode="wait">
            {recorderStatus === "idle" && status !== "completed" && (
              <motion.button
                key="record-start"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={startRecording}
                title="Record this debate as a video"
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-border hover:bg-white/10 transition-colors text-xs font-medium"
              >
                <Video className="w-3.5 h-3.5" />
                Record
              </motion.button>
            )}

            {recorderStatus === "requesting" && (
              <motion.div
                key="record-requesting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-border text-xs text-muted-foreground"
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Waiting…
              </motion.div>
            )}

            {isRecording && (
              <motion.button
                key="record-stop"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={stopRecording}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/15 border border-red-500/40 hover:bg-red-500/25 transition-colors text-xs font-medium text-red-400"
              >
                <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                Recording · Stop
              </motion.button>
            )}

            {hasVideo && (
              <motion.button
                key="record-download"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={downloadVideo}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/15 border border-violet-500/40 hover:bg-violet-500/25 transition-colors text-xs font-medium text-violet-300"
              >
                <Film className="w-3.5 h-3.5" />
                Download Video
              </motion.button>
            )}
          </AnimatePresence>

          {/* Error tooltip */}
          {recorderError && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-red-400 max-w-[160px] truncate"
              title={recorderError}
            >
              {recorderError}
            </motion.span>
          )}

          {/* Fact Check Button — visible during live debate */}
          {status !== "completed" && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleFactCheck}
              disabled={isFactChecking}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 hover:bg-emerald-500/20 transition-colors text-xs font-medium text-emerald-400 disabled:opacity-50"
            >
              {isFactChecking ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ShieldCheck className="w-3.5 h-3.5" />
              )}
              {isFactChecking ? "Checking…" : "Fact Check"}
            </motion.button>
          )}

          {status === "completed" && (
            <>
              {/* Download */}
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={downloadDebate}
                disabled={!hasRecording}
                title="Download debate audio"
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-border hover:bg-white/10 transition-colors text-xs font-medium disabled:opacity-40"
              >
                <Download className="w-3.5 h-3.5" />
                Download
              </motion.button>

              {/* Share */}
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleShare}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-border hover:bg-white/10 transition-colors text-xs font-medium"
              >
                {copied ? (
                  <>
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5" />
                    Share
                  </>
                )}
              </motion.button>
            </>
          )}
          <div className="flex items-center gap-2 px-3 py-1 bg-red-500/10 border border-red-500/20 rounded-full">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-medium text-red-500 tracking-widest uppercase">Live</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col px-4 py-3 max-w-[1600px] w-full mx-auto min-h-0">

        {/* Compact topic + round strip */}
        <div className="flex items-center justify-center gap-3 mb-3 flex-wrap">
          {(() => {
            const lang = LANGUAGES.find((l) => l.code === selectedLanguage);
            return lang && lang.code !== "English" ? (
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-white/8 border border-white/12 text-white/50">
                {lang.flag} {lang.label}
              </span>
            ) : null;
          })()}
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm md:text-base font-semibold text-white/80 tracking-tight truncate max-w-[420px]"
          >
            {debateData?.topic}
          </motion.p>
          <span className="text-white/20 text-xs hidden sm:inline">·</span>
          <div style={{ perspective: "400px" }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={`${currentRoundIndex}-${status}`}
                initial={{ rotateX: -50, opacity: 0 }}
                animate={{ rotateX: 0, opacity: 1 }}
                exit={{ rotateX: 50, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-muted-foreground"
              >
                {status === "completed" ? (
                  "Debate Concluded"
                ) : (
                  <>
                    <span className="text-white font-semibold">Round {currentRoundIndex + 1}/{debateData?.rounds.length}</span>
                    <span className="w-0.5 h-3 rounded-full bg-white/20" />
                    <span>{currentRoundData?.roundName}</span>
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Split Screen Debate or Voting */}
        <div className="flex-1 relative min-h-0">
          <AnimatePresence mode="wait">
            {status !== "completed" ? (
              <motion.div
                key="debate"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="absolute inset-0 flex flex-col md:flex-row gap-3 md:gap-5"
              >
                <motion.div
                  className="flex-1 min-h-0"
                  animate={{
                    scale: currentSpeaker === "agent1" ? 1.015 : 0.975,
                    opacity: currentSpeaker === "agent1" ? 1 : 0.38,
                  }}
                  transition={{ type: "spring", stiffness: 200, damping: 26 }}
                >
                  <AgentCard
                    agent="agent1"
                    name="Alex Mercer"
                    role="In Favor"
                    text={currentRoundData?.agent1 || ""}
                    isActive={currentSpeaker === "agent1"}
                    isAudioLoading={currentSpeaker === "agent1" && isAudioLoading}
                  />
                </motion.div>

                <VsDivider currentSpeaker={currentSpeaker} />

                <motion.div
                  className="flex-1 min-h-0"
                  animate={{
                    scale: currentSpeaker === "agent2" ? 1.015 : 0.975,
                    opacity: currentSpeaker === "agent2" ? 1 : 0.38,
                  }}
                  transition={{ type: "spring", stiffness: 200, damping: 26 }}
                >
                  <AgentCard
                    agent="agent2"
                    name="Jordan Blake"
                    role="Against"
                    text={currentRoundData?.agent2 || ""}
                    isActive={currentSpeaker === "agent2"}
                    isAudioLoading={currentSpeaker === "agent2" && isAudioLoading}
                  />
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key="voting"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute inset-0 overflow-y-auto flex flex-col items-center py-4"
              >
                <div className="max-w-2xl w-full space-y-8">

                  {/* AI Fact-Check Verdict */}
                  {(isVerdictLoading || verdictData || verdictError) && (
                    <DebateVerdictPanel
                      isLoading={isVerdictLoading}
                      data={verdictData}
                      error={verdictError}
                    />
                  )}

                  {/* Highlight Reel */}
                  {debateData && debateData.rounds.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground/60 uppercase tracking-widest">
                        <PlayCircle className="w-3.5 h-3.5" />
                        <span>Debate Highlights</span>
                      </div>
                      <div className="space-y-3">
                        {debateData.rounds.map((round, i) => {
                          const isOdd = i % 2 === 0;
                          const agentName = isOdd ? "Alex Mercer" : "Jordan Blake";
                          const agentKey = isOdd ? "agent1" : "agent2";
                          const argText = isOdd ? round.agent1 : round.agent2;
                          const colorClass = isOdd ? "border-agent1/20 bg-agent1/5" : "border-agent2/20 bg-agent2/5";
                          const textColor = isOdd ? "text-agent1" : "text-agent2";
                          return (
                            <motion.div
                              key={i}
                              initial={{ opacity: 0, x: isOdd ? -20 : 20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.1, duration: 0.4 }}
                              className={`rounded-2xl border p-4 ${colorClass}`}
                            >
                              <div className="flex items-start justify-between gap-3 mb-2">
                                <div>
                                  <span className={`text-xs font-bold uppercase tracking-widest ${textColor}`}>{agentName}</span>
                                  <span className="text-xs text-muted-foreground ml-2">· {round.roundName}</span>
                                </div>
                                <ReplayButton text={argText} voice={agentKey} />
                              </div>
                              <p className="text-sm text-white/80 leading-relaxed">
                                "{argText.slice(0, 160)}{argText.length > 160 ? "…" : ""}"
                              </p>
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Voting */}
                  <div className="bg-card border border-border rounded-3xl p-8 text-center shadow-2xl">
                    <h2 className="text-3xl font-bold mb-2">Who won the debate?</h2>
                    <p className="text-muted-foreground mb-8">Cast your vote based on the arguments presented.</p>

                    {vote ? (
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="py-10 bg-white/5 rounded-2xl border border-white/10 space-y-4"
                      >
                        <h3 className="text-2xl font-semibold">Vote Recorded</h3>
                        <p className="text-muted-foreground text-sm">The community results will be available shortly.</p>
                        <div className="flex flex-wrap justify-center gap-3 pt-2">
                          {hasVideo && (
                            <button
                              onClick={downloadVideo}
                              className="flex items-center gap-2 px-4 py-2 rounded-full border border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20 transition-colors text-sm text-violet-300 font-medium"
                            >
                              <Film className="w-4 h-4" />
                              Download Video
                            </button>
                          )}
                          <button
                            onClick={downloadDebate}
                            disabled={!hasRecording}
                            className="flex items-center gap-2 px-4 py-2 rounded-full border border-border hover:bg-white/5 transition-colors text-sm disabled:opacity-40"
                          >
                            <Download className="w-4 h-4" />
                            Download Audio
                          </button>
                          <button
                            onClick={handleShare}
                            className="flex items-center gap-2 px-4 py-2 rounded-full border border-border hover:bg-white/5 transition-colors text-sm"
                          >
                            <Share2 className="w-4 h-4" />
                            {copied ? "Copied!" : "Share"}
                          </button>
                          <button
                            onClick={() => window.location.reload()}
                            className="text-sm text-muted-foreground hover:text-white transition-colors px-4 py-2"
                          >
                            New Debate
                          </button>
                        </div>
                      </motion.div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => setVote("agent1")}
                          className="group relative p-6 rounded-2xl border border-border bg-black hover:border-agent1/50 transition-colors duration-300 text-left overflow-hidden"
                        >
                          <div className="absolute inset-0 bg-agent1/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <h3 className="text-xl font-bold mb-1">Alex Mercer</h3>
                          <p className="text-sm text-muted-foreground">In Favor</p>
                        </motion.button>

                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => setVote("agent2")}
                          className="group relative p-6 rounded-2xl border border-border bg-black hover:border-agent2/50 transition-colors duration-300 text-left overflow-hidden"
                        >
                          <div className="absolute inset-0 bg-agent2/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <h3 className="text-xl font-bold mb-1">Jordan Blake</h3>
                          <p className="text-sm text-muted-foreground">Against</p>
                        </motion.button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Live News Ticker — real articles from RSS feeds, auto-refreshing */}
      <LiveNewsTicker />
    </div>
  );
}
