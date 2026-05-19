// cli.jsx - IOS XE-like CLI for OpenPT platform profiles.

const { OPT_Engine } = window;

const COMMAND_HINTS = {
  user: ["enable", "show", "ping", "traceroute", "ipconfig", "services", "service", "exit"],
  host: ["?", "help", "arp", "arp -a", "delete", "dir", "ftp", "ipconfig", "ipconfig /all", "ipconfig /release", "ipconfig /renew", "ipv6config", "netstat", "nslookup", "ping", "snmpget", "snmpgetbulk", "snmpset", "ssh", "telnet", "tracert", "services", "service", "exit"],
  priv: ["configure terminal", "show running-config", "show startup-config", "show version", "show ip interface brief", "show ip route", "show vlan brief", "show interfaces trunk", "show mac address-table", "show spanning-tree", "show etherchannel summary", "show port-security", "show ip dhcp snooping", "show ip arp inspection", "show ip ospf neighbor", "show ip protocols", "show access-lists", "show ip dhcp binding", "show ip nat translations", "show vrf", "show route-map", "show policy-map", "show ip sla summary", "show platform", "show inventory", "show license", "dir", "copy running-config startup-config", "write memory", "disable", "exit"],
  conf: ["hostname", "interface", "interface range", "vlan", "router ospf", "router eigrp", "router rip", "router bgp", "ip route", "ip routing", "ip dhcp pool", "ip dhcp excluded-address", "ip access-list", "access-list", "ip prefix-list", "route-map", "vrf definition", "ip nat pool", "ip nat inside source", "aaa new-model", "crypto key generate rsa", "ntp server", "snmp-server community", "logging host", "ip dhcp snooping", "ip arp inspection vlan", "monitor session", "class-map", "policy-map", "ip sla", "track", "username", "enable secret", "line console 0", "line vty 0 4", "service password-encryption", "end", "exit"],
  "conf-if": ["description", "ip address", "no ip address", "switchport mode access", "switchport mode trunk", "switchport access vlan", "switchport voice vlan", "switchport trunk allowed vlan", "switchport trunk native vlan", "switchport port-security", "channel-group", "ip dhcp snooping trust", "ip arp inspection trust", "ip access-group", "ip policy route-map", "ip nat inside", "ip nat outside", "service-policy input", "service-policy output", "encapsulation ppp", "encapsulation hdlc", "tunnel source", "tunnel destination", "storm-control", "spanning-tree portfast", "spanning-tree guard root", "shutdown", "no shutdown", "exit"],
  "conf-vlan": ["name", "exit"],
  "conf-router": ["router-id", "network", "passive-interface", "default-information originate", "exit"],
  "conf-dhcp": ["network", "default-router", "dns-server", "lease", "exit"],
  "conf-line": ["password", "login", "transport input", "logging synchronous", "exec-timeout", "exit"],
  "conf-acl": ["permit", "deny", "remark", "exit"],
  "conf-route-map": ["match ip address", "match ip address prefix-list", "set ip next-hop", "set metric", "exit"],
  "conf-vrf": ["rd", "address-family ipv4", "exit"],
  "conf-class-map": ["match access-group name", "match dscp", "exit"],
  "conf-policy-map": ["class", "exit"],
  "conf-policy-class": ["set dscp", "police", "bandwidth percent", "priority", "exit"],
  "conf-ip-sla": ["icmp-echo", "frequency", "exit"],
};

const IOS_ABBREVIATION_SPECS = [
  ...[
    "enable", "disable", "exit", "end", "show", "ping <word>", "traceroute <word>", "do <rest>",
    "show running-config", "show startup-config", "show version", "show ip interface brief", "show interfaces trunk", "show interfaces", "show interfaces <word>",
    "show ip route", "show vlan brief", "show vlan", "show mac address-table", "show mac", "show spanning-tree", "show etherchannel summary", "show port-security",
    "show ip dhcp snooping", "show ip arp inspection", "show ip ospf neighbor", "show ip protocols", "show ip eigrp neighbors",
    "show ip bgp summary", "show ip rip database", "show access-lists", "show ip access-lists", "show ip dhcp binding", "show ip dhcp pool",
    "show ip nat translations", "show ip nat statistics", "show arp", "show ip arp", "show cdp neighbors", "show lldp neighbors",
    "show logging", "show vrf", "show route-map", "show ip prefix-list", "show policy-map interface", "show policy-map", "show class-map",
    "show ip sla summary", "show track", "show snmp community", "show ntp associations", "show standby brief", "show standby",
    "show ip pim neighbor", "show ip mroute", "show platform", "show inventory", "show license", "show processes", "show flash:",
    "show wireless",
    "dir", "dir flash:", "more <rest>", "delete <rest>",
  ].map((pattern) => ({ modes: ["all"], pattern })),
  ...[
    "ip address <word> <word> <word>", "ip dhcp", "dhcp", "ipconfig", "ipconfig /all", "show ip", "arp -a", "services", "service <word> <word>",
  ].map((pattern) => ({ modes: ["user"], pattern })),
  ...[
    "help", "?", "arp", "arp -a", "arp -d", "arp -d <word>", "delete <rest>", "dir", "ftp <word>", "ipconfig",
    "ipconfig /all", "ipconfig /release", "ipconfig /renew", "ipconfig /?", "ipv6config", "ipv6config /all",
    "netstat", "netstat -a", "netstat -r", "nslookup <word>", "ping <word>", "snmpget <rest>",
    "snmpgetbulk <rest>", "snmpset <rest>", "ssh <rest>", "telnet <word>", "tracert <word>",
  ].map((pattern) => ({ modes: ["host"], pattern })),
  ...[
    "configure terminal", "write memory", "write", "copy running-config startup-config", "copy run start", "erase startup-config",
    "write erase", "terminal length <word>",
  ].map((pattern) => ({ modes: ["priv"], pattern })),
  ...[
    "hostname <word>", "enable secret <rest>", "service password-encryption", "no service password-encryption",
    "ip routing", "no ip routing", "ip multicast-routing", "no ip multicast-routing", "username <word> secret <rest>",
    "interface range <rest>", "interface <rest>", "vlan <word>", "no vlan <word>", "ip route <word> <word> <word>",
    "no ip route <word> <word> <word>", "router ospf <word>", "router eigrp <word>", "router rip", "router bgp <word>",
    "ip dhcp pool <word>", "ip dhcp excluded-address <rest>", "no ip dhcp excluded-address <rest>",
    "ip access-list standard <word>", "ip access-list extended <word>", "access-list <word> permit <rest>", "access-list <word> deny <rest>",
    "line console 0", "line vty 0 4", "ip prefix-list <word> permit <rest>", "ip prefix-list <word> deny <rest>",
    "route-map <word> permit <word?>", "route-map <word> deny <word?>", "vrf definition <word>",
    "ip nat pool <word> <word> <word> netmask <word>", "ip nat inside source static <word> <word>",
    "ip nat inside source list <word> interface <word> overload", "ip nat inside source list <word> pool <word> overload",
    "aaa new-model", "no aaa new-model", "aaa authentication login <word> <rest>", "crypto key generate rsa modulus <word>",
    "crypto key generate rsa", "ntp server <word>", "snmp-server community <rest>", "snmp-server host <rest>", "logging host <word>",
    "ip dhcp snooping", "ip dhcp snooping vlan <rest>", "ip arp inspection vlan <rest>",
    "monitor session <word> source interface <word>", "monitor session <word> destination interface <word>",
    "vtp mode server", "vtp mode client", "vtp mode transparent", "vtp mode off", "vtp domain <word>",
    "spanning-tree vlan <word> root primary", "spanning-tree vlan <word> root secondary", "spanning-tree vlan <word> priority <word>",
    "class-map match-any <word>", "class-map match-all <word>", "class-map <word>", "policy-map <word>", "ip sla <word>", "track <word> <rest>",
    "wireless ssid <rest>", "wireless security <word> <rest?>",
  ].map((pattern) => ({ modes: ["conf"], pattern })),
  ...[
    "description <rest>", "no description", "ip address <word> <word>", "no ip address", "shutdown", "no shutdown",
    "nameif <word>", "security-level <word>",
    "switchport", "no switchport", "switchport mode access", "switchport mode trunk", "switchport access vlan <word>",
    "switchport voice vlan <word>", "switchport trunk native vlan <word>", "switchport trunk allowed vlan <rest>",
    "switchport port-security", "no switchport port-security", "switchport port-security maximum <word>",
    "switchport port-security violation protect", "switchport port-security violation restrict", "switchport port-security violation shutdown",
    "switchport port-security mac-address <word>", "channel-group <word> mode active", "channel-group <word> mode passive",
    "channel-group <word> mode on", "channel-group <word> mode auto", "channel-group <word> mode desirable",
    "storm-control broadcast level <word>", "storm-control action shutdown", "storm-control action trap",
    "ip dhcp snooping trust", "no ip dhcp snooping trust", "ip arp inspection trust", "no ip arp inspection trust",
    "spanning-tree portfast", "no spanning-tree portfast", "spanning-tree guard root", "spanning-tree guard loop", "spanning-tree guard none",
    "spanning-tree bpduguard enable", "spanning-tree bpduguard disable", "ip access-group <word> in", "ip access-group <word> out",
    "no ip access-group <word> in", "no ip access-group <word> out", "ip policy route-map <word>",
    "ip nat inside", "ip nat outside", "no ip nat inside", "no ip nat outside", "speed auto", "speed 10", "speed 100", "speed 1000",
    "duplex auto", "duplex full", "duplex half", "encapsulation ppp", "encapsulation hdlc", "encapsulation dot1q <word>",
    "tunnel source <word>", "tunnel destination <word>", "service-policy input <word>", "service-policy output <word>",
    "ip pim sparse-mode", "ip pim dense-mode", "ip igmp join-group <word>", "standby <word> ip <word>", "standby <word> priority <word>",
  ].map((pattern) => ({ modes: ["conf-if", "conf-if-range"], pattern })),
  ...["name <rest>"].map((pattern) => ({ modes: ["conf-vlan"], pattern })),
  ...[
    "router-id <word>", "version <word>", "network <word> <word> area <word>", "neighbor <word> remote-as <word>",
    "network <word> mask <word>", "network <word> <word?>", "passive-interface <rest>", "no passive-interface <rest>",
    "default-information originate",
  ].map((pattern) => ({ modes: ["conf-router"], pattern })),
  ...["network <word> <word>", "default-router <word>", "dns-server <word>", "lease <word>"].map((pattern) => ({ modes: ["conf-dhcp"], pattern })),
  ...["password <rest>", "login", "no login", "transport input <rest>", "logging synchronous", "exec-timeout <word> <word?>"].map((pattern) => ({ modes: ["conf-line"], pattern })),
  ...["permit <rest>", "deny <rest>", "remark <rest>"].map((pattern) => ({ modes: ["conf-acl"], pattern })),
  ...["match <rest>", "set <rest>"].map((pattern) => ({ modes: ["conf-route-map", "conf-class-map"], pattern })),
  ...["rd <rest>", "address-family ipv4"].map((pattern) => ({ modes: ["conf-vrf"], pattern })),
  ...["class <word>"].map((pattern) => ({ modes: ["conf-policy-map"], pattern })),
  ...["set <rest>", "police <rest>", "bandwidth percent <word>", "bandwidth <rest>", "priority <rest?>", "shape <rest>", "queue-limit <rest>"].map((pattern) => ({ modes: ["conf-policy-class"], pattern })),
  ...["icmp-echo <word>", "frequency <word>"].map((pattern) => ({ modes: ["conf-ip-sla"], pattern })),
].map((spec) => ({
  ...spec,
  tokens: spec.pattern.split(/\s+/),
  literalCount: spec.pattern.split(/\s+/).filter((t) => !t.startsWith("<")).length,
})).sort((a, b) => b.literalCount - a.literalCount || b.tokens.length - a.tokens.length);

const CONFIG_PARENT_COMMAND_PATTERNS = [
  /^(?:interface|int) (?:range )?.+$/,
  /^vlan \d+$/,
  /^no vlan \d+$/,
  /^router (?:ospf|eigrp|rip|bgp)\b/,
  /^ip dhcp pool \S+$/,
  /^ip access-list (?:standard|extended) \S+$/,
  /^line (?:console 0|vty 0 4)$/,
  /^route-map \S+ (?:permit|deny)(?: \d+)?$/,
  /^vrf definition \S+$/,
  /^class-map(?: match-(?:any|all))? \S+$/,
  /^policy-map \S+$/,
  /^ip sla \d+$/,
];

function isConfigSubmode(modeName) {
  return /^conf-.+/.test(modeName || "");
}

function isParentConfigCommand(cmd) {
  return CONFIG_PARENT_COMMAND_PATTERNS.some((pattern) => pattern.test(cmd));
}

function CLI({ device, devices = {}, links = [], onApply, onPing, pendingCmd, active, scrollState, onScrollStateChange, historyState, onHistoryChange, ghostSuggestions = true }) {
  const ref = React.useRef(null);
  const inputRef = React.useRef(null);
  const [lines, setLines] = React.useState([]);
  const [mode, setMode] = React.useState({ name: "user" });
  const [input, setInput] = React.useState("");
  const [history, setHistory] = React.useState(historyState || {});
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
    setHistory(historyState || {});
  }, [device?.id, historyState]);

  React.useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);

  React.useEffect(() => {
    if (!ref.current || !scrollState || scrollState.atBottom) return;
    ref.current.scrollTop = scrollState.top || 0;
  }, [device?.id, scrollState?.top]);

  const reportScroll = () => {
    if (!ref.current || !onScrollStateChange || !device?.id) return;
    const el = ref.current;
    const atBottom = Math.abs(el.scrollHeight - el.clientHeight - el.scrollTop) < 4;
    onScrollStateChange(device.id, atBottom ? { atBottom: true } : { atBottom: false, top: el.scrollTop });
  };

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
    if (mode.name === "conf-route-map") return `${h}(config-route-map)#`;
    if (mode.name === "conf-vrf") return `${h}(config-vrf)#`;
    if (mode.name === "conf-class-map") return `${h}(config-cmap)#`;
    if (mode.name === "conf-policy-map") return `${h}(config-pmap)#`;
    if (mode.name === "conf-policy-class") return `${h}(config-pmap-c)#`;
    if (mode.name === "conf-ip-sla") return `${h}(config-ip-sla)#`;
    return `${h}>`;
  };

  function apply(cmd) {
    onApply && onApply(cmd);
  }
  function applyIface(kind, data = {}) {
    const ifaces = mode.name === "conf-if-range" ? mode.ifaces : [mode.iface];
    for (const iface of ifaces) apply({ kind, iface, ...data });
  }

  function closestCommand(cmd) {
    const key = commandHintKey(mode, device);
    const pool = COMMAND_HINTS[key] || [];
    const first = String(cmd || "").split(/\s+/)[0].toLowerCase();
    if (!first) return "";
    return pool.find((hint) => hint.toLowerCase().startsWith(first))
      || pool.find((hint) => hint.toLowerCase().includes(first))
      || "";
  }

  function invalid(cmd, note = "") {
    const closest = closestCommand(cmd);
    const suffix = note || (closest ? ` Try "${closest}".` : "");
    push("err", `% Invalid input detected at '^' marker.${suffix ? ` ${suffix}` : ""}`);
  }

  function isSwitchPlatform() {
    return OPT_Engine.isSwitchLike ? OPT_Engine.isSwitchLike(device) : device.kind === "l2switch" || device.kind === "l3switch";
  }

  function isRouterPlatform() {
    return OPT_Engine.isRouterLike ? OPT_Engine.isRouterLike(device) : device.kind === "router" || device.kind === "l3switch";
  }

  function unsupported(feature) {
    push("err", `% ${feature} is not supported on ${device.model || device.kind}.`);
  }

  function showHelp() {
    const key = commandHintKey(mode, device);
    pushMany((COMMAND_HINTS[key] || []).map((h) => `  ${h}`), "dim");
  }

  function handle(raw, opts = {}) {
    const typed = raw.trim().replace(/\s+/g, " ");
    const cmd = expandIosAbbreviations(typed, mode, device);
    if (!opts.silent) setLines((l) => [...l, { cls: "input", text: `${promptFor()} ${typed}` }]);
    if (!cmd) return;
    if (cmd === "?" || cmd.endsWith(" ?")) return showHelp();
    if (cmd === "end") return setMode({ name: "priv" });
    if (cmd === "exit") return exitMode();
    if (cmd === "disable") return setMode({ name: "user" });
    if (cmd.startsWith("do ") && mode.name.startsWith("conf")) {
      const inner = cmd.slice(3);
      if (inner.startsWith("show ") || inner === "show") return runShow(inner);
      if (inner.startsWith("ping ")) return doPing(inner.split(/\s+/)[1]);
      return runPriv(inner);
    }

    if (mode.name === "user" && isHostConsoleDevice(device)) return runHost(cmd);
    if (mode.name === "user" && (OPT_Engine.isHostLike?.(device) || device.kind === "server") && (cmd === "show ip" || cmd === "ipconfig" || cmd === "ipconfig /all" || cmd === "arp -a" || cmd === "ip dhcp" || cmd === "dhcp" || /^ip(?: address)? \S+ \S+ \S+$/.test(cmd))) return runHost(cmd);
    if (cmd.startsWith("show ") || cmd === "show") return runShow(cmd);
    if (cmd.startsWith("ping ")) return doPing(cmd.split(/\s+/)[1]);
    if (cmd.startsWith("traceroute ") || cmd.startsWith("trace ")) return doPing(cmd.split(/\s+/)[1], true);
    if (isConfigSubmode(mode.name) && isParentConfigCommand(cmd)) return runGlobal(cmd);

    if (mode.name === "user") return runUser(cmd);
    if (mode.name === "priv") return runPriv(cmd);
    if (mode.name === "conf") return runGlobal(cmd);
    if (mode.name === "conf-if" || mode.name === "conf-if-range") return runInterface(cmd);
    if (mode.name === "conf-vlan") return runVlan(cmd);
    if (mode.name === "conf-router") return runRouter(cmd);
    if (mode.name === "conf-dhcp") return runDhcp(cmd);
    if (mode.name === "conf-line") return runLine(cmd);
    if (mode.name === "conf-acl") return runAcl(cmd);
    if (mode.name === "conf-route-map") return runRouteMap(cmd);
    if (mode.name === "conf-vrf") return runVrf(cmd);
    if (mode.name === "conf-class-map") return runClassMap(cmd);
    if (mode.name === "conf-policy-map") return runPolicyMap(cmd);
    if (mode.name === "conf-policy-class") return runPolicyClass(cmd);
    if (mode.name === "conf-ip-sla") return runIpSla(cmd);
    invalid(cmd);
  }

  function exitMode() {
    if (mode.name === "user") return push("dim", "[session closed]");
    if (mode.name === "priv") return setMode({ name: "user" });
    if (mode.name === "conf") return setMode({ name: "priv" });
    if (mode.name === "conf-policy-class") return setMode({ name: "conf-policy-map", policy: mode.policy });
    return setMode({ name: "conf" });
  }

  function runUser(cmd) {
    if (cmd === "enable" || cmd === "en") return setMode({ name: "priv" });
    if (OPT_Engine.isHostLike?.(device) || device.kind === "server") return runHost(cmd);
    invalid(cmd, "(try 'enable')");
  }

  function runPriv(cmd) {
    let m;
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
    if (cmd === "dir" || cmd === "dir flash:" || cmd === "show flash:") return showDir();
    if ((m = cmd.match(/^more (.+)$/))) return showFile(m[1]);
    if ((m = cmd.match(/^delete (.+)$/))) { apply({ kind: "file-delete", path: m[1] }); return push("warn", `Deleted ${m[1]}`); }
    if (cmd === "terminal length 0" || cmd.match(/^terminal length \d+$/)) return;
    invalid(cmd);
  }

  function runHost(cmd) {
    let m;
    if (cmd === "?" || cmd === "help") return showHelp();
    if ((m = cmd.match(/^ip(?: address)? (\S+) (\S+) (\S+)$/))) {
      apply({ kind: "host-ip", ip: m[1], mask: m[2], gw: m[3] });
      return;
    }
    if (cmd === "ip dhcp" || cmd === "dhcp") {
      apply({ kind: "host-dhcp" });
      return push("dim", "DHCP discovery sent on eth0.");
    }
    if (cmd === "ipconfig" || cmd === "ipconfig /all" || cmd === "show ip") {
      return showHostIpConfig(cmd === "ipconfig /all");
    }
    if (cmd === "ipconfig /release") {
      apply({ kind: "host-ip", ip: null, mask: null, gw: null });
      return push("dim", "Windows IP Configuration\n\nEthernet adapter eth0: IP address released.");
    }
    if (cmd === "ipconfig /renew") {
      apply({ kind: "host-dhcp" });
      return push("dim", "Windows IP Configuration\n\nEthernet adapter eth0: DHCP request sent.");
    }
    if (cmd === "ipconfig /?") {
      return pushMany([
        "USAGE: ipconfig [/all] [/release] [/renew]",
        "  /all       Display full configuration information.",
        "  /release   Release the IPv4 address for eth0.",
        "  /renew     Renew the IPv4 address for eth0.",
      ], "dim");
    }
    if (cmd === "ipv6config" || cmd === "ipv6config /all") {
      return showHostIpv6Config(cmd === "ipv6config /all");
    }
    if (cmd === "arp" || cmd === "arp -a") {
      return showHostArp();
    }
    if (cmd === "arp -d" || /^arp -d \S+$/.test(cmd)) {
      push("dim", cmd === "arp -d" ? "ARP cache cleared." : `ARP entry ${cmd.split(/\s+/)[2]} deleted.`);
      return;
    }
    if (cmd === "dir") {
      return showHostDir();
    }
    if ((m = cmd.match(/^delete (.+)$/))) {
      const path = hostFileKey(m[1]);
      apply({ kind: "file-delete", path });
      return push("warn", `Deleted ${hostDisplayPath(path)}`);
    }
    if (cmd === "netstat" || cmd === "netstat -a" || cmd === "netstat -r") {
      return showHostNetstat(cmd);
    }
    if ((m = cmd.match(/^nslookup (.+)$/))) {
      return showHostNslookup(m[1]);
    }
    if ((m = cmd.match(/^ping (.+)$/))) {
      return doPing(resolveHostTarget(m[1]) || m[1]);
    }
    if ((m = cmd.match(/^tracert (.+)$/))) {
      return doPing(resolveHostTarget(m[1]) || m[1], true);
    }
    if ((m = cmd.match(/^ftp (.+)$/))) {
      return runHostSession("ftp", m[1]);
    }
    if ((m = cmd.match(/^telnet (.+)$/))) {
      return runHostSession("telnet", m[1]);
    }
    if ((m = cmd.match(/^ssh (.+)$/))) {
      return runHostSession("ssh", m[1]);
    }
    if ((m = cmd.match(/^(snmpget|snmpgetbulk|snmpset) (.+)$/))) {
      return runHostSnmp(m[1], m[2]);
    }
    if (cmd === "ftp" || cmd === "telnet" || cmd === "ssh" || cmd === "nslookup" || cmd === "snmpget" || cmd === "snmpgetbulk" || cmd === "snmpset") {
      return push("err", usageForHostCommand(cmd));
    }
    if (cmd === "services" && device.kind === "server") {
      for (const name of hostServerServiceNames()) {
        push("", `${name.padEnd(8)} ${hostServiceEnabled(device, name) ? "on" : "off"}`);
      }
      return;
    }
    if ((m = cmd.match(/^service (dhcp|dns|http|https|ftp|tftp|aaa|radius|syslog|ntp|ssh|telnet|smtp|pop3) (on|off)$/)) && device.kind === "server") {
      apply({ kind: "service", name: m[1], value: m[2] === "on" });
      return push("ok", `${m[1]} ${m[2]}`);
    }
    invalid(cmd);
  }

  function primaryHostIface() {
    return device.interfaces?.eth0 ? ["eth0", device.interfaces.eth0] : (Object.entries(device.interfaces || {}).find(([, i]) => i.ip) || Object.entries(device.interfaces || {})[0] || ["eth0", {}]);
  }

  function hostDnsServer() {
    const [, e] = primaryHostIface();
    if (e.dns) return e.dns;
    const byGateway = Object.values(devices || {}).find((d) => d.kind === "server" && hostServiceEnabled(d, "dns") && Object.values(d.interfaces || {}).some((i) => i.ip === e.gw));
    const dnsServer = byGateway || Object.values(devices || {}).find((d) => d.kind === "server" && hostServiceEnabled(d, "dns") && Object.values(d.interfaces || {}).some((i) => i.ip));
    return Object.values(dnsServer?.interfaces || {}).find((i) => i.ip)?.ip || "";
  }

  function resolveHostTarget(target) {
    const clean = String(target || "").trim().replace(/\.$/, "");
    if (!clean) return "";
    if (isIpv4(clean)) return clean;
    const byDevice = deviceByIpOrName(clean);
    if (byDevice) return Object.values(byDevice.interfaces || {}).find((i) => i.ip)?.ip || "";
    for (const server of Object.values(devices || {})) {
      if (!hostServiceEnabled(server, "dns")) continue;
      for (const record of server.serverConfig?.dns?.records || []) {
        const recordName = String(record.name || "").replace(/\.$/, "").toLowerCase();
        const recordType = String(record.type || "").toLowerCase();
        if (recordName === clean.toLowerCase() && (!recordType || recordType.includes("a record") || recordType === "a")) return record.detail || "";
      }
    }
    return "";
  }

  function deviceByIpOrName(target) {
    const clean = String(target || "").trim().replace(/\.$/, "").toLowerCase();
    if (!clean) return null;
    return Object.values(devices || {}).find((d) => {
      if ([d.hostname, d.name, d.model].some((v) => String(v || "").toLowerCase() === clean)) return true;
      return Object.values(d.interfaces || {}).some((i) => String(i.ip || "").toLowerCase() === clean);
    }) || null;
  }

  function showHostIpConfig(all = false) {
    push("", "Windows IP Configuration");
    for (const [name, e] of Object.entries(device.interfaces || {})) {
      push("", "");
      push("", `Ethernet adapter ${shortIface(name)}:`);
      if (all) {
        push("", `   Connection-specific DNS Suffix  . : ${e.dnsSuffix || ""}`);
        push("", `   Description . . . . . . . . . . . : ${device.model || "Packet Tracer PC"}`);
        push("", `   Physical Address. . . . . . . . . : ${formatWindowsMac(e.mac)}`);
        push("", `   DHCP Enabled. . . . . . . . . . . : ${e.dhcp ? "Yes" : "No"}`);
      }
      push("", `   IPv4 Address. . . . . . . . . . . : ${e.ip || "0.0.0.0"}`);
      push("", `   Subnet Mask . . . . . . . . . . . : ${e.mask || "0.0.0.0"}`);
      push("", `   Default Gateway . . . . . . . . . : ${e.gw || "0.0.0.0"}`);
      if (all) push("", `   DNS Servers . . . . . . . . . . . : ${e.dns || hostDnsServer() || "0.0.0.0"}`);
    }
  }

  function showHostIpv6Config(all = false) {
    push("", "Windows IPv6 Configuration");
    for (const [name, e] of Object.entries(device.interfaces || {})) {
      const macPart = String(e.mac || "00:00:00:00:00:00").split(":").slice(-2).join("").toLowerCase();
      const fallbackLinkLocal = `fe80::${macPart || "1"}`;
      push("", "");
      push("", `Ethernet adapter ${shortIface(name)}:`);
      if (all) push("", `   Physical Address. . . . . . . . . : ${formatWindowsMac(e.mac)}`);
      push("", `   Link-local IPv6 Address . . . . . : ${e.linkLocal || fallbackLinkLocal}`);
      push("", `   IPv6 Address. . . . . . . . . . . : ${e.ipv6 || "unassigned"}`);
      push("", `   Default Gateway . . . . . . . . . : ${e.ipv6Gw || "unassigned"}`);
    }
  }

  function showHostArp() {
    const entries = Object.entries(device.arp || {});
    if (!entries.length) return push("dim", "No ARP entries.");
    const [, e] = primaryHostIface();
    push("", `Interface: ${e.ip || "0.0.0.0"} --- 0x1`);
    push("dim", "  Internet Address      Physical Address      Type");
    entries.forEach(([ip, mac]) => push("", `  ${ip.padEnd(20)}${formatWindowsMac(mac).padEnd(22)}dynamic`));
  }

  function showHostDir() {
    const files = Object.entries(device.files || {});
    push("", " Volume in drive C has no label.");
    push("", " Directory of C:\\");
    push("", "");
    if (!files.length) return push("", "No files.");
    files.forEach(([path, body]) => push("", `${hostDisplayPath(path).padEnd(28)}${String((body || "").length).padStart(10)} bytes`));
  }

  function showHostNetstat(cmd) {
    if (cmd === "netstat -r") {
      const [, e] = primaryHostIface();
      push("", "IPv4 Route Table");
      push("dim", "Network Destination        Netmask          Gateway       Interface");
      if (e.ip && e.mask) push("", `${OPT_Engine.networkAddress(e.ip, e.mask).padEnd(27)}${e.mask.padEnd(17)}On-link       ${e.ip}`);
      push("", `${"0.0.0.0".padEnd(27)}${"0.0.0.0".padEnd(17)}${(e.gw || "0.0.0.0").padEnd(14)}${e.ip || "0.0.0.0"}`);
      return;
    }
    push("", "Active Connections");
    push("dim", "  Proto  Local Address          Foreign Address        State");
    const [, e] = primaryHostIface();
    const ip = e.ip || "0.0.0.0";
    const services = device.kind === "server" ? hostServerServiceNames().filter((name) => hostServiceEnabled(device, name)) : [];
    if (!services.length) return push("", `  TCP    ${ip}:0`.padEnd(31) + "0.0.0.0:0              LISTENING");
    services.forEach((name) => push("", `  TCP    ${`${ip}:${hostServicePort(name)}`.padEnd(23)}0.0.0.0:0              LISTENING`));
  }

  function showHostNslookup(name) {
    const dns = hostDnsServer() || "0.0.0.0";
    const resolved = resolveHostTarget(name);
    push("", `Server:  ${dns === "0.0.0.0" ? "UnKnown" : dns}`);
    push("", `Address: ${dns}`);
    push("", "");
    if (!resolved) return push("err", `*** ${dns} can't find ${name}: Non-existent domain`);
    push("", `Name:    ${name}`);
    push("", `Address: ${resolved}`);
  }

  function runHostSession(protocol, rest) {
    const targetText = sessionTarget(protocol, rest);
    if (!targetText) return push("err", usageForHostCommand(protocol));
    const resolved = resolveHostTarget(targetText) || targetText;
    const target = deviceByIpOrName(resolved);
    const port = hostServicePort(protocol);
    if (!target || !hostServiceEnabled(target, protocol)) {
      push("", `Connecting To ${targetText}...`);
      return push("err", `Could not open connection to the host, on port ${port}: Connect failed`);
    }
    push("ok", `Connected to ${target.hostname || targetText}.`);
    if (protocol === "ftp") push("", "220 OpenPT FTP service ready\nUser (press Enter in this simulator):");
    if (protocol === "telnet") push("", "OpenPT Telnet session established.\nConnection closed by foreign host.");
    if (protocol === "ssh") push("", "OpenPT SSH session established.\nConnection closed.");
  }

  function runHostSnmp(command, rest) {
    const parts = rest.trim().split(/\s+/);
    const targetText = parts.find((p) => isIpv4(p) || deviceByIpOrName(p) || resolveHostTarget(p)) || parts[0];
    if (!targetText) return push("err", usageForHostCommand(command));
    const resolved = resolveHostTarget(targetText) || targetText;
    const target = deviceByIpOrName(resolved);
    if (!target || !hostServiceEnabled(target, "snmp")) return push("err", `Request timed out for ${targetText}.`);
    const oid = parts.find((p) => /^\d+(?:\.\d+)+$/.test(p) || /^iso\./i.test(p)) || "1.3.6.1.2.1.1.1.0";
    if (command === "snmpset") return push("ok", `${oid} = value set`);
    if (command === "snmpgetbulk") return push("", `${oid}.1 = ${target.hostname || targetText}\n${oid}.2 = ${target.model || target.kind}`);
    push("", `${oid} = ${target.hostname || targetText} ${target.model || target.kind}`);
  }

  function runGlobal(cmd) {
    let m;
    if ((m = cmd.match(/^hostname (\S+)$/))) return apply({ kind: "hostname", value: m[1] });
    if ((m = cmd.match(/^enable secret (.+)$/))) return apply({ kind: "enable-secret", value: m[1] });
    if (cmd === "service password-encryption") return apply({ kind: "service", name: "passwordEncryption", value: true });
    if (cmd === "no service password-encryption") return apply({ kind: "service", name: "passwordEncryption", value: false });
    if (/^(no )?ip routing$|^(no )?ip multicast-routing$|^ip route |^no ip route |^router (ospf|eigrp|rip|bgp)\b|^vrf definition |^ip nat |^ip sla\b|^track \d+ /.test(cmd) && !isRouterPlatform()) return unsupported("Layer 3 routing");
    if (/^vlan \d+$|^no vlan \d+$|^ip dhcp snooping\b|^ip arp inspection vlan |^monitor session |^vtp |^spanning-tree vlan /.test(cmd) && !isSwitchPlatform()) return unsupported("switching");
    if (cmd === "ip routing") return apply({ kind: "ip-routing", value: true });
    if (cmd === "no ip routing") return apply({ kind: "ip-routing", value: false });
    if (cmd === "ip multicast-routing") return apply({ kind: "service", name: "multicastRouting", value: true });
    if (cmd === "no ip multicast-routing") return apply({ kind: "service", name: "multicastRouting", value: false });
    if ((m = cmd.match(/^username (\S+) secret (.+)$/))) return apply({ kind: "username", user: m[1], secret: m[2] });
    if ((m = cmd.match(/^(?:interface|int) range (.+)$/))) {
      const ifaces = expandIfaceRange(m[1], device);
      if (!ifaces.length) return push("err", `% Invalid interface range '${m[1]}'`);
      return setMode({ name: "conf-if-range", ifaces });
    }
    if ((m = cmd.match(/^(?:interface|int) (.+)$/))) {
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
      return setMode({ name: "conf-router", proto: "ospf", pid: m[1] });
    }
    if ((m = cmd.match(/^router eigrp (\d+)$/))) { apply({ kind: "routing-create", proto: "eigrp", id: m[1] }); return setMode({ name: "conf-router", proto: "eigrp", pid: m[1] }); }
    if (cmd === "router rip") { apply({ kind: "routing-create", proto: "rip", id: "rip" }); return setMode({ name: "conf-router", proto: "rip", pid: "rip" }); }
    if ((m = cmd.match(/^router bgp (\d+)$/))) { apply({ kind: "routing-create", proto: "bgp", id: m[1] }); return setMode({ name: "conf-router", proto: "bgp", pid: m[1] }); }
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
    if ((m = cmd.match(/^ip prefix-list (\S+) (permit|deny) (.+)$/))) return apply({ kind: "prefix-list-entry", name: m[1], action: m[2], prefix: m[3] });
    if ((m = cmd.match(/^route-map (\S+) (permit|deny)(?: (\d+))?$/))) { apply({ kind: "route-map-create", name: m[1], action: m[2], seq: Number(m[3] || 10) }); return setMode({ name: "conf-route-map", map: m[1], seq: Number(m[3] || 10) }); }
    if ((m = cmd.match(/^vrf definition (\S+)$/))) { apply({ kind: "vrf-create", name: m[1] }); return setMode({ name: "conf-vrf", vrf: m[1] }); }
    if ((m = cmd.match(/^ip nat pool (\S+) (\S+) (\S+) netmask (\S+)$/))) return apply({ kind: "nat-pool", name: m[1], start: m[2], end: m[3], mask: m[4] });
    if ((m = cmd.match(/^ip nat inside source static (\S+) (\S+)$/))) return apply({ kind: "nat-rule", config: cmd, rule: { type: "static", inside: m[1], outside: m[2] } });
    if ((m = cmd.match(/^ip nat inside source list (\S+) interface (.+) overload$/))) return apply({ kind: "nat-rule", config: cmd, rule: { type: "pat-interface", acl: m[1], iface: normalizeIface(m[2], device) || m[2] } });
    if ((m = cmd.match(/^ip nat inside source list (\S+) pool (\S+) overload$/))) return apply({ kind: "nat-rule", config: cmd, rule: { type: "pat-pool", acl: m[1], pool: m[2] } });
    if (cmd === "aaa new-model") return apply({ kind: "aaa", enabled: true });
    if (cmd === "no aaa new-model") return apply({ kind: "aaa", enabled: false });
    if ((m = cmd.match(/^aaa authentication login (\S+) (.+)$/))) return apply({ kind: "aaa-method", service: "login", list: m[1], methods: m[2] });
    if ((m = cmd.match(/^crypto key generate rsa(?: modulus (\d+))?$/))) return apply({ kind: "crypto-rsa", modulus: Number(m[1] || 2048) });
    if ((m = cmd.match(/^ntp server (\S+)$/))) return apply({ kind: "ntp-server", server: m[1] });
    if ((m = cmd.match(/^snmp-server community (\S+)(?: (RO|RW))?$/i))) return apply({ kind: "snmp-community", name: m[1], access: (m[2] || "RO").toUpperCase() });
    if ((m = cmd.match(/^snmp-server host (\S+)(?: version \S+)? (\S+)$/))) return apply({ kind: "snmp-host", host: m[1], community: m[2] });
    if ((m = cmd.match(/^logging host (\S+)$/))) return apply({ kind: "logging-host", host: m[1] });
    if (cmd === "ip dhcp snooping") return apply({ kind: "dhcp-snooping", enabled: true });
    if ((m = cmd.match(/^ip dhcp snooping vlan (.+)$/))) return apply({ kind: "dhcp-snooping-vlan", vlans: parseVlanList(m[1]) });
    if ((m = cmd.match(/^ip arp inspection vlan (.+)$/))) return apply({ kind: "dai-vlan", vlans: parseVlanList(m[1]) });
    if ((m = cmd.match(/^monitor session (\d+) source interface (.+)$/))) return apply({ kind: "span-source", session: m[1], iface: normalizeIface(m[2], device) || m[2] });
    if ((m = cmd.match(/^monitor session (\d+) destination interface (.+)$/))) return apply({ kind: "span-dest", session: m[1], iface: normalizeIface(m[2], device) || m[2] });
    if ((m = cmd.match(/^vtp mode (server|client|transparent|off)$/))) return apply({ kind: "vtp", field: "mode", value: m[1] });
    if ((m = cmd.match(/^vtp domain (\S+)$/))) return apply({ kind: "vtp", field: "domain", value: m[1] });
    if ((m = cmd.match(/^spanning-tree vlan (\d+) root (primary|secondary)$/))) return apply({ kind: "stp-root", vlan: Number(m[1]), role: m[2] });
    if ((m = cmd.match(/^spanning-tree vlan (\d+) priority (\d+)$/))) return apply({ kind: "stp-priority", vlan: Number(m[1]), priority: Number(m[2]) });
    if ((m = cmd.match(/^class-map(?: match-(any|all))? (\S+)$/))) { apply({ kind: "class-map-create", name: m[2], matchType: m[1] ? `match-${m[1]}` : "match-any" }); return setMode({ name: "conf-class-map", classMap: m[2] }); }
    if ((m = cmd.match(/^policy-map (\S+)$/))) { apply({ kind: "policy-map-create", name: m[1] }); return setMode({ name: "conf-policy-map", policyMap: m[1] }); }
    if ((m = cmd.match(/^ip sla (\d+)$/))) { apply({ kind: "ip-sla-create", id: m[1] }); return setMode({ name: "conf-ip-sla", sla: m[1] }); }
    if ((m = cmd.match(/^track (\d+) (.+)$/))) return apply({ kind: "track", id: m[1], object: m[2] });
    if ((m = cmd.match(/^wireless ssid (.+)$/))) return apply({ kind: "wireless", field: "ssid", value: m[1] });
    if ((m = cmd.match(/^wireless security (\S+)(?: (.+))?$/))) { apply({ kind: "wireless", field: "security", value: m[1] }); if (m[2]) apply({ kind: "wireless", field: "passphrase", value: m[2] }); return; }
    invalid(cmd);
  }

  function runInterface(cmd) {
    let m;
    if ((m = cmd.match(/^description (.+)$/))) return applyIface("desc", { value: m[1] });
    if (cmd === "no description") return applyIface("desc", { value: "" });
    if ((m = cmd.match(/^nameif (\S+)$/))) return applyIface("nameif", { value: m[1] });
    if ((m = cmd.match(/^security-level (\d+)$/))) return applyIface("security-level", { value: Number(m[1]) });
    if ((m = cmd.match(/^ip address (\S+) (\S+)$/))) return applyIface("ip-address", { ip: m[1], mask: m[2] });
    if (cmd === "no ip address") return applyIface("ip-address", { ip: null, mask: null });
    if (cmd === "shutdown" || cmd === "shut") return applyIface("admin", { up: false });
    if (cmd === "no shutdown" || cmd === "no shut") return applyIface("admin", { up: true });
    if (/^(no )?switchport\b|^channel-group |^storm-control |^ip dhcp snooping trust$|^no ip dhcp snooping trust$|^ip arp inspection trust$|^no ip arp inspection trust$|^spanning-tree /.test(cmd) && !isSwitchPlatform()) return unsupported("switchport configuration");
    if (/^ip policy route-map |^ip nat |^no ip nat |^encapsulation |^tunnel |^ip pim |^ip igmp |^standby /.test(cmd) && !isRouterPlatform()) return unsupported("routed interface services");
    if (cmd === "no switchport") return applyIface("routed-port", { value: true });
    if (cmd === "switchport") return applyIface("routed-port", { value: false });
    if ((m = cmd.match(/^switchport mode (access|trunk)$/))) return applyIface("swmode", { value: m[1] });
    if ((m = cmd.match(/^switchport access vlan (\d+)$/))) return applyIface("swvlan", { value: Number(m[1]) });
    if ((m = cmd.match(/^switchport voice vlan (\d+)$/))) return applyIface("voice-vlan", { value: Number(m[1]) });
    if ((m = cmd.match(/^switchport trunk native vlan (\d+)$/))) return applyIface("trunk-native", { value: Number(m[1]) });
    if ((m = cmd.match(/^switchport trunk allowed vlan (.+)$/))) return applyIface("trunk-allowed", { value: m[1].trim() });
    if (cmd === "switchport port-security") return applyIface("port-security", { enabled: true });
    if (cmd === "no switchport port-security") return applyIface("port-security", { enabled: false });
    if ((m = cmd.match(/^switchport port-security maximum (\d+)$/))) return applyIface("port-security", { maximum: Number(m[1]) });
    if ((m = cmd.match(/^switchport port-security violation (protect|restrict|shutdown)$/))) return applyIface("port-security", { violation: m[1] });
    if ((m = cmd.match(/^switchport port-security mac-address (sticky|[0-9a-f.:-]+)$/i))) return applyIface("port-security", { sticky: m[1] === "sticky", mac: m[1] === "sticky" ? null : m[1] });
    if ((m = cmd.match(/^channel-group (\d+) mode (active|passive|on|auto|desirable)$/))) return applyIface("channel-group", { id: Number(m[1]), mode: m[2] });
    if ((m = cmd.match(/^storm-control broadcast level (\S+)$/))) return applyIface("storm-control", { level: m[1] });
    if ((m = cmd.match(/^storm-control action (shutdown|trap)$/))) return applyIface("storm-control", { action: m[1] });
    if (cmd === "ip dhcp snooping trust") return applyIface("dhcp-snoop-trust", { value: true });
    if (cmd === "no ip dhcp snooping trust") return applyIface("dhcp-snoop-trust", { value: false });
    if (cmd === "ip arp inspection trust") return applyIface("dai-trust", { value: true });
    if (cmd === "no ip arp inspection trust") return applyIface("dai-trust", { value: false });
    if (cmd === "spanning-tree portfast") return applyIface("stp-portfast", { value: true });
    if (cmd === "no spanning-tree portfast") return applyIface("stp-portfast", { value: false });
    if ((m = cmd.match(/^spanning-tree guard (root|loop|none)$/))) return applyIface("stp-guard", { value: m[1] });
    if ((m = cmd.match(/^spanning-tree bpduguard (enable|disable)$/))) return applyIface("stp-bpduguard", { value: m[1] === "enable" });
    if ((m = cmd.match(/^ip access-group (\S+) (in|out)$/))) return applyIface("iface-acl", { acl: m[1], dir: m[2] });
    if ((m = cmd.match(/^no ip access-group (\S+) (in|out)$/))) return applyIface("iface-acl", { acl: null, dir: m[2] });
    if ((m = cmd.match(/^ip policy route-map (\S+)$/))) return applyIface("policy-route", { name: m[1] });
    if (cmd === "ip nat inside") return applyIface("nat-role", { value: "inside" });
    if (cmd === "ip nat outside") return applyIface("nat-role", { value: "outside" });
    if (cmd === "no ip nat inside" || cmd === "no ip nat outside") return applyIface("nat-role", { value: null });
    if ((m = cmd.match(/^speed (auto|10|100|1000)$/))) return applyIface("speed", { value: m[1] });
    if ((m = cmd.match(/^duplex (auto|full|half)$/))) return applyIface("duplex", { value: m[1] });
    if ((m = cmd.match(/^encapsulation (ppp|hdlc|dot1q \d+)$/))) return applyIface("encapsulation", { value: m[1] });
    if ((m = cmd.match(/^tunnel source (.+)$/))) return applyIface("tunnel-source", { value: normalizeIface(m[1], device) || m[1] });
    if ((m = cmd.match(/^tunnel destination (\S+)$/))) return applyIface("tunnel-destination", { value: m[1] });
    if ((m = cmd.match(/^service-policy (input|output) (\S+)$/))) return applyIface("service-policy", { dir: m[1] === "input" ? "in" : "out", policy: m[2] });
    if ((m = cmd.match(/^ip pim (sparse-mode|dense-mode)$/))) return applyIface("pim", { mode: m[1] });
    if ((m = cmd.match(/^ip igmp join-group (\S+)$/))) return applyIface("igmp-join", { group: m[1] });
    if ((m = cmd.match(/^standby (\d+) ip (\S+)$/))) return applyIface("hsrp", { group: m[1], ip: m[2] });
    if ((m = cmd.match(/^standby (\d+) priority (\d+)$/))) return applyIface("hsrp", { group: m[1], priority: Number(m[2]) });
    invalid(cmd);
  }

  function runVlan(cmd) {
    const m = cmd.match(/^name (.+)$/);
    if (m) return apply({ kind: "vlan-name", id: mode.vlan, name: m[1] });
    invalid(cmd);
  }

  function runRouter(cmd) {
    let m;
    if ((m = cmd.match(/^router-id (\S+)$/))) return apply({ kind: "routing-router-id", proto: mode.proto, id: mode.pid, routerId: m[1] });
    if ((m = cmd.match(/^version (\d+)$/)) && mode.proto === "rip") return apply({ kind: "routing-field", proto: "rip", id: mode.pid, field: "version", value: Number(m[1]) });
    if ((m = cmd.match(/^network (\S+) (\S+) area (\S+)$/)) && mode.proto === "ospf") return apply({ kind: "ospf-network", pid: mode.pid, network: m[1], wildcard: m[2], area: m[3] });
    if ((m = cmd.match(/^neighbor (\S+) remote-as (\d+)$/)) && mode.proto === "bgp") return apply({ kind: "bgp-neighbor", id: mode.pid, ip: m[1], remoteAs: m[2] });
    if ((m = cmd.match(/^network (\S+) mask (\S+)$/)) && mode.proto === "bgp") return apply({ kind: "routing-network", proto: "bgp", id: mode.pid, network: m[1], mask: m[2] });
    if ((m = cmd.match(/^network (\S+)(?: (\S+))?$/))) return apply({ kind: "routing-network", proto: mode.proto, id: mode.pid, network: m[1], wildcard: m[2] });
    if ((m = cmd.match(/^passive-interface (.+)$/))) return apply({ kind: "routing-passive", proto: mode.proto, id: mode.pid, iface: normalizeIface(m[1], device) || m[1], value: true });
    if ((m = cmd.match(/^no passive-interface (.+)$/))) return apply({ kind: "routing-passive", proto: mode.proto, id: mode.pid, iface: normalizeIface(m[1], device) || m[1], value: false });
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

  function runRouteMap(cmd) {
    let m;
    if ((m = cmd.match(/^match (.+)$/))) return apply({ kind: "route-map-line", name: mode.map, seq: mode.seq, field: "match", value: m[1] });
    if ((m = cmd.match(/^set (.+)$/))) return apply({ kind: "route-map-line", name: mode.map, seq: mode.seq, field: "set", value: m[1] });
    invalid(cmd);
  }

  function runVrf(cmd) {
    const m = cmd.match(/^rd (.+)$/);
    if (m) return apply({ kind: "vrf-rd", name: mode.vrf, rd: m[1] });
    if (cmd === "address-family ipv4") return apply({ kind: "vrf-af", name: mode.vrf, af: "ipv4" });
    invalid(cmd);
  }

  function runClassMap(cmd) {
    const m = cmd.match(/^match (.+)$/);
    if (m) return apply({ kind: "class-map-match", name: mode.classMap, match: m[1] });
    invalid(cmd);
  }

  function runPolicyMap(cmd) {
    const m = cmd.match(/^class (\S+)$/);
    if (m) { apply({ kind: "policy-map-class", policy: mode.policyMap, className: m[1] }); return setMode({ name: "conf-policy-class", policyMap: mode.policyMap, className: m[1] }); }
    invalid(cmd);
  }

  function runPolicyClass(cmd) {
    if (/^(set|police|bandwidth|priority|shape|queue-limit)\b/.test(cmd)) return apply({ kind: "policy-map-action", policy: mode.policyMap, className: mode.className, action: cmd });
    invalid(cmd);
  }

  function runIpSla(cmd) {
    let m;
    if ((m = cmd.match(/^icmp-echo (\S+)$/))) return apply({ kind: "ip-sla-field", id: mode.sla, field: "icmpEcho", value: m[1] });
    if ((m = cmd.match(/^frequency (\d+)$/))) return apply({ kind: "ip-sla-field", id: mode.sla, field: "frequency", value: Number(m[1]) });
    invalid(cmd);
  }

  function runShow(cmd) {
    if (cmd === "show" || cmd === "show ?") return showHelp();
    if (cmd === "show running-config" || cmd === "show run") return pushMany(OPT_Engine.serializeConfig(device).split("\n"));
    if (cmd === "show startup-config" || cmd === "show start") return pushMany((device.startupConfig || "startup-config is not present").split("\n"));
    if (cmd === "show version" || cmd === "show ver") return showVersion();
    if (cmd === "show ip interface brief" || cmd === "show ip int br") return showIpBrief();
    if (cmd === "show ip route" || cmd === "sh ip route") return showRoute();
    if (cmd === "show vlan brief" || cmd === "show vlan") return showVlan();
    if (cmd === "show interfaces trunk") return showTrunks();
    if (cmd === "show interfaces" || cmd.startsWith("show interfaces ")) return showInterfaces(cmd);
    if (cmd === "show mac address-table" || cmd === "show mac") return showMac();
    if (cmd === "show spanning-tree" || cmd.startsWith("show spanning-tree")) return showStp();
    if (cmd === "show etherchannel summary") return showEtherchannel();
    if (cmd === "show port-security" || cmd.startsWith("show port-security")) return showPortSecurity();
    if (cmd === "show ip dhcp snooping") return showDhcpSnooping();
    if (cmd === "show ip arp inspection") return showDai();
    if (cmd === "show ip ospf neighbor") return showOspfNeighbors();
    if (cmd === "show ip protocols") return showIpProtocols();
    if (cmd === "show ip eigrp neighbors") return showRoutingNeighbors("eigrp");
    if (cmd === "show ip bgp summary") return showRoutingNeighbors("bgp");
    if (cmd === "show ip rip database") return showRoutingNeighbors("rip");
    if (cmd === "show access-lists" || cmd === "show ip access-lists") return showAcls();
    if (cmd === "show ip dhcp binding") return showDhcpBinding();
    if (cmd === "show ip dhcp pool") return showDhcpPool();
    if (cmd === "show ip nat translations") return showNat();
    if (cmd === "show ip nat statistics") return showNatStats();
    if (cmd === "show arp" || cmd === "show ip arp") return showArp();
    if (cmd === "show cdp neighbors" || cmd === "show lldp neighbors") return showNeighbors();
    if (cmd === "show logging") return showLogging();
    if (cmd === "show vrf") return showVrf();
    if (cmd === "show route-map") return showRouteMaps();
    if (cmd === "show ip prefix-list") return showPrefixLists();
    if (cmd === "show policy-map" || cmd === "show policy-map interface") return showPolicyMap();
    if (cmd === "show class-map") return showClassMap();
    if (cmd === "show ip sla summary") return showIpSla();
    if (cmd === "show track") return showTrack();
    if (cmd === "show snmp community") return showSnmp();
    if (cmd === "show ntp associations") return showNtp();
    if (cmd === "show standby" || cmd === "show standby brief") return showStandby();
    if (cmd === "show ip pim neighbor") return showPim();
    if (cmd === "show ip mroute") return showMroute();
    if (cmd === "show wireless") return showWireless();
    if (cmd === "show platform" || cmd === "show inventory" || cmd === "show license" || cmd === "show processes") return showPlatform(cmd);
    if (cmd === "dir" || cmd === "dir flash:" || cmd === "show flash:") return showDir();
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
  function showEtherchannel() {
    const groups = device.etherchannels || {};
    push("dim", "Group  Port-channel  Protocol    Ports");
    Object.entries(groups).forEach(([id, g]) => push("", `${String(id).padEnd(7)}Po${id.padEnd(12)}${(g.protocol || "LACP").padEnd(12)}${(g.members || []).map(shortIface).join(" ")}`));
    if (!Object.keys(groups).length) push("dim", "No EtherChannels configured.");
  }
  function showPortSecurity() {
    const rows = Object.entries(device.interfaces || {}).filter(([, i]) => i.portSecurity?.enabled);
    push("dim", "Secure Port  MaxSecureAddr  CurrentAddr  SecurityViolation  Action");
    rows.forEach(([n, i]) => push("", `${shortIface(n).padEnd(13)}${String(i.portSecurity.maximum || 1).padEnd(15)}${String((i.portSecurity.macs || []).length).padEnd(13)}0                  ${i.portSecurity.violation || "shutdown"}`));
    if (!rows.length) push("dim", "Port security is not enabled on any interface.");
  }
  function showDhcpSnooping() {
    const s = device.dhcpSnooping || {};
    push("", `Switch DHCP snooping is ${s.enabled ? "enabled" : "disabled"}`);
    push("", `DHCP snooping is configured on VLANs: ${(s.vlans || []).join(",") || "none"}`);
    Object.entries(device.interfaces || {}).filter(([, i]) => i.dhcpSnoopingTrust).forEach(([n]) => push("", `Trusted interface: ${shortIface(n)}`));
  }
  function showDai() {
    const d = device.dai || {};
    push("", `Dynamic ARP inspection VLANs: ${(d.vlans || []).join(",") || "none"}`);
    Object.entries(device.interfaces || {}).filter(([, i]) => i.daiTrust).forEach(([n]) => push("", `Trusted interface: ${shortIface(n)}`));
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
    Object.entries(device.eigrp || {}).forEach(([asn, e]) => {
      push("", `Routing Protocol is "eigrp ${asn}"`);
      (e.networks || []).forEach((n) => push("", `  Routing for Networks: ${n.network} ${n.wildcard || ""}`));
    });
    Object.entries(device.rip || {}).forEach(([, r]) => {
      push("", `Routing Protocol is "rip"`);
      (r.networks || []).forEach((n) => push("", `  Routing for Networks: ${n.network}`));
    });
    Object.entries(device.bgp || {}).forEach(([asn, b]) => {
      push("", `Routing Protocol is "bgp ${asn}"`);
      (b.networks || []).forEach((n) => push("", `  Network: ${n.network}${n.mask ? ` mask ${n.mask}` : ""}`));
    });
    if (!Object.keys(device.ospf || {}).length && !Object.keys(device.eigrp || {}).length && !Object.keys(device.rip || {}).length && !Object.keys(device.bgp || {}).length) push("dim", "No active IP routing protocols.");
  }
  function showRoutingNeighbors(proto) {
    if (proto === "bgp") {
      const neighbors = Object.values(device.bgp || {}).flatMap((b) => b.neighbors || []);
      if (!neighbors.length) return push("dim", "No BGP neighbors.");
      return neighbors.forEach((n) => push("", `${n.ip.padEnd(16)}remote-as ${String(n.remoteAs).padEnd(8)} idle`));
    }
    const active = Object.values(devices).filter((d) => d.id !== device.id && Object.keys(d[proto] || {}).length);
    if (!active.length) return push("dim", `No ${proto.toUpperCase()} neighbors.`);
    active.forEach((d) => push("", `${d.hostname.padEnd(16)}${Object.values(d.interfaces || {}).find((i) => i.ip)?.ip || "0.0.0.0"}    up`));
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
  function showVrf() {
    const rows = Object.entries(device.vrfs || {});
    if (!rows.length) return push("dim", "No VRFs configured.");
    rows.forEach(([n, v]) => push("", `${n.padEnd(18)}${v.rd || "(no rd)"}`));
  }
  function showRouteMaps() {
    Object.entries(device.routeMaps || {}).forEach(([name, rm]) => (rm.sequences || []).forEach((s) => push("", `route-map ${name}, ${s.action}, sequence ${s.seq} match ${s.match || "-"} set ${s.set || "-"}`)));
    if (!Object.keys(device.routeMaps || {}).length) push("dim", "No route-maps configured.");
  }
  function showPrefixLists() {
    Object.entries(device.prefixLists || {}).forEach(([name, p]) => (p.entries || []).forEach((e, i) => push("", `ip prefix-list ${name}: ${i + 5} ${e.action} ${e.prefix}`)));
    if (!Object.keys(device.prefixLists || {}).length) push("dim", "No prefix-lists configured.");
  }
  function showPolicyMap() {
    Object.entries(device.qos?.policyMaps || {}).forEach(([name, p]) => {
      push("", `Policy Map ${name}`);
      (p.classes || []).forEach((c) => push("", `  Class ${c.name}: ${(c.actions || []).join(", ") || "no actions"}`));
    });
    if (!Object.keys(device.qos?.policyMaps || {}).length) push("dim", "No policy-maps configured.");
  }
  function showClassMap() {
    Object.entries(device.qos?.classMaps || {}).forEach(([name, c]) => push("", `Class Map ${name} (${c.matchType || "match-any"}): ${(c.matches || []).join(", ") || "no matches"}`));
    if (!Object.keys(device.qos?.classMaps || {}).length) push("dim", "No class-maps configured.");
  }
  function showIpSla() {
    Object.entries(device.ipSla || {}).forEach(([id, s]) => push("", `${id.padEnd(5)}icmp-echo ${s.icmpEcho || "-"} frequency ${s.frequency || 60} latest: ${(s.lastOk === false) ? "fail" : "ok"}`));
    if (!Object.keys(device.ipSla || {}).length) push("dim", "No IP SLA operations configured.");
  }
  function showTrack() {
    Object.entries(device.tracks || {}).forEach(([id, t]) => push("", `Track ${id}: ${t.object || "-"} ${t.state || "up"}`));
    if (!Object.keys(device.tracks || {}).length) push("dim", "No tracked objects configured.");
  }
  function showSnmp() {
    (device.snmp?.communities || []).forEach((c) => push("", `${c.name.padEnd(16)}${c.access}`));
    if (!(device.snmp?.communities || []).length) push("dim", "No SNMP communities configured.");
  }
  function showNtp() {
    (device.ntp?.servers || []).forEach((s) => push("", `* ${s.padEnd(16)} synchronized`));
    if (!(device.ntp?.servers || []).length) push("dim", "No NTP associations.");
  }
  function showStandby() {
    const rows = Object.entries(device.interfaces || {}).flatMap(([n, i]) => Object.entries(i.hsrp || {}).map(([g, h]) => ({ iface: n, group: g, ...h })));
    if (!rows.length) return push("dim", "No HSRP groups configured.");
    rows.forEach((r) => push("", `${shortIface(r.iface).padEnd(10)} Grp ${r.group} Active virtual IP ${r.ip || "-"} priority ${r.priority || 100}`));
  }
  function showPim() {
    const rows = Object.entries(device.interfaces || {}).filter(([, i]) => i.pim);
    if (!rows.length) return push("dim", "No PIM interfaces.");
    rows.forEach(([n, i]) => push("", `${shortIface(n).padEnd(12)} ${i.pim}`));
  }
  function showMroute() {
    if (!device.services?.multicastRouting) return push("dim", "IP multicast routing is disabled.");
    push("", "(*, 224.0.0.0/4), uptime 00:01:00, flags: simulated");
  }
  function showWireless() {
    if (!device.wireless) return push("err", "% Wireless radio is not available on this device");
    push("", `SSID: ${device.wireless.ssid || "-"}`);
    push("", `Security: ${device.wireless.security || "open"}`);
    push("", `Radio: ${device.interfaces?.wlan0?.admUp === false ? "down" : "up"}`);
  }
  function showPlatform(cmd) {
    if (cmd === "show inventory") return push("", `NAME: "${device.hostname}", DESCR: "${device.model}"\nPID: ${device.platform || device.kind}, SN: OPENPT${device.id.slice(-6).toUpperCase()}`);
    if (cmd === "show license") return push("", "License Usage: network-advantage (simulated), Status: IN USE");
    if (cmd === "show processes") return push("", "CPU utilization for five seconds: 2%/0%; one minute: 3%; five minutes: 3%");
    push("", `Chassis type: ${device.model || device.kind}\nSoftware: ${device.osVersion || "OpenPT IOS XE"}\nInterfaces: ${Object.keys(device.interfaces || {}).length}`);
  }
  function showDir() {
    push("dim", "Directory of flash:/");
    Object.entries(device.files || {}).forEach(([name, body]) => push("", `  ${String((body || "").length).padStart(8)}  ${name.replace(/^flash:/, "")}`));
  }
  function showFile(path) {
    const key = path.startsWith("flash:") ? path : `flash:${path.replace(/^flash:\//, "")}`;
    pushMany(String(device.files?.[key] || "%Error opening file").split("\n"));
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
      const next = { ...history, [key]: [...(history[key] || []), v].slice(-100) };
      setHistory(next);
      onHistoryChange && onHistoryChange(next);
    }
    handle(v);
    setInput("");
    setHistIdx(-1);
  }

  const ghostCompletion = (() => {
    if (!ghostSuggestions || !input.trim()) return "";
    const completed = completeCommand(input, mode, device);
    return completed && completed !== input && completed.toLowerCase().startsWith(input.toLowerCase()) ? completed.slice(input.length) : "";
  })();

  function onKeyDown(e) {
    const modeHist = history[mode.name] || [];
    if (e.key === "Enter") {
      submit(e);
    } else if (e.key === "ArrowUp") {
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
      <div className="cli-stack" ref={ref} onScroll={reportScroll}>
        {lines.map((l, i) => <div key={i} className={`cli-line ${l.cls}`}>{l.text}</div>)}
        <form className="cli-prompt-row" onSubmit={submit}>
          <span className="cli-prompt">{promptFor()}</span>
          <span className="cli-input-wrap">
            <input className="cli-input" ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKeyDown} autoFocus spellCheck={false} autoComplete="off" />
            {ghostCompletion && <span className="cli-ghost" style={{ marginLeft: `${input.length}ch` }}>{ghostCompletion}</span>}
          </span>
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

function expandIosAbbreviations(input, mode, device) {
  const cmd = String(input || "").trim().replace(/\s+/g, " ");
  if (!cmd || cmd === "?" || cmd.endsWith(" ?")) return cmd;
  const modeName = commandHintKey(mode, device) === "host" ? "host" : (mode?.name === "conf-if-range" ? "conf-if-range" : mode?.name);
  const expanded = matchIosSpec(cmd, modeName);
  if (expanded) {
    if (expanded.startsWith("do ")) {
      const inner = expanded.slice(3);
      return `do ${matchIosSpec(inner, "priv") || inner}`;
    }
    return expanded;
  }
  if (isConfigSubmode(modeName)) {
    const parentExpanded = matchIosSpec(cmd, "conf");
    if (parentExpanded && isParentConfigCommand(parentExpanded)) return parentExpanded;
  }
  return cmd;
}

function matchIosSpec(cmd, modeName) {
  const inputTokens = cmd.split(/\s+/);
  const candidates = IOS_ABBREVIATION_SPECS.filter((s) => s.modes.includes("all") || s.modes.includes(modeName));
  for (const spec of candidates) {
    const out = [];
    let i = 0;
    let ok = true;
    for (let j = 0; j < spec.tokens.length; j++) {
      const token = spec.tokens[j];
      if (token === "<rest>" || token === "<rest?>") {
        const rest = inputTokens.slice(i);
        if (token === "<rest>" && !rest.length) ok = false;
        if (rest.length) out.push(...rest);
        i = inputTokens.length;
        break;
      }
      if (token === "<word>" || token === "<word?>") {
        if (inputTokens[i]) {
          out.push(inputTokens[i]);
          i++;
        } else if (token === "<word>") {
          ok = false;
        }
        continue;
      }
      const typed = inputTokens[i];
      if (!typed || !token.toLowerCase().startsWith(typed.toLowerCase())) {
        ok = false;
        break;
      }
      out.push(token);
      i++;
    }
    if (ok && i === inputTokens.length) return out.join(" ");
  }
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
  return OPT_Engine.shortIfaceName ? OPT_Engine.shortIfaceName(n) : n.replace("GigabitEthernet", "Gi").replace("FastEthernet", "Fa").replace("Serial", "Se");
}

function shortIfaceText(text) {
  return OPT_Engine.shortIfaceNamesInText ? OPT_Engine.shortIfaceNamesInText(text) : text;
}

function isHostConsoleDevice(device) {
  return !!(OPT_Engine.isHostLike?.(device) || device?.kind === "server");
}

function commandHintKey(mode, device) {
  if (mode?.name === "user" && isHostConsoleDevice(device)) return "host";
  return mode?.name === "conf-if-range" ? "conf-if" : mode?.name;
}

function isIpv4(value) {
  return /^(?:\d{1,3}\.){3}\d{1,3}$/.test(String(value || ""));
}

function formatWindowsMac(mac) {
  return String(mac || "00:00:00:00:00:00").replace(/:/g, "-").toUpperCase();
}

function hostFileKey(path) {
  return String(path || "")
    .replace(/^C:\\?/i, "")
    .replace(/^\\+/, "")
    .replace(/\//g, "\\");
}

function hostDisplayPath(path) {
  return String(path || "").replace(/^flash:/, "").replace(/^C:\\?/i, "").replace(/\//g, "\\");
}

function hostServerServiceNames() {
  return ["dhcp", "dns", "http", "https", "ftp", "tftp", "aaa", "radius", "syslog", "ntp", "ssh", "telnet", "smtp", "pop3"];
}

function hostServicePort(name) {
  return ({ ftp: 21, ssh: 22, telnet: 23, smtp: 25, dns: 53, dhcp: 67, tftp: 69, http: 80, pop3: 110, ntp: 123, snmp: 161, radius: 1645, https: 443, syslog: 514, aaa: 1645 })[name] || 0;
}

function hostServiceEnabled(device, name) {
  if (!device) return false;
  const hasService = Object.prototype.hasOwnProperty.call(device.services || {}, name);
  if (hasService) return !!device.services[name];
  if (name === "ftp") return device.serverConfig?.ftp?.service ?? device.kind === "server";
  if (name === "https") return device.serverConfig?.http?.https ?? false;
  if (name === "smtp") return device.serverConfig?.email?.smtp ?? false;
  if (name === "pop3") return device.serverConfig?.email?.pop3 ?? false;
  if (name === "dns") return device.serverConfig?.dns?.service ?? false;
  if (name === "dhcp") return device.serverConfig?.dhcp?.service ?? false;
  if (name === "tftp") return device.serverConfig?.tftp?.service ?? false;
  if (name === "ntp") return device.serverConfig?.ntp?.service ?? false;
  if (name === "aaa" || name === "radius") return device.serverConfig?.aaa?.service ?? false;
  if (name === "syslog") return device.serverConfig?.syslog?.service ?? false;
  if (name === "snmp") return !!(device.snmp?.communities?.length || device.services?.snmp);
  if (name === "ssh") return !!(device.services?.ssh || device.crypto?.rsaKeys?.generated || device.lines?.vty?.transport?.includes?.("ssh"));
  if (name === "telnet") return !!(device.services?.telnet || device.lines?.vty?.transport?.includes?.("telnet"));
  if (name === "http") return device.serverConfig?.http?.http ?? device.services?.http ?? false;
  return !!device.services?.[name];
}

function sessionTarget(protocol, rest) {
  const parts = String(rest || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  if (protocol === "ssh") {
    const at = parts.find((p) => p.includes("@"));
    if (at) return at.split("@").pop();
    const loginIdx = parts.findIndex((p) => p === "-l" || p === "-login");
    if (loginIdx >= 0 && parts[loginIdx + 2]) return parts[loginIdx + 2];
  }
  return parts[0];
}

function usageForHostCommand(cmd) {
  const name = String(cmd || "").split(/\s+/)[0];
  return ({
    ftp: "Usage: ftp <host>",
    telnet: "Usage: telnet <host>",
    ssh: "Usage: ssh [-l user] <host> or ssh user@host",
    nslookup: "Usage: nslookup <name>",
    snmpget: "Usage: snmpget <host> <community> <oid>",
    snmpgetbulk: "Usage: snmpgetbulk <host> <community> <oid>",
    snmpset: "Usage: snmpset <host> <community> <oid> <type> <value>",
  })[name] || `Usage: ${name} <host>`;
}

function parseVlanList(text) {
  const out = [];
  for (const part of String(text).split(",")) {
    const [a, b] = part.trim().split("-").map(Number);
    if (!Number.isFinite(a)) continue;
    if (Number.isFinite(b)) for (let n = a; n <= b; n++) out.push(n);
    else out.push(a);
  }
  return [...new Set(out)];
}

function completeCommand(input, mode, device) {
  const pool = [...(COMMAND_HINTS[commandHintKey(mode, device)] || []), ...Object.keys(device.interfaces || {}).map(shortIface)];
  const words = input.split(/\s+/);
  const last = words[words.length - 1]?.toLowerCase();
  if (!last) return input;
  const hit = pool.find((p) => p.toLowerCase().startsWith(last));
  if (!hit) return input;
  words[words.length - 1] = hit;
  return words.join(" ") + " ";
}

window.CLI = CLI;
