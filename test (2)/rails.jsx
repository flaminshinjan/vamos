// Left rail — portfolios, threads, settings

function LeftRail({ activePortfolio, onSwitch, onNewChat, threads, activeThread, onPickThread, theme, onToggleTheme }) {
  return (
    <aside className="rail">
      <div className="rail-header">
        <div className="mark">A</div>
        <div className="brand-text">
          Aarthik
          <small>autonomous advisor</small>
        </div>
      </div>

      <button className="new-chat" onClick={onNewChat}>
        <span style={{display:'flex', alignItems:'center', gap:8}}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
          New briefing
        </span>
        <kbd>⌘K</kbd>
      </button>

      <div className="rail-section" style={{flexShrink:0, borderBottom:'1px solid var(--line)', paddingBottom: 12}}>
        <div className="rail-label">Portfolios</div>
        {PORTFOLIOS.map(p => {
          const neg = p.dayPLPct < 0;
          const active = activePortfolio === p.id;
          return (
            <button key={p.id} className={`rail-item ${active?'active':''}`} onClick={() => onSwitch(p.id)}>
              <span className={`ri-dot ${neg?'neg':'pos'}`} style={{background: neg?'var(--neg)':'var(--pos)'}}/>
              <span className="ri-main">
                <div className="ri-name">{p.name}</div>
                <div className="ri-sub">{p.type.toLowerCase()}</div>
              </span>
              <span className="ri-meta">{neg?'−':'+'}{Math.abs(p.dayPLPct).toFixed(1)}%</span>
            </button>
          );
        })}
      </div>

      <div className="rail-section" style={{flex:1, overflowY:'auto'}}>
        <div className="rail-label">
          Threads
          <span className="mono" style={{fontSize:10, color:'var(--ink-4)'}}>{threads.length}</span>
        </div>
        {threads.map(t => (
          <button key={t.id} className={`rail-item ${activeThread===t.id?'active':''}`} onClick={() => onPickThread(t.id)}>
            <span className="ri-main">
              <div className="ri-name">{t.title}</div>
              <div className="ri-sub">{t.when}</div>
            </span>
          </button>
        ))}
      </div>

      <div className="rail-footer">
        <div className="avatar">RS</div>
        <div style={{flex:1, minWidth:0}}>
          <div style={{fontWeight:500, fontSize:12.5}}>Rohan Sharma</div>
          <div style={{fontSize:11, color:'var(--ink-3)'}}>Mock account · INR</div>
        </div>
        <button className="tool-btn" title="Toggle theme" onClick={onToggleTheme}>
          {theme === 'dark' ? (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.4"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M13 3l-1.4 1.4M4.4 11.6L3 13" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><path d="M13 9.5A5 5 0 018 14a5 5 0 01-3.5-8.5A5 5 0 008 14a5 5 0 005-4.5z" fill="currentColor"/></svg>
          )}
        </button>
        <button className="tool-btn" title="Settings">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.4"/><path d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M3.5 3.5l1 1M11.5 11.5l1 1M12.5 3.5l-1 1M4.5 11.5l-1 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
        </button>
      </div>
    </aside>
  );
}

// Right context rail — live portfolio summary
function ContextRail({ portfolio }) {
  return (
    <aside className="ctx">
      <div className="ctx-section">
        <h4>Active portfolio</h4>
        <div style={{fontWeight:600, fontSize:15, marginBottom:2}}>{portfolio.name}</div>
        <div style={{fontSize:12, color:'var(--ink-3)', marginBottom:16}}>{portfolio.type} · {portfolio.holdings.length} stocks · {portfolio.funds.length} funds</div>
        <div className="kpi-stack">
          <div className="kpi">
            <span className="kpi-label">Value</span>
            <span className="kpi-val">{formatINR(portfolio.value)}</span>
          </div>
          <div className="kpi">
            <span className="kpi-label">Day P&amp;L</span>
            <span className="kpi-val sm" style={{color: portfolio.dayPL>=0?'var(--pos)':'var(--neg)'}}>
              {portfolio.dayPL>=0?'+':'−'}{formatINR(Math.abs(portfolio.dayPL))}
              <span className="mono" style={{fontSize:11, marginLeft:6, opacity:0.8}}>
                {portfolio.dayPLPct>=0?'+':'−'}{Math.abs(portfolio.dayPLPct).toFixed(2)}%
              </span>
            </span>
          </div>
          <div className="kpi">
            <span className="kpi-label">Overall</span>
            <span className="kpi-val sm pos-fg">
              +{formatINR(portfolio.overallGain)}
              <span className="mono" style={{fontSize:11, marginLeft:6, opacity:0.8}}>+{portfolio.overallGainPct.toFixed(2)}%</span>
            </span>
          </div>
        </div>
      </div>

      <div className="ctx-section">
        <h4>Sector allocation</h4>
        <div className="sector-bar">
          {portfolio.sectors.map((s, i) => (
            <div key={s.name} style={{flex: s.weight, background: SECTOR_COLORS[i]||'var(--line)'}} title={`${s.name} ${s.weight}%`}/>
          ))}
        </div>
        {portfolio.sectors.map((s, i) => (
          <div key={s.name} style={{display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:12, padding:'5px 0'}}>
            <span style={{display:'flex', alignItems:'center', gap:7}}>
              <span style={{width:8, height:8, borderRadius:2, background:SECTOR_COLORS[i]||'var(--line)'}}/>
              <span style={{color: s.weight>40?'var(--neg)':'var(--ink-2)', fontWeight: s.weight>40?500:400}}>{s.name}</span>
              {s.weight>40 && <span className="pill warn" style={{fontSize:9, padding:'1px 5px'}}>concentrated</span>}
            </span>
            <span className="mono tnum" style={{color:'var(--ink-3)', fontSize:11}}>{s.weight.toFixed(1)}%</span>
          </div>
        ))}
      </div>

      <div className="ctx-section">
        <h4>Top holdings</h4>
        {portfolio.holdings.slice(0, 6).map(h => (
          <div key={h.symbol} className="hold-row">
            <div>
              <div className="hold-sym">{h.symbol}</div>
              <div className="hold-sec">{h.sector} · {h.weight}%</div>
            </div>
            <div className="hold-delta" style={{color: h.day>=0?'var(--pos)':'var(--neg)'}}>
              {h.day>=0?'+':'−'}{Math.abs(h.day).toFixed(2)}%
            </div>
            <div className="hold-val">{formatINR(h.value).replace('₹','')}</div>
          </div>
        ))}
      </div>

      <div className="ctx-section">
        <h4>Latest signals</h4>
        {NEWS.slice(0, 2).map(n => (
          <div key={n.id} style={{fontSize:12, lineHeight:1.45, padding:'8px 0', borderBottom:'1px dashed var(--line)'}}>
            <div style={{display:'flex', gap:6, marginBottom:4}}>
              <span className={`pill ${n.sentiment==='positive'?'pos':n.sentiment==='negative'?'neg':''}`} style={{fontSize:9, padding:'1px 6px'}}>
                {n.sentiment}
              </span>
              <span style={{fontSize:10, color:'var(--ink-3)'}}>{n.source}</span>
            </div>
            <div style={{color:'var(--ink-2)'}}>{n.headline}</div>
          </div>
        ))}
      </div>
    </aside>
  );
}

Object.assign(window, { LeftRail, ContextRail });
