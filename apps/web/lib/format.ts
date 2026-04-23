export function formatINR(n: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatPct(n: number, digits = 2): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(digits)}%`;
}

export function pnlColor(n: number): string {
  if (n > 0) return "text-accent-green";
  if (n < 0) return "text-accent-red";
  return "text-neutral-300";
}

export function sentimentColor(s: string): string {
  const up = s.toUpperCase();
  if (up === "BULLISH" || up === "POSITIVE") return "text-accent-green";
  if (up === "BEARISH" || up === "NEGATIVE") return "text-accent-red";
  if (up === "MIXED") return "text-accent-amber";
  return "text-neutral-300";
}

export function severityClasses(
  sev: "INFO" | "WARN" | "CRITICAL"
): { pill: string; border: string } {
  if (sev === "CRITICAL")
    return {
      pill: "bg-red-500/15 text-red-300 border border-red-500/30",
      border: "border-l-4 border-accent-red",
    };
  if (sev === "WARN")
    return {
      pill: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
      border: "border-l-4 border-accent-amber",
    };
  return {
    pill: "bg-blue-500/15 text-blue-300 border border-blue-500/30",
    border: "border-l-4 border-accent-blue",
  };
}
