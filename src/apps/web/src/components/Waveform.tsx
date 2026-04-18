import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";

interface WaveformProps {
  isActive: boolean;
  isLoading?: boolean;
  color?: string;
}

const BAR_COUNT = 10;
const CYCLE_MS = 450;

function randomHeights(): string[] {
  return Array.from({ length: BAR_COUNT }, () => `${Math.max(3, Math.random() * 22)}px`);
}

export function Waveform({ isActive, isLoading, color = "bg-white" }: WaveformProps) {
  const [heights, setHeights] = useState<string[]>(() => randomHeights());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (isActive && !isLoading) {
      intervalRef.current = setInterval(() => {
        setHeights(randomHeights());
      }, CYCLE_MS);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isActive, isLoading]);

  return (
    <div className="flex items-center gap-[2px] h-7 px-1">
      {Array.from({ length: BAR_COUNT }).map((_, i) => {
        if (isLoading && isActive) {
          const phase = i * 0.12;
          return (
            <motion.div
              key={i}
              className={`w-[2.5px] rounded-full ${color}`}
              initial={{ height: "3px", opacity: 0.3 }}
              animate={{
                height: ["3px", "10px", "6px", "14px", "3px"],
                opacity: [0.3, 0.7, 0.5, 0.9, 0.3],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: phase,
                ease: "easeInOut",
              }}
            />
          );
        }

        if (isActive) {
          return (
            <motion.div
              key={i}
              className={`w-[2.5px] rounded-full ${color}`}
              animate={{ height: heights[i] }}
              transition={{
                duration: CYCLE_MS / 1000,
                delay: i * 0.02,
                ease: "easeInOut",
              }}
            />
          );
        }

        return (
          <motion.div
            key={i}
            className={`w-[2.5px] rounded-full ${color}`}
            animate={{ height: "3px", opacity: 0.2 }}
            transition={{ duration: 0.4 }}
          />
        );
      })}
    </div>
  );
}
