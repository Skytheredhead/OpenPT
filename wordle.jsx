// wordle.jsx — networking word puzzle page

const { useCallback: useCallbackW, useEffect: useEffectW, useMemo: useMemoW, useRef: useRefW, useState: useStateW } = React;

const WORDLE_ROWS = 6;
const WORDLE_KEYS = ["QWERTYUIOP", "ASDFGHJKL", "ZXCVBNM"];
const WORDLE_USED_ANSWERS_KEY = "openpt.wordle.usedAnswers.v1";
const WORDLE_STATS_KEY = "openpt.wordle.stats.v1";
const WORDLE_COLOR_FADE_MS = 260;
const WORDLE_REVEAL_TOTAL_MS = WORDLE_COLOR_FADE_MS + 80;
const WORDLE_ROW_SHAKE_MS = 320;
const WORDLE_STATS_EXIT_MS = 170;
const WORDLE_BOARD_EXIT_MS = 500;
const WORDLE_BOARD_RESET_MS = 560;
const WORDLE_ALLOWED_MIN_LENGTH = 3;
const WORDLE_ALLOWED_MAX_LENGTH = 10;
const WORDLE_ANSWER_MIN_LENGTH = 4;
const WORDLE_ANSWER_MAX_LENGTH = 8;

const WORDLE_FALLBACK_CCNA_TERMS = [
  "access", "admin", "arp", "audit", "backup", "banner", "bridge", "cable", "cisco", "client",
  "cloud", "config", "debug", "default", "device", "dhcp", "dns", "duplex", "eigrp", "enable",
  "ether", "frame", "gateway", "host", "https", "icmp", "ipsec", "layer", "local", "login",
  "ospf", "packet", "permit", "port", "route", "router", "secure", "server", "static", "subnet",
  "switch", "tcp", "trunk", "vlan", "voice", "wireless",
];

function cleanWordleTerms(words, minLength, maxLength) {
  return Array.isArray(words)
    ? words
        .map((word) => String(word || "").toLowerCase())
        .filter((word, index, allWords) => {
          return (
            word.length >= minLength &&
            word.length <= maxLength &&
            /^[a-z]+$/.test(word) &&
            allWords.indexOf(word) === index
          );
        })
    : [];
}

const WORDLE_CCNA_ALLOWED_WORDS = cleanWordleTerms(
  [
    ...WORDLE_FALLBACK_CCNA_TERMS,
    ...(Array.isArray(window.WORDLE_CCNA_ALLOWED_WORDS) ? window.WORDLE_CCNA_ALLOWED_WORDS : []),
  ],
  WORDLE_ALLOWED_MIN_LENGTH,
  WORDLE_ALLOWED_MAX_LENGTH,
);
const WORDLE_ANSWERS = cleanWordleTerms(
  Array.isArray(window.WORDLE_CCNA_ANSWER_WORDS) && window.WORDLE_CCNA_ANSWER_WORDS.length
    ? window.WORDLE_CCNA_ANSWER_WORDS
    : WORDLE_FALLBACK_CCNA_TERMS,
  WORDLE_ANSWER_MIN_LENGTH,
  WORDLE_ANSWER_MAX_LENGTH,
);
const WORDLE_ALLOWED_WORD_SET = new Set([...WORDLE_CCNA_ALLOWED_WORDS, ...WORDLE_ANSWERS]);

function emptyWordleStats() {
  return {
    played: 0,
    wins: 0,
    streak: 0,
    maxStreak: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 },
  };
}

function loadWordleStats() {
  try {
    const saved = JSON.parse(localStorage.getItem(WORDLE_STATS_KEY) || "null");
    if (!saved || typeof saved !== "object") return emptyWordleStats();
    return {
      ...emptyWordleStats(),
      ...saved,
      distribution: { ...emptyWordleStats().distribution, ...(saved.distribution || {}) },
    };
  } catch (err) {
    return emptyWordleStats();
  }
}

function saveWordleStats(stats) {
  try {
    localStorage.setItem(WORDLE_STATS_KEY, JSON.stringify(stats));
  } catch (err) {
    // Stats are nice to have; gameplay should not depend on storage.
  }
}

function loadUsedWordleAnswers() {
  try {
    const data = JSON.parse(localStorage.getItem(WORDLE_USED_ANSWERS_KEY) || "[]");
    return new Set(Array.isArray(data) ? data.filter((word) => WORDLE_ANSWERS.includes(word)) : []);
  } catch (err) {
    return new Set();
  }
}

function saveUsedWordleAnswers(usedAnswers) {
  try {
    localStorage.setItem(WORDLE_USED_ANSWERS_KEY, JSON.stringify([...usedAnswers]));
  } catch (err) {
    // Ignore storage failures; repeat avoidance is nice-to-have.
  }
}

function pickNetworkingWord() {
  const usedAnswers = loadUsedWordleAnswers();
  let candidates = WORDLE_ANSWERS.filter((word) => !usedAnswers.has(word));

  if (!candidates.length) {
    usedAnswers.clear();
    candidates = WORDLE_ANSWERS;
  }

  const word = candidates[Math.floor(Math.random() * candidates.length)] || WORDLE_ANSWERS[0];
  usedAnswers.add(word);
  saveUsedWordleAnswers(usedAnswers);
  return word;
}

function scoreGuess(guess, answer) {
  const result = Array(guess.length).fill("absent");
  const remaining = {};

  for (let i = 0; i < guess.length; i++) {
    if (guess[i] === answer[i]) {
      result[i] = "correct";
    } else {
      remaining[answer[i]] = (remaining[answer[i]] || 0) + 1;
    }
  }

  for (let i = 0; i < guess.length; i++) {
    if (result[i] === "correct") continue;
    if (remaining[guess[i]] > 0) {
      result[i] = "present";
      remaining[guess[i]] -= 1;
    }
  }

  return result;
}

function keyStatuses(guesses, answer) {
  const rank = { absent: 1, present: 2, correct: 3 };
  const statuses = {};
  guesses.forEach((guess) => {
    scoreGuess(guess, answer).forEach((status, index) => {
      const letter = guess[index];
      if (!statuses[letter] || rank[status] > rank[statuses[letter]]) statuses[letter] = status;
    });
  });
  return statuses;
}

function WordlePage() {
  const [answer, setAnswer] = useStateW(() => pickNetworkingWord());
  const [guesses, setGuesses] = useStateW([]);
  const [current, setCurrent] = useStateW("");
  const [message, setMessage] = useStateW("CCNA term ready");
  const [status, setStatus] = useStateW("playing");
  const [stats, setStats] = useStateW(() => loadWordleStats());
  const [showStats, setShowStats] = useStateW(false);
  const [revealingRowIndex, setRevealingRowIndex] = useStateW(null);
  const [shakingRowIndex, setShakingRowIndex] = useStateW(null);
  const [isFadingBoardOut, setIsFadingBoardOut] = useStateW(false);
  const [isResettingBoard, setIsResettingBoard] = useStateW(false);
  const [isClosingStats, setIsClosingStats] = useStateW(false);
  const revealTimerRef = useRefW(null);
  const statsTimerRef = useRefW(null);
  const statsExitTimerRef = useRefW(null);
  const shakeTimerRef = useRefW(null);
  const resetTimerRef = useRefW(null);
  const answerLength = answer.length;

  const statuses = useMemoW(() => keyStatuses(guesses, answer), [guesses, answer]);
  const isRevealing = revealingRowIndex !== null;

  const clearWordleTimers = useCallbackW(() => {
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
    if (statsTimerRef.current) {
      clearTimeout(statsTimerRef.current);
      statsTimerRef.current = null;
    }
    if (statsExitTimerRef.current) {
      clearTimeout(statsExitTimerRef.current);
      statsExitTimerRef.current = null;
    }
    if (shakeTimerRef.current) {
      clearTimeout(shakeTimerRef.current);
      shakeTimerRef.current = null;
    }
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  const revealSubmittedRow = useCallbackW((rowIndex) => {
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    setRevealingRowIndex(rowIndex);
    revealTimerRef.current = setTimeout(() => {
      setRevealingRowIndex(null);
      revealTimerRef.current = null;
    }, WORDLE_REVEAL_TOTAL_MS);
  }, []);

  const shakeActiveRow = useCallbackW(() => {
    if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current);
    setShakingRowIndex(guesses.length);
    shakeTimerRef.current = setTimeout(() => {
      setShakingRowIndex(null);
      shakeTimerRef.current = null;
    }, WORDLE_ROW_SHAKE_MS);
  }, [guesses.length]);

  useEffectW(() => () => clearWordleTimers(), [clearWordleTimers]);

  const resetWordleBoard = useCallbackW(() => {
    setAnswer(pickNetworkingWord());
    setGuesses([]);
    setCurrent("");
    setStatus("playing");
    setShowStats(false);
    setIsClosingStats(false);
    setIsFadingBoardOut(false);
    setRevealingRowIndex(null);
    setShakingRowIndex(null);
    setIsResettingBoard(true);
    setMessage("CCNA term ready");
    if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    resetTimerRef.current = setTimeout(() => {
      setIsResettingBoard(false);
      resetTimerRef.current = null;
    }, WORDLE_BOARD_RESET_MS);
  }, []);

  const closeStats = useCallbackW(() => {
    if (!showStats || isClosingStats) return;
    if (statsExitTimerRef.current) clearTimeout(statsExitTimerRef.current);
    setIsClosingStats(true);
    statsExitTimerRef.current = setTimeout(() => {
      setShowStats(false);
      setIsClosingStats(false);
      statsExitTimerRef.current = null;
    }, WORDLE_STATS_EXIT_MS);
  }, [isClosingStats, showStats]);

  const startNewWord = useCallbackW(() => {
    if (isClosingStats) return;
    clearWordleTimers();
    setIsFadingBoardOut(true);
    setIsResettingBoard(false);
    setIsClosingStats(true);
    statsExitTimerRef.current = setTimeout(() => {
      statsExitTimerRef.current = null;
      setShowStats(false);
      setIsClosingStats(false);
    }, WORDLE_STATS_EXIT_MS);
    resetTimerRef.current = setTimeout(() => {
      resetWordleBoard();
    }, WORDLE_BOARD_EXIT_MS);
  }, [clearWordleTimers, isClosingStats, resetWordleBoard]);

  const finishBoardReset = useCallbackW((event) => {
    if (event.target !== event.currentTarget) return;
    setIsResettingBoard(false);
    if (resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = null;
    }
  }, []);

  const finishGame = useCallbackW((won, nextGuesses, finalAnswer) => {
    const guessCount = nextGuesses.length;
    const nextStats = {
      ...stats,
      played: stats.played + 1,
      wins: stats.wins + (won ? 1 : 0),
      streak: won ? stats.streak + 1 : 0,
      maxStreak: won ? Math.max(stats.maxStreak, stats.streak + 1) : stats.maxStreak,
      distribution: {
        ...stats.distribution,
        ...(won ? { [guessCount]: (stats.distribution[guessCount] || 0) + 1 } : {}),
      },
    };
    setStats(nextStats);
    saveWordleStats(nextStats);
    setStatus(won ? "won" : "lost");
    setMessage(won ? "Routed correctly" : `Answer: ${finalAnswer.toUpperCase()}`);
    if (statsTimerRef.current) clearTimeout(statsTimerRef.current);
    statsTimerRef.current = setTimeout(() => {
      setShowStats(true);
      statsTimerRef.current = null;
    }, WORDLE_REVEAL_TOTAL_MS);
  }, [stats]);

  const submitGuess = useCallbackW(() => {
    if (status !== "playing") return;
    if (isRevealing) return;
    if (current.length < answerLength) {
      setMessage(`${answerLength - current.length} more`);
      shakeActiveRow();
      return;
    }
    if (guesses.includes(current)) {
      setMessage("Already guessed");
      shakeActiveRow();
      return;
    }
    if (!WORDLE_ALLOWED_WORD_SET.has(current)) {
      setMessage("CCNA terms only");
      shakeActiveRow();
      return;
    }

    const nextGuesses = [...guesses, current];
    const submittedRowIndex = nextGuesses.length - 1;
    setGuesses(nextGuesses);
    setCurrent("");
    revealSubmittedRow(submittedRowIndex);

    if (current === answer) {
      finishGame(true, nextGuesses, answer);
      return;
    }
    if (nextGuesses.length >= WORDLE_ROWS) {
      finishGame(false, nextGuesses, answer);
      return;
    }
    setMessage(`${WORDLE_ROWS - nextGuesses.length} guesses left`);
  }, [answer, answerLength, current, finishGame, guesses, isRevealing, revealSubmittedRow, shakeActiveRow, status]);

  const pressKey = useCallbackW((key) => {
    if (isRevealing) return;
    if (key === "ENTER") {
      submitGuess();
      return;
    }
    if (key === "BACKSPACE") {
      if (status === "playing") setCurrent((value) => value.slice(0, -1));
      return;
    }
    if (/^[A-Z]$/.test(key) && status === "playing") {
      setCurrent((value) => (value.length < answerLength ? `${value}${key.toLowerCase()}` : value));
    }
  }, [answerLength, isRevealing, status, submitGuess]);

  useEffectW(() => {
    const onKeyDown = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "Enter") {
        event.preventDefault();
        pressKey("ENTER");
      } else if (event.key === "Backspace") {
        event.preventDefault();
        pressKey("BACKSPACE");
      } else if (/^[a-zA-Z]$/.test(event.key)) {
        event.preventDefault();
        pressKey(event.key.toUpperCase());
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pressKey]);

  const rows = Array.from({ length: WORDLE_ROWS }, (_, rowIndex) => {
    const guess = guesses[rowIndex] || (rowIndex === guesses.length ? current : "");
    const score = guesses[rowIndex] ? scoreGuess(guesses[rowIndex], answer) : [];
    return { guess, score };
  });

  return (
    <main className="wordle-page">
      <section className="wordle-shell" aria-label="CCNA Wordle">
        <header className="wordle-brand">
          <div className="home-brand-glyph wordle-glyph" aria-hidden="true"></div>
          <div className="wordle-title-block">
            <h1>OpenPT <span>Wordle</span></h1>
          </div>
          <div className={`wordle-sr-status ${status}`} aria-live="polite">{message}</div>
        </header>

        <div
          className={`wordle-panel ${isFadingBoardOut ? "reset-exiting" : ""} ${isResettingBoard ? "resetting" : ""}`}
          onAnimationEnd={finishBoardReset}>
          <div className="wordle-board-wrap">
            <div className="wordle-board" style={{ "--wordle-cols": answerLength }}>
              {rows.map((row, rowIndex) => (
                <div
                  className={`wordle-row ${revealingRowIndex === rowIndex ? "revealing" : ""} ${shakingRowIndex === rowIndex ? "shaking" : ""}`}
                  key={rowIndex}>
                  {Array.from({ length: answerLength }, (_, cellIndex) => {
                    const letter = row.guess[cellIndex] || "";
                    const scored = row.score[cellIndex];
                    return (
                      <div
                        className={`wordle-tile ${letter ? "filled" : ""} ${scored || ""}`}
                        key={cellIndex}
                        aria-label={letter ? `${letter} ${scored || "typed"}` : "empty"}>
                        {letter.toUpperCase()}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          <WordleKeyboard statuses={statuses} onPress={pressKey} />
        </div>

        {showStats && (
          <StatsModal
            answer={answer}
            guesses={guesses}
            isClosing={isClosingStats}
            onClose={closeStats}
            onNext={startNewWord}
            stats={stats}
            status={status}
          />
        )}
      </section>
    </main>
  );
}

function WordleKeyboard({ statuses, onPress }) {
  return (
    <div className="wordle-keyboard" aria-label="Keyboard">
      {WORDLE_KEYS.map((row, rowIndex) => (
        <div className="wordle-key-row" key={row}>
          {rowIndex === 2 && (
            <button className="wordle-key wide" type="button" tabIndex="-1" data-key="ENTER" onMouseDown={(event) => event.preventDefault()} onClick={() => onPress("ENTER")}>enter</button>
          )}
          {[...row].map((letter) => (
            <button
              className={`wordle-key ${statuses[letter.toLowerCase()] || ""}`}
              type="button"
              tabIndex="-1"
              data-key={letter}
              key={letter}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onPress(letter)}>
              {letter}
            </button>
          ))}
          {rowIndex === 2 && (
            <button className="wordle-key wide" type="button" tabIndex="-1" data-key="BACKSPACE" onMouseDown={(event) => event.preventDefault()} onClick={() => onPress("BACKSPACE")} aria-label="Delete">
              <BackspaceKeyIcon />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function BackspaceKeyIcon() {
  return (
    <svg className="wordle-delete-icon" viewBox="0 0 26 24" fill="none" aria-hidden="true">
      <path d="M10.5 5h8A2.5 2.5 0 0 1 21 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-8L5 12l5.5-7Z" />
      <path d="M12 9l5.5 6M17.5 9L12 15" />
    </svg>
  );
}

function StatsModal({ answer, guesses, isClosing, onClose, onNext, stats, status }) {
  const winRate = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
  const maxDistribution = Math.max(1, ...Object.values(stats.distribution || {}));

  return (
    <div className={`wordle-stats-backdrop ${isClosing ? "closing" : ""}`} role="dialog" aria-modal="true" aria-label="Game statistics">
      <section className="wordle-stats-card">
        <button className="wordle-stats-close" type="button" tabIndex="-1" onMouseDown={(event) => event.preventDefault()} onClick={onClose} aria-label="Close stats">x</button>
        <h2>Statistics</h2>
        <div className="wordle-stats-grid">
          <div><b>{stats.played}</b><span>played</span></div>
          <div><b>{winRate}</b><span>win %</span></div>
          <div><b>{stats.streak}</b><span>streak</span></div>
          <div><b>{stats.maxStreak}</b><span>max</span></div>
        </div>

        <h3>Guess Distribution</h3>
        <div className="wordle-distribution">
          {Array.from({ length: WORDLE_ROWS }, (_, index) => {
            const row = index + 1;
            const count = stats.distribution?.[row] || 0;
            const width = `${Math.max(8, (count / maxDistribution) * 100)}%`;
            return (
              <div className="wordle-dist-row" key={row}>
                <span>{row}</span>
                <div className="wordle-dist-track">
                  <div className={`wordle-dist-bar ${guesses.length === row && status === "won" ? "current" : ""}`} style={{ width }}>
                    {count}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="wordle-stats-footer">
          <div>
            <span>answer</span>
            <b>{answer.toUpperCase()}</b>
          </div>
          <button type="button" tabIndex="-1" onMouseDown={(event) => event.preventDefault()} onClick={onNext} disabled={isClosing}>next word</button>
        </div>
      </section>
    </div>
  );
}

window.WordlePage = WordlePage;
