/** Internal unit is $1,000 of franchise money. Play money — not a cashier. */
export function fmtMoney(n: number) {
  if (!Number.isFinite(n)) return "$0";
  const dollars = n * 1000;
  if (Math.abs(dollars) >= 1_000_000) {
    const m = dollars / 1_000_000;
    const rounded = Math.round(m * 10) / 10;
    return `$${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}M`;
  }
  if (Math.abs(dollars) >= 1000) return `$${Math.round(dollars / 1000)}K`;
  return `$${Math.round(dollars)}`;
}
