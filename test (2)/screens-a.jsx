// Screen 1: Portfolio picker
// Screen 2: Market intelligence

function PortfolioPicker({ onPick, selectedId }) {
  return (
    <div style={{maxWidth: 1180, margin: '0 auto', padding: '60px 32px 80px'}}>
      <div className="fade-up" style={{marginBottom: 40}}>
        <div className="eyebrow" style={{marginBottom: 14}}>Step 01 · Select a portfolio</div>
        <h1 className="serif" style={{fontSize: 56, lineHeight: 1.05, letterSpacing:'-0.02em', margin: 0, maxWidth: 820}}>
          An advisor that explains <em style={{color:'var(--accent)'}}>why</em> your portfolio moved,
          not just <span style={{color:'var(--ink-3)'}}>how much</span>.
        </h1>
        <p style={{fontSize:16, color:'var(--ink-2)', maxWidth: 640, marginTop: 20, lineHeight:1.55}}>
          Aarthik ingests market data and news, then reasons through the causal chain —
          <span className="mono" style={{fontSize:13, color:'var(--accent)', margin:'0 6px'}}>News → Sector → Stock → You</span>
          — to produce a concise, auditable briefing.
        </p>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:18, marginTop: 48}}>
        {PORTFOLIOS.map((p, i) => (
          <button
            key={p.id}
            onClick={() => onPick(p.id)}
            className="card fade-up"
            style={{
              padding: 26, textAlign:'left', cursor:'pointer',
              background: selectedId === p.id ? 'var(--ink)' : 'var(--bg-elev)',
              color: selectedId === p.id ? 'var(--bg)' : 'var(--ink)',
              borderColor: selectedId === p.id ? 'var(--ink)' : 'var(--line)',
              animationDelay: `${0.1 + i * 0.08}s`,
              transition: 'transform 0.15s ease, box-shadow 0.15s ease',
              font: 'inherit',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
          >
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom: 20}}>
              <div>
                <div style={{fontSize:12, opacity:0.6, marginBottom:4}}>Sample {i+1}</div>
                <div style={{fontSize:16, fontWeight:600}}>{p.name}</div>
              </div>
              <div className="pill" style={{
                background: selectedId === p.id ? 'rgba(255,255,255,0.1)' : undefined,
                color: selectedId === p.id ? 'var(--bg)' : undefined,
                borderColor: 'transparent'
              }}>{p.type}</div>
            </div>

            <div style={{display:'flex', alignItems:'baseline', gap:10, marginBottom: 8}}>
              <div className="serif" style={{fontSize:34, letterSpacing:'-0.02em'}}>{formatINR(p.value)}</div>
            </div>
            <div className="mono" style={{fontSize:12, opacity: 0.75, marginBottom: 18}}>
              <span style={{color: p.dayPLPct >=0 ? 'var(--pos)' : 'var(--neg)'}}>
                {p.dayPLPct >= 0 ? '▲' : '▼'} {Math.abs(p.dayPLPct).toFixed(2)}% today
              </span>
              <span style={{margin:'0 10px', opacity:0.4}}>·</span>
              <span style={{color: p.overallGainPct >=0 ? 'var(--pos)' : 'var(--neg)'}}>
                {p.overallGainPct >=0 ? '+' : '−'}{Math.abs(p.overallGainPct).toFixed(2)}% overall
              </span>
            </div>

            {/* Sector mini-bar */}
            <div style={{display:'flex', height:6, borderRadius:3, overflow:'hidden', marginBottom:14, background: selectedId===p.id?'rgba(255,255,255,0.1)':'var(--bg-sunk)'}}>
              {p.sectors.map((s, j) => (
                <div key={j} style={{
                  flex: s.weight,
                  background: selectedId === p.id
                    ? `rgba(255,255,255,${0.85 - j*0.12})`
                    : ['#2E2D7A','#4B48C2','#8684D4','#B8B6E4','#D5CEBF','#E7E1D6'][j] || 'var(--line)'
                }} />
              ))}
            </div>

            <p style={{fontSize:12.5, lineHeight:1.5, opacity:0.75, margin:0, minHeight:36}}>
              {p.tagline}
            </p>

            <div style={{marginTop: 22, paddingTop: 16, borderTop: `1px solid ${selectedId===p.id?'rgba(255,255,255,0.12)':'var(--line)'}`, display:'flex', justifyContent:'space-between', fontSize:11, opacity:0.7}}>
              <span>{p.holdings.length} stocks · {p.funds.length} funds</span>
              <span>Analyze →</span>
            </div>
          </button>
        ))}
      </div>

      <div style={{marginTop: 60, display:'flex', gap: 36, alignItems:'flex-start', opacity: 0.85}}>
        {[
          { n: '01', t: 'Market Intelligence', d: 'Index trends, sector extraction, news classification by sentiment + scope.' },
          { n: '02', t: 'Portfolio Analytics', d: 'P&L, allocation, concentration risk across stocks and mutual funds.' },
          { n: '03', t: 'Causal Reasoning', d: 'Links news to sectors to stocks to your holdings — only high-impact paths.' },
          { n: '04', t: 'Self-Evaluation', d: 'LLM-graded reasoning quality with confidence score and Langfuse trace.' },
        ].map(b => (
          <div key={b.n} style={{flex:1, borderTop:'1px solid var(--line-strong)', paddingTop:14}}>
            <div className="mono eyebrow" style={{marginBottom:8}}>{b.n}</div>
            <div style={{fontWeight:600, fontSize:14, marginBottom:6}}>{b.t}</div>
            <div style={{fontSize:12.5, color:'var(--ink-3)', lineHeight:1.55}}>{b.d}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MarketIntel({ onContinue, onBack, scenario }) {
  const m = MARKET;
  return (
    <div style={{maxWidth:1180, margin:'0 auto', padding:'48px 32px 80px'}}>
      <div className="fade-up" style={{marginBottom: 32, display:'flex', justifyContent:'space-between', alignItems:'flex-end'}}>
        <div>
          <div className="eyebrow" style={{marginBottom:10}}>Step 02 · Market intelligence layer</div>
          <h2 className="serif" style={{fontSize:44, letterSpacing:'-0.02em', margin:0}}>
            Today the market is <em style={{color: scenario==='bullish'?'var(--pos)':scenario==='bearish'?'var(--neg)':'var(--ink-3)'}}>
              {(scenario || m.sentiment.toLowerCase())}
            </em>.
          </h2>
          <p style={{color:'var(--ink-3)', maxWidth:620, marginTop:10, fontSize:14}}>
            {m.summary} Sentiment is derived from index movements and classified headlines before any portfolio logic runs.
          </p>
        </div>
        <div style={{display:'flex', gap:8}}>
          <button className="btn btn-ghost" onClick={onBack}>← Back</button>
          <button className="btn btn-accent" onClick={onContinue}>Run agent →</button>
        </div>
      </div>

      <div style={{display:'grid', gridTemplateColumns:'1.1fr 1fr', gap: 18}}>
        {/* Indices & sectors */}
        <div className="card fade-up" style={{padding: 24}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:20}}>
            <div>
              <div className="eyebrow">Indices</div>
              <div className="serif" style={{fontSize:22, marginTop:4}}>Index movement</div>
            </div>
            <div className="pill neg"><span className="dot neg" /> Bearish</div>
          </div>
          <div style={{display:'grid', gridTemplateColumns:'repeat(5, 1fr)', gap:14, marginBottom:28}}>
            {m.indices.map(i => (
              <div key={i.name}>
                <div className="mono eyebrow" style={{marginBottom:6}}>{i.name}</div>
                <div className="serif" style={{fontSize:26, letterSpacing:'-0.02em', color: i.change>=0?'var(--pos)':'var(--neg)'}}>
                  {i.change>=0?'+':'−'}{Math.abs(i.change).toFixed(2)}<span style={{fontSize:14}}>%</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap: 28}}>
            <div>
              <div className="eyebrow" style={{marginBottom:10}}>Top gaining sectors</div>
              {m.gainers.map(g => (
                <div key={g.name} style={{display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px dashed var(--line)'}}>
                  <span style={{fontSize:13}}>{g.name}</span>
                  <span className="mono tnum" style={{color:'var(--pos)', fontSize:12}}>+{g.change.toFixed(2)}%</span>
                </div>
              ))}
            </div>
            <div>
              <div className="eyebrow" style={{marginBottom:10}}>Top losing sectors</div>
              {m.losers.map(g => (
                <div key={g.name} style={{display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px dashed var(--line)'}}>
                  <span style={{fontSize:13}}>{g.name}</span>
                  <span className="mono tnum" style={{color:'var(--neg)', fontSize:12}}>{g.change.toFixed(2)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* News feed */}
        <div className="card fade-up" style={{padding:24, animationDelay:'0.05s'}}>
          <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:20}}>
            <div>
              <div className="eyebrow">News feed</div>
              <div className="serif" style={{fontSize:22, marginTop:4}}>Classified headlines</div>
            </div>
            <span className="mono" style={{fontSize:11, color:'var(--ink-3)'}}>{NEWS.length} signals</span>
          </div>
          <div style={{display:'flex', flexDirection:'column', gap: 14}}>
            {NEWS.map((n, i) => (
              <div key={n.id} className="fade-up" style={{
                padding:'14px 14px', borderRadius:8, background:'var(--bg-sunk)',
                animationDelay: `${0.1 + i*0.06}s`, borderLeft: `3px solid ${n.sentiment==='positive'?'var(--pos)':n.sentiment==='negative'?'var(--neg)':'var(--ink-4)'}`,
              }}>
                <div style={{fontSize:13.5, fontWeight:500, lineHeight:1.4, marginBottom:8}}>{n.headline}</div>
                <div style={{display:'flex', flexWrap:'wrap', gap:6, alignItems:'center'}}>
                  <span className={`pill ${n.sentiment==='positive'?'pos':n.sentiment==='negative'?'neg':''}`}>{n.sentiment}</span>
                  <span className="pill">{n.scope}</span>
                  <span style={{fontSize:11, color:'var(--ink-3)', marginLeft:4}}>{n.source} · {n.time}</span>
                  <span style={{marginLeft:'auto'}} className="mono" title="Impact score">
                    <span style={{fontSize:10, color:'var(--ink-4)', marginRight:4}}>IMPACT</span>
                    <span style={{fontSize:12, color:'var(--accent)'}}>{n.impact.toFixed(2)}</span>
                  </span>
                </div>
                <div style={{marginTop:8, display:'flex', flexWrap:'wrap', gap:4}}>
                  {n.entities.slice(0, 5).map(e => (
                    <span key={e} className="mono" style={{fontSize:10.5, color:'var(--ink-3)', padding:'2px 6px', background:'var(--bg-elev)', borderRadius:3, border:'1px solid var(--line)'}}>#{e}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { PortfolioPicker, MarketIntel });
