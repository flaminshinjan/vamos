export type Intent =
  | "briefing"
  | "market"
  | "risk"
  | "causal"
  | "news"
  | "chat"
  | "help";

// Single-word greetings and small talk that shouldn't trigger the full LLM
// briefing pipeline. Matched as whole words so "hi-impact" still classifies
// as briefing.
const GREETING_PATTERNS = [
  /^\s*(hi|hii|hello|hey|howdy|yo|sup|hola)\W*$/i,
  /^\s*(good\s+(morning|afternoon|evening|night))\W*$/i,
  /^\s*(how\s+are\s+you|what'?s\s+up|how'?s\s+it\s+going)\W*$/i,
  /^\s*(thanks|thank\s+you|ty|thx|cheers)\W*$/i,
  /^\s*(ok|okay|cool|nice|great|awesome|👍|👋)\W*$/i,
  /^\s*(bye|goodbye|see\s+you|cya|later)\W*$/i,
];

const HELP_PATTERNS = [
  /\b(help|what can you do|what do you do|how does this work|commands|capabilities)\b/i,
];

export function classifyIntent(text: string): Intent {
  const t = text.toLowerCase().trim();
  if (!t) return "chat";

  // Small talk first — short casual input never runs the full pipeline
  if (GREETING_PATTERNS.some((re) => re.test(text))) return "chat";
  if (HELP_PATTERNS.some((re) => re.test(text))) return "help";

  if (t.includes("market") || t.includes("nifty") || t.includes("sensex"))
    return "market";
  if (t.includes("risk") || t.includes("concentr") || t.includes("exposure"))
    return "risk";
  if (t.includes("causal") || t.includes("chain") || t.includes("trace"))
    return "causal";
  if (t.includes("news") || t.includes("headline")) return "news";

  // Very short, generic inputs — treat as chat instead of assuming briefing.
  // ("why" or "what" alone is too vague; we want an actual question.)
  if (t.split(/\s+/).length <= 2 && !/\?/.test(text)) return "chat";

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
  { text: "Why did my portfolio move today?", intent: "briefing" },
  { text: "Show market snapshot", intent: "market" },
  { text: "Check concentration risk", intent: "risk" },
];
