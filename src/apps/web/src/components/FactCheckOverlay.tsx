import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, AlertCircle } from "lucide-react";

export interface FactCheckState {
  isVisible: boolean;
  isLoading: boolean;
  verdict: "TRUE" | "FALSE" | "DISPUTED" | null;
  explanation: string;
  claim: string;
  roundName: string;
  audioBase64: string | null;
  mimeType: string;
}

interface FactCheckOverlayProps {
  state: FactCheckState;
  onDismiss: () => void;
}

const VERDICT_CONFIG = {
  TRUE: {
    label: "CONFIRMED",
    icon: CheckCircle,
    color: "text-emerald-400",
    border: "border-emerald-500/30",
    glow: "rgba(52, 211, 153, 0.15)",
    bg: "bg-emerald-500/10",
    barColor: "bg-emerald-400",
  },
  FALSE: {
    label: "FALSE",
    icon: XCircle,
    color: "text-red-400",
    border: "border-red-500/30",
    glow: "rgba(248, 113, 113, 0.15)",
    bg: "bg-red-500/10",
    barColor: "bg-red-400",
  },
  DISPUTED: {
    label: "DISPUTED",
    icon: AlertCircle,
    color: "text-yellow-400",
    border: "border-yellow-500/30",
    glow: "rgba(250, 204, 21, 0.15)",
    bg: "bg-yellow-500/10",
    barColor: "bg-yellow-400",
  },
};

export function FactCheckOverlay({ state, onDismiss }: FactCheckOverlayProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (!state.isVisible || state.isLoading || !state.audioBase64) return;

    try {
      const byteStr = atob(state.audioBase64);
      const bytes = new Uint8Array(byteStr.length);
      for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i);
      const blob = new Blob([bytes], { type: state.mimeType });
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.play().catch(() => {});
      audio.onended = () => {
        URL.revokeObjectURL(url);
        setTimeout(onDismiss, 2000);
      };
    } catch {
      setTimeout(onDismiss, 4000);
    }

    return () => {
      audioRef.current?.pause();
    };
  }, [state.isVisible, state.isLoading, state.audioBase64]);

  // Auto-dismiss if no audio and not loading
  useEffect(() => {
    if (state.isVisible && !state.isLoading && !state.audioBase64) {
      const t = setTimeout(onDismiss, 5000);
      return () => clearTimeout(t);
    }

    return undefined;
  }, [state.isVisible, state.isLoading, state.audioBase64, onDismiss]);

  const cfg = state.verdict ? VERDICT_CONFIG[state.verdict] : null;
  const Icon = cfg?.icon ?? AlertCircle;

  return (
    <AnimatePresence>
      {state.isVisible && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={state.isLoading ? undefined : onDismiss}
          />

          {/* Card */}
          <motion.div
            className={`relative w-full max-w-lg mx-6 rounded-3xl border bg-black overflow-hidden shadow-2xl ${cfg?.border ?? "border-border"}`}
            style={{ boxShadow: cfg ? `0 0 80px 0 ${cfg.glow}` : undefined }}
            initial={{ scale: 0.85, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: -20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
          >
            {/* Top badge */}
            <div className="flex items-center gap-2 px-6 pt-6 pb-3 border-b border-border/40">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-bold text-red-400 tracking-widest uppercase">
                Live Fact Check
              </span>
              <span className="ml-auto text-xs text-muted-foreground">{state.roundName}</span>
            </div>

            <div className="p-6 space-y-5">
              {/* Claim */}
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Claim under review</p>
                <p className="text-sm text-white/80 italic leading-relaxed">
                  "{state.claim}"
                </p>
              </div>

              {/* Verdict */}
              <div className={`rounded-2xl p-5 ${cfg?.bg ?? "bg-white/5"} flex items-center gap-4`}>
                {state.isLoading ? (
                  <>
                    <div className="w-10 h-10 rounded-full border-2 border-white/20 border-t-white/70 animate-spin" />
                    <div className="space-y-2 flex-1">
                      <div className="h-3 w-24 rounded-full bg-white/10 animate-pulse" />
                      <div className="h-2 w-40 rounded-full bg-white/5 animate-pulse" />
                    </div>
                  </>
                ) : (
                  <>
                    <Icon className={`w-10 h-10 flex-shrink-0 ${cfg?.color ?? "text-white"}`} />
                    <div className="flex-1 min-w-0">
                      <p className={`text-2xl font-black tracking-widest ${cfg?.color ?? "text-white"}`}>
                        {cfg?.label ?? "ANALYZING"}
                      </p>
                      <p className="text-sm text-white/70 leading-relaxed mt-1">
                        {state.explanation}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Progress bar that fills while verdict is shown */}
              {!state.isLoading && (
                <motion.div className="h-[2px] w-full rounded-full bg-border overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${cfg?.barColor ?? "bg-white"}`}
                    initial={{ width: "0%" }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 6, ease: "linear" }}
                  />
                </motion.div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
