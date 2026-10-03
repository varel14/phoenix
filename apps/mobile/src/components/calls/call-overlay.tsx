import { useEffect, useState } from "react";
import { Modal, Pressable, Vibration, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { RTCView } from "react-native-webrtc";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@/stores/auth-store";
import { useCallStore, type CallPhase } from "@/stores/call-store";
import { webrtcService } from "@/services/calls/webrtc.service";
import { UserAvatar } from "@/components/chat/user-avatar";
import { AppText } from "@/components/ui";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { formatDuration } from "@/utils/format";
import type { Call } from "@/types/chat";

const PHASE_LABELS: Record<Exclude<CallPhase, "idle">, string> = {
  outgoing: "Appel en cours…",
  incoming: "Appel entrant",
  connecting: "Connexion…",
  active: "Appel en cours",
  ended: "Appel terminé",
};

/**
 * Global call UI: incoming-call ringing screen and active audio/video call.
 * Rendered once from the root layout, driven entirely by the call store.
 */
export function CallOverlay() {
  const phase = useCallStore((state) => state.phase);
  const call = useCallStore((state) => state.call);
  const error = useCallStore((state) => state.error);
  const visible = phase !== "idle" && call != null;

  if (!visible || !call) return null;
  return <CallOverlayContent call={call} phase={phase} error={error} />;
}

function CallOverlayContent({ call, phase, error }: { call: Call; phase: CallPhase; error: string | null }) {
  const { colors, gradients } = useTheme();
  const insets = useSafeAreaInsets();
  const currentUserId = useAuthStore((state) => state.user?.id ?? "");
  const micOn = useCallStore((state) => state.micOn);
  const cameraOn = useCallStore((state) => state.cameraOn);
  const speakerOn = useCallStore((state) => state.speakerOn);
  const localStream = useCallStore((state) => state.localStream);
  const remoteStream = useCallStore((state) => state.remoteStream);
  const toggleMic = useCallStore((state) => state.toggleMic);
  const toggleCamera = useCallStore((state) => state.toggleCamera);
  const toggleSpeaker = useCallStore((state) => state.toggleSpeaker);

  const outgoing = call.callerId === currentUserId;
  const other = outgoing ? call.recipient : call.caller;
  const isVideo = call.type === "VIDEO";

  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (phase !== "active") return;
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // Ring while the call is not yet established.
  useEffect(() => {
    if (phase === "incoming" || phase === "outgoing") {
      Vibration.vibrate([0, 600, 800], true);
      return () => Vibration.cancel();
    }
  }, [phase]);

  if (phase === "idle") return null;

  const statusLabel =
    phase === "active"
      ? formatDuration(elapsed)
      : error
        ? "Appel indisponible"
        : PHASE_LABELS[phase];

  return (
    <Modal visible animationType="fade" transparent={false} statusBarTranslucent>
      <LinearGradient
        colors={gradients.brandDeep}
        style={{ flex: 1, paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl, paddingHorizontal: spacing.xl }}
      >
        {/* Remote video layer */}
        {isVideo && remoteStream ? (
          <RTCView
            streamURL={remoteStream.toURL()}
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            objectFit="cover"
          />
        ) : null}

        {/* Contact + status */}
        <View style={{ alignItems: "center", gap: spacing.md, marginTop: spacing.xxl }}>
          {isVideo && remoteStream ? null : <UserAvatar user={other} size={110} />}
          <AppText variant="title" align="center" style={{ color: "#fff" }}>
            {other.name}
          </AppText>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: spacing.sm,
              backgroundColor: "rgba(255,255,255,0.12)",
              borderRadius: radii.full,
              paddingHorizontal: spacing.lg,
              paddingVertical: 6,
            }}
          >
            <Ionicons name={isVideo ? "videocam" : "call"} size={14} color="#fff" />
            <AppText style={{ color: "#fff", fontSize: 13, fontWeight: "600" }}>{statusLabel}</AppText>
          </View>
          {error ? (
            <AppText align="center" style={{ color: "#FFB4B4", fontSize: 13 }}>
              {error}
            </AppText>
          ) : null}
        </View>

        {/* Local video preview */}
        {isVideo && localStream ? (
          <RTCView
            streamURL={localStream.toURL()}
            style={{
              position: "absolute",
              top: insets.top + spacing.lg,
              right: spacing.lg,
              width: 110,
              height: 160,
              borderRadius: radii.md,
              backgroundColor: "#000",
            }}
            objectFit="cover"
            zOrder={1}
          />
        ) : null}

        {/* Controls */}
        <View style={{ flex: 1 }} />

        {phase === "incoming" ? (
          <View style={{ flexDirection: "row", justifyContent: "space-around", alignItems: "center" }}>
            <CallButton icon="close" label="Refuser" backgroundColor={colors.danger} onPress={() => void webrtcService.rejectCall()} />
            <CallButton
              icon="call"
              label="Accepter"
              backgroundColor="#22C55E"
              onPress={() => void webrtcService.acceptCall()}
              large
            />
          </View>
        ) : (
          <View style={{ flexDirection: "row", justifyContent: "center", gap: spacing.xl, flexWrap: "wrap" }}>
            <CallButton
              icon={micOn ? "mic" : "mic-off"}
              label={micOn ? "Micro" : "Micro coupé"}
              backgroundColor={micOn ? "rgba(255,255,255,0.15)" : "#fff"}
              iconColor={micOn ? "#fff" : "#000"}
              onPress={toggleMic}
            />
            {isVideo ? (
              <>
                <CallButton
                  icon={cameraOn ? "videocam" : "videocam-off"}
                  label="Caméra"
                  backgroundColor={cameraOn ? "rgba(255,255,255,0.15)" : "#fff"}
                  iconColor={cameraOn ? "#fff" : "#000"}
                  onPress={toggleCamera}
                />
                <CallButton
                  icon="camera-reverse"
                  label="Pivoter"
                  backgroundColor="rgba(255,255,255,0.15)"
                  onPress={() => webrtcService.switchCamera()}
                />
              </>
            ) : (
              <CallButton
                icon={speakerOn ? "volume-high" : "volume-mute"}
                label="Haut-parleur"
                backgroundColor={speakerOn ? "rgba(255,255,255,0.15)" : "#fff"}
                iconColor={speakerOn ? "#fff" : "#000"}
                onPress={() => {
                  const next = !speakerOn;
                  toggleSpeaker();
                  webrtcService.setSpeakerOn(next);
                }}
              />
            )}
            <CallButton icon="call" label="Raccrocher" backgroundColor={colors.danger} onPress={() => void webrtcService.endCall()} />
          </View>
        )}
      </LinearGradient>
    </Modal>
  );
}

interface CallButtonProps {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  backgroundColor: string;
  iconColor?: string;
  onPress: () => void;
  large?: boolean;
}

function CallButton({ icon, label, backgroundColor, iconColor = "#fff", onPress, large }: CallButtonProps) {
  const size = large ? 72 : 60;
  return (
    <View style={{ alignItems: "center", gap: 6 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => ({
          width: size,
          height: size,
          borderRadius: radii.full,
          backgroundColor,
          alignItems: "center",
          justifyContent: "center",
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Ionicons name={icon} size={large ? 32 : 24} color={iconColor} />
      </Pressable>
      <AppText style={{ color: "rgba(255,255,255,0.85)", fontSize: 12 }}>{label}</AppText>
    </View>
  );
}
