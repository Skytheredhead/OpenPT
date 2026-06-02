// Home — centered library tree. CCNA > 3 semesters > exams.

const { useState, useEffect, useMemo } = React;

// Catalog for imported and planned CCNA quiz banks.
const CATALOG = [
  {
    id: 'ccna', label: 'CCNA',
    exams: [
      { id: 'all', label: 'ALL Quiz', available: true, count: 1172, allQuestions: true },
    ],
    semesters: [
      { id: 'sem-01', label: 'Semester 1', exams: [
        { id: 'm-1-3',  label: 'Module 1-3 Quiz', available: true, count: 28 },
        { id: 'm-4-7',  label: 'Module 4-7 Quiz', available: true, count: 45 },
        { id: 'm-8-10', label: 'Module 8-10 Quiz', available: true, count: 38 },
        { id: 'm-11-13',label: 'Module 11-13 Quiz', available: true, count: 40 },
        { id: 'm-14-15',label: 'Module 14-15 Quiz', available: true, count: 35 },
        { id: 'm-16-17',label: 'Module 16-17 Quiz', available: true, count: 35 },
        { id: 'final',  label: 'Final exam', available: true, count: 161 },
      ]},
      { id: 'sem-02', label: 'Semester 2', exams: [
        { id: 'm-1-4',  label: 'Module 1-4 Quiz', available: true, count: 42 },
        { id: 'm-5-6',  label: 'Module 5-6 Quiz', available: true, count: 35 },
        { id: 'm-7-9',  label: 'Module 7-9 Quiz', available: true, count: 34 },
        { id: 'm-10-13', label: 'Module 10-13 Quiz', available: true, count: 60 },
        { id: 'm-14-16',label: 'Module 14-16 Quiz', available: true, count: 48 },
        { id: 'final',  label: 'Final exam', available: true, count: 127 },
      ]},
      { id: 'sem-03', label: 'Semester 3', exams: [
        { id: 'm-1-2',  label: 'Module 1-2 Quiz', available: true, count: 46 },
        { id: 'm-3-5',  label: 'Module 3-5 Quiz', available: true, count: 61 },
        { id: 'm-6-8',  label: 'Module 6-8 Quiz', available: true, count: 48 },
        { id: 'm-9-12', label: 'Module 9-12 Quiz', available: true, count: 58 },
        { id: 'm-13-14',label: 'Module 13-14 Quiz', available: true, count: 34 },
        { id: 'final',  label: 'Final exam', available: true, count: 197 },
      ]},
    ],
  },
];

const QUIZ_LENGTHS = [15, 30];

function getLengthOptions(exam) {
  const count = exam?.count || 0;
  return [
    ...QUIZ_LENGTHS.map(size => ({ key: String(size), label: String(size), size, disabled: count < size })),
    { key: 'all', label: 'all', size: count, disabled: !count },
  ];
}

function resolveLaunchSize(exam, requestedSize) {
  const enabledOptions = getLengthOptions(exam).filter(option => !option.disabled);
  const exactOption = enabledOptions.find(option => option.size === requestedSize);
  if (exactOption) return exactOption.size;
  return enabledOptions.find(option => option.size === 30)?.size || enabledOptions[0]?.size || requestedSize;
}

const HomePage = ({ onLaunch, onLaunchStudy, studyDashboard, user }) => {
  const [openCourses, setOpenCourses] = useState({ ccna: true });
  // Open the live semester by default; collapse the rest
  const [openSems, setOpenSems] = useState({ 'ccna/sem-01': true, 'ccna/sem-02': true, 'ccna/sem-03': true });
  const [selected, setSelected] = useState('ccna/sem-01/m-1-3');

  // Launch panel state
  const [mode, setMode] = useState('practice');
  const [size, setSize] = useState(50);

  const selectedExam = useMemo(() => {
    if (!selected) return null;
    const parts = selected.split('/');
    const [courseId] = parts;
    const course = CATALOG.find(c => c.id === courseId);
    if (!course) return null;
    if (parts.length === 2) {
      const [, examId] = parts;
      const exam = course.exams?.find(e => e.id === examId);
      if (!exam) return null;
      return { course, sem: null, exam, courseId, semId: null, examId, key: selected };
    }
    const [, semId, examId] = parts;
    const sem = course.semesters.find(s => s.id === semId);
    const exam = sem?.exams.find(e => e.id === examId);
    if (!exam) return null;
    return { course, sem, exam, courseId, semId, examId, key: selected };
  }, [selected]);

  const launchSelection = (modeArg = mode, sizeArg = size, keyArg = selected, selectedArg = selectedExam) => {
    const launchSize = resolveLaunchSize(selectedArg?.exam, sizeArg);
    onLaunch(modeArg, launchSize, keyArg);
  };

  function toggleCourse(id) { setOpenCourses(s => ({ ...s, [id]: !s[id] })); }
  function toggleSem(key) { setOpenSems(s => ({ ...s, [key]: !s[key] })); }

  useEffect(() => {
    const onKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (!selectedExam?.exam.available) return;
      if (e.key === 'p' || e.key === 'P') setMode('practice');
      else if (e.key === 'q' || e.key === 'Q') setMode('quiz');
      else if (e.key === 'Enter') launchSelection();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, size, onLaunch, selectedExam]);

  return (
    <div className="home-centered">
     <div className="home-stack">
      <div className="home-brand">
        <div className="home-brand-glyph"></div>
        <div className="home-brand-name">
          OpenPT <span className="home-brand-name-accent">Quiz</span>
        </div>
      </div>
      <div className="lib-card">
        <div className="lib-card-head">
          <div className="lib-card-title">
            <Icon name="library" size={14} /> library
          </div>
        </div>

        <div className="lib-tree">
          {CATALOG.map(course => {
            const courseOpen = openCourses[course.id];
            return (
              <div key={course.id}>
                <div className="tree-row tree-course" onClick={() => toggleCourse(course.id)}>
                  <span className="chev">{courseOpen ? '▼' : '▶'}</span>
                  <span className="icn"><Icon name="folder" size={13} /></span>
                  <span className="label">{course.label}</span>
                </div>
                <Collapse open={courseOpen}>
                  {(course.exams || []).map(exam => {
                    const examKey = `${course.id}/${exam.id}`;
                    const isSel = selected === examKey;
                    const isAvail = !!exam.available;
                    return (
                      <div
                        key={exam.id}
                        className={`tree-row tree-exam tree-course-exam ${isSel ? 'selected' : ''} ${!isAvail ? 'soon' : ''}`}
                        onClick={() => setSelected(isSel ? null : examKey)}
                        onDoubleClick={() => isAvail && launchSelection(mode, size, examKey, { exam })}>
                        <span className="chev" />
                        <span className="icn">
                          <Icon name="quiz" size={14} />
                        </span>
                        <span className="label">{exam.label}</span>
                        <span className="ct ok">{exam.count} q</span>
                      </div>
                    );
                  })}
                  {course.semesters.map(sem => {
                    const semKey = `${course.id}/${sem.id}`;
                    const semOpen = openSems[semKey];
                    return (
                      <div key={sem.id}>
                        <div className="tree-row tree-sem" onClick={() => toggleSem(semKey)}>
                          <span className="chev">{semOpen ? '▼' : '▶'}</span>
                          <span className="icn"><Icon name="folder" size={13} /></span>
                          <span className="label">{sem.label}</span>
                        </div>
                        <Collapse open={semOpen}>
                          {sem.exams.map(exam => {
                            const examKey = `${course.id}/${sem.id}/${exam.id}`;
                            const isSel = selected === examKey;
                            const isAvail = !!exam.available;
                            const isFinal = exam.id === 'final';
                            const iconName = isFinal ? 'cap' : 'quiz';
                            return (
                              <div
                                key={exam.id}
                                className={`tree-row tree-exam ${isSel ? 'selected' : ''} ${!isAvail ? 'soon' : ''}`}
                                onClick={() => setSelected(isSel ? null : examKey)}
                                onDoubleClick={() => isAvail && launchSelection(mode, size, examKey, { exam })}>
                                <span className="chev" />
                                <span className="icn">
                                  <Icon name={iconName} size={14} />
                                </span>
                                <span className="label">{exam.label}</span>
                                {isAvail ? (
                                  <span className="ct ok">{exam.count} q</span>
                                ) : (
                                  <span className="ct dim">—</span>
                                )}
                              </div>
                            );
                          })}
                        </Collapse>
                      </div>
                    );
                  })}
                </Collapse>
              </div>
            );
          })}
        </div>
      </div>

      <SelectionCard
        selectedExam={selectedExam}
        mode={mode}
        setMode={setMode}
        size={size}
        setSize={setSize}
        onLaunch={onLaunch}
        onLaunchStudy={onLaunchStudy}
        studyDashboard={studyDashboard}
        user={user}
      />
     </div>
    </div>
  );
};

const SelectionCard = ({ selectedExam, mode, setMode, size, setSize, onLaunch, onLaunchStudy, studyDashboard, user }) => {
  const visible = !!selectedExam;
  const exam = selectedExam?.exam;
  const sem = selectedExam?.sem;
  const course = selectedExam?.course;
  const isAvail = !!exam?.available;
  const isFinal = exam?.id === 'final';
  const count = exam?.count;
  const isAll = !!exam?.allQuestions;
  const lengthOptions = getLengthOptions(exam);
  const launchSize = resolveLaunchSize(exam, size);

  return (
    <div className={`sel-card ${visible ? 'visible' : ''}`} aria-hidden={!visible}>
      {visible && (
        <>
          <div className="sel-card-top">
            <div className="sel-icon">
              <Icon name={isFinal ? 'cap' : 'quiz'} size={22} />
            </div>
            <div className="sel-meta">
              <div className="sel-crumbs">
                {course?.label}{sem && <><span className="sel-sep">/</span> {sem.label}</>}
              </div>
              <div className="sel-title">
                {exam?.label}{isAvail && count ? ` - ${count}q` : ''}
              </div>
              {!isAvail && (
                <div className="sel-tags">
                  <span className="sel-tag warn">
                    <span className="dot" /> bank not imported
                  </span>
                </div>
              )}
            </div>
          </div>

          {isAvail ? (
            <div className="sel-controls">
              <div className="sel-row">
                <div className="sel-label">mode</div>
                <div className="sel-pills">
                  <button
                    type="button"
                    className={`sel-pill ${mode === 'practice' ? 'active' : ''}`}
                    onClick={() => setMode('practice')}>
                    practice
                  </button>
                  <button
                    type="button"
                    className={`sel-pill ${mode === 'quiz' ? 'active' : ''}`}
                    onClick={() => setMode('quiz')}>
                    quiz
                  </button>
                </div>
              </div>

              <div className="sel-row">
                <div className="sel-label">length</div>
                <div className="sel-seg">
                  {lengthOptions.map(option => {
                    return (
                      <button
                        key={option.key}
                        type="button"
                        className={`sel-seg-btn ${launchSize === option.size ? 'active' : ''}`}
                        disabled={option.disabled}
                        onClick={() => setSize(option.size)}>
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="sel-actions">
                <button type="button" className="sel-start" onClick={() => onLaunch(mode, launchSize, selectedExam.key)}>
                  <Icon name="play" size={12} />
                  Start {mode}
                </button>
                {isAll && (
                  <button type="button" className="sel-start study" onClick={() => onLaunchStudy()}>
                    <Icon name="target" size={12} />
                    CCNA Study Mode
                  </button>
                )}
              </div>
              {isAll && (
                <StudyLaunchDashboard dashboard={studyDashboard} user={user} count={count} />
              )}
            </div>
          ) : (
            <div className="sel-empty">
              <Icon name="clock" size={16} />
              <div>
                <b>Question bank not imported yet.</b>
                <span>Drop a Q&amp;A file in <code>/banks/{selectedExam.courseId}/{selectedExam.semId}/{selectedExam.examId}.json</code> to enable this exam.</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const StudyLaunchDashboard = ({ dashboard, user, count }) => {
  if (!user) {
    return (
      <div className="study-launch-dashboard locked">
        <div className="study-lock"><Icon name="target" size={15} /></div>
        <div>
          <b>Login required for Study Mode</b>
          <span>Progress, misses, timing, and confidence are saved to your account.</span>
        </div>
      </div>
    );
  }
  const total = dashboard?.totalQuestionCount || count || 0;
  const seen = dashboard?.seenCount || 0;
  const seenPct = total ? Math.round((seen / total) * 100) : 0;
  return (
    <div className="study-launch-dashboard">
      <div className="study-mini-stat">
        <b>{seenPct}%</b>
        <span>progress</span>
      </div>
      <div className="study-mini-stat">
        <b>{dashboard?.recentScore ?? '-'}</b>
        <span>recent</span>
      </div>
      <div className="study-mini-stat">
        <b>{dashboard?.averageScore ?? '-'}</b>
        <span>avg score</span>
      </div>
      <div className="study-mini-stat">
        <b>{dashboard?.confidenceScore ?? '-'}</b>
        <span>confidence</span>
      </div>
      <div className="study-progress-line">
        <span style={{ width: `${seenPct}%` }} />
      </div>
    </div>
  );
};

window.HomePage = HomePage;

// Smoothly animates height open/close using the grid-template-rows 0fr → 1fr trick.
// Child content keeps its natural height, parent animates the row-track.
const Collapse = ({ open, children }) => (
  <div className={`tree-collapse ${open ? 'open' : ''}`} aria-hidden={!open}>
    <div className="tree-collapse-inner">{children}</div>
  </div>
);
