export const REASONING_STEPS = [
  {
    n: "01",
    title: "Ingest — read every tape",
    desc: "Aarthik subscribes to earnings calls, 10-Qs, central bank minutes, commodity feeds, and 40+ news sources. Everything that moves your book.",
    code: `$ aarthik.stream
[08:14:02]  FT     › ECB holds rates, Lagarde hints at Oct cut
[08:14:07]  BBG    › TSM revenue guide raised +6%
[08:14:11]  SEC    › NVDA 10-Q filed
[08:14:14]  XBRL   › parsing segment revenues...
[08:14:19]  ─── 3 events relevant to your portfolio`,
  },
  {
    n: "02",
    title: "Decompose — trace second-order effects",
    desc: "The agent builds a causal graph. ECB pause → EUR strength → margin pressure on EU exporters → downgrade watch on ASML, LVMH.",
    code: `$ aarthik.trace "ECB holds rates"
└─ EUR/USD       +0.4σ    primary
  ├─ ASML         -0.8%   fx transl, guide risk
  ├─ LVMH         -1.2%   US demand soft
  └─ SAP          +0.3%   euro earnings boost
> confidence: 0.72   [see sources]`,
  },
  {
    n: "03",
    title: "Score — weigh against your holdings",
    desc: "Every signal is scored by magnitude, direction, and overlap with your actual positions. Noise gets filtered. Conviction rises to the top.",
    code: `$ aarthik.rank --portfolio diversified
1. TSM         +2.1%  [guide raise, read-through to NVDA]
2. ASML        -1.4%  [EUR strength + ECB dovish]
3. XLE         +0.6%  [OPEC hints]
— 14 signals filtered as noise`,
  },
  {
    n: "04",
    title: "Brief — speak like a human",
    desc: "At 7:45 AM your time, you get a 90-second read. Only what changed. Only what matters. Links to every source, ready for a one-click dissent.",
    code: `$ aarthik.brief --deliver 07:45
╭─ Morning brief · Mon 14 Oct
│  Portfolio: +0.3% pre-mkt
│  Top mover: TSM +2.1% on guide raise
│  Watch: ASML into EU open
│  Thesis check: 2 intact · 1 weakened
╰─ [audio 1:28]  [read full]  [dispute]`,
  },
];

export const CAUSAL_NODES = [
  { id: "fed", x: 80, y: 120, label: "Fed pause", cat: "root" as const },
  { id: "usd", x: 300, y: 80, label: "USD ↓", cat: "macro" as const },
  { id: "em", x: 300, y: 200, label: "EM equities ↑", cat: "macro" as const },
  { id: "ig", x: 300, y: 310, label: "IG credit ↑", cat: "macro" as const },
  { id: "gold", x: 520, y: 60, label: "Gold ↑", cat: "asset" as const },
  { id: "tsm", x: 520, y: 180, label: "TSM +0.4%", cat: "hold" as const },
  { id: "nem", x: 720, y: 60, label: "NEM +2.1%", cat: "hold" as const },
  { id: "asml", x: 520, y: 290, label: "ASML ±", cat: "hold" as const },
  { id: "lqd", x: 720, y: 320, label: "LQD +0.3%", cat: "hold" as const },
];

export const CAUSAL_EDGES_GRAPH = [
  { from: "fed", to: "usd", w: 0.72 },
  { from: "fed", to: "em", w: 0.55 },
  { from: "fed", to: "ig", w: 0.6 },
  { from: "usd", to: "gold", w: 0.8 },
  { from: "em", to: "tsm", w: 0.45 },
  { from: "gold", to: "nem", w: 0.85 },
  { from: "ig", to: "lqd", w: 0.7 },
  { from: "em", to: "asml", w: 0.3 },
];

export const CAUSAL_LEGEND = [
  { from: "Fed pause", to: "USD ↓", effect: "-0.6σ" },
  { from: "USD ↓", to: "EM equities ↑", effect: "+1.2σ" },
  { from: "USD ↓", to: "Gold ↑", effect: "+0.8σ" },
  { from: "EM ↑", to: "TSM ↑", effect: "+0.4%" },
  { from: "Gold ↑", to: "NEM ↑", effect: "+2.1%" },
  { from: "Fed pause", to: "IG credit ↑", effect: "+0.3σ" },
];

export const COMPARISONS = [
  { row: "Personalized to your holdings", bb: "no", robo: "partial", adv: "yes", us: "yes" },
  { row: "Explains its reasoning", bb: "no", robo: "no", adv: "partial", us: "yes" },
  { row: "Live, 24/7 monitoring", bb: "yes", robo: "no", adv: "no", us: "yes" },
  { row: "Reads primary sources", bb: "yes", robo: "no", adv: "partial", us: "yes" },
  { row: "Natural-language interface", bb: "no", robo: "partial", adv: "yes", us: "yes" },
  { row: "Cost / month", bb: "$2k+", robo: "$0", adv: "1%/yr", us: "$49" },
];

export const TESTIMONIALS = [
  {
    quote:
      "I stopped reading Bloomberg at 6 AM. Aarthik tells me the three things that actually matter to my book.",
    name: "Priya Ramanathan",
    role: "Retail investor · NYC",
    stat: "14mo user",
    initial: "P",
  },
  {
    quote:
      "The first tool that actually understands why I hold what I hold. The causal graph is the feature I didn't know I needed.",
    name: "Marcus Okafor",
    role: "Software eng · self-directed",
    stat: "$420k tracked",
    initial: "M",
  },
  {
    quote:
      "It caught a read-through on one of my holdings three hours before the Street did. Paid for itself on day one.",
    name: "Daria Vasquez",
    role: "Former PM, now DIY",
    stat: "Since beta",
    initial: "D",
  },
];

export const TRUST = [
  {
    title: "Source-anchored",
    body: "Every claim cites a primary source with a timestamp. No hallucinated tickers, no invented numbers.",
    icon: "link" as const,
  },
  {
    title: "Read-only access",
    body: "Brokerage connections use read-only API keys. Aarthik can see your holdings. It cannot trade them.",
    icon: "lock" as const,
  },
  {
    title: "Not financial advice",
    body: "Aarthik is a research assistant, not an RIA. All outputs are informational; decisions are yours.",
    icon: "shield" as const,
  },
  {
    title: "Your data, your vault",
    body: "Portfolios, chats, and preferences are encrypted at rest and never used to train third-party models.",
    icon: "vault" as const,
  },
];

export const FAQ = [
  {
    q: "Does Aarthik actually trade for me?",
    a: "No. Aarthik reads the market and reasons about your holdings. Execution is always your decision — we connect read-only and deliver analysis; we never place orders on your behalf.",
  },
  {
    q: "How is this different from ChatGPT or Claude?",
    a: "General chatbots answer in the abstract. Aarthik is grounded in your actual portfolio, subscribes to live news feeds, cites every claim to a timestamped primary source, and runs continuously in the background — not just when you ask.",
  },
  {
    q: "What brokerages do you support?",
    a: "Interactive Brokers, Schwab, Fidelity, Robinhood, and Coinbase at launch — read-only via OAuth. You can also paste tickers manually. Broker support expands monthly; request yours at signup.",
  },
  {
    q: "How accurate is the reasoning?",
    a: "Every conclusion ships with a confidence score and source chain. We backtest causal inferences quarterly against realized price moves and publish the hit-rate. When the model is uncertain, it says so explicitly.",
  },
  {
    q: "What data sources does it read?",
    a: "Reuters, Bloomberg, FT, WSJ, Nikkei, SEC filings, Fed minutes, ECB communications, commodity exchanges, and 40+ sector specialists. We do not train on your portfolio or your questions.",
  },
  {
    q: "How much does it cost?",
    a: "$49/month. No tiers, no upsells, no percentage of AUM. You can cancel anytime; your data exports on request.",
  },
];

export const TICKER_DATA = [
  { sym: "SPX", val: "5,814.2", pct: "+0.42%", dir: "up" as const },
  { sym: "NDX", val: "20,412", pct: "+0.81%", dir: "up" as const },
  { sym: "TSM", val: "$198.40", pct: "+2.14%", dir: "up" as const },
  { sym: "NVDA", val: "$138.10", pct: "+1.22%", dir: "up" as const },
  { sym: "ASML", val: "€698.20", pct: "-1.40%", dir: "down" as const },
  { sym: "LVMH", val: "€611.80", pct: "-1.20%", dir: "down" as const },
  { sym: "XAU", val: "$2,640", pct: "+0.81%", dir: "up" as const },
  { sym: "EURUSD", val: "1.0842", pct: "+0.40%", dir: "up" as const },
  { sym: "US10Y", val: "4.112%", pct: "-3bp", dir: "down" as const },
  { sym: "BRN", val: "$79.20", pct: "+0.62%", dir: "up" as const },
  { sym: "FCX", val: "$48.92", pct: "+1.80%", dir: "up" as const },
  { sym: "NEM", val: "$56.10", pct: "+2.10%", dir: "up" as const },
];

export const DEMO_CONVO = [
  { role: "user" as const, text: "Why did TSM jump this morning?" },
  {
    role: "agent" as const,
    kind: "step" as const,
    title: "INGEST",
    body: "Pulled TSM guide raise (+6%), Morgan Stanley note, TXN read-through. 3 sources.",
  },
  {
    role: "agent" as const,
    kind: "step" as const,
    title: "TRACE",
    body: "TSM guide ↑ → NVDA demand signal ↑ → AI capex intact → read-through to ASML (positive).",
  },
  {
    role: "agent" as const,
    kind: "text" as const,
    text: "TSM is +2.14% on a revenue guide raise of +6% for Q4, driven by AI accelerator demand. This is bullish for your NVDA (+1.2% pre-mkt) and partly offsets ASML's EU-macro drag.",
  },
  {
    role: "agent" as const,
    kind: "suggest" as const,
    items: ["Show the causal graph", "Should I trim NVDA?", "What about ASML?"],
  },
];

export const SOURCES = [
  "Reuters",
  "Bloomberg",
  "FT",
  "WSJ",
  "Nikkei",
  "SEC Edgar",
  "Fed",
  "ECB",
  "OPEC",
  "S&P",
  "Moody's",
  "IMF",
];

export const NAV_LINKS = [
  { href: "#how", label: "How it works" },
  { href: "#causal", label: "Reasoning" },
  { href: "#compare", label: "Compare" },
  { href: "#faq", label: "FAQ" },
];
