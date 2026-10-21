/**
 * Business pricing rules (franc CFA). The page subscription unlocks the app
 * for 2 500 FCFA/month; downloaded videos then owe the artist a 1 FCFA
 * monthly royalty, billed under the cover of that page subscription. Songs
 * are pay-per-download: 1 FCFA charged once from the fan's wallet and
 * credited straight to the artist's wallet.
 */
export const PAGE_SUBSCRIPTION_MONTHLY_PRICE = 2500;
export const DOWNLOAD_ROYALTY_MONTHLY_PRICE = 1;
export const SONG_DOWNLOAD_PRICE = 1;
export const PRICING_CURRENCY = "XOF";

/** First day of the UTC month containing `date`, used as a royalty period key. */
export function monthPeriodStart(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/** `date` shifted by one month, keeping end-of-month clamping sane. */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const dayOfMonth = result.getUTCDate();
  result.setUTCMonth(result.getUTCMonth() + months);
  if (result.getUTCDate() < dayOfMonth) {
    // Landed on a shorter month (e.g. Jan 31 + 1mo); clamp to the last day.
    result.setUTCDate(0);
  }
  return result;
}
