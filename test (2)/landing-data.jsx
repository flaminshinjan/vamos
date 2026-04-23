// Landing page data & copy

const HERO_HEADLINE = {
  top: "The market never sleeps.",
  bottom: "Neither does your analyst.",
};

const REASONING_STEPS = [
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

const TOUR_SCREENS = [
  {
    id: "chat",
    n: "01",
    label: "Chat",
    eyebrow: "Conversation",
    title: "Your analyst, always at the prompt.",
    body: "Ask anything — about a holding, a headline, a sector. Aarthik replies with the reasoning, the sources, and the portfolio impact. No dashboards to navigate.",
    bullets: [
      "Natural language — \"what's behind the TSM rally?\"",
      "Every answer is cited. Every citation is timestamped.",
      "Conversation threads remember context across days.",
    ],
  },
  {
    id: "portfolio",
    n: "02",
    label: "Portfolio",
    eyebrow: "Positions",
    title: "Every holding, watched continuously.",
    body: "Link your brokerage or paste your tickers. Aarthik tracks thesis health, drift, and concentration — flagging the moment any of them changes.",
    bullets: [
      "Brokerage integrations with read-only access.",
      "Live thesis health score per position.",
      "Concentration & factor exposure alerts.",
    ],
  },
  {
    id: "news",
    n: "03",
    label: "News",
    eyebrow: "Signal",
    title: "News with the noise removed.",
    body: "Headlines are ranked by how much they actually affect what you own. A headline about copper is a signal if you own FCX — and a footnote if you don't.",
    bullets: [
      "Cross-source deduplication and fact-anchoring.",
      "Magnitude × overlap × direction scoring.",
      "Disputes flagged when sources contradict.",
    ],
  },
  {
    id: "reasoning",
    n: "04",
    label: "Reasoning",
    eyebrow: "Explainability",
    title: "Open the hood. Every time.",
    body: "Aarthik shows its work — the causal graph, the sources, the confidence. You can dispute any step, and the model will revise its read with your input.",
    bullets: [
      "Interactive causal graph per conclusion.",
      "Confidence intervals & source reliability.",
      "One-click dissent revises downstream signals.",
    ],
  },
  {
    id: "brief",
    n: "05",
    label: "Brief",
    eyebrow: "Morning Brief",
    title: "90 seconds before the bell.",
    body: "A personalized pre-market read delivered by text, email, or push — in readable prose or as audio. Only what changed for your book.",
    bullets: [
      "Audio narration for the commute.",
      "Scheduled or on-demand delivery.",
      "Calendar of earnings, Fed, and data prints.",
    ],
  },
];

const CAUSAL_EDGES = [
  { from: "Fed pause", to: "USD ↓",       effect: "-0.6σ" },
  { from: "USD ↓",     to: "EM equities ↑", effect: "+1.2σ" },
  { from: "USD ↓",     to: "Gold ↑",        effect: "+0.8σ" },
  { from: "EM ↑",      to: "TSM ↑",         effect: "+0.4%" },
  { from: "Gold ↑",    to: "NEM ↑",         effect: "+2.1%" },
  { from: "Fed pause", to: "IG credit ↑",   effect: "+0.3σ" },
];

const COMPARISONS = [
  { row: "Personalized to your holdings", bb: "no", robo: "partial", adv: "yes",  us: "yes" },
  { row: "Explains its reasoning",        bb: "no", robo: "no",      adv: "partial", us: "yes" },
  { row: "Live, 24/7 monitoring",         bb: "yes",robo: "no",      adv: "no",   us: "yes" },
  { row: "Reads primary sources",         bb: "yes",robo: "no",      adv: "partial", us: "yes" },
  { row: "Natural-language interface",    bb: "no", robo: "partial", adv: "yes",  us: "yes" },
  { row: "Cost / month",                  bb: "$2k+", robo: "$0",    adv: "1%/yr", us: "$49" },
];

const TESTIMONIALS = [
  {
    quote: "I stopped reading Bloomberg at 6 AM. Aarthik tells me the three things that actually matter to my book.",
    name: "Priya Ramanathan",
    role: "Retail investor · NYC",
    stat: "14mo user",
    initial: "P",
  },
  {
    quote: "The first tool that actually understands why I hold what I hold. The causal graph is the feature I didn't know I needed.",
    name: "Marcus Okafor",
    role: "Software eng · self-directed",
    stat: "$420k tracked",
    initial: "M",
  },
  {
    quote: "It caught a read-through on one of my holdings three hours before the Street did. Paid for itself on day one.",
    name: "Daria Vasquez",
    role: "Former PM, now DIY",
    stat: "Since beta",
    initial: "D",
  },
];

const TRUST = [
  {
    title: "Source-anchored",
    body: "Every claim cites a primary source with a timestamp. No hallucinated tickers, no invented numbers.",
    icon: "link",
  },
  {
    title: "Read-only access",
    body: "Brokerage connections use read-only API keys. Aarthik can see your holdings. It cannot trade them.",
    icon: "lock",
  },
  {
    title: "Not financial advice",
    body: "Aarthik is a research assistant, not an RIA. All outputs are informational; decisions are yours.",
    icon: "shield",
  },
  {
    title: "Your data, your vault",
    body: "Portfolios, chats, and preferences are encrypted at rest and never used to train third-party models.",
    icon: "vault",
  },
];

const FAQ = [
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

const TICKER_DATA = [
  { sym: "SPX",   val: "5,814.2", pct: "+0.42%", dir: "up" },
  { sym: "NDX",   val: "20,412",  pct: "+0.81%", dir: "up" },
  { sym: "TSM",   val: "$198.40", pct: "+2.14%", dir: "up" },
  { sym: "NVDA",  val: "$138.10", pct: "+1.22%", dir: "up" },
  { sym: "ASML",  val: "€698.20", pct: "-1.40%", dir: "down" },
  { sym: "LVMH",  val: "€611.80", pct: "-1.20%", dir: "down" },
  { sym: "XAU",   val: "$2,640",  pct: "+0.81%", dir: "up" },
  { sym: "EURUSD",val: "1.0842",  pct: "+0.40%", dir: "up" },
  { sym: "US10Y", val: "4.112%",  pct: "-3bp",    dir: "down" },
  { sym: "BRN",   val: "$79.20",  pct: "+0.62%", dir: "up" },
  { sym: "FCX",   val: "$48.92",  pct: "+1.80%", dir: "up" },
  { sym: "NEM",   val: "$56.10",  pct: "+2.10%", dir: "up" },
];

Object.assign(window, {
  HERO_HEADLINE,
  REASONING_STEPS,
  TOUR_SCREENS,
  CAUSAL_EDGES,
  COMPARISONS,
  TESTIMONIALS,
  TRUST,
  FAQ,
  TICKER_DATA,
});
