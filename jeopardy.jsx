// jeopardy.jsx — Class-friendly Jeopardy study game backed by quiz questions.
// Exposes window.JeopardyPage.

const { useEffect: useJeopardyEffect, useMemo: useJeopardyMemo, useRef: useJeopardyRef, useState: useJeopardyState } = React;

const JEOPARDY_POINTS = [100, 200, 300, 400, 500];
const JEOPARDY_STORAGE_KEY = "openpt:jeopardy";
const JEOPARDY_MUSIC_SRC = "/jeopardy-theme.m4a";
const JEOPARDY_MUSIC_VOLUME = 0.38;
const JEOPARDY_SFX_VOLUME = 0.58;
const JEOPARDY_TIMER_WARNING_VOLUME = 0.36;
const JEOPARDY_AUDIO_FADE_MS = 520;
const JEOPARDY_CARD_CLOSE_MS = 280;
const JEOPARDY_SFX = {
  tileOpen: "/jeopardy-sfx/tile-open.mp3",
  correct: "/jeopardy-sfx/correct.mp3",
  incorrect: "/jeopardy-sfx/incorrect.mp3",
  timerWarning: "/jeopardy-sfx/timer-warning.mp3",
  answerReveal: "/jeopardy-sfx/answer-reveal.mp3",
  scoreChange: "/jeopardy-sfx/score-change.mp3",
  finalSting: "/jeopardy-sfx/final-sting.mp3",
};

const JEOPARDY_TOPIC_RULES = [
  {
    id: "routing",
    title: "Routing",
    terms: ["ospf", "eigrp", "rip", "bgp", "route", "routing", "router-id", "router id", "neighbor", "adjacency", "lsdb", "spf", "administrative distance", "floating static", "default route", "next-hop"],
  },
  {
    id: "security",
    title: "ACLs & Security",
    terms: ["acl", "access-list", "access control", "permit", "deny", "ssh", "aaa", "attack", "malware", "security", "ipsec", "vpn", "ssl", "firewall", "authentication", "authorization", "accounting"],
  },
  {
    id: "switching",
    title: "Switching",
    terms: ["switch", "vlan", "trunk", "stp", "spanning-tree", "etherchannel", "portfast", "native vlan", "svi", "catalyst", "switchport", "dtp", "vtp"],
  },
  {
    id: "addressing",
    title: "Addressing",
    terms: ["ipv6", "ipv4", "subnet", "mask", "wildcard", "dhcp", "dns", "nat", "pat", "address", "default gateway", "prefix", "slaac"],
  },
  {
    id: "services",
    title: "Services",
    terms: ["snmp", "syslog", "ntp", "tftp", "ftp", "qos", "voice", "video", "traffic", "wan", "cloud", "virtualization", "hypervisor", "logging"],
  },
  {
    id: "automation",
    title: "Automation",
    terms: ["api", "rest", "json", "xml", "yaml", "sdn", "controller", "automation", "northbound", "southbound", "aci"],
  },
  {
    id: "wireless",
    title: "Wireless",
    terms: ["wireless", "802.11", "ssid", "ap", "access point", "wlan", "channel", "roaming", "controller", "wap"],
  },
  {
    id: "vlans",
    title: "VLANs",
    terms: ["vlan", "trunk", "native vlan", "inter-vlan", "router-on-a-stick", "switchport access", "voice vlan"],
  },
  {
    id: "ports",
    title: "Ports",
    terms: ["port", "ports", "interface", "fastethernet", "gigabitethernet", "serial", "duplex", "speed", "err-disabled"],
  },
  {
    id: "redundancy",
    title: "Redundancy",
    terms: ["hsrp", "vrrp", "glbp", "standby", "active router", "virtual ip", "first-hop", "redundancy"],
  },
  {
    id: "etherchannel",
    title: "EtherChannel",
    terms: ["etherchannel", "channel-group", "pagp", "lacp", "port-channel", "bundle"],
  },
  {
    id: "stp",
    title: "STP",
    terms: ["stp", "spanning-tree", "root bridge", "bpdu", "portfast", "blocking", "forwarding"],
  },
  {
    id: "nat",
    title: "NAT",
    terms: ["nat", "pat", "inside local", "inside global", "outside local", "outside global", "translation", "overload"],
  },
  {
    id: "qos",
    title: "QoS",
    terms: ["qos", "queue", "queuing", "marking", "classification", "policing", "shaping", "dscp", "cos"],
  },
  {
    id: "management",
    title: "Management",
    terms: ["snmp", "syslog", "ntp", "cdp", "lldp", "logging", "banner", "password", "enable secret"],
  },
  {
    id: "wan",
    title: "WAN",
    terms: ["wan", "ppp", "pppoe", "mpls", "leased line", "t1", "t3", "e1", "e3", "serial", "metro ethernet"],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting",
    terms: ["troubleshoot", "issue", "problem", "cannot", "unable", "show", "debug", "mismatch", "fails"],
  },
  {
    id: "ipv6",
    title: "IPv6",
    terms: ["ipv6", "link-local", "global unicast", "eui-64", "slaac", "neighbor discovery", "prefix"],
  },
  {
    id: "dhcp-dns",
    title: "DHCP & DNS",
    terms: ["dhcp", "dns", "lease", "pool", "excluded-address", "helper-address", "domain"],
  },
];

function jeopardyHash(value) {
  let hash = 2166136261;
  const text = String(value || "");
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function jeopardyShuffle(items, seed) {
  const out = [...items];
  let state = jeopardyHash(seed) || 1;
  for (let i = out.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function normalizeJeopardyQuestion(item, index) {
  const options = Array.isArray(item?.o) ? item.o.map((option) => String(option || "").trim()).filter(Boolean) : [];
  const answers = Array.isArray(item?.a) ? item.a : [item?.a].filter((value) => Number.isInteger(value));
  const answerText = answers.map((answerIndex) => options[answerIndex]).filter(Boolean);
  const codeLines = Array.isArray(item?.code) ? item.code.map((line) => String(line || "")) : [];
  return {
    id: `${item?.bank || item?.src || "quiz"}-${item?.si || item?.s || index}`,
    prompt: String(item?.q || "").trim(),
    options,
    answerIndexes: answers,
    answerText,
    source: item?.src || item?.bank || "Quiz bank",
    sourceIndex: item?.si || item?.s || index + 1,
    multi: !!item?.m || answers.length > 1,
    exhibit: !!item?.e,
    codeLines,
    explanation: String(item?.x || item?.explanation || "").trim(),
    course: item?.course || "",
    exam: item?.exam || "",
  };
}

function questionTopicText(question) {
  return `${question.prompt} ${question.options.join(" ")} ${question.codeLines.join(" ")} ${question.explanation}`.toLowerCase();
}

function topicScore(question, topic) {
  const text = questionTopicText(question);
  return topic.terms.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0);
}

function questionDifficulty(question) {
  const lengthScore = Math.min(5, Math.floor(question.prompt.length / 95));
  return lengthScore + (question.multi ? 2 : 0) + (question.exhibit ? 1 : 0) + Math.min(2, Math.floor(question.options.length / 4));
}

function defaultJeopardyTeams() {
  return [
    { id: "team-1", name: "Team 1", score: 0 },
    { id: "team-2", name: "Team 2", score: 0 },
    { id: "team-3", name: "Team 3", score: 0 },
  ];
}

function teamSortRank(team, index) {
  const nameRank = String(team?.name || "").match(/^team\s+(\d+)$/i)?.[1];
  const idRank = String(team?.id || "").match(/^team-(\d+)$/i)?.[1];
  const rank = Number(nameRank || idRank);
  return Number.isFinite(rank) && rank > 0 ? rank : 1000 + index;
}

function orderJeopardyTeams(teams) {
  return teams
    .map((team, index) => ({ team, index, rank: teamSortRank(team, index) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((item) => item.team);
}

function todaySeed() {
  const date = new Date();
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function buildJeopardyBoard(rawQuestions, gameSeed, deckId) {
  const normalized = (rawQuestions || [])
    .map(normalizeJeopardyQuestion)
    .filter((question) => question.prompt && question.answerText.length);
  const decked = normalized.filter((question) => deckId === "all" || String(question.source || "") === deckId);
  const pool = decked.length >= JEOPARDY_POINTS.length ? decked : normalized;
  const used = new Set();
  const columns = [];
  const topics = jeopardyShuffle(JEOPARDY_TOPIC_RULES, `${gameSeed}:${deckId}:topics`);
  const makeColumn = (topic, selected, columnIndex) => {
    const sorted = [...selected].sort((a, b) => questionDifficulty(a) - questionDifficulty(b));
    return {
      ...topic,
      clues: JEOPARDY_POINTS.map((points, index) => ({
        id: `${topic.id}-${columnIndex}-${points}`,
        points,
        category: topic.title,
        question: sorted[index],
      })).filter((clue) => clue.question),
    };
  };

  for (const topic of topics) {
    const ranked = pool
      .filter((question) => !used.has(question.id) && topicScore(question, topic) > 0)
      .sort((a, b) => questionDifficulty(a) - questionDifficulty(b));
    const candidates = jeopardyShuffle(ranked, `${gameSeed}:${deckId}:${topic.id}`);
    if (candidates.length < JEOPARDY_POINTS.length) continue;
    const selected = candidates.slice(0, JEOPARDY_POINTS.length);
    selected.forEach((question) => used.add(question.id));
    columns.push(makeColumn(topic, selected, columns.length));
  }

  const leftovers = jeopardyShuffle(
    pool.filter((question) => !used.has(question.id)),
    `${gameSeed}:${deckId}:leftovers`
  );
  for (let index = 0; index + JEOPARDY_POINTS.length <= leftovers.length; index += JEOPARDY_POINTS.length) {
    const selected = leftovers.slice(index, index + JEOPARDY_POINTS.length);
    selected.forEach((question) => used.add(question.id));
    columns.push(makeColumn({
      id: `mixed-${Math.floor(index / JEOPARDY_POINTS.length) + 1}`,
      title: `Mixed Review ${Math.floor(index / JEOPARDY_POINTS.length) + 1}`,
      terms: [],
    }, selected, columns.length));
  }

  if (!columns.length) {
    const fallback = jeopardyShuffle(pool, `${gameSeed}:${deckId}:fallback`);
    for (let index = 0; index + JEOPARDY_POINTS.length <= fallback.length; index += JEOPARDY_POINTS.length) {
      columns.push(makeColumn({
        id: `review-${Math.floor(index / JEOPARDY_POINTS.length) + 1}`,
        title: `Review ${Math.floor(index / JEOPARDY_POINTS.length) + 1}`,
        terms: [],
      }, fallback.slice(index, index + JEOPARDY_POINTS.length), columns.length));
    }
  }

  return jeopardyShuffle(columns, `${gameSeed}:${deckId}:columns`);
}

function ccnaBVersionNumber(source) {
  return Number(String(source || "").match(/quiz\s+(\d+)/i)?.[1] || 0);
}

function versionDeckTitle(source) {
  const version = ccnaBVersionNumber(source);
  return version ? `Version ${version}` : String(source || "Version");
}

function makeDeckOptions(rawQuestions) {
  const sources = [...new Set((rawQuestions || []).map((item) => item?.src).filter(Boolean))]
    .sort((a, b) => ccnaBVersionNumber(a) - ccnaBVersionNumber(b) || String(a).localeCompare(String(b)));
  return [
    { id: "all", title: "All Versions" },
    ...sources.map((source) => ({ id: source, title: versionDeckTitle(source) })),
  ];
}

function JeopardyPage() {
  const rawQuestions = window.QUESTIONS_RAW || [];
  const decks = useJeopardyMemo(() => makeDeckOptions(rawQuestions), [rawQuestions.length]);
  const [deckId, setDeckId] = useJeopardyState(() => {
    try { return JSON.parse(localStorage.getItem(JEOPARDY_STORAGE_KEY) || "{}").deckId || "all"; }
    catch (e) { return "all"; }
  });
  const [seed, setSeed] = useJeopardyState(() => {
    try { return JSON.parse(localStorage.getItem(JEOPARDY_STORAGE_KEY) || "{}").seed || todaySeed(); }
    catch (e) { return todaySeed(); }
  });
  const [teams, setTeams] = useJeopardyState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(JEOPARDY_STORAGE_KEY) || "{}").teams;
      return Array.isArray(saved) && saved.length ? saved : defaultJeopardyTeams();
    } catch (e) {
      return defaultJeopardyTeams();
    }
  });
  const [answered, setAnswered] = useJeopardyState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(JEOPARDY_STORAGE_KEY) || "{}").answered;
      return saved && typeof saved === "object" ? saved : {};
    } catch (e) {
      return {};
    }
  });
  const [activeClue, setActiveClue] = useJeopardyState(null);
  const [clueClosing, setClueClosing] = useJeopardyState(false);
  const [settingsOpen, setSettingsOpen] = useJeopardyState(false);
  const [deckMenuOpen, setDeckMenuOpen] = useJeopardyState(false);
  const [answerShown, setAnswerShown] = useJeopardyState(false);
  const [timer, setTimer] = useJeopardyState(30);
  const [timerRunning, setTimerRunning] = useJeopardyState(false);
  const [finalOpen, setFinalOpen] = useJeopardyState(false);
  const [finalAnswerShown, setFinalAnswerShown] = useJeopardyState(false);
  const [musicEnabled, setMusicEnabled] = useJeopardyState(() => {
    try { return JSON.parse(localStorage.getItem(JEOPARDY_STORAGE_KEY) || "{}").musicEnabled ?? true; }
    catch (e) { return true; }
  });
  const [wagers, setWagers] = useJeopardyState({});
  const [finalScored, setFinalScored] = useJeopardyState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(JEOPARDY_STORAGE_KEY) || "{}").finalScored;
      return saved && typeof saved === "object" ? saved : {};
    } catch (e) {
      return {};
    }
  });
  const musicRef = useJeopardyRef(null);
  const sfxRef = useJeopardyRef({});
  const audioFadeHandlesRef = useJeopardyRef(new WeakMap());
  const timerWarningPlayedRef = useJeopardyRef(false);
  const clueCloseTimerRef = useJeopardyRef(null);

  const board = useJeopardyMemo(() => buildJeopardyBoard(rawQuestions, seed, deckId), [rawQuestions.length, seed, deckId]);
  const allClues = useJeopardyMemo(() => board.flatMap((column) => column.clues), [board]);
  const orderedTeams = useJeopardyMemo(() => orderJeopardyTeams(teams), [teams]);
  const selectedDeck = decks.find((deck) => deck.id === deckId) || decks[0] || { id: "all", title: "All Versions" };
  const finalClue = useJeopardyMemo(() => {
    const candidates = allClues.filter((clue) => !answered[clue.id]);
    return jeopardyShuffle(candidates.length ? candidates : allClues, `${seed}:final`)[0] || null;
  }, [allClues, answered, seed]);
  useJeopardyEffect(() => {
    const root = document.getElementById("root");
    const boot = document.getElementById("boot");
    root?.classList.add("ready");
    boot?.remove();
  }, []);

  useJeopardyEffect(() => () => {
    if (clueCloseTimerRef.current) window.clearTimeout(clueCloseTimerRef.current);
  }, []);

  useJeopardyEffect(() => {
    if (!decks.some((deck) => deck.id === deckId)) setDeckId("all");
  }, [deckId, decks]);

  useJeopardyEffect(() => {
    localStorage.setItem(JEOPARDY_STORAGE_KEY, JSON.stringify({ deckId, seed, teams, answered, musicEnabled, finalScored }));
  }, [deckId, seed, teams, answered, musicEnabled, finalScored]);

  useJeopardyEffect(() => {
    const music = musicRef.current;
    if (!music) return;
    music.loop = true;
    setAudioVolume(music, JEOPARDY_MUSIC_VOLUME);
    sfxRef.current = Object.fromEntries(Object.entries(JEOPARDY_SFX).map(([key, src]) => {
      const audio = new Audio(src);
      audio.preload = "auto";
      setAudioVolume(audio, key === "timerWarning" ? JEOPARDY_TIMER_WARNING_VOLUME : JEOPARDY_SFX_VOLUME);
      return [key, audio];
    }));
    return () => {
      fadeOutAllAudio({ duration: 180 });
    };
  }, []);

  useJeopardyEffect(() => {
    if (!timerRunning) return;
    if (timer <= 0) {
      setTimerRunning(false);
      return;
    }
    const handle = setTimeout(() => setTimer((value) => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(handle);
  }, [timer, timerRunning]);

  useJeopardyEffect(() => {
    if (!activeClue || !timerRunning) return;
    if (timer > 5) timerWarningPlayedRef.current = false;
    if (timer === 5 && !timerWarningPlayedRef.current) {
      timerWarningPlayedRef.current = true;
      playSfx("timerWarning");
    }
  }, [activeClue, timer, timerRunning]);

  useJeopardyEffect(() => {
    const music = musicRef.current;
    if (!music) return;
    const shouldPlay = musicEnabled && ((activeClue && timerRunning && !answerShown) || (finalOpen && !finalAnswerShown));
    if (shouldPlay) {
      cancelAudioFade(music);
      music.play().catch(() => {});
    } else {
      stopMusic();
    }
  }, [musicEnabled, activeClue, timerRunning, answerShown, finalOpen, finalAnswerShown]);

  const getAudioVolume = (audio) => Number(audio?.dataset?.jeopardyVolume || audio?.volume || 1);

  const setAudioVolume = (audio, volume) => {
    if (!audio) return;
    audio.volume = volume;
    audio.dataset.jeopardyVolume = String(volume);
  };

  const clearAudioFade = (audio) => {
    if (!audio) return;
    const handle = audioFadeHandlesRef.current.get(audio);
    if (handle) {
      window.clearInterval(handle);
      audioFadeHandlesRef.current.delete(audio);
    }
  };

  const cancelAudioFade = (audio) => {
    if (!audio) return;
    clearAudioFade(audio);
    audio.volume = getAudioVolume(audio);
  };

  const fadeOutAudio = (audio, { duration = JEOPARDY_AUDIO_FADE_MS, reset = true } = {}) => {
    if (!audio) return;
    clearAudioFade(audio);
    const baseVolume = getAudioVolume(audio);
    const startVolume = Math.min(audio.volume || baseVolume, baseVolume);
    if (audio.paused || startVolume <= 0) {
      audio.pause();
      if (reset) {
        try { audio.currentTime = 0; } catch (e) {}
      }
      audio.volume = baseVolume;
      return;
    }
    const startedAt = performance.now();
    const handle = window.setInterval(() => {
      const progress = Math.min(1, (performance.now() - startedAt) / duration);
      audio.volume = Math.max(0, startVolume * (1 - progress));
      if (progress >= 1) {
        window.clearInterval(handle);
        audioFadeHandlesRef.current.delete(audio);
        audio.pause();
        if (reset) {
          try { audio.currentTime = 0; } catch (e) {}
        }
        audio.volume = baseVolume;
      }
    }, 16);
    audioFadeHandlesRef.current.set(audio, handle);
  };

  const fadeOutSfx = () => {
    Object.values(sfxRef.current || {}).forEach((audio) => fadeOutAudio(audio));
  };

  const fadeOutAllAudio = ({ duration = JEOPARDY_AUDIO_FADE_MS } = {}) => {
    fadeOutAudio(musicRef.current, { duration });
    Object.values(sfxRef.current || {}).forEach((audio) => fadeOutAudio(audio, { duration }));
  };

  const restartMusic = () => {
    const music = musicRef.current;
    if (!music || !musicEnabled) return;
    cancelAudioFade(music);
    try { music.currentTime = 0; } catch (e) {}
    music.play().catch(() => {});
  };

  const playSfx = (key) => {
    if (!musicEnabled) return;
    const audio = sfxRef.current?.[key];
    if (!audio) return;
    cancelAudioFade(audio);
    audio.pause();
    try { audio.currentTime = 0; } catch (e) {}
    audio.play().catch(() => {});
  };

  const stopMusic = () => {
    const music = musicRef.current;
    if (!music) return;
    fadeOutAudio(music);
  };

  const openClue = (clue) => {
    if (!clue || answered[clue.id]) return;
    setSettingsOpen(false);
    setDeckMenuOpen(false);
    if (clueCloseTimerRef.current) {
      window.clearTimeout(clueCloseTimerRef.current);
      clueCloseTimerRef.current = null;
    }
    setClueClosing(false);
    setActiveClue(clue);
    setAnswerShown(false);
    setTimer(30);
    setTimerRunning(false);
    timerWarningPlayedRef.current = false;
    playSfx("tileOpen");
  };

  const closeClue = ({ fadeSfx = true } = {}) => {
    setTimerRunning(false);
    stopMusic();
    if (fadeSfx) fadeOutSfx();
    setClueClosing(true);
    if (clueCloseTimerRef.current) window.clearTimeout(clueCloseTimerRef.current);
    clueCloseTimerRef.current = window.setTimeout(() => {
      setActiveClue(null);
      setClueClosing(false);
      clueCloseTimerRef.current = null;
    }, JEOPARDY_CARD_CLOSE_MS);
  };

  const award = (teamId, delta, clue = activeClue) => {
    if (!teamId || !clue) return;
    playSfx(delta >= 0 ? "correct" : "incorrect");
    setTeams((items) => items.map((team) => team.id === teamId ? { ...team, score: team.score + delta } : team));
    setAnswered((items) => ({ ...items, [clue.id]: { teamId, delta, at: Date.now() } }));
    closeClue({ fadeSfx: false });
  };

  const updateTeam = (teamId, patch) => {
    setTeams((items) => items.map((team) => team.id === teamId ? { ...team, ...patch } : team));
  };

  const addTeam = () => {
    setTeams((items) => {
      if (items.length >= 6) return items;
      const next = items.length + 1;
      return [...items, { id: `team-${Date.now()}`, name: `Team ${next}`, score: 0 }];
    });
  };

  const removeTeam = (teamId) => {
    setTeams((items) => items.length <= 2 ? items : items.filter((team) => team.id !== teamId));
  };

  const resetScores = () => {
    setTeams((items) => items.map((team) => ({ ...team, score: 0 })));
    setWagers({});
    setFinalScored({});
  };

  const resetBoard = () => {
    setDeckMenuOpen(false);
    setAnswered({});
    setActiveClue(null);
    setClueClosing(false);
    setFinalOpen(false);
    setFinalAnswerShown(false);
    setWagers({});
    setFinalScored({});
    setTimerRunning(false);
    fadeOutAllAudio();
  };

  const newGame = () => {
    setSettingsOpen(false);
    setDeckMenuOpen(false);
    setSeed(`${todaySeed()}-${Date.now()}`);
    setAnswered({});
    setActiveClue(null);
    setClueClosing(false);
    setFinalOpen(false);
    setFinalAnswerShown(false);
    setWagers({});
    setFinalScored({});
    setTimerRunning(false);
    setTimer(30);
    fadeOutAllAudio();
  };

  const changeDeck = (nextDeckId) => {
    setDeckId(nextDeckId);
    setDeckMenuOpen(false);
    setAnswered({});
    setActiveClue(null);
    setClueClosing(false);
    setFinalOpen(false);
    setFinalAnswerShown(false);
    setWagers({});
    setFinalScored({});
    setTimerRunning(false);
    fadeOutAllAudio();
  };

  const applyFinal = (teamId, correct) => {
    setFinalScored((items) => {
      if (items[teamId]) return items;
      const team = teams.find((item) => item.id === teamId);
      if (!team) return items;
      const maxWager = Math.max(0, Number(team.score) || 0);
      const wager = Math.min(maxWager, Math.max(0, Number(wagers[teamId]) || 0));
      playSfx(correct ? "correct" : "incorrect");
      setTeams((currentTeams) => currentTeams.map((item) => item.id === teamId ? { ...item, score: item.score + (correct ? wager : -wager) } : item));
      return { ...items, [teamId]: { correct, wager, at: Date.now() } };
    });
  };

  if (!rawQuestions.length) {
    return (
      <div className="jeopardy-root">
        <div className="jeopardy-empty">
          <h1>OpenPT Jeopardy</h1>
          <p>The quiz question bank did not load.</p>
          <button type="button" className="jeopardy-btn primary" onClick={() => location.reload()}>Reload</button>
        </div>
      </div>
    );
  }

  return (
    <div className="jeopardy-root">
      <audio ref={musicRef} src={JEOPARDY_MUSIC_SRC} preload="auto"/>
      <header className="jeopardy-topbar">
        <a className="jeopardy-brand" href="/" aria-label="OpenPT home">
          <span className="jeopardy-glyph" aria-hidden="true"/>
          <span>OpenPT</span>
        </a>
        <div className="jeopardy-controls">
          <button
            type="button"
            className={`jeopardy-icon-btn ${settingsOpen ? "active" : ""}`}
            aria-label="Settings"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((open) => !open)}
          >
            <span aria-hidden="true">⚙</span>
          </button>
          <button type="button" className="jeopardy-btn primary" onClick={newGame}>New Game</button>
          {settingsOpen && (
            <div className="jeopardy-settings-card">
              <label className="jeopardy-setting-label">Set</label>
              <div className="jeopardy-select-wrap custom">
                <button
                  type="button"
                  className="jeopardy-select-button"
                  aria-haspopup="listbox"
                  aria-expanded={deckMenuOpen}
                  onClick={() => setDeckMenuOpen((open) => !open)}
                >
                  <span>{selectedDeck.title}</span>
                  <span className="jeopardy-select-arrow" aria-hidden="true"/>
                </button>
                {deckMenuOpen && (
                  <div className="jeopardy-select-menu" role="listbox">
                    {decks.map((deck) => (
                      <button
                        type="button"
                        role="option"
                        aria-selected={deck.id === deckId}
                        className={deck.id === deckId ? "selected" : ""}
                        key={deck.id}
                        onClick={() => changeDeck(deck.id)}
                      >
                        {deck.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button type="button" className="jeopardy-btn" onClick={resetBoard}>Clear Board</button>
              <button type="button" className="jeopardy-btn" onClick={resetScores}>Reset Scores</button>
              <button type="button" className="jeopardy-btn" onClick={() => { setFinalAnswerShown(false); setFinalOpen(true); playSfx("finalSting"); restartMusic(); }}>Final Jeopardy</button>
              <button
                type="button"
                className={`jeopardy-btn ${musicEnabled ? "active" : ""}`}
                onClick={() => {
                  setMusicEnabled((enabled) => {
                    if (enabled) fadeOutAllAudio();
                    return !enabled;
                  });
                }}
              >
                Audio {musicEnabled ? "On" : "Off"}
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="jeopardy-stage">
        <section className="jeopardy-scoreboard" aria-label="Teams">
          {orderedTeams.map((team) => (
            <div className="jeopardy-team" key={team.id}>
              <input
                aria-label={`${team.name} name`}
                value={team.name}
                onChange={(event) => updateTeam(team.id, { name: event.target.value })}
              />
              <strong>{team.score}</strong>
              <div className="jeopardy-team-actions">
                <button type="button" onClick={() => { playSfx("scoreChange"); updateTeam(team.id, { score: team.score - 100 }); }}>-100</button>
                <button type="button" onClick={() => { playSfx("scoreChange"); updateTeam(team.id, { score: team.score + 100 }); }}>+100</button>
                <button type="button" disabled={teams.length <= 2} onClick={() => removeTeam(team.id)}>Remove</button>
              </div>
            </div>
          ))}
          <button type="button" className="jeopardy-add-team" disabled={teams.length >= 6} onClick={addTeam}>Add Team</button>
        </section>

        <section className="jeopardy-board-shell">
          <div className="jeopardy-board" style={{ "--jeopardy-columns": board.length }}>
            {board.map((column) => (
              <div className="jeopardy-column" key={column.id}>
                <div className="jeopardy-category">{column.title}</div>
                {column.clues.map((clue) => {
                  const done = !!answered[clue.id];
                  return (
                    <button
                      type="button"
                      className={`jeopardy-tile ${done ? "answered" : ""}`}
                      key={clue.id}
                      disabled={done}
                      onClick={() => openClue(clue)}
                    >
                      {done ? "Done" : clue.points}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      </main>

      {activeClue && (
        <div className={`jeopardy-modal-backdrop ${clueClosing ? "closing" : "opening"}`} role="dialog" aria-modal="true" aria-labelledby="jeopardy-clue-title">
          <div className={`jeopardy-modal quiz-card-mode ${answerShown ? "answer-visible" : ""} ${clueClosing ? "closing" : "opening"}`}>
            <div className="jeopardy-modal-head">
              <div>
                <h2 id="jeopardy-clue-title">{activeClue.category} for {activeClue.points}</h2>
              </div>
              <button type="button" className="jeopardy-close" aria-label="Close" onClick={() => closeClue()}>
                <span aria-hidden="true">&times;</span>
              </button>
            </div>

            <div className="jeopardy-awards top">
              {orderedTeams.map((team) => (
                <div className="jeopardy-award-team" key={team.id}>
                  <span>{team.name}</span>
                  <button type="button" onClick={() => award(team.id, activeClue.points)}>Correct</button>
                  <button type="button" onClick={() => award(team.id, -activeClue.points)}>Incorrect</button>
                </div>
              ))}
              <div className="jeopardy-awards-actions">
                <button type="button" className="jeopardy-btn primary" onClick={() => { playSfx("answerReveal"); setAnswerShown(true); stopMusic(); }}>Reveal Answer</button>
                <button type="button" className="jeopardy-btn" onClick={() => {
                  setAnswered((items) => ({ ...items, [activeClue.id]: { skipped: true, at: Date.now() } }));
                  closeClue();
                }}>No Score</button>
              </div>
            </div>

            <div className="jeopardy-modal-body">
              <div className="jeopardy-question-card">
                <h3>{activeClue.question.prompt}</h3>

                {activeClue.question.exhibit && !activeClue.question.codeLines.length && (
                  <div className="jeopardy-note">This quiz-bank item references an exhibit from the original practice set.</div>
                )}
                {activeClue.question.codeLines.length > 0 && (
                  <pre className="jeopardy-code"><code>{activeClue.question.codeLines.join("\n")}</code></pre>
                )}

                <ol className="jeopardy-choice-list">
                  {activeClue.question.options.map((option, index) => (
                    <li key={`${activeClue.id}-option-${index}`} className={answerShown && activeClue.question.answerIndexes.includes(index) ? "correct" : ""}>
                      <span className="jeopardy-choice-marker">{String.fromCharCode(65 + index)}</span>
                      <span className="jeopardy-choice-text">{option}</span>
                    </li>
                  ))}
                </ol>

                {answerShown && activeClue.question.explanation && (
                  <div className="jeopardy-explanation">{activeClue.question.explanation}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {finalOpen && finalClue && (
        <div className="jeopardy-modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="jeopardy-final-title">
          <div className="jeopardy-modal jeopardy-final-modal">
            <div className="jeopardy-modal-head">
              <div>
                <div className="jeopardy-modal-kicker">Final Jeopardy</div>
                <h2 id="jeopardy-final-title">{finalClue.category}</h2>
              </div>
              <button type="button" className="jeopardy-close" onClick={() => { setFinalOpen(false); fadeOutAllAudio(); }}>Close</button>
            </div>
            <div className="jeopardy-modal-body">
              <p className="jeopardy-final-prompt">{finalClue.question.prompt}</p>
              <button type="button" className="jeopardy-btn primary" onClick={() => { playSfx("answerReveal"); setFinalAnswerShown(true); stopMusic(); }}>Reveal Final Answer</button>
              {finalAnswerShown && (
                <div className="jeopardy-answer">
                  <span>Correct answer</span>
                  <strong>{finalClue.question.answerText.join(", ")}</strong>
                  {finalClue.question.explanation && <p>{finalClue.question.explanation}</p>}
                </div>
              )}
              <div className="jeopardy-final-grid">
                {orderedTeams.map((team) => (
                  <div className="jeopardy-final-team" key={team.id}>
                    <span>{team.name}</span>
                    <input
                      type="number"
                      min="0"
                      max={Math.max(0, team.score)}
                      value={wagers[team.id] || ""}
                      placeholder="Wager"
                      onChange={(event) => setWagers((items) => ({ ...items, [team.id]: event.target.value }))}
                      disabled={!!finalScored[team.id]}
                    />
                    <button type="button" disabled={!!finalScored[team.id]} onClick={() => applyFinal(team.id, true)}>Correct</button>
                    <button type="button" disabled={!!finalScored[team.id]} onClick={() => applyFinal(team.id, false)}>Incorrect</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

window.JeopardyPage = JeopardyPage;
