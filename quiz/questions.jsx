// Loads window.QUESTIONS_RAW (compact) and re-exports as window.QUESTIONS with friendly keys.
(function () {
  // Lazily load via dynamic script if not already present.
  function inflate() {
    if (!window.QUESTIONS_RAW) return;
    const friendly = window.QUESTIONS_RAW.map((q, idx) => ({
      id: idx,
      slide: q.s,
      question: q.q,
      options: q.o,
      answers: q.a,
      multi: !!q.m,
      bank: q.bank || 'ccna/sem-03/final',
      examLabel: q.exam || 'Final exam',
      semesterLabel: q.semester || 'Semester 3',
      courseLabel: q.course || 'CCNA',
      source: q.src,
      sourceIndex: q.si,
      exhibitCount: q.e || 0,
      hasExhibit: !!q.e,
      exhibit: q.exhibit || null,
      code: q.code || null,
      pairs: q.pairs || null,
      page: q.page || null,
    }));
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
