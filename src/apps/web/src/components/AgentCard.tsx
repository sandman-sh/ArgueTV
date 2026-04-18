import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { Waveform } from "./Waveform";

interface AgentCardProps {
  agent: "agent1" | "agent2";
  name: string;
  role: string;
  text: string;
  isActive: boolean;
  isAudioLoading: boolean;
}

const AGENT_COLORS = {
  agent1: {
    ring: "rgba(115, 60, 255, 0.6)",
    ringFaint: "rgba(115, 60, 255, 0.25)",
    text: "text-agent1",
    bg: "bg-agent1/15",
    gradient: "from-agent1/10 via-transparent",
    border: "border-agent1/30",
    glow: "shadow-[0_0_60px_rgba(115,60,255,0.18)]",
    waveform: "bg-agent1",
    badge: "bg-agent1/10 text-agent1 border-agent1/20",
  },
  agent2: {
    ring: "rgba(255, 136, 0, 0.6)",
    ringFaint: "rgba(255, 136, 0, 0.25)",
    text: "text-agent2",
    bg: "bg-agent2/15",
    gradient: "from-agent2/10 via-transparent",
    border: "border-agent2/30",
    glow: "shadow-[0_0_60px_rgba(255,136,0,0.18)]",
    waveform: "bg-agent2",
    badge: "bg-agent2/10 text-agent2 border-agent2/20",
  },
};

const WORDS_PER_SECOND = 2.8;
const MS_PER_WORD = 1000 / WORDS_PER_SECOND;

function LiveCaptions({
  text,
  isActive,
  isAudioLoading,
}: {
  text: string;
  isActive: boolean;
  isAudioLoading: boolean;
}) {
  const words = text.split(/\s+/).filter(Boolean);
  const [revealedCount, setRevealedCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textRef = useRef(text);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    if (text !== textRef.current) {
      textRef.current = text;
      setRevealedCount(0);
      clearTimer();
    }
  }, [text]);

  useEffect(() => {
    clearTimer();

    if (isActive && !isAudioLoading && words.length > 0) {
      // Always reset to 0 when this agent starts speaking — even if words were
      // already fully visible while inactive. This ensures word-by-word reveal.
      setRevealedCount(0);
      // Tiny delay so React paints the reset before the interval fires
      const startDelay = setTimeout(() => {
        timerRef.current = setInterval(() => {
          setRevealedCount((prev) => {
            if (prev >= words.length) {
              clearTimer();
              return prev;
            }
            return prev + 1;
          });
        }, MS_PER_WORD);
      }, 60);
      return () => {
        clearTimeout(startDelay);
        clearTimer();
      };
    } else if (!isActive) {
      setRevealedCount(0);
    }

    return clearTimer;
  }, [isActive, isAudioLoading, words.length]);

  if (words.length === 0) return null;

  return (
    <p className="text-sm md:text-base leading-relaxed text-center text-white/75 min-h-[3.5em]">
      {words.map((word, i) => {
        const visible = i < revealedCount;
        return (
          <motion.span
            key={`${text.slice(0, 8)}-${i}`}
            className="inline-block mr-[0.28em]"
            initial={false}
            animate={{
              opacity: visible ? 1 : 0,
              filter: visible ? "blur(0px)" : "blur(4px)",
              y: visible ? 0 : 6,
            }}
            transition={{
              duration: 0.22,
              ease: "easeOut",
            }}
          >
            {word}
          </motion.span>
        );
      })}
    </p>
  );
}

export function AgentCard({ agent, name, role, text, isActive, isAudioLoading }: AgentCardProps) {
  const c = AGENT_COLORS[agent];

  return (
    <motion.div
      className={`relative flex flex-col w-full h-full rounded-3xl overflow-hidden border
        ${isActive ? `${c.border} ${c.glow}` : "border-white/5"}
        bg-[#0a0a0a]
      `}
      layout
    >
      {/* Full-card ambient gradient — breathes when active */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            key="ambient"
            className={`absolute inset-0 pointer-events-none bg-gradient-to-b ${c.gradient} to-transparent`}
            initial={{ opacity: 0 }}
            animate={{ opacity: [0.6, 1, 0.6] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
      </AnimatePresence>

      {/* Top color strip */}
      <div className={`h-1 w-full ${isActive ? c.bg : "bg-white/5"} transition-colors duration-500`} />

      {/* Avatar section — hero of the card */}
      <div className="flex flex-col items-center justify-center flex-1 gap-5 px-6 pt-8 pb-4 relative z-10">

        {/* Avatar with pulsing rings */}
        <div className="relative flex items-center justify-center">
          {isActive && (
            <>
              <motion.span
                className="absolute rounded-full"
                style={{ inset: -20, border: `1px solid ${c.ringFaint}` }}
                initial={{ scale: 0.85, opacity: 0.7 }}
                animate={{ scale: 1.4, opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
              />
              <motion.span
                className="absolute rounded-full"
                style={{ inset: -10, border: `1px solid ${c.ring}` }}
                initial={{ scale: 0.9, opacity: 0.5 }}
                animate={{ scale: 1.25, opacity: 0 }}
                transition={{ duration: 2, repeat: Infinity, delay: 0.5, ease: "easeOut" }}
              />
            </>
          )}

          <motion.div
            className={`
              relative w-28 h-28 md:w-36 md:h-36 rounded-full
              flex items-center justify-center
              text-3xl md:text-4xl font-bold tracking-tight select-none z-10
              border-2
              ${isActive ? `${c.border} ${c.bg}` : "border-white/10 bg-white/5"}
            `}
            animate={{
              scale: isActive ? 1.04 : 0.96,
              boxShadow: isActive
                ? agent === "agent1"
                  ? "0 0 40px rgba(115,60,255,0.35), inset 0 0 30px rgba(115,60,255,0.1)"
                  : "0 0 40px rgba(255,136,0,0.35), inset 0 0 30px rgba(255,136,0,0.1)"
                : "0 0 0px transparent",
            }}
            transition={{ type: "spring", stiffness: 200, damping: 22 }}
          >
            <span className={isActive ? c.text : "text-white/30"}>
              {name.split(" ").map((n) => n[0]).join("")}
            </span>
          </motion.div>
        </div>

        {/* Name + role */}
        <div className="text-center space-y-1.5">
          <motion.h3
            className="text-xl md:text-2xl font-bold tracking-tight text-white"
            animate={{ opacity: isActive ? 1 : 0.4 }}
            transition={{ duration: 0.4 }}
          >
            {name}
          </motion.h3>
          <span className={`inline-block text-xs font-semibold uppercase tracking-widest px-3 py-1 rounded-full border ${isActive ? c.badge : "bg-white/5 text-white/30 border-white/10"} transition-colors duration-500`}>
            {role}
          </span>
        </div>

        {/* Waveform */}
        <div className="flex items-center justify-center h-8">
          <Waveform isActive={isActive} isLoading={isAudioLoading} color={c.waveform} />
        </div>
      </div>

      {/* Live caption zone */}
      <div className="relative px-6 pb-6 min-h-[100px] flex items-start justify-center z-10">
        <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-[#0a0a0a] to-transparent pointer-events-none" />

        <AnimatePresence mode="wait">
          {text ? (
            <motion.div
              key={text.slice(0, 20)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full"
            >
              <LiveCaptions text={text} isActive={isActive} isAudioLoading={isAudioLoading} />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center w-full py-2"
            >
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full bg-white/20"
                    animate={{ opacity: [0.2, 0.7, 0.2] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
