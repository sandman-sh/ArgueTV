import { useState, useRef, useCallback } from 'react';

type RecorderStatus = 'idle' | 'requesting' | 'recording' | 'stopped';

export function useScreenRecorder() {
  const [status, setStatus] = useState<RecorderStatus>('idle');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    if (status === 'recording') return;
    setError(null);
    setVideoUrl(null);
    setStatus('requesting');

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: 30,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          sampleRate: 44100,
        },
      });

      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : 'video/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        setStatus('stopped');
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      stream.getVideoTracks()[0].onended = () => {
        if (recorder.state !== 'inactive') recorder.stop();
        setStatus('stopped');
      };

      recorder.start(1000);
      setStatus('recording');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('Permission denied') || msg.includes('NotAllowedError')) {
        setError('Screen sharing was cancelled.');
      } else {
        setError('Could not start recording. Try opening the app in a full tab.');
      }
      setStatus('idle');
    }
  }, [status]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
  }, []);

  const downloadVideo = useCallback(() => {
    if (!videoUrl) return;
    const a = document.createElement('a');
    a.href = videoUrl;
    a.download = `arguetv-debate-${Date.now()}.webm`;
    a.click();
  }, [videoUrl]);

  const reset = useCallback(() => {
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    setVideoUrl(null);
    setStatus('idle');
    setError(null);
    chunksRef.current = [];
  }, [videoUrl]);

  return {
    status,
    isRecording: status === 'recording',
    hasVideo: status === 'stopped' && !!videoUrl,
    error,
    startRecording,
    stopRecording,
    downloadVideo,
    reset,
  };
}
