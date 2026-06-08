// subnet-games.jsx — subnet memorization arcade pages

const {
  useCallback: useSubnetGameCallback,
  useEffect: useSubnetGameEffect,
  useMemo: useSubnetGameMemo,
  useRef: useSubnetGameRef,
  useState: useSubnetGameState,
} = React;

const SUBNET_GAME_CIDRS = [17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30];
const SUBNET_GAME_STORAGE_KEY = "openpt.subnetGames.stats.v1";
const SUBNET_GAME_TICK_MS = 1000;

function subnetGameRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function subnetGameIpToInt(ip) {
  return ip.split(".").reduce((acc, octet) => ((acc << 8) | (Number(octet) & 255)) >>> 0, 0) >>> 0;
}

function subnetGameIntToIp(value) {
  const int = value >>> 0;
  return [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join(".");
}

function subnetGameMaskInt(cidr) {
  return cidr === 0 ? 0 : (0xffffffff << (32 - cidr)) >>> 0;
}

function subnetGameMask(cidr) {
  return subnetGameIntToIp(subnetGameMaskInt(cidr));
}

function subnetGamePrivateIp() {
  const pool = subnetGameRandomInt(0, 2);
  if (pool === 0) return `10.${subnetGameRandomInt(0, 255)}.${subnetGameRandomInt(0, 255)}.${subnetGameRandomInt(1, 254)}`;
  if (pool === 1) return `172.${subnetGameRandomInt(16, 31)}.${subnetGameRandomInt(0, 255)}.${subnetGameRandomInt(1, 254)}`;
  return `192.168.${subnetGameRandomInt(0, 255)}.${subnetGameRandomInt(1, 254)}`;
}

function subnetGameInterestingOctet(cidr) {
  return Math.floor(cidr / 8);
}

function subnetGameBlockSize(cidr) {
  const maskOctets = subnetGameMask(cidr).split(".").map(Number);
  const index = subnetGameInterestingOctet(cidr);
  return 256 - maskOctets[index];
}

function subnetGameOctetName(index) {
  return ["first", "second", "third", "fourth"][index] || "target";
}

function subnetGameDescribeBlockSize(cidr) {
  const index = subnetGameInterestingOctet(cidr);
  return `${subnetGameBlockSize(cidr)} in the ${subnetGameOctetName(index)} octet`;
}

function subnetGameAnalyze(ip, cidr) {
  const ipInt = subnetGameIpToInt(ip);
  const mask = subnetGameMaskInt(cidr);
  const networkInt = (ipInt & mask) >>> 0;
  const broadcastInt = (networkInt | (~mask >>> 0)) >>> 0;
  const firstInt = Math.min(broadcastInt, networkInt + 1) >>> 0;
  const lastInt = Math.max(networkInt, broadcastInt - 1) >>> 0;
  return {
    ip,
    cidr,
    mask: subnetGameMask(cidr),
    network: subnetGameIntToIp(networkInt),
    broadcast: subnetGameIntToIp(broadcastInt),
    firstHost: subnetGameIntToIp(firstInt),
    lastHost: subnetGameIntToIp(lastInt),
    networkInt,
    broadcastInt,
    blockSize: subnetGameBlockSize(cidr),
    blockText: subnetGameDescribeBlockSize(cidr),
    hostCount: Math.max(0, 2 ** (32 - cidr) - 2),
  };
}

function subnetGameMakeSubnet() {
  const cidr = SUBNET_GAME_CIDRS[subnetGameRandomInt(0, SUBNET_GAME_CIDRS.length - 1)];
  return subnetGameAnalyze(subnetGamePrivateIp(), cidr);
}

function subnetGameIpInside(ip, subnet) {
  const ipInt = subnetGameIpToInt(ip);
  return ipInt >= subnet.networkInt && ipInt <= subnet.broadcastInt;
}

function subnetGameRandomHostIn(subnet) {
  const min = subnet.networkInt + 1;
  const max = Math.max(min, subnet.broadcastInt - 1);
  return subnetGameIntToIp(subnetGameRandomInt(min, max) >>> 0);
}

function subnetGameRandomHostOutside(subnet) {
  for (let i = 0; i < 80; i++) {
    const candidate = subnetGamePrivateIp();
    if (!subnetGameIpInside(candidate, subnet)) return candidate;
  }
  return subnetGameIntToIp((subnet.broadcastInt + subnetGameRandomInt(2, 2000)) >>> 0);
}

function subnetGameExplanation(subnet) {
  return `/${subnet.cidr} is ${subnet.mask}; block size ${subnet.blockText}; range ${subnet.network} to ${subnet.broadcast}.`;
}

function subnetGameShuffle(items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = subnetGameRandomInt(0, i);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function subnetGameUniqueChoices(correct, makeChoice, count = 4) {
  const values = [correct];
  let guard = 0;
  while (values.length < count && guard < 80) {
    const next = makeChoice();
    if (next && !values.includes(next)) values.push(next);
    guard += 1;
  }
  return subnetGameShuffle(values);
}

function subnetGameLoadStats() {
  try {
    const saved = JSON.parse(localStorage.getItem(SUBNET_GAME_STORAGE_KEY) || "null");
    return saved && typeof saved === "object" ? saved : {};
  } catch (err) {
    return {};
  }
}

function subnetGameSaveStats(stats) {
  try {
    localStorage.setItem(SUBNET_GAME_STORAGE_KEY, JSON.stringify(stats));
  } catch (err) {}
}

function subnetGameHighScore(gameId, score) {
  const stats = subnetGameLoadStats();
  const next = Math.max(Number(stats[gameId] || 0), score);
  subnetGameSaveStats({ ...stats, [gameId]: next });
  return next;
}

function makeFirewallChallenge() {
  const subnet = subnetGameMakeSubnet();
  const shouldPermit = Math.random() > 0.5;
  const packetIp = shouldPermit ? subnetGameRandomHostIn(subnet) : subnetGameRandomHostOutside(subnet);
  return {
    id: `${Date.now()}-${Math.random()}`,
    subnet,
    packetIp,
    shouldPermit,
  };
}

function makeBombQuestion() {
  const subnet = subnetGameMakeSubnet();
  const types = [
    {
      key: "network",
      label: "Network address",
      prompt: "Cut the wire for the network address.",
      answer: subnet.network,
      distractor: () => subnetGameAnalyze(subnetGamePrivateIp(), subnet.cidr).network,
    },
    {
      key: "broadcast",
      label: "Broadcast",
      prompt: "Cut the wire for the broadcast address.",
      answer: subnet.broadcast,
      distractor: () => subnetGameAnalyze(subnetGamePrivateIp(), subnet.cidr).broadcast,
    },
    {
      key: "first",
      label: "First host",
      prompt: "Cut the wire for the first usable host.",
      answer: subnet.firstHost,
      distractor: () => subnetGameAnalyze(subnetGamePrivateIp(), subnet.cidr).firstHost,
    },
    {
      key: "last",
      label: "Last host",
      prompt: "Cut the wire for the last usable host.",
      answer: subnet.lastHost,
      distractor: () => subnetGameAnalyze(subnetGamePrivateIp(), subnet.cidr).lastHost,
    },
    {
      key: "mask",
      label: "Mask",
      prompt: "Cut the wire for the subnet mask.",
      answer: subnet.mask,
      distractor: () => subnetGameMask(SUBNET_GAME_CIDRS[subnetGameRandomInt(0, SUBNET_GAME_CIDRS.length - 1)]),
    },
    {
      key: "block",
      label: "Block size",
      prompt: "Cut the wire for the block size.",
      answer: subnet.blockText,
      distractor: () => subnetGameDescribeBlockSize(SUBNET_GAME_CIDRS[subnetGameRandomInt(0, SUBNET_GAME_CIDRS.length - 1)]),
    },
  ];
  const type = types[subnetGameRandomInt(0, types.length - 1)];
  return {
    id: `${Date.now()}-${Math.random()}`,
    subnet,
    type,
    choices: subnetGameUniqueChoices(type.answer, type.distractor),
  };
}

function SubnetGamesNav({ compact = false }) {
  return (
    <nav className={`subnet-games-nav ${compact ? "compact" : ""}`}>
      <a className="subnet-games-brand-link" href="/games">
        <span className="subnet-games-brand-glyph"></span>
        OpenPT <b>Games</b>
      </a>
      <div className="subnet-games-nav-links">
        <a href="/games">Library</a>
        <a href="/firewall">Firewall</a>
        <a href="/bomb">Bomb Squad</a>
        <a href="/wordle">Wordle</a>
        <a href="/jeopardy">Jeopardy</a>
      </div>
    </nav>
  );
}

function SubnetGamesPage() {
  const games = [
    {
      href: "/firewall",
      title: "Firewall Defender",
      tag: "Subnet membership",
      body: "Permit trusted packets and drop impostors before the scan bar drains.",
      stat: "Inside or outside",
      meta: "CIDR range checks",
    },
    {
      href: "/bomb",
      title: "Broadcast Bomb Squad",
      tag: "Network and broadcast",
      body: "Cut the right subnet wire under pressure: mask, block, host range, broadcast.",
      stat: "Timed defusal",
      meta: "Broadcast drills",
    },
    {
      href: "/wordle",
      title: "CCNA Wordle",
      tag: "Terms",
      body: "Guess networking vocabulary with a daily puzzle feel.",
      stat: "Vocabulary recall",
      meta: "Term practice",
    },
    {
      href: "/jeopardy",
      title: "Jeopardy",
      tag: "Quiz bank",
      body: "Classroom-style board play from the OpenPT CCNA question bank.",
      stat: "Team review",
      meta: "Question bank",
    },
  ];

  return (
    <main className="subnet-games-page subnet-library-page">
      <div className="subnet-library-centered">
        <div className="subnet-library-stack">
          <div className="subnet-library-brand">
            <div className="subnet-library-glyph"></div>
            <div className="subnet-library-name">
              OpenPT <span>Arcade</span>
            </div>
          </div>

          <section className="subnet-library-card">
            <header className="subnet-library-head">
              <div className="subnet-library-title">
                <span className="subnet-library-title-glyph"></span>
                games
              </div>
              <div className="subnet-library-meta">4 trainers</div>
            </header>

            <div className="subnet-library-grid" aria-label="Game library">
              {games.map((game) => (
                <a className="subnet-library-game-card" href={game.href} key={game.href}>
                  <div className="subnet-library-game-top">
                    <span>{game.tag}</span>
                    <b>{game.meta}</b>
                  </div>
                  <h2>{game.title}</h2>
                  <p>{game.body}</p>
                  <strong>{game.stat}</strong>
                </a>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function FirewallDefenderPage() {
  const [challenge, setChallenge] = useSubnetGameState(() => makeFirewallChallenge());
  const [score, setScore] = useSubnetGameState(0);
  const [streak, setStreak] = useSubnetGameState(0);
  const [lives, setLives] = useSubnetGameState(3);
  const [seconds, setSeconds] = useSubnetGameState(10);
  const [feedback, setFeedback] = useSubnetGameState("Scan the packet and choose fast.");
  const [status, setStatus] = useSubnetGameState("playing");
  const [highScore, setHighScore] = useSubnetGameState(() => Number(subnetGameLoadStats().firewall || 0));
  const nextTimerRef = useSubnetGameRef(null);

  const level = Math.floor(score / 600) + 1;
  const scanPercent = Math.max(0, Math.min(100, (seconds / 10) * 100));

  const nextChallenge = useSubnetGameCallback(() => {
    setChallenge(makeFirewallChallenge());
    setSeconds(Math.max(5, 10 - Math.floor(level / 2)));
    setStatus("playing");
  }, [level]);

  const finishRound = useSubnetGameCallback((wasCorrect, reason = "") => {
    if (status === "finished") return;
    const explanation = subnetGameExplanation(challenge.subnet);
    if (wasCorrect) {
      const nextStreak = streak + 1;
      const earned = 100 + Math.min(400, nextStreak * 25) + Math.max(0, seconds * 8);
      const nextScore = score + earned;
      setScore(nextScore);
      setStreak(nextStreak);
      setHighScore(subnetGameHighScore("firewall", nextScore));
      setFeedback(`Clean hit. +${earned} credits. ${explanation}`);
    } else {
      const nextLives = lives - 1;
      setLives(nextLives);
      setStreak(0);
      setFeedback(`${reason || "Wrong rule."} ${explanation}`);
      if (nextLives <= 0) {
        setStatus("finished");
        return;
      }
    }
    setStatus("resolving");
    if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
    nextTimerRef.current = setTimeout(nextChallenge, 900);
  }, [challenge, lives, nextChallenge, score, seconds, status, streak]);

  useSubnetGameEffect(() => {
    if (status !== "playing") return undefined;
    const timer = setInterval(() => {
      setSeconds((current) => {
        if (current <= 1) {
          clearInterval(timer);
          finishRound(false, "Packet slipped through.");
          return 0;
        }
        return current - 1;
      });
    }, SUBNET_GAME_TICK_MS);
    return () => clearInterval(timer);
  }, [finishRound, status]);

  useSubnetGameEffect(() => () => {
    if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
  }, []);

  const answerPacket = (choice) => {
    if (status !== "playing") return;
    finishRound(choice === challenge.shouldPermit, choice ? "Trusted subnet missed." : "Hostile packet permitted.");
  };

  const restart = () => {
    if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
    setChallenge(makeFirewallChallenge());
    setScore(0);
    setStreak(0);
    setLives(3);
    setSeconds(10);
    setFeedback("New firewall online. First packet inbound.");
    setStatus("playing");
  };

  return (
    <main className="subnet-game-page firewall-page">
      <SubnetGamesNav />
      <section className="subnet-game-shell">
        <header className="subnet-game-head">
          <div>
            <p className="subnet-games-kicker">Packet wave {level}</p>
            <h1>Firewall Defender</h1>
          </div>
          <div className="subnet-game-stats">
            <span>Score <b>{score}</b></span>
            <span>Combo <b>{streak}x</b></span>
            <span>Lives <b>{lives}</b></span>
            <span>Best <b>{highScore}</b></span>
          </div>
        </header>

        <section className="firewall-arena">
          <div className="firewall-zone">
            <div className="firewall-wall">
              <span></span>
              <b>ACL</b>
              <span></span>
            </div>
            <div className="packet-card">
              <span>Inbound packet</span>
              <strong>{challenge.packetIp}</strong>
              <small>source endpoint</small>
            </div>
          </div>

          <div className="firewall-console">
            <div className="subnet-chip">Protected subnet</div>
            <h2>{challenge.subnet.network}/{challenge.subnet.cidr}</h2>
            <div className="firewall-facts">
              <span>Mask <b>{challenge.subnet.mask}</b></span>
              <span>Block <b>{challenge.subnet.blockText}</b></span>
            </div>
            <div className="scan-track" aria-label="Packet scan timer">
              <div style={{ width: `${scanPercent}%` }}></div>
            </div>
            <div className="firewall-actions">
              <button className="permit" disabled={status !== "playing"} onClick={() => answerPacket(true)}>Permit</button>
              <button className="drop" disabled={status !== "playing"} onClick={() => answerPacket(false)}>Drop</button>
            </div>
            <p className="subnet-game-feedback">{feedback}</p>
            {status === "finished" && (
              <button className="subnet-game-restart" onClick={restart}>Reboot firewall</button>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

function BroadcastBombSquadPage() {
  const [question, setQuestion] = useSubnetGameState(() => makeBombQuestion());
  const [score, setScore] = useSubnetGameState(0);
  const [streak, setStreak] = useSubnetGameState(0);
  const [strikes, setStrikes] = useSubnetGameState(0);
  const [bombs, setBombs] = useSubnetGameState(1);
  const [seconds, setSeconds] = useSubnetGameState(45);
  const [feedback, setFeedback] = useSubnetGameState("Read the CIDR, find the boundary, cut the right wire.");
  const [status, setStatus] = useSubnetGameState("playing");
  const [highScore, setHighScore] = useSubnetGameState(() => Number(subnetGameLoadStats().bomb || 0));
  const nextTimerRef = useSubnetGameRef(null);

  const danger = seconds <= 12 || strikes >= 2;
  const timerPercent = Math.max(0, Math.min(100, (seconds / 45) * 100));

  const nextBomb = useSubnetGameCallback(() => {
    setQuestion(makeBombQuestion());
    setStatus("playing");
  }, []);

  const failGame = useSubnetGameCallback((message) => {
    setStatus("finished");
    setFeedback(message);
    setHighScore(subnetGameHighScore("bomb", score));
  }, [score]);

  useSubnetGameEffect(() => {
    if (status !== "playing") return undefined;
    const timer = setInterval(() => {
      setSeconds((current) => {
        if (current <= 1) {
          clearInterval(timer);
          failGame(`Timer hit zero. ${subnetGameExplanation(question.subnet)}`);
          return 0;
        }
        return current - 1;
      });
    }, SUBNET_GAME_TICK_MS);
    return () => clearInterval(timer);
  }, [failGame, question, status]);

  useSubnetGameEffect(() => () => {
    if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
  }, []);

  const cutWire = (choice) => {
    if (status !== "playing") return;
    const correct = choice === question.type.answer;
    if (correct) {
      const nextStreak = streak + 1;
      const earned = 150 + nextStreak * 35 + seconds * 4;
      const nextScore = score + earned;
      setScore(nextScore);
      setHighScore(subnetGameHighScore("bomb", nextScore));
      setStreak(nextStreak);
      setBombs(bombs + 1);
      setFeedback(`Defused. +${earned}. ${subnetGameExplanation(question.subnet)}`);
      setStatus("resolving");
      if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
      nextTimerRef.current = setTimeout(nextBomb, 850);
      return;
    }

    const nextStrikes = strikes + 1;
    setStrikes(nextStrikes);
    setStreak(0);
    if (nextStrikes >= 3) {
      failGame(`Third strike. Correct wire was ${question.type.answer}. ${subnetGameExplanation(question.subnet)}`);
      return;
    }
    setFeedback(`Strike ${nextStrikes}. Correct wire was ${question.type.answer}. ${subnetGameExplanation(question.subnet)}`);
    setStatus("resolving");
    if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
    nextTimerRef.current = setTimeout(nextBomb, 1100);
  };

  const restart = () => {
    if (nextTimerRef.current) clearTimeout(nextTimerRef.current);
    setQuestion(makeBombQuestion());
    setScore(0);
    setStreak(0);
    setStrikes(0);
    setBombs(1);
    setSeconds(45);
    setFeedback("Fresh kit. Find the subnet boundary and cut clean.");
    setStatus("playing");
  };

  return (
    <main className="subnet-game-page bomb-page">
      <SubnetGamesNav />
      <section className="subnet-game-shell">
        <header className="subnet-game-head">
          <div>
            <p className="subnet-games-kicker">Device {bombs}</p>
            <h1>Broadcast Bomb Squad</h1>
          </div>
          <div className="subnet-game-stats">
            <span>Score <b>{score}</b></span>
            <span>Combo <b>{streak}x</b></span>
            <span>Strikes <b>{strikes}/3</b></span>
            <span>Best <b>{highScore}</b></span>
          </div>
        </header>

        <section className={`bomb-arena ${danger ? "danger" : ""}`}>
          <div className="bomb-device">
            <div className="bomb-timer">
              <span>{String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</span>
              <div><i style={{ width: `${timerPercent}%` }}></i></div>
            </div>
            <div className="bomb-core">
              <span></span>
              <b>{question.subnet.ip}/{question.subnet.cidr}</b>
              <small>{question.type.label}</small>
            </div>
          </div>

          <div className="bomb-panel">
            <div className="subnet-chip">Defusal prompt</div>
            <h2>{question.type.prompt}</h2>
            <p className="bomb-subprompt">
              Target host: <b>{question.subnet.ip}/{question.subnet.cidr}</b>
            </p>
            <div className="wire-grid">
              {question.choices.map((choice, index) => (
                <button
                  className={`wire-choice wire-${index + 1}`}
                  disabled={status !== "playing"}
                  key={`${question.id}-${choice}`}
                  onClick={() => cutWire(choice)}
                >
                  <span></span>
                  <b>{choice}</b>
                </button>
              ))}
            </div>
            <p className="subnet-game-feedback">{feedback}</p>
            {status === "finished" && (
              <button className="subnet-game-restart" onClick={restart}>Reset kit</button>
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

window.SubnetGamesPage = SubnetGamesPage;
window.FirewallDefenderPage = FirewallDefenderPage;
window.BroadcastBombSquadPage = BroadcastBombSquadPage;
