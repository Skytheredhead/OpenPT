// Two runner experiences:
//   - PracticeRunner: spaced repetition + immediate feedback (no rail)
//   - QuizRunner:     linear test, no per-question feedback, submit at end

const { useState: useStateR, useEffect: useEffectR, useRef: useRefR, useMemo: useMemoR } = React;

// ────────────────────────────────────────────────────────────
// PracticeRunner — immediate feedback, spaced repetition
// ────────────────────────────────────────────────────────────

const correctMessages = [
  'Locked in. Onward.',
  'Clean. That one is done.',
  'Right answer, on the rails.',
  'Got it. Keep rolling.',
  'Yep. Streak +1.',
];
const wrongMessages = [
  'Take another look at the highlighted answer.',
  'Compare your pick with the highlighted answer.',
  'The correct answer is highlighted above.',
  'Review the highlighted answer before moving on.',
];

const PRAISE_MESSAGES = [
  'Good job!', 'Nailed it!', 'Locked in.', 'Beautiful.', 'Clean.',
  'Yes!', 'Perfect.', 'Right on.', 'Got it.', 'Sharp.',
  'Magnifico.', 'On rails.', 'Easy.', 'Boom.',
];

const ANSWER_EXIT_MS = 240;
const LAB_PROGRESS_KEY = 'openpt.quiz.labProgress.v1';

function readLabProgress(key) {
  if (!key) return null;
  try {
    const data = JSON.parse(localStorage.getItem(LAB_PROGRESS_KEY) || '{}');
    return data[key] || null;
  } catch (e) {
    return null;
  }
}

function writeLabProgress(progress) {
  if (!progress?.labId) return;
  try {
    const data = JSON.parse(localStorage.getItem(LAB_PROGRESS_KEY) || '{}');
    data[progress.labId] = progress;
    if (progress.questionKey) data[progress.questionKey] = progress;
    localStorage.setItem(LAB_PROGRESS_KEY, JSON.stringify(data));
  } catch (e) {
    /* ignore */
  }
}

function isLabComplete(progress) {
  return Number(progress?.percent || 0) >= 100;
}

const AnswerTransition = ({ transitionKey, children }) => {
  const [layers, setLayers] = useStateR([{ key: transitionKey, phase: 'current', children }]);
  const previousKeyRef = useRefR(transitionKey);
  const cleanupTimerRef = useRefR(null);

  useEffectR(() => {
    if (previousKeyRef.current === transitionKey) return;
    previousKeyRef.current = transitionKey;

    if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
    setLayers(prev => [
      ...prev.map(layer => ({ ...layer, phase: 'exit' })),
      { key: transitionKey, phase: 'enter', children },
    ]);
    cleanupTimerRef.current = setTimeout(() => {
      setLayers(prev => prev.filter(layer => layer.phase !== 'exit'));
      cleanupTimerRef.current = null;
    }, ANSWER_EXIT_MS + 80);
  }, [transitionKey]);

  useEffectR(() => () => {
    if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
  }, []);

  const visibleLayers = layers.map(layer => (
    layer.key === transitionKey && layer.phase !== 'exit'
      ? { ...layer, children }
      : layer
  ));

  return (
    <div className="answer-transition">
      {visibleLayers.map(layer => (
        <div
          key={layer.key}
          className={`answer-transition-layer ${layer.phase}`}
          aria-hidden={layer.phase === 'exit' ? 'true' : undefined}>
          {layer.children}
        </div>
      ))}
    </div>
  );
};

const PracticeRunner = ({ state, setState, onFinish, onExit }) => {
  const q = state.activeId == null ? null : window.QUESTIONS[state.activeId];
  const [celebration, setCelebration] = useStateR(null); // null | { msg, phase: 'enter'|'leave' }
  const celebTimersRef = useRefR([]);

  function clearCelebTimers() {
    celebTimersRef.current.forEach(clearTimeout);
    celebTimersRef.current = [];
  }
  useEffectR(() => () => clearCelebTimers(), []);

  useEffectR(() => {
    if (state.activeId == null && state.mastered.size < state.quizIds.length) {
      setState(QuizEngine.advance(state));
    }
  }, []);

  function celebrate(stateAfterGrade) {
    const msg = PRAISE_MESSAGES[Math.floor(Math.random() * PRAISE_MESSAGES.length)];
    setCelebration({ msg, phase: 'enter' });
    clearCelebTimers();
    const allDone = stateAfterGrade.mastered.size >= stateAfterGrade.quizIds.length;
    // At ~580ms the card is centered → swap the question behind it
    const t1 = setTimeout(() => {
      if (allDone) onFinish();
      else setState(s => QuizEngine.advance(s));
    }, 600);
    // At ~950ms the card starts to leave
    const t2 = setTimeout(() => {
      setCelebration(c => c ? { ...c, phase: 'leave' } : null);
    }, 1050);
    // At ~1400ms the card unmounts
    const t3 = setTimeout(() => setCelebration(null), 1500);
    celebTimersRef.current = [t1, t2, t3];
  }

  function handleOption(optIdx) {
    if (!q || state.answered || celebration) return;
    const next = QuizEngine.toggle(state, optIdx);
    if (!q.multi) {
      const graded = QuizEngine.grade(next);
      setState(graded);
      const correctSet = new Set(q.answers);
      if (sameSet(next.selected, correctSet)) celebrate(graded);
    } else {
      setState(next);
    }
  }
  function submitMulti() {
    if (!q || state.answered || state.selected.size !== q.answers.length || celebration) return;
    const graded = QuizEngine.grade(state);
    setState(graded);
    const correctSet = new Set(q.answers);
    if (sameSet(state.selected, correctSet)) celebrate(graded);
  }
  function nextOrFinish() {
    if (celebration) return;
    if (state.mastered.size >= state.quizIds.length) { onFinish(); return; }
    setState(QuizEngine.advance(state));
  }

  function submitLab(progress) {
    if (!q || !q.hasLab || state.answered || celebration) return;
    const complete = isLabComplete(progress);
    const next = { ...state, selected: new Set(complete ? q.answers : []) };
    const graded = QuizEngine.grade(next);
    setState(graded);
    if (complete) celebrate(graded);
  }

  function updateMatchup(term, description) {
    if (!q || state.answered || celebration) return;
    setState(prev => {
      const nextSelected = new Set(prev.selected);
      for (const optIdx of [...nextSelected]) {
        const parsed = parsePairSelection(q, optIdx);
        if (parsed?.term === term || parsed?.description === description) nextSelected.delete(optIdx);
      }
      const selection = makePairSelection(q, term, description);
      if (selection != null) nextSelected.add(selection);
      return { ...prev, selected: nextSelected };
    });
  }

  // Hotkeys
  useEffectR(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (!q) return;
      if (!state.answered) {
        const idx = parseInt(e.key, 10);
        if (!q.pairs && !isNaN(idx) && idx >= 1 && idx <= state.optionOrder.length) {
          handleOption(state.optionOrder[idx - 1]);
          return;
        }
        if (q.multi && e.key === 'Enter') submitMulti();
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault(); nextOrFinish();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, q]);

  if (!q) return <div className="run-loading">loading question…</div>;

  const correctSet = new Set(q.answers);
  const attemptCount = state.attemptsById[state.activeId] || 0;
  const isRepeat = attemptCount > 0 && !state.answered;
  const isCorrect = state.answered && sameSet(state.selected, correctSet);
  const currentPosition = Math.min(
    state.mastered.size + (state.mastered.has(state.activeId) ? 0 : 1),
    state.quizIds.length
  );
  const progress = state.quizIds.length ? currentPosition / state.quizIds.length : 0;

  let feedbackClass = '', feedbackLabel = '', feedbackMsg = '';
  if (state.answered) {
    if (isCorrect) {
      feedbackClass = 'good'; feedbackLabel = 'PASS';
      feedbackMsg = rand(correctMessages);
    } else {
      feedbackClass = 'bad'; feedbackLabel = 'MISS';
      feedbackMsg = rand(wrongMessages);
    }
  }

  return (
    <div className="run-shell footer-bar">
      <div className="run-stage">
        <div className="qcard qcard-enter">
          <div className="qcard-meta">
            <span>{q.semesterLabel} / {q.examLabel} / question {currentPosition} of {state.quizIds.length}</span>
            {attemptCount > 0 && !state.answered && <span className="tag repeat">repeat ×{attemptCount}</span>}
          </div>

          <h2 className="qcard-text">{q.question}</h2>

          {!q.hasLab && <QuestionExhibit q={q} />}

          <AnswerTransition transitionKey={`practice-${state.activeId}-${q.hasLab ? 'lab' : q.pairs ? 'pairs' : 'opts'}`}>
            {q.hasLab ? (
              <LabQuestionPanel
                q={q}
                mode="practice"
                answered={state.answered}
                onSubmit={submitLab}
              />
            ) : q.pairs ? (
              <MatchupQuestion
                q={q}
                selected={state.selected}
                answered={state.answered}
                onChange={updateMatchup}
              />
            ) : (
              <div className="opts" key={`p-opts-${state.activeId}`}>
                {state.optionOrder.map((optIdx, displayIdx) => {
                  const isCorr = correctSet.has(optIdx);
                  const isSel = state.selected.has(optIdx);
                  let cls = 'opt';
                  if (state.answered) {
                    if (isCorr) cls += ' correct flash';
                    else if (isSel) cls += ' incorrect flash';
                  } else if (isSel) cls += ' selected';
                  return (
                    <button
                      key={optIdx} type="button" disabled={state.answered}
                      className={cls} onClick={() => handleOption(optIdx)}>
                      <div className="marker">{String.fromCharCode(65 + displayIdx)}</div>
                      <div className="text">{q.options[optIdx]}</div>
                      <div className="hk">{displayIdx + 1}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </AnswerTransition>

          {state.answered && !isCorrect && (
            <div className={`feedback ${feedbackClass}`}>
              <div className="label">{feedbackLabel}</div>
              <div className="msg">{feedbackMsg}</div>
            </div>
          )}

          {state.answered && q.explanation && (
            <QuestionExplanation q={q} />
          )}

          <div className="qaction-row">
            {!state.answered && q.multi && !q.hasLab && (
              <button
                type="button"
                className="qaction primary"
                disabled={state.selected.size !== q.answers.length}
                onClick={submitMulti}>
                Submit answer
              </button>
            )}
            {state.answered && !isCorrect && (
              <button type="button" className="qaction primary" onClick={nextOrFinish}>
                {state.mastered.size >= state.quizIds.length ? 'See results' : 'Next question'}
                <Icon name="arrow-right" size={14} />
              </button>
            )}
          </div>
        </div>

        {celebration && (
          <div className="celebrate-block" aria-hidden="true" />
        )}
      </div>

      <div className="run-footer-floor">
        <div className="run-floor-bar" title={`Question ${currentPosition} of ${state.quizIds.length}`}>
          <div className={`fill ${progress >= 1 ? 'done' : ''}`} style={{ width: (progress * 100) + '%' }} />
        </div>
        <div className="run-floor-left">
          <button type="button" className="footer-exit" onClick={onExit}>
            <Icon name="x" size={13} /> Exit
          </button>
          {isRepeat && <div className="run-pill repeat"><Icon name="rotate" size={11} /> repeat ×{attemptCount}</div>}
        </div>
        <div className="run-floor-right">
          <div className="run-counter">{currentPosition}/{state.quizIds.length}</div>
        </div>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────
// QuizRunner — linear test, no per-question feedback, submit at end
// ────────────────────────────────────────────────────────────

const QuizRunner = ({ state, setState, onFinish, onExit }) => {
  const idx = state.cursor || 0;
  const total = state.quizIds.length;
  const qid = state.quizIds[idx];
  const q = window.QUESTIONS[qid];

  // Save answer for this question
  function selectOption(optIdx) {
    setState(prev => {
      const answers = { ...(prev.answers || {}) };
      const current = new Set(answers[qid] || []);
      if (q.multi) {
        if (current.has(optIdx)) current.delete(optIdx);
        else if (current.size < q.answers.length) current.add(optIdx);
      } else {
        current.clear(); current.add(optIdx);
      }
      answers[qid] = [...current];
      return { ...prev, answers };
    });
  }

  function selectMatchup(term, description) {
    setState(prev => {
      const answers = { ...(prev.answers || {}) };
      const current = new Set(answers[qid] || []);
      for (const optIdx of [...current]) {
        const parsed = parsePairSelection(q, optIdx);
        if (parsed?.term === term || parsed?.description === description) current.delete(optIdx);
      }
      const selection = makePairSelection(q, term, description);
      if (selection != null) current.add(selection);
      answers[qid] = [...current];
      return { ...prev, answers };
    });
  }

  function saveLabAttempt(progress) {
    setState(prev => {
      const attempts = { ...(prev.labAttempts || {}) };
      attempts[qid] = progress || { labId: q.lab?.id, questionKey: q.questionKey, percent: 0, correct: 0, total: 0, updatedAt: Date.now() };
      const answers = { ...(prev.answers || {}) };
      answers[qid] = isLabComplete(attempts[qid]) ? [...q.answers] : [];
      return { ...prev, labAttempts: attempts, answers };
    });
  }

  function jumpTo(i) {
    if (i < 0 || i >= total) return;
    setState(prev => ({ ...prev, cursor: i }));
  }
  function nextQ() {
    if (idx < total - 1) jumpTo(idx + 1);
  }
  function prevQ() {
    if (idx > 0) jumpTo(idx - 1);
  }
  function submit() {
    // Grade everything at once
    setState(prev => {
      const answers = prev.answers || {};
      let correct = 0;
      const history = [];
      const firstTryMastered = new Set();
      const mastered = new Set();
      for (const id of prev.quizIds) {
        const question = window.QUESTIONS[id];
        const labAttempt = prev.labAttempts?.[id] || null;
        const ans = new Set(answers[id] || []);
        const corr = new Set(question.answers);
        const isCorrect = question.hasLab ? isLabComplete(labAttempt) : sameSetLocal(ans, corr);
        if (isCorrect) { correct++; firstTryMastered.add(id); mastered.add(id); }
        history.push({ id, correct: isCorrect, ts: Date.now() });
      }
      return {
        ...prev,
        answered: true,
        endedAt: Date.now(),
        correctAttempts: correct,
        totalAttempts: prev.quizIds.length,
        wrongAttempts: prev.quizIds.length - correct,
        firstTryMastered,
        mastered,
        history,
      };
    });
    onFinish();
  }

  const answers = state.answers || {};
  const currentSel = new Set(answers[qid] || []);
  const isCompleteAnswer = id => {
    const question = window.QUESTIONS[id];
    if (question.hasLab) return !!(state.labAttempts || {})[id];
    return (answers[id] || []).length === question.answers.length;
  };
  const answeredCount = state.quizIds.filter(isCompleteAnswer).length;
  const canSubmit = answeredCount === total;

  // Stable display order for options (set once per question)
  const optionOrders = state.optionOrders || {};
  let order = optionOrders[qid];
  useEffectR(() => {
    if (!order) {
      const shuffled = q.options.map((_, i) => i);
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      setState(prev => ({
        ...prev,
        optionOrders: { ...(prev.optionOrders || {}), [qid]: shuffled },
      }));
    }
  }, [qid]);
  if (!order) order = q.options.map((_, i) => i);

  // Hotkeys: 1-6 select, Enter / → next, ← prev
  useEffectR(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      const n = parseInt(e.key, 10);
      if (!q.pairs && !isNaN(n) && n >= 1 && n <= order.length) { selectOption(order[n - 1]); return; }
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        if (idx === total - 1) {
          if (canSubmit) submit();
        } else nextQ();
      } else if (e.key === 'ArrowLeft') {
        prevQ();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [idx, qid, order, answeredCount]);

  const positionCount = idx + 1;
  const progress = total ? positionCount / total : 0;
  const isLast = idx === total - 1;

  return (
    <div className="run-shell footer-bar">
      <div className="run-stage">
        <div className="qcard qcard-enter">
          <div className="qcard-meta">
            <span>{q.semesterLabel} / {q.examLabel} / question {idx + 1} of {total}</span>
          </div>

          <h2 className="qcard-text">{q.question}</h2>

          {!q.hasLab && <QuestionExhibit q={q} />}

          <AnswerTransition transitionKey={`quiz-${qid}-${q.hasLab ? 'lab' : q.pairs ? 'pairs' : 'opts'}`}>
            {q.hasLab ? (
              <LabQuestionPanel
                q={q}
                mode="quiz"
                progress={(state.labAttempts || {})[qid] || null}
                onSubmit={saveLabAttempt}
              />
            ) : q.pairs ? (
              <MatchupQuestion
                q={q}
                selected={currentSel}
                answered={false}
                onChange={selectMatchup}
              />
            ) : (
              <div className="opts" key={`q-opts-${qid}`}>
                {order.map((optIdx, displayIdx) => {
                  const isSel = currentSel.has(optIdx);
                  return (
                    <button
                      key={optIdx} type="button"
                      className={`opt ${isSel ? 'selected' : ''}`}
                      onClick={() => selectOption(optIdx)}>
                      <div className="marker">{String.fromCharCode(65 + displayIdx)}</div>
                      <div className="text">{q.options[optIdx]}</div>
                      <div className="hk">{displayIdx + 1}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </AnswerTransition>

          <div className="qaction-row linear-nav">
            <button
              type="button" className="qaction ghost"
              disabled={idx === 0}
              onClick={prevQ}>
              <Icon name="arrow-left" size={14} />
              Previous
            </button>
            {!isLast && (
              <button type="button" className="qaction primary" onClick={nextQ}>
                Next question
                <Icon name="arrow-right" size={14} />
              </button>
            )}
            {isLast && (
              <button
                type="button"
                className={`qaction primary submit ${canSubmit ? '' : 'incomplete'}`}
                disabled={!canSubmit}
                onClick={submit}>
                Submit quiz
                <Icon name="check" size={14} />
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
        </div>
        <div className="run-floor-right">
          <div className="run-counter">{positionCount}/{total}</div>
        </div>
      </div>
    </div>
  );
};

// ────────────────────────────────────────────────────────────
// Shared bits
// ────────────────────────────────────────────────────────────

const QuestionExhibit = ({ q }) => {
  const blocks = [];
  if (q.exhibit?.type === 'topology') blocks.push(<TopologyExhibit key="topology" exhibit={q.exhibit} />);
  if (q.code?.length) blocks.push(<CodeExhibit key="code" lines={q.code} />);
  if (blocks.length) return <div className="q-exhibit-stack">{blocks}</div>;
  if (!q.hasExhibit) return null;
  return (
    <div className="qstage-exhibit">
      <div className="glyph"><Icon name="image" size={22} /></div>
      <div className="label">
        <b>Exhibit attached · {q.exhibitCount} image{q.exhibitCount > 1 ? 's' : ''}</b>
        This imported item still needs a structured exhibit.
      </div>
    </div>
  );
};

const LabQuestionPanel = ({ q, mode, answered = false, progress = null, onSubmit }) => {
  const [open, setOpen] = useStateR(false);
  const [current, setCurrent] = useStateR(() => progress || readLabProgress(q.questionKey) || readLabProgress(q.lab?.id));
  const labId = q.lab?.id;
  const percent = Math.round(Number(current?.percent || 0));
  const complete = isLabComplete(current);
  const attempted = !!current;
  const launchUrl = `/lab?lab=${encodeURIComponent(labId || '')}&embed=quiz&returnToQuiz=${encodeURIComponent(q.questionKey || '')}`;

  useEffectR(() => {
    const saved = progress || readLabProgress(q.questionKey) || readLabProgress(labId);
    setCurrent(saved || null);
  }, [q.id, q.questionKey, labId, progress?.updatedAt]);

  useEffectR(() => {
    const onMessage = (event) => {
      if (event.origin !== location.origin || event.data?.type !== 'openpt:lab-progress') return;
      if (event.data.labId !== labId && event.data.questionKey !== q.questionKey) return;
      const next = { ...event.data, questionKey: q.questionKey, labId };
      writeLabProgress(next);
      setCurrent(next);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [q.questionKey, labId]);

  function launchLab() {
    if (window.matchMedia?.('(max-width: 760px)').matches) {
      window.location.href = launchUrl;
      return;
    }
    setOpen(true);
  }

  function closeLab() {
    const saved = readLabProgress(q.questionKey) || readLabProgress(labId);
    if (saved) setCurrent(saved);
    setOpen(false);
  }

  function submit() {
    const payload = current || { labId, questionKey: q.questionKey, percent: 0, correct: 0, total: 0, updatedAt: Date.now() };
    writeLabProgress(payload);
    onSubmit?.(payload);
  }

  return (
    <div className="lab-question-panel">
      <div className="lab-question-head">
        <div>
          <div className="lab-question-kicker">OpenPT Lab</div>
          <h3>{q.lab?.title || 'OpenPT lab'}</h3>
        </div>
        {q.lab?.estimatedMinutes && <span className="lab-question-time">{q.lab.estimatedMinutes} min</span>}
      </div>
      {q.exhibit?.type === 'topology' && <div className="q-exhibit-stack"><TopologyExhibit exhibit={q.exhibit} /></div>}
      <div className={`lab-progress ${complete ? 'complete' : attempted ? 'attempted' : ''}`}>
        <div className="lab-progress-bar"><span style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} /></div>
        <div className="lab-progress-meta">
          <strong>{complete ? 'Complete' : attempted ? 'Needs work' : 'Not started'}</strong>
          <span>{attempted ? `${current.correct || 0}/${current.total || 0} checks · ${percent}%` : 'Launch the simulator to complete this item.'}</span>
        </div>
      </div>
      <div className="lab-actions">
        <button type="button" className="qaction primary" onClick={launchLab} disabled={!labId || answered}>
          {attempted ? 'Continue lab' : 'Start lab'}
          <Icon name="arrow-right" size={14} />
        </button>
        <button type="button" className={`qaction ${complete ? 'primary' : 'ghost'}`} onClick={submit} disabled={answered || (mode === 'quiz' && !attempted)}>
          {mode === 'quiz' ? 'Save lab attempt' : 'Submit lab'}
          <Icon name="check" size={14} />
        </button>
      </div>
      {open && (
        <div className="lab-embed-shell" role="dialog" aria-modal="true" aria-label={`${q.lab?.title || 'OpenPT lab'} simulator`}>
          <div className="lab-embed-topbar">
            <div>
              <strong>{q.lab?.title || 'OpenPT lab'}</strong>
              <span>{attempted ? `${percent}% complete` : 'Configure the lab, then return to quiz.'}</span>
            </div>
            <button type="button" className="qaction primary" onClick={closeLab}>
              Back to quiz
              <Icon name="arrow-left" size={14} />
            </button>
          </div>
          <iframe className="lab-embed-frame" src={launchUrl} title={`${q.lab?.title || 'OpenPT lab'} simulator`} />
        </div>
      )}
    </div>
  );
};

const QuestionExplanation = ({ q }) => {
  if (!q.explanation) return null;
  return (
    <div className="q-explanation">
      <div className="q-explanation-label">Explanation</div>
      <p>{q.explanation}</p>
    </div>
  );
};

const MATCH_COLORS = [
  'var(--accent)',
  'var(--ok)',
  'var(--warn)',
  'var(--magenta)',
  'var(--violet)',
  'var(--err)',
];

const MatchupQuestion = ({ q, selected, answered, onChange }) => {
  const choices = useMemoR(() => shuffleMatchChoices(getMatchChoices(q)), [q.id]);
  const terms = (q.pairs || []).map(([term]) => term);
  const selectedByTerm = selectedDescriptionsByTerm(q, selected);
  const correctByTerm = Object.fromEntries((q.pairs || []).map(([term, description]) => [term, description]));
  const termByChoice = Object.fromEntries(Object.entries(selectedByTerm).map(([term, description]) => [description, term]));
  const [active, setActive] = useStateR(null);
  const [lines, setLines] = useStateR([]);
  const wrapRef = useRefR(null);
  const termRefs = useRefR({});
  const choiceRefs = useRefR({});
  const selectedKey = terms.map(term => `${term}:${selectedByTerm[term] || ''}`).join('|');
  const choicesKey = choices.join('|');

  function connect(term, description) {
    if (!term || !description) return;
    onChange(term, description);
    setActive(null);
  }

  function handleTermClick(term) {
    if (answered) return;
    if (active?.side === 'choice') {
      connect(term, active.value);
      return;
    }
    setActive(active?.side === 'term' && active.value === term ? null : { side: 'term', value: term });
  }

  function handleChoiceClick(choice) {
    if (answered) return;
    if (active?.side === 'term') {
      connect(active.value, choice);
      return;
    }
    setActive(active?.side === 'choice' && active.value === choice ? null : { side: 'choice', value: choice });
  }

  function clearTerm(term, event) {
    event.stopPropagation();
    if (!answered) onChange(term, '');
  }

  function measureLines() {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const box = wrap.getBoundingClientRect();
    const nextLines = terms.flatMap((term, idx) => {
      const choice = selectedByTerm[term];
      const termNode = termRefs.current[term];
      const choiceNode = choice ? choiceRefs.current[choice] : null;
      if (!choice || !termNode || !choiceNode) return [];
      const a = termNode.getBoundingClientRect();
      const b = choiceNode.getBoundingClientRect();
      const x1 = a.right - box.left;
      const y1 = a.top + a.height / 2 - box.top;
      const x2 = b.left - box.left;
      const y2 = b.top + b.height / 2 - box.top;
      const dx = Math.max(42, Math.abs(x2 - x1) * 0.45);
      return [{
        key: `${term}-${choice}`,
        color: MATCH_COLORS[idx % MATCH_COLORS.length],
        path: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`,
        x1, y1, x2, y2,
      }];
    });
    setLines(nextLines);
  }

  React.useLayoutEffect(() => {
    const frame = requestAnimationFrame(measureLines);
    return () => cancelAnimationFrame(frame);
  }, [q.id, selectedKey, choicesKey]);

  useEffectR(() => {
    const onResize = () => requestAnimationFrame(measureLines);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [q.id, selectedKey, choicesKey]);

  return (
    <div className="matchup" key={`matchup-${q.id}`} ref={wrapRef}>
      <svg className="match-lines" aria-hidden="true">
        {lines.map(line => (
          <g key={line.key}>
            <path d={line.path} style={{ stroke: line.color }} />
            <circle cx={line.x1} cy={line.y1} r="3.5" style={{ fill: line.color }} />
            <circle cx={line.x2} cy={line.y2} r="3.5" style={{ fill: line.color }} />
          </g>
        ))}
      </svg>

      <div className="match-columns">
        <div className="match-column">
          {terms.map((term, idx) => {
            const value = selectedByTerm[term] || '';
            const isActive = active?.side === 'term' && active.value === term;
            const status = answered && value
              ? (value === correctByTerm[term] ? 'correct' : 'incorrect')
              : '';
            return (
              <button
                type="button"
                key={term}
                ref={node => { termRefs.current[term] = node; }}
                className={[
                  'match-node',
                  'term',
                  isActive ? 'active' : '',
                  value ? 'connected' : '',
                  status,
                ].filter(Boolean).join(' ')}
                disabled={answered}
                onClick={() => handleTermClick(term)}>
                <span className="match-marker">{idx + 1}</span>
                <span className="match-label">{term}</span>
                {value && !answered && (
                  <span className="match-clear" onClick={event => clearTerm(term, event)} aria-label="Clear match">x</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="match-column">
          {choices.map((choice, idx) => {
            const term = termByChoice[choice];
            const isActive = active?.side === 'choice' && active.value === choice;
            const status = answered && term
              ? (correctByTerm[term] === choice ? 'correct' : 'incorrect')
              : '';
            return (
              <button
                type="button"
                key={choice}
                ref={node => { choiceRefs.current[choice] = node; }}
                className={[
                  'match-node',
                  'choice',
                  isActive ? 'active' : '',
                  term ? 'connected' : '',
                  status,
                ].filter(Boolean).join(' ')}
                disabled={answered}
                onClick={() => handleChoiceClick(choice)}>
                <span className="match-marker">{String.fromCharCode(65 + idx)}</span>
                <span className="match-label">{choice}</span>
              </button>
            );
          })}
        </div>
      </div>

      {answered && Object.entries(selectedByTerm).some(([term, value]) => value && value !== correctByTerm[term]) && (
        <div className="match-corrections">
          {(q.pairs || []).map(([term, correct]) => (
            selectedByTerm[term] && selectedByTerm[term] !== correct
              ? <div key={term}>Correct: {term} {'->'} {correct}</div>
              : null
          ))}
        </div>
      )}
    </div>
  );
};

const CodeExhibit = ({ lines }) => (
  <div className="qcode-exhibit" aria-label="Configuration exhibit">
    {lines.map((line, idx) => <div key={idx}>{line}</div>)}
  </div>
);

function fitQuizTopologyNodes(nodes) {
  if (!nodes.length) return [];
  const bounds = nodes.reduce((box, node) => ({
    minX: Math.min(box.minX, Number(node.x) || 0),
    maxX: Math.max(box.maxX, Number(node.x) || 0),
    minY: Math.min(box.minY, Number(node.y) || 0),
    maxY: Math.max(box.maxY, Number(node.y) || 0),
  }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
  const scale = (value, min, max, low, high) => (
    max === min ? (low + high) / 2 : low + ((Number(value) - min) / (max - min)) * (high - low)
  );
  return nodes.map(node => ({
    ...node,
    x: scale(node.x, bounds.minX, bounds.maxX, 14, 86),
    y: scale(node.y, bounds.minY, bounds.maxY, 24, 78),
  }));
}

const TopologyExhibit = ({ exhibit }) => {
  const nodes = fitQuizTopologyNodes(exhibit.nodes || []);
  const byId = Object.fromEntries(nodes.map(node => [node.id, node]));
  const glyphs = window.Glyph || {};
  const links = exhibit.links || [];
  const linkLabels = links.flatMap((link, idx) => {
    const a = byId[link.from];
    const b = byId[link.to];
    if (!a || !b || !link.label) return [];
    return [{
      key: `${link.from}-${link.to}-${idx}-label`,
      label: link.label,
      type: link.type || 'ethernet',
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
    }];
  });
  return (
    <div className="qtopology-exhibit" aria-label={exhibit.title || 'Network topology exhibit'}>
      <svg className="qtopology-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {links.map((link, idx) => {
          const a = byId[link.from];
          const b = byId[link.to];
          if (!a || !b) return null;
          return (
            <g key={`${link.from}-${link.to}-${idx}`}>
              <line
                x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                className={`qtopology-link ${link.type || 'ethernet'}`} />
            </g>
          );
        })}
      </svg>
      {linkLabels.map(link => (
        <div
          key={link.key}
          className={`qtopology-link-label ${link.type}`}
          style={{ left: `${link.x}%`, top: `${link.y}%` }}>
          {link.label}
        </div>
      ))}
      {nodes.map(node => {
        const GlyphComponent = glyphs[node.kind] || glyphs.pc;
        return (
          <div
            key={node.id}
            className={`qtopology-node ${node.kind}`}
            style={{ left: `${node.x}%`, top: `${node.y}%` }}>
            <div className="qtopology-glyph">
              {GlyphComponent ? <GlyphComponent size={34} /> : <Icon name="target" size={28} />}
            </div>
            <div className="qtopology-node-label">{node.label}</div>
          </div>
        );
      })}
    </div>
  );
};

function sameSet(a, b) { return sameSetLocal(a, b); }
function sameSetLocal(a, b) {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}
function rand(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function parsePairOption(option) {
  if (!option || !option.includes('->')) return null;
  const [term, ...rest] = option.split('->');
  const description = rest.join('->').trim();
  if (!term.trim() || !description) return null;
  return { term: term.trim(), description };
}
function findPairOptionIndex(q, term, description) {
  if (!description) return null;
  const idx = (q.options || []).findIndex(option => {
    const parsed = parsePairOption(option);
    return parsed?.term === term && parsed.description === description;
  });
  return idx >= 0 ? idx : null;
}
function makePairSelection(q, term, description) {
  if (!description) return null;
  const optIdx = findPairOptionIndex(q, term, description);
  return optIdx != null ? optIdx : `${term} -> ${description}`;
}
function parsePairSelection(q, selection) {
  return parsePairOption(typeof selection === 'number' ? q.options?.[selection] : selection);
}
function getMatchChoices(q) {
  const choices = [];
  for (const option of q.options || []) {
    const parsed = parsePairOption(option);
    if (parsed && !choices.includes(parsed.description)) choices.push(parsed.description);
  }
  for (const [, description] of q.pairs || []) {
    if (!choices.includes(description)) choices.push(description);
  }
  return choices;
}
function shuffleMatchChoices(choices) {
  const shuffled = [...choices];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}
function selectedDescriptionsByTerm(q, selected) {
  const byTerm = {};
  for (const optIdx of selected || []) {
    const parsed = parsePairSelection(q, optIdx);
    if (parsed) byTerm[parsed.term] = parsed.description;
  }
  return byTerm;
}

window.PracticeRunner = PracticeRunner;
window.QuizRunner = QuizRunner;
window.QuestionExhibit = QuestionExhibit;
window.CodeExhibit = CodeExhibit;
window.TopologyExhibit = TopologyExhibit;
