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
const FORCE_DIAGRAMS = window.location.pathname.replace(/\/+$/, '').endsWith('/quiz/ccna-b-diagrams');

function loadPersisted() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || (!Array.isArray(data.quizIds) && !Array.isArray(data.questionKeys))) return null;
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

  const [route, setRoute] = useStateA(FORCE_DIAGRAMS ? 'ccna-b-diagrams' : 'home');
  const [outgoingRoute, setOutgoingRoute] = useStateA(null);
  const [transitionKind, setTransitionKind] = useStateA('default'); // 'default' | 'exit'
  const outgoingTimerRef = React.useRef(null);
  const [state, setState] = useStateA(null);
  const client = useMemoA(() => window.OpenPTSync ? new window.OpenPTSync.OpenPTSyncClient() : null, []);
  const [user, setUser] = useStateA(null);
  const [studyDashboard, setStudyDashboard] = useStateA(null);
  const [auth, setAuth] = useStateA({ open: false, busy: false, error: '', notice: '' });

  useEffectA(() => {
    document.documentElement.style.setProperty('--accent', accent.val);
    document.documentElement.style.setProperty('--accent-dim', accent.dim);
    document.documentElement.style.setProperty('--accent-soft', accent.soft);
  }, [t.accent]);

  useEffectA(() => {
    let alive = true;
    if (!client) return;
    client.me()
      .then(data => {
        if (!alive) return;
        setUser(data.user || null);
        if (data.user) return refreshStudyDashboard();
      })
      .catch(() => {});
    return () => { alive = false; };
  }, [client]);

  // Restore on mount
  useEffectA(() => {
    if (FORCE_LIBRARY || FORCE_DIAGRAMS) return;
    const saved = loadPersisted();
    if (saved) {
      setState(saved);
      if (saved.endedAt) setRoute('results');
      else setRoute(saved.mode === 'study' ? 'study' : saved.mode === 'quiz' ? 'quiz' : 'practice');
    }
  }, []);

  useEffectA(() => { if (state) savePersisted(state); }, [state]);

  function navigate(next, kind = 'default') {
    if (next === route) return;
    if (outgoingTimerRef.current) clearTimeout(outgoingTimerRef.current);
    setOutgoingRoute(route);
    setTransitionKind(kind);
    setRoute(next);
    // exit transition is longer so the outgoing route can fade cleanly.
    const dur = kind === 'exit' ? 620 : 460;
    outgoingTimerRef.current = setTimeout(() => {
      setOutgoingRoute(null);
      outgoingTimerRef.current = null;
    }, dur);
  }

  function launchQuiz(mode, size, bankKey = 'ccna/sem-03/final') {
    const ids = (window.QUESTIONS || [])
      .filter(q => bankKey === 'ccna/all' || q.bank === bankKey)
      .map(q => q.id);
    const fresh = { ...QuizEngine.create({ poolIds: ids, size, mode }), bankKey };
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

  function ccnaStudyQuestionKeys() {
    return (window.QUESTIONS || [])
      .filter(q => q.bank?.startsWith('ccna/'))
      .map(q => q.questionKey)
      .filter(Boolean);
  }

  async function refreshStudyDashboard() {
    if (!client) return null;
    const total = ccnaStudyQuestionKeys().length;
    const data = await client.studySummary(total);
    setStudyDashboard(data.dashboard || null);
    return data.dashboard || null;
  }

  async function launchStudy(knownUser = user) {
    if (!client) {
      setAuth({ open: true, busy: false, error: 'Study Mode needs the OpenPT sync client.', notice: '' });
      return;
    }
    if (!knownUser) {
      setAuth({ open: true, busy: false, error: '', notice: 'Sign in to save CCNA Study Mode progress.' });
      return;
    }
    setAuth(a => ({ ...a, busy: true, error: '', notice: 'Starting Study Mode...' }));
    try {
      const keys = ccnaStudyQuestionKeys();
      const data = await client.createStudySession(keys);
      const session = data.session;
      const fresh = {
        mode: 'study',
        sessionId: session.id,
        questionKeys: session.questionKeys || [],
        cursor: 0,
        selected: new Set(),
        answered: false,
        attempts: {},
        optionOrders: {},
        activeStartedAt: Date.now(),
        startedAt: Date.now(),
        dashboard: session.summary || studyDashboard,
      };
      if (FORCE_LIBRARY && window.history?.replaceState) {
        window.history.replaceState(null, '', window.location.pathname);
      }
      setState(fresh);
      setAuth({ open: false, busy: false, error: '', notice: '' });
      navigate('study');
    } catch (err) {
      setAuth({ open: true, busy: false, error: err.message || 'Could not start Study Mode.', notice: '' });
    }
  }

  function finishQuiz() { navigate('results'); }
  function exitToHome() { navigate('home', 'exit'); }
  function restartFromResults() {
    if (!state) return;
    if (state.mode === 'study') {
      launchStudy();
      return;
    }
    const first = window.QUESTIONS[state.quizIds[0]];
    launchQuiz(state.mode, state.quizIds.length, state.bankKey || first?.bank || 'ccna/sem-03/final');
  }

  async function handleAuthSubmit({ mode, email, password }) {
    if (!client) return;
    setAuth(a => ({ ...a, busy: true, error: '', notice: '' }));
    try {
      if (mode === 'register') {
        const registered = await client.register(email, password);
        if (registered.verification?.token) {
          await client.verifyEmail(registered.verification.token);
          const loggedIn = await client.login(email, password);
          setUser(loggedIn.user);
          await refreshStudyDashboard();
          setAuth({ open: false, busy: false, error: '', notice: '' });
          launchStudy(loggedIn.user);
          return;
        }
        setAuth({ open: true, busy: false, error: '', notice: 'Check your email to verify the account, then sign in.' });
        return;
      }
      const loggedIn = await client.login(email, password);
      setUser(loggedIn.user);
      await refreshStudyDashboard();
      setAuth({ open: false, busy: false, error: '', notice: '' });
      launchStudy(loggedIn.user);
    } catch (err) {
      setAuth(a => ({ ...a, busy: false, error: err.message || 'Sign in failed.', notice: '' }));
    }
  }

  function renderRoute(r, ctx) {
    const setStateF = ctx.interactive ? ctx.setState : (() => {});
    const onFinishF = ctx.interactive ? ctx.finishQuiz : (() => {});
    const onExitF = ctx.interactive ? ctx.exitToHome : (() => {});
    const onRestartF = ctx.interactive ? ctx.restartFromResults : (() => {});
    const onStudyF = ctx.interactive ? ctx.launchStudy : (() => {});
    if (r === 'ccna-b-diagrams') {
      const DiagramPage = window.CcnaBDiagramsPage;
      return DiagramPage ? <DiagramPage onExit={onExitF} /> : null;
    }
    if (r === 'home') return <HomePage onLaunch={ctx.interactive ? ctx.launchQuiz : (() => {})} onLaunchStudy={onStudyF} studyDashboard={ctx.studyDashboard} user={ctx.user} />;
    if (r === 'practice' && ctx.state) return <PracticeRunner state={ctx.state} setState={setStateF} onFinish={onFinishF} onExit={onExitF} />;
    if (r === 'quiz' && ctx.state) return <QuizRunner state={ctx.state} setState={setStateF} onFinish={onFinishF} onExit={onExitF} />;
    if (r === 'study' && ctx.state) {
      const Runner = window.StudyRunner;
      return Runner ? <Runner state={ctx.state} setState={setStateF} client={ctx.client} onFinish={onFinishF} onExit={onExitF} /> : null;
    }
    if (r === 'results' && ctx.state?.mode === 'study') {
      const StudyResults = window.StudyResultsPage;
      return StudyResults ? <StudyResults state={ctx.state} onRestart={onRestartF} onExit={onExitF} /> : null;
    }
    if (r === 'results' && ctx.state) return <ResultsPage state={ctx.state} onRestart={onRestartF} onExit={onExitF} />;
    return null;
  }

  return (
    <div className={`app route-${route}`}>
      <div className={`main-area transition-${transitionKind}`}>
        <div className="route-stack">
          {outgoingRoute && outgoingRoute !== route && (
            <div className="route-screen route-exit" key={`out-${outgoingRoute}`}>
              {renderRoute(outgoingRoute, { state, launchQuiz, launchStudy, finishQuiz, exitToHome, restartFromResults, setState, client, user, studyDashboard, interactive: false })}
            </div>
          )}
          <div className="route-screen route-enter" key={`in-${route}`}>
            {renderRoute(route, { state, launchQuiz, launchStudy, finishQuiz, exitToHome, restartFromResults, setState, client, user, studyDashboard, interactive: true })}
          </div>
        </div>
      </div>

      <div className="app-version" aria-hidden="true">v0.1</div>

      <Tweaks tweaks={tweaks} />
      {auth.open && (
        <AuthModal
          busy={auth.busy}
          error={auth.error}
          notice={auth.notice}
          onClose={() => setAuth({ open: false, busy: false, error: '', notice: '' })}
          onSubmit={handleAuthSubmit}
        />
      )}
    </div>
  );
};

const AuthModal = ({ busy, error, notice, onClose, onSubmit }) => {
  const [mode, setMode] = useStateA('login');
  const [email, setEmail] = useStateA('');
  const [password, setPassword] = useStateA('');
  return (
    <div className="auth-backdrop" role="dialog" aria-modal="true" aria-label="Sign in for Study Mode">
      <form className="auth-card" onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ mode, email, password });
      }}>
        <button type="button" className="auth-close" onClick={onClose} aria-label="Close"><Icon name="x" size={14} /></button>
        <div className="auth-icon"><Icon name="target" size={22} /></div>
        <h2>CCNA Study Mode</h2>
        <p>Sign in to save question progress, timing, confidence, and review history.</p>
        <div className="auth-tabs">
          <button type="button" className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Sign in</button>
          <button type="button" className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Create account</button>
        </div>
        <label className="auth-field">
          <span>Email</span>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label className="auth-field">
          <span>Password</span>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} required />
        </label>
        {notice && <div className="auth-note">{notice}</div>}
        {error && <div className="auth-error">{error}</div>}
        <button type="submit" className="auth-submit" disabled={busy}>
          {busy ? 'Working...' : mode === 'login' ? 'Sign in and start' : 'Create and start'}
        </button>
      </form>
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
