/**
 * Typo- and accent-tolerant client-side matching, used to soften the API's
 * exact-substring search: diacritics are stripped, prefix/substring hits are
 * boosted, and everything else is ranked with Sørensen–Dice bigram similarity.
 */

/** Lowercase, strip diacritics (é→e) and punctuation so they never block a match. */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Sørensen–Dice coefficient over character bigrams — 0 (no overlap) to 1 (equal). */
export function bigramSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i += 1) {
    const g = a.slice(i, i + 2);
    bigrams.set(g, (bigrams.get(g) ?? 0) + 1);
  }
  let hits = 0;
  let totalA = 0;
  let totalB = 0;
  for (const n of bigrams.values()) totalA += n;
  for (let i = 0; i < b.length - 1; i += 1) {
    const g = b.slice(i, i + 2);
    const n = bigrams.get(g);
    if (n) {
      hits += 1;
      if (n > 1) bigrams.set(g, n - 1);
      else bigrams.delete(g);
    }
    totalB += 1;
  }
  if (totalA === 0 || totalB === 0) return 0;
  return (2 * hits) / (totalA + totalB);
}

function singleWordScore(word: string, target: string): number {
  if (!word || !target) return 0;
  if (target === word) return 1;
  if (target.startsWith(word)) return 0.96;
  if (target.includes(word)) return 0.88;
  for (const w of target.split(" ")) {
    if (w.startsWith(word)) return 0.8;
  }
  // Very short queries: substring/prefix only — bigrams on 1–2 chars are noise.
  if (word.length <= 2) return 0;
  let wordBonus = 0;
  for (const w of target.split(" ")) {
    wordBonus = Math.max(wordBonus, bigramSimilarity(word, w));
  }
  return Math.max(bigramSimilarity(word, target) * 0.9, wordBonus);
}

/**
 * Relevance of a query against one target string, 0–1. Multi-word queries
 * score each word separately and need every word to plausibly match.
 */
export function fuzzyScore(query: string, target: string): number {
  const words = normalizeText(query).split(" ").filter(Boolean);
  if (words.length === 0 || !normalizeText(target)) return 0;
  const t = normalizeText(target);
  if (words.length === 1) return singleWordScore(words[0], t);
  let sum = 0;
  for (const w of words) {
    const s = singleWordScore(w, t);
    if (s < 0.4) return 0;
    sum += s;
  }
  return sum / words.length;
}

/** Best fuzzy score across several fields (title, artist name, album…). */
export function bestFieldScore(query: string, fields: Array<string | null | undefined>): number {
  let best = 0;
  for (const field of fields) {
    if (!field) continue;
    best = Math.max(best, fuzzyScore(query, field));
  }
  return best;
}
