// Chat — center column. Handles conversation state + rendering.

const SUGGESTED_PROMPTS = [
  { icon: '✦', text: 'Why did my portfolio move today?', intent: 'briefing' },
  { icon: '◷', text: 'Show today\'s market snapshot', intent: 'market' },
  { icon: '◈', text: 'Analyze my concentration risk', intent: 'risk' },
  { icon: '◉', text: 'Trace the causal chain for HDFCBANK', intent: 'causal' },
];

function Welcome({ portfolio, onPrompt }) {
  return (
    <div className="fade-up" style={{paddingTop: 40, paddingBottom: 24}}>
      <div style={{display:'inline-flex', alignItems:'center', gap:8, padding:'5px 12px', background:'var(--accent-soft)', color:'var(--accent)', borderRadius:999, fontSize:11.5, fontWeight:500, marginBottom:20}}>
        <span className="dot pulse" style={{background:'var(--accent)'}}/>
        Connected · {portfolio.name.split(' ')[0]}'s portfolio · NSE close
      </div>
      <h1 className="serif" style={{fontSize:46, lineHeight:1.05, letterSpacing:'-0.02em', margin:'0 0 14px', maxWidth:620}}>
        Good evening. Ask me <em style={{color:'var(--accent)'}}>why</em>,<br/>not just <span style={{color:'var(--ink-3)'}}>how much</span>.
      </h1>
      <p style={{fontSize:15, color:'var(--ink-2)', maxWidth:540, lineHeight:1.55, margin:'0 0 22px'}}>
        I reason through today's news, map it to sectors you hold, and explain exactly how the causal chain reached your portfolio — with sources and a confidence score.
      </p>
      <div className="chips">
        {SUGGESTED_PROMPTS.map(p => (
          <button key={p.intent} className="chip" onClick={() => onPrompt(p.text, p.intent)}>
            <span className="mono">{p.icon}</span>{p.text}
          </button>
        ))}
      </div>
    </div>
  );
}

function UserMessage({ text }) {
  return (
    <div className="msg">
      <div className="msg-row">
        <div className="msg-avatar user">R</div>
        <div className="msg-body">
          <div className="msg-who">You</div>
          <div className="msg-content">{text}</div>
        </div>
      </div>
    </div>
  );
}

function AgentMessage({ children, stage, onAdvance }) {
  return (
    <div className="msg">
      <div className="msg-row">
        <div className="msg-avatar agent">A</div>
        <div className="msg-body">
          <div className="msg-who">
            Aarthik
            <span style={{fontSize:11, color:'var(--ink-4)'}}>· sonnet-4.5 · traced</span>
          </div>
          <div className="msg-content">{children}</div>
        </div>
      </div>
    </div>
  );
}

function TypingMessage() {
  return (
    <div className="msg fade-in">
      <div className="msg-row">
        <div className="msg-avatar agent">A</div>
        <div className="msg-body" style={{paddingTop:6}}>
          <div className="typing-indicator"><span/><span/><span/></div>
        </div>
      </div>
    </div>
  );
}

function Chat({ portfolio, onSwitch }) {
  const [messages, setMessages] = React.useState([]);
  const [typing, setTyping] = React.useState(false);
  const [input, setInput] = React.useState('');
  const scrollRef = React.useRef(null);

  // scroll to bottom on new content
  React.useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, typing]);

  // Reset chat when portfolio switches
  const portfolioKey = portfolio.id;
  React.useEffect(() => {
    setMessages([]);
    setTyping(false);
  }, [portfolioKey]);

  function handlePrompt(text, intent) {
    const userMsg = { id: `u${Date.now()}`, role: 'user', text };
    setMessages(m => [...m, userMsg]);
    setTyping(true);

    // Agent response choreography
    const sequence = intentResponse(intent || classifyIntent(text), portfolio);
    let delay = 650;
    sequence.forEach((step, i) => {
      setTimeout(() => {
        if (i === 0) setTyping(false);
        setMessages(m => [...m, { id: `a${Date.now()}${i}`, role: 'agent', ...step }]);
      }, delay);
      delay += step.delay || 1000;
    });
  }

  function submit(e) {
    e && e.preventDefault();
    if (!input.trim()) return;
    handlePrompt(input.trim(), null);
    setInput('');
  }

  return (
    <section className="chat">
      <div className="chat-header">
        <div className="chat-title">
          <span className="dot accent pulse"/>
          <span>Briefing session</span>
          <span className="dim">· {portfolio.name}</span>
        </div>
        <div style={{display:'flex', gap:6, fontSize:12, color:'var(--ink-3)'}}>
          <button className="tool-btn">Share</button>
          <button className="tool-btn">Export</button>
          <button className="tool-btn">⋯</button>
        </div>
      </div>

      <div className="chat-scroll" ref={scrollRef}>
        <div className="chat-inner">
          {messages.length === 0 && (
            <Welcome portfolio={portfolio} onPrompt={handlePrompt} />
          )}
          {messages.map(m => (
            m.role === 'user'
              ? <UserMessage key={m.id} text={m.text} />
              : <AgentMessage key={m.id}>{renderAgentStep(m, portfolio, handlePrompt)}</AgentMessage>
          ))}
          {typing && <TypingMessage/>}
        </div>
      </div>

      <div className="composer-wrap">
        <form className="composer" onSubmit={submit}>
          <textarea
            rows="1"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) submit(e); }}
            placeholder="Ask about news, sectors, holdings, or risks…"
          />
          <div className="composer-foot">
            <div className="composer-tools">
              <button type="button" className="tool-btn" title="Attach news">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M10 3.5v5a2 2 0 01-4 0V4a1.5 1.5 0 013 0v4.5" stroke="currentColor" strokeWidth="1.3"/></svg>
                Attach
              </button>
              <button type="button" className="tool-btn" title="Switch portfolio">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none"><path d="M3 5l3-3 3 3M13 11l-3 3-3-3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                {portfolio.name.split(' ')[0]}
              </button>
            </div>
            <button type="submit" className="send-btn" disabled={!input.trim()}>
              Send
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

// ── Intent → response script
function classifyIntent(text) {
  const t = text.toLowerCase();
  if (t.includes('market') || t.includes('nifty') || t.includes('sensex')) return 'market';
  if (t.includes('risk') || t.includes('concentrat')) return 'risk';
  if (t.includes('causal') || t.includes('chain') || t.includes('trace')) return 'causal';
  if (t.includes('news')) return 'news';
  return 'briefing';
}

function intentResponse(intent, portfolio) {
  if (intent === 'market') {
    return [
      { kind:'text', text: `Here's the market picture today. Three sectors advanced and seven declined — the tone is clearly bearish with banking taking the brunt.`, delay: 700 },
      { kind:'card', card:'market', delay: 1200 },
      { kind:'followups', delay: 200 },
    ];
  }
  if (intent === 'risk') {
    const topSector = portfolio.sectors[0];
    const over = topSector.weight > 40;
    return [
      { kind:'text', text: over
          ? `I've flagged a concentration risk. ${topSector.name} accounts for ${topSector.weight.toFixed(1)}% of your book — well above the 40% threshold I watch for.`
          : `Your portfolio looks well balanced. The largest sector (${topSector.name}) sits at ${topSector.weight.toFixed(1)}%, comfortably below the 40% concentration threshold.`,
        delay: 800 },
      { kind:'card', card:'risk', delay: 1000 },
      { kind:'followups', delay: 200 },
    ];
  }
  if (intent === 'causal') {
    return [
      { kind:'text', text: `Let me trace the full causal chain. I'll only show paths with impact score above 0.50.`, delay: 700 },
      { kind:'card', card:'reasoning', delay: 1000 },
      { kind:'card', card:'graph', delay: 8000 },
      { kind:'followups', delay: 200 },
    ];
  }
  if (intent === 'news') {
    return [
      { kind:'text', text: `I classified ${NEWS.length} headlines today. Each is tagged by sentiment, scope, and an impact score that I use to prioritize signal over noise.`, delay: 800 },
      { kind:'card', card:'news', delay: 1200 },
    ];
  }
  // default = full briefing
  return [
    { kind:'text', text: `Let me reason through this. I'll pull market context, classify today's news, link it to your holdings, and grade my own output before presenting.`, delay: 800 },
    { kind:'card', card:'reasoning', delay: 800 },
    { kind:'card', card:'graph', delay: 7500 },
    { kind:'card', card:'briefing', delay: 1200 },
    { kind:'followups', delay: 200 },
  ];
}

function renderAgentStep(m, portfolio, onPrompt) {
  if (m.kind === 'text') {
    return <p>{m.text}</p>;
  }
  if (m.kind === 'card') {
    if (m.card === 'market') return <MarketSnapshot/>;
    if (m.card === 'news') return <NewsCard/>;
    if (m.card === 'reasoning') return <ReasoningCard/>;
    if (m.card === 'graph') return <CausalGraphCard portfolio={portfolio}/>;
    if (m.card === 'briefing') return <BriefingCard portfolio={portfolio} verbosity="detailed"/>;
    if (m.card === 'risk') return <RiskCard portfolio={portfolio}/>;
  }
  if (m.kind === 'followups') {
    return (
      <div className="chips" style={{marginTop:4}}>
        <button className="chip" onClick={() => onPrompt('Trace the causal chain for HDFCBANK', 'causal')}>
          <span className="mono">→</span>Trace the causal chain
        </button>
        <button className="chip" onClick={() => onPrompt('What if RBI cuts rates next meeting?', 'briefing')}>
          <span className="mono">→</span>What if RBI cuts rates?
        </button>
        <button className="chip" onClick={() => onPrompt('Analyze my concentration risk', 'risk')}>
          <span className="mono">→</span>Check concentration risk
        </button>
      </div>
    );
  }
  return null;
}

function RiskCard({ portfolio }) {
  return (
    <div className="card fade-up">
      <div className="card-head">
        <div className="card-title">
          {portfolio.sectors[0].weight > 40
            ? <><span className="dot warn"/> Concentration risk detected</>
            : <><span className="dot pos"/> No concentration risk</>}
        </div>
        <div className="card-sub">threshold 40%</div>
      </div>
      <div className="card-body">
        <div className="sector-bar" style={{height:10, marginBottom:16}}>
          {portfolio.sectors.map((s, i) => (
            <div key={s.name} style={{flex:s.weight, background: SECTOR_COLORS[i]||'var(--line)'}}/>
          ))}
        </div>
        {portfolio.sectors.map((s, i) => (
          <div key={s.name} style={{display:'grid', gridTemplateColumns:'130px 1fr 60px', gap:12, alignItems:'center', padding:'7px 0', fontSize:12.5}}>
            <span style={{color: s.weight>40?'var(--neg)':'var(--ink-2)', fontWeight: s.weight>40?500:400}}>{s.name}</span>
            <div style={{height:5, background:'var(--bg-sunk)', borderRadius:3, overflow:'hidden'}}>
              <div style={{width:`${Math.min(100, s.weight*1.5)}%`, height:'100%',
                background: s.weight>40?'var(--neg)':SECTOR_COLORS[i]||'var(--line)'}}/>
            </div>
            <span className="mono tnum" style={{textAlign:'right', color:'var(--ink-3)'}}>{s.weight.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

Object.assign(window, { Chat });
