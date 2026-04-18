import { motion, AnimatePresence } from "framer-motion";
import { Loader2, ShieldCheck } from "lucide-react";
import type { DebateVerdictResult, VerdictClaim } from "../lib/api";

interface DebateVerdictPanelProps {
  isLoading: boolean;
  data: DebateVerdictResult | null;
  error: string | null;
}

const VERDICT_CONFIG = {
  TRUE: {
    icon: "✅",
    label: "TRUE",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/25",
    text: "text-emerald-400",
    badge: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  },
  MISLEADING: {
    icon: "⚠️",
    label: "MISLEADING",
    bg: "bg-amber-500/10",
    border: "border-amber-500/25",
    text: "text-amber-400",
    badge: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  },
  FALSE: {
    icon: "❌",
    label: "FALSE",
    bg: "bg-red-500/10",
    border: "border-red-500/25",
    text: "text-red-400",
    badge: "bg-red-500/15 text-red-300 border-red-500/30",
  },
};

const SPEAKER_COLOR: Record<string, string> = {
  "Alex Mercer": "text-[hsl(250,100%,65%)]",
  "Jordan Blake": "text-[hsl(30,100%,55%)]",
};

function ClaimCard({ claim, index }: { claim: VerdictClaim; index: number }) {
  const cfg = VERDICT_CONFIG[claim.verdict];
  const speakerColor = SPEAKER_COLOR[claim.speaker] ?? "text-white";

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.07, duration: 0.35, ease: "easeOut" }}
      className={`rounded-2xl border p-4 ${cfg.bg} ${cfg.border}`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className={`text-xs font-bold uppercase tracking-widest ${speakerColor}`}>
          {claim.speaker}
        </span>
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border ${cfg.badge} shrink-0`}>
          <span>{cfg.icon}</span>
          {cfg.label}
        </span>
      </div>
      <p className="text-sm text-white/85 font-medium leading-snug mb-1.5">
        "{claim.claimText}"
      </p>
      <p className="text-xs text-white/45 leading-relaxed">{claim.explanation}</p>
    </motion.div>
  );
}

function SkeletonCard({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.06 }}
      className="rounded-2xl border border-white/8 bg-white/3 p-4 space-y-2.5"
    >
      <div className="flex justify-between">
        <div className="h-3 w-24 rounded-full bg-white/10 animate-pulse" />
        <div className="h-5 w-20 rounded-full bg-white/8 animate-pulse" />
      </div>
      <div className="h-4 w-full rounded-full bg-white/8 animate-pulse" />
      <div className="h-3 w-3/4 rounded-full bg-white/5 animate-pulse" />
    </motion.div>
  );
}

export function DebateVerdictPanel({ isLoading, data, error }: DebateVerdictPanelProps) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground/60 uppercase tracking-widest">
        <ShieldCheck className="w-3.5 h-3.5" />
        <span>AI Fact Check</span>
        {isLoading && <Loader2 className="w-3 h-3 animate-spin ml-1 text-emerald-400/60" />}
      </div>

      <AnimatePresence mode="wait">
        {isLoading && (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} index={i} />
            ))}
            <div className="text-xs text-center text-white/30 pt-1 flex items-center justify-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" />
              Firecrawl researching claims…
            </div>
          </motion.div>
        )}

        {!isLoading && error && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-400/70 text-center"
          >
            Could not load fact check. {error}
          </motion.div>
        )}

        {!isLoading && data && data.claims.length > 0 && (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-3"
          >
            {/* Alex claims */}
            {data.claims
              .filter((c) => c.speaker === "Alex Mercer")
              .map((claim, i) => (
                <ClaimCard key={`agent1-${i}`} claim={claim} index={i} />
              ))}

            {/* Separator */}
            <div className="flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-white/8" />
              <span className="text-[10px] uppercase tracking-widest text-white/25 font-medium">vs</span>
              <div className="flex-1 h-px bg-white/8" />
            </div>

            {/* Jordan claims */}
            {data.claims
              .filter((c) => c.speaker === "Jordan Blake")
              .map((claim, i) => (
                <ClaimCard key={`agent2-${i}`} claim={claim} index={i + 3} />
              ))}

            {/* AI Summary */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55, duration: 0.4 }}
              className="rounded-2xl border border-white/10 bg-white/3 p-5 mt-2"
            >
              <div className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-2">
                AI Verdict
              </div>
              <p className="text-sm text-white/70 leading-relaxed">{data.summary}</p>

              {/* Claim count tallies */}
              {(() => {
                const marcus = data.claims.filter((c) => c.speaker === "Alex Mercer");
                const elena = data.claims.filter((c) => c.speaker === "Jordan Blake");
                const score = (claims: typeof marcus) => ({
                  true: claims.filter((c) => c.verdict === "TRUE").length,
                  misleading: claims.filter((c) => c.verdict === "MISLEADING").length,
                  false: claims.filter((c) => c.verdict === "FALSE").length,
                });
                const ms = score(marcus);
                const es = score(elena);
                return (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {[
                      { name: "Alex Mercer", s: ms, color: "text-[hsl(250,100%,65%)]" },
                      { name: "Jordan Blake", s: es, color: "text-[hsl(30,100%,55%)]" },
                    ].map(({ name, s, color }) => (
                      <div key={name} className="space-y-1.5">
                        <div className={`text-xs font-bold ${color}`}>{name.split(" ")[0]}</div>
                        <div className="flex gap-2 text-xs text-white/50">
                          <span>✅ {s.true}</span>
                          <span>⚠️ {s.misleading}</span>
                          <span>❌ {s.false}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
