const { useMemo: useMemoD, useState: useStateD } = React;

const CcnaBDiagramsPage = ({ onExit }) => {
  const [filter, setFilter] = useStateD('all');
  const entries = useMemoD(() => {
    return (window.QUESTIONS || [])
      .filter(q => q.bank?.startsWith('ccna-b/'))
      .filter(q => q.exhibit || q.code?.length || q.pairs?.length || q.lab)
      .map(q => ({
        q,
        quiz: `Quiz ${Number(q.bank.match(/quiz-(\d+)/)?.[1] || 1)}`,
        type: q.lab ? 'lab' : q.exhibit ? 'diagram' : q.pairs?.length ? 'matching' : 'table',
      }));
  }, []);
  const visible = entries.filter(entry => filter === 'all' || entry.type === filter);
  const counts = entries.reduce((acc, entry) => {
    acc[entry.type] = (acc[entry.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="diagram-review">
      <header className="diagram-review-head">
        <div>
          <div className="diagram-review-kicker">CCNA-B</div>
          <h1>Diagrams and Tables</h1>
        </div>
        <button type="button" className="diagram-review-back" onClick={onExit}>
          <Icon name="arrow-left" size={16} /> Back
        </button>
      </header>

      <div className="diagram-review-toolbar" role="tablist" aria-label="Diagram filters">
        {[
          ['all', entries.length],
          ['diagram', counts.diagram || 0],
          ['table', counts.table || 0],
          ['matching', counts.matching || 0],
          ['lab', counts.lab || 0],
        ].map(([key, count]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            className={filter === key ? 'active' : ''}
            onClick={() => setFilter(key)}>
            {key} <span>{count}</span>
          </button>
        ))}
      </div>

      <main className="diagram-review-list">
        {visible.map(({ q, quiz, type }) => (
          <article className="diagram-review-item" key={q.questionKey}>
            <div className="diagram-review-meta">
              <span>{quiz}</span>
              <span>Question {q.page || q.sourceIndex}</span>
              <span>{type}</span>
            </div>
            <h2>{q.question}</h2>
            {q.lab && <div className="diagram-lab-flag">Lab item documented; simulator logic is not implemented yet.</div>}
            <DiagramReviewAssets q={q} />
            {q.explanation && <p className="diagram-review-explanation">{q.explanation}</p>}
          </article>
        ))}
      </main>
    </div>
  );
};

const DiagramReviewAssets = ({ q }) => {
  const Exhibit = window.QuestionExhibit;
  return (
    <div className="diagram-review-assets">
      {(q.exhibit || q.code?.length) && Exhibit && <Exhibit q={q} />}
      {q.pairs?.length ? <PairReviewTable pairs={q.pairs} /> : null}
      {!q.exhibit && !q.code?.length && !q.pairs?.length && q.lab ? (
        <div className="diagram-empty">No structured exhibit was visible in the source screenshots for this lab.</div>
      ) : null}
    </div>
  );
};

const PairReviewTable = ({ pairs }) => (
  <div className="pair-review-table">
    <div className="pair-review-row pair-review-head">
      <div>Term</div>
      <div>Match</div>
    </div>
    {pairs.map(([term, match]) => (
      <div className="pair-review-row" key={`${term}-${match}`}>
        <div>{term}</div>
        <div>{match}</div>
      </div>
    ))}
  </div>
);

window.CcnaBDiagramsPage = CcnaBDiagramsPage;
