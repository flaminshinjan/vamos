// Mock data for the Autonomous Financial Advisor Agent
// Indian market context — NIFTY/SENSEX, INR

const PORTFOLIOS = [
  {
    id: 'diversified',
    name: 'Rohan Sharma',
    type: 'Diversified',
    value: 2875420,
    dayPL: -12480,
    dayPLPct: -0.43,
    overallGain: 375200,
    overallGainPct: 15.02,
    tagline: 'Well-diversified portfolio across sectors with balanced equity-MF allocation',
    holdings: [
      { symbol: 'INFY', sector: 'IT', weight: 8.2, day: 1.24, overall: 12.4, value: 235684 },
      { symbol: 'HDFCBANK', sector: 'Banking', weight: 7.8, day: -2.11, overall: 4.2, value: 224289 },
      { symbol: 'RELIANCE', sector: 'Energy', weight: 6.5, day: 0.34, overall: 18.7, value: 186902 },
      { symbol: 'TCS', sector: 'IT', weight: 5.4, day: 1.81, overall: 10.9, value: 155273 },
      { symbol: 'ITC', sector: 'FMCG', weight: 4.2, day: 0.43, overall: 11.3, value: 120767 },
    ],
    funds: [
      { name: 'Parag Parikh Flexi Cap', cat: 'Flexi Cap', weight: 18.5, day: -0.50, value: 531953 },
      { name: 'HDFC Balanced Advantage', cat: 'Balanced', weight: 12.4, day: -0.40, value: 356552 },
    ],
    sectors: [
      { name: 'IT', weight: 22.1 },
      { name: 'Banking', weight: 18.6 },
      { name: 'FMCG', weight: 14.2 },
      { name: 'Energy', weight: 11.8 },
      { name: 'Pharma', weight: 9.4 },
      { name: 'Other', weight: 23.9 },
    ],
  },
  {
    id: 'aggressive',
    name: 'Priya Patel',
    type: 'Sector-concentrated',
    value: 2045680,
    dayPL: -38460,
    dayPLPct: -1.85,
    overallGain: 245420,
    overallGainPct: 13.65,
    tagline: 'Banking and Financial Services heavy portfolio with high sector concentration',
    holdings: [
      { symbol: 'HDFCBANK', sector: 'Banking', weight: 18.4, day: -2.11, overall: 4.2, value: 376405 },
      { symbol: 'ICICIBANK', sector: 'Banking', weight: 14.2, day: -2.44, overall: 8.1, value: 290487 },
      { symbol: 'SBIN', sector: 'Banking', weight: 11.8, day: -2.89, overall: 6.7, value: 241390 },
      { symbol: 'AXISBANK', sector: 'Banking', weight: 8.6, day: -1.97, overall: 3.4, value: 175928 },
      { symbol: 'BAJFINANCE', sector: 'Finance', weight: 7.1, day: -3.12, overall: 2.1, value: 145243 },
    ],
    funds: [
      { name: 'Nippon India Banking Fund', cat: 'Sectoral', weight: 22.5, day: -2.30, value: 460278 },
    ],
    sectors: [
      { name: 'Banking', weight: 53.0 },
      { name: 'Finance', weight: 18.3 },
      { name: 'IT', weight: 8.2 },
      { name: 'Pharma', weight: 6.5 },
      { name: 'FMCG', weight: 5.1 },
      { name: 'Other', weight: 8.9 },
    ],
  },
  {
    id: 'conservative',
    name: 'Arun Krishnamurthy',
    type: 'Conservative',
    value: 4125680,
    dayPL: -1758,
    dayPLPct: -0.04,
    overallGain: 423799,
    overallGainPct: 11.13,
    tagline: 'Conservative mutual fund heavy portfolio with defensive stock picks',
    holdings: [
      { symbol: 'ITC', sector: 'FMCG', weight: 5.2, day: 0.43, overall: 11.3, value: 214535 },
      { symbol: 'HINDUNILVR', sector: 'FMCG', weight: 3.6, day: 0.47, overall: 7.7, value: 148524 },
      { symbol: 'POWERGRID', sector: 'Energy', weight: 2.9, day: 0.56, overall: 12.6, value: 119645 },
      { symbol: 'NTPC', sector: 'Energy', weight: 2.8, day: 0.84, overall: 11.7, value: 115519 },
      { symbol: 'NESTLEIND', sector: 'FMCG', weight: 1.8, day: 0.30, overall: 7.8, value: 74262 },
    ],
    funds: [
      { name: 'HDFC Balanced Advantage', cat: 'Balanced', weight: 28.8, day: -0.40, value: 1188195 },
      { name: 'ICICI Prudential Corp Bond', cat: 'Corp Bond', weight: 18.3, day: 0.05, value: 755199 },
      { name: 'SBI Magnum Gilt Fund', cat: 'Gilt', weight: 15.9, day: -0.05, value: 656183 },
    ],
    sectors: [
      { name: 'Debt / Gilt', weight: 34.2 },
      { name: 'Balanced', weight: 28.8 },
      { name: 'FMCG', weight: 12.4 },
      { name: 'Energy', weight: 8.6 },
      { name: 'Banking', weight: 6.1 },
      { name: 'Other', weight: 9.9 },
    ],
  },
];

const MARKET = {
  sentiment: 'BEARISH',
  summary: 'Broad indices averaged −0.99%. 3 sectors advanced, 7 declined. RBI rate decision weighing on financials.',
  indices: [
    { name: 'NIFTY 50', change: -1.00 },
    { name: 'SENSEX', change: -0.99 },
    { name: 'BANKNIFTY', change: -2.33 },
    { name: 'NIFTYIT', change: 1.22 },
    { name: 'NIFTYPHARMA', change: 0.66 },
  ],
  gainers: [
    { name: 'Information Technology', change: 1.58 },
    { name: 'Pharmaceuticals', change: 0.78 },
    { name: 'FMCG', change: 0.25 },
  ],
  losers: [
    { name: 'Banking', change: -2.45 },
    { name: 'Realty', change: -2.10 },
    { name: 'Automobile', change: -1.85 },
  ],
};

const NEWS = [
  {
    id: 'n1',
    headline: 'RBI holds repo rate at 6.5%, signals prolonged hawkish stance on inflation',
    source: 'Economic Times',
    time: '2h ago',
    sentiment: 'negative',
    scope: 'Sector-specific',
    entities: ['Banking', 'Finance', 'HDFCBANK', 'ICICIBANK', 'SBIN'],
    impact: 0.92,
  },
  {
    id: 'n2',
    headline: 'US Fed minutes suggest higher-for-longer; IT services see tailwind from rupee weakness',
    source: 'Mint',
    time: '4h ago',
    sentiment: 'positive',
    scope: 'Sector-specific',
    entities: ['IT', 'INFY', 'TCS', 'WIPRO'],
    impact: 0.78,
  },
  {
    id: 'n3',
    headline: 'FMCG majors report resilient rural demand in Q3 earnings preview',
    source: 'Business Standard',
    time: '6h ago',
    sentiment: 'positive',
    scope: 'Sector-specific',
    entities: ['FMCG', 'ITC', 'HINDUNILVR', 'NESTLEIND'],
    impact: 0.54,
  },
  {
    id: 'n4',
    headline: 'Crude oil slips 2.3% on demand concerns; OMCs likely to benefit',
    source: 'Reuters',
    time: '8h ago',
    sentiment: 'neutral',
    scope: 'Market-wide',
    entities: ['Energy', 'Oil'],
    impact: 0.41,
  },
];

// Reasoning steps the agent "thinks" through
const REASONING_STEPS = [
  { id: 's1', label: 'Ingesting market data', detail: 'NIFTY 50, SENSEX, sectoral indices', duration: 800 },
  { id: 's2', label: 'Classifying news', detail: '4 headlines → sentiment + scope + entities', duration: 1100 },
  { id: 's3', label: 'Mapping news to sectors', detail: 'RBI → Banking · Fed → IT · Demand → FMCG', duration: 900 },
  { id: 's4', label: 'Computing portfolio exposure', detail: 'Sector weights vs. news entities', duration: 700 },
  { id: 's5', label: 'Identifying causal links', detail: 'High-impact paths only (>0.5)', duration: 1000 },
  { id: 's6', label: 'Resolving conflicts', detail: 'Positive news vs. price action', duration: 800 },
  { id: 's7', label: 'Self-evaluating output', detail: 'Reasoning quality + coverage + confidence', duration: 900 },
];

Object.assign(window, { PORTFOLIOS, MARKET, NEWS, REASONING_STEPS });
