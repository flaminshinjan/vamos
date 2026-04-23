"use client";

import "./landing.css";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  CAUSAL_EDGES_GRAPH,
  CAUSAL_LEGEND,
  CAUSAL_NODES,
  COMPARISONS,
  DEMO_CONVO,
  FAQ,
  NAV_LINKS,
  REASONING_STEPS,
  SOURCES,
  TESTIMONIALS,
  TICKER_DATA,
  TRUST,
} from "@/lib/landing-data";

export default function LandingPage() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = (localStorage.getItem("vamos-theme") as "light" | "dark") || "light";
    setTheme(saved);
  }, []);

  const toggle = () => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("vamos-theme", next);
      return next;
    });
  };

  return (
    <div className="landing-root" data-theme={theme}>
      <Nav theme={theme} onToggleTheme={toggle} />
      <Hero />
      <Ticker />
      <SourcesStrip />
      <HowItWorks />
      <CausalGraphSection />
      <Compare />
      <Testimonials />
      <Trust />
      <FAQBlock />
      <CTABlock />
      <Footer />
    </div>
  );
}

function Logo() {
  return (
    <div className="nav-brand">
      <div className="logo">A</div>
      <span>Aarthik</span>
    </div>
  );
}

function Nav({ theme, onToggleTheme }: { theme: "light" | "dark"; onToggleTheme: () => void }) {
  return (
    <nav className="nav">
      <div className="nav-inner">
        <Logo />
        <div className="nav-links">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href}>
              {l.label}
            </a>
          ))}
        </div>
        <div className="nav-right">
          <button className="btn ghost sm" onClick={onToggleTheme} aria-label="theme">
            {theme === "dark" ? "☀" : "☾"}
          </button>
          <Link href="/app" className="btn sm">
            Open the app →
          </Link>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="hero">
      <div className="wrap">
        <div className="hero-grid">
          <div>
            <div className="hero-kicker">
              <span className="dot" />
              <span>MKT OPEN · 09:14 EST</span>
              <span className="sep" />
              <span>v0.12 PRIVATE BETA</span>
            </div>
            <h1 className="h-display">
              The market never <em>sleeps.</em>
              <br />
              Neither does <span className="amber">your analyst.</span>
            </h1>
            <p className="hero-sub">
              Aarthik is an autonomous agent that reads primary sources, reasons about your
              holdings, and briefs you on what actually moved your book — before the bell, on
              demand, and without the noise.
            </p>
            <div className="hero-cta-row">
              <Link href="/app" className="btn lg">
                Try the demo →
              </Link>
              <a href="#how" className="btn ghost lg">
                See how it works
              </a>
            </div>
            <div className="hero-trust">
              <div>
                <span className="num tnum">
                  40<sup>+</sup>
                </span>
                <span>Primary sources, streamed continuously</span>
              </div>
              <div>
                <span className="num tnum">
                  90<sup>s</sup>
                </span>
                <span>Daily brief length, before the bell</span>
              </div>
              <div>
                <span className="num tnum">24/7</span>
                <span>Autonomous — no prompt required</span>
              </div>
            </div>
          </div>
          <DemoCard />
        </div>
      </div>
    </section>
  );
}

function DemoCard() {
  const [visible, setVisible] = useState(0);
  const [typing, setTyping] = useState(false);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (visible >= DEMO_CONVO.length) return;
    const cur = DEMO_CONVO[visible];
    const delay = cur.role === "user" ? 650 : 1100;
    if (cur.role === "agent" && visible > 0) {
      setTyping(true);
      const t1 = setTimeout(() => {
        setTyping(false);
        setVisible((v) => v + 1);
      }, delay);
      return () => clearTimeout(t1);
    }
    const t = setTimeout(() => setVisible((v) => v + 1), delay);
    return () => clearTimeout(t);
  }, [visible]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [visible, typing]);

  const replay = () => setVisible(0);
  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    window.location.href = "/app";
  };

  const msgs = DEMO_CONVO.slice(0, visible);

  return (
    <div className="demo-card">
      <div className="demo-bar">
        <div className="dots">
          <span />
          <span />
          <span />
        </div>
        <span>aarthik.ai/chat · diversified portfolio</span>
        <div className="status">
          <span className="ping" />
          <span>LIVE · 3 signals</span>
        </div>
      </div>

      <div className="demo-body">
        <div className="demo-chat" ref={scrollRef}>
          {msgs.map((m, i) => (
            <DemoMsg key={i} m={m} />
          ))}
          {typing && (
            <div className="demo-msg agent fade-in">
              <div className="avatar">A</div>
              <div className="bubble">
                <span className="typing">
                  <span />
                  <span />
                  <span />
                </span>
              </div>
            </div>
          )}
        </div>

        <form className="demo-compose" onSubmit={onSubmit}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask Aarthik anything about your portfolio…"
          />
          <button type="button" className="btn ghost sm" onClick={replay}>
            ↻ Replay
          </button>
          <button type="submit" className="btn sm amber">
            Try it →
          </button>
        </form>
      </div>
    </div>
  );
}

function DemoMsg({ m }: { m: (typeof DEMO_CONVO)[number] }) {
  if (m.role === "user") {
    return (
      <div className="demo-msg user fade-in">
        <div className="bubble">{m.text}</div>
        <div className="avatar">You</div>
      </div>
    );
  }
  if (m.kind === "step") {
    return (
      <div className="demo-msg agent fade-in">
        <div className="avatar">A</div>
        <div className="demo-step" style={{ flex: 1, maxWidth: "85%" }}>
          <div className="demo-step-head">
            <div className="n">{m.title === "INGEST" ? "1" : "2"}</div>
            <span>{m.title}</span>
          </div>
          <div className="demo-step-body">{m.body}</div>
        </div>
      </div>
    );
  }
  if (m.kind === "suggest") {
    return (
      <div className="demo-suggest fade-in">
        {m.items.map((s) => (
          <button key={s}>{s}</button>
        ))}
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
  return (
    <div className="sources-strip">
      <div className="wrap">
        <div className="eyebrow" style={{ marginBottom: 20 }}>
          <span>Streaming from</span>
        </div>
        <div className="sources-row">
          {SOURCES.map((s) => (
            <span key={s}>{s}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function HowItWorks() {
  const [active, setActive] = useState(0);
  useEffect(() => {
    const t = setInterval(
      () => setActive((a) => (a + 1) % REASONING_STEPS.length),
      4800,
    );
    return () => clearInterval(t);
  }, []);
  const step = REASONING_STEPS[active];
  return (
    <section className="section" id="how">
      <div className="wrap">
        <div className="eyebrow">How it works</div>
        <h2 className="h-section" style={{ marginTop: 12, maxWidth: "18ch" }}>
          An analyst&apos;s loop, running continuously.
        </h2>
        <p className="lede" style={{ marginTop: 20 }}>
          Every market-moving event triggers a four-step loop: ingest the raw feed, trace the
          causal chain, score the impact against your book, and brief you in plain language.
        </p>

        <div className="loop-grid">
          <div className="loop-steps">
            {REASONING_STEPS.map((s, i) => (
              <div
                key={s.n}
                className={`loop-step ${i === active ? "active" : ""}`}
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
              <span>
                <span className="amber-dot">●</span> STEP {step.n}
              </span>
              <span>aarthik · live</span>
            </div>
            <pre key={active} className="fade-in">
              {step.code}
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}

function CausalGraphSection() {
  const byId = Object.fromEntries(CAUSAL_NODES.map((n) => [n.id, n]));
  const color: Record<string, string> = {
    root: "#E8A13A",
    macro: "#C8D635",
    asset: "#B8B1A2",
    hold: "#F2EEE4",
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
            <svg viewBox="0 0 820 380" style={{ width: "100%", height: "auto" }}>
              <defs>
                <marker
                  id="arr"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="#5B564D" />
                </marker>
              </defs>
              {CAUSAL_EDGES_GRAPH.map((e, i) => {
                const a = byId[e.from];
                const b = byId[e.to];
                const mx = (a.x + b.x) / 2;
                const my = (a.y + b.y) / 2 - 10;
                return (
                  <path
                    key={i}
                    d={`M ${a.x + 40} ${a.y} Q ${mx} ${my} ${b.x - 40} ${b.y}`}
                    stroke="#3F3B34"
                    strokeWidth={1 + e.w * 1.5}
                    fill="none"
                    markerEnd="url(#arr)"
                    opacity={0.4 + e.w * 0.4}
                  />
                );
              })}
              {CAUSAL_NODES.map((n) => (
                <g key={n.id} transform={`translate(${n.x}, ${n.y})`}>
                  <rect
                    x="-44"
                    y="-14"
                    width="88"
                    height="28"
                    rx="6"
                    fill={n.cat === "hold" ? "rgba(242,238,228,0.08)" : "rgba(10,9,6,0.5)"}
                    stroke={color[n.cat]}
                    strokeWidth={n.cat === "root" ? 1.5 : 1}
                  />
                  <text
                    textAnchor="middle"
                    y="4"
                    fill={color[n.cat]}
                    fontFamily="JetBrains Mono"
                    fontSize="11"
                    fontWeight={n.cat === "root" ? 600 : 400}
                  >
                    {n.label}
                  </text>
                </g>
              ))}
            </svg>
            <div className="causal-legend">
              <h4>Inferred chain — today</h4>
              <ul>
                {CAUSAL_LEGEND.map((e, i) => (
                  <li key={i}>
                    <span>
                      <span className="from">{e.from}</span> →{" "}
                      <span className="to">{e.to}</span>
                    </span>
                    <span className="eff">{e.effect}</span>
                  </li>
                ))}
              </ul>
              <p
                style={{
                  marginTop: 20,
                  color: "var(--ink-4)",
                  fontFamily: "JetBrains Mono",
                  fontSize: 11,
                  lineHeight: 1.6,
                }}
              >
                Confidence is computed per edge from source reliability, historical fit, and
                cross-source agreement. Disputed edges turn amber and require your review.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Compare() {
  const iconFor = (v: string) => {
    if (v === "yes") return <span className="yes">✓ Yes</span>;
    if (v === "no") return <span className="no">— No</span>;
    if (v === "partial") return <span className="partial">◐ Some</span>;
    return <span className="tnum">{v}</span>;
  };
  return (
    <section className="section" id="compare">
      <div className="wrap">
        <div className="eyebrow">The landscape</div>
        <h2 className="h-section" style={{ marginTop: 12, maxWidth: "20ch" }}>
          What about Bloomberg, or a robo-advisor?
        </h2>
        <p className="lede" style={{ marginTop: 20 }}>
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
        <h2 className="h-section" style={{ marginTop: 12, maxWidth: "20ch" }}>
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

function TrustIcon({ kind }: { kind: "link" | "lock" | "shield" | "vault" }) {
  const props = {
    width: 18,
    height: 18,
    viewBox: "0 0 16 16",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.4,
  };
  if (kind === "link")
    return (
      <svg {...props}>
        <path
          d="M6 10l4-4M5 9l-2 2a2.8 2.8 0 004 4l2-2M11 7l2-2a2.8 2.8 0 00-4-4l-2 2"
          strokeLinecap="round"
        />
      </svg>
    );
  if (kind === "lock")
    return (
      <svg {...props}>
        <rect x="3" y="7" width="10" height="7" rx="1.2" />
        <path d="M5 7V5a3 3 0 016 0v2" strokeLinecap="round" />
      </svg>
    );
  if (kind === "shield")
    return (
      <svg {...props}>
        <path d="M8 2l5 1.5v4c0 3-2.2 5.3-5 6.5-2.8-1.2-5-3.5-5-6.5v-4L8 2z" />
      </svg>
    );
  return (
    <svg {...props}>
      <rect x="2.5" y="3" width="11" height="10" rx="1" />
      <circle cx="8" cy="8" r="2" />
      <path d="M8 6v-1M8 10v1M10 8h1M5 8h1" strokeLinecap="round" />
    </svg>
  );
}

function Trust() {
  return (
    <section className="section" id="trust">
      <div className="wrap">
        <div className="eyebrow">Trust &amp; safety</div>
        <h2 className="h-section" style={{ marginTop: 12, maxWidth: "20ch" }}>
          Built for people who read the footnotes.
        </h2>
        <div className="trust-grid">
          {TRUST.map((c) => (
            <div className="trust-cell" key={c.title}>
              <div className="ico">
                <TrustIcon kind={c.icon} />
              </div>
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
  const [open, setOpen] = useState<number>(0);
  return (
    <section className="section" id="faq">
      <div className="wrap">
        <div className="eyebrow">FAQ</div>
        <h2 className="h-section" style={{ marginTop: 12 }}>
          Questions, answered.
        </h2>
        <div className="faq">
          {FAQ.map((f, i) => (
            <div key={i} className={`faq-item ${open === i ? "open" : ""}`}>
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
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (email.trim()) setSent(true);
  };
  return (
    <section id="waitlist">
      <div className="cta-block">
        <div className="eyebrow">Private beta</div>
        <h2 className="h-section">
          An analyst in your pocket.
          <br />
          Ready before the bell.
        </h2>
        <p>
          Join 2,400+ self-directed investors on the waitlist. Full access opens in cohorts
          every Monday.
        </p>
        {!sent ? (
          <form className="waitlist" onSubmit={submit}>
            <input
              type="email"
              required
              placeholder="you@portfolio.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="btn amber">Request access →</button>
          </form>
        ) : (
          <div className="waitlist" style={{ paddingLeft: 16 }}>
            <span className="ok">✓ You&apos;re on the list. We&apos;ll be in touch.</span>
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
          <Logo />
          <p className="tagline" style={{ marginTop: 16 }}>
            The autonomous analyst for people who actually read the footnotes.
          </p>
          <p className="disc">
            Aarthik is a research assistant, not a registered investment advisor. All outputs are
            informational. Nothing on this site is an offer to buy or sell securities. Past
            performance does not predict future results.
          </p>
        </div>
        <div>
          <h5>Product</h5>
          <ul>
            <li>
              <a href="#how">How it works</a>
            </li>
            <li>
              <a href="#causal">Reasoning</a>
            </li>
            <li>
              <a href="#compare">Compare</a>
            </li>
            <li>
              <Link href="/app">Open app</Link>
            </li>
          </ul>
        </div>
        <div>
          <h5>Company</h5>
          <ul>
            <li>
              <a href="#">About</a>
            </li>
            <li>
              <a href="#">Careers</a>
            </li>
            <li>
              <a href="#">Research</a>
            </li>
            <li>
              <a href="#">Press</a>
            </li>
          </ul>
        </div>
        <div>
          <h5>Legal</h5>
          <ul>
            <li>
              <a href="#">Privacy</a>
            </li>
            <li>
              <a href="#">Terms</a>
            </li>
            <li>
              <a href="#">Disclosures</a>
            </li>
            <li>
              <a href="#">Security</a>
            </li>
          </ul>
        </div>
      </footer>
      <div className="post-footer">
        <span>© 2026 AARTHIK LABS · DELAWARE</span>
        <span>BUILT IN NEW YORK · BANGALORE</span>
      </div>
    </>
  );
}
