// Loads window.QUESTIONS_RAW (compact) and re-exports as window.QUESTIONS with friendly keys.
(function () {
  // Lazily load via dynamic script if not already present.
  function inflate() {
    if (!window.QUESTIONS_RAW) return;
    const exhibitEnrichments = window.FINAL_STRUCTURED_EXHIBITS || {};
    const friendly = window.QUESTIONS_RAW.map((q, idx) => {
      const exhibitKey = `${q.src || ''}#${q.si || ''}`;
      const enriched = exhibitEnrichments[exhibitKey]
        ? { ...q, ...exhibitEnrichments[exhibitKey] }
        : q;
      return ({
        id: idx,
        slide: enriched.s,
        question: enriched.q,
        options: enriched.o,
        answers: enriched.a,
        multi: !!enriched.m,
        bank: enriched.bank || 'ccna/sem-03/final',
        examLabel: enriched.exam || 'Final exam',
        semesterLabel: enriched.semester || 'Semester 3',
        courseLabel: enriched.course || 'CCNA',
        source: enriched.src,
        sourceIndex: enriched.si,
        exhibitCount: enriched.e || 0,
        hasExhibit: !!enriched.e,
        exhibit: enriched.exhibit || null,
        code: enriched.code || null,
        pairs: enriched.pairs || null,
        page: enriched.page || null,
      });
    });
    window.QUESTIONS = friendly;
    window.dispatchEvent(new Event('questions:ready'));
  }
  if (window.QUESTIONS_RAW) {
    inflate();
  } else {
    const s = document.createElement('script');
    s.src = 'questions-data.js';
    s.onload = inflate;
    document.head.appendChild(s);
  }
})();
