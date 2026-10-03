import InCallManager from "react-native-incall-manager";
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
  type MediaStream,
  type MediaStreamTrack,
} from "react-native-webrtc";
import { getSocket } from "../realtime/socket";
import { callsApi } from "../api/calls-api";
import { useCallStore } from "@/stores/call-store";
import { useAuthStore } from "@/stores/auth-store";
import type { Call } from "@/types/chat";

type IceCandidatePayload = {
  candidate?: string | null;
  sdpMLineIndex?: number | null;
  sdpMid?: string | null;
};

let peerConnection: RTCPeerConnection | null = null;

async function createPeerConnection(callId: string): Promise<RTCPeerConnection> {
  // TURN relay comes from the server (ephemeral credentials) — required to
  // connect peers behind symmetric NAT / carrier CGNAT.
  const iceServers = await callsApi.iceServers();
  const pc = new RTCPeerConnection({ iceServers });
  const store = useCallStore.getState();

  const localStream = store.localStream;
  if (localStream) {
    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
  }

  pc.ontrack = (event: { streams?: MediaStream[] }) => {
    const stream = event.streams?.[0];
    if (stream) useCallStore.getState().setRemoteStream(stream);
  };

  pc.onicecandidate = (event: { candidate: { toJSON(): IceCandidatePayload } | null }) => {
    if (event.candidate) {
      getSocket()?.emit("webrtc:ice-candidate", {
        callId,
        candidate: event.candidate.toJSON(),
      });
    }
  };

  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "connected") {
      useCallStore.getState().setPhase("active");
    }
  };

  peerConnection = pc;
  return pc;
}

async function acquireMedia(video: boolean): Promise<MediaStream> {
  const stream = await mediaDevices.getUserMedia({
    audio: true,
    video: video
      ? { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }
      : false,
  });
  useCallStore.getState().setLocalStream(stream);
  return stream;
}

function teardown(): void {
  peerConnection?.close();
  peerConnection = null;
  useCallStore.getState().reset();
}

const CALL_EVENTS = [
  "call:incoming",
  "call:accepted",
  "call:rejected",
  "call:ended",
  "webrtc:offer",
  "webrtc:answer",
  "webrtc:ice-candidate",
] as const;

function bindCallEvents(): void {
  const socket = getSocket();
  if (!socket) return;

  // Idempotent: a second bind on the same socket must not stack listeners.
  for (const event of CALL_EVENTS) socket.off(event);

  socket.on("call:incoming", ({ call }: { call: Call }) => {
    const store = useCallStore.getState();
    if (store.phase !== "idle") return;
    store.setCall(call);
    store.setPhase("incoming");
  });

  socket.on("call:accepted", ({ call }: { call: Call }) => {
    const store = useCallStore.getState();
    const currentUserId = useAuthStore.getState().user?.id;
    if (!store.call || store.call.id !== call.id) return;
    // Only the caller reacts: the callee (which emitted call:accept) waits
    // for the WebRTC offer instead.
    if (call.callerId !== currentUserId) return;
    store.setCall(call);
    void (async () => {
      try {
        store.setPhase("connecting");
        await acquireMedia(call.type === "VIDEO");
        InCallManager.start({ media: call.type === "VIDEO" ? "video" : "audio" });
        const pc = await createPeerConnection(call.id);
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: call.type === "VIDEO",
        });
        await pc.setLocalDescription(offer);
        socket.emit("webrtc:offer", { callId: call.id, sdp: offer.sdp });
      } catch (error) {
        useCallStore.getState().setError((error as Error).message);
        teardown();
      }
    })();
  });

  socket.on("call:rejected", ({ call }: { call: Call }) => {
    const store = useCallStore.getState();
    if (!store.call || store.call.id !== call.id) return;
    useCallStore.getState().setError("Appel refusé");
    teardown();
  });

  socket.on("call:ended", ({ call }: { call: Call }) => {
    const store = useCallStore.getState();
    if (!store.call || store.call.id !== call.id) return;
    store.setCall(call);
    teardown();
  });

  socket.on("webrtc:offer", ({ callId, sdp }: { callId: string; sdp?: string }) => {
    const store = useCallStore.getState();
    if (!store.call || store.call.id !== callId || !sdp) return;
    void (async () => {
      try {
        await acquireMedia(store.call!.type === "VIDEO");
        InCallManager.start({ media: store.call!.type === "VIDEO" ? "video" : "audio" });
        const pc = await createPeerConnection(callId);
        await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp }));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit("webrtc:answer", { callId, sdp: answer.sdp });
      } catch (error) {
        useCallStore.getState().setError((error as Error).message);
        teardown();
      }
    })();
  });

  socket.on("webrtc:answer", ({ callId, sdp }: { callId: string; sdp?: string }) => {
    const store = useCallStore.getState();
    if (!peerConnection || !sdp) return;
    if (!store.call || store.call.id !== callId) return;
    void peerConnection.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp }));
  });

  socket.on("webrtc:ice-candidate", ({ callId, candidate }: { callId: string; candidate?: IceCandidatePayload }) => {
    const store = useCallStore.getState();
    if (!peerConnection || !candidate?.candidate) return;
    if (!store.call || store.call.id !== callId) return;
    void peerConnection
      .addIceCandidate(
        new RTCIceCandidate({
          candidate: candidate.candidate,
          sdpMLineIndex: candidate.sdpMLineIndex ?? null,
          sdpMid: candidate.sdpMid ?? null,
        }),
      )
      .catch(() => {
        // Late or duplicate candidates can be safely ignored.
      });
  });
}

export const webrtcService = {
  /** Binds call + signaling listeners; call once per socket connection. */
  bind: bindCallEvents,

  /** Caller side: registers the call and rings the recipient. */
  async startCall(recipientId: string, type: "AUDIO" | "VIDEO", conversationId?: string): Promise<void> {
    const socket = getSocket();
    if (!socket) throw new Error("Connexion au serveur indisponible");
    const store = useCallStore.getState();
    if (store.phase !== "idle") return;

    store.setPhase("outgoing");
    socket
      .timeout(10_000)
      .emit("call:start", { recipientId, type, conversationId }, (timeoutError: unknown, response?: { error?: string; call?: Call }) => {
        if (timeoutError || !response?.call) {
          useCallStore.getState().setError(response?.error ?? "Le correspondant est injoignable");
          teardown();
          return;
        }
        useCallStore.getState().setCall(response.call);
      });
  },

  /** Callee side: accept the incoming call; the offer arrives via signaling. */
  async acceptCall(): Promise<void> {
    const socket = getSocket();
    const store = useCallStore.getState();
    if (!socket || !store.call) return;
    store.setPhase("connecting");
    socket.emit("call:accept", { callId: store.call.id });
  },

  async rejectCall(): Promise<void> {
    const socket = getSocket();
    const store = useCallStore.getState();
    if (!socket || !store.call) return;
    socket.emit("call:reject", { callId: store.call.id });
    teardown();
  },

  async endCall(): Promise<void> {
    const socket = getSocket();
    const store = useCallStore.getState();
    if (!socket || !store.call) return;
    socket.emit("call:end", { callId: store.call.id });
    teardown();
  },

  setSpeakerOn(on: boolean): void {
    InCallManager.setForceSpeakerphoneOn(on);
  },

  switchCamera(): void {
    const stream = useCallStore.getState().localStream;
    const videoTracks = stream?.getVideoTracks() ?? [];
    videoTracks.forEach((track) => {
      const switcher = (track as unknown as { _switchCamera?: () => void })._switchCamera;
      if (typeof switcher === "function") switcher.call(track);
    });
  },
};

export type { MediaStream, MediaStreamTrack };
