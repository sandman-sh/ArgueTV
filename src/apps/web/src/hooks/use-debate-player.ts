import { useState, useEffect, useRef, useCallback } from 'react';
import { useGenerateAudio } from '@workspace/api-client-react';
import type { DebateRound } from '@workspace/api-client-react';

export function useDebatePlayer(rounds: DebateRound[] | undefined, isReady: boolean, language = "English") {
  const [status, setStatus] = useState<'idle' | 'playing' | 'completed'>('idle');
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0);
  const [currentSpeaker, setCurrentSpeaker] = useState<'agent1' | 'agent2'>('agent1');
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [lastCompletedRoundIndex, setLastCompletedRoundIndex] = useState(-1);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recordedBlobsRef = useRef<Blob[]>([]);
  // prefetch slot: promise for the NEXT turn's blob, keyed by turn index
  const prefetchRef = useRef<Map<number, Promise<Blob>>>(new Map());
  const { mutateAsync: generateAudio } = useGenerateAudio();
  const generateAudioRef = useRef(generateAudio);
  generateAudioRef.current = generateAudio;

  // ── Start when ready ──────────────────────────────────────────────────────
  useEffect(() => {
    if (isReady && rounds && rounds.length > 0 && status === 'idle') {
      setStatus('playing');
      setCurrentRoundIndex(0);
      setCurrentSpeaker('agent1');
      recordedBlobsRef.current = [];
      prefetchRef.current.clear();
    }
  }, [isReady, rounds, status]);

  // ── Playback ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'playing' || !rounds) return;

    let isCancelled = false;

    // Build a flat ordered turn list: [r0a1, r0a2, r1a1, r1a2, r2a1, r2a2]
    const turns = rounds.flatMap((round, ri) => [
      { ri, speaker: 'agent1' as const, text: round.agent1 },
      { ri, speaker: 'agent2' as const, text: round.agent2 },
    ]);

    const turnIndex = currentSpeaker === 'agent1'
      ? currentRoundIndex * 2
      : currentRoundIndex * 2 + 1;

    if (turnIndex >= turns.length) {
      setStatus('completed');
      return;
    }

    const fetchBlob = (idx: number): Promise<Blob> => {
      const cached = prefetchRef.current.get(idx);
      if (cached) return cached;

      const turn = turns[idx];
      if (!turn) return Promise.reject(new Error('out of range'));

      const p = generateAudioRef.current({
        data: { text: turn.text, voice: turn.speaker, language } as { text: string; voice: string },
      }).then((res) => {
        const byteStr = atob(res.audioBase64);
        const bytes = new Uint8Array(byteStr.length);
        for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i);
        return new Blob([bytes], { type: res.mimeType });
      });

      prefetchRef.current.set(idx, p);
      return p;
    };

    const playTurn = async () => {
      const turn = turns[turnIndex];
      setIsAudioLoading(true);

      let blob: Blob;
      try {
        blob = await fetchBlob(turnIndex);
      } catch (err) {
        console.error('Audio fetch failed, skipping', err);
        if (isCancelled) return;
        setIsAudioLoading(false);
        // Skip this turn after a short delay
        setTimeout(() => { if (!isCancelled) advanceTurn(turn.ri, turn.speaker); }, 3000);
        return;
      }

      if (isCancelled) return;

      // Kick off prefetch of NEXT turn while current plays (max 1 ahead)
      if (turnIndex + 1 < turns.length) {
        fetchBlob(turnIndex + 1).catch(() => {/* will retry inline */});
      }

      recordedBlobsRef.current.push(blob);
      const url = URL.createObjectURL(blob);

      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }

      const audio = new Audio(url);
      audioRef.current = audio;
      setIsAudioLoading(false);

      try {
        await audio.play();
        audio.onended = () => {
          if (isCancelled) return;
          URL.revokeObjectURL(url);
          advanceTurn(turn.ri, turn.speaker);
        };
      } catch {
        if (!isCancelled) {
          setTimeout(() => { if (!isCancelled) advanceTurn(turn.ri, turn.speaker); }, 3000);
        }
      }
    };

    const advanceTurn = (ri: number, speaker: 'agent1' | 'agent2') => {
      if (speaker === 'agent1') {
        setCurrentSpeaker('agent2');
      } else {
        setLastCompletedRoundIndex(ri);
        setCurrentSpeaker('agent1');
        setCurrentRoundIndex(ri + 1);
      }
    };

    playTurn();

    return () => {
      isCancelled = true;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRoundIndex, currentSpeaker, status, rounds]);

  const downloadDebate = useCallback(() => {
    const blobs = recordedBlobsRef.current;
    if (blobs.length === 0) return;
    const combined = new Blob(blobs, { type: 'audio/mpeg' });
    const url = URL.createObjectURL(combined);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'arguetv-debate.mp3';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, []);

  return {
    status,
    currentRoundIndex,
    currentSpeaker,
    isAudioLoading,
    currentRoundData: rounds?.[currentRoundIndex],
    lastCompletedRoundIndex,
    hasRecording: recordedBlobsRef.current.length > 0,
    downloadDebate,
  };
}
