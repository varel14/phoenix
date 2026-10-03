import { useCallback, useEffect, useRef, useState } from "react";
import { RecordingPresets, requestRecordingPermissionsAsync, useAudioRecorder } from "expo-audio";

interface UseVoiceRecorderResult {
  /** Requested but not granted yet — show the French rationale. */
  permissionDenied: boolean;
  recording: boolean;
  elapsedSec: number;
  start: () => Promise<void>;
  /** Stops and returns the recorded file URI + duration (null on cancel/empty). */
  stop: () => Promise<{ uri: string; durationSec: number; mimeType: string } | null>;
  cancel: () => Promise<void>;
}

/** Voice note capture for SCL messages (French permission UX). */
export function useVoiceRecorder(): UseVoiceRecorderResult {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [recording, setRecording] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (tickerRef.current) clearInterval(tickerRef.current);
    };
  }, []);

  const start = useCallback(async () => {
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      setPermissionDenied(true);
      return;
    }
    setPermissionDenied(false);
    await recorder.prepareToRecordAsync();
    recorder.record();
    setRecording(true);
    setElapsedSec(0);
    tickerRef.current = setInterval(() => {
      setElapsedSec((value) => value + 1);
    }, 1000);
  }, [recorder]);

  const stop = useCallback(async () => {
    if (tickerRef.current) clearInterval(tickerRef.current);
    tickerRef.current = null;
    setRecording(false);
    const durationSec = Math.max(1, Math.round(recorder.currentTime ?? elapsedSec));
    await recorder.stop();
    const uri = recorder.uri;
    if (!uri) return null;
    return { uri, durationSec, mimeType: "audio/m4a" };
  }, [recorder, elapsedSec]);

  const cancel = useCallback(async () => {
    if (tickerRef.current) clearInterval(tickerRef.current);
    tickerRef.current = null;
    setRecording(false);
    await recorder.stop();
  }, [recorder]);

  return { permissionDenied, recording, elapsedSec, start, stop, cancel };
}
