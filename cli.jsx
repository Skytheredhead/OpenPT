// cli.jsx — IOS-like CLI for selected device
// Supports: enable, configure terminal, hostname, interface, ip address, no shutdown,
// shutdown, end/exit, show running-config, show ip interface brief, show ip route,
// show mac address-table, show vlan brief, ping, traceroute, ip route ..., vlan ...

const { OPT_Engine } = window;

function defaultBanner(dev) {
  return [];
}

function CLI({ device, onApply, onPing, pendingCmd, active }) {
  const ref = React.useRef(null);
  const inputRef = React.useRef(null);
  const [lines, setLines] = React.useState([]);
  const [mode, setMode] = React.useState("user");   // user | priv | conf | conf-if
  const [confIface, setConfIface] = React.useState(null);
  const [input, setInput] = React.useState("");
  // Per-mode command history (Cisco-like: arrows only show commands from current mode)
  const [history, setHistory] = React.useState({ user: [], priv: [], conf: [], "conf-if": [] });
  const [histIdx, setHistIdx] = React.useState(-1);
  const lastPendingNonce = React.useRef(0);

  // Reset session when device changes
  React.useEffect(() => {
    if (!device) return;
    setLines(defaultBanner(device));
    setMode("user");
    setConfIface(null);
    setInput("");
    setHistIdx(-1);
  }, [device?.id]);

  // Scroll on new lines
  React.useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);

  // Run a queued command when pendingCmd arrives
  React.useEffect(() => {
    if (!pendingCmd || !device) return;
    if (pendingCmd.devId !== device.id) return;
    if (pendingCmd.nonce === lastPendingNonce.current) return;
    lastPendingNonce.current = pendingCmd.nonce;
    // small delay so the lines display after mount
    setTimeout(() => handle(pendingCmd.cmd), 60);
  }, [pendingCmd, device?.id]);

  if (!device) {
    return (
      <div className="cli">
        <div className="cli-empty">
          <div style={{ fontSize: 14, color: "var(--fg-2)" }}>No device selected</div>
          <div className="hint">Click a device on the canvas to open its console.</div>
        </div>
      </div>
    );
  }

  const promptFor = () => {
    const h = device.hostname;
    if (mode === "user") return `${h}>`;
    if (mode === "priv") return `${h}#`;
    if (mode === "conf") return `${h}(config)#`;
    if (mode === "conf-if") return `${h}(config-if)#`;
    return `${h}>`;
  };

  const push = (cls, text) => setLines((l) => [...l, { cls, text }]);
  const pushLines = (arr) => setLines((l) => [...l, ...arr]);

  const handle = (raw) => {
    const cmd = raw.trim();
    const inputLine = { cls: "input", text: `${promptFor()} ${cmd}` };
    setLines((l) => [...l, inputLine]);
    if (!cmd) return;

    // help shortcut
    if (cmd === "?") {
      const help = (mode === "user")
        ? ["enable             — enter privileged mode",
           "ping <ip>          — send ICMP echo",
           "show ?             — list show commands",
           "exit               — close session"]
        : (mode === "priv")
        ? ["configure terminal — enter config mode",
           "show running-config",
           "show ip interface brief",
           "show ip route",
           "show mac address-table",
           "show vlan brief",
           "ping <ip> | traceroute <ip>",
           "disable | exit"]
        : (mode === "conf")
        ? ["hostname <name>",
           "interface <name>          — enter interface config",
           "vlan <id>                 — create vlan",
           "ip route <net> <mask> <next-hop|iface>",
           "end | exit"]
        : ["ip address <ip> <mask>",
           "description <text>",
           "switchport mode access | trunk",
           "switchport access vlan <id>",
           "no shutdown | shutdown",
           "exit"];
      help.forEach(h => push("dim", `  ${h}`));
      return;
    }

    // Universal navigation
    if (cmd === "exit") {
      if (mode === "user") { push("dim", "[session closed]"); return; }
      if (mode === "priv") { setMode("user"); return; }
      if (mode === "conf") { setMode("priv"); return; }
      if (mode === "conf-if") { setMode("conf"); setConfIface(null); return; }
    }
    if (cmd === "end") { setMode("priv"); setConfIface(null); return; }
    if (cmd === "disable") { setMode("user"); return; }

    // Privileged + config: SHOW commands (also allowed from user mode)
    if (cmd === "show running-config" || cmd === "show run") return showRun();
    if (cmd === "show ip interface brief" || cmd === "show ip int br") return showIpBrief();
    if (cmd === "show ip route" || cmd === "sh ip route") return showRoute();
    if (cmd === "show mac address-table" || cmd === "show mac") return showMac();
    if (cmd === "show vlan brief" || cmd === "show vlan") return showVlan();
    if (cmd === "show version" || cmd === "show ver") return showVer();
    if (cmd.startsWith("ping ")) return doPing(cmd.slice(5).trim());
    if (cmd.startsWith("traceroute ") || cmd.startsWith("trace ")) {
      const ip = cmd.split(/\s+/)[1];
      return doPing(ip, true);
    }

    // User mode
    if (mode === "user") {
      if (cmd === "enable" || cmd === "en") { setMode("priv"); return; }
      if (cmd === "show ?" || cmd === "show") {
        push("dim", "  show running-config / show ip route / show ip interface brief / show vlan / show mac");
        return;
      }
      push("err", `% Invalid input — '${cmd}' (try 'enable')`);
      return;
    }

    // Privileged extras

    // Privileged
    if (mode === "priv") {
      if (cmd === "configure terminal" || cmd === "conf t") { setMode("conf"); push("dim", "Enter configuration commands, one per line."); return; }
      if (cmd === "write" || cmd === "wr" || cmd === "write memory" || cmd === "copy run start") {
        push("ok", "Building configuration...\n[OK]"); return;
      }
      push("err", `% Invalid input — '${cmd}'`);
      return;
    }

    // Config mode
    if (mode === "conf") {
      let m;
      if ((m = cmd.match(/^hostname\s+(\S+)$/))) {
        onApply({ kind: "hostname", value: m[1] });
        return;
      }
      if ((m = cmd.match(/^interface\s+(.+)$/))) {
        const ifname = normalizeIface(m[1], device);
        if (!ifname || !device.interfaces[ifname]) {
          push("err", `% Invalid interface '${m[1]}'`); return;
        }
        setConfIface(ifname); setMode("conf-if");
        return;
      }
      if ((m = cmd.match(/^vlan\s+(\d+)$/))) {
        onApply({ kind: "vlan-add", id: Number(m[1]) });
        return;
      }
      if ((m = cmd.match(/^ip\s+route\s+(\S+)\s+(\S+)\s+(\S+)$/))) {
        onApply({ kind: "ip-route", dst: m[1], mask: m[2], via: m[3] });
        return;
      }
      push("err", `% Invalid input — '${cmd}'`);
      return;
    }

    // Interface config
    if (mode === "conf-if") {
      let m;
      if ((m = cmd.match(/^ip\s+address\s+(\S+)\s+(\S+)$/))) {
        onApply({ kind: "ip-address", iface: confIface, ip: m[1], mask: m[2] });
        return;
      }
      if (cmd === "no shutdown" || cmd === "no shut") { onApply({ kind: "admin", iface: confIface, up: true }); return; }
      if (cmd === "shutdown" || cmd === "shut") { onApply({ kind: "admin", iface: confIface, up: false }); return; }
      if ((m = cmd.match(/^description\s+(.+)$/))) { onApply({ kind: "desc", iface: confIface, value: m[1] }); return; }
      if ((m = cmd.match(/^switchport\s+mode\s+(access|trunk)$/))) { onApply({ kind: "swmode", iface: confIface, value: m[1] }); return; }
      if ((m = cmd.match(/^switchport\s+access\s+vlan\s+(\d+)$/))) { onApply({ kind: "swvlan", iface: confIface, value: Number(m[1]) }); return; }
      push("err", `% Invalid input — '${cmd}'`);
      return;
    }
  };

  // ── Show command implementations ────────────────────────
  function showRun() {
    const out = [`!`, `! ${device.hostname} running-config`, `!`];
    out.push(`hostname ${device.hostname}`, `!`);
    for (const [n, ifc] of Object.entries(device.interfaces)) {
      out.push(`interface ${n}`);
      if (ifc.desc) out.push(` description ${ifc.desc}`);
      if (ifc.ip)   out.push(` ip address ${ifc.ip} ${ifc.mask}`);
      if (ifc.mode) out.push(` switchport mode ${ifc.mode}`);
      if (ifc.vlan && ifc.mode === "access") out.push(` switchport access vlan ${ifc.vlan}`);
      out.push(ifc.admUp === false ? " shutdown" : " no shutdown");
      out.push(`!`);
    }
    for (const r of device.routes || []) {
      if (r.type !== "C") out.push(`ip route ${r.dst} ${r.mask} ${r.via}`);
    }
    out.push(`!`, `end`);
    out.forEach(l => push("", l));
  }
  function showIpBrief() {
    push("dim", `Interface              IP-Address      OK? Method Status                Protocol`);
    for (const [n, ifc] of Object.entries(device.interfaces)) {
      const ip = ifc.ip || "unassigned";
      const status = ifc.admUp === false ? "administratively down" : (ifc.up ? "up" : "down");
      const proto = ifc.up ? "up" : "down";
      const line = `${n.padEnd(22)} ${ip.padEnd(16)} YES manual ${status.padEnd(22)}${proto}`;
      const cls = ifc.up ? "ok" : (ifc.admUp === false ? "warn" : "err");
      push(cls, line);
    }
  }
  function showRoute() {
    push("dim", `Codes: C - connected, S - static, * - candidate default`);
    push("dim", ``);
    if (!device.routes?.length) { push("dim", "No routes."); return; }
    for (const r of device.routes) {
      const bits = OPT_Engine.maskBits(r.mask);
      const via = r.via === "directly" ? `is directly connected, ${r.iface}` : `via ${r.via}, ${r.iface}`;
      push("", ` ${r.type}   ${r.dst}/${bits} ${via}`);
    }
  }
  function showMac() {
    if (device.kind !== "l2switch" && device.kind !== "l3switch") {
      push("err", "% Not supported on this device"); return;
    }
    push("dim", "          Mac Address Table");
    push("dim", "  Vlan    Mac Address       Type        Ports");
    push("dim", "  ----    -----------       --------    -----");
    const entries = Object.entries(device.interfaces).filter(([_, i]) => i.up);
    if (!entries.length) { push("dim", "  (no entries)"); return; }
    entries.forEach(([n, i]) => {
      push("", `  ${String(i.vlan || 1).padEnd(7)} ${(i.mac || "----.----.----").padEnd(17)} DYNAMIC     ${n}`);
    });
  }
  function showVlan() {
    if (!device.vlans) { push("dim", "(none)"); return; }
    push("dim", "VLAN Name                             Status    Ports");
    push("dim", "---- -------------------------------- --------- ------------------------------");
    for (const [id, name] of Object.entries(device.vlans)) {
      const ports = Object.entries(device.interfaces).filter(([_, i]) => String(i.vlan) === String(id)).map(([n]) => n).join(", ") || "(none)";
      push("", `${String(id).padEnd(5)}${String(name).padEnd(33)}active    ${ports}`);
    }
  }
  function showVer() {
    push("", `OpenPT IOS, Version 1.0.0`);
    push("", `Device: ${device.hostname} (${device.kind})`);
    push("", `Interfaces: ${Object.keys(device.interfaces).length}`);
    push("", `Uptime: 00:42:17`);
  }

  // ── Ping → calls into app
  function doPing(target, trace = false) {
    if (trace) {
      const result = onPing && onPing(device.id, target, { trace });
      if (!result) return;
      push("dim", `Type escape sequence to abort.`);
      push("dim", `Tracing the route to ${target}`);
      result.hops.filter(h => h.action !== "originate" && h.action !== "arp-local" && h.action !== "arp-gw" && h.action !== "deliver" && h.action !== "reply" && h.action !== "ingress")
        .forEach((h, idx) => {
          const d = result.devices[h.devId];
          push("", `  ${idx + 1}  ${d?.hostname || "?"}  ${(Math.random() * 4 + 1).toFixed(1)} ms`);
        });
      if (result.ok) push("ok", "  Trace complete.");
      else push("err", `  ${result.error}`);
      return;
    }
    push("dim", `Type escape sequence to abort.`);
    push("dim", `Sending 5, 100-byte ICMP Echos to ${target}, timeout is 2 seconds:`);
    onPing && onPing(device.id, target, {}, (result) => {
      if (result.ok) {
        push("ok", `!!!!!`);
        push("ok", `Success rate is 100 percent (5/5), round-trip min/avg/max = ${(2 + Math.random()*2).toFixed(0)}/${(4 + Math.random()*2).toFixed(0)}/${(6 + Math.random()*3).toFixed(0)} ms`);
      } else {
        push("err", `.....`);
        push("err", `Success rate is 0 percent (0/5) — ${result.error}`);
      }
    });
  }

  // ── Submit
  const submit = (e) => {
    e.preventDefault();
    const v = input;
    const currentMode = mode;
    if (v.trim()) {
      setHistory((h) => {
        const list = h[currentMode] || [];
        return { ...h, [currentMode]: [...list, v].slice(-100) };
      });
    }
    handle(v);
    setInput("");
    setHistIdx(-1);
  };

  const onKeyDown = (e) => {
    const modeHist = history[mode] || [];
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const idx = histIdx < 0 ? modeHist.length - 1 : Math.max(0, histIdx - 1);
      setHistIdx(idx);
      setInput(modeHist[idx] || "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (histIdx < 0) return;
      const idx = histIdx + 1;
      if (idx >= modeHist.length) { setHistIdx(-1); setInput(""); }
      else { setHistIdx(idx); setInput(modeHist[idx]); }
    } else if (e.key === "Tab") {
      e.preventDefault();
      setInput((v) => completeCommand(v, mode, device));
    } else if (e.ctrlKey && e.key.toLowerCase() === "z") {
      e.preventDefault();
      setMode((m) => m === "conf-if" ? "conf" : (m === "conf" ? "priv" : m));
    }
  };

  // Auto-focus input when this CLI becomes active
  React.useEffect(() => {
    if (active && inputRef.current) {
      const t = setTimeout(() => inputRef.current && inputRef.current.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [active, device?.id]);

  return (
    <div className="cli" onClick={() => inputRef.current?.focus()}>
      <div className="cli-stack" ref={ref}>
        {lines.map((l, i) => <div key={i} className={`cli-line ${l.cls}`}>{l.text}</div>)}
        <form className="cli-prompt-row" onSubmit={submit}>
          <span className="cli-prompt">{promptFor()}</span>
          <input
            className="cli-input"
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            autoFocus
            spellCheck={false}
            autoComplete="off"
          />
        </form>
        <div style={{ flex: 1 }}/>
      </div>
    </div>
  );
}

function normalizeIface(s, device) {
  const map = { "g": "G", "f": "F", "s": "S", "e": "e" };
  const cleaned = s.trim().replace(/\s+/g, "");
  // try direct match
  for (const k of Object.keys(device.interfaces)) {
    if (k.toLowerCase() === cleaned.toLowerCase()) return k;
  }
  // try "gigabitethernet0/0" → "G0/0"
  const m = cleaned.match(/^(gigabitethernet|gig|gi|g|fastethernet|fast|fa|f|serial|ser|se|s|ethernet|eth|e)(\d.*)$/i);
  if (m) {
    const pre = m[1].toLowerCase();
    const num = m[2];
    const code = pre.startsWith("g") ? "G" : pre.startsWith("f") ? "F" : pre.startsWith("s") ? "S" : "e";
    const k = `${code}${num}`;
    for (const key of Object.keys(device.interfaces)) {
      if (key.toLowerCase() === k.toLowerCase()) return key;
    }
  }
  return null;
}

function completeCommand(input, mode, device) {
  const words = input.split(/\s+/);
  const last = words[words.length - 1];
  let pool = [];
  if (!last) return input;
  if (mode === "user") pool = ["enable", "ping", "show", "exit"];
  else if (mode === "priv") pool = ["configure", "terminal", "show", "ping", "traceroute", "write", "disable", "exit", "running-config", "ip", "interface", "brief", "route", "mac", "address-table", "vlan", "version"];
  else if (mode === "conf") pool = ["hostname", "interface", "vlan", "ip", "route", "end", "exit", ...Object.keys(device.interfaces)];
  else pool = ["ip", "address", "no", "shutdown", "description", "switchport", "mode", "access", "trunk", "vlan", "exit"];
  const hits = pool.filter(p => p.startsWith(last.toLowerCase()));
  if (hits.length === 1) {
    words[words.length - 1] = hits[0];
    return words.join(" ") + " ";
  }
  return input;
}

window.CLI = CLI;
