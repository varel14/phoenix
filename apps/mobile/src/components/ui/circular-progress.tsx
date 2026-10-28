import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { useTheme } from "@/theme/theme-provider";
import { AppText } from "./primitives";

interface CircularProgressProps {
  /** 0..1 — values ≤ 0 render a spinning indeterminate arc. */
  progress: number;
  size?: number;
  stroke?: number;
}

/**
 * Small ring for in-row download monitoring: track circle, progress arc that
 * starts at 12 o'clock, percentage centered. While the transfer has no bytes
 * yet (progress 0) the arc spins instead of sitting empty.
 */
export function CircularProgress({
  progress,
  size = 30,
  stroke = 3,
}: CircularProgressProps) {
  const { colors } = useTheme();
  const clamped = Math.min(1, Math.max(0, progress));
  const indeterminate = clamped <= 0;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!indeterminate) return;
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [indeterminate, spin]);

  const arc = (
    <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={colors.surfaceHighlight}
        strokeWidth={stroke}
        fill="none"
      />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke={colors.primary}
        strokeWidth={stroke}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={indeterminate ? circumference * 0.25 : circumference}
        strokeDashoffset={
          indeterminate ? circumference * 0.75 : circumference * (1 - clamped)
        }
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );

  return (
    <View style={{ width: size, height: size }}>
      {indeterminate ? (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              transform: [
                {
                  rotate: spin.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0deg", "360deg"],
                  }),
                },
              ],
            },
          ]}
        >
          {arc}
        </Animated.View>
      ) : (
        arc
      )}
      <View
        style={[
          StyleSheet.absoluteFill,
          { alignItems: "center", justifyContent: "center" },
        ]}
      >
        <AppText
          style={{
            fontSize: 9,
            fontWeight: "700",
            color: colors.text,
            fontVariant: ["tabular-nums"],
          }}
        >
          {Math.round(clamped * 100)}%
        </AppText>
      </View>
    </View>
  );
}
