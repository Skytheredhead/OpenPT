// Results page — score, breakdown, and most-missed list.

const ResultsPage = ({ state, onRestart, onExit, accent }) => {
  const total = state.quizIds.length;
  const firstTryPct = total ? Math.round((state.firstTryMastered.size / total) * 100) : 0;
  const accuracyPct = state.totalAttempts ? Math.round((state.correctAttempts / state.totalAttempts) * 100) : 100;
  const masterAt = state.mode === 'quiz' ? 2 : 1;

  // Composite "pass" estimate: lean on first-try mastery + overall accuracy, penalize misses
  const repeatPenalty = Math.min(18, Math.round((state.wrongAttempts / Math.max(1, total)) * 10));
  const score = Math.max(0, Math.min(100, Math.round(firstTryPct * 0.72 + accuracyPct * 0.28 - repeatPenalty)));

  const [verdictTag, verdictTitle, verdictCopy] = (() => {
    if (score < 55) return ['err', 'Cooked', 'This run says the test would be rough. Re-run and let the queue dig out the misses.'];
    if (score < 70) return ['warn', 'Shaky but alive', 'Enough signal to build from but the misses are still loud. Another pass should move the needle fast.'];
    if (score < 82) return ['warn', 'Probably passing', 'In passing range. Clean up the repeated misses and you’re in a much better spot.'];
    if (score < 92) return ['ok', 'Solid student mode', 'Looks good. A little more polish on first-try accuracy and you walk in confident.'];
    return ['ok', 'Straight A energy', 'You cooked the quiz instead of getting cooked. One quick review before the test and you’re set.'];
  })();

  // Top missed (this run)
  const missCounts = new Map();
  for (const h of state.history) {
    if (!h.correct) missCounts.set(h.id, (missCounts.get(h.id) || 0) + 1);
  }
  const topMissed = [...missCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id, count]) => ({ id, count, q: window.QUESTIONS[id] }));

  const elapsedMs = (state.endedAt || Date.now()) - state.startedAt;
  const elapsedMin = Math.floor(elapsedMs / 60000);
  const elapsedSec = Math.floor((elapsedMs % 60000) / 1000);

  // Ring meter setup
  const R = 80, C = 2 * Math.PI * R;
  const dash = C * (score / 100);

  return (
    <div className="results qrunner-enter">
      <div className="results-kicker">~/quiz.openpt/results/{state.mode}-{total}q</div>

      <div className="score-head">
        <div className="score-ring">
          <svg viewBox="0 0 200 200">
            <circle cx="100" cy="100" r={R} className="track" />
            <circle cx="100" cy="100" r={R} className="meter"
              strokeDasharray={`${dash} ${C - dash}`}
              style={{
                stroke: verdictTag === 'err' ? 'var(--err)' : verdictTag === 'warn' ? 'var(--warn)' :
                       'var(--accent)',
              }}
            />
          </svg>
          <div className="pct">
            <div className="num">{score}%</div>
            <div className="lbl">pass estimate</div>
          </div>
        </div>
        <div className="score-meta">
          <div className={`verdict-tag ${verdictTag}`}>verdict · {state.mode === 'quiz' ? 'quiz mode' : 'practice mode'}</div>
          <h1>{verdictTitle}</h1>
          <p>{verdictCopy}</p>
          <div className="actions">
            <button className="run-btn" onClick={onRestart}>
              <Icon name="rotate" size={14} /> Run it back
            </button>
            <button className="run-btn ghost" onClick={onExit}>
              <Icon name="home" size={14} /> Back to library
            </button>
          </div>
        </div>
      </div>

      <div className="result-grid">
        <div className="stat-cell"><div className="v">{firstTryPct}%</div><div className="k">first-try mastery</div></div>
        <div className="stat-cell"><div className="v">{accuracyPct}%</div><div className="k">overall accuracy</div></div>
        <div className="stat-cell"><div className="v">{state.totalAttempts}</div><div className="k">total attempts</div></div>
        <div className="stat-cell"><div className="v">{elapsedMin}m {String(elapsedSec).padStart(2, '0')}s</div><div className="k">time elapsed</div></div>
      </div>

      <div className="missed-section">
        <h3>
          Most missed this run
          <span className="ct">{topMissed.length} question{topMissed.length === 1 ? '' : 's'}</span>
        </h3>
        {topMissed.length === 0 ? (
          <div style={{
            padding: 22,
            border: '1px dashed var(--line)', borderRadius: 8,
            color: 'var(--fg-3)', fontFamily: 'var(--font-mono)', fontSize: 12,
          }}>
            No misses this run. Send it on quiz mode and see if it holds.
          </div>
        ) : (
          <div className="missed-list">
            {topMissed.map(m => (
              <div className="missed-item" key={m.id}>
                <div className="ct">×{m.count}<small>misses</small></div>
                <div className="qt">
                  <span className="src">{m.q.source} · item {m.q.sourceIndex}</span>
                  {m.q.question}
                </div>
                <div className="tag">{m.q.multi ? `multi (choose ${m.q.answers.length})` : 'single'}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

window.ResultsPage = ResultsPage;
