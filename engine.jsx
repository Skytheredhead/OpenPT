// engine.jsx - OpenPT IOS XE-flavored simulation engine
// Owns platform profiles, config helpers, route generation, and packet planning.

const uid = (p = "id") => `${p}_${Math.random().toString(36).slice(2, 8)}`;

const PLATFORM_PROFILES = {
  "2960-24tt": {
    id: "2960-24tt",
    label: "2960-24TT",
    os: "Cisco IOS 15.0(2)SE",
    image: "c2960-lanbasek9-mz.150-2.SE",
    ifaces: [
      ...Array.from({ length: 24 }, (_, i) => `FastEthernet0/${i + 1}`),
      "GigabitEthernet0/1", "GigabitEthernet0/2",
    ],
  },
  "3560-24ps": {
    id: "3560-24ps",
    label: "3560-24PS",
    os: "Cisco IOS 15.0(2)SE",
    image: "c3560-ipservicesk9-mz.150-2.SE",
    ifaces: [
      ...Array.from({ length: 24 }, (_, i) => `FastEthernet0/${i + 1}`),
      "GigabitEthernet0/1", "GigabitEthernet0/2",
    ],
  },
  "2911": {
    id: "2911",
    label: "2911",
    os: "Cisco IOS 15.2(4)M",
    image: "c2900-universalk9-mz.SPA.152-4.M",
    ifaces: ["GigabitEthernet0/0", "GigabitEthernet0/1", "GigabitEthernet0/2", "Serial0/0/0", "Serial0/0/1", "Serial0/1/0", "Serial0/1/1"],
  },
  "1941": {
    id: "1941",
    label: "1941",
    os: "Cisco IOS 15.2(4)M",
    image: "c1900-universalk9-mz.SPA.152-4.M",
    ifaces: ["GigabitEthernet0/0", "GigabitEthernet0/1", "Serial0/0/0", "Serial0/0/1"],
  },
  isr4321: {
    id: "isr4321",
    label: "ISR4321",
    os: "Cisco IOS XE Dublin 17.12.x",
    image: "isr4300-universalk9.17.12",
    ifaces: ["GigabitEthernet0/0/0", "GigabitEthernet0/0/1", "Serial0/1/0", "Serial0/1/1"],
  },
  isr4331: {
    id: "isr4331",
    label: "ISR4331",
    os: "Cisco IOS XE Dublin 17.12.x",
    image: "isr4300-universalk9.17.12",
    ifaces: ["GigabitEthernet0/0/0", "GigabitEthernet0/0/1", "GigabitEthernet0/0/2", "Serial0/1/0", "Serial0/1/1"],
  },
  c9200l: {
    id: "c9200l",
    label: "Catalyst 9200L",
    os: "Cisco IOS XE 26.x",
    image: "cat9k_iosxe.26",
    ifaces: [
      ...Array.from({ length: 24 }, (_, i) => `GigabitEthernet1/0/${i + 1}`),
      ...Array.from({ length: 4 }, (_, i) => `GigabitEthernet1/1/${i + 1}`),
    ],
  },
  genericPc: { id: "genericPc", label: "PC", os: "OpenPT host shell", image: "host", ifaces: ["eth0"] },
  laptop: { id: "laptop", label: "Laptop", os: "OpenPT host shell", image: "laptop", ifaces: ["eth0", "wlan0"] },
  printer: { id: "printer", label: "Printer", os: "OpenPT host shell", image: "printer", ifaces: ["eth0"] },
  ipphone: { id: "ipphone", label: "IP Phone", os: "OpenPT voice endpoint shell", image: "ip-phone", ifaces: ["eth0", "pc"] },
  ap: { id: "ap", label: "Wireless AP", os: "OpenPT AP firmware", image: "ap", ifaces: ["eth0", "wlan0"] },
  genericServer: { id: "genericServer", label: "Server-PT", os: "OpenPT Server-PT shell", image: "server", ifaces: ["eth0"] },
  wrt300n: { id: "wrt300n", label: "WRT300N", os: "OpenPT home router firmware", image: "wrt300n", ifaces: ["Internet", "Ethernet1", "Ethernet2", "Ethernet3", "Ethernet4", "wlan0"] },
  asa5506x: { id: "asa5506x", label: "ASA 5506-X", os: "ASA 9.x simulated", image: "asa5506x", ifaces: ["GigabitEthernet1/1", "GigabitEthernet1/2", "GigabitEthernet1/3", "GigabitEthernet1/4", "GigabitEthernet1/5", "GigabitEthernet1/6", "GigabitEthernet1/7", "GigabitEthernet1/8"] },
  cloudpt: { id: "cloudpt", label: "Cloud-PT", os: "OpenPT provider cloud", image: "cloud", ifaces: ["eth0", "serial0", "dsl", "coax"] },
  internet: { id: "internet", label: "Internet", os: "OpenPT internet cloud", image: "internet", ifaces: ["wan"] },
  dslmodem: { id: "dslmodem", label: "DSL Modem", os: "OpenPT DSL modem", image: "dsl-modem", ifaces: ["Ethernet0", "DSL0"] },
  cablemodem: { id: "cablemodem", label: "Cable Modem", os: "OpenPT cable modem", image: "cable-modem", ifaces: ["Ethernet0", "Coax0"] },
};

function platformForKind(kind, platform) {
  if (platform && PLATFORM_PROFILES[platform]) return PLATFORM_PROFILES[platform];
  if (kind === "router") return PLATFORM_PROFILES.isr4321;
  if (kind === "l2switch") return PLATFORM_PROFILES["2960-24tt"];
  if (kind === "l3switch") return PLATFORM_PROFILES["3560-24ps"];
  if (kind === "wrt") return PLATFORM_PROFILES.wrt300n;
  if (kind === "asa") return PLATFORM_PROFILES.asa5506x;
  if (kind === "laptop") return PLATFORM_PROFILES.laptop;
  if (kind === "printer") return PLATFORM_PROFILES.printer;
  if (kind === "phone") return PLATFORM_PROFILES.ipphone;
  if (kind === "ap") return PLATFORM_PROFILES.ap;
  if (kind === "cloud") return PLATFORM_PROFILES.cloudpt;
  if (kind === "internet") return PLATFORM_PROFILES.internet;
  if (kind === "dslmodem") return PLATFORM_PROFILES.dslmodem;
  if (kind === "cablemodem") return PLATFORM_PROFILES.cablemodem;
  if (kind === "server") return PLATFORM_PROFILES.genericServer;
  return PLATFORM_PROFILES.genericPc;
}

function defaultStateFor(kind) {
  const isSwitch = kind === "l2switch" || kind === "l3switch" || kind === "wrt";
  const isFirewall = kind === "asa";
  const isServer = kind === "server";
  return {
    startupConfig: "",
    users: {},
    secrets: {},
    lines: {
      console: { password: "", login: false, loggingSync: false },
      vty: { password: "", login: false, transport: ["ssh", "telnet"] },
    },
    services: { passwordEncryption: false, cdp: true, lldp: false, ssh: false, http: isServer, dns: isServer, tftp: isServer, aaa: isServer, radius: isServer, syslog: isServer, ntp: isServer },
    dhcp: { excluded: [], pools: {}, bindings: [] },
    ospf: {},
    rip: {},
    eigrp: {},
    bgp: {},
    acls: {},
    nat: { rules: [], pools: {}, translations: [] },
    wireless: kind === "wrt" ? { ssid: "OpenPT", security: "wpa2-psk", passphrase: "openpt123" } : undefined,
    firewall: isFirewall ? { securityLevels: {}, accessRules: [], defaultRoute: null } : undefined,
    routeMaps: {},
    prefixLists: {},
    vrfs: {},
    aaa: { enabled: false, methods: [] },
    crypto: { rsaKeys: null, ikev1: {}, ipsec: {} },
    snmp: { communities: [], hosts: [] },
    ntp: { servers: [] },
    netflow: { exporters: {}, monitors: {} },
    ipSla: {},
    tracks: {},
    qos: { classMaps: {}, policyMaps: {}, servicePolicies: {} },
    etherchannels: {},
    span: [],
    vtp: { mode: "transparent", domain: "" },
    dhcpSnooping: isSwitch ? { enabled: false, vlans: [], trusted: [] } : undefined,
    dai: isSwitch ? { vlans: [], trusted: [] } : undefined,
    logging: [],
    loggingHosts: [],
    files: { "flash:packages.conf": "IOS XE package manifest" },
    stp: isSwitch ? { mode: "rapid-pvst", vlanPriority: { 1: 32768 } } : undefined,
    ipRouting: kind === "router" || kind === "wrt" || kind === "asa",
  };
}

function macFrom(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) >>> 0;
  const bytes = [0x02, (h >>> 24) & 255, (h >>> 16) & 255, (h >>> 8) & 255, h & 255, (h * 31) & 255];
  return bytes.map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(":");
}

function makeInterfaces(kind, names, seeded = {}) {
  const out = {};
  const isSwitch = kind === "l2switch" || kind === "l3switch" || kind === "wrt";
  for (const n of names) {
    out[n] = {
      ip: null, mask: null, gw: null,
      up: false, admUp: false,
      mac: macFrom(`${kind}:${n}`),
      desc: "",
      ...seeded[n],
    };
    if (isSwitch && !n.toLowerCase().startsWith("vlan")) {
      out[n].mode = "access";
      out[n].vlan = 1;
      out[n].nativeVlan = 1;
      out[n].allowedVlans = "all";
      out[n].stp = { portfast: false, bpduguard: false, state: "forwarding" };
    }
    if (kind === "wrt" && n === "Internet") {
      delete out[n].mode;
      out[n].natRole = "outside";
    }
    if (kind === "asa") {
      out[n].securityLevel = n.endsWith("/1") ? 0 : n.endsWith("/2") ? 100 : 50;
      out[n].nameif = n.endsWith("/1") ? "outside" : n.endsWith("/2") ? "inside" : "";
      out[n].natRole = n.endsWith("/1") ? "outside" : n.endsWith("/2") ? "inside" : null;
    }
  }
  return out;
}

function makeDevice(kind, name, x, y, seededIfaces = {}, extra = {}) {
  const profile = platformForKind(kind, extra.platform);
  const d = {
    id: uid("d"),
    kind, name, x, y,
    powered: true,
    hostname: name,
    platform: profile.id,
    model: profile.label,
    osVersion: profile.os,
    image: profile.image,
    interfaces: makeInterfaces(kind, profile.ifaces, seededIfaces),
    routes: [],
    arp: {},
    mac: {},
    vlans: (kind === "l2switch" || kind === "l3switch" || kind === "wrt") ? { 1: "default" } : undefined,
    ...defaultStateFor(kind),
    ...extra,
  };
  return recalcConnectedRoutes(d);
}

function makeStarter() {
  const R1 = makeDevice("router", "R1", 280, 180, {
    "GigabitEthernet0/0/0": { ip: "192.168.10.1", mask: "255.255.255.0", up: true, admUp: true, desc: "to SW1" },
    "GigabitEthernet0/0/1": { ip: "10.0.0.1", mask: "255.255.255.252", up: true, admUp: true, desc: "to R2" },
  });
  R1.routes.push({ dst: "192.168.20.0", mask: "255.255.255.0", via: "10.0.0.2", iface: "GigabitEthernet0/0/1", type: "S" });

  const R2 = makeDevice("router", "R2", 920, 200, {
    "GigabitEthernet0/0/0": { ip: "192.168.20.1", mask: "255.255.255.0", up: true, admUp: true, desc: "to SW2" },
    "GigabitEthernet0/0/1": { ip: "10.0.0.2", mask: "255.255.255.252", up: true, admUp: true, desc: "to R1" },
  });
  R2.routes.push({ dst: "192.168.10.0", mask: "255.255.255.0", via: "10.0.0.1", iface: "GigabitEthernet0/0/1", type: "S" });

  const SW1 = makeDevice("l2switch", "SW1", 320, 420, {
    "FastEthernet0/1": { up: true, admUp: true, vlan: 10, mode: "access", desc: "to R1" },
    "FastEthernet0/2": { up: true, admUp: true, vlan: 10, mode: "access", desc: "to PC1" },
    "FastEthernet0/3": { up: true, admUp: true, vlan: 10, mode: "access", desc: "to PC2" },
  }, { vlans: { 1: "default", 10: "USERS", 20: "VOICE" } });

  const SW2 = makeDevice("l2switch", "SW2", 920, 420, {
    "FastEthernet0/1": { up: true, admUp: true, vlan: 20, mode: "access", desc: "to R2" },
    "FastEthernet0/2": { up: true, admUp: true, vlan: 20, mode: "access", desc: "to PC3" },
    "FastEthernet0/3": { up: true, admUp: true, vlan: 20, mode: "access", desc: "to SRV" },
  }, { vlans: { 1: "default", 20: "USERS", 30: "DMZ" } });

  const PC1 = makeDevice("pc", "PC1", 170, 560, { eth0: { ip: "192.168.10.10", mask: "255.255.255.0", gw: "192.168.10.1", up: true, admUp: true } });
  const PC2 = makeDevice("pc", "PC2", 320, 600, { eth0: { ip: "192.168.10.11", mask: "255.255.255.0", gw: "192.168.10.1", up: true, admUp: true } });
  const PC3 = makeDevice("pc", "PC3", 920, 600, { eth0: { ip: "192.168.20.10", mask: "255.255.255.0", gw: "192.168.20.1", up: true, admUp: true } });
  const SRV = makeDevice("server", "SRV1", 1070, 560, { eth0: { ip: "192.168.20.20", mask: "255.255.255.0", gw: "192.168.20.1", up: true, admUp: true } });

  let devices = { [R1.id]: R1, [R2.id]: R2, [SW1.id]: SW1, [SW2.id]: SW2, [PC1.id]: PC1, [PC2.id]: PC2, [PC3.id]: PC3, [SRV.id]: SRV };
  const lnk = (a, ai, b, bi, type = "copper") => ({ id: uid("l"), a, ai, b, bi, type, up: true });
  const links = [
    lnk(R1.id, "GigabitEthernet0/0/0", SW1.id, "FastEthernet0/1"),
    lnk(R1.id, "GigabitEthernet0/0/1", R2.id, "GigabitEthernet0/0/1", "serial"),
    lnk(R2.id, "GigabitEthernet0/0/0", SW2.id, "FastEthernet0/1"),
    lnk(SW1.id, "FastEthernet0/2", PC1.id, "eth0"),
    lnk(SW1.id, "FastEthernet0/3", PC2.id, "eth0"),
    lnk(SW2.id, "FastEthernet0/2", PC3.id, "eth0"),
    lnk(SW2.id, "FastEthernet0/3", SRV.id, "eth0"),
  ];
  devices = recomputeDynamicRoutes(devices, links);
  return { devices, links };
}

function ipToInt(ip) {
  if (!ip) return 0;
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return 0;
  return ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0;
}
function intToIp(n) {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}
function maskBits(mask) {
  let n = ipToInt(mask), c = 0;
  while (n) { c += n & 1; n >>>= 1; }
  return c;
}
function wildcardToMask(wc) {
  return intToIp((~ipToInt(wc)) >>> 0);
}
function networkAddress(ip, mask) {
  return intToIp(ipToInt(ip) & ipToInt(mask));
}
function sameSubnet(a, b, mask) {
  return (ipToInt(a) & ipToInt(mask)) === (ipToInt(b) & ipToInt(mask));
}
function inNet(ip, dst, mask) {
  return (ipToInt(ip) & ipToInt(mask)) === (ipToInt(dst) & ipToInt(mask));
}
function isSwitchLike(d) { return d?.kind === "l2switch" || d?.kind === "l3switch" || d?.kind === "wrt"; }
function isRouterLike(d) { return d?.kind === "router" || d?.kind === "l3switch" || d?.kind === "wrt" || d?.kind === "asa"; }
function isHostLike(d) { return ["pc", "server", "laptop", "printer", "phone"].includes(d?.kind); }
function clone(obj) { return JSON.parse(JSON.stringify(obj)); }
function shortIfaceName(n) {
  return String(n || "")
    .replace(/^HundredGigabitEthernet\s*/i, "Hu")
    .replace(/^FortyGigabitEthernet\s*/i, "Fo")
    .replace(/^TwentyFiveGigE\s*/i, "Twe")
    .replace(/^TenGigabitEthernet\s*/i, "Te")
    .replace(/^GigabitEthernet\s*/i, "Gi")
    .replace(/^FastEthernet\s*/i, "Fa")
    .replace(/^Ethernet\s*/i, "Eth")
    .replace(/^Serial\s*/i, "Se")
    .replace(/^Vlan\s*/i, "Vl");
}

function shortIfaceNamesInText(text) {
  return String(text || "")
    .replace(/\bHundredGigabitEthernet\s*(?=\d)/gi, "Hu")
    .replace(/\bFortyGigabitEthernet\s*(?=\d)/gi, "Fo")
    .replace(/\bTwentyFiveGigE\s*(?=\d)/gi, "Twe")
    .replace(/\bTenGigabitEthernet\s*(?=\d)/gi, "Te")
    .replace(/\bGigabitEthernet\s*(?=\d)/gi, "Gi")
    .replace(/\bFastEthernet\s*(?=\d)/gi, "Fa")
    .replace(/\bEthernet\s*(?=\d)/gi, "Eth")
    .replace(/\bSerial\s*(?=\d)/gi, "Se")
    .replace(/\bVlan\s*(?=\d)/gi, "Vl");
}

function normalizeCableType(type) {
  const t = String(type || "auto").toLowerCase();
  if (t === "straight" || t === "straight-through") return "copper";
  if (t === "copper" || t === "cross" || t === "serial" || t === "fiber" || t === "console" || t === "auto") return t;
  return "auto";
}

function cableTypeLabel(type) {
  const t = normalizeCableType(type);
  return ({
    auto: "Auto cable",
    copper: "Copper straight-through",
    cross: "Copper crossover",
    serial: "Serial DCE",
    fiber: "Fiber",
    console: "Console",
  })[t] || "Auto cable";
}

function ifacePortInfo(dev, iface) {
  const raw = String(iface || "");
  const n = raw.toLowerCase();
  const model = String(dev?.platform || dev?.model || "").toLowerCase();
  const fiberCapable = /^(tengigabitethernet|twentyfivegige|fortygigabitethernet|hundredgigabitethernet)/i.test(raw)
    || ((model.includes("c9200") || model.includes("9200")) && /^GigabitEthernet1\/1\//i.test(raw))
    || /\bsfp|fiber|fibre/i.test(raw);
  let media = "unknown";
  let group = "Other";
  if (!raw || /^vlan/i.test(raw) || /^loopback/i.test(raw) || /^port-channel/i.test(raw)) {
    media = "virtual"; group = "Virtual";
  } else if (/wlan|wireless|wifi/i.test(raw)) {
    media = "wireless"; group = "Wireless";
  } else if (/^serial/i.test(raw)) {
    media = "serial"; group = "Serial";
  } else if (/coax/i.test(raw)) {
    media = "coax"; group = "Coax";
  } else if (/dsl/i.test(raw)) {
    media = "dsl"; group = "DSL";
  } else if (/console|aux/i.test(raw)) {
    media = "console"; group = "Management";
  } else if (/^(fastethernet|gigabitethernet|ethernet)/i.test(raw) || ["eth0", "wan", "internet", "pc"].includes(n)) {
    media = "ethernet"; group = fiberCapable ? "Uplinks" : "Ethernet";
  }
  return { media, group, fiberCapable, label: shortIfaceName(raw) };
}

function cableFitsPort(dev, iface, cableType) {
  const type = normalizeCableType(cableType);
  const info = ifacePortInfo(dev, iface);
  if (info.media === "virtual") return { ok: false, reason: "Virtual interfaces are not cable ports." };
  if (info.media === "wireless") return { ok: false, reason: "Wireless interfaces do not accept cables." };
  if (type === "auto") {
    if (info.media === "ethernet" || info.media === "serial" || info.media === "console" || info.fiberCapable) return { ok: true };
  } else if ((type === "copper" || type === "cross") && info.media === "ethernet") {
    return { ok: true };
  } else if (type === "serial" && info.media === "serial") {
    return { ok: true };
  } else if (type === "fiber" && info.fiberCapable) {
    return { ok: true };
  } else if (type === "console" && info.media === "console") {
    return { ok: true };
  }
  return { ok: false, reason: `${cableTypeLabel(type)} does not fit ${shortIfaceName(iface)}.` };
}

function copperRole(dev) {
  if (isSwitchLike(dev)) return "mdix";
  return "mdi";
}

function recommendedCableTypeForPorts(a, aIface, b, bIface) {
  const ai = ifacePortInfo(a, aIface);
  const bi = ifacePortInfo(b, bIface);
  if (ai.media === "serial" && bi.media === "serial") return "serial";
  if (ai.media === "console" && bi.media === "console") return "console";
  if (ai.media === "ethernet" && bi.media === "ethernet") {
    return copperRole(a) === copperRole(b) ? "cross" : "copper";
  }
  if (ai.fiberCapable && bi.fiberCapable) return "fiber";
  return null;
}

function cableCompatibility(a, aIface, b, bIface, requestedType = "auto") {
  if (!a || !b || !aIface || !bIface) return { ok: false, reason: "Pick a port on both devices." };
  const req = normalizeCableType(requestedType);
  const aFit = cableFitsPort(a, aIface, req);
  if (!aFit.ok) return { ok: false, reason: `${a.hostname || "Device"} ${aFit.reason}` };
  const bFit = cableFitsPort(b, bIface, req);
  if (!bFit.ok) return { ok: false, reason: `${b.hostname || "Device"} ${bFit.reason}` };

  const ai = ifacePortInfo(a, aIface);
  const bi = ifacePortInfo(b, bIface);
  const recommended = recommendedCableTypeForPorts(a, aIface, b, bIface);
  const type = req === "auto" ? recommended : req;
  if (!type) {
    return { ok: false, reason: `${shortIfaceName(aIface)} and ${shortIfaceName(bIface)} are different port types.` };
  }
  if (type === "serial" && (ai.media !== "serial" || bi.media !== "serial")) return { ok: false, reason: "Serial cables require serial ports on both devices." };
  if ((type === "copper" || type === "cross") && (ai.media !== "ethernet" || bi.media !== "ethernet")) return { ok: false, reason: "Copper cables require Ethernet ports on both devices." };
  if (type === "fiber" && (!ai.fiberCapable || !bi.fiberCapable)) return { ok: false, reason: "Fiber cables require fiber-capable uplink ports on both devices." };
  if (type === "console" && (ai.media !== "console" || bi.media !== "console")) return { ok: false, reason: "Console cables require console ports." };

  const warning = req !== "auto" && recommended && req !== recommended && (
    (req === "copper" || req === "cross") && (recommended === "copper" || recommended === "cross")
  )
    ? `${cableTypeLabel(req)} fits, but ${cableTypeLabel(recommended)} is usually expected for this connection.`
    : null;
  return { ok: true, type, warning, recommended };
}

function normalizeDevice(d) {
  if (!d) return d;
  const profile = platformForKind(d.kind, d.platform);
  const next = {
    ...defaultStateFor(d.kind),
    ...d,
    platform: d.platform || profile.id,
    model: d.model || profile.label,
    osVersion: d.osVersion || profile.os,
    image: d.image || profile.image,
    interfaces: { ...(d.interfaces || {}) },
  };
  if (!next.name) next.name = next.hostname;
  if (isSwitchLike(next) && !next.vlans) next.vlans = { 1: "default" };
  for (const iface of profile.ifaces || []) {
    if (!next.interfaces[iface]) next.interfaces[iface] = {};
  }
  for (const [name, ifc] of Object.entries(next.interfaces)) {
    const oldShort = name.match(/^G0\/([01])$/);
    if (next.kind === "router" && oldShort) {
      const real = `GigabitEthernet0/0/${oldShort[1]}`;
      next.interfaces[real] = { ...ifc, mac: ifc.mac || macFrom(`${next.kind}:${real}`) };
      delete next.interfaces[name];
      continue;
    }
    const oldSwitch = name.match(/^F0\/(\d+)$/);
    if (isSwitchLike(next) && oldSwitch) {
      const real = next.platform === "2960-24tt" || next.platform === "3560-24ps" ? `FastEthernet0/${oldSwitch[1]}` : `GigabitEthernet1/0/${oldSwitch[1]}`;
      next.interfaces[real] = { ...ifc, mac: ifc.mac || macFrom(`${next.kind}:${real}`) };
      delete next.interfaces[name];
    }
  }
  for (const [name, ifc] of Object.entries(next.interfaces)) {
    next.interfaces[name] = {
      up: false, admUp: false, ip: null, mask: null, gw: null, mac: macFrom(`${next.kind}:${name}`), desc: "",
      ...ifc,
    };
    if (isSwitchLike(next) && !name.toLowerCase().startsWith("vlan")) {
      next.interfaces[name] = {
        mode: "access", vlan: 1, nativeVlan: 1, allowedVlans: "all", stp: { portfast: false, bpduguard: false, state: "forwarding" },
        ...next.interfaces[name],
      };
    }
    if (next.kind === "wrt" && name === "Internet") {
      delete next.interfaces[name].mode;
      next.interfaces[name].natRole = next.interfaces[name].natRole || "outside";
    }
    if (next.kind === "asa") {
      next.interfaces[name].securityLevel = next.interfaces[name].securityLevel ?? (name.endsWith("/1") ? 0 : name.endsWith("/2") ? 100 : 50);
      next.interfaces[name].nameif = next.interfaces[name].nameif ?? (name.endsWith("/1") ? "outside" : name.endsWith("/2") ? "inside" : "");
    }
  }
  return recalcConnectedRoutes(next);
}

function normalizeTopology(devices, links) {
  const normalized = Object.fromEntries(Object.entries(devices || {}).map(([id, d]) => [id, normalizeDevice(d)]));
  const normIface = (dev, iface) => {
    if (!dev) return iface;
    if (dev.kind === "router" && iface === "G0/0") return "GigabitEthernet0/0/0";
    if (dev.kind === "router" && iface === "G0/1") return "GigabitEthernet0/0/1";
    const m = iface?.match(/^F0\/(\d+)$/);
    if (isSwitchLike(dev) && m) return dev.platform === "2960-24tt" || dev.platform === "3560-24ps" ? `FastEthernet0/${m[1]}` : `GigabitEthernet1/0/${m[1]}`;
    return iface;
  };
  const outLinks = (links || []).map((l) => ({
    ...l,
    ai: normIface(normalized[l.a], l.ai),
    bi: normIface(normalized[l.b], l.bi),
  }));
  return { devices: recomputeDynamicRoutes(normalized, outLinks), links: outLinks };
}

function findPeer(devices, links, devId, ifaceId) {
  for (const l of links || []) {
    if (l.a === devId && l.ai === ifaceId) return { peerId: l.b, peerIface: l.bi, link: l };
    if (l.b === devId && l.bi === ifaceId) return { peerId: l.a, peerIface: l.ai, link: l };
  }
  return null;
}

function ifaceForDest(dev, dstIp) {
  for (const [name, ifc] of Object.entries(dev.interfaces || {})) {
    if (ifc.ip && ifc.mask && inNet(dstIp, ifc.ip, ifc.mask)) return { name, ifc };
  }
  return null;
}

function lookupRoute(dev, dstIp) {
  let best = null, bestBits = -1;
  for (const r of dev.routes || []) {
    if (inNet(dstIp, r.dst, r.mask)) {
      const b = maskBits(r.mask);
      if (b > bestBits) { best = r; bestBits = b; }
    }
  }
  return best;
}

function recalcConnectedRoutes(dev) {
  const next = { ...dev, routes: (dev.routes || []).filter((r) => r.type !== "C") };
  if (!isRouterLike(next) || next.ipRouting === false) return next;
  for (const [iface, ifc] of Object.entries(next.interfaces || {})) {
    if (ifc.ip && ifc.mask) {
      next.routes.push({ dst: networkAddress(ifc.ip, ifc.mask), mask: ifc.mask, via: "directly", iface, type: "C" });
    }
  }
  return next;
}

function ifaceForVia(dev, via) {
  if (dev.interfaces?.[via]) return via;
  for (const [n, ifc] of Object.entries(dev.interfaces || {})) {
    if (ifc.ip && ifc.mask && sameSubnet(ifc.ip, via, ifc.mask)) return n;
  }
  return Object.keys(dev.interfaces || {})[0];
}

function ospfEnabledOn(dev, ifaceName, ifc) {
  if (!isRouterLike(dev)) return false;
  const ospf = Object.values(dev.ospf || {})[0];
  if (!ospf || ospf.passive?.includes(ifaceName)) return false;
  return (ospf.networks || []).some((n) => inNet(ifc.ip, n.network, wildcardToMask(n.wildcard)));
}

function dynamicEnabledOn(dev, proto, ifaceName, ifc) {
  if (proto === "O") return ospfEnabledOn(dev, ifaceName, ifc);
  if (!isRouterLike(dev)) return false;
  const db = proto === "R" ? Object.values(dev.rip || {})[0]
           : proto === "D" ? Object.values(dev.eigrp || {})[0]
           : proto === "B" ? Object.values(dev.bgp || {})[0]
           : null;
  if (!db || db.passive?.includes?.(ifaceName)) return false;
  if (proto === "B") return (db.networks || []).some((n) => inNet(ifc.ip, n.network, n.mask || "255.255.255.0"));
  return (db.networks || []).some((n) => inNet(ifc.ip, n.network, n.mask || "255.255.255.0"));
}

function recomputeDynamicRoutes(devices, links) {
  let next = Object.fromEntries(Object.entries(devices || {}).map(([id, d]) => [id, recalcConnectedRoutes({ ...d, routes: (d.routes || []).filter((r) => !["O", "R", "D", "B"].includes(r.type)) })]));
  const routerIds = Object.keys(next).filter((id) => isRouterLike(next[id]));
  for (const proto of ["O", "R", "D", "B"]) {
    for (const aId of routerIds) {
      const a = next[aId];
      for (const [aIfName, aIf] of Object.entries(a.interfaces || {})) {
        if (!aIf.ip || !aIf.up || !dynamicEnabledOn(a, proto, aIfName, aIf)) continue;
        const peer = findPeer(next, links, aId, aIfName);
        const b = next[peer?.peerId];
        const bIf = b?.interfaces?.[peer?.peerIface];
        if (!b || !bIf?.ip || !bIf.up || !dynamicEnabledOn(b, proto, peer.peerIface, bIf)) continue;
        if (!sameSubnet(aIf.ip, bIf.ip, aIf.mask)) continue;
        const learned = (b.routes || []).filter((r) => r.type === "C" || r.type === proto);
        for (const r of learned) {
          if (inNet(aIf.ip, r.dst, r.mask)) continue;
          if ((a.routes || []).some((x) => x.dst === r.dst && x.mask === r.mask)) continue;
          a.routes.push({ dst: r.dst, mask: r.mask, via: bIf.ip, iface: aIfName, type: proto });
        }
      }
    }
  }
  return next;
}

function vlanAllows(ifc, vlan) {
  if (!ifc) return false;
  if (ifc.mode !== "trunk") return String(ifc.vlan ?? 1) === String(vlan);
  if (ifc.allowedVlans === "all" || ifc.allowedVlans == null) return true;
  return String(ifc.allowedVlans).split(",").some((part) => {
    const [a, b] = part.split("-").map(Number);
    const v = Number(vlan);
    return b ? v >= a && v <= b : v === a;
  });
}

function vlanOnIngress(ifc) {
  return ifc?.mode === "trunk" ? (ifc.nativeVlan || 1) : (ifc?.vlan || 1);
}

function aclPermit(dev, aclName, srcIp, dstIp) {
  const acl = dev.acls?.[aclName];
  if (!acl) return { ok: true, note: `ACL ${aclName} not found` };
  for (const e of acl.entries || []) {
    const srcOk = !e.src || e.src === "any" || inNet(srcIp, e.src, wildcardToMask(e.srcWildcard || "0.0.0.0"));
    const dstOk = acl.type === "standard" || !e.dst || e.dst === "any" || inNet(dstIp, e.dst, wildcardToMask(e.dstWildcard || "0.0.0.0"));
    if (srcOk && dstOk) return { ok: e.action === "permit", note: `${aclName} ${e.action}` };
  }
  return { ok: false, note: `${aclName} implicit deny` };
}

function interfaceAclCheck(dev, ifaceName, direction, srcIp, dstIp) {
  const ifc = dev.interfaces?.[ifaceName];
  const aclName = ifc?.acl?.[direction];
  if (!aclName) return { ok: true };
  return aclPermit(dev, aclName, srcIp, dstIp);
}

function ownsIp(dev, ip) {
  for (const [n, ifc] of Object.entries(dev.interfaces || {})) {
    if (ifc.ip === ip) return n;
  }
  return null;
}

function hostIp(dev) {
  const eth = dev.interfaces?.eth0;
  if (eth?.ip) return { ip: eth.ip, iface: "eth0", mask: eth.mask };
  for (const [n, ifc] of Object.entries(dev.interfaces || {})) {
    if (ifc.ip && ifc.up) return { ip: ifc.ip, iface: n, mask: ifc.mask };
  }
  return null;
}

function planPath(devices, links, srcId, dstIp) {
  const src = devices[srcId];
  if (!src) return { ok: false, error: "Source device not found", hops: [] };
  if (!src.powered) return { ok: false, error: `${src.hostname} is powered off`, hops: [] };
  if (src.kind === "l2switch") return { ok: false, error: `${src.hostname} is a layer-2 switch - no routed management SVI is configured`, hops: [] };

  const origin = hostIp(src);
  if (!origin) return { ok: false, error: `${src.hostname} has no IP configured on an up interface`, hops: [] };
  const srcIp = origin.ip;
  const hops = [{ devId: srcId, action: "originate", note: `${src.hostname} crafts ICMP echo ${srcIp} -> ${dstIp}` }];

  let nextHopIp = null, egressIface = null;
  const local = ifaceForDest(src, dstIp);
  if (local) {
    nextHopIp = dstIp; egressIface = local.name;
    hops.push({ devId: srcId, action: "arp-local", iface: egressIface, note: `${dstIp} is local on ${egressIface}` });
  } else if (isRouterLike(src)) {
    const route = lookupRoute(src, dstIp);
    if (!route) return { ok: false, error: `${src.hostname}: no route to ${dstIp}`, hops };
    nextHopIp = route.via === "directly" ? dstIp : route.via; egressIface = route.iface;
    hops.push({ devId: srcId, action: "route", iface: egressIface, note: `route ${route.dst}/${maskBits(route.mask)} ${route.type} via ${route.via}` });
  } else {
    const e = src.interfaces.eth0;
    if (!e.gw) return { ok: false, error: `${src.hostname}: destination off-net and no default gateway configured`, hops };
    nextHopIp = e.gw; egressIface = "eth0";
    hops.push({ devId: srcId, action: "arp-gw", iface: egressIface, note: `${dstIp} off-net; gateway ${nextHopIp}` });
  }

  let curDev = src, curIface = egressIface, ingressIface = null, vlan = null;
  let guard = 0;
  while (guard++ < 48) {
    const outCheck = interfaceAclCheck(curDev, curIface, "out", srcIp, dstIp);
    if (!outCheck.ok) return { ok: false, error: `${curDev.hostname} ${curIface}: ${outCheck.note}`, hops: [...hops, { devId: curDev.id, action: "drop", note: outCheck.note, ok: false }] };
    const peer = findPeer(devices, links, curDev.id, curIface);
    if (!peer) return { ok: false, error: `No link connected to ${curDev.hostname} ${curIface}`, hops };
    if (!peer.link.up) return { ok: false, error: `Link ${curDev.hostname} ${curIface} is down`, hops };
    const nb = devices[peer.peerId], nbIf = nb?.interfaces?.[peer.peerIface];
    if (!nb || !nb.powered || !nbIf?.up || nbIf.admUp === false) return { ok: false, error: `Neighbor on ${curDev.hostname} ${curIface} is unreachable`, hops };
    ingressIface = peer.peerIface;
    hops.push({ devId: nb.id, action: "ingress", iface: ingressIface, note: `arrives at ${nb.hostname} ${ingressIface}` });

    const inCheck = interfaceAclCheck(nb, ingressIface, "in", srcIp, dstIp);
    if (!inCheck.ok) return { ok: false, error: `${nb.hostname} ${ingressIface}: ${inCheck.note}`, hops: [...hops, { devId: nb.id, action: "drop", note: inCheck.note, ok: false }] };

    const owned = ownsIp(nb, dstIp);
    if (owned) {
      hops.push({ devId: nb.id, action: "deliver", iface: owned, note: `delivered to ${nb.hostname} ${owned}`, ok: true });
      hops.push({ devId: nb.id, action: "reply", note: `${nb.hostname} sends ICMP echo-reply`, ok: true });
      return { ok: true, hops };
    }

    if (isSwitchLike(nb) && !nb.interfaces[ingressIface]?.routed) {
      const inIf = nb.interfaces[ingressIface];
      vlan = vlan ?? vlanOnIngress(inIf);
      if (!nb.vlans?.[vlan]) return { ok: false, error: `${nb.hostname}: VLAN ${vlan} does not exist`, hops };
      if (!vlanAllows(inIf, vlan)) return { ok: false, error: `${nb.hostname} ${ingressIface}: VLAN ${vlan} not allowed`, hops };
      if (inIf.stp?.state === "blocking") return { ok: false, error: `${nb.hostname} ${ingressIface}: STP blocking`, hops };
      if (inIf.portSecurity?.enabled && inIf.portSecurity.violation === "shutdown") {
        return { ok: false, error: `${nb.hostname} ${ingressIface}: port-security violation shutdown`, hops };
      }
      if (inIf.stormControl?.action === "shutdown") {
        return { ok: false, error: `${nb.hostname} ${ingressIface}: storm-control shutdown`, hops };
      }
      let chosen = null;
      const candidates = [];
      for (const [pname, pifc] of Object.entries(nb.interfaces || {})) {
        if (pname === ingressIface || pname.toLowerCase().startsWith("vlan")) continue;
        if (!pifc.up || pifc.admUp === false || pifc.stp?.state === "blocking" || !vlanAllows(pifc, vlan)) continue;
        const next = findPeer(devices, links, nb.id, pname);
        if (!next) continue;
        const nd = devices[next.peerId], nif = nd?.interfaces?.[next.peerIface];
        if (!nd || !nif) continue;
        candidates.push({ pname, next, nd, nif });
      }
      chosen = candidates.find((c) => c.nif.ip === nextHopIp || c.nif.ip === dstIp);
      if (!chosen) chosen = candidates.find((c) => isRouterLike(c.nd));
      if (!chosen) chosen = candidates.find((c) => isHostLike(c.nd) && c.nif.ip && sameSubnet(c.nif.ip, dstIp, c.nif.mask || "255.255.255.0"));
      if (!chosen) return { ok: false, error: `${nb.hostname}: no forwarding path in VLAN ${vlan} toward ${dstIp}`, hops };
      hops.push({ devId: nb.id, action: "switch", iface: chosen.pname, note: `VLAN ${vlan} egress ${chosen.pname}` });
      curDev = nb; curIface = chosen.pname;
      continue;
    }

    if (isRouterLike(nb)) {
      const route = lookupRoute(nb, dstIp);
      if (!route) return { ok: false, error: `${nb.hostname}: no route to host ${dstIp}`, hops: [...hops, { devId: nb.id, action: "drop", note: "no route", ok: false }] };
      nextHopIp = route.via === "directly" ? dstIp : route.via;
      if (nb.interfaces[ingressIface]?.natRole === "inside" && nb.interfaces[route.iface]?.natRole === "outside") {
        hops.push({ devId: nb.id, action: "nat", iface: route.iface, note: `PAT source ${srcIp} to ${nb.interfaces[route.iface].ip || "outside interface"}` });
      }
      hops.push({ devId: nb.id, action: "route", iface: route.iface, note: `route ${route.dst}/${maskBits(route.mask)} ${route.type} via ${route.via}` });
      curDev = nb; curIface = route.iface; vlan = null;
      continue;
    }
    return { ok: false, error: `Unsupported hop at ${nb.hostname}`, hops };
  }
  return { ok: false, error: "Hop limit exceeded", hops };
}

function allocateDhcp(devices, links, clientId) {
  const client = devices[clientId];
  if (!client?.interfaces?.eth0) return { devices, message: "No eth0 interface" };
  const peer = findPeer(devices, links, clientId, "eth0");
  if (!peer) return { devices, message: "No DHCP server reachable" };
  let vlan = 1, gatewayIp = null, server = null, poolName = null;
  const walk = [peer.peerId];
  const seen = new Set();
  while (walk.length && !server) {
    const id = walk.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    const d = devices[id];
    if (!d) continue;
    if (isSwitchLike(d)) {
      const ingress = Object.values(d.interfaces).find((i) => i.up && i.vlan);
      vlan = ingress?.vlan || vlan;
      for (const l of links) if (l.a === id) walk.push(l.b); else if (l.b === id) walk.push(l.a);
    }
    for (const [name, ifc] of Object.entries(d.interfaces || {})) {
      if (ifc.ip && ifc.up) {
        for (const [pn, p] of Object.entries(d.dhcp?.pools || {})) {
          if (p.network && p.mask && sameSubnet(ifc.ip, p.network, p.mask)) {
            server = d; poolName = pn; gatewayIp = p.defaultRouter || ifc.ip;
          }
        }
      }
      if (server) break;
    }
  }
  if (!server) return { devices, message: `No DHCP pool reachable for VLAN ${vlan}` };
  const pool = server.dhcp.pools[poolName];
  const used = new Set(server.dhcp.bindings.map((b) => b.ip));
  const excluded = server.dhcp.excluded || [];
  const isExcluded = (ip) => excluded.some((e) => ipToInt(ip) >= ipToInt(e.start) && ipToInt(ip) <= ipToInt(e.end || e.start));
  let offered = null;
  const base = ipToInt(networkAddress(pool.network, pool.mask));
  const broadcast = base | (~ipToInt(pool.mask) >>> 0);
  for (let n = base + 10; n < broadcast; n++) {
    const ip = intToIp(n);
    if (!used.has(ip) && !isExcluded(ip) && ip !== gatewayIp) { offered = ip; break; }
  }
  if (!offered) return { devices, message: `DHCP pool ${poolName} has no free addresses` };
  const next = clone(devices);
  next[clientId].interfaces.eth0 = { ...next[clientId].interfaces.eth0, ip: offered, mask: pool.mask, gw: gatewayIp, dhcp: true };
  next[server.id].dhcp.bindings.push({ ip: offered, client: client.hostname, mac: client.interfaces.eth0.mac, pool: poolName });
  return { devices: next, message: `${client.hostname} leased ${offered} from ${server.hostname}` };
}

function serializeConfig(d) {
  const out = ["!", `! ${d.model || d.kind} running-config`, "!", `hostname ${d.hostname}`];
  if (d.secrets?.enable) out.push(`enable secret ${d.secrets.enable}`);
  if (d.services?.passwordEncryption) out.push("service password-encryption");
  if (d.aaa?.enabled) out.push("aaa new-model");
  if (d.vtp?.domain) out.push(`vtp domain ${d.vtp.domain}`);
  if (d.vtp?.mode) out.push(`vtp mode ${d.vtp.mode}`);
  for (const h of d.loggingHosts || []) out.push(`logging host ${h}`);
  for (const s of d.ntp?.servers || []) out.push(`ntp server ${s}`);
  for (const c of d.snmp?.communities || []) out.push(`snmp-server community ${c.name} ${c.access}`);
  for (const h of d.snmp?.hosts || []) out.push(`snmp-server host ${h.host} ${h.community || ""}`.trim());
  if (d.crypto?.rsaKeys) out.push(`crypto key generate rsa modulus ${d.crypto.rsaKeys.modulus}`);
  if (d.dhcpSnooping?.enabled) out.push("ip dhcp snooping");
  if (d.dhcpSnooping?.vlans?.length) out.push(`ip dhcp snooping vlan ${d.dhcpSnooping.vlans.join(",")}`);
  if (d.dai?.vlans?.length) out.push(`ip arp inspection vlan ${d.dai.vlans.join(",")}`);
  if (d.ipRouting === false && d.kind !== "router") out.push("no ip routing");
  for (const [u, v] of Object.entries(d.users || {})) out.push(`username ${u} secret ${v.secret}`);
  for (const [name, p] of Object.entries(d.prefixLists || {})) for (const e of p.entries || []) out.push(`ip prefix-list ${name} ${e.action} ${e.prefix}`);
  for (const [name, rm] of Object.entries(d.routeMaps || {})) {
    for (const seq of rm.sequences || []) {
      out.push(`route-map ${name} ${seq.action} ${seq.seq}`);
      if (seq.match) out.push(` match ${seq.match}`);
      if (seq.set) out.push(` set ${seq.set}`);
    }
  }
  for (const [name, vrf] of Object.entries(d.vrfs || {})) {
    out.push(`vrf definition ${name}`);
    if (vrf.rd) out.push(` rd ${vrf.rd}`);
    out.push("!");
  }
  for (const [name, pool] of Object.entries(d.nat?.pools || {})) out.push(`ip nat pool ${name} ${pool.start} ${pool.end} netmask ${pool.mask}`);
  for (const rule of d.nat?.rules || []) out.push(rule.config);
  if (d.wireless?.ssid) out.push(`wireless ssid ${d.wireless.ssid}`);
  if (d.wireless?.security) out.push(`wireless security ${d.wireless.security}${d.wireless.passphrase ? ` ${d.wireless.passphrase}` : ""}`);
  for (const e of d.dhcp?.excluded || []) out.push(`ip dhcp excluded-address ${e.start}${e.end && e.end !== e.start ? ` ${e.end}` : ""}`);
  for (const [name, p] of Object.entries(d.dhcp?.pools || {})) {
    out.push(`ip dhcp pool ${name}`);
    if (p.network) out.push(` network ${p.network} ${p.mask}`);
    if (p.defaultRouter) out.push(` default-router ${p.defaultRouter}`);
    if (p.dnsServer) out.push(` dns-server ${p.dnsServer}`);
    out.push("!");
  }
  if (d.vlans) {
    for (const [id, name] of Object.entries(d.vlans)) {
      if (String(id) === "1") continue;
      out.push(`vlan ${id}`, ` name ${name}`, "!");
    }
  }
  for (const [n, ifc] of Object.entries(d.interfaces || {})) {
    out.push(`interface ${n}`);
    if (ifc.desc) out.push(` description ${ifc.desc}`);
    if (ifc.nameif) out.push(` nameif ${ifc.nameif}`);
    if (ifc.securityLevel !== undefined) out.push(` security-level ${ifc.securityLevel}`);
    if (ifc.routed) out.push(" no switchport");
    if (ifc.ip) out.push(` ip address ${ifc.ip} ${ifc.mask}`);
    if (ifc.mode) out.push(` switchport mode ${ifc.mode}`);
    if (ifc.mode === "access" && ifc.vlan) out.push(` switchport access vlan ${ifc.vlan}`);
    if (ifc.voiceVlan) out.push(` switchport voice vlan ${ifc.voiceVlan}`);
    if (ifc.channelGroup) out.push(` channel-group ${ifc.channelGroup.id} mode ${ifc.channelGroup.mode}`);
    if (ifc.portSecurity?.enabled) out.push(" switchport port-security");
    if (ifc.portSecurity?.maximum) out.push(` switchport port-security maximum ${ifc.portSecurity.maximum}`);
    if (ifc.portSecurity?.violation) out.push(` switchport port-security violation ${ifc.portSecurity.violation}`);
    if (ifc.stormControl?.level) out.push(` storm-control broadcast level ${ifc.stormControl.level}`);
    if (ifc.stormControl?.action) out.push(` storm-control action ${ifc.stormControl.action}`);
    if (ifc.dhcpSnoopingTrust) out.push(" ip dhcp snooping trust");
    if (ifc.daiTrust) out.push(" ip arp inspection trust");
    if (ifc.encapsulation) out.push(` encapsulation ${ifc.encapsulation}`);
    if (ifc.tunnelSource) out.push(` tunnel source ${ifc.tunnelSource}`);
    if (ifc.tunnelDestination) out.push(` tunnel destination ${ifc.tunnelDestination}`);
    if (ifc.policyRouteMap) out.push(` ip policy route-map ${ifc.policyRouteMap}`);
    if (ifc.servicePolicy?.in) out.push(` service-policy input ${ifc.servicePolicy.in}`);
    if (ifc.servicePolicy?.out) out.push(` service-policy output ${ifc.servicePolicy.out}`);
    if (ifc.pim) out.push(` ip pim ${ifc.pim}`);
    for (const g of ifc.igmpGroups || []) out.push(` ip igmp join-group ${g}`);
    for (const [g, h] of Object.entries(ifc.hsrp || {})) {
      if (h.ip) out.push(` standby ${g} ip ${h.ip}`);
      if (h.priority) out.push(` standby ${g} priority ${h.priority}`);
    }
    if (ifc.mode === "trunk") {
      if (ifc.nativeVlan && ifc.nativeVlan !== 1) out.push(` switchport trunk native vlan ${ifc.nativeVlan}`);
      if (ifc.allowedVlans && ifc.allowedVlans !== "all") out.push(` switchport trunk allowed vlan ${ifc.allowedVlans}`);
    }
    if (ifc.acl?.in) out.push(` ip access-group ${ifc.acl.in} in`);
    if (ifc.acl?.out) out.push(` ip access-group ${ifc.acl.out} out`);
    if (ifc.natRole) out.push(` ip nat ${ifc.natRole}`);
    out.push(ifc.admUp === false ? " shutdown" : " no shutdown");
    out.push("!");
  }
  for (const r of d.routes || []) if (r.type === "S") out.push(`ip route ${r.dst} ${r.mask} ${r.via}`);
  for (const [pid, o] of Object.entries(d.ospf || {})) {
    out.push(`router ospf ${pid}`);
    if (o.routerId) out.push(` router-id ${o.routerId}`);
    for (const n of o.networks || []) out.push(` network ${n.network} ${n.wildcard} area ${n.area}`);
    for (const p of o.passive || []) out.push(` passive-interface ${p}`);
    out.push("!");
  }
  for (const [pid, r] of Object.entries(d.rip || {})) {
    out.push("router rip");
    if (r.version) out.push(` version ${r.version}`);
    for (const n of r.networks || []) out.push(` network ${n.network}`);
    out.push("!");
  }
  for (const [asn, e] of Object.entries(d.eigrp || {})) {
    out.push(`router eigrp ${asn}`);
    for (const n of e.networks || []) out.push(` network ${n.network} ${n.wildcard || ""}`.trim());
    out.push("!");
  }
  for (const [asn, b] of Object.entries(d.bgp || {})) {
    out.push(`router bgp ${asn}`);
    for (const n of b.neighbors || []) out.push(` neighbor ${n.ip} remote-as ${n.remoteAs}`);
    for (const n of b.networks || []) out.push(` network ${n.network}${n.mask ? ` mask ${n.mask}` : ""}`);
    out.push("!");
  }
  for (const [name, c] of Object.entries(d.qos?.classMaps || {})) out.push(`class-map ${c.matchType || "match-any"} ${name}`, ...(c.matches || []).map((m) => ` match ${m}`), "!");
  for (const [name, p] of Object.entries(d.qos?.policyMaps || {})) {
    out.push(`policy-map ${name}`);
    for (const cls of p.classes || []) {
      out.push(` class ${cls.name}`);
      for (const a of cls.actions || []) out.push(`  ${a}`);
    }
    out.push("!");
  }
  for (const [id, sla] of Object.entries(d.ipSla || {})) {
    out.push(`ip sla ${id}`);
    if (sla.icmpEcho) out.push(` icmp-echo ${sla.icmpEcho}`);
    out.push("!");
  }
  for (const [id, tr] of Object.entries(d.tracks || {})) out.push(`track ${id} ${tr.object || ""}`.trim());
  for (const [name, acl] of Object.entries(d.acls || {})) {
    out.push(`ip access-list ${acl.type} ${name}`);
    for (const e of acl.entries || []) out.push(` ${e.action} ${e.src || "any"}${e.dst ? ` ${e.dst}` : ""}`);
    out.push("!");
  }
  out.push("end");
  return out.join("\n");
}

window.OPT_Engine = {
  uid, makeStarter, makeDevice, platformForKind, PLATFORM_PROFILES,
  normalizeDevice, normalizeTopology, serializeConfig,
  planPath, allocateDhcp, recomputeDynamicRoutes, recalcConnectedRoutes,
  ipToInt, intToIp, maskBits, wildcardToMask, networkAddress, sameSubnet, inNet,
  findPeer, lookupRoute, ifaceForDest, ifaceForVia, shortIfaceName, shortIfaceNamesInText,
  normalizeCableType, cableTypeLabel, ifacePortInfo, cableFitsPort, recommendedCableTypeForPorts, cableCompatibility,
  isRouterLike, isSwitchLike, isHostLike,
};
