// Hero + live demo

const { useState, useEffect, useRef } = React;

function Logo() {
  return (
    <div className="nav-brand">
      <div className="logo">A</div>
      <span>Aarthik</span>
    </div>
  );
}

function Nav({ onTheme, theme }) {
  return (
    <nav className="nav">
      <div className="nav-inner">
        <Logo/>
        <div className="nav-links">
          <a href="#how">How it works</a>
          <a href="#tour">Product tour</a>
          <a href="#causal">Reasoning</a>
          <a href="#compare">Compare</a>
          <a href="#faq">FAQ</a>
        </div>
        <div className="nav-right">
          <button className="btn ghost sm" onClick={onTheme} aria-label="theme">
            {theme === 'dark' ? '☀' : '☾'}
          </button>
          <a href="Autonomous Financial Advisor.html" className="btn sm">Open the app →</a>
        </div>
      </div>
    </nav>
  );
}

function HeroNumbers() {
  return (
    <div className="hero-trust">
      <div>
        <span className="num tnum">40<sup>+</sup></span>
        <span>Primary sources, streamed continuously</span>
      </div>
      <div>
        <span className="num tnum">90<sup>s</sup></span>
        <span>Daily brief length, before the bell</span>
      </div>
      <div>
        <span className="num tnum">24/7</span>
        <span>Autonomous — no prompt required</span>
      </div>
    </div>
  );
}

const DEMO_CONVO = [
  { role: 'user', text: "Why did TSM jump this morning?" },
  { role: 'agent', kind: 'step', title: 'INGEST', body: 'Pulled TSM guide raise (+6%), Morgan Stanley note, TXN read-through. 3 sources.' },
  { role: 'agent', kind: 'step', title: 'TRACE', body: 'TSM guide ↑ → NVDA demand signal ↑ → AI capex intact → read-through to ASML (positive).' },
  { role: 'agent', kind: 'text', text: "TSM is +2.14% on a revenue guide raise of +6% for Q4, driven by AI accelerator demand. This is bullish for your NVDA (+1.2% pre-mkt) and partly offsets ASML's EU-macro drag." },
  { role: 'agent', kind: 'suggest', items: ['Show the causal graph', 'Should I trim NVDA?', 'What about ASML?'] },
];

function TypingDots() { return <span className="typing"><span/><span/><span/></span>; }

function DemoCard() {
  const [visible, setVisible] = useState(0);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState('');
  const scrollRef = useRef(null);

  useEffect(() => {
    if (visible >= DEMO_CONVO.length) return;
    const cur = DEMO_CONVO[visible];
    const delay = cur.role === 'user' ? 650 : 1100;
    if (cur.role === 'agent' && visible > 0) {
      setTyping(true);
      const t1 = setTimeout(() => { setTyping(false); setVisible(v => v + 1); }, delay);
      return () => clearTimeout(t1);
    }
    const t = setTimeout(() => setVisible(v => v + 1), delay);
    return () => clearTimeout(t);
  }, [visible]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [visible, typing]);

  const replay = () => { setVisible(0); };

  const onSubmit = e => {
    e.preventDefault();
    if (!input.trim()) return;
    window.location.href = 'Autonomous Financial Advisor.html';
  };

  const msgs = DEMO_CONVO.slice(0, visible);

  return (
    <div className="demo-card">
      <div className="demo-bar">
        <div className="dots"><span/><span/><span/></div>
        <span>aarthik.ai/chat · diversified portfolio</span>
        <div className="status">
          <span className="ping"/>
          <span>LIVE · 3 signals</span>
        </div>
      </div>

      <div className="demo-body">
        <div className="demo-chat" ref={scrollRef}>
          {msgs.map((m, i) => <DemoMsg key={i} m={m}/>)}
          {typing && (
            <div className="demo-msg agent fade-in">
              <div className="avatar">A</div>
              <div className="bubble"><TypingDots/></div>
            </div>
          )}
        </div>

        <form className="demo-compose" onSubmit={onSubmit}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask Aarthik anything about your portfolio…"
          />
          <button type="button" className="btn ghost sm" onClick={replay}>↻ Replay</button>
          <button type="submit" className="btn sm amber">Try it →</button>
        </form>
      </div>
    </div>
  );
}

function DemoMsg({ m }) {
  if (m.role === 'user') {
    return (
      <div className="demo-msg user fade-in">
        <div className="bubble">{m.text}</div>
        <div className="avatar">You</div>
      </div>
    );
  }
  if (m.kind === 'step') {
    return (
      <div className="demo-msg agent fade-in">
        <div className="avatar">A</div>
        <div className="demo-step" style={{flex:1, maxWidth: '85%'}}>
          <div className="demo-step-head">
            <div className="n">{m.title === 'INGEST' ? '1' : '2'}</div>
            <span>{m.title}</span>
          </div>
          <div className="demo-step-body">{m.body}</div>
        </div>
      </div>
    );
  }
  if (m.kind === 'suggest') {
    return (
      <div className="demo-suggest fade-in">
        {m.items.map(s => <button key={s}>{s}</button>)}
      </div>
    );
  }
  return (
    <div className="demo-msg agent fade-in">
      <div className="avatar">A</div>
      <div className="bubble">{m.text}</div>
    </div>
  );
}

function Hero() {
  return (
    <section className="hero">
      <div className="wrap">
        <div className="hero-grid">
          <div>
            <div className="hero-kicker">
              <span className="dot"/>
              <span>MKT OPEN · 09:14 EST</span>
              <span className="sep"/>
              <span>v0.12 PRIVATE BETA</span>
            </div>
            <h1 className="h-display">
              The market never <em>sleeps.</em><br/>
              Neither does <span className="amber">your analyst.</span>
            </h1>
            <p className="hero-sub">
              Aarthik is an autonomous agent that reads primary sources, reasons about your holdings,
              and briefs you on what actually moved your book — before the bell, on demand, and without the noise.
            </p>
            <div className="hero-cta-row">
              <a href="Autonomous Financial Advisor.html" className="btn lg">Try the demo →</a>
              <a href="#how" className="btn ghost lg">See how it works</a>
            </div>
            <HeroNumbers/>
          </div>
          <DemoCard/>
        </div>
      </div>
    </section>
  );
}

function Ticker() {
  const data = [...TICKER_DATA, ...TICKER_DATA];
  return (
    <div className="ticker">
      <div className="ticker-inner">
        {data.map((t, i) => (
          <span key={i} className="ticker-item">
            <span className="sym">{t.sym}</span>
            <span className="tnum">{t.val}</span>
            <span className={`pct ${t.dir}`}>{t.pct}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function SourcesStrip() {
  const sources = ["Reuters", "Bloomberg", "FT", "WSJ", "Nikkei", "SEC Edgar", "Fed", "ECB", "OPEC", "S&P", "Moody's", "IMF"];
  return (
    <div className="sources-strip">
      <div className="wrap">
        <div className="eyebrow" style={{marginBottom:20}}>
          <span>Streaming from</span>
        </div>
        <div className="sources-row">
          {sources.map(s => <span key={s}>{s}</span>)}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Nav, Hero, Ticker, SourcesStrip, Logo });
