// cli.jsx - IOS XE-like CLI for OpenPT platform profiles.

const { OPT_Engine } = window;

const COMMAND_HINTS = {
  user: ["enable", "show", "ping", "traceroute", "exit"],
  priv: ["configure terminal", "show running-config", "show startup-config", "show version", "show ip interface brief", "show ip route", "show vlan brief", "show interfaces trunk", "show mac address-table", "show spanning-tree", "show ip ospf neighbor", "show access-lists", "show ip dhcp binding", "show ip nat translations", "copy running-config startup-config", "write memory", "disable", "exit"],
  conf: ["hostname", "interface", "interface range", "vlan", "router ospf", "ip route", "ip routing", "ip dhcp pool", "ip dhcp excluded-address", "ip access-list", "access-list", "username", "enable secret", "line console 0", "line vty 0 4", "service password-encryption", "end", "exit"],
  "conf-if": ["description", "ip address", "no ip address", "switchport mode access", "switchport mode trunk", "switchport access vlan", "switchport trunk allowed vlan", "switchport trunk native vlan", "ip access-group", "ip nat inside", "ip nat outside", "spanning-tree portfast", "shutdown", "no shutdown", "exit"],
  "conf-vlan": ["name", "exit"],
  "conf-router": ["router-id", "network", "passive-interface", "default-information originate", "exit"],
  "conf-dhcp": ["network", "default-router", "dns-server", "lease", "exit"],
  "conf-line": ["password", "login", "transport input", "logging synchronous", "exec-timeout", "exit"],
  "conf-acl": ["permit", "deny", "remark", "exit"],
};

function CLI({ device, devices = {}, links = [], onApply, onPing, pendingCmd, active }) {
  const ref = React.useRef(null);
  const inputRef = React.useRef(null);
  const [lines, setLines] = React.useState([]);
  const [mode, setMode] = React.useState({ name: "user" });
  const [input, setInput] = React.useState("");
  const [history, setHistory] = React.useState({});
  const [histIdx, setHistIdx] = React.useState(-1);
  const lastPendingNonce = React.useRef(0);

  React.useEffect(() => {
    if (!device) return;
    setLines([]);
    setMode({ name: "user" });
    setInput("");
    setHistIdx(-1);
  }, [device?.id]);

  React.useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);

  React.useEffect(() => {
    if (!pendingCmd || !device || pendingCmd.devId !== device.id || pendingCmd.nonce === lastPendingNonce.current) return;
    lastPendingNonce.current = pendingCmd.nonce;
    setTimeout(() => handle(pendingCmd.cmd), 60);
  }, [pendingCmd, device?.id]);

  React.useEffect(() => {
    if (active && inputRef.current) {
      const t = setTimeout(() => inputRef.current && inputRef.current.focus(), 30);
      return () => clearTimeout(t);
    }
  }, [active, device?.id]);

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

  const push = (cls, text) => setLines((l) => [...l, { cls, text }]);
  const pushMany = (arr, cls = "") => setLines((l) => [...l, ...arr.map((text) => typeof text === "string" ? { cls, text } : text)]);

  const promptFor = () => {
    const h = device.hostname;
    if (mode.name === "user") return `${h}>`;
    if (mode.name === "priv") return `${h}#`;
    if (mode.name === "conf") return `${h}(config)#`;
    if (mode.name === "conf-if") return `${h}(config-if)#`;
    if (mode.name === "conf-if-range") return `${h}(config-if-range)#`;
    if (mode.name === "conf-vlan") return `${h}(config-vlan)#`;
    if (mode.name === "conf-router") return `${h}(config-router)#`;
    if (mode.name === "conf-dhcp") return `${h}(dhcp-config)#`;
    if (mode.name === "conf-line") return `${h}(config-line)#`;
    if (mode.name === "conf-acl") return `${h}(config-ext-nacl)#`;
    return `${h}>`;
  };

  function apply(cmd) {
    onApply && onApply(cmd);
  }
  function applyIface(kind, data = {}) {
    const ifaces = mode.name === "conf-if-range" ? mode.ifaces : [mode.iface];
    for (const iface of ifaces) apply({ kind, iface, ...data });
  }

  function invalid(cmd, note = "") {
    push("err", `% Invalid input detected at '^' marker.${note ? ` ${note}` : ""}`);
  }

  function showHelp() {
    const key = mode.name === "conf-if-range" ? "conf-if" : mode.name;
    pushMany((COMMAND_HINTS[key] || []).map((h) => `  ${h}`), "dim");
  }

  function handle(raw, opts = {}) {
    const cmd = raw.trim().replace(/\s+/g, " ");
    if (!opts.silent) setLines((l) => [...l, { cls: "input", text: `${promptFor()} ${cmd}` }]);
    if (!cmd) return;
    if (cmd === "?" || cmd.endsWith(" ?")) return showHelp();
    if (cmd === "end") return setMode({ name: "priv" });
    if (cmd === "exit") return exitMode();
    if (cmd === "disable") return setMode({ name: "user" });
    if (cmd.startsWith("do ") && mode.name.startsWith("conf")) return runPriv(cmd.slice(3));

    if (cmd.startsWith("show ") || cmd === "show") return runShow(cmd);
    if (cmd.startsWith("ping ")) return doPing(cmd.split(/\s+/)[1]);
    if (cmd.startsWith("traceroute ") || cmd.startsWith("trace ")) return doPing(cmd.split(/\s+/)[1], true);

    if (mode.name === "user") return runUser(cmd);
    if (mode.name === "priv") return runPriv(cmd);
    if (mode.name === "conf") return runGlobal(cmd);
    if (mode.name === "conf-if" || mode.name === "conf-if-range") return runInterface(cmd);
    if (mode.name === "conf-vlan") return runVlan(cmd);
    if (mode.name === "conf-router") return runRouter(cmd);
    if (mode.name === "conf-dhcp") return runDhcp(cmd);
    if (mode.name === "conf-line") return runLine(cmd);
    if (mode.name === "conf-acl") return runAcl(cmd);
    invalid(cmd);
  }

  function exitMode() {
    if (mode.name === "user") return push("dim", "[session closed]");
    if (mode.name === "priv") return setMode({ name: "user" });
    if (mode.name === "conf") return setMode({ name: "priv" });
    return setMode({ name: "conf" });
  }

  function runUser(cmd) {
    if (cmd === "enable" || cmd === "en") return setMode({ name: "priv" });
    if (device.kind === "pc" || device.kind === "server") return runHost(cmd);
    invalid(cmd, "(try 'enable')");
  }

  function runPriv(cmd) {
    if (cmd === "configure terminal" || cmd === "conf t" || cmd === "config t") {
      push("dim", "Enter configuration commands, one per line. End with CNTL/Z.");
      return setMode({ name: "conf" });
    }
    if (cmd === "write" || cmd === "wr" || cmd === "write memory" || cmd === "copy running-config startup-config" || cmd === "copy run start") {
      apply({ kind: "save-startup", config: OPT_Engine.serializeConfig(device) });
      return push("ok", "Building configuration...\n[OK]");
    }
    if (cmd === "erase startup-config" || cmd === "write erase") {
      apply({ kind: "erase-startup" });
      return push("warn", "Erasing the nvram filesystem will remove all configuration files! [OK]");
    }
    if (cmd === "terminal length 0" || cmd.match(/^terminal length \d+$/)) return;
    invalid(cmd);
  }

  function runHost(cmd) {
    let m;
    if ((m = cmd.match(/^ip(?: address)? (\S+) (\S+) (\S+)$/))) {
      apply({ kind: "host-ip", ip: m[1], mask: m[2], gw: m[3] });
      return;
    }
    if (cmd === "ip dhcp" || cmd === "dhcp") {
      apply({ kind: "host-dhcp" });
      return push("dim", "DHCP discovery sent on eth0.");
    }
    if (cmd === "ipconfig" || cmd === "ipconfig /all" || cmd === "show ip") {
      const e = device.interfaces.eth0 || {};
      push("", `IPv4 Address . . . . . . . . . . : ${e.ip || "unassigned"}`);
      push("", `Subnet Mask . . . . . . . . . . . : ${e.mask || "unassigned"}`);
      push("", `Default Gateway . . . . . . . . . : ${e.gw || "unassigned"}`);
      push("", `Physical Address. . . . . . . . . : ${e.mac || "unknown"}`);
      return;
    }
    if (cmd === "arp -a") {
      const entries = Object.entries(device.arp || {});
      if (!entries.length) return push("dim", "No ARP entries.");
      entries.forEach(([ip, mac]) => push("", `${ip.padEnd(16)} ${mac}`));
      return;
    }
    invalid(cmd);
  }

  function runGlobal(cmd) {
    let m;
    if ((m = cmd.match(/^hostname (\S+)$/))) return apply({ kind: "hostname", value: m[1] });
    if ((m = cmd.match(/^enable secret (.+)$/))) return apply({ kind: "enable-secret", value: m[1] });
    if (cmd === "service password-encryption") return apply({ kind: "service", name: "passwordEncryption", value: true });
    if (cmd === "no service password-encryption") return apply({ kind: "service", name: "passwordEncryption", value: false });
    if (cmd === "ip routing") return apply({ kind: "ip-routing", value: true });
    if (cmd === "no ip routing") return apply({ kind: "ip-routing", value: false });
    if ((m = cmd.match(/^username (\S+) secret (.+)$/))) return apply({ kind: "username", user: m[1], secret: m[2] });
    if ((m = cmd.match(/^interface range (.+)$/))) {
      const ifaces = expandIfaceRange(m[1], device);
      if (!ifaces.length) return push("err", `% Invalid interface range '${m[1]}'`);
      return setMode({ name: "conf-if-range", ifaces });
    }
    if ((m = cmd.match(/^interface (.+)$/))) {
      const iface = normalizeIface(m[1], device);
      if (!iface) return push("err", `% Invalid interface '${m[1]}'`);
      if (!device.interfaces[iface]) apply({ kind: "interface-create", iface });
      return setMode({ name: "conf-if", iface });
    }
    if ((m = cmd.match(/^vlan (\d+)$/))) {
      apply({ kind: "vlan-add", id: Number(m[1]) });
      return setMode({ name: "conf-vlan", vlan: Number(m[1]) });
    }
    if ((m = cmd.match(/^no vlan (\d+)$/))) return apply({ kind: "vlan-remove", id: Number(m[1]) });
    if ((m = cmd.match(/^ip route (\S+) (\S+) (\S+)$/))) return apply({ kind: "ip-route", dst: m[1], mask: m[2], via: m[3] });
    if ((m = cmd.match(/^no ip route (\S+) (\S+) (\S+)$/))) return apply({ kind: "no-ip-route", dst: m[1], mask: m[2], via: m[3] });
    if ((m = cmd.match(/^router ospf (\d+)$/))) {
      apply({ kind: "ospf-create", pid: m[1] });
      return setMode({ name: "conf-router", pid: m[1] });
    }
    if ((m = cmd.match(/^ip dhcp pool (\S+)$/))) {
      apply({ kind: "dhcp-pool", name: m[1] });
      return setMode({ name: "conf-dhcp", pool: m[1] });
    }
    if ((m = cmd.match(/^ip dhcp excluded-address (\S+)(?: (\S+))?$/))) return apply({ kind: "dhcp-exclude", start: m[1], end: m[2] || m[1] });
    if ((m = cmd.match(/^no ip dhcp excluded-address (\S+)(?: (\S+))?$/))) return apply({ kind: "no-dhcp-exclude", start: m[1], end: m[2] || m[1] });
    if ((m = cmd.match(/^ip access-list (standard|extended) (\S+)$/))) {
      apply({ kind: "acl-create", aclType: m[1], name: m[2] });
      return setMode({ name: "conf-acl", aclType: m[1], acl: m[2] });
    }
    if ((m = cmd.match(/^access-list (\S+) (permit|deny) (.+)$/))) return apply({ kind: "acl-entry", name: m[1], aclType: Number(m[1]) < 100 ? "standard" : "extended", action: m[2], spec: m[3] });
    if ((m = cmd.match(/^line (console 0|vty 0 4)$/))) return setMode({ name: "conf-line", line: m[1].startsWith("console") ? "console" : "vty" });
    invalid(cmd);
  }

  function runInterface(cmd) {
    let m;
    if ((m = cmd.match(/^description (.+)$/))) return applyIface("desc", { value: m[1] });
    if (cmd === "no description") return applyIface("desc", { value: "" });
    if ((m = cmd.match(/^ip address (\S+) (\S+)$/))) return applyIface("ip-address", { ip: m[1], mask: m[2] });
    if (cmd === "no ip address") return applyIface("ip-address", { ip: null, mask: null });
    if (cmd === "shutdown" || cmd === "shut") return applyIface("admin", { up: false });
    if (cmd === "no shutdown" || cmd === "no shut") return applyIface("admin", { up: true });
    if (cmd === "no switchport") return applyIface("routed-port", { value: true });
    if (cmd === "switchport") return applyIface("routed-port", { value: false });
    if ((m = cmd.match(/^switchport mode (access|trunk)$/))) return applyIface("swmode", { value: m[1] });
    if ((m = cmd.match(/^switchport access vlan (\d+)$/))) return applyIface("swvlan", { value: Number(m[1]) });
    if ((m = cmd.match(/^switchport trunk native vlan (\d+)$/))) return applyIface("trunk-native", { value: Number(m[1]) });
    if ((m = cmd.match(/^switchport trunk allowed vlan (.+)$/))) return applyIface("trunk-allowed", { value: m[1].trim() });
    if (cmd === "spanning-tree portfast") return applyIface("stp-portfast", { value: true });
    if (cmd === "no spanning-tree portfast") return applyIface("stp-portfast", { value: false });
    if ((m = cmd.match(/^ip access-group (\S+) (in|out)$/))) return applyIface("iface-acl", { acl: m[1], dir: m[2] });
    if ((m = cmd.match(/^no ip access-group (\S+) (in|out)$/))) return applyIface("iface-acl", { acl: null, dir: m[2] });
    if (cmd === "ip nat inside") return applyIface("nat-role", { value: "inside" });
    if (cmd === "ip nat outside") return applyIface("nat-role", { value: "outside" });
    if (cmd === "no ip nat inside" || cmd === "no ip nat outside") return applyIface("nat-role", { value: null });
    if ((m = cmd.match(/^speed (auto|10|100|1000)$/))) return applyIface("speed", { value: m[1] });
    if ((m = cmd.match(/^duplex (auto|full|half)$/))) return applyIface("duplex", { value: m[1] });
    invalid(cmd);
  }

  function runVlan(cmd) {
    const m = cmd.match(/^name (.+)$/);
    if (m) return apply({ kind: "vlan-name", id: mode.vlan, name: m[1] });
    invalid(cmd);
  }

  function runRouter(cmd) {
    let m;
    if ((m = cmd.match(/^router-id (\S+)$/))) return apply({ kind: "ospf-router-id", pid: mode.pid, routerId: m[1] });
    if ((m = cmd.match(/^network (\S+) (\S+) area (\S+)$/))) return apply({ kind: "ospf-network", pid: mode.pid, network: m[1], wildcard: m[2], area: m[3] });
    if ((m = cmd.match(/^passive-interface (.+)$/))) return apply({ kind: "ospf-passive", pid: mode.pid, iface: normalizeIface(m[1], device) || m[1], value: true });
    if ((m = cmd.match(/^no passive-interface (.+)$/))) return apply({ kind: "ospf-passive", pid: mode.pid, iface: normalizeIface(m[1], device) || m[1], value: false });
    if (cmd === "default-information originate") return apply({ kind: "ospf-default", pid: mode.pid, value: true });
    invalid(cmd);
  }

  function runDhcp(cmd) {
    let m;
    if ((m = cmd.match(/^network (\S+) (\S+)$/))) return apply({ kind: "dhcp-network", pool: mode.pool, network: m[1], mask: m[2] });
    if ((m = cmd.match(/^default-router (\S+)$/))) return apply({ kind: "dhcp-default-router", pool: mode.pool, ip: m[1] });
    if ((m = cmd.match(/^dns-server (\S+)$/))) return apply({ kind: "dhcp-dns", pool: mode.pool, ip: m[1] });
    if ((m = cmd.match(/^lease (\d+)$/))) return apply({ kind: "dhcp-lease", pool: mode.pool, days: Number(m[1]) });
    invalid(cmd);
  }

  function runLine(cmd) {
    let m;
    if ((m = cmd.match(/^password (.+)$/))) return apply({ kind: "line-password", line: mode.line, value: m[1] });
    if (cmd === "login") return apply({ kind: "line-login", line: mode.line, value: true });
    if (cmd === "no login") return apply({ kind: "line-login", line: mode.line, value: false });
    if ((m = cmd.match(/^transport input (.+)$/))) return apply({ kind: "line-transport", line: mode.line, value: m[1].split(/\s+/) });
    if (cmd === "logging synchronous") return apply({ kind: "line-logging", line: mode.line, value: true });
    if ((m = cmd.match(/^exec-timeout (\d+) ?(\d+)?$/))) return apply({ kind: "line-timeout", line: mode.line, minutes: Number(m[1]), seconds: Number(m[2] || 0) });
    invalid(cmd);
  }

  function runAcl(cmd) {
    const m = cmd.match(/^(permit|deny) (.+)$/);
    if (m) return apply({ kind: "acl-entry", name: mode.acl, aclType: mode.aclType, action: m[1], spec: m[2] });
    if (cmd.startsWith("remark ")) return apply({ kind: "acl-remark", name: mode.acl, value: cmd.slice(7) });
    invalid(cmd);
  }

  function runShow(cmd) {
    if (cmd === "show" || cmd === "show ?") return showHelp();
    if (cmd === "show running-config" || cmd === "show run") return pushMany(OPT_Engine.serializeConfig(device).split("\n"));
    if (cmd === "show startup-config" || cmd === "show start") return pushMany((device.startupConfig || "startup-config is not present").split("\n"));
    if (cmd === "show version" || cmd === "show ver") return showVersion();
    if (cmd === "show ip interface brief" || cmd === "show ip int br") return showIpBrief();
    if (cmd === "show interfaces" || cmd.startsWith("show interfaces ")) return showInterfaces(cmd);
    if (cmd === "show ip route" || cmd === "sh ip route") return showRoute();
    if (cmd === "show vlan brief" || cmd === "show vlan") return showVlan();
    if (cmd === "show interfaces trunk") return showTrunks();
    if (cmd === "show mac address-table" || cmd === "show mac") return showMac();
    if (cmd === "show spanning-tree" || cmd.startsWith("show spanning-tree")) return showStp();
    if (cmd === "show ip ospf neighbor") return showOspfNeighbors();
    if (cmd === "show ip protocols") return showIpProtocols();
    if (cmd === "show access-lists" || cmd === "show ip access-lists") return showAcls();
    if (cmd === "show ip dhcp binding") return showDhcpBinding();
    if (cmd === "show ip dhcp pool") return showDhcpPool();
    if (cmd === "show ip nat translations") return showNat();
    if (cmd === "show ip nat statistics") return showNatStats();
    if (cmd === "show arp" || cmd === "show ip arp") return showArp();
    if (cmd === "show cdp neighbors" || cmd === "show lldp neighbors") return showNeighbors();
    if (cmd === "show logging") return showLogging();
    invalid(cmd);
  }

  function showVersion() {
    push("", `${device.osVersion || "OpenPT IOS XE"}`);
    push("", `OpenPT platform image: ${device.image || "unknown"}`);
    push("", `${device.hostname} uptime is 42 minutes`);
    push("", `System image file is "flash:${device.image || "openpt"}.bin"`);
    push("", `cisco ${device.model || device.kind} processor with ${Object.keys(device.interfaces || {}).length} interfaces`);
  }
  function showIpBrief() {
    push("dim", "Interface                      IP-Address      OK? Method Status                Protocol");
    Object.entries(device.interfaces || {}).forEach(([n, i]) => {
      const status = i.admUp === false ? "administratively down" : (i.up ? "up" : "down");
      push(i.up ? "ok" : "warn", `${shortIface(n).padEnd(30)}${(i.ip || "unassigned").padEnd(16)}YES manual ${status.padEnd(22)}${i.up ? "up" : "down"}`);
    });
  }
  function showInterfaces(cmd) {
    const parts = cmd.split(/\s+/);
    const target = parts.length > 2 ? normalizeIface(parts.slice(2).join(" "), device) : null;
    const list = target ? [[target, device.interfaces[target]]] : Object.entries(device.interfaces || {});
    list.filter(([, i]) => i).forEach(([n, i]) => {
      push("", `${shortIface(n)} is ${i.up ? "up" : "down"}, line protocol is ${i.up ? "up" : "down"}`);
      push("", `  Hardware is ${i.routed ? "routed port" : (i.mode ? `switchport ${i.mode}` : "Ethernet")}, address is ${i.mac}`);
      if (i.ip) push("", `  Internet address is ${i.ip}/${OPT_Engine.maskBits(i.mask)}`);
      if (i.desc) push("", `  Description: ${i.desc}`);
    });
  }
  function showRoute() {
    if (!OPT_Engine.isRouterLike(device)) return push("err", "% IP routing table is not available on this device");
    push("dim", "Codes: C - connected, S - static, O - OSPF");
    if (!device.routes?.length) return push("dim", "Gateway of last resort is not set\n\nNo routes.");
    (device.routes || []).forEach((r) => push("", `${r.type.padEnd(3)} ${r.dst}/${OPT_Engine.maskBits(r.mask)} ${r.via === "directly" ? `is directly connected, ${shortIface(r.iface)}` : `via ${r.via}, ${shortIface(r.iface)}`}`));
  }
  function showVlan() {
    if (!device.vlans) return push("err", "% VLAN database is not available on this device");
    push("dim", "VLAN Name                             Status    Ports");
    push("dim", "---- -------------------------------- --------- ------------------------------");
    Object.entries(device.vlans).forEach(([id, name]) => {
      const ports = Object.entries(device.interfaces || {}).filter(([, i]) => i.mode === "access" && String(i.vlan) === String(id)).map(([n]) => shortIface(n)).join(", ") || "";
      push("", `${String(id).padEnd(5)}${String(name).padEnd(33)}active    ${ports}`);
    });
  }
  function showTrunks() {
    push("dim", "Port        Mode         Native vlan  Vlans allowed on trunk");
    Object.entries(device.interfaces || {}).filter(([, i]) => i.mode === "trunk").forEach(([n, i]) => {
      push("", `${shortIface(n).padEnd(12)}on           ${String(i.nativeVlan || 1).padEnd(13)}${i.allowedVlans || "all"}`);
    });
  }
  function showMac() {
    if (!OPT_Engine.isSwitchLike(device)) return push("err", "% Not supported on this device");
    push("dim", "          Mac Address Table");
    push("dim", "Vlan    Mac Address       Type        Ports");
    Object.entries(device.interfaces || {}).filter(([, i]) => i.up && i.mac && !i.ip).forEach(([n, i]) => push("", `${String(i.vlan || i.nativeVlan || 1).padEnd(8)}${i.mac.padEnd(18)}DYNAMIC     ${shortIface(n)}`));
  }
  function showStp() {
    if (!OPT_Engine.isSwitchLike(device)) return push("err", "% Spanning tree is not enabled on this platform model");
    Object.keys(device.vlans || {}).forEach((id) => {
      push("", `VLAN${String(id).padStart(4, "0")}`);
      push("", `  Spanning tree enabled protocol ${device.stp?.mode || "rapid-pvst"}`);
      push("", `  Bridge Priority ${(device.stp?.vlanPriority || {})[id] || 32768}`);
      Object.entries(device.interfaces || {}).filter(([, i]) => i.mode && OPT_Engine.isSwitchLike(device)).forEach(([n, i]) => {
        if (i.mode === "trunk" || String(i.vlan) === String(id)) push("", `  ${shortIface(n).padEnd(12)} ${i.stp?.state || "forwarding"}`);
      });
    });
  }
  function showOspfNeighbors() {
    const neighbors = [];
    Object.values(devices).forEach((d) => {
      if (d.id !== device.id && OPT_Engine.isRouterLike(d) && Object.keys(d.ospf || {}).length) neighbors.push(d);
    });
    push("dim", "Neighbor ID     Pri   State           Address         Interface");
    neighbors.forEach((n) => {
      const ip = Object.values(n.interfaces || {}).find((i) => i.ip)?.ip || "0.0.0.0";
      push("", `${(Object.values(n.ospf || {})[0]?.routerId || ip).padEnd(15)}1     FULL/DR         ${ip.padEnd(15)}-`);
    });
  }
  function showIpProtocols() {
    Object.entries(device.ospf || {}).forEach(([pid, o]) => {
      push("", `Routing Protocol is "ospf ${pid}"`);
      (o.networks || []).forEach((n) => push("", `  Routing for Networks: ${n.network} ${n.wildcard} area ${n.area}`));
    });
    if (!Object.keys(device.ospf || {}).length) push("dim", "No active IP routing protocols.");
  }
  function showAcls() {
    const acls = Object.entries(device.acls || {});
    if (!acls.length) return push("dim", "No access lists configured.");
    acls.forEach(([name, acl]) => {
      push("", `${acl.type} IP access list ${name}`);
      (acl.entries || []).forEach((e, idx) => push("", `    ${idx + 10} ${e.action} ${e.spec || e.src || "any"}`));
    });
  }
  function showDhcpBinding() {
    const b = device.dhcp?.bindings || [];
    if (!b.length) return push("dim", "No DHCP bindings.");
    push("dim", "IP address       Client-ID/Hardware address      Lease expiration");
    b.forEach((x) => push("", `${x.ip.padEnd(17)}${(x.mac || x.client).padEnd(32)}Infinite`));
  }
  function showDhcpPool() {
    Object.entries(device.dhcp?.pools || {}).forEach(([name, p]) => push("", `Pool ${name}: ${p.network || "unconfigured"} ${p.mask || ""}`));
  }
  function showNat() {
    const n = device.nat?.translations || [];
    if (!n.length) return push("dim", "No NAT translations.");
    n.forEach((x) => push("", `${x.proto || "icmp"} ${x.insideLocal} ${x.insideGlobal} ${x.outsideLocal || "-"} ${x.outsideGlobal || "-"}`));
  }
  function showNatStats() {
    const inside = Object.entries(device.interfaces || {}).filter(([, i]) => i.natRole === "inside").length;
    const outside = Object.entries(device.interfaces || {}).filter(([, i]) => i.natRole === "outside").length;
    push("", `Total active translations: ${(device.nat?.translations || []).length}`);
    push("", `Interfaces: ${inside} inside, ${outside} outside`);
  }
  function showArp() {
    const rows = Object.entries(device.arp || {});
    if (!rows.length) return push("dim", "Protocol  Address          Age (min)  Hardware Addr   Type   Interface");
    rows.forEach(([ip, mac]) => push("", `Internet  ${ip.padEnd(16)}0          ${mac.padEnd(15)}ARPA   -`));
  }
  function showNeighbors() {
    push("dim", "Device ID        Local Intrfce     Capability  Platform        Port ID");
    (links || []).forEach((l) => {
      let local = null, remote = null, port = null;
      if (l.a === device.id) { local = l.ai; remote = devices[l.b]; port = l.bi; }
      if (l.b === device.id) { local = l.bi; remote = devices[l.a]; port = l.ai; }
      if (remote) push("", `${remote.hostname.padEnd(16)}${shortIface(local).padEnd(17)}${remote.kind.padEnd(12)}${(remote.model || "").slice(0, 14).padEnd(16)}${shortIface(port)}`);
    });
  }
  function showLogging() {
    (device.logging || []).slice(-40).forEach((l) => push(l.sev || "", l.message || l));
    if (!(device.logging || []).length) push("dim", "No log messages.");
  }

  function doPing(target, trace = false) {
    if (trace) {
      const result = onPing && onPing(device.id, target, { trace });
      if (!result) return;
      push("dim", `Tracing the route to ${target}`);
      result.hops.filter((h) => ["route", "switch", "nat", "drop", "deliver"].includes(h.action)).forEach((h, idx) => {
        const d = result.devices[h.devId];
        push(h.ok === false ? "err" : "", shortIfaceText(`  ${idx + 1}  ${d?.hostname || "?"}  ${h.note}`));
      });
      return push(result.ok ? "ok" : "err", result.ok ? "Trace complete." : shortIfaceText(result.error));
    }
    push("dim", `Sending 5, 100-byte ICMP Echos to ${target}, timeout is 2 seconds:`);
    onPing && onPing(device.id, target, {}, (result) => {
      push(result.ok ? "ok" : "err", result.ok ? "!!!!!" : ".....");
      push(result.ok ? "ok" : "err", result.ok ? "Success rate is 100 percent (5/5), round-trip min/avg/max = 2/4/7 ms" : shortIfaceText(`Success rate is 0 percent (0/5) - ${result.error}`));
    });
  }

  function submit(e) {
    e.preventDefault();
    const v = input;
    if (v.trim()) {
      const key = mode.name;
      setHistory((h) => ({ ...h, [key]: [...(h[key] || []), v].slice(-100) }));
    }
    handle(v);
    setInput("");
    setHistIdx(-1);
  }

  function onKeyDown(e) {
    const modeHist = history[mode.name] || [];
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
      else setInput(modeHist[idx]);
    } else if (e.key === "Tab") {
      e.preventDefault();
      setInput((v) => completeCommand(v, mode, device));
    } else if (e.ctrlKey && e.key.toLowerCase() === "z") {
      e.preventDefault();
      setMode({ name: "priv" });
    }
  }

  return (
    <div className="cli" onClick={() => inputRef.current?.focus()}>
      <div className="cli-stack" ref={ref}>
        {lines.map((l, i) => <div key={i} className={`cli-line ${l.cls}`}>{l.text}</div>)}
        <form className="cli-prompt-row" onSubmit={submit}>
          <span className="cli-prompt">{promptFor()}</span>
          <input className="cli-input" ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKeyDown} autoFocus spellCheck={false} autoComplete="off" />
        </form>
        <div style={{ flex: 1 }} />
      </div>
    </div>
  );
}

function normalizeIface(s, device) {
  const cleaned = s.trim().replace(/\s+/g, "");
  for (const k of Object.keys(device.interfaces || {})) if (k.toLowerCase() === cleaned.toLowerCase()) return k;
  const m = cleaned.match(/^(gigabitethernet|gig|gi|g|fastethernet|fast|fa|f|serial|ser|se|s|ethernet|eth|e|vlan|vl)(.+)$/i);
  if (!m) return null;
  const pre = m[1].toLowerCase();
  let candidate = null;
  if (pre.startsWith("gi") || pre === "g") candidate = cleaned.match(/^(?:\D+)(.+)$/)?.[1]?.includes("/") ? `GigabitEthernet${m[2]}` : `GigabitEthernet${m[2]}`;
  else if (pre.startsWith("fa") || pre === "f") candidate = `FastEthernet${m[2]}`;
  else if (pre.startsWith("se") || pre === "s") candidate = `Serial${m[2]}`;
  else if (pre.startsWith("eth") || pre === "e") candidate = `eth${m[2]}`;
  else if (pre.startsWith("vl")) candidate = `Vlan${m[2]}`;
  for (const k of Object.keys(device.interfaces || {})) if (k.toLowerCase() === String(candidate).toLowerCase()) return k;
  if (candidate?.startsWith("Vlan")) return candidate;
  return null;
}

function expandIfaceRange(text, device) {
  const out = [];
  for (const part of text.split(",")) {
    const p = part.trim();
    const m = p.match(/^(.*?)(\d+)\s*-\s*(\d+)$/);
    if (m) {
      for (let n = Number(m[2]); n <= Number(m[3]); n++) {
        const iface = normalizeIface(`${m[1]}${n}`, device);
        if (iface) out.push(iface);
      }
    } else {
      const iface = normalizeIface(p, device);
      if (iface) out.push(iface);
    }
  }
  return [...new Set(out)];
}

function shortIface(n) {
  return OPT_Engine.shortIfaceName ? OPT_Engine.shortIfaceName(n) : n.replace("GigabitEthernet", "g").replace("FastEthernet", "f").replace("Serial", "s");
}

function shortIfaceText(text) {
  return OPT_Engine.shortIfaceNamesInText ? OPT_Engine.shortIfaceNamesInText(text) : text;
}

function completeCommand(input, mode, device) {
  const pool = [...(COMMAND_HINTS[mode.name === "conf-if-range" ? "conf-if" : mode.name] || []), ...Object.keys(device.interfaces || {}).map(shortIface)];
  const words = input.split(/\s+/);
  const last = words[words.length - 1]?.toLowerCase();
  if (!last) return input;
  const hit = pool.find((p) => p.toLowerCase().startsWith(last));
  if (!hit) return input;
  words[words.length - 1] = hit;
  return words.join(" ") + " ";
}

window.CLI = CLI;
