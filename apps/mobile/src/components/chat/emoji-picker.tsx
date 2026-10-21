import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text as RNText, View } from "react-native";
import { storage as AsyncStorage } from "@/services/storage/mmkv";
import { radii, spacing } from "@/theme";
import { useTheme } from "@/theme/theme-provider";
import { AppText } from "@/components/ui";

const RECENTS_KEY = "chat-emoji-recents";
const RECENTS_MAX = 24;
const COLUMNS = 8;

/** Curated, single-codepoint emoji per category (no ZWJ sequences — they render inconsistently). */
const CATEGORIES: Array<{ key: string; label: string; tab: string; emojis: string[] }> = [
  {
    key: "smileys",
    label: "Smileys",
    tab: "😀",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "🤣", "😂", "🙂", "🙃", "😉", "😊",
      "😇", "🥰", "😍", "🤩", "😘", "😗", "😚", "😙", "🥲", "😋", "😛", "😜",
      "🤪", "😝", "🤑", "🤗", "🤭", "🤫", "🤔", "🤐", "🤨", "😐", "😑", "😶",
      "😏", "😒", "🙄", "😬", "😮‍💨", "🤥", "😌", "😔", "😪", "🤤", "😴", "😷",
      "🤒", "🤕", "🤢", "🤮", "🥵", "🥶", "🥴", "😵", "🤯", "🤠", "🥳", "🥸",
      "😎", "🤓", "🧐", "😕", "😟", "🙁", "😯", "😲", "😳", "🥺", "😦", "😧",
      "😨", "😰", "😥", "😢", "😭", "😱", "😖", "😣", "😞", "😓", "😩", "😫",
      "🥱", "😤", "😡", "😠", "🤬", "😈", "👿", "💀", "💩", "🤡", "👻", "👽",
    ],
  },
  {
    key: "gestures",
    label: "Gestes",
    tab: "👋",
    emojis: [
      "👋", "🤚", "🖐️", "✋", "🖖", "👌", "🤌", "🤏", "✌️", "🤞", "🤟", "🤘",
      "🤙", "👈", "👉", "👆", "🖕", "👇", "☝️", "👍", "👎", "✊", "👊", "🤛",
      "🤜", "👏", "🙌", "👐", "🤲", "🤝", "🙏", "✍️", "💅", "🤳", "💪", "🦾",
      "🦿", "🦵", "🦶", "👂", "🦻", "👃", "🧠", "🫀", "🦷", "🦴", "👀", "👁️",
      "👅", "👄", "🫦", "👶", "🧒", "👦", "👧", "🧑", "👨", "👩", "🧓", "👴",
      "👵", "👮", "🕵️", "💃", "🕺", "👯", "🧑‍🎤", "🧑‍🏫", "🧑‍🔧", "👑", "🎩", "🎓",
    ],
  },
  {
    key: "animals",
    label: "Animaux",
    tab: "🐶",
    emojis: [
      "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁", "🐮",
      "🐷", "🐸", "🐵", "🙈", "🙉", "🙊", "🐔", "🐧", "🐦", "🐤", "🦆", "🦅",
      "🦉", "🦇", "🐺", "🐗", "🐴", "🦄", "🐝", "🪱", "🐛", "🦋", "🐌", "🐞",
      "🐜", "🦟", "🦗", "🕷️", "🦂", "🐢", "🐍", "🦎", "🦖", "🦕", "🐙", "🦑",
      "🦐", "🦞", "🦀", "🐡", "🐠", "🐟", "🐬", "🐳", "🐋", "🦈", "🐊", "🐅",
      "🐆", "🦓", "🦍", "🐘", "🦛", "🐪", "🦒", "🦘", "🐄", "🐎", "🐖", "🐏",
      "🐑", "🦙", "🐐", "🦌", "🐕", "🐩", "🐈", "🐈‍⬛", "🐓", "🦃", "🦚", "🦜",
      "🦢", "🦩", "🕊️", "🐇", "🦝", "🦨", "🦡", "🦦", "🦥", "🐁", "🐀", "🐿️",
    ],
  },
  {
    key: "food",
    label: "Nourriture",
    tab: "🍔",
    emojis: [
      "🍏", "🍎", "🍐", "🍊", "🍋", "🍌", "🍉", "🍇", "🍓", "🫐", "🍈", "🍒",
      "🍑", "🥭", "🍍", "🥥", "🥝", "🍅", "🍆", "🥑", "🥦", "🥬", "🥒", "🌶️",
      "🌽", "🥕", "🧄", "🧅", "🥔", "🍠", "🥐", "🥯", "🍞", "🥖", "🥨", "🧀",
      "🥚", "🍳", "🧈", "🥞", "🧇", "🥓", "🥩", "🍗", "🍖", "🌭", "🍔", "🍟",
      "🍕", "🫓", "🥪", "🥙", "🧆", "🌮", "🌯", "🫔", "🥗", "🥘", "🫕", "🥫",
      "🍝", "🍜", "🍲", "🍛", "🍣", "🍱", "🥟", "🦪", "🍤", "🍙", "🍚", "🍘",
      "🍥", "🥠", "🥮", "🍢", "🍡", "🍧", "🍨", "🍦", "🥧", "🧁", "🍰", "🎂",
      "🍮", "🍭", "🍬", "🍫", "🍿", "🍩", "🍪", "🌰", "🥜", "🍯", "🥛", "☕",
      "🍵", "🧃", "🥤", "🍶", "🍺", "🍻", "🥂", "🍷", "🥃", "🍸", "🍹", "🧉",
    ],
  },
  {
    key: "activities",
    label: "Activités",
    tab: "⚽",
    emojis: [
      "⚽", "🏀", "🏈", "⚾", "🥎", "🎾", "🏐", "🏉", "🥏", "🎱", "🪀", "🏓",
      "🏸", "🏒", "🥍", "🏏", "🪃", "🥅", "⛳", "🪁", "🏹", "🎣", "🤿", "🥊",
      "🥋", "🎽", "🛹", "🛼", "🛷", "⛸️", "🥌", "🎿", "⛷️", "🏂", "🚴", "🚵",
      "🧗", "🏇", "🏊", "🏄", "🚣", "🧘", "🎪", "🎭", "🎨", "🎬", "🎤", "🎧",
      "🎼", "🎹", "🥁", "🎷", "🎺", "🎸", "🪕", "🎻", "🎲", "♟️", "🎯", "🎳",
      "🎮", "🎰", "🧩", "🏆", "🥇", "🥈", "🥉", "🏅", "🎖️", "🎗️", "🎫", "🎟️",
    ],
  },
  {
    key: "travel",
    label: "Voyage",
    tab: "✈️",
    emojis: [
      "🚗", "🚕", "🚙", "🚌", "🚎", "🏎️", "🚓", "🚑", "🚒", "🚐", "🛻", "🚚",
      "🚛", "🚜", "🛴", "🚲", "🛵", "🏍️", "🚨", "🚔", "🚍", "🚀", "🛸", "🚁",
      "🛶", "⛵", "🚤", "🛥️", "🛳️", "⛴️", "🚢", "✈️", "🛩️", "🚂", "🚃", "🚄",
      "🚅", "🚆", "🚇", "🚊", "🚉", "🚝", "🗺️", "🧭", "🏔️", "🌋", "🏕️", "🏖️",
      "🏜️", "🏝️", "🏟️", "🏛️", "🏗️", "🏠", "🏡", "🏢", "🏥", "🏦", "🏨", "🏫",
      "🏭", "🏰", "💒", "🗼", "🗽", "⛲", "🌉", "🌆", "🌇", "🌃", "🌌", "🎡",
      "🎢", "🎠", "🗼", "💻", "🌐", "🌍", "🌎", "🌏",
    ],
  },
  {
    key: "objects",
    label: "Objets",
    tab: "📱",
    emojis: [
      "📱", "📲", "💻", "⌨️", "🖥️", "🖨️", "🖱️", "💾", "💿", "📀", "📷", "📸",
      "📹", "🎥", "📞", "☎️", "📟", "📠", "📺", "📻", "🎙️", "⏰", "⌚", "🔋",
      "🪫", "🔌", "💡", "🔦", "🕯️", "🧯", "🛢️", "💸", "💵", "💰", "💳", "💎",
      "⚖️", "🔧", "🔨", "⛏️", "🛠️", "⚙️", "🧲", "🔫", "💊", "💉", "🩹", "🩺",
      "🚪", "🪑", "🚽", "🚿", "🛁", "🧴", "🧷", "🧹", "🧺", "🧻", "🧼", "🪥",
      "🔑", "🗝️", "🔒", "🔓", "📌", "📎", "📏", "✂️", "🗃️", "🗄️", "🗑️", "📝",
      "✏️", "🖊️", "📚", "📖", "📗", "📘", "📙", "📔", "📒", "📃", "📜", "📄",
      "📰", "🔖", "🏷️", "✉️", "📩", "📦", "📫", "📮", "🗳️", "✅", "🛒", "🎁",
    ],
  },
  {
    key: "symbols",
    label: "Symboles",
    tab: "❤️",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔", "❣️", "💕",
      "💞", "💓", "💗", "💖", "💘", "💝", "💟", "🔥", "✨", "⭐", "🌟", "💫",
      "⚡", "☀️", "🌙", "🌈", "☁️", "🌧️", "❄️", "🌊", "💧", "🎉", "🎊", "🎈",
      "🎁", "🎀", "🥀", "🌸", "💐", "🌷", "🌹", "🥰", "🌺", "🌼", "🌻", "😀",
      "✅", "❌", "❓", "❗", "💯", "🔔", "🔕", "🎵", "🎶", "💲", "🚫", "⚠️",
      "♻️", "🔒", "👀", "💬", "💭", "🗯️", "💤", "🙏", "👏", "🙌", "🤝", "💪",
    ],
  },
];

export function EmojiPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
  const { colors, radii } = useTheme();
  const [activeKey, setActiveKey] = useState("recent");
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(RECENTS_KEY)
      .then((stored) => {
        if (stored) setRecents(JSON.parse(stored) as string[]);
      })
      .catch(() => undefined);
  }, []);

  const category = useMemo(() => CATEGORIES.find((c) => c.key === activeKey), [activeKey]);
  const emojis = category?.emojis ?? recents;

  const pushRecent = useCallback((emoji: string) => {
    setRecents((prev) => {
      const next = [emoji, ...prev.filter((e) => e !== emoji)].slice(0, RECENTS_MAX);
      AsyncStorage.setItem(RECENTS_KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);

  return (
    <View style={{ height: 280, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline }}>
      {/* Category tabs */}
      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, gap: 2 }}>
        <CategoryTab
          emoji="🕘"
          active={activeKey === "recent"}
          onPress={() => setActiveKey("recent")}
        />
        {CATEGORIES.map((c) => (
          <CategoryTab key={c.key} emoji={c.tab} active={activeKey === c.key} onPress={() => setActiveKey(c.key)} />
        ))}
      </View>
      <AppText variant="small" style={{ paddingHorizontal: spacing.md, marginBottom: spacing.xs }}>
        {activeKey === "recent" ? "Récents" : category?.label}
      </AppText>
      <FlatList
        key={activeKey}
        data={emojis}
        numColumns={COLUMNS}
        keyExtractor={(item, index) => `${item}-${index}`}
        contentContainerStyle={{ paddingBottom: spacing.md }}
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Emoji ${item}`}
            onPress={() => {
              onSelect(item);
              pushRecent(item);
            }}
            style={({ pressed }) => ({
              flex: 1 / COLUMNS,
              height: 42,
              alignItems: "center",
              justifyContent: "center",
              borderRadius: radii.sm,
              opacity: pressed ? 0.5 : 1,
            })}
          >
            <RNText style={{ fontSize: 26 }}>{item}</RNText>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={{ alignItems: "center", paddingVertical: spacing.xxl }}>
            <AppText variant="bodyMuted">Vos emojis favoris apparaîtront ici</AppText>
          </View>
        }
      />
    </View>
  );
}

function CategoryTab({ emoji, active, onPress }: { emoji: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        width: 34,
        height: 30,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: radii.sm,
        backgroundColor: active ? colors.primaryTint : "transparent",
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <RNText style={{ fontSize: 18, opacity: active ? 1 : 0.55 }}>{emoji}</RNText>
    </Pressable>
  );
}
