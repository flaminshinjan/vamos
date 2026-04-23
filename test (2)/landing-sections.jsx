// Middle sections — How it works (reasoning loop), Causal graph, Compare, Testimonials, Trust, FAQ

function HowItWorks() {
  const [active, setActive] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setActive(a => (a + 1) % REASONING_STEPS.length), 4800);
    return () => clearInterval(t);
  }, []);
  const step = REASONING_STEPS[active];
  return (
    <section className="section" id="how">
      <div className="wrap">
        <div className="eyebrow">How it works</div>
        <h2 className="h-section" style={{marginTop:12, maxWidth: '18ch'}}>
          An analyst's loop, running continuously.
        </h2>
        <p className="lede" style={{marginTop:20}}>
          Every market-moving event triggers a four-step loop: ingest the raw feed, trace the
          causal chain, score the impact against your book, and brief you in plain language.
        </p>

        <div className="loop-grid">
          <div className="loop-steps">
            {REASONING_STEPS.map((s, i) => (
              <div
                key={s.n}
                className={`loop-step ${i === active ? 'active' : ''}`}
                onClick={() => setActive(i)}
              >
                <div className="n">{s.n}</div>
                <div>
                  <div className="ttl">{s.title}</div>
                  <div className="desc">{s.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="loop-panel">
            <div className="loop-panel-head">
              <span><span className="amber-dot">●</span> STEP {step.n}</span>
              <span>aarthik · live</span>
            </div>
            <pre key={active} className="fade-in">{formatCode(step.code)}</pre>
          </div>
        </div>
      </div>
    </section>
  );
}

function formatCode(code) {
  // Very light syntax highlight: tokens in backticks could be highlighted; here we just return plain for pre
  return code;
}

function CausalGraph() {
  // SVG causal graph
  const nodes = [
    { id: 'fed',  x: 80,  y: 120, label: 'Fed pause',     cat: 'root'  },
    { id: 'usd',  x: 300, y: 80,  label: 'USD ↓',         cat: 'macro' },
    { id: 'em',   x: 300, y: 200, label: 'EM equities ↑', cat: 'macro' },
    { id: 'ig',   x: 300, y: 310, label: 'IG credit ↑',   cat: 'macro' },
    { id: 'gold', x: 520, y: 60,  label: 'Gold ↑',        cat: 'asset' },
    { id: 'tsm',  x: 520, y: 180, label: 'TSM +0.4%',     cat: 'hold'  },
    { id: 'nem',  x: 720, y: 60,  label: 'NEM +2.1%',     cat: 'hold'  },
    { id: 'asml', x: 520, y: 290, label: 'ASML ±',        cat: 'hold'  },
    { id: 'lqd',  x: 720, y: 320, label: 'LQD +0.3%',     cat: 'hold'  },
  ];
  const edges = [
    { from: 'fed', to: 'usd', w: 0.72 },
    { from: 'fed', to: 'em',  w: 0.55 },
    { from: 'fed', to: 'ig',  w: 0.60 },
    { from: 'usd', to: 'gold', w: 0.80 },
    { from: 'em',  to: 'tsm',  w: 0.45 },
    { from: 'gold', to: 'nem', w: 0.85 },
    { from: 'ig', to: 'lqd',   w: 0.70 },
    { from: 'em', to: 'asml', w: 0.30 },
  ];
  const byId = Object.fromEntries(nodes.map(n => [n.id, n]));
  const color = {
    root: '#E8A13A', macro: '#C8D635', asset: '#B8B1A2', hold: '#F2EEE4'
  };

  return (
    <section className="section" id="causal">
      <div className="wrap">
        <div className="causal-wrap">
          <div className="eyebrow">Reasoning, visualised</div>
          <h2 className="h-section">The causal graph.</h2>
          <p className="lede">
            Aarthik represents every market signal as a graph of cause and effect, with
            confidence on each edge. You see not just what it concluded — but how.
          </p>

          <div className="causal-layout">
            <svg viewBox="0 0 820 380" style={{width:'100%', height:'auto'}}>
              <defs>
                <marker id="arr" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#5B564D"/>
                </marker>
              </defs>
              {edges.map((e, i) => {
                const a = byId[e.from], b = byId[e.to];
                const mx = (a.x + b.x) / 2;
                const my = (a.y + b.y) / 2 - 10;
                return (
                  <g key={i}>
                    <path
                      d={`M ${a.x+40} ${a.y} Q ${mx} ${my} ${b.x-40} ${b.y}`}
                      stroke="#3F3B34"
                      strokeWidth={1 + e.w * 1.5}
                      fill="none"
                      markerEnd="url(#arr)"
                      opacity={0.4 + e.w * 0.4}
                    />
                  </g>
                );
              })}
              {nodes.map(n => (
                <g key={n.id} transform={`translate(${n.x}, ${n.y})`}>
                  <rect x="-44" y="-14" width="88" height="28" rx="6"
                        fill={n.cat === 'hold' ? 'rgba(242,238,228,0.08)' : 'rgba(10,9,6,0.5)'}
                        stroke={color[n.cat]} strokeWidth={n.cat === 'root' ? 1.5 : 1} />
                  <text textAnchor="middle" y="4" fill={color[n.cat]}
                        fontFamily="JetBrains Mono" fontSize="11"
                        fontWeight={n.cat === 'root' ? 600 : 400}>
                    {n.label}
                  </text>
                </g>
              ))}
            </svg>
            <div className="causal-legend">
              <h4>Inferred chain — today</h4>
              <ul>
                {CAUSAL_EDGES.map((e, i) => (
                  <li key={i}>
                    <span><span className="from">{e.from}</span> → <span className="to">{e.to}</span></span>
                    <span className="eff">{e.effect}</span>
                  </li>
                ))}
              </ul>
              <p style={{marginTop:20, color:'var(--ink-4)', fontFamily:'JetBrains Mono', fontSize:11, lineHeight:1.6}}>
                Confidence is computed per edge from source reliability, historical fit, and cross-source agreement.
                Disputed edges turn amber and require your review.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Compare() {
  const iconFor = v => {
    if (v === 'yes') return <span className="yes">✓ Yes</span>;
    if (v === 'no') return <span className="no">— No</span>;
    if (v === 'partial') return <span className="partial">◐ Some</span>;
    return <span className="tnum">{v}</span>;
  };
  return (
    <section className="section" id="compare">
      <div className="wrap">
        <div className="eyebrow">The landscape</div>
        <h2 className="h-section" style={{marginTop:12, maxWidth:'20ch'}}>
          What about Bloomberg, or a robo-advisor?
        </h2>
        <p className="lede" style={{marginTop:20}}>
          Great tools, different jobs. Bloomberg floods you with data. A robo-advisor rebalances
          on autopilot. Aarthik sits between — a research analyst for what you already own.
        </p>

        <div className="compare">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Bloomberg</th>
                <th>Robo-advisor</th>
                <th>Human advisor</th>
                <th className="us">Aarthik</th>
              </tr>
            </thead>
            <tbody>
              {COMPARISONS.map((r, i) => (
                <tr key={i}>
                  <td>{r.row}</td>
                  <td>{iconFor(r.bb)}</td>
                  <td>{iconFor(r.robo)}</td>
                  <td>{iconFor(r.adv)}</td>
                  <td className="us">{iconFor(r.us)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function Testimonials() {
  return (
    <section className="section" id="testimonials">
      <div className="wrap">
        <div className="eyebrow">The beta</div>
        <h2 className="h-section" style={{marginTop:12, maxWidth:'20ch'}}>
          What 2,400 private-beta users are saying.
        </h2>
        <div className="testi-grid">
          {TESTIMONIALS.map((t, i) => (
            <div className="testi" key={i}>
              <div className="quote">{t.quote}</div>
              <div className="who">
                <div className="avatar">{t.initial}</div>
                <div>
                  <div className="name">{t.name}</div>
                  <div className="role">{t.role}</div>
                </div>
                <div className="stat">{t.stat}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TrustIcon({ kind }) {
  const common = { width: 18, height: 18, viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: 1.4 };
  if (kind === 'link') return <svg {...common}><path d="M6 10l4-4M5 9l-2 2a2.8 2.8 0 004 4l2-2M11 7l2-2a2.8 2.8 0 00-4-4l-2 2" strokeLinecap="round"/></svg>;
  if (kind === 'lock') return <svg {...common}><rect x="3" y="7" width="10" height="7" rx="1.2"/><path d="M5 7V5a3 3 0 016 0v2" strokeLinecap="round"/></svg>;
  if (kind === 'shield') return <svg {...common}><path d="M8 2l5 1.5v4c0 3-2.2 5.3-5 6.5-2.8-1.2-5-3.5-5-6.5v-4L8 2z"/></svg>;
  if (kind === 'vault') return <svg {...common}><rect x="2.5" y="3" width="11" height="10" rx="1"/><circle cx="8" cy="8" r="2"/><path d="M8 6v-1M8 10v1M10 8h1M5 8h1" strokeLinecap="round"/></svg>;
  return null;
}

function Trust() {
  return (
    <section className="section" id="trust">
      <div className="wrap">
        <div className="eyebrow">Trust & safety</div>
        <h2 className="h-section" style={{marginTop:12, maxWidth:'20ch'}}>
          Built for people who read the footnotes.
        </h2>
        <div className="trust-grid">
          {TRUST.map(c => (
            <div className="trust-cell" key={c.title}>
              <div className="ico"><TrustIcon kind={c.icon}/></div>
              <h4>{c.title}</h4>
              <p>{c.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQBlock() {
  const [open, setOpen] = React.useState(0);
  return (
    <section className="section" id="faq">
      <div className="wrap">
        <div className="eyebrow">FAQ</div>
        <h2 className="h-section" style={{marginTop:12}}>Questions, answered.</h2>
        <div className="faq">
          {FAQ.map((f, i) => (
            <div key={i} className={`faq-item ${open === i ? 'open' : ''}`}>
              <div className="faq-q" onClick={() => setOpen(open === i ? -1 : i)}>
                <span>{f.q}</span>
                <span className="chev">+</span>
              </div>
              <div className="faq-a">{f.a}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTABlock() {
  const [email, setEmail] = React.useState('');
  const [sent, setSent] = React.useState(false);
  const submit = e => { e.preventDefault(); if (email.trim()) setSent(true); };
  return (
    <section id="waitlist">
      <div className="cta-block">
        <div className="eyebrow">Private beta</div>
        <h2 className="h-section">An analyst in your pocket.<br/>Ready before the bell.</h2>
        <p>Join 2,400+ self-directed investors on the waitlist. Full access opens in cohorts every Monday.</p>
        {!sent ? (
          <form className="waitlist" onSubmit={submit}>
            <input
              type="email" required
              placeholder="you@portfolio.com"
              value={email} onChange={e => setEmail(e.target.value)}
            />
            <button className="btn amber">Request access →</button>
          </form>
        ) : (
          <div className="waitlist" style={{paddingLeft:16}}>
            <span className="ok">✓ You're on the list. We'll be in touch.</span>
          </div>
        )}
      </div>
    </section>
  );
}

function Footer() {
  return (
    <>
      <footer>
        <div>
          <Logo/>
          <p className="tagline" style={{marginTop:16}}>The autonomous analyst for people who actually read the footnotes.</p>
          <p className="disc">
            Aarthik is a research assistant, not a registered investment advisor. All outputs are informational. Nothing on this site is an offer to buy or sell securities. Past performance does not predict future results.
          </p>
        </div>
        <div>
          <h5>Product</h5>
          <ul>
            <li><a href="#how">How it works</a></li>
            <li><a href="#tour">Tour</a></li>
            <li><a href="#causal">Reasoning</a></li>
            <li><a href="#compare">Compare</a></li>
          </ul>
        </div>
        <div>
          <h5>Company</h5>
          <ul>
            <li><a href="#">About</a></li>
            <li><a href="#">Careers</a></li>
            <li><a href="#">Research</a></li>
            <li><a href="#">Press</a></li>
          </ul>
        </div>
        <div>
          <h5>Legal</h5>
          <ul>
            <li><a href="#">Privacy</a></li>
            <li><a href="#">Terms</a></li>
            <li><a href="#">Disclosures</a></li>
            <li><a href="#">Security</a></li>
          </ul>
        </div>
      </footer>
      <div className="post-footer">
        <span>© 2025 AARTHIK LABS · DELAWARE</span>
        <span>BUILT IN NEW YORK · BANGALORE</span>
      </div>
    </>
  );
}

Object.assign(window, { HowItWorks, CausalGraph, Compare, Testimonials, Trust, FAQBlock, CTABlock, Footer });
