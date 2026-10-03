import { create } from "zustand";
import type { MediaStream } from "react-native-webrtc";
import type { Call } from "@/types/chat";

export type CallPhase = "idle" | "outgoing" | "incoming" | "connecting" | "active" | "ended";

interface CallState {
  phase: CallPhase;
  call: Call | null;
  micOn: boolean;
  cameraOn: boolean;
  speakerOn: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  error: string | null;

  setPhase: (phase: CallPhase) => void;
  setCall: (call: Call) => void;
  setError: (error: string | null) => void;
  toggleMic: () => void;
  toggleCamera: () => void;
  toggleSpeaker: () => void;
  setLocalStream: (stream: MediaStream | null) => void;
  setRemoteStream: (stream: MediaStream | null) => void;
  reset: () => void;
}

export const useCallStore = create<CallState>((set) => ({
  phase: "idle",
  call: null,
  micOn: true,
  cameraOn: true,
  speakerOn: true,
  localStream: null,
  remoteStream: null,
  error: null,

  setPhase: (phase) => set({ phase }),
  setCall: (call) => set({ call }),
  setError: (error) => set({ error }),
  toggleMic: () =>
    set((state) => {
      state.localStream?.getAudioTracks().forEach((track) => {
        track.enabled = !state.micOn;
      });
      return { micOn: !state.micOn };
    }),
  toggleCamera: () =>
    set((state) => {
      state.localStream?.getVideoTracks().forEach((track) => {
        track.enabled = !state.cameraOn;
      });
      return { cameraOn: !state.cameraOn };
    }),
  toggleSpeaker: () => set((state) => ({ speakerOn: !state.speakerOn })),
  setLocalStream: (localStream) => set({ localStream }),
  setRemoteStream: (remoteStream) => set({ remoteStream }),
  reset: () =>
    set((state) => {
      state.localStream?.getTracks().forEach((track) => track.stop());
      state.remoteStream?.getTracks().forEach((track) => track.stop());
      return {
        phase: "idle",
        call: null,
        micOn: true,
        cameraOn: true,
        speakerOn: true,
        localStream: null,
        remoteStream: null,
        error: null,
      };
    }),
}));
