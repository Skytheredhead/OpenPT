// Main app — minimal chrome (just titlebar). Home is a centered library card.

const { useState: useStateA, useEffect: useEffectA, useMemo: useMemoA } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "cyan"
}/*EDITMODE-END*/;

const accentMap = {
  cyan:   { val: 'oklch(0.78 0.13 220)', dim: 'oklch(0.48 0.11 220)', soft: 'oklch(0.78 0.13 220 / 0.14)' },
  violet: { val: 'oklch(0.74 0.16 290)', dim: 'oklch(0.48 0.13 290)', soft: 'oklch(0.74 0.16 290 / 0.14)' },
  amber:  { val: 'oklch(0.82 0.16 75)',  dim: 'oklch(0.52 0.13 75)',  soft: 'oklch(0.82 0.16 75 / 0.14)' },
  emerald:{ val: 'oklch(0.76 0.16 155)', dim: 'oklch(0.48 0.13 155)', soft: 'oklch(0.76 0.16 155 / 0.14)' },
};

const STORAGE_KEY = 'openpt.quiz.state.v2';
const FORCE_LIBRARY = new URLSearchParams(window.location.search).get('view') === 'library';

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.quizIds)) return null;
    data.selected = new Set(data.selected || []);
    data.mastered = new Set(data.mastered || []);
    data.firstTryMastered = new Set(data.firstTryMastered || []);
    return data;
  } catch (e) { return null; }
}
function savePersisted(state) {
  if (!state) { localStorage.removeItem(STORAGE_KEY); return; }
  try {
    const serial = {
      ...state,
      selected: [...(state.selected || [])],
      mastered: [...(state.mastered || [])],
      firstTryMastered: [...(state.firstTryMastered || [])],
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serial));
  } catch (e) { /* ignore */ }
}

const App = () => {
  const tweaks = useTweaks(TWEAK_DEFAULTS);
  const [t, setTweak] = tweaks;
  const accent = accentMap[t.accent] || accentMap.cyan;

  const [route, setRoute] = useStateA('home');
  const [outgoingRoute, setOutgoingRoute] = useStateA(null);
  const [transitionKind, setTransitionKind] = useStateA('default'); // 'default' | 'exit'
  const outgoingTimerRef = React.useRef(null);
  const [state, setState] = useStateA(null);

  useEffectA(() => {
    document.documentElement.style.setProperty('--accent', accent.val);
    document.documentElement.style.setProperty('--accent-dim', accent.dim);
    document.documentElement.style.setProperty('--accent-soft', accent.soft);
  }, [t.accent]);

  // Restore on mount
  useEffectA(() => {
    if (FORCE_LIBRARY) return;
    const saved = loadPersisted();
    if (saved) {
      setState(saved);
      if (saved.endedAt) setRoute('results');
      else setRoute(saved.mode === 'quiz' ? 'quiz' : 'practice');
    }
  }, []);

  useEffectA(() => { if (state) savePersisted(state); }, [state]);

  function navigate(next, kind = 'default') {
    if (next === route) return;
    if (outgoingTimerRef.current) clearTimeout(outgoingTimerRef.current);
    setOutgoingRoute(route);
    setTransitionKind(kind);
    setRoute(next);
    // exit transition is longer so the library can settle on top
    const dur = kind === 'exit' ? 620 : 460;
    outgoingTimerRef.current = setTimeout(() => {
      setOutgoingRoute(null);
      outgoingTimerRef.current = null;
    }, dur);
  }

  function launchQuiz(mode, size, bankKey = 'ccna/sem-03/final') {
    const ids = (window.QUESTIONS || [])
      .filter(q => q.bank === bankKey)
      .map(q => q.id);
    const fresh = QuizEngine.create({ poolIds: ids, size, mode });
    let seeded;
    if (mode === 'practice') {
      seeded = QuizEngine.advance(fresh);
    } else {
      seeded = fresh; // quiz mode runs linearly via QuizRunner
    }
    if (FORCE_LIBRARY && window.history?.replaceState) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    setState(seeded);
    navigate(mode === 'quiz' ? 'quiz' : 'practice');
  }

  function finishQuiz() { navigate('results'); }
  function exitToHome() { navigate('home', 'exit'); }
  function restartFromResults() {
    if (!state) return;
    const first = window.QUESTIONS[state.quizIds[0]];
    launchQuiz(state.mode, state.quizIds.length, first?.bank || 'ccna/sem-03/final');
  }

  function renderRoute(r, ctx) {
    const setStateF = ctx.interactive ? ctx.setState : (() => {});
    const onFinishF = ctx.interactive ? ctx.finishQuiz : (() => {});
    const onExitF = ctx.interactive ? ctx.exitToHome : (() => {});
    const onRestartF = ctx.interactive ? ctx.restartFromResults : (() => {});
    if (r === 'home') return <HomePage onLaunch={ctx.interactive ? ctx.launchQuiz : (() => {})} />;
    if (r === 'practice' && ctx.state) return <PracticeRunner state={ctx.state} setState={setStateF} onFinish={onFinishF} onExit={onExitF} />;
    if (r === 'quiz' && ctx.state) return <QuizRunner state={ctx.state} setState={setStateF} onFinish={onFinishF} onExit={onExitF} />;
    if (r === 'results' && ctx.state) return <ResultsPage state={ctx.state} onRestart={onRestartF} onExit={onExitF} />;
    return null;
  }

  return (
    <div className={`app route-${route}`}>
      <div className={`main-area transition-${transitionKind}`}>
        <div className="route-stack">
          {outgoingRoute && outgoingRoute !== route && (
            <div className="route-screen route-exit" key={`out-${outgoingRoute}`}>
              {renderRoute(outgoingRoute, { state, launchQuiz, finishQuiz, exitToHome, restartFromResults, setState, interactive: false })}
            </div>
          )}
          <div className="route-screen route-enter" key={`in-${route}`}>
            {renderRoute(route, { state, launchQuiz, finishQuiz, exitToHome, restartFromResults, setState, interactive: true })}
          </div>
        </div>
      </div>

      <div className="app-version" aria-hidden="true">v0.1</div>

      <Tweaks tweaks={tweaks} />
    </div>
  );
};

const Tweaks = ({ tweaks }) => {
  const [t, setTweak] = tweaks;
  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="Theme" />
      <TweakRadio
        label="Accent"
        value={t.accent}
        options={['cyan', 'violet', 'amber', 'emerald']}
        onChange={v => setTweak('accent', v)} />
    </TweaksPanel>
  );
};

function boot() {
  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(<App />);
  requestAnimationFrame(() => {
    document.getElementById('root')?.classList.add('ready');
  });
}
if (window.QUESTIONS) boot();
else window.addEventListener('questions:ready', boot, { once: true });
