// Product tour — tabs with live mock screens recreating the app in miniature

function MiniChat() {
  return (
    <div style={{display:'flex', height:'100%', background:'var(--paper)', fontSize:11}}>
      <div style={{width:150, background:'var(--paper-2)', borderRight:'1px solid var(--line)', padding:12, display:'flex', flexDirection:'column', gap:10}}>
        <div style={{display:'flex', alignItems:'center', gap:6, fontFamily:'Fraunces', fontSize:14, fontWeight:500}}>
          <div style={{width:18, height:18, background:'var(--ink)', color:'var(--paper)', borderRadius:3, display:'grid', placeItems:'center', fontSize:10}}>A</div>
          Aarthik
        </div>
        <div style={{display:'flex', flexDirection:'column', gap:2, marginTop:8}}>
          <div style={{fontFamily:'JetBrains Mono', fontSize:9, textTransform:'uppercase', color:'var(--ink-4)', letterSpacing:1, padding:'4px 0'}}>Portfolios</div>
          <div style={{padding:'5px 8px', borderRadius:4, background:'var(--ink)', color:'var(--paper)', fontSize:10}}>Diversified</div>
          <div style={{padding:'5px 8px', fontSize:10, color:'var(--ink-2)'}}>Growth tech</div>
          <div style={{padding:'5px 8px', fontSize:10, color:'var(--ink-2)'}}>Income</div>
        </div>
      </div>
      <div style={{flex:1, display:'flex', flexDirection:'column'}}>
        <div style={{padding:10, borderBottom:'1px solid var(--line)', fontSize:10, color:'var(--ink-3)', fontFamily:'JetBrains Mono'}}>
          Briefing session · Diversified
        </div>
        <div style={{flex:1, padding:14, display:'flex', flexDirection:'column', gap:8, overflow:'hidden'}}>
          <div style={{alignSelf:'flex-end', background:'var(--ink)', color:'var(--paper)', padding:'6px 10px', borderRadius:6, fontSize:11, maxWidth:'75%'}}>Why is TSM up today?</div>
          <div style={{display:'flex', gap:6}}>
            <div style={{width:18, height:18, borderRadius:9, background:'var(--ink)', color:'var(--paper)', display:'grid', placeItems:'center', fontSize:9, fontFamily:'Fraunces'}}>A</div>
            <div style={{background:'var(--paper-2)', border:'1px solid var(--line)', padding:'6px 10px', borderRadius:6, fontSize:11, maxWidth:'80%'}}>
              TSM guided Q4 revenue +6% on AI demand. Reads through positively to your NVDA (+1.2%).
            </div>
          </div>
        </div>
        <div style={{margin:14, border:'1px solid var(--line)', borderRadius:6, padding:'8px 10px', background:'var(--paper-2)', fontSize:10, color:'var(--ink-3)'}}>
          Ask Aarthik anything…
        </div>
      </div>
    </div>
  );
}

function MiniPortfolio() {
  const rows = [
    { sym:'NVDA', name:'Nvidia',         pct:'+1.22', w:'12.4%', th:'Intact' },
    { sym:'TSM',  name:'Taiwan Semi',    pct:'+2.14', w:'8.1%',  th:'Intact' },
    { sym:'ASML', name:'ASML Holding',   pct:'-1.40', w:'6.0%',  th:'Weakened' },
    { sym:'NEM',  name:'Newmont',        pct:'+2.10', w:'4.2%',  th:'Intact' },
    { sym:'LVMH', name:'LVMH',           pct:'-1.20', w:'3.8%',  th:'Weakened' },
    { sym:'FCX',  name:'Freeport',       pct:'+1.80', w:'3.1%',  th:'Intact' },
  ];
  return (
    <div style={{padding:20, fontSize:11, background:'var(--paper)'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end', paddingBottom:14, borderBottom:'1px solid var(--line)'}}>
        <div>
          <div style={{fontFamily:'JetBrains Mono', fontSize:9, textTransform:'uppercase', color:'var(--ink-3)', letterSpacing:1.5}}>Portfolio · Diversified</div>
          <div style={{fontFamily:'Fraunces', fontSize:22, marginTop:4}}>$512,480 <span style={{fontSize:13, color:'var(--up)'}}>+0.34%</span></div>
        </div>
        <div style={{fontFamily:'JetBrains Mono', fontSize:9, color:'var(--ink-3)'}}>14 holdings · 2 thesis alerts</div>
      </div>
      <table style={{width:'100%', marginTop:12, borderCollapse:'collapse'}}>
        <thead>
          <tr style={{fontSize:9, fontFamily:'JetBrains Mono', textTransform:'uppercase', color:'var(--ink-4)', letterSpacing:1.2, textAlign:'left'}}>
            <th style={{padding:'6px 0'}}>Sym</th>
            <th>Name</th>
            <th style={{textAlign:'right'}}>Δ</th>
            <th style={{textAlign:'right'}}>Wt</th>
            <th style={{textAlign:'right'}}>Thesis</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.sym} style={{borderTop:'1px solid var(--line)', fontSize:11}}>
              <td style={{padding:'7px 0', fontWeight:600}}>{r.sym}</td>
              <td style={{color:'var(--ink-2)'}}>{r.name}</td>
              <td style={{textAlign:'right', fontFamily:'JetBrains Mono', color: r.pct[0] === '+' ? 'var(--up)' : 'var(--down)'}}>{r.pct}%</td>
              <td style={{textAlign:'right', fontFamily:'JetBrains Mono', color:'var(--ink-3)'}}>{r.w}</td>
              <td style={{textAlign:'right', fontFamily:'JetBrains Mono', fontSize:10, color: r.th === 'Intact' ? 'var(--up)' : 'var(--amber-2)'}}>{r.th}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MiniNews() {
  const items = [
    { src:'Bloomberg', time:'09:14', text:'TSM raises Q4 revenue guide on sustained AI capex', impact:'+1.8σ', imp:'up', tickers:'TSM · NVDA' },
    { src:'Reuters',   time:'08:42', text:'ECB holds rates, Lagarde signals October cut possible', impact:'+0.4σ', imp:'up', tickers:'SAP · ASML' },
    { src:'FT',        time:'08:15', text:'Copper climbs on tightening inventories at LME', impact:'+1.1σ', imp:'up', tickers:'FCX' },
    { src:'SEC',       time:'07:58', text:'NVDA 10-Q filed; data-center segment +65% YoY', impact:'+0.6σ', imp:'up', tickers:'NVDA' },
    { src:'WSJ',       time:'07:30', text:'LVMH Americas demand weaker; boutique traffic -9%', impact:'-0.9σ', imp:'down', tickers:'LVMH · KER' },
  ];
  return (
    <div style={{padding:20, fontSize:11, background:'var(--paper)'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', paddingBottom:12, borderBottom:'1px solid var(--line)'}}>
        <div style={{fontFamily:'JetBrains Mono', fontSize:9, textTransform:'uppercase', color:'var(--ink-3)', letterSpacing:1.5}}>Signal · 5 relevant · 14 filtered</div>
        <div style={{fontSize:9, fontFamily:'JetBrains Mono', color:'var(--ink-3)'}}>Sorted by impact</div>
      </div>
      <div style={{marginTop:8}}>
        {items.map((it, i) => (
          <div key={i} style={{padding:'10px 0', borderTop: i === 0 ? 'none' : '1px solid var(--line)', display:'grid', gridTemplateColumns:'52px 1fr auto', gap:10, alignItems:'start'}}>
            <div style={{fontFamily:'JetBrains Mono', fontSize:9, color:'var(--ink-3)'}}>
              <div>{it.time}</div>
              <div style={{color:'var(--amber-2)', marginTop:2}}>{it.src}</div>
            </div>
            <div>
              <div style={{fontSize:12, lineHeight:1.35, color:'var(--ink)', marginBottom:4}}>{it.text}</div>
              <div style={{fontFamily:'JetBrains Mono', fontSize:9, color:'var(--ink-3)'}}>{it.tickers}</div>
            </div>
            <div style={{fontFamily:'Fraunces', fontSize:14, color: it.imp === 'up' ? 'var(--up)' : 'var(--down)'}}>{it.impact}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniReasoning() {
  return (
    <div style={{padding:20, fontSize:11, background:'var(--ink)', color:'var(--paper)', height:'100%'}}>
      <div style={{fontFamily:'JetBrains Mono', fontSize:9, textTransform:'uppercase', color:'var(--ink-4)', letterSpacing:1.5}}>Reasoning trace · TSM +2.1%</div>
      <div style={{fontFamily:'Fraunces', fontSize:20, marginTop:6, marginBottom:14}}>Why we think TSM moved</div>
      <div style={{display:'flex', flexDirection:'column', gap:10, fontFamily:'JetBrains Mono', fontSize:11, lineHeight:1.6}}>
        <div style={{padding:10, background:'rgba(242,238,228,0.04)', borderLeft:'2px solid var(--amber)', borderRadius:'0 4px 4px 0'}}>
          <div style={{color:'var(--amber)'}}>[OBS]</div>
          <div>Guide raise +6% Q4 · source: earnings call · t=08:14 · confidence 0.98</div>
        </div>
        <div style={{padding:10, background:'rgba(242,238,228,0.04)', borderLeft:'2px solid #C8D635', borderRadius:'0 4px 4px 0'}}>
          <div style={{color:'#C8D635'}}>[TRACE]</div>
          <div>Guide ↑ → AI capex intact → demand read-through to NVDA, ASML · w=0.72</div>
        </div>
        <div style={{padding:10, background:'rgba(242,238,228,0.04)', borderLeft:'2px solid var(--paper)', borderRadius:'0 4px 4px 0'}}>
          <div style={{color:'var(--paper)'}}>[IMPACT]</div>
          <div>Your book: TSM +2.1% · NVDA +1.2% · net +$3,840</div>
        </div>
        <div style={{padding:10, background:'rgba(232,161,58,0.1)', borderLeft:'2px solid var(--amber)', borderRadius:'0 4px 4px 0'}}>
          <div style={{color:'var(--amber)'}}>[DISPUTE]</div>
          <div style={{color:'#B8B1A2'}}>Flag an error or supply a counter-signal →</div>
        </div>
      </div>
    </div>
  );
}

function MiniBrief() {
  return (
    <div style={{padding:20, fontSize:11, background:'var(--paper)'}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'flex-end'}}>
        <div>
          <div style={{fontFamily:'JetBrains Mono', fontSize:9, textTransform:'uppercase', color:'var(--ink-3)', letterSpacing:1.5}}>Morning brief · Mon 14 Oct</div>
          <div style={{fontFamily:'Fraunces', fontSize:26, marginTop:4, lineHeight:1.05}}>Your book, pre-bell.</div>
        </div>
        <div style={{display:'flex', gap:6, alignItems:'center', fontFamily:'JetBrains Mono', fontSize:10, color:'var(--ink-2)', border:'1px solid var(--line)', padding:'5px 10px', borderRadius:99}}>
          <span style={{width:8, height:8, borderRadius:4, background:'var(--amber)'}}></span>
          1:28 · audio
        </div>
      </div>

      <div style={{marginTop:16, padding:'14px 0', borderTop:'1px solid var(--line)', display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12}}>
        {[
          ['Pre-mkt', '+0.34%', 'up'],
          ['Top mover', 'TSM +2.1%', 'up'],
          ['Watch', 'ASML open', ''],
          ['Thesis', '2 intact · 1 weak', 'amb'],
        ].map(([k,v,c]) => (
          <div key={k}>
            <div style={{fontFamily:'JetBrains Mono', fontSize:9, textTransform:'uppercase', color:'var(--ink-4)', letterSpacing:1.2}}>{k}</div>
            <div style={{fontFamily:'Fraunces', fontSize:15, marginTop:2, color: c==='up' ? 'var(--up)' : c==='amb' ? 'var(--amber-2)' : 'var(--ink)'}}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{marginTop:14, fontSize:11.5, lineHeight:1.55, color:'var(--ink-2)'}}>
        <p>Your diversified book is up <b style={{color:'var(--up)'}}>+0.34%</b> pre-market, led by TSM (+2.14%) after a revenue guide raise of +6% for Q4. The read-through to NVDA is positive and already showing (+1.2%).</p>
        <p style={{marginTop:10}}>The softer signal is in EU luxury — LVMH -1.2% on weak Americas boutique traffic data from WSJ. Your thesis on LVMH weakens a notch; consider reviewing the position before the open.</p>
      </div>
      <div style={{marginTop:12, display:'flex', gap:6, fontSize:10, fontFamily:'JetBrains Mono', color:'var(--ink-3)'}}>
        <span style={{padding:'4px 8px', border:'1px solid var(--line)', borderRadius:99}}>▶ Play audio</span>
        <span style={{padding:'4px 8px', border:'1px solid var(--line)', borderRadius:99}}>Read full</span>
        <span style={{padding:'4px 8px', border:'1px solid var(--line)', borderRadius:99}}>Dispute</span>
      </div>
    </div>
  );
}

const MINI_MAP = {
  chat: <MiniChat/>,
  portfolio: <MiniPortfolio/>,
  news: <MiniNews/>,
  reasoning: <MiniReasoning/>,
  brief: <MiniBrief/>,
};

function Tour() {
  const [active, setActive] = React.useState('chat');
  const cur = TOUR_SCREENS.find(s => s.id === active);
  return (
    <section className="section" id="tour">
      <div className="wrap">
        <div className="eyebrow">Product tour</div>
        <h2 className="h-section" style={{marginTop:12, maxWidth:'22ch'}}>
          Five surfaces, one continuous loop.
        </h2>
        <p className="lede" style={{marginTop:20, maxWidth:'60ch'}}>
          The whole product is designed around a single idea: bring the analysis to you.
          Here's how that plays out across the app.
        </p>

        <div className="tour-nav">
          {TOUR_SCREENS.map(s => (
            <button key={s.id} className={active === s.id ? 'active' : ''} onClick={() => setActive(s.id)}>
              <span className="n">{s.n}</span>
              <span>{s.label}</span>
            </button>
          ))}
        </div>

        <div className="tour-view">
          <div className="tour-screen" key={active+'s'}>{MINI_MAP[active]}</div>
          <div className="tour-copy" key={active+'c'}>
            <div className="eyebrow">{cur.eyebrow}</div>
            <h3>{cur.title}</h3>
            <p>{cur.body}</p>
            <ul>
              {cur.bullets.map((b, i) => <li key={i}><span className="check">✓</span><span>{b}</span></li>)}
            </ul>
            <div style={{marginTop:28}}>
              <a href="Autonomous Financial Advisor.html" className="btn">Open {cur.label} in the app →</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { Tour });
