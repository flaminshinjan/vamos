export type Intent = "briefing" | "market" | "risk" | "causal" | "news";

export function classifyIntent(text: string): Intent {
  const t = text.toLowerCase();
  if (t.includes("market") || t.includes("nifty") || t.includes("sensex"))
    return "market";
  if (t.includes("risk") || t.includes("concentr") || t.includes("exposure"))
    return "risk";
  if (t.includes("causal") || t.includes("chain") || t.includes("trace"))
    return "causal";
  if (t.includes("news") || t.includes("headline")) return "news";
  return "briefing";
}

export const SUGGESTED_PROMPTS: Array<{
  icon: string;
  text: string;
  intent: Intent;
}> = [
  { icon: "✦", text: "Why did my portfolio move today?", intent: "briefing" },
  { icon: "◷", text: "Show today's market snapshot", intent: "market" },
  { icon: "◈", text: "Analyze my concentration risk", intent: "risk" },
  { icon: "◉", text: "Trace the causal chain for my top holding", intent: "causal" },
];

export const FOLLOWUPS: Array<{ text: string; intent: Intent }> = [
  { text: "Trace the causal chain", intent: "causal" },
  { text: "Show market snapshot", intent: "market" },
  { text: "Check concentration risk", intent: "risk" },
];
