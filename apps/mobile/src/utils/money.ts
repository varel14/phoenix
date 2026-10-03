/** Money helpers — integer XOF (FCFA) amounts everywhere. */
export function formatAmount(amount: number): string {
  return new Intl.NumberFormat("fr-FR").format(amount);
}

export function formatMoney(amount: number, currency = "XOF"): string {
  const symbol = currency === "XOF" ? "FCFA" : currency;
  return `${formatAmount(amount)} ${symbol}`;
}
