import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Dimensions,
  Easing,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { mmkv } from "@/services/storage/mmkv";
import { PhoenixMark } from "@/components/ui/brand";
import { ONBOARDING_COMPLETE_KEY } from "@/constants/onboarding";

type Slide = {
  key: string;
  eyebrow: string;
  title: string;
  body: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  /** Two smaller icons orbiting the centerpiece. */
  orbit: [React.ComponentProps<typeof Ionicons>["name"], React.ComponentProps<typeof Ionicons>["name"]];
  gradient: readonly [string, string, string];
  chips: string[];
};

const SLIDES: Slide[] = [
  {
    key: "music",
    eyebrow: "PHOENIX",
    title: "La musique vit ici",
    body: "Des milliers de titres et de clips d'artistes émergents. Écoutez en ligne, gardez vos favoris hors-ligne.",
    icon: "musical-notes",
    orbit: ["heart", "cloud-download-outline"],
    gradient: ["#1B0A3C", "#8E2DE2", "#FF2E93"],
    chips: ["Streaming HD", "Mode hors-ligne", "Playlists"],
  },
  {
    key: "wallet",
    eyebrow: "CHUYASSI EMMANUEL PAY",
    title: "Votre argent, en un geste",
    body: "Rechargez votre portefeuille et envoyez de l'argent à vos proches en quelques secondes, où qu'ils soient.",
    icon: "wallet",
    orbit: ["arrow-redo", "add-circle-outline"],
    gradient: ["#3C0A36", "#C2186B", "#FF8A3D"],
    chips: ["Recharger", "Envoyer", "Recevoir"],
  },
  {
    key: "community",
    eyebrow: "TOUT PHOENIX",
    title: "Une communauté entière",
    body: "Boutique, messagerie, appels et pages d'artistes : tout votre monde créatif réuni dans une seule app.",
    icon: "people",
    orbit: ["chatbubbles", "storefront-outline"],
    gradient: ["#0A0914", "#221046", "#5B2BD9"],
    chips: ["Boutique", "Messages", "Appels"],
  },
];

export default function OnboardingScreen() {
  const { width, height } = Dimensions.get("window");
  const insets = useSafeAreaInsets();
  const scrollX = useRef(new Animated.Value(0)).current;
  // Animated components forward refs to the inner ScrollView instance.
  const pager = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  // Gentle float for the icon compositions.
  const floatA = useRef(new Animated.Value(0)).current;
  const floatB = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    let cancelled = false;
    const loops: Animated.CompositeAnimation[] = [];
    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce || cancelled) return;
      const makeLoop = (value: Animated.Value, duration: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.timing(value, { toValue: 1, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
            Animated.timing(value, { toValue: 0, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          ])
        );
      loops.push(makeLoop(floatA, 2400), makeLoop(floatB, 3400));
      loops.forEach((loop) => loop.start());
    });
    return () => {
      cancelled = true;
      loops.forEach((loop) => loop.stop());
    };
  }, [floatA, floatB]);

  const translateYA = floatA.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const translateYB = floatB.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });

  function complete() {
    mmkv.set(ONBOARDING_COMPLETE_KEY, true);
    router.replace("/(auth)/login");
  }

  function goNext() {
    if (index < SLIDES.length - 1) {
      pager.current?.scrollTo({ x: (index + 1) * width, animated: true });
    } else {
      complete();
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: SLIDES[0].gradient[0] }]}>
      {/* Slides */}
      <Animated.ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        bounces={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
          useNativeDriver: true,
          listener: (event: NativeSyntheticEvent<NativeScrollEvent>) =>
            setIndex(Math.round(event.nativeEvent.contentOffset.x / width)),
        })}
      >
        {SLIDES.map((slide, i) => (
          <View key={slide.key} style={{ width, height }}>
            <LinearGradient colors={slide.gradient} start={{ x: 0.15, y: 0 }} end={{ x: 0.85, y: 1 }} style={StyleSheet.absoluteFill} />
            {/* Ambient orbs */}
            <View style={[styles.orb, { width: 260, height: 260, top: height * 0.06, left: -90, opacity: 0.14 }]} />
            <View style={[styles.orb, { width: 180, height: 180, top: height * 0.5, right: -70, opacity: 0.12 }]} />

            <SlideContent slide={slide} index={i} width={width} scrollX={scrollX} translateYA={translateYA} translateYB={translateYB} />
          </View>
        ))}
      </Animated.ScrollView>

      {/* Fixed chrome: brand + skip on top, dots + CTA at the bottom */}
      <View pointerEvents="box-none" style={[styles.chrome, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>
        <View style={styles.topRow}>
          <PhoenixMark size={34} />
          <Pressable hitSlop={12} accessibilityRole="button" accessibilityLabel="Passer l'introduction" onPress={complete}>
            <Text style={styles.skip}>Passer</Text>
          </Pressable>
        </View>

        <View style={styles.bottomBlock}>
          <View style={styles.dots}>
            {SLIDES.map((slide, i) => (
              <Dot key={slide.key} index={i} scrollX={scrollX} width={width} />
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={index === SLIDES.length - 1 ? "Commencer" : "Suivant"}
            onPress={goNext}
            style={({ pressed }) => [styles.cta, { transform: [{ scale: pressed ? 0.97 : 1 }], opacity: pressed ? 0.92 : 1 }]}
          >
            <Text style={styles.ctaLabel}>{index === SLIDES.length - 1 ? "Commencer" : "Suivant"}</Text>
            <Ionicons name={index === SLIDES.length - 1 ? "sparkles" : "arrow-forward"} size={18} color="#1B0A3C" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function SlideContent({
  slide,
  index,
  width,
  scrollX,
  translateYA,
  translateYB,
}: {
  slide: Slide;
  index: number;
  width: number;
  scrollX: Animated.Value;
  translateYA: Animated.AnimatedInterpolation<number>;
  translateYB: Animated.AnimatedInterpolation<number>;
}) {
  // Slide-scoped parallax: content drifts slower than the pager, icons slower still.
  const contentTranslate = scrollX.interpolate({
    inputRange: [(index - 1) * width, index * width, (index + 1) * width],
    outputRange: [width * 0.18, 0, -width * 0.18],
    extrapolate: "clamp",
  });
  const contentFade = scrollX.interpolate({
    inputRange: [(index - 1) * width, index * width, (index + 1) * width],
    outputRange: [0, 1, 0],
    extrapolate: "clamp",
  });
  const iconTranslate = scrollX.interpolate({
    inputRange: [(index - 1) * width, index * width, (index + 1) * width],
    outputRange: [width * 0.34, 0, -width * 0.34],
    extrapolate: "clamp",
  });

  return (
    <Animated.View style={[styles.content, { transform: [{ translateX: contentTranslate }], opacity: contentFade }]}>
      {/* Icon composition: glow, glass bubble, orbiting mini-bubbles */}
      <Animated.View style={{ transform: [{ translateX: iconTranslate }] }}>
        <Animated.View style={[styles.glowRing, { transform: [{ translateY: translateYB }] }]} />
        <Animated.View style={[styles.iconBubble, { transform: [{ translateY: translateYA }] }]}>
          <Ionicons name={slide.icon} size={62} color="#FFFFFF" />
        </Animated.View>
        <Animated.View style={[styles.orbitBubble, styles.orbitA, { transform: [{ translateY: translateYB }] }]}>
          <Ionicons name={slide.orbit[0]} size={20} color="#FFFFFF" />
        </Animated.View>
        <Animated.View style={[styles.orbitBubble, styles.orbitB, { transform: [{ translateY: translateYA }] }]}>
          <Ionicons name={slide.orbit[1]} size={16} color="#FFFFFF" />
        </Animated.View>
      </Animated.View>

      <Text style={styles.eyebrow}>{slide.eyebrow}</Text>
      <Text style={styles.title}>{slide.title}</Text>
      <Text style={styles.body}>{slide.body}</Text>

      <View style={styles.chips}>
        {slide.chips.map((chip) => (
          <View key={chip} style={styles.chip}>
            <Text style={styles.chipLabel}>{chip}</Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

function Dot({ index, scrollX, width }: { index: number; scrollX: Animated.Value; width: number }) {
  const width2 = scrollX.interpolate({
    inputRange: [(index - 1) * width, index * width, (index + 1) * width],
    outputRange: [8, 28, 8],
    extrapolate: "clamp",
  });
  const opacity = scrollX.interpolate({
    inputRange: [(index - 1) * width, index * width, (index + 1) * width],
    outputRange: [0.35, 1, 0.35],
    extrapolate: "clamp",
  });
  return <Animated.View style={[styles.dot, { width: width2, opacity }]} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  orb: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 18,
    paddingHorizontal: 32,
    // Keep the composition clear of the fixed dots + CTA chrome on short screens.
    paddingBottom: 140,
  },
  glowRing: {
    position: "absolute",
    width: 196,
    height: 196,
    borderRadius: 999,
    alignSelf: "center",
    top: -24,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  iconBubble: {
    width: 148,
    height: 148,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.30)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
  },
  orbitBubble: {
    position: "absolute",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.24)",
    alignItems: "center",
    justifyContent: "center",
  },
  orbitA: { width: 52, height: 52, top: -28, right: -34 },
  orbitB: { width: 42, height: 42, bottom: -18, left: -40 },
  eyebrow: {
    marginTop: 26,
    color: "rgba(255,255,255,0.85)",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 3,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "800",
    letterSpacing: -0.8,
    textAlign: "center",
  },
  body: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    maxWidth: 320,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 6,
  },
  chip: {
    paddingHorizontal: 16,
    height: 34,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
  chipLabel: { color: "#FFFFFF", fontSize: 13, fontWeight: "600" },
  chrome: {
    ...StyleSheet.absoluteFill,
    justifyContent: "space-between",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
  },
  skip: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 15,
    fontWeight: "600",
  },
  bottomBlock: { gap: 22, paddingHorizontal: 24 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8 },
  dot: { height: 8, borderRadius: 999, backgroundColor: "#FFFFFF" },
  cta: {
    height: 56,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  ctaLabel: { color: "#1B0A3C", fontSize: 16, fontWeight: "800" },
});
