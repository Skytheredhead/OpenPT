const { useEffect: useEffectS, useMemo: useMemoS, useRef: useRefS, useState: useStateS } = React;

const STUDY_FAST_MS = 15000;
const STUDY_INTERRUPTED_MS = 120000;

function StudyRunner({ state, setState, client, onFinish, onExit }) {
  const idx = state.cursor || 0;
  const total = state.questionKeys?.length || 0;
  const questionByKey = useMemoS(() => Object.fromEntries((window.QUESTIONS || []).map(q => [q.questionKey, q])), []);
  const q = questionByKey[state.questionKeys?.[idx]];
  const [busy, setBusy] = useStateS(false);
  const [error, setError] = useStateS("");
  const activeKey = q?.questionKey || "";

  useEffectS(() => {
    setState(prev => {
      if (!prev || prev.activeKey === activeKey) return prev;
      return {
        ...prev,
        activeKey,
        activeStartedAt: Date.now(),
        selected: new Set(),
        answered: false,
        lastAttempt: null,
      };
    });
  }, [activeKey]);

  useEffectS(() => {
    if (!q) return;
    setState(prev => {
      const optionOrders = { ...(prev.optionOrders || {}) };
      if (optionOrders[q.questionKey]) return prev;
      optionOrders[q.questionKey] = shuffleStudy(q.options.map((_, i) => i));
      return { ...prev, optionOrders };
    });
  }, [activeKey]);

  function updateSelection(optIdx) {
    if (!q || state.answered || busy) return;
    setState(prev => {
      const selected = new Set(prev.selected || []);
      if (q.multi) {
        if (selected.has(optIdx)) selected.delete(optIdx);
        else if (selected.size < q.answers.length) selected.add(optIdx);
      } else {
        selected.clear();
        selected.add(optIdx);
      }
      return { ...prev, selected };
    });
    if (!q.multi && !q.pairs) {
      setTimeout(() => submitAnswer(new Set([optIdx])), 0);
    }
  }

  function updateMatchup(term, description) {
    if (!q || state.answered || busy) return;
    setState(prev => {
      const nextSelected = new Set(prev.selected || []);
      for (const optIdx of [...nextSelected]) {
        const parsed = parsePairSelection(q, optIdx);
        if (parsed?.term === term || parsed?.description === description) nextSelected.delete(optIdx);
      }
      const selection = makePairSelection(q, term, description);
      if (selection != null) nextSelected.add(selection);
      return { ...prev, selected: nextSelected };
    });
  }

  async function submitAnswer(selectedOverride = null) {
    if (!q || state.answered || busy || !client) return;
    const selected = selectedOverride || new Set(state.selected || []);
    if (selected.size !== q.answers.length) return;
    setBusy(true);
    setError("");
    const duration = Math.max(0, Date.now() - (state.activeStartedAt || Date.now()));
    const correct = sameSet(selected, new Set(q.answers));
    try {
      const result = await client.recordStudyAttempt(state.sessionId, {
        questionKey: q.questionKey,
        selectedAnswers: [...selected],
        correct,
        answerDurationMs: duration,
      });
      setState(prev => {
        const attempts = { ...(prev.attempts || {}), [q.questionKey]: result.attempt };
        return { ...prev, selected, answered: true, attempts, lastAttempt: result.attempt };
      });
    } catch (err) {
      setError(err.message || "Could not save this answer.");
    } finally {
      setBusy(false);
    }
  }

  async function nextOrFinish() {
    if (busy) return;
    if (idx < total - 1) {
      setState(prev => ({ ...prev, cursor: idx + 1, selected: new Set(), answered: false, lastAttempt: null, activeStartedAt: Date.now() }));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const totalQuestions = window.OpenPTQuizBanks?.questionKeysForBanks
        ? window.OpenPTQuizBanks.questionKeysForBanks(window.QUESTIONS || [], state.bankKeys || ["ccna/all"]).length
        : window.QUESTIONS.filter(q => q.bank?.startsWith("ccna/")).length;
      const report = await client.finishStudySession(state.sessionId, totalQuestions);
      setState(prev => ({ ...prev, endedAt: Date.now(), report }));
      onFinish();
    } catch (err) {
      setError(err.message || "Could not finish this session.");
    } finally {
      setBusy(false);
    }
  }

  useEffectS(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (!q || busy) return;
      if (!state.answered) {
        const order = (state.optionOrders || {})[q.questionKey] || q.options.map((_, i) => i);
        const n = parseInt(e.key, 10);
        if (!q.pairs && !isNaN(n) && n >= 1 && n <= order.length) updateSelection(order[n - 1]);
        if ((q.multi || q.pairs) && e.key === 'Enter') submitAnswer();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        nextOrFinish();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [q, state, busy]);

  if (!q) return <div className="run-loading">loading study session...</div>;

  const selected = new Set(state.selected || []);
  const correctSet = new Set(q.answers);
  const order = (state.optionOrders || {})[q.questionKey] || q.options.map((_, i) => i);
  const progress = total ? (idx + 1) / total : 0;
  const attempt = state.lastAttempt || state.attempts?.[q.questionKey] || null;
  const answered = !!state.answered;
  const correct = answered && sameSet(selected, correctSet);
  const slow = !!attempt?.slow;
  const feedback = feedbackForStudyAttempt({ correct, slow, attempt });

  return (
    <div className="run-shell footer-bar study-runner">
      <div className="run-stage">
        <div className="qcard qcard-enter">
          <div className="qcard-meta">
            <span>CCNA Study Mode / question {idx + 1} of {total}</span>
            {attempt?.wasReview && <span className="tag repeat">review x{attempt.reviewStreakAfter || 0}/4</span>}
            {!answered && <StudyTimer startedAt={state.activeStartedAt} />}
          </div>

          <h2 className="qcard-text">{q.question}</h2>
          <QuestionExhibit q={q} />

          <AnswerTransition transitionKey={`study-${q.questionKey}-${q.pairs ? 'pairs' : 'opts'}`}>
            {q.pairs ? (
              <MatchupQuestion q={q} selected={selected} answered={answered} onChange={updateMatchup} />
            ) : (
              <div className="opts" key={`study-opts-${q.questionKey}`}>
                {order.map((optIdx, displayIdx) => {
                  const isCorr = correctSet.has(optIdx);
                  const isSel = selected.has(optIdx);
                  let cls = 'opt';
                  if (answered) {
                    if (isCorr) cls += ' correct flash';
                    else if (isSel) cls += ' incorrect flash';
                  } else if (isSel) cls += ' selected';
                  return (
                    <button key={optIdx} type="button" disabled={answered || busy} className={cls} onClick={() => updateSelection(optIdx)}>
                      <div className="marker">{String.fromCharCode(65 + displayIdx)}</div>
                      <div className="text">{q.options[optIdx]}</div>
                      <div className="hk">{displayIdx + 1}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </AnswerTransition>

          {answered && (
            <div className={`feedback ${feedback.kind}`}>
              <div className="label">{feedback.label}</div>
              <div className="msg">{feedback.message}</div>
            </div>
          )}
          {error && <div className="feedback bad"><div className="label">SAVE</div><div className="msg">{error}</div></div>}

          <div className="qaction-row">
            {!answered && (q.multi || q.pairs) && (
              <button type="button" className="qaction primary" disabled={selected.size !== q.answers.length || busy} onClick={() => submitAnswer()}>
                {busy ? 'Saving...' : 'Submit answer'}
              </button>
            )}
            {answered && (
              <button type="button" className="qaction primary" disabled={busy} onClick={nextOrFinish}>
                {idx >= total - 1 ? 'See study report' : 'Next question'}
                <Icon name="arrow-right" size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="run-footer-floor">
        <div className="run-floor-bar">
          <div className="fill" style={{ width: (progress * 100) + '%' }} />
        </div>
        <div className="run-floor-left">
          <button type="button" className="footer-exit" onClick={onExit}>
            <Icon name="x" size={13} /> Exit
          </button>
          <div className="run-pill"><Icon name="clock" size={11} /> fast goal {Math.round(STUDY_FAST_MS / 1000)}s</div>
        </div>
        <div className="run-floor-right">
          <div className="run-counter">{idx + 1}/{total}</div>
        </div>
      </div>
    </div>
  );
}

function StudyResultsPage({ state, onRestart, onExit }) {
  const session = state.report?.session || {};
  const dashboard = state.report?.dashboard || state.dashboard || {};
  const score = session.score ?? 0;
  const confidence = dashboard.confidenceScore ?? 0;
  const weakest = dashboard.weakest || [];
  const byKey = Object.fromEntries((window.QUESTIONS || []).map(q => [q.questionKey, q]));

  return (
    <div className="results study-results qrunner-enter">
      <div className="results-kicker">~/quiz.openpt/study/session-{state.sessionId || 'complete'}</div>
      <div className="score-head">
        <div className="score-ring">
          <svg viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="80" className="track" />
            <circle cx="100" cy="100" r="80" className="meter"
              strokeDasharray={`${(2 * Math.PI * 80) * (score / 100)} ${(2 * Math.PI * 80) * (1 - score / 100)}`}
              style={{ stroke: score >= 80 ? 'var(--accent)' : score >= 65 ? 'var(--warn)' : 'var(--err)' }} />
          </svg>
          <div className="pct"><div className="num">{score}%</div><div className="lbl">study score</div></div>
        </div>
        <div className="score-meta">
          <div className={`verdict-tag ${confidence >= 75 ? 'ok' : confidence >= 55 ? 'warn' : 'err'}`}>confidence - {confidence}%</div>
          <h1>{confidence >= 75 ? 'Getting automatic' : confidence >= 55 ? 'Building signal' : 'Needs another pass'}</h1>
          <p>Fast correct answers raise confidence. Misses and slow answers stay in review. Multi-minute pauses are ignored for scoring and timing, then checked again later.</p>
          <div className="actions">
            <button className="run-btn" onClick={onRestart}><Icon name="rotate" size={14} /> Next study session</button>
            <button className="run-btn ghost" onClick={onExit}><Icon name="home" size={14} /> Back to library</button>
          </div>
        </div>
      </div>

      <StudyDashboard dashboard={dashboard} session={session} />

      <div className="missed-section">
        <h3>Questions still in review <span className="ct">{weakest.length}</span></h3>
        {weakest.length === 0 ? (
          <div className="study-empty">No active weak questions. That is the good kind of quiet.</div>
        ) : (
          <div className="missed-list">
            {weakest.map(item => {
              const q = byKey[item.questionKey];
              return (
                <div className="missed-item" key={item.questionKey}>
                  <div className="ct">x{item.reviewStreak}<small>/4 fast</small></div>
                  <div className="qt">
                    <span className="src">{q?.source || 'CCNA'} - miss {item.missCount}, slow {item.slowCount}, paused {item.interruptedCount || 0}</span>
                    {q?.question || item.questionKey}
                  </div>
                  <div className="tag">{formatMs(item.avgAnswerMs || 0)}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StudyDashboard({ dashboard = {}, session = {} }) {
  const seenPct = dashboard.totalQuestionCount ? Math.round((dashboard.seenCount / dashboard.totalQuestionCount) * 100) : 0;
  return (
    <div className="study-dashboard">
      <div className="stat-cell"><div className="v">{dashboard.seenCount || 0}</div><div className="k">questions seen</div></div>
      <div className="stat-cell"><div className="v">{seenPct}%</div><div className="k">pool progression</div></div>
      <div className="stat-cell"><div className="v">{dashboard.recentScore ?? session.score ?? '-'}%</div><div className="k">most recent score</div></div>
      <div className="stat-cell"><div className="v">{dashboard.averageScore ?? '-'}%</div><div className="k">average score</div></div>
      <div className="stat-cell"><div className="v">{formatMs(dashboard.averageAnswerMs || session.avgAnswerMs || 0)}</div><div className="k">average timing</div></div>
      <div className="stat-cell"><div className="v">{dashboard.activeWeakCount || 0}</div><div className="k">active reviews</div></div>
      <div className="stat-cell"><div className="v">{dashboard.slowCount || 0}</div><div className="k">slow answers</div></div>
      <div className="stat-cell"><div className="v">{dashboard.interruptedCount || session.interruptedCount || 0}</div><div className="k">interrupted</div></div>
      <div className="stat-cell"><div className="v">{dashboard.masteredCount || 0}</div><div className="k">review mastered</div></div>
    </div>
  );
}

function StudyTimer({ startedAt }) {
  const [now, setNow] = useStateS(Date.now());
  useEffectS(() => {
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, []);
  const elapsed = Math.max(0, now - (startedAt || now));
  const state = elapsed > STUDY_INTERRUPTED_MS ? 'interrupted' : elapsed > STUDY_FAST_MS ? 'slow' : '';
  return <span className={`tag study-timer ${state}`}>{formatMs(elapsed)}</span>;
}

function feedbackForStudyAttempt({ correct, slow, attempt }) {
  if (attempt?.interrupted) {
    return { kind: 'pause', label: 'PAUSED', message: `That took ${formatMs(attempt?.answerDurationMs || 0)}, so it is not counted for score or timing. It will come back later as a clean check.` };
  }
  if (correct && slow) {
    return { kind: 'warn', label: 'SLOW', message: `Correct, but ${formatMs(attempt?.answerDurationMs || 0)} is not automatic yet. This one will come back.` };
  }
  if (correct) {
    const streak = attempt?.wasReview ? ` Fast review ${attempt.reviewStreakAfter}/4.` : '';
    return { kind: 'good', label: 'PASS', message: `Fast enough.${streak}` };
  }
  return { kind: 'bad', label: 'MISS', message: 'Review the highlighted answer. This one stays in rotation.' };
}

function formatMs(ms) {
  const value = Number(ms || 0);
  if (!value) return '0s';
  if (value < 1000) return `${value}ms`;
  if (value >= 60000) {
    const minutes = Math.floor(value / 60000);
    const seconds = Math.round((value % 60000) / 1000);
    return seconds ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}s`;
}

function shuffleStudy(values) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

window.StudyRunner = StudyRunner;
window.StudyResultsPage = StudyResultsPage;
window.StudyDashboard = StudyDashboard;
