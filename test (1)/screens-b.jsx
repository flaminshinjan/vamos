// Screen 3: Agent reasoning (live)
// Screen 4: Final briefing with causal graph

function AgentReasoning({ portfolioId, onDone, onBack, verbosity }) {
  const [activeIdx, setActiveIdx] = React.useState(0);
  const [completed, setCompleted] = React.useState([]);

  React.useEffect(() => {
    let cancelled = false;
    let i = 0;
    const tick = () => {
      if (cancelled) return;
      setActiveIdx(i);
      const step = REASONING_STEPS[i];
      setTimeout(() => {
        if (cancelled) return;
        setCompleted(prev => [...prev, step.id]);
        i += 1;
        if (i < REASONING_STEPS.length) tick();
        else setTimeout(() => { if (!cancelled) onDone && onDone(); }, 600);
      }, step.duration);
    };
    tick();
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{maxWidth:1180, margin:'0 auto', padding:'48px 32px 80px'}}>
      <div className="fade-up" style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom: 32}}>
        <div>
          <div className="eyebrow" style={{marginBottom:10}}>Step 03 · Autonomous reasoning</div>
          <h2 className="serif" style={{fontSize:44, letterSpacing:'-0.02em', margin:0}}>
            The agent is <em style={{color:'var(--accent)'}}>thinking</em>…
          </h2>
          <p style={{color:'var(--ink-3)', maxWidth:620, marginTop:10, fontSize:14}}>
            Each step is traced to Langfuse with prompts, responses, and token usage. The reasoning layer decides what is relevant.
          </p>
        </div>
        <button className="btn btn-ghost" onClick={onBack}>← Back</button>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1.2fr 1fr', gap: 18}}>
        {/* Steps */}
        <div className="card" style={{padding:28}}>
          <div style={{display:'flex', justifyContent:'space-between', marginBottom:24}}>
            <div className="eyebrow">Reasoning trace</div>
            <span className="mono" style={{fontSize:11, color:'var(--ink-3)'}}>
              run_id · {Math.random().toString(16).slice(2, 10)}
            </span>
          </div>
          <div style={{display:'flex', flexDirection:'column', gap:4}}>
            {REASONING_STEPS.map((s, i) => {
              const isActive = i === activeIdx && !completed.includes(s.id);
              const isDone = completed.includes(s.id);
              const isPending = i > activeIdx;
              return (
                <div key={s.id} style={{
                  display:'grid', gridTemplateColumns:'28px 1fr auto', gap:14, alignItems:'center',
                  padding:'14px 4px',
                  borderBottom: i < REASONING_STEPS.length-1 ? '1px dashed var(--line)' : 'none',
                  opacity: isPending ? 0.4 : 1,
                  transition: 'opacity 0.3s ease',
                }}>
                  <div style={{
                    width:22, height:22, borderRadius:'50%',
                    display:'grid', placeItems:'center',
                    border: `1px solid ${isDone?'var(--pos)':isActive?'var(--accent)':'var(--line-strong)'}`,
                    background: isDone?'var(--pos-soft)':isActive?'var(--accent-soft)':'transparent',
                  }}>
                    {isDone ? (
                      <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5 L4 7 L8 3" stroke="var(--pos)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    ) : isActive ? (
                      <div className="pulse" style={{width:6, height:6, borderRadius:'50%', background:'var(--accent)'}} />
                    ) : (
                      <span className="mono" style={{fontSize:10, color:'var(--ink-4)'}}>{i+1}</span>
                    )}
                  </div>
                  <div>
                    <div style={{fontWeight: isActive?600:500, fontSize:14}}>{s.label}{isActive && <span className="caret" />}</div>
                    <div style={{fontSize:12, color:'var(--ink-3)', marginTop:2}}>{s.detail}</div>
                  </div>
                  <div className="mono" style={{fontSize:11, color:'var(--ink-3)'}}>
                    {isDone ? `${(s.duration/1000).toFixed(1)}s` : isActive ? '…' : '—'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Side — Live evidence */}
        <div style={{display:'flex', flexDirection:'column', gap:18}}>
          <div className="card" style={{padding:22}}>
            <div className="eyebrow" style={{marginBottom:14}}>Live evidence</div>
            <div style={{display:'flex', flexDirection:'column', gap:10}}>
              {[
                { k: 'Indices ingested', v: '5', active: activeIdx>=0 },
                { k: 'News classified', v: `${Math.min(4, activeIdx+1)} / 4`, active: activeIdx>=1 },
                { k: 'Causal paths found', v: activeIdx>=4 ? '7' : '…', active: activeIdx>=4 },
                { k: 'Conflicts resolved', v: activeIdx>=5 ? '2' : '…', active: activeIdx>=5 },
                { k: 'Tokens used', v: activeIdx>=6 ? '3,142' : '…', active: activeIdx>=6 },
              ].map(row => (
                <div key={row.k} style={{display:'flex', justifyContent:'space-between', fontSize:13, padding:'6px 0', opacity: row.active?1:0.5}}>
                  <span style={{color:'var(--ink-3)'}}>{row.k}</span>
                  <span className="mono tnum">{row.v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{padding:22, background: 'var(--ink)', color:'var(--bg)', borderColor:'var(--ink)'}}>
            <div className="eyebrow" style={{color:'rgba(255,253,248,0.6)', marginBottom:14}}>Prompt preview</div>
            <pre className="mono" style={{fontSize:11, lineHeight:1.6, margin:0, whiteSpace:'pre-wrap', color:'rgba(255,253,248,0.85)'}}>
{`You are Aarthik, a causal reasoning agent.
INPUT: portfolio=${portfolioId}
       indices=[NIFTY -1.00, SENSEX -0.99, ...]
       news=[4 classified items]
TASK:  link high-impact news → sectors
       → holdings in the portfolio.
CONSTRAINTS:
  - verbosity=${verbosity}
  - cite sources by id
  - return Confidence ∈ [0,1]`}
            </pre>
          </div>

          <div className="card shimmer" style={{padding:'16px 22px', background:'var(--accent-soft)', borderColor:'transparent'}}>
            <div style={{display:'flex', alignItems:'center', gap:10}}>
              <div className="pulse" style={{width:8, height:8, borderRadius:'50%', background:'var(--accent)'}} />
              <span style={{fontSize:12.5, color:'var(--accent-ink)'}}>
                Streaming from <span className="mono">claude-sonnet-4.5</span> · traced to Langfuse
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== Causal graph =====
function CausalGraph({ portfolio }) {
  // 4 columns: News → Sector → Stock → Portfolio
  const news = [
    { id: 'rbi', label: 'RBI holds rate · hawkish', sent: 'neg' },
    { id: 'fed', label: 'US Fed higher-for-longer', sent: 'pos' },
    { id: 'fmcg', label: 'Resilient rural demand', sent: 'pos' },
  ];
  const sectors = [
    { id: 'Banking', label: 'Banking', sent: 'neg' },
    { id: 'IT', label: 'IT', sent: 'pos' },
    { id: 'FMCG', label: 'FMCG', sent: 'pos' },
  ];
  const stocks = portfolio.holdings.slice(0, 5).map(h => ({ id: h.symbol, label: h.symbol, sector: h.sector, day: h.day }));

  // Links
  const nsLinks = [
    ['rbi','Banking'], ['fed','IT'], ['fmcg','FMCG'],
  ];
  const ssLinks = stocks.map(s => [s.sector, s.id]).filter(([sec]) => sectors.find(x => x.id === sec));

  // Geometry
  const W = 920, H = 440;
  const cols = [60, 320, 600, 860];
  const nodeX = { news: cols[0], sector: cols[1], stock: cols[2], port: cols[3] };

  const yFor = (arr, i) => {
    const gap = (H - 80) / Math.max(1, arr.length);
    return 40 + gap * (i + 0.5);
  };
  const newsY = Object.fromEntries(news.map((n, i) => [n.id, yFor(news, i)]));
  const secY = Object.fromEntries(sectors.map((s, i) => [s.id, yFor(sectors, i)]));
  const stockY = Object.fromEntries(stocks.map((s, i) => [s.id, yFor(stocks, i)]));
  const portY = H/2;

  const colorFor = sent => sent === 'pos' ? 'var(--pos)' : sent === 'neg' ? 'var(--neg)' : 'var(--ink-4)';
  const strokeFor = sent => sent === 'pos' ? '#2F6B3F' : sent === 'neg' ? '#9A3B2C' : '#6E6A62';

  const curve = (x1, y1, x2, y2) => {
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%', height:'auto', maxHeight: 520}}>
      {/* Column labels */}
      {['News', 'Sector', 'Stock', 'Portfolio'].map((l, i) => (
        <text key={l} x={cols[i]} y={18} textAnchor={i===3?'end':'start'}
          fontSize="10" fontFamily="JetBrains Mono, monospace" fill="var(--ink-4)" letterSpacing="1.5">
          {String(i+1).padStart(2,'0')} · {l.toUpperCase()}
        </text>
      ))}

      {/* News → Sector links */}
      {nsLinks.map(([a, b], i) => (
        <path key={`ns${i}`} d={curve(nodeX.news + 150, newsY[a], nodeX.sector - 6, secY[b])}
          stroke={strokeFor(news.find(n => n.id===a).sent)} strokeOpacity="0.35" strokeWidth="1.5" fill="none"
          strokeDasharray="300" strokeDashoffset="300"
          style={{animation: `draw 0.9s ease forwards ${0.2 + i*0.1}s`}}
        />
      ))}

      {/* Sector → Stock links */}
      {ssLinks.map(([sec, stk], i) => (
        <path key={`ss${i}`} d={curve(nodeX.sector + 120, secY[sec], nodeX.stock - 6, stockY[stk])}
          stroke={strokeFor(sectors.find(s => s.id===sec).sent)} strokeOpacity="0.3" strokeWidth="1.2" fill="none"
          strokeDasharray="300" strokeDashoffset="300"
          style={{animation: `draw 0.9s ease forwards ${0.5 + i*0.08}s`}}
        />
      ))}

      {/* Stock → Portfolio links */}
      {stocks.map((s, i) => (
        <path key={`sp${i}`} d={curve(nodeX.stock + 80, stockY[s.id], nodeX.port - 20, portY)}
          stroke={s.day >= 0 ? '#2F6B3F' : '#9A3B2C'} strokeOpacity="0.28" strokeWidth="1" fill="none"
          strokeDasharray="300" strokeDashoffset="300"
          style={{animation: `draw 0.9s ease forwards ${0.8 + i*0.06}s`}}
        />
      ))}

      {/* News nodes */}
      {news.map((n, i) => (
        <g key={n.id} style={{animation: `fadeIn 0.4s ease both ${0.1 + i*0.08}s`}}>
          <rect x={nodeX.news} y={newsY[n.id]-16} width="150" height="32" rx="4"
                fill="var(--bg-elev)" stroke={strokeFor(n.sent)} strokeOpacity="0.3" />
          <circle cx={nodeX.news + 10} cy={newsY[n.id]} r="3" fill={strokeFor(n.sent)} />
          <text x={nodeX.news + 20} y={newsY[n.id]+4} fontSize="10.5" fill="var(--ink-2)" fontFamily="Inter Tight">
            {n.label.length > 22 ? n.label.slice(0, 22) + '…' : n.label}
          </text>
        </g>
      ))}

      {/* Sector nodes */}
      {sectors.map((s, i) => (
        <g key={s.id} style={{animation: `fadeIn 0.4s ease both ${0.4 + i*0.08}s`}}>
          <rect x={nodeX.sector - 6} y={secY[s.id]-16} width="126" height="32" rx="4"
                fill={s.sent==='pos'?'var(--pos-soft)':'var(--neg-soft)'} stroke={strokeFor(s.sent)} strokeOpacity="0.5"/>
          <text x={nodeX.sector + 56} y={secY[s.id]+4} fontSize="12" fill={strokeFor(s.sent)} textAnchor="middle" fontWeight="600">
            {s.label}
          </text>
        </g>
      ))}

      {/* Stock nodes */}
      {stocks.map((s, i) => (
        <g key={s.id} style={{animation: `fadeIn 0.4s ease both ${0.7 + i*0.08}s`}}>
          <rect x={nodeX.stock - 6} y={stockY[s.id]-16} width="86" height="32" rx="4"
                fill="var(--bg-elev)" stroke="var(--line-strong)" />
          <text x={nodeX.stock + 6} y={stockY[s.id]+4} fontSize="11" fontFamily="JetBrains Mono" fill="var(--ink)">{s.label}</text>
          <text x={nodeX.stock + 74} y={stockY[s.id]+4} fontSize="10" fontFamily="JetBrains Mono" textAnchor="end"
                fill={s.day>=0?'var(--pos)':'var(--neg)'}>
            {s.day>=0?'+':'−'}{Math.abs(s.day).toFixed(1)}%
          </text>
        </g>
      ))}

      {/* Portfolio node */}
      <g style={{animation: 'fadeIn 0.5s ease both 1.2s'}}>
        <circle cx={nodeX.port} cy={portY} r="42" fill="var(--ink)" />
        <text x={nodeX.port} y={portY-4} textAnchor="end" fontSize="11" fontFamily="JetBrains Mono" fill="rgba(255,253,248,0.5)">
          PORTFOLIO
        </text>
        <text x={nodeX.port} y={portY+12} textAnchor="end" fontSize="16" fontFamily="Instrument Serif"
              fill={portfolio.dayPLPct>=0?'#8FCB9F':'#EAAC9B'}>
          {portfolio.dayPLPct>=0?'+':'−'}{Math.abs(portfolio.dayPLPct).toFixed(2)}%
        </text>
      </g>
    </svg>
  );
}

function Briefing({ portfolioId, onBack, onRestart, verbosity }) {
  const portfolio = PORTFOLIOS.find(p => p.id === portfolioId);
  const [typed, setTyped] = React.useState('');
  const fullText = React.useMemo(() => buildBriefing(portfolio, verbosity), [portfolioId, verbosity]);

  React.useEffect(() => {
    setTyped('');
    let i = 0;
    const chunk = 4;
    const iv = setInterval(() => {
      i = Math.min(i + chunk, fullText.length);
      setTyped(fullText.slice(0, i));
      if (i >= fullText.length) clearInterval(iv);
    }, 18);
    return () => clearInterval(iv);
  }, [fullText]);

  const confidence = 0.82;
  const scores = [
    { k: 'Causal depth', v: 0.88 },
    { k: 'Coverage', v: 0.81 },
    { k: 'Signal-to-noise', v: 0.76 },
    { k: 'Conflict handling', v: 0.84 },
  ];

  return (
    <div style={{maxWidth:1180, margin:'0 auto', padding:'40px 32px 80px'}}>
      <div className="fade-up" style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom: 28}}>
        <div>
          <div className="eyebrow" style={{marginBottom:10}}>Step 04 · Agent briefing</div>
          <h2 className="serif" style={{fontSize:40, letterSpacing:'-0.02em', margin:0}}>
            For <em>{portfolio.name}</em> · <span style={{color:'var(--ink-3)'}}>{portfolio.type.toLowerCase()}</span>
          </h2>
        </div>
        <div style={{display:'flex', gap:8}}>
          <button className="btn btn-ghost" onClick={onBack}>← Reasoning</button>
          <button className="btn" onClick={onRestart}>New portfolio</button>
          <button className="btn btn-accent">Regenerate briefing</button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="card fade-up" style={{padding:'22px 28px', marginBottom: 18, display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap: 24}}>
        <div>
          <div className="eyebrow" style={{marginBottom:8}}>Portfolio value</div>
          <div className="kpi-num">{formatINR(portfolio.value)}</div>
        </div>
        <div>
          <div className="eyebrow" style={{marginBottom:8}}>Day P&amp;L</div>
          <div className="kpi-num" style={{color: portfolio.dayPL>=0?'var(--pos)':'var(--neg)'}}>
            {portfolio.dayPL>=0?'+':'−'}{formatINR(Math.abs(portfolio.dayPL)).replace('₹','₹')}
          </div>
          <div className="mono" style={{fontSize:12, color: portfolio.dayPLPct>=0?'var(--pos)':'var(--neg)'}}>
            {portfolio.dayPLPct>=0?'+':'−'}{Math.abs(portfolio.dayPLPct).toFixed(2)}%
          </div>
        </div>
        <div>
          <div className="eyebrow" style={{marginBottom:8}}>Overall gain</div>
          <div className="kpi-num pos-fg">+{formatINR(portfolio.overallGain)}</div>
          <div className="mono" style={{fontSize:12, color:'var(--pos)'}}>+{portfolio.overallGainPct.toFixed(2)}%</div>
        </div>
        <div>
          <div className="eyebrow" style={{marginBottom:8}}>Confidence</div>
          <div className="kpi-num" style={{color:'var(--accent)'}}>{Math.round(confidence*100)}<span style={{fontSize:20}}>%</span></div>
          <div className="mono" style={{fontSize:11, color:'var(--ink-3)'}}>self-evaluated</div>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:18}}>
        {/* Briefing */}
        <div className="card fade-up" style={{padding:30}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18}}>
            <div className="eyebrow">Agent briefing</div>
            <div style={{display:'flex', gap:6}}>
              <span className="pill accent"><span className="dot accent" /> sonnet-4.5</span>
              <span className="pill">3.1k tokens</span>
            </div>
          </div>
          <div className="serif" style={{fontSize:22, lineHeight:1.45, color:'var(--ink)', letterSpacing:'-0.005em', whiteSpace:'pre-wrap'}}>
            {typed}<span className="caret" style={{display: typed.length<fullText.length?'inline-block':'none'}} />
          </div>

          <div style={{marginTop:26, paddingTop:20, borderTop:'1px solid var(--line)'}}>
            <div className="eyebrow" style={{marginBottom:14}}>Sources</div>
            <div style={{display:'flex', flexDirection:'column', gap:8}}>
              {NEWS.slice(0,3).map((n, i) => (
                <div key={n.id} style={{display:'flex', gap:10, fontSize:12.5, color:'var(--ink-2)', padding:'6px 0'}}>
                  <span className="mono" style={{color:'var(--accent)'}}>[{i+1}]</span>
                  <span style={{flex:1}}>{n.headline}</span>
                  <span className="mono" style={{color:'var(--ink-3)'}}>{n.source}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column — Self-evaluation + risk */}
        <div style={{display:'flex', flexDirection:'column', gap:18}}>
          <div className="card fade-up" style={{padding:24, animationDelay:'0.1s'}}>
            <div className="eyebrow" style={{marginBottom:14}}>Self-evaluation</div>
            {scores.map(s => (
              <div key={s.k} style={{marginBottom: 12}}>
                <div style={{display:'flex', justifyContent:'space-between', fontSize:12.5, marginBottom:6}}>
                  <span style={{color:'var(--ink-2)'}}>{s.k}</span>
                  <span className="mono tnum" style={{color:'var(--accent)'}}>{s.v.toFixed(2)}</span>
                </div>
                <div style={{height:4, background:'var(--bg-sunk)', borderRadius:2, overflow:'hidden'}}>
                  <div style={{width:`${s.v*100}%`, height:'100%', background:'var(--accent)'}} />
                </div>
              </div>
            ))}
          </div>

          <div className="card fade-up" style={{padding:24, animationDelay:'0.15s'}}>
            <div style={{display:'flex', justifyContent:'space-between', marginBottom:14}}>
              <div className="eyebrow">Risk detection</div>
              {portfolio.sectors[0].weight > 40 ? (
                <span className="pill warn"><span className="dot warn" /> Concentration</span>
              ) : (
                <span className="pill pos"><span className="dot pos" /> Balanced</span>
              )}
            </div>
            {portfolio.sectors.map((s, i) => (
              <div key={s.name} style={{display:'grid', gridTemplateColumns:'110px 1fr 50px', gap:10, alignItems:'center', padding:'6px 0', fontSize:12.5}}>
                <span style={{color: s.weight>40?'var(--neg)':'var(--ink-2)'}}>{s.name}</span>
                <div style={{height:6, background:'var(--bg-sunk)', borderRadius:3, overflow:'hidden'}}>
                  <div style={{width:`${Math.min(100, s.weight*1.5)}%`, height:'100%',
                    background: s.weight>40?'var(--neg)': i===0?'var(--accent)':'var(--ink-4)'}} />
                </div>
                <span className="mono tnum" style={{textAlign:'right', color:'var(--ink-3)'}}>{s.weight.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Causal graph */}
      <div className="card fade-up" style={{padding:28, marginTop:18}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:18}}>
          <div>
            <div className="eyebrow">Causal chain</div>
            <div className="serif" style={{fontSize:24, marginTop:4}}>
              How today's news <em>actually</em> touched this portfolio
            </div>
          </div>
          <span className="mono" style={{fontSize:11, color:'var(--ink-3)'}}>high-impact paths only · threshold 0.50</span>
        </div>
        <CausalGraph portfolio={portfolio} />
      </div>

      {/* Observability */}
      <div className="card fade-up" style={{padding:24, marginTop:18, background:'var(--bg-sunk)', borderColor:'transparent'}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div>
            <div className="eyebrow" style={{marginBottom:6}}>Observability</div>
            <div style={{fontSize:14}}>Full prompt + response trace available in Langfuse.</div>
          </div>
          <div style={{display:'flex', gap:18, alignItems:'center', fontSize:12.5, color:'var(--ink-3)'}}>
            <span><span className="mono" style={{color:'var(--ink)'}}>3,142</span> tokens</span>
            <span><span className="mono" style={{color:'var(--ink)'}}>7</span> spans</span>
            <span><span className="mono" style={{color:'var(--ink)'}}>4.8s</span> latency</span>
            <button className="btn btn-sm">Open trace →</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function buildBriefing(p, verbosity) {
  const concise = verbosity === 'concise';
  const topSector = p.sectors[0];
  const bearish = 'Markets closed bearish as the RBI held rates with a hawkish tilt, weighing on financials.';
  const twist = 'IT rallied on rupee weakness after the Fed minutes, and FMCG held firm on rural demand.';
  const impact = `Your portfolio ${p.dayPLPct >= 0 ? 'gained' : 'fell'} ${Math.abs(p.dayPLPct).toFixed(2)}% today`;

  if (p.id === 'aggressive') {
    const body = `${impact} — the loss is almost entirely explained by Banking exposure. With ${topSector.weight.toFixed(1)}% in Banking & Finance (well above the 40% concentration threshold), HDFCBANK, ICICIBANK, and SBIN each fell 2–3% in reaction to the RBI decision.`;
    const tail = concise ? '' : `\n\nThe positive IT and FMCG tailwinds could not offset this — you hold less than 15% combined in those sectors. Consider trimming 8–10% from Banking into defensives.`;
    return `${bearish}\n\n${body}${tail}\n\nConfidence is high: the causal path News → Banking → your top 3 holdings is direct and has no conflicting signals.`;
  }
  if (p.id === 'conservative') {
    const body = `${impact} — a nearly flat day, as expected for a debt-heavy book. The Gilt and Corp Bond funds (${(34.2).toFixed(1)}% combined) absorbed the equity drag, and your FMCG tilt (ITC, HINDUNILVR, NESTLEIND) actually added ₹1,800 on resilient rural demand.`;
    const tail = concise ? '' : `\n\nNo concentration risk detected. The only latent exposure is duration risk on the Gilt fund if the RBI's hawkishness extends — worth monitoring, but no action indicated today.`;
    return `${bearish}\n\n${body}${tail}\n\nConfidence is moderate: bond-market effects are modeled indirectly via index proxies.`;
  }
  // diversified
  const body = `${impact} driven mainly by HDFCBANK (−2.1%, 7.8% weight) as RBI news hit financials. ${twist} INFY and TCS contributed +0.16% to the day, and ITC added +0.02%, partially offsetting the banking drag.`;
  const tail = concise ? '' : `\n\nYour sector mix is balanced — no single bucket exceeds 25%. The net −0.43% closely tracks the NIFTY 50, which is the expected behavior for a diversified book on days with this news mix.`;
  return `${bearish}\n\n${body}${tail}\n\nConfidence is high: three independent causal paths converge on the same net impact.`;
}

Object.assign(window, { AgentReasoning, Briefing, CausalGraph, buildBriefing });
