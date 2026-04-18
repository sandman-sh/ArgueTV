import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, Search, Brain, Zap } from "lucide-react";

interface ResearchTickerProps {
  topic: string;
}

function buildSteps(topic: string) {
  return [
    { icon: Search, text: `Searching web sources for "${topic}"…` },
    { icon: Globe, text: "Crawling news articles and research papers…" },
    { icon: Globe, text: "Analyzing recent expert opinions…" },
    { icon: Brain, text: "Extracting key arguments and evidence…" },
    { icon: Brain, text: "Building debate cases from live data…" },
    { icon: Zap, text: "Generating Round 1: Opening Statements…" },
    { icon: Zap, text: "Generating Round 2: Rebuttals…" },
    { icon: Zap, text: "Generating Round 3: Final Arguments…" },
  ];
}

export function ResearchTicker({ topic }: ResearchTickerProps) {
  const steps = buildSteps(topic);
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % steps.length);
    }, 1800);
    return () => clearInterval(interval);
  }, [steps.length]);

  const step = steps[currentIndex];
  const Icon = step.icon;

  return (
    <div className="flex flex-col items-center gap-3">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="flex items-center gap-3 text-muted-foreground"
        >
          <Icon className="w-4 h-4 flex-shrink-0 text-white/40" />
          <span className="text-sm font-light tracking-wide">{step.text}</span>
        </motion.div>
      </AnimatePresence>

      {/* Progress dots */}
      <div className="flex gap-1.5">
        {steps.map((_, i) => (
          <motion.div
            key={i}
            className="w-1 h-1 rounded-full"
            animate={{
              backgroundColor: i === currentIndex ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.15)",
              scale: i === currentIndex ? 1.4 : 1,
            }}
            transition={{ duration: 0.3 }}
          />
        ))}
      </div>
    </div>
  );
}
