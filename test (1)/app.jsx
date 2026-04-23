// Root app — chat-first command center

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "defaultPortfolio": "diversified",
  "showRightRail": true,
  "verbosity": "detailed",
  "theme": "light"
}/*EDITMODE-END*/;

const DEFAULT_THREADS = [
  { id:'t1', title:'Why is BANKNIFTY leading the drag?', when:'Today · 4:12 pm' },
  { id:'t2', title:'IT vs FMCG outlook for Q1', when:'Yesterday' },
  { id:'t3', title:'Rebalance ideas for Priya\'s book', when:'Apr 22' },
  { id:'t4', title:'RBI rate path sensitivity', when:'Apr 21' },
];

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [portfolioId, setPortfolioId] = React.useState(t.defaultPortfolio);
  const [threadId, setThreadId] = React.useState(null);
  const portfolio = PORTFOLIOS.find(p => p.id === portfolioId) || PORTFOLIOS[0];

  React.useEffect(() => { setPortfolioId(t.defaultPortfolio); }, [t.defaultPortfolio]);
  React.useEffect(() => { document.documentElement.setAttribute('data-theme', t.theme || 'light'); }, [t.theme]);

  const switchPortfolio = id => { setPortfolioId(id); setTweak('defaultPortfolio', id); setThreadId(null); };
  const toggleTheme = () => setTweak('theme', (t.theme === 'dark' ? 'light' : 'dark'));

  return (
    <div className={`shell ${t.showRightRail?'':'no-right'}`} data-screen-label="01 Chat home">
      <LeftRail
        activePortfolio={portfolioId}
        onSwitch={switchPortfolio}
        onNewChat={() => { setThreadId(null); setPortfolioId(portfolioId); }}
        threads={DEFAULT_THREADS}
        activeThread={threadId}
        onPickThread={setThreadId}
        theme={t.theme}
        onToggleTheme={toggleTheme}
      />
      <Chat portfolio={portfolio} />
      {t.showRightRail && <ContextRail portfolio={portfolio}/>}

      <TweaksPanel>
        <TweakSection label="Portfolio" />
        <TweakRadio
          label="Active"
          value={portfolioId}
          options={[
            { value:'diversified', label:'Diversified' },
            { value:'aggressive', label:'Sector-heavy' },
            { value:'conservative', label:'Conservative' },
          ]}
          onChange={switchPortfolio}
        />

        <TweakSection label="Layout" />
        <TweakToggle label="Context rail" value={t.showRightRail} onChange={v => setTweak('showRightRail', v)} />
        <TweakRadio
          label="Theme"
          value={t.theme}
          options={[
            { value:'light', label:'Light' },
            { value:'dark', label:'Dark' },
          ]}
          onChange={v => setTweak('theme', v)}
        />

        <TweakSection label="Agent" />
        <TweakRadio
          label="Verbosity"
          value={t.verbosity}
          options={[
            { value:'concise', label:'Concise' },
            { value:'detailed', label:'Detailed' },
          ]}
          onChange={v => setTweak('verbosity', v)}
        />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
