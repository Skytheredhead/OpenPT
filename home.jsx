// home.jsx — OpenPT home page. Simulator-first editorial layout.
// Exposes window.HomePage.

const { useState, useEffect, useRef, useMemo } = React;

// ── Sample data ────────────────────────────────────────────────────
const SAMPLE_QS = [
  {
    question:
      "Which type of OSPFv2 packet is used to forward OSPF link change information?",
    options: [
      "link-state acknowledgment",
      "link-state update",
      "hello",
      "database description",
    ],
    answer: 1,
    meta: "CCNA Semester 3 / Final exam / question 1",
    feedback:
      "LSU packets carry link-state advertisements that flood OSPF link changes through the area.",
  },
  {
    question: "Which command shows a quick summary of interface IP addresses and status?",
    options: [
      "show running-config",
      "show ip interface brief",
      "show interfaces trunk",
      "show vlan brief",
    ],
    answer: 1,
    meta: "CCNA Semester 3 / Final exam / question 2",
    feedback:
      "The brief view is the fastest way to scan addresses, status, and protocol state.",
  },
  {
    question: "Which command saves the active router configuration to NVRAM?",
    options: [
      "copy running-config startup-config",
      "copy startup-config running-config",
      "reload save",
      "archive config",
    ],
    answer: 0,
    meta: "CCNA Semester 3 / Final exam / question 3",
    feedback:
      "The running config is in RAM; copying it to startup config makes it survive reloads.",
  },
  {
    question: "Which static route forwards all unmatched traffic to a next-hop address?",
    options: [
      "ip route 10.0.0.0 255.0.0.0 192.168.1.1",
      "ip default-network 0.0.0.0",
      "ip route 0.0.0.0 0.0.0.0 203.0.113.254",
      "default-gateway 203.0.113.254",
    ],
    answer: 2,
    meta: "CCNA Semester 3 / Final exam / question 4",
    feedback:
      "A default static route uses 0.0.0.0/0, then points at the next-hop router.",
  },
  {
    question: "Which command enters global configuration mode from privileged EXEC?",
    options: [
      "enable",
      "configure terminal",
      "interface gigabitEthernet0/0",
      "terminal monitor",
    ],
    answer: 1,
    meta: "CCNA Semester 3 / Final exam / question 5",
    feedback:
      "Privileged EXEC uses configure terminal before interface, routing, and line changes.",
  },
];

const CLI_RESPONSES = {
  "?": [
    { cls: "dim", text: "Try a command, or press Tab to complete the dim suggestion." },
  ],
  "show ip interface brief": [
    { cls: "dim", text: "Interface              IP-Address      OK? Method Status                Protocol" },
    { cls: "",    text: "GigabitEthernet0/0     192.168.1.1     YES manual up                    up" },
    { cls: "",    text: "GigabitEthernet0/1     10.0.0.1        YES manual up                    up" },
    { cls: "",    text: "Serial0/0/0            203.0.113.1     YES manual up                    up" },
    { cls: "dim", text: "Loopback0              1.1.1.1         YES manual up                    up" },
  ],
  "show ip route": [
    { cls: "dim", text: "Codes: C - connected, S - static, O - OSPF, * - candidate default" },
    { cls: "",    text: "C       192.168.1.0/24 is directly connected, GigabitEthernet0/0" },
    { cls: "",    text: "C       10.0.0.0/24 is directly connected, GigabitEthernet0/1" },
    { cls: "ok",  text: "O       172.16.0.0/16 [110/2] via 10.0.0.2, 00:12:34, Gi0/1" },
    { cls: "",    text: "S*      0.0.0.0/0 [1/0] via 203.0.113.254" },
  ],
  "show running-config": [
    { cls: "dim", text: "Building configuration..." },
    { cls: "", text: "hostname R1" },
    { cls: "", text: "!" },
    { cls: "", text: "interface GigabitEthernet0/0" },
    { cls: "", text: " ip address 192.168.1.1 255.255.255.0" },
    { cls: "", text: " no shutdown" },
    { cls: "", text: "!" },
    { cls: "", text: "router ospf 1" },
    { cls: "", text: " network 10.0.0.0 0.0.0.255 area 0" },
    { cls: "", text: "end" },
  ],
  "configure terminal": [
    { cls: "dim", text: "Enter configuration commands, one per line. End with CNTL/Z." },
  ],
};

const HOME_CLI_COMPLETIONS = {
  exec: [
    "show ip route",
    "show ip interface brief",
    "show running-config",
    "enable",
    "ping 192.168.1.1",
    "traceroute 8.8.8.8",
  ],
  priv: [
    "show ip route",
    "show ip interface brief",
    "show running-config",
    "configure terminal",
    "copy running-config startup-config",
    "write memory",
    "ping 192.168.1.1",
  ],
  config: [
    "interface GigabitEthernet0/0",
    "router ospf 1",
    "ip route 0.0.0.0 0.0.0.0 203.0.113.254",
    "ip dhcp pool LAN",
    "hostname R1",
    "line console 0",
  ],
  "config-if": [
    "ip address 192.168.1.1 255.255.255.0",
    "no shutdown",
    "description LAN gateway",
    "ip nat inside",
    "shutdown",
  ],
  "config-router": [
    "network 10.0.0.0 0.0.0.255 area 0",
    "passive-interface default",
    "router-id 1.1.1.1",
    "default-information originate",
  ],
  "config-dhcp": [
    "network 192.168.1.0 255.255.255.0",
    "default-router 192.168.1.1",
    "dns-server 8.8.8.8",
    "lease 7",
  ],
  "config-line": [
    "password cisco",
    "login",
    "transport input ssh",
    "logging synchronous",
  ],
};

function completeHomeCliCommand(mode, value) {
  const raw = value;
  const needle = raw.trimStart().toLowerCase();
  if (!needle) return "";
  const indent = raw.slice(0, raw.length - raw.trimStart().length);
  const candidates = HOME_CLI_COMPLETIONS[mode] || HOME_CLI_COMPLETIONS.exec;
  const match = candidates.find((cmd) => cmd.toLowerCase().startsWith(needle));
  return match ? `${indent}${match}` : "";
}

const ROUTER_DEMO_PATTERNS = [
  /^(?:show|dir|more|delete)(?:\s+.+)?$/,
  /^(?:write|wr|write memory|copy running-config startup-config|copy run start|erase startup-config|write erase|terminal length \S+)$/,
  /^(?:configure terminal|conf t|config t)$/,
  /^(?:hostname|enable secret|service password-encryption|no service password-encryption|username)\b/,
  /^(?:interface|int)(?: range)?\s+.+$/,
  /^(?:vlan|no vlan)\s+.+$/,
  /^(?:ip route|no ip route|ip routing|no ip routing|ip multicast-routing|no ip multicast-routing)\b/,
  /^(?:router ospf|router eigrp|router rip|router bgp)\b/,
  /^(?:ip domain-name|no ip domain-name|ip ssh version|crypto key generate rsa|aaa new-model|no aaa new-model)\b/,
  /^(?:ip dhcp pool|ip dhcp excluded-address|no ip dhcp excluded-address)\b/,
  /^(?:ip access-list|access-list|ip prefix-list|route-map|vrf definition)\b/,
  /^(?:ip nat|ntp server|snmp-server|logging host)\b/,
  /^(?:ip dhcp snooping|ip arp inspection vlan|monitor session)\b/,
  /^(?:class-map|policy-map|ip sla|track|line console 0|line vty 0 4)\b/,
  /^(?:description|no description|ip address|no ip address|shutdown|no shutdown)\b/,
  /^(?:switchport|no switchport|channel-group|storm-control|spanning-tree)\b/,
  /^(?:ip ospf priority|ip access-group|no ip access-group|ip policy route-map|ip nat inside|ip nat outside|no ip nat inside|no ip nat outside)\b/,
  /^(?:service-policy|encapsulation|tunnel source|tunnel destination|speed|duplex)\b/,
  /^(?:router-id|version|network|neighbor|passive-interface|no passive-interface|default-information originate)\b/,
  /^(?:default-router|dns-server|domain-name|netbios-name-server|lease)\b/,
  /^(?:password|login|no login|transport input|logging synchronous|exec-timeout)\b/,
  /^(?:permit|deny|remark|match|set|rd|address-family ipv4|class|police|bandwidth|priority|shape|queue-limit|icmp-echo|frequency)\b/,
];

function isRouterDemoCommand(cmd) {
  const inner = cmd.startsWith("do ") ? cmd.slice(3).trim() : cmd;
  return ROUTER_DEMO_PATTERNS.some((pattern) => pattern.test(inner));
}

function nextRouterDemoMode(cmd, currentMode) {
  if (/^(?:configure terminal|conf t|config t)$/.test(cmd)) return "config";
  if (/^(?:interface|int)(?: range)?\s+/.test(cmd)) return "config-if";
  if (/^router (?:ospf|eigrp|rip|bgp)\b/.test(cmd)) return "config-router";
  if (/^ip dhcp pool\b/.test(cmd)) return "config-dhcp";
  if (/^line (?:console|vty)\b/.test(cmd)) return "config-line";
  if (/^(?:ip access-list|route-map|vrf definition|class-map|policy-map|ip sla)\b/.test(cmd)) return "config";
  return currentMode;
}

function routerDemoResponse(cmd, raw) {
  const inner = cmd.startsWith("do ") ? cmd.slice(3).trim() : cmd;
  if (/^(?:write|wr|write memory|copy running-config startup-config|copy run start)$/.test(inner)) {
    return [{ cls: "ok", text: "Building configuration... [OK]" }];
  }
  if (/^(?:erase startup-config|write erase)$/.test(inner)) {
    return [{ cls: "warn", text: "Startup configuration cleared in this demo." }];
  }
  if (/^show\b/.test(inner)) {
    return [{ cls: "dim", text: `${raw} is supported. Open the lab for live device output.` }];
  }
  return [];
}

function fakePing(target) {
  return [
    { cls: "dim", text: `Type escape sequence to abort.` },
    { cls: "",    text: `Sending 5, 100-byte ICMP Echos to ${target}, timeout is 2 seconds:` },
    { cls: "ok",  text: `!!!!!` },
    { cls: "",    text: `Success rate is 100 percent (5/5), round-trip min/avg/max = 1/2/4 ms` },
  ];
}

// ── MiniCli ────────────────────────────────────────────────────────
function MiniCli({ host = "R1", initialMode = "exec", height = 200 }) {
  const [mode, setMode] = useState(initialMode);
  const [lines, setLines] = useState(() => []);
  const [input, setInput] = useState("sh");
  const stackRef = useRef(null);

  useEffect(() => {
    if (stackRef.current) stackRef.current.scrollTop = stackRef.current.scrollHeight;
  }, [lines]);

  const prompt = mode === "config-if"     ? `${host}(config-if)#`
              : mode === "config-router" ? `${host}(config-router)#`
              : mode === "config-dhcp"   ? `${host}(dhcp-config)#`
              : mode === "config-line"   ? `${host}(config-line)#`
              : mode === "config"        ? `${host}(config)#`
              : mode === "priv"          ? `${host}#`
              : `${host}>`;

  const ghostCompletion = useMemo(() => {
    const completed = completeHomeCliCommand(mode, input);
    if (!completed || completed.toLowerCase() === input.toLowerCase()) return "";
    return completed.slice(input.length);
  }, [mode, input]);

  const onInputKeyDown = (e) => {
    if (e.key !== "Tab") return;
    const completed = completeHomeCliCommand(mode, input);
    if (!completed || completed.toLowerCase() === input.toLowerCase()) return;
    e.preventDefault();
    setInput(completed);
  };

  const submit = (e) => {
    e?.preventDefault?.();
    const raw = input.trim();
    const next = [...lines, { cls: "input", text: `${prompt} ${input}` }];
    setInput("");
    if (!raw) { setLines(next); return; }
    const lower = raw.toLowerCase();
    if (lower === "enable" || lower === "en") { setMode("priv"); setLines(next); return; }
    if (lower === "disable")                  { setMode("exec"); setLines(next); return; }
    if (lower === "exit" || lower === "end") {
      if (lower === "end") setMode("priv");
      else if (mode.startsWith("config-")) setMode("config");
      else if (mode === "config") setMode("priv");
      else if (mode === "priv") setMode("exec");
      setLines(next);
      return;
    }
    if (lower.startsWith("ping ")) {
      setLines([...next, ...fakePing(raw.split(/\s+/)[1] || "192.168.1.1")]);
      return;
    }
    if (lower === "clear" || lower === "cls") { setLines([]); return; }
    if (lower === "conf t" || lower === "config t") {
      setMode("config");
      setLines([...next, ...CLI_RESPONSES["configure terminal"]]);
      return;
    }
    if (CLI_RESPONSES[lower]) {
      if (lower === "configure terminal" || lower === "conf t") setMode("config");
      setLines([...next, ...CLI_RESPONSES[lower]]);
      return;
    }
    if (isRouterDemoCommand(lower)) {
      setLines([...next, { cls: "dim", text: "open a lab for all supported commands" }]);
      return;
    }
    setLines([...next, { cls: "err", text: `% Unknown command "${raw}". Try '?' for help.` }]);
  };

  return (
    <div className="home-cli" style={{ height }}>
      <div className="home-cli-stack" ref={stackRef}>
        {lines.map((l, i) => (
          <div key={i} className={`home-cli-line ${l.cls}`}>{l.text}</div>
        ))}
        <form className="home-cli-row" onSubmit={submit}>
          <span className="home-cli-prompt">{prompt}</span>
          <span className="home-cli-input-wrap">
            <input
              className="home-cli-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onInputKeyDown}
              spellCheck={false}
              autoComplete="off"
              aria-label="Router command"
            />
            {ghostCompletion && (
              <span className="home-cli-ghost" style={{ marginLeft: `${input.length}ch` }}>
                {ghostCompletion}
              </span>
            )}
          </span>
        </form>
      </div>
    </div>
  );
}

// ── MiniTopology ───────────────────────────────────────────────────
function MiniTopology({
  width = 540,
  height = 320,
  initialDevices,
  initialLinks,
  showPackets = true,
  className = "",
}) {
  const G = window.Glyph || {};
  const defaultDevices = initialDevices || [
    { id: "r1", kind: "router",   x: 130, y: 90,  label: "R1",   color: "var(--accent)" },
    { id: "s1", kind: "l2switch", x: 310, y: 180, label: "SW1",  color: "var(--fg-1)" },
    { id: "p1", kind: "pc",       x: 160, y: 270, label: "PC-A", color: "var(--ok)" },
    { id: "p2", kind: "pc",       x: 460, y: 270, label: "PC-B", color: "var(--ok)" },
    { id: "c1", kind: "cloud",    x: 500, y: 90,  label: "ISP",  color: "var(--magenta)" },
  ];
  const defaultLinks = initialLinks || [
    { a: "r1", b: "s1", type: "auto" },
    { a: "s1", b: "p1", type: "auto" },
    { a: "s1", b: "p2", type: "auto" },
    { a: "r1", b: "c1", type: "serial" },
  ];

  const [devices, setDevices] = useState(defaultDevices);
  const [drag, setDrag] = useState(null);
  const [hoverLink, setHoverLink] = useState(null);
  const wrapRef = useRef(null);

  const devById = useMemo(() => Object.fromEntries(devices.map(d => [d.id, d])), [devices]);

  const onDown = (e, d) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setDrag({ id: d.id, startX: e.clientX, startY: e.clientY, x: d.x, y: d.y });
  };

  useEffect(() => {
    if (!drag) return;
    const onMove = (e) => {
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      setDevices(prev => prev.map(d =>
        d.id === drag.id
          ? {
              ...d,
              x: Math.max(28, Math.min(width - 28, drag.x + dx)),
              y: Math.max(28, Math.min(height - 28, drag.y + dy)),
            }
          : d
      ));
    };
    const onUp = () => setDrag(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [drag, width, height]);

  // Animated packet looping on the first link
  const [packetT, setPacketT] = useState(0);
  useEffect(() => {
    if (!showPackets) return;
    let raf;
    const start = performance.now();
    const tick = (t) => {
      setPacketT((((t - start) / 1800) % 1));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [showPackets]);

  const linkStroke = (type) => type === "serial" ? "var(--warn)"
                              : type === "fiber"  ? "var(--violet)"
                              : type === "cross"  ? "var(--magenta)"
                              : "var(--fg-1)";

  return (
    <div ref={wrapRef} className={`home-mini-topo ${className}`} style={{ width, height }}>
      <svg
        width={width}
        height={height}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      >
        {(initialLinks || defaultLinks).map((l, i) => {
          const a = devById[l.a], b = devById[l.b];
          if (!a || !b) return null;
          const dx = b.x - a.x, dy = b.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          const r = 22;
          const sx = a.x + dx / len * r, sy = a.y + dy / len * r;
          const ex = b.x - dx / len * r, ey = b.y - dy / len * r;
          const hot = hoverLink === i;
          return (
            <g key={i}>
              <line
                x1={sx} y1={sy} x2={ex} y2={ey}
                stroke={linkStroke(l.type)}
                strokeWidth={hot ? 2.2 : 1.55}
                strokeLinecap="round"
                strokeDasharray={l.type === "cross" ? "5,3" : ""}
                opacity={0.9}
                style={{ pointerEvents: "stroke", cursor: "pointer" }}
                onMouseEnter={() => setHoverLink(i)}
                onMouseLeave={() => setHoverLink(null)}
              />
              {showPackets && i === 0 && (
                <circle
                  cx={sx + (ex - sx) * packetT}
                  cy={sy + (ey - sy) * packetT}
                  r={3}
                  fill="var(--accent)"
                  opacity={0.85}
                  style={{ filter: "drop-shadow(0 0 6px var(--accent))" }}
                />
              )}
            </g>
          );
        })}
      </svg>

      {devices.map(d => {
        const Comp = G[d.kind] || G.router;
        const active = drag && drag.id === d.id;
        return (
          <div
            key={d.id}
            className={`home-mini-node ${active ? "dragging" : ""}`}
            style={{ left: d.x, top: d.y, color: d.color }}
            onMouseDown={(e) => onDown(e, d)}
          >
            <div className="home-mini-node-body">
              {Comp ? React.createElement(Comp, { size: 40 }) : null}
            </div>
            <div className="home-mini-node-label">{d.label}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── MiniQuestion ───────────────────────────────────────────────────
function MiniQuestion({ questions = SAMPLE_QS, onAnswered }) {
  const [queue, setQueue] = useState(() => questions.map((_, i) => i));
  const [picked, setPicked] = useState(null);
  const [reveal, setReveal] = useState(false);
  const q = questions[queue[0] ?? 0] || questions[0];
  const correct = picked === q.answer;

  const onPick = (i) => {
    if (reveal) return;
    setPicked(i);
    setReveal(true);
    onAnswered && onAnswered(i === q.answer);
  };
  const nextQuestion = () => {
    setPicked(null);
    setReveal(false);
    setQueue((prev) => {
      if (prev.length <= 1) return questions.map((_, i) => i);
      const [current, ...rest] = prev;
      return correct ? rest : [...rest, current];
    });
  };
  useEffect(() => {
    setPicked(null);
    setReveal(false);
    setQueue(questions.map((_, i) => i));
  }, [questions]);

  const letters = ["A", "B", "C", "D", "E", "F"];

  return (
    <div className="home-qcard home-qcard-enter">
      <div className="home-qcard-meta">
        <span>{q.meta}</span>
      </div>
      <div className="home-qcard-text">{q.question}</div>
      <div className="home-qcard-opts">
        {q.options.map((opt, i) => {
          const cls = ["home-qopt"];
          if (picked === i) cls.push("selected");
          if (reveal && i === q.answer) cls.push("correct", "flash");
          if (reveal && picked === i && i !== q.answer) cls.push("incorrect", "flash");
          return (
            <button
              key={i}
              type="button"
              className={cls.join(" ")}
              disabled={reveal}
              onClick={() => onPick(i)}
            >
              <span className="home-qopt-marker">{letters[i]}</span>
              <span className="home-qopt-text">{opt}</span>
              <span className="home-qopt-hk">{i + 1}</span>
            </button>
          );
        })}
      </div>
      {reveal && (
        <div className={`home-qfeedback ${correct ? "good" : "bad"}`}>
          <span className="home-qfeedback-label">{correct ? "GOT IT" : "MISS"}</span>
          <span className="home-qfeedback-msg">
            {correct ? <>Locked in. {q.feedback}</> : <>Answer: <b>{q.options[q.answer]}</b>. {q.feedback} This one will come back.</>}
          </span>
          <button type="button" className="home-qfeedback-again" onClick={nextQuestion}>
            next question
          </button>
        </div>
      )}
    </div>
  );
}

// ── HomePage ───────────────────────────────────────────────────────
function HomePage({ onEnterLab, onEnterStarter, onEnterImport, onStartQuiz }) {
  const ArrowRight = window.Icon?.arrowRight;
  const Github = window.Icon?.github;

  return (
    <div className="home-root">
      {/* Nav */}
      <nav className="home-nav">
        <div className="home-nav-logo">
          <span className="home-nav-glyph"/>
          OpenPT
        </div>
        <span className="home-nav-separator" aria-hidden="true"/>
        <div className="home-nav-links">
          <a className="home-nav-link" onClick={onEnterLab}>Simulate</a>
          <a className="home-nav-link" onClick={onStartQuiz}>Practice</a>
          <a className="home-nav-link" onClick={onEnterImport}>Import</a>
        </div>
      </nav>

      {/* Hero — simulator-first brand line */}
      <section className="home-hero">
        <h1 className="home-title">
          The best packet tracing<br/>simulation.<br/>
          <span className="home-title-dim">The best way to study for the CCNA.</span>
        </h1>
        <p className="home-lede">
          OpenPT is a free, open source browser alternative to the packet tracer
          we all know and (do not) love. This one though also has a quiz mode with
          questions that'll help you ace each module test when studying for your
          CCNA. Try it out!
        </p>
        <div className="home-cta">
          <button type="button" className="home-btn primary" onClick={onEnterLab}>Open the lab →</button>
          <button type="button" className="home-btn" onClick={onStartQuiz}>Start studying</button>
        </div>
      </section>

      {/* Simulator marquee — the headline act */}
      <section className="home-marquee">
        <div className="home-marquee-head">
          <h2 className="home-h2">Ooh an interactable demo!</h2>
          <p className="home-body home-body-center">
            Fun fact: You can import <code>.pka</code> assignments directly into OpenPT!
            It has the lab sheet, correct topology, and even an autograder!
          </p>
        </div>

        <div className="home-frame">
          <div className="home-frame-bar">
            <div className="home-frame-dots"><span/><span/><span/></div>
            <div className="home-frame-title">OpenPT — demo.pka</div>
          </div>
          <div className="home-frame-body">
            <div className="home-frame-canvas">
              <MiniTopology width={680} height={360} />
              <button type="button" className="home-topology-cta" onClick={onEnterLab}>
                <span>Open the lab</span>
                {ArrowRight && <ArrowRight aria-hidden="true" />}
              </button>
            </div>
            <div className="home-frame-cli">
              <div className="home-frame-cli-label">R1 console</div>
              <MiniCli height={310} />
            </div>
          </div>
        </div>

        <div className="home-marquee-features">
          <div className="home-feat">
            <div className="home-feat-num">01</div>
            <div className="home-feat-h">Movable topology</div>
            <div className="home-feat-p">Clicky draggy. Just like Packet Tracer.</div>
          </div>
          <div className="home-feat">
            <div className="home-feat-num">02</div>
            <div className="home-feat-h">Real IOS CLI</div>
            <div className="home-feat-p">Yup. That IOS.</div>
          </div>
          <div className="home-feat">
            <div className="home-feat-num">03</div>
            <div className="home-feat-h">Save · share · import</div>
            <div className="home-feat-p">Saves in-browser??? No way! Did I mention you can import <code>.pka</code> files?</div>
          </div>
        </div>

      </section>

      {/* Practice — second pillar */}
      <section className="home-section">
        <div className="home-section-side">
          <h2 className="home-h2">Real questions you'll actually see.</h2>
          <p className="home-body">
            If you're Cisco — no they're not your exact questions (but they're dang close).
          </p>
          <button type="button" className="home-btn primary" onClick={onStartQuiz}>Start studying →</button>
        </div>
        <div className="home-section-demo">
          <MiniQuestion />
        </div>
      </section>

      <footer className="home-foot">
        <a
          className="home-foot-link"
          href="https://github.com/Skytheredhead/OpenPT"
          target="_blank"
          rel="noreferrer"
        >
          <span>the code</span>
          {Github && <Github aria-hidden="true" />}
        </a>
      </footer>
    </div>
  );
}

window.HomePage = HomePage;
