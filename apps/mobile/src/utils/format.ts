export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds) || seconds <= 0) return "0:00";
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatCount(count: number): string {
  if (count >= 1_000_000)
    return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (count >= 1_000)
    return `${(count / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(count);
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** Brand-family gradient pairs (2026 violet rebrand) for artwork placeholders. */
const GRADIENTS = [
  { from: "#4517C9", to: "#A78BFA" },
  { from: "#0F766E", to: "#5EEAD4" },
  { from: "#6D28D9", to: "#C4B5FD" },
  { from: "#BE123C", to: "#FDA4AF" },
  { from: "#1D4ED8", to: "#93C5FD" },
  { from: "#B45309", to: "#FDE047" },
];

/**
 * Profile fallback gradients — rotations of the brand violet so every avatar
 * without a photo still reads as part of the same identity.
 */
const PROFILE_GRADIENTS = [
  { from: "#4C1D95", to: "#8B5CF6" },
  { from: "#5B23FF", to: "#C4B5FD" },
  { from: "#312E81", to: "#8F6BFF" },
  { from: "#6D28D9", to: "#DDD6FE" },
  { from: "#7E5FFF", to: "#EDE9FE" },
];

/** Deterministic brand-violet gradient pair for profile avatars. */
export function profileGradient(seed: string): { from: string; to: string } {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return PROFILE_GRADIENTS[hash % PROFILE_GRADIENTS.length];
}

/** Deterministic gradient pair for artwork placeholders. */
export function artworkGradient(seed: string): { from: string; to: string } {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return GRADIENTS[hash % GRADIENTS.length];
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * WhatsApp-style chat timestamp: today → HH:mm, yesterday → "Hier", this week
 * → weekday name, otherwise a short date (year added when not current).
 */
export function formatChatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfDay = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayGap = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (dayGap <= 0)
    return date.toLocaleTimeString("fr-FR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  if (dayGap === 1) return "Hier";
  if (dayGap < 7) {
    const weekday = date.toLocaleDateString("fr-FR", { weekday: "long" });
    return weekday.charAt(0).toUpperCase() + weekday.slice(1);
  }
  const options: Intl.DateTimeFormatOptions =
    date.getFullYear() === now.getFullYear()
      ? { day: "2-digit", month: "2-digit" }
      : { day: "2-digit", month: "2-digit", year: "numeric" };
  return date.toLocaleDateString("fr-FR", options);
}

/**
 * Displays a normalized phone number in pairs: 0707070707 → "07 07 07 07 07".
 * International numbers keep their +prefix and group from the right.
 */
export function formatPhone(raw: string): string {
  const international = raw.startsWith("+");
  const digits = raw.replace(/\D/g, "");
  const groups = digits.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  return international ? `+${groups}` : groups;
}
