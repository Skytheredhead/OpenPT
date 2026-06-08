// jeopardy.jsx — Class-friendly Jeopardy study game backed by quiz questions.
// Exposes window.JeopardyPage.

const { useEffect: useJeopardyEffect, useMemo: useJeopardyMemo, useRef: useJeopardyRef, useState: useJeopardyState } = React;

const JEOPARDY_POINTS = [100, 200, 300, 400, 500];
const JEOPARDY_VISIBLE_COLUMNS = 5;
const JEOPARDY_DAILY_DOUBLES = 2;
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

const JEOPARDY_EXHIBIT_REFERENCE_RE = /\b(refer to (the )?(exhibit|topology|figure|diagram|output|configuration)|shown in the exhibit|shown by the exhibit|shown below|in the shown|as shown)\b/i;

function enrichJeopardyRawQuestion(item) {
  const enrichments = window.FINAL_STRUCTURED_EXHIBITS || {};
  const key = `${item?.src || ""}#${item?.si || ""}`;
  return enrichments[key] ? { ...item, ...enrichments[key] } : item;
}

function normalizeJeopardyQuestion(item, index) {
  const enriched = enrichJeopardyRawQuestion(item);
  const options = Array.isArray(enriched?.o) ? enriched.o.map((option) => String(option || "").trim()).filter(Boolean) : [];
  const answers = Array.isArray(enriched?.a) ? enriched.a : [enriched?.a].filter((value) => Number.isInteger(value));
  const answerText = answers.map((answerIndex) => options[answerIndex]).filter(Boolean);
  const codeLines = Array.isArray(enriched?.code) ? enriched.code.map((line) => String(line || "")) : [];
  const structuredExhibit = enriched?.exhibit && typeof enriched.exhibit === "object" ? enriched.exhibit : null;
  const exhibitCount = Number(enriched?.e) || (structuredExhibit || codeLines.length ? 1 : 0);
  const hasUsableExhibit = !!structuredExhibit || codeLines.length > 0;
  return {
    id: `${enriched?.bank || enriched?.src || "quiz"}-${enriched?.si || enriched?.s || index}`,
    prompt: String(enriched?.q || "").trim(),
    options,
    answerIndexes: answers,
    answerText,
    source: enriched?.src || enriched?.bank || "Quiz bank",
    sourceIndex: enriched?.si || enriched?.s || index + 1,
    multi: !!enriched?.m || answers.length > 1,
    hasExhibit: exhibitCount > 0,
    hasUsableExhibit,
    missingReferencedExhibit: JEOPARDY_EXHIBIT_REFERENCE_RE.test(enriched?.q || "") && !hasUsableExhibit,
    exhibitCount,
    exhibit: structuredExhibit,
    codeLines,
    explanation: String(enriched?.x || enriched?.explanation || "").trim(),
    course: enriched?.course || "",
    exam: enriched?.exam || "",
    lab: !!enriched?.lab,
  };
}

function questionTopicText(question) {
  return `${question.prompt} ${question.options.join(" ")} ${question.codeLines.join(" ")} ${question.explanation}`.toLowerCase();
}

function topicScore(question, topic) {
  const text = questionTopicText(question);
  return topic.terms.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0);
}

function bestTopicForQuestions(questions, salt = 0) {
  let best = null;
  for (const topic of JEOPARDY_TOPIC_RULES) {
    const score = questions.reduce((total, question) => total + topicScore(question, topic), 0);
    if (!best || score > best.score) best = { topic, score };
  }
  return best?.score > 0 ? best.topic : JEOPARDY_TOPIC_RULES[salt % JEOPARDY_TOPIC_RULES.length];
}

function questionDifficulty(question) {
  const lengthScore = Math.min(5, Math.floor(question.prompt.length / 95));
  return lengthScore + (question.multi ? 2 : 0) + (question.hasExhibit ? 1 : 0) + Math.min(2, Math.floor(question.options.length / 4));
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

function buildJeopardyColumns(rawQuestions, gameSeed, deckId) {
  const normalized = (rawQuestions || [])
    .map(normalizeJeopardyQuestion)
    .filter((question) => question.prompt && question.answerText.length && !question.lab && !question.missingReferencedExhibit);
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
    const topic = bestTopicForQuestions(selected, columns.length);
    columns.push(makeColumn({
      ...topic,
      id: `${topic.id}-extra-${Math.floor(index / JEOPARDY_POINTS.length) + 1}`,
    }, selected, columns.length));
  }

  if (!columns.length) {
    const fallback = jeopardyShuffle(pool, `${gameSeed}:${deckId}:fallback`);
    for (let index = 0; index + JEOPARDY_POINTS.length <= fallback.length; index += JEOPARDY_POINTS.length) {
      columns.push(makeColumn({
        ...JEOPARDY_TOPIC_RULES[Math.floor(index / JEOPARDY_POINTS.length) % JEOPARDY_TOPIC_RULES.length],
        id: `fallback-${Math.floor(index / JEOPARDY_POINTS.length) + 1}`,
      }, fallback.slice(index, index + JEOPARDY_POINTS.length), columns.length));
    }
  }

  return jeopardyShuffle(columns, `${gameSeed}:${deckId}:columns`);
}

function buildJeopardyBoard(rawQuestions, gameSeed, deckId, boardRound = 0) {
  const columns = buildJeopardyColumns(rawQuestions, gameSeed, deckId);
  const visibleColumns = columns.length <= JEOPARDY_VISIBLE_COLUMNS ? columns : (() => {
    const start = (Math.max(0, Number(boardRound) || 0) * JEOPARDY_VISIBLE_COLUMNS) % columns.length;
    const ordered = Array.from({ length: columns.length }, (_, index) => columns[(start + index) % columns.length]);
    const titles = new Set();
    const selected = [];
    for (const column of ordered) {
      if (titles.has(column.title)) continue;
      selected.push(column);
      titles.add(column.title);
      if (selected.length === JEOPARDY_VISIBLE_COLUMNS) return selected;
    }
    for (const column of ordered) {
      if (selected.includes(column)) continue;
      selected.push(column);
      if (selected.length === JEOPARDY_VISIBLE_COLUMNS) return selected;
    }
    return selected;
  })();
  const dailyDoubleIds = new Set(
    jeopardyShuffle(
      visibleColumns.flatMap((column) => column.clues.map((clue) => clue.id)),
      `${gameSeed}:${deckId}:${boardRound}:daily-doubles`
    ).slice(0, Math.min(JEOPARDY_DAILY_DOUBLES, visibleColumns.flatMap((column) => column.clues).length))
  );
  return visibleColumns.map((column) => ({
    ...column,
    clues: column.clues.map((clue) => ({ ...clue, dailyDouble: dailyDoubleIds.has(clue.id) })),
  }));
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

function jeopardyNodeBadge(kind) {
  switch (kind) {
    case "router": return "R";
    case "l2switch": return "SW";
    case "server": return "SRV";
    case "internet": return "NET";
    case "cloud": return "WAN";
    case "pc":
    default: return "PC";
  }
}

const JeopardyQuestionExhibit = ({ question }) => {
  const blocks = [];
  if (question.exhibit?.type === "topology") {
    blocks.push(<JeopardyTopologyExhibit key="topology" exhibit={question.exhibit} />);
  }
  if (question.codeLines.length > 0) {
    blocks.push(<JeopardyCodeExhibit key="code" lines={question.codeLines} />);
  }
  if (blocks.length) return <div className="jeopardy-exhibit-stack">{blocks}</div>;
  if (!question.hasExhibit) return null;
  return (
    <div className="jeopardy-note">
      This imported item references an exhibit from the original practice set, but no structured exhibit was found.
    </div>
  );
};

const JeopardyCodeExhibit = ({ lines }) => (
  <pre className="jeopardy-code"><code>{lines.join("\n")}</code></pre>
);

const JeopardyTopologyExhibit = ({ exhibit }) => {
  const nodes = exhibit.nodes || [];
  const byId = Object.fromEntries(nodes.map((node) => [node.id, node]));
  const links = exhibit.links || [];
  const linkLabels = links.flatMap((link, index) => {
    const a = byId[link.from];
    const b = byId[link.to];
    if (!a || !b || !link.label) return [];
    return [{
      key: `${link.from}-${link.to}-${index}-label`,
      label: link.label,
      type: link.type || "ethernet",
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
    }];
  });
  return (
    <div className="jeopardy-topology" aria-label={exhibit.title || "Network topology exhibit"}>
      {exhibit.title && <div className="jeopardy-topology-title">{exhibit.title}</div>}
      <svg className="jeopardy-topology-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {links.map((link, index) => {
          const a = byId[link.from];
          const b = byId[link.to];
          if (!a || !b) return null;
          return (
            <line
              key={`${link.from}-${link.to}-${index}`}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className={`jeopardy-topology-link ${link.type || "ethernet"}`}
            />
          );
        })}
      </svg>
      {linkLabels.map((link) => (
        <div
          key={link.key}
          className={`jeopardy-topology-link-label ${link.type}`}
          style={{ left: `${link.x}%`, top: `${link.y}%` }}
        >
          {link.label}
        </div>
      ))}
      {nodes.map((node) => (
        <div
          key={node.id}
          className={`jeopardy-topology-node ${node.kind || "pc"}`}
          style={{ left: `${node.x}%`, top: `${node.y}%` }}
        >
          <div className="jeopardy-topology-glyph">{jeopardyNodeBadge(node.kind)}</div>
          <div className="jeopardy-topology-node-label">{node.label}</div>
        </div>
      ))}
    </div>
  );
};

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
  const [boardRound, setBoardRound] = useJeopardyState(() => {
    try { return Number(JSON.parse(localStorage.getItem(JEOPARDY_STORAGE_KEY) || "{}").boardRound) || 0; }
    catch (e) { return 0; }
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
  const [selectedAnswers, setSelectedAnswers] = useJeopardyState([]);
  const [timer, setTimer] = useJeopardyState(30);
  const [timerRunning, setTimerRunning] = useJeopardyState(false);
  const [scoreMultiplier, setScoreMultiplier] = useJeopardyState(() => {
    try { return Number(JSON.parse(localStorage.getItem(JEOPARDY_STORAGE_KEY) || "{}").scoreMultiplier) || 1; }
    catch (e) { return 1; }
  });
  const [activeTeamId, setActiveTeamId] = useJeopardyState(() => {
    try { return JSON.parse(localStorage.getItem(JEOPARDY_STORAGE_KEY) || "{}").activeTeamId || "team-1"; }
    catch (e) { return "team-1"; }
  });
  const [dailyDoubleWager, setDailyDoubleWager] = useJeopardyState("");
  const [boardPhase, setBoardPhase] = useJeopardyState("");
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
  const boardAdvanceTimerRef = useJeopardyRef(null);
  const settingsButtonRef = useJeopardyRef(null);
  const settingsCardRef = useJeopardyRef(null);

  const board = useJeopardyMemo(() => buildJeopardyBoard(rawQuestions, seed, deckId, boardRound), [rawQuestions.length, seed, deckId, boardRound]);
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
    if (boardAdvanceTimerRef.current) window.clearTimeout(boardAdvanceTimerRef.current);
  }, []);

  useJeopardyEffect(() => {
    if (!decks.some((deck) => deck.id === deckId)) setDeckId("all");
  }, [deckId, decks]);

  useJeopardyEffect(() => {
    localStorage.setItem(JEOPARDY_STORAGE_KEY, JSON.stringify({ deckId, seed, boardRound, teams, answered, musicEnabled, finalScored, scoreMultiplier, activeTeamId }));
  }, [deckId, seed, boardRound, teams, answered, musicEnabled, finalScored, scoreMultiplier, activeTeamId]);

  useJeopardyEffect(() => {
    if (!teams.some((team) => team.id === activeTeamId)) setActiveTeamId(orderedTeams[0]?.id || "team-1");
  }, [teams, activeTeamId, orderedTeams]);

  useJeopardyEffect(() => {
    if (!settingsOpen) return;
    const closeIfOutside = (event) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (settingsButtonRef.current?.contains(target) || settingsCardRef.current?.contains(target)) return;
      setSettingsOpen(false);
      setDeckMenuOpen(false);
    };
    document.addEventListener("pointerdown", closeIfOutside, true);
    document.addEventListener("focusin", closeIfOutside, true);
    return () => {
      document.removeEventListener("pointerdown", closeIfOutside, true);
      document.removeEventListener("focusin", closeIfOutside, true);
    };
  }, [settingsOpen]);

  useJeopardyEffect(() => {
    if (!allClues.length) return;
    const complete = allClues.every((clue) => answered[clue.id]);
    if (!complete) return;
    if (boardAdvanceTimerRef.current) window.clearTimeout(boardAdvanceTimerRef.current);
    boardAdvanceTimerRef.current = window.setTimeout(() => {
      setBoardPhase("flip-out");
      boardAdvanceTimerRef.current = window.setTimeout(() => {
      setAnswered({});
      setActiveClue(null);
      setClueClosing(false);
      setBoardRound((round) => round + 1);
      setScoreMultiplier((multiplier) => multiplier < 2 ? 2 : multiplier < 3 ? 3 : 3);
      setBoardPhase("flip-in");
        boardAdvanceTimerRef.current = window.setTimeout(() => {
          setBoardPhase("");
          boardAdvanceTimerRef.current = null;
        }, 420);
      }, 320);
    }, 520);
    return () => {
      if (boardAdvanceTimerRef.current) {
        window.clearTimeout(boardAdvanceTimerRef.current);
        boardAdvanceTimerRef.current = null;
      }
    };
  }, [allClues, answered]);

  useJeopardyEffect(() => {
    if (!activeClue) return;
    const handle = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const key = String(event.key || "").toLowerCase();
      const index = key.length === 1 ? key.charCodeAt(0) - 97 : -1;
      if (index >= 0 && index < activeClue.question.options.length) {
        event.preventDefault();
        toggleChoice(index);
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [activeClue, answerShown, selectedAnswers]);

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

  const clueValue = (clue = activeClue) => (Number(clue?.points) || 0) * scoreMultiplier;

  const clueScoreDelta = (delta, clue = activeClue) => {
    if (!clue) return 0;
    const sign = delta < 0 ? -1 : 1;
    const wager = Number(dailyDoubleWager);
    const value = clue.dailyDouble && Number.isFinite(wager) && wager > 0 ? wager : clueValue(clue);
    return sign * value;
  };

  const toggleMultiplier = (multiplier) => {
    setScoreMultiplier(multiplier);
  };

  const openFinalJeopardy = () => {
    setSettingsOpen(false);
    setDeckMenuOpen(false);
    setFinalAnswerShown(false);
    setFinalOpen(true);
    playSfx("finalSting");
    restartMusic();
  };

  const revealAnswer = () => {
    if (answerShown) return;
    playSfx("answerReveal");
    setAnswerShown(true);
    stopMusic();
  };

  const toggleChoice = (index) => {
    if (!activeClue || answerShown) return;
    if (activeClue.question.multi) {
      const requiredAnswers = activeClue.question.answerIndexes.length;
      const alreadySelected = selectedAnswers.includes(index);
      const nextAnswers = alreadySelected
        ? selectedAnswers.filter((item) => item !== index)
        : selectedAnswers.length >= requiredAnswers
          ? selectedAnswers
          : [...selectedAnswers, index];
      setSelectedAnswers(nextAnswers);
      if (!alreadySelected && nextAnswers.length >= requiredAnswers) revealAnswer();
      return;
    }
    setSelectedAnswers([index]);
    revealAnswer();
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
    setSelectedAnswers([]);
    setDailyDoubleWager(String(clueValue(clue)));
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
    const scoreDelta = clueScoreDelta(delta, clue);
    setActiveTeamId(teamId);
    setTeams((items) => items.map((team) => team.id === teamId ? { ...team, score: team.score + scoreDelta } : team));
    setAnswered((items) => ({ ...items, [clue.id]: { teamId, delta: scoreDelta, dailyDouble: !!clue.dailyDouble, at: Date.now() } }));
    closeClue({ fadeSfx: false });
  };

  const updateTeam = (teamId, patch) => {
    setTeams((items) => items.map((team) => team.id === teamId ? { ...team, ...patch } : team));
  };

  const addTeam = () => {
    setTeams((items) => {
      if (items.length >= 6) return items;
      const next = items.length + 1;
      const team = { id: `team-${Date.now()}`, name: `Team ${next}`, score: 0 };
      setActiveTeamId((current) => current || team.id);
      return [...items, team];
    });
  };

  const removeTeam = (teamId) => {
    setTeams((items) => {
      if (items.length <= 2) return items;
      const next = items.filter((team) => team.id !== teamId);
      if (activeTeamId === teamId) setActiveTeamId(next[0]?.id || "team-1");
      return next;
    });
  };

  const resetScores = () => {
    setTeams((items) => items.map((team) => ({ ...team, score: 0 })));
    setWagers({});
    setFinalScored({});
  };

  const resetBoard = () => {
    setDeckMenuOpen(false);
    if (boardAdvanceTimerRef.current) {
      window.clearTimeout(boardAdvanceTimerRef.current);
      boardAdvanceTimerRef.current = null;
    }
    setAnswered({});
    setActiveClue(null);
    setClueClosing(false);
    setSelectedAnswers([]);
    setBoardPhase("");
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
    if (boardAdvanceTimerRef.current) {
      window.clearTimeout(boardAdvanceTimerRef.current);
      boardAdvanceTimerRef.current = null;
    }
    setSeed(`${todaySeed()}-${Date.now()}`);
    setBoardRound(0);
    setAnswered({});
    setActiveClue(null);
    setClueClosing(false);
    setSelectedAnswers([]);
    setBoardPhase("");
    setScoreMultiplier(1);
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
    if (boardAdvanceTimerRef.current) {
      window.clearTimeout(boardAdvanceTimerRef.current);
      boardAdvanceTimerRef.current = null;
    }
    setBoardRound(0);
    setAnswered({});
    setActiveClue(null);
    setClueClosing(false);
    setSelectedAnswers([]);
    setBoardPhase("");
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
          <div className="jeopardy-multiplier" aria-label="Jeopardy multiplier">
            <button type="button" className={scoreMultiplier === 1 ? "active" : ""} onClick={() => toggleMultiplier(1)}>x1</button>
            <button type="button" className={scoreMultiplier === 2 ? "active" : ""} onClick={() => toggleMultiplier(2)}>x2</button>
            <button type="button" className={scoreMultiplier === 3 ? "active" : ""} onClick={() => toggleMultiplier(3)}>x3</button>
            <button type="button" className="final" onClick={openFinalJeopardy}>Final</button>
          </div>
          <button
            ref={settingsButtonRef}
            type="button"
            className={`jeopardy-icon-btn ${settingsOpen ? "active" : ""}`}
            aria-label="Settings"
            aria-expanded={settingsOpen}
            onClick={() => {
              setSettingsOpen((open) => {
                if (open) setDeckMenuOpen(false);
                return !open;
              });
            }}
          >
            <span aria-hidden="true">⚙</span>
          </button>
          <button type="button" className="jeopardy-btn primary" onClick={newGame}>New Game</button>
          {settingsOpen && (
            <div className="jeopardy-settings-card" ref={settingsCardRef}>
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
            <div className={`jeopardy-team ${team.id === activeTeamId ? "active" : ""}`} key={team.id}>
              <div className="jeopardy-team-head">
                <input
                  aria-label={`${team.name} name`}
                  value={team.name}
                  onFocus={() => setActiveTeamId(team.id)}
                  onChange={(event) => updateTeam(team.id, { name: event.target.value })}
                />
                <strong>{team.score}</strong>
              </div>
              <div className="jeopardy-current-turn" aria-hidden={team.id !== activeTeamId}>
                {team.id === activeTeamId ? "Current Turn" : " "}
              </div>
              <div className="jeopardy-team-actions">
                <button type="button" onClick={() => { setActiveTeamId(team.id); playSfx("scoreChange"); updateTeam(team.id, { score: team.score - 100 }); }}>-100</button>
                <button type="button" onClick={() => { setActiveTeamId(team.id); playSfx("scoreChange"); updateTeam(team.id, { score: team.score + 100 }); }}>+100</button>
                <button type="button" disabled={teams.length <= 2} onClick={() => removeTeam(team.id)}>Remove</button>
              </div>
            </div>
          ))}
          <button type="button" className="jeopardy-add-team" disabled={teams.length >= 6} onClick={addTeam}>Add Team</button>
        </section>

        <section className="jeopardy-board-shell">
          <div className={`jeopardy-board ${boardPhase}`} style={{ "--jeopardy-columns": board.length }}>
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
                      data-daily-double={clue.dailyDouble ? "true" : undefined}
                      onClick={() => openClue(clue)}
                    >
                      {done ? "Done" : clueValue(clue)}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </section>
      </main>

      {activeClue && (
        <div
          className={`jeopardy-modal-backdrop ${clueClosing ? "closing" : "opening"}`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="jeopardy-clue-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeClue();
          }}
        >
          <div className={`jeopardy-modal quiz-card-mode ${answerShown ? "answer-visible" : ""} ${clueClosing ? "closing" : "opening"}`}>
            <div className="jeopardy-modal-head">
              <div>
                <h2 id="jeopardy-clue-title">
                  {activeClue.dailyDouble ? "Daily Double" : `${activeClue.category} for ${clueValue(activeClue)}`}
                </h2>
                {activeClue.dailyDouble && (
                  <div className="jeopardy-modal-kicker">{activeClue.category} for {clueValue(activeClue)}</div>
                )}
              </div>
              <button type="button" className="jeopardy-close" aria-label="Close" onClick={() => closeClue()}>
                <span aria-hidden="true">&times;</span>
              </button>
            </div>

            <div className="jeopardy-modal-body">
              <div className="jeopardy-question-card">
                <h3>{activeClue.question.prompt}</h3>

                <JeopardyQuestionExhibit question={activeClue.question} />

                <ol className="jeopardy-choice-list">
                  {activeClue.question.options.map((option, index) => (
                    <li key={`${activeClue.id}-option-${index}`}>
                      <button
                        type="button"
                        className={[
                          "jeopardy-choice",
                          selectedAnswers.includes(index) ? "selected" : "",
                          answerShown && activeClue.question.answerIndexes.includes(index) ? "correct" : "",
                          answerShown && selectedAnswers.includes(index) && !activeClue.question.answerIndexes.includes(index) ? "incorrect" : "",
                        ].filter(Boolean).join(" ")}
                        onClick={() => toggleChoice(index)}
                      >
                        <span className="jeopardy-choice-marker">{String.fromCharCode(65 + index)}</span>
                        <span className="jeopardy-choice-text">{option}</span>
                      </button>
                    </li>
                  ))}
                </ol>

                {answerShown && activeClue.question.explanation && (
                  <div className="jeopardy-explanation">{activeClue.question.explanation}</div>
                )}
              </div>
            </div>

            <div className="jeopardy-awards bottom">
              {activeClue.dailyDouble && (
                <label className="jeopardy-daily-wager">
                  <span>Daily Double Wager</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={dailyDoubleWager}
                    onChange={(event) => setDailyDoubleWager(event.target.value)}
                  />
                </label>
              )}
              <div className="jeopardy-awards-actions">
                <button type="button" className="jeopardy-btn primary" onClick={revealAnswer}>Reveal Answer</button>
                <button type="button" className="jeopardy-btn" onClick={() => {
                  setAnswered((items) => ({ ...items, [activeClue.id]: { skipped: true, at: Date.now() } }));
                  closeClue();
                }}>No Score</button>
              </div>
              <div className="jeopardy-award-teams">
                {orderedTeams.map((team) => (
                  <div className={`jeopardy-award-team ${team.id === activeTeamId ? "active" : ""}`} key={team.id}>
                    <span>{team.name}</span>
                    <button type="button" onClick={() => award(team.id, activeClue.points)}>Correct</button>
                    <button type="button" onClick={() => award(team.id, -activeClue.points)}>Incorrect</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {finalOpen && finalClue && (
        <div
          className="jeopardy-modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="jeopardy-final-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setFinalOpen(false);
              fadeOutAllAudio();
            }
          }}
        >
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
