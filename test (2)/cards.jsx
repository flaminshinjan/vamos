// Agent cards — rich inline artifacts embedded in chat messages

// ── Market snapshot card
function MarketSnapshot() {
  const m = MARKET;
  return (
    <div className="card fade-up">
      <div className="card-head">
        <div className="card-title">
          <span className="dot neg" /> Market snapshot · {m.sentiment}
        </div>
        <div className="card-sub">NSE · Close</div>
      </div>
      <div className="card-body">
        <p style={{margin:'0 0 16px', fontSize:13.5, color:'var(--ink-2)', lineHeight:1.55}}>{m.summary}</p>
        <div style={{display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:12, paddingBottom:16, borderBottom:'1px dashed var(--line)'}}>
          {m.indices.map(i => (
            <div key={i.name}>
              <div className="mono" style={{fontSize:10, color:'var(--ink-3)', letterSpacing:'0.08em', marginBottom:4}}>{i.name}</div>
              <div className="serif" style={{fontSize:20, letterSpacing:'-0.02em', color: i.change>=0?'var(--pos)':'var(--neg)'}}>
                {i.change>=0?'+':'−'}{Math.abs(i.change).toFixed(2)}<span style={{fontSize:12}}>%</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:24, paddingTop:16}}>
          <div>
            <div className="eyebrow" style={{marginBottom:10}}>Sectors up</div>
            {m.gainers.map(g => (
              <div key={g.name} style={{display:'flex', justifyContent:'space-between', fontSize:12.5, padding:'4px 0'}}>
                <span>{g.name}</span>
                <span className="mono tnum pos-fg">+{g.change.toFixed(2)}%</span>
              </div>
            ))}
          </div>
          <div>
            <div className="eyebrow" style={{marginBottom:10}}>Sectors down</div>
            {m.losers.map(g => (
              <div key={g.name} style={{display:'flex', justifyContent:'space-between', fontSize:12.5, padding:'4px 0'}}>
                <span>{g.name}</span>
                <span className="mono tnum neg-fg">{g.change.toFixed(2)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── News card
function NewsCard() {
  return (
    <div className="card fade-up">
      <div className="card-head">
        <div className="card-title"><span className="dot accent" /> Classified news · {NEWS.length} signals</div>
        <div className="card-sub">sentiment + scope + impact</div>
      </div>
      <div className="card-body" style={{padding:0}}>
        {NEWS.map((n, i) => (
          <div key={n.id} style={{
            padding:'14px 18px',
            borderBottom: i<NEWS.length-1?'1px solid var(--line)':'none',
            borderLeft: `3px solid ${n.sentiment==='positive'?'var(--pos)':n.sentiment==='negative'?'var(--neg)':'var(--ink-4)'}`,
          }}>
            <div style={{fontSize:13, fontWeight:500, lineHeight:1.45, marginBottom:8}}>{n.headline}</div>
            <div style={{display:'flex', flexWrap:'wrap', gap:6, alignItems:'center'}}>
              <span className={`pill ${n.sentiment==='positive'?'pos':n.sentiment==='negative'?'neg':''}`}>{n.sentiment}</span>
              <span className="pill">{n.scope}</span>
              <span style={{fontSize:11, color:'var(--ink-3)', marginLeft:2}}>{n.source} · {n.time}</span>
              <span className="mono" style={{marginLeft:'auto', fontSize:11}}>
                <span style={{color:'var(--ink-4)', marginRight:5}}>IMPACT</span>
                <span style={{color:'var(--accent)'}}>{n.impact.toFixed(2)}</span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Reasoning trace card (live)
function ReasoningCard({ onDone }) {
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
        else { if (onDone) onDone(); }
      }, step.duration);
    };
    tick();
    return () => { cancelled = true; };
  }, []);

  const allDone = completed.length === REASONING_STEPS.length;

  return (
    <div className="card fade-up">
      <div className="card-head">
        <div className="card-title">
          <span className={`dot ${allDone?'pos':'accent'} ${!allDone?'pulse':''}`} />
          {allDone ? 'Reasoning complete' : 'Thinking…'}
        </div>
        <div className="card-sub">
          {allDone ? '4.8s · 3,142 tokens · traced' : `step ${Math.min(activeIdx+1, REASONING_STEPS.length)} of ${REASONING_STEPS.length}`}
        </div>
      </div>
      <div className="card-body">
        {REASONING_STEPS.map((s, i) => {
          const isActive = i === activeIdx && !completed.includes(s.id);
          const isDone = completed.includes(s.id);
          const isPending = i > activeIdx;
          return (
            <div key={s.id} className={`reason-step ${isDone?'done':isActive?'active':'pending'}`}>
              <div className="check">
                {isDone ? (
                  <svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 5 L4 7 L8 3" stroke="var(--pos)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                ) : isActive ? (
                  <div className="pulse" style={{width:6, height:6, borderRadius:'50%', background:'var(--accent)'}} />
                ) : (
                  <span className="mono" style={{fontSize:9, color:'var(--ink-4)'}}>{i+1}</span>
                )}
              </div>
              <div>
                <div className="lbl">{s.label}</div>
                <div className="det">{s.detail}</div>
              </div>
              <div className="t">{isDone?`${(s.duration/1000).toFixed(1)}s`:isActive?'…':'—'}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Causal graph card
function CausalGraphCard({ portfolio }) {
  const news = [
    { id:'rbi', label:'RBI holds rate · hawkish', sent:'neg' },
    { id:'fed', label:'US Fed higher-for-longer', sent:'pos' },
    { id:'fmcg', label:'Resilient rural demand', sent:'pos' },
  ];
  const sectors = [
    { id:'Banking', label:'Banking', sent:'neg' },
    { id:'IT', label:'IT', sent:'pos' },
    { id:'FMCG', label:'FMCG', sent:'pos' },
  ];
  const stocks = portfolio.holdings.slice(0, 5).map(h => ({ id:h.symbol, sector:h.sector, day:h.day }));
  const nsLinks = [['rbi','Banking'],['fed','IT'],['fmcg','FMCG']];
  const ssLinks = stocks.map(s => [s.sector, s.id]).filter(([sec]) => sectors.find(x => x.id === sec));

  const W=660, H=360;
  const cols = [20, 200, 400, 620];
  const yFor = (arr, i) => {
    const gap = (H-60)/Math.max(1, arr.length);
    return 30 + gap*(i+0.5);
  };
  const newsY = Object.fromEntries(news.map((n,i)=>[n.id, yFor(news,i)]));
  const secY = Object.fromEntries(sectors.map((s,i)=>[s.id, yFor(sectors,i)]));
  const stockY = Object.fromEntries(stocks.map((s,i)=>[s.id, yFor(stocks,i)]));
  const portY = H/2;
  const stroke = sent => sent==='pos'?'#2F6B3F':sent==='neg'?'#9A3B2C':'#6E6A62';
  const curve = (x1,y1,x2,y2) => {
    const mx = (x1+x2)/2;
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`;
  };

  return (
    <div className="card fade-up">
      <div className="card-head">
        <div className="card-title"><span className="dot accent" /> Causal chain · News → Sector → Stock → You</div>
        <div className="card-sub">threshold 0.50</div>
      </div>
      <div className="card-body">
        <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%', height:'auto'}}>
          {['News','Sector','Stock','Portfolio'].map((l,i)=>(
            <text key={l} x={cols[i]} y={14} textAnchor={i===3?'end':'start'}
              fontSize="9" fontFamily="JetBrains Mono" fill="var(--ink-4)" letterSpacing="1.5">
              {String(i+1).padStart(2,'0')} · {l.toUpperCase()}
            </text>
          ))}
          {nsLinks.map(([a,b],i)=>(
            <path key={`ns${i}`} d={curve(cols[0]+150, newsY[a], cols[1]-4, secY[b])}
              stroke={stroke(news.find(n=>n.id===a).sent)} strokeOpacity="0.38" strokeWidth="1.4" fill="none"
              strokeDasharray="400" strokeDashoffset="400"
              style={{animation:`draw 0.9s ease forwards ${0.1+i*0.1}s`}}/>
          ))}
          {ssLinks.map(([sec,stk],i)=>(
            <path key={`ss${i}`} d={curve(cols[1]+130, secY[sec], cols[2]-4, stockY[stk])}
              stroke={stroke(sectors.find(s=>s.id===sec).sent)} strokeOpacity="0.3" strokeWidth="1.2" fill="none"
              strokeDasharray="400" strokeDashoffset="400"
              style={{animation:`draw 0.9s ease forwards ${0.4+i*0.08}s`}}/>
          ))}
          {stocks.map((s,i)=>(
            <path key={`sp${i}`} d={curve(cols[2]+84, stockY[s.id], cols[3]-18, portY)}
              stroke={s.day>=0?'#2F6B3F':'#9A3B2C'} strokeOpacity="0.3" strokeWidth="1" fill="none"
              strokeDasharray="400" strokeDashoffset="400"
              style={{animation:`draw 0.9s ease forwards ${0.7+i*0.06}s`}}/>
          ))}
          {news.map((n,i)=>(
            <g key={n.id} style={{animation:`fadeIn 0.4s ease both ${0.1+i*0.08}s`}}>
              <rect x={cols[0]} y={newsY[n.id]-14} width="150" height="28" rx="4"
                fill="var(--bg-elev)" stroke={stroke(n.sent)} strokeOpacity="0.32"/>
              <circle cx={cols[0]+10} cy={newsY[n.id]} r="2.5" fill={stroke(n.sent)}/>
              <text x={cols[0]+19} y={newsY[n.id]+3} fontSize="10" fill="var(--ink-2)">
                {n.label.length>22?n.label.slice(0,22)+'…':n.label}
              </text>
            </g>
          ))}
          {sectors.map((s,i)=>(
            <g key={s.id} style={{animation:`fadeIn 0.4s ease both ${0.35+i*0.08}s`}}>
              <rect x={cols[1]-4} y={secY[s.id]-14} width="134" height="28" rx="4"
                fill={s.sent==='pos'?'var(--pos-soft)':'var(--neg-soft)'} stroke={stroke(s.sent)} strokeOpacity="0.5"/>
              <text x={cols[1]+63} y={secY[s.id]+4} fontSize="11.5" fill={stroke(s.sent)} textAnchor="middle" fontWeight="600">{s.label}</text>
            </g>
          ))}
          {stocks.map((s,i)=>(
            <g key={s.id} style={{animation:`fadeIn 0.4s ease both ${0.65+i*0.07}s`}}>
              <rect x={cols[2]-4} y={stockY[s.id]-14} width="88" height="28" rx="4"
                fill="var(--bg-elev)" stroke="var(--line-strong)"/>
              <text x={cols[2]+5} y={stockY[s.id]+4} fontSize="10.5" fontFamily="JetBrains Mono" fill="var(--ink)">{s.id}</text>
              <text x={cols[2]+78} y={stockY[s.id]+4} fontSize="9.5" fontFamily="JetBrains Mono" textAnchor="end"
                fill={s.day>=0?'var(--pos)':'var(--neg)'}>
                {s.day>=0?'+':'−'}{Math.abs(s.day).toFixed(1)}%
              </text>
            </g>
          ))}
          <g style={{animation:'fadeIn 0.5s ease both 1.1s'}}>
            <circle cx={cols[3]} cy={portY} r="36" fill="var(--ink)"/>
            <text x={cols[3]} y={portY-3} textAnchor="end" fontSize="9" fontFamily="JetBrains Mono" fill="rgba(255,253,248,0.5)">PORTFOLIO</text>
            <text x={cols[3]} y={portY+13} textAnchor="end" fontSize="15" fontFamily="Instrument Serif"
              fill={portfolio.dayPLPct>=0?'#8FCB9F':'#EAAC9B'}>
              {portfolio.dayPLPct>=0?'+':'−'}{Math.abs(portfolio.dayPLPct).toFixed(2)}%
            </text>
          </g>
        </svg>
      </div>
    </div>
  );
}

// ── Briefing final card (with self-eval)
function BriefingCard({ portfolio, verbosity }) {
  const fullText = buildBriefing(portfolio, verbosity);
  const [typed, setTyped] = React.useState('');
  React.useEffect(() => {
    setTyped('');
    let i = 0; const step = 5;
    const iv = setInterval(() => {
      i = Math.min(i+step, fullText.length);
      setTyped(fullText.slice(0, i));
      if (i >= fullText.length) clearInterval(iv);
    }, 16);
    return () => clearInterval(iv);
  }, [fullText]);

  const scores = [
    { k:'Causal depth', v:0.88 },
    { k:'Coverage', v:0.81 },
    { k:'Signal-to-noise', v:0.76 },
    { k:'Conflict handling', v:0.84 },
  ];
  const typing = typed.length < fullText.length;

  return (
    <div className="card fade-up" style={{borderColor:'var(--ink-2)'}}>
      <div className="card-head" style={{background:'var(--ink)', color:'var(--bg)', borderColor:'var(--ink-2)'}}>
        <div className="card-title">
          <span className="dot" style={{background:'#FBC97A'}} />
          Agent briefing · {portfolio.name}
        </div>
        <div className="card-sub" style={{color:'rgba(255,253,248,0.5)'}}>confidence 82%</div>
      </div>
      <div className="card-body">
        <div className="serif" style={{fontSize:18, lineHeight:1.5, letterSpacing:'-0.005em', whiteSpace:'pre-wrap', color:'var(--ink)', marginBottom:18}}>
          {typed}{typing && <span style={{display:'inline-block', width:8, height:'1em', background:'var(--ink)', marginLeft:2, verticalAlign:'text-bottom', animation:'pulseDot 0.9s ease-in-out infinite'}}/>}
        </div>
        <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, paddingTop:16, borderTop:'1px dashed var(--line)'}}>
          {scores.map(s => (
            <div key={s.k}>
              <div style={{display:'flex', justifyContent:'space-between', fontSize:11.5, marginBottom:5}}>
                <span style={{color:'var(--ink-3)'}}>{s.k}</span>
                <span className="mono tnum" style={{color:'var(--accent)'}}>{s.v.toFixed(2)}</span>
              </div>
              <div style={{height:3, background:'var(--bg-sunk)', borderRadius:2, overflow:'hidden'}}>
                <div style={{width:`${s.v*100}%`, height:'100%', background:'var(--accent)'}} />
              </div>
            </div>
          ))}
        </div>
        <div style={{marginTop:16, paddingTop:14, borderTop:'1px dashed var(--line)', display:'flex', justifyContent:'space-between', fontSize:11.5, color:'var(--ink-3)'}}>
          <span><span className="mono" style={{color:'var(--ink)'}}>3,142</span> tokens · <span className="mono" style={{color:'var(--ink)'}}>7</span> spans · <span className="mono" style={{color:'var(--ink)'}}>4.8s</span></span>
          <button className="tool-btn" style={{padding:0, color:'var(--accent)'}}>View Langfuse trace →</button>
        </div>
      </div>
    </div>
  );
}

function buildBriefing(p, verbosity) {
  const concise = verbosity === 'concise';
  const topSector = p.sectors[0];
  const bearish = "Markets closed bearish as the RBI held rates with a hawkish tilt, weighing on financials.";
  const impact = `Your portfolio ${p.dayPLPct>=0?'gained':'fell'} ${Math.abs(p.dayPLPct).toFixed(2)}% today`;
  if (p.id === 'aggressive') {
    const body = `${impact} — the loss is almost entirely explained by Banking exposure. With ${topSector.weight.toFixed(1)}% in Banking & Finance (well above the 40% concentration threshold), HDFCBANK, ICICIBANK, and SBIN each fell 2–3% in reaction to the RBI decision.`;
    const tail = concise?'':`\n\nThe positive IT and FMCG tailwinds could not offset this — you hold less than 15% combined in those sectors. Consider trimming 8–10% from Banking into defensives.`;
    return `${bearish}\n\n${body}${tail}\n\nConfidence is high: the path News → Banking → your top 3 holdings is direct with no conflicting signals.`;
  }
  if (p.id === 'conservative') {
    const body = `${impact} — a nearly flat day, as expected for a debt-heavy book. The Gilt and Corp Bond funds (34.2% combined) absorbed the equity drag, and your FMCG tilt (ITC, HINDUNILVR, NESTLEIND) actually added ₹1,800 on resilient rural demand.`;
    const tail = concise?'':`\n\nNo concentration risk detected. The only latent exposure is duration risk on the Gilt fund if RBI hawkishness extends — worth monitoring, no action indicated today.`;
    return `${bearish}\n\n${body}${tail}\n\nConfidence is moderate: bond-market effects are modeled indirectly via index proxies.`;
  }
  const body = `${impact} driven mainly by HDFCBANK (−2.1%, 7.8% weight) as RBI news hit financials. IT rallied on rupee weakness after the Fed minutes — INFY and TCS contributed +0.16% — and ITC added +0.02%, partially offsetting the banking drag.`;
  const tail = concise?'':`\n\nYour sector mix is balanced — no single bucket exceeds 25%. The net −0.43% closely tracks the NIFTY 50, which is the expected behavior for a diversified book on days with this news mix.`;
  return `${bearish}\n\n${body}${tail}\n\nConfidence is high: three independent causal paths converge on the same net impact.`;
}

Object.assign(window, { MarketSnapshot, NewsCard, ReasoningCard, CausalGraphCard, BriefingCard, buildBriefing });
