export function formatINR(n: number | null | undefined): string {
  if (n == null) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 10000000) return `${sign}₹${(abs / 10000000).toFixed(2)} Cr`;
  if (abs >= 100000) return `${sign}₹${(abs / 100000).toFixed(2)} L`;
  return `${sign}₹${abs.toLocaleString("en-IN")}`;
}

export function formatPct(n: number, digits = 2): string {
  const sign = n >= 0 ? "+" : "−";
  return `${sign}${Math.abs(n).toFixed(digits)}%`;
}

export const SECTOR_COLORS = [
  "#2E2D7A",
  "#4B48C2",
  "#8684D4",
  "#B8B6E4",
  "#D5CEBF",
  "#E7E1D6",
];
