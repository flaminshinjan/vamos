// Landing page app — root with theme + tweaks

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light"
}/*EDITMODE-END*/;

function LandingApp() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  React.useEffect(() => {
    document.documentElement.setAttribute('data-theme', t.theme || 'light');
  }, [t.theme]);
  const toggleTheme = () => setTweak('theme', t.theme === 'dark' ? 'light' : 'dark');

  return (
    <>
      <Nav theme={t.theme} onTheme={toggleTheme}/>
      <Hero/>
      <Ticker/>
      <SourcesStrip/>
      <HowItWorks/>
      <Tour/>
      <CausalGraph/>
      <Compare/>
      <Testimonials/>
      <Trust/>
      <FAQBlock/>
      <CTABlock/>
      <Footer/>

      <TweaksPanel title="Tweaks">
        <TweakSection label="Theme"/>
        <TweakRadio
          label="Mode"
          value={t.theme}
          onChange={v => setTweak('theme', v)}
          options={[{value:'light', label:'Light'}, {value:'dark', label:'Dark'}]}
        />
      </TweaksPanel>
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<LandingApp/>);
