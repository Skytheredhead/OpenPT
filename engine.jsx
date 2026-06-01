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
  mac: { id: "mac", label: "Mac", os: "macOS 15 simulated", image: "mac", ifaces: ["en0", "en1"] },
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
  "pt-logical-object": { id: "pt-logical-object", label: "Packet Tracer Logical Object", os: "Packet Tracer metadata", image: "annotation", ifaces: [] },
};

function platformForKind(kind, platform) {
  if (platform && PLATFORM_PROFILES[platform]) return PLATFORM_PROFILES[platform];
  if (kind === "router") return PLATFORM_PROFILES.isr4321;
  if (kind === "l2switch") return PLATFORM_PROFILES["2960-24tt"];
  if (kind === "l3switch") return PLATFORM_PROFILES["3560-24ps"];
  if (kind === "wrt") return PLATFORM_PROFILES.wrt300n;
  if (kind === "asa") return PLATFORM_PROFILES.asa5506x;
  if (kind === "laptop") return PLATFORM_PROFILES.laptop;
  if (kind === "mac") return PLATFORM_PROFILES.mac;
  if (kind === "printer") return PLATFORM_PROFILES.printer;
  if (kind === "phone") return PLATFORM_PROFILES.ipphone;
  if (kind === "ap") return PLATFORM_PROFILES.ap;
  if (kind === "cloud") return PLATFORM_PROFILES.cloudpt;
  if (kind === "internet") return PLATFORM_PROFILES.internet;
  if (kind === "dslmodem") return PLATFORM_PROFILES.dslmodem;
  if (kind === "cablemodem") return PLATFORM_PROFILES.cablemodem;
  if (kind === "server") return PLATFORM_PROFILES.genericServer;
  if (kind === "annotation") return PLATFORM_PROFILES["pt-logical-object"];
  return PLATFORM_PROFILES.genericPc;
}

function defaultStateFor(kind) {
  const isSwitch = kind === "l2switch" || kind === "l3switch" || kind === "wrt";
  const isFirewall = kind === "asa";
  const isServer = kind === "server";
  return {
    startupConfig: "",
    startupConfigState: null,
    users: {},
    secrets: {},
    lines: {
      console: { password: "", login: false, loggingSync: false },
      vty: { password: "", login: false, transport: ["ssh", "telnet"] },
    },
    services: { passwordEncryption: false, cdp: true, lldp: false, ssh: false, http: isServer, dns: isServer, tftp: isServer, aaa: isServer, radius: isServer, syslog: isServer, ntp: isServer },
    domainName: "",
    dhcp: { excluded: [], pools: {}, bindings: [] },
    dhcpv6: { pools: {}, bindings: [] },
    ipv6Routing: kind === "router" || kind === "l3switch" || kind === "wrt" || kind === "asa",
    ipv6Routes: [],
    ipv6Nd: {},
    ospfv3: {},
    eigrpIpv6: {},
    ospf: {},
    rip: {},
    eigrp: {},
    bgp: {},
    acls: {},
    nat: { rules: [], pools: {}, translations: [] },
    wireless: (kind === "wrt" || kind === "ap")
      ? { radioEnabled: true, ssids: [{ name: "OpenPT", security: kind === "wrt" ? "wpa2-psk" : "open", passphrase: kind === "wrt" ? "openpt123" : "", vlan: 1, enabled: true }] }
      : undefined,
    firewall: isFirewall ? { securityLevels: {}, accessRules: [], defaultRoute: null } : undefined,
    routeMaps: {},
    prefixLists: {},
    vrfs: {},
    aaa: { enabled: false, methods: [] },
    crypto: { rsaKeys: null, ikev1: {}, ipsec: {} },
    ssh: { version: null },
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
      ipv6: null, ipv6PrefixLength: null, ipv6Gw: null, linkLocal: null, ipv6Source: null, ipv6Autoconfig: false, ipv6Enabled: false,
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
    if ((kind === "ap" || kind === "wrt") && /wlan|wireless|wifi/i.test(n)) {
      out[n].up = true;
      out[n].admUp = true;
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
    lnk(R1.id, "GigabitEthernet0/0/1", R2.id, "GigabitEthernet0/0/1", "cross"),
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
function isIpv6(value) {
  const text = String(value || "").split("/")[0].split("%")[0].trim();
  if (!text || !text.includes(":")) return false;
  return parseIpv6Address(text) != null;
}
function parseIpv6Address(value) {
  let text = String(value || "").toLowerCase().split("/")[0].split("%")[0].trim();
  if (!text || !text.includes(":")) return null;
  if (text.includes(".")) return null;
  if ((text.match(/::/g) || []).length > 1) return null;
  const [leftRaw, rightRaw] = text.split("::");
  const left = leftRaw ? leftRaw.split(":").filter(Boolean) : [];
  const right = rightRaw ? rightRaw.split(":").filter(Boolean) : [];
  if (!text.includes("::") && left.length !== 8) return null;
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (!text.includes("::") && missing !== 0)) return null;
  const groups = [...left, ...Array.from({ length: missing }, () => "0"), ...right];
  if (groups.length !== 8) return null;
  let out = 0n;
  for (const g of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(g)) return null;
    out = (out << 16n) + BigInt(parseInt(g, 16));
  }
  return out;
}
function ipv6ToBigInt(value) {
  return parseIpv6Address(value) ?? 0n;
}
function bigIntToIpv6(value) {
  let n = BigInt.asUintN(128, BigInt(value || 0));
  const groups = [];
  for (let i = 0; i < 8; i++) {
    groups.unshift(Number(n & 0xffffn).toString(16));
    n >>= 16n;
  }
  let bestStart = -1, bestLen = 0;
  for (let i = 0; i < groups.length;) {
    if (groups[i] !== "0") { i++; continue; }
    let j = i;
    while (j < groups.length && groups[j] === "0") j++;
    if (j - i > bestLen) { bestStart = i; bestLen = j - i; }
    i = j;
  }
  if (bestLen < 2) return groups.join(":");
  const before = groups.slice(0, bestStart).join(":");
  const after = groups.slice(bestStart + bestLen).join(":");
  if (!before && !after) return "::";
  if (!before) return `::${after}`;
  if (!after) return `${before}::`;
  return `${before}::${after}`;
}
function normalizeIpv6(value) {
  const parsed = parseIpv6Address(value);
  return parsed == null ? "" : bigIntToIpv6(parsed);
}
function ipv6PrefixLength(value, fallback = 64) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 128 ? n : fallback;
}
function ipv6Mask(prefixLength) {
  const len = ipv6PrefixLength(prefixLength, 64);
  return len === 0 ? 0n : ((1n << BigInt(len)) - 1n) << BigInt(128 - len);
}
function ipv6NetworkAddress(ip, prefixLength = 64) {
  const parsed = parseIpv6Address(ip);
  if (parsed == null) return "";
  return bigIntToIpv6(parsed & ipv6Mask(prefixLength));
}
function ipv6InPrefix(ip, prefix, prefixLength = 64) {
  const a = parseIpv6Address(ip);
  const b = parseIpv6Address(prefix);
  if (a == null || b == null) return false;
  const mask = ipv6Mask(prefixLength);
  return (a & mask) === (b & mask);
}
function sameIpv6Subnet(a, b, prefixLength = 64) {
  return ipv6InPrefix(a, b, prefixLength);
}
function ipv6InterfaceIdFromMac(mac) {
  const bytes = String(mac || "00:00:00:00:00:01").split(":").map((b) => parseInt(b, 16));
  while (bytes.length < 6) bytes.push(0);
  bytes[0] = (bytes[0] ^ 0x02) & 0xff;
  const eui = [bytes[0], bytes[1], bytes[2], 0xff, 0xfe, bytes[3], bytes[4], bytes[5]];
  let id = 0n;
  for (const b of eui) id = (id << 8n) + BigInt(b || 0);
  return id;
}
function ipv6LinkLocal(ifc = {}) {
  if (ifc.linkLocal && isIpv6(ifc.linkLocal)) return normalizeIpv6(ifc.linkLocal);
  return bigIntToIpv6((parseIpv6Address("fe80::") || 0n) + ipv6InterfaceIdFromMac(ifc.mac));
}
function ipv6FromPrefix(prefix, prefixLength, ifc = {}) {
  const base = parseIpv6Address(prefix);
  if (base == null) return "";
  const network = base & ipv6Mask(prefixLength);
  return bigIntToIpv6(network + ipv6InterfaceIdFromMac(ifc));
}
function ifaceIpv6(ifc = {}) {
  const raw = ifc.ipv6 || ifc.ipv6Address || "";
  if (!raw) return null;
  const [addr, len] = String(raw).split("/");
  if (!isIpv6(addr)) return null;
  return { ip: normalizeIpv6(addr), prefixLength: ipv6PrefixLength(ifc.ipv6PrefixLength ?? ifc.ipv6Prefix ?? len, 64) };
}
function ifaceIpv6Up(name, ifc = {}) {
  return ifc.admUp !== false && (ifc.up || dot1qVlanForIface(name, ifc) != null);
}
function isSwitchLike(d) { return d?.kind === "l2switch" || d?.kind === "l3switch" || d?.kind === "wrt"; }
function isRouterLike(d) { return d?.kind === "router" || d?.kind === "l3switch" || d?.kind === "wrt" || d?.kind === "asa"; }
function isHostLike(d) { return ["pc", "server", "laptop", "mac", "printer", "phone"].includes(d?.kind); }
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
  } else if (/wlan|wireless|wifi/i.test(raw) || (dev?.kind === "mac" && n === "en1")) {
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

const WIRELESS_RANGE = 360;

function isWirelessIface(dev, iface) {
  return ifacePortInfo(dev, iface).media === "wireless";
}

function isWirelessAp(dev) {
  return dev?.kind === "ap" || dev?.kind === "wrt";
}

function normalizeWirelessSecurity(value) {
  const raw = String(value || "open").trim().toLowerCase();
  if (!raw || raw === "none" || raw === "open") return "open";
  if (raw.includes("wpa2") || raw.includes("psk")) return "wpa2-psk";
  return raw;
}

function normalizeWirelessSsid(ssid = {}, fallback = {}) {
  const name = ssid.name ?? ssid.ssid ?? fallback.name ?? fallback.ssid ?? "OpenPT";
  const security = normalizeWirelessSecurity(ssid.security ?? ssid.auth ?? fallback.security ?? fallback.auth ?? "open");
  return {
    name: String(name || "OpenPT"),
    security,
    passphrase: security === "open" ? "" : String(ssid.passphrase ?? ssid.key ?? fallback.passphrase ?? ""),
    vlan: Number(ssid.vlan ?? fallback.vlan ?? 1) || 1,
    enabled: ssid.enabled !== false,
  };
}

function normalizeWirelessConfig(dev) {
  if (!isWirelessAp(dev)) return dev.wireless;
  const existing = dev.wireless || {};
  const oldStyle = existing.ssid || existing.security || existing.passphrase
    ? [{ name: existing.ssid || "OpenPT", security: existing.security || "open", passphrase: existing.passphrase || "", vlan: existing.vlan || 1, enabled: true }]
    : null;
  const ssids = (Array.isArray(existing.ssids) && existing.ssids.length ? existing.ssids : oldStyle)
    || defaultStateFor(dev.kind).wireless?.ssids
    || [{ name: "OpenPT", security: "open", passphrase: "", vlan: 1, enabled: true }];
  const normalized = ssids.map((s) => normalizeWirelessSsid(s, existing));
  const primary = normalized[0] || normalizeWirelessSsid();
  return {
    ...existing,
    radioEnabled: existing.radioEnabled !== false,
    ssids: normalized,
    associations: Array.isArray(existing.associations) ? existing.associations : [],
    ssid: existing.ssid || primary.name,
    security: normalizeWirelessSecurity(existing.security || primary.security),
    passphrase: existing.passphrase ?? primary.passphrase,
    vlan: Number(existing.vlan ?? primary.vlan ?? 1) || 1,
  };
}

function wirelessSignalDbm(ap, client) {
  const d = Math.hypot((ap.x || 0) - (client.x || 0), (ap.y || 0) - (client.y || 0));
  if (d > WIRELESS_RANGE) return null;
  return Math.max(-90, Math.round(-34 - d * 0.14));
}

function wirelessClientProfile(dev, ifaceName, ifc = {}) {
  return {
    ssid: String(ifc.ssid || ""),
    security: normalizeWirelessSecurity(ifc.security || ifc.auth || "open"),
    passphrase: String(ifc.passphrase || ifc.key || ""),
    ifaceName,
  };
}

function wirelessFailureReason(dev, ifaceName) {
  const ifc = dev?.interfaces?.[ifaceName] || {};
  if (!dev?.powered) return `${dev?.hostname || "client"} is powered off`;
  if (ifc.admUp === false) return `${dev.hostname} ${ifaceName} wireless radio is down`;
  if (!ifc.ssid) return `${dev.hostname} ${ifaceName} has no SSID configured`;
  if (ifc.associationState === "auth-failed") return `${dev.hostname} wireless authentication mismatch for SSID ${ifc.ssid}`;
  if (ifc.associationState === "out-of-range") return `${dev.hostname} is out of range of SSID ${ifc.ssid}`;
  if (ifc.associationState === "no-ap") return `No AP advertising SSID ${ifc.ssid}`;
  return `${dev.hostname} ${ifaceName} is not associated`;
}

function computeWirelessAssociations(devices = {}) {
  const next = clone(devices || {});
  const aps = [];
  for (const [id, d] of Object.entries(next)) {
    if (!isWirelessAp(d)) continue;
    d.wireless = normalizeWirelessConfig(d);
    d.wireless.associations = [];
    const wlan = Object.entries(d.interfaces || {}).find(([name]) => isWirelessIface(d, name));
    if (!d.powered || !wlan || wlan[1].admUp === false || d.wireless.radioEnabled === false) continue;
    for (const ssid of d.wireless.ssids || []) {
      if (ssid.enabled !== false) aps.push({ id, dev: d, iface: wlan[0], ssid });
    }
  }

  for (const [clientId, client] of Object.entries(next)) {
    if (isWirelessAp(client) || !client.powered) continue;
    for (const [ifaceName, ifc] of Object.entries(client.interfaces || {})) {
      if (!isWirelessIface(client, ifaceName)) continue;
      const profile = wirelessClientProfile(client, ifaceName, ifc);
      const previousApId = ifc.associatedApId;
      ifc.associatedApId = null;
      ifc.associatedSsid = null;
      ifc.associationState = ifc.admUp === false ? "radio-down" : (profile.ssid ? "no-ap" : "disconnected");
      ifc.signalDbm = null;
      ifc.up = false;
      if (!profile.ssid || ifc.admUp === false) continue;

      let sawSsid = false, sawInRange = false, sawSecurity = false;
      const candidates = [];
      for (const ap of aps) {
        if (ap.ssid.name !== profile.ssid) continue;
        sawSsid = true;
        const signal = wirelessSignalDbm(ap.dev, client);
        if (signal == null) continue;
        sawInRange = true;
        if (ap.ssid.security !== profile.security) continue;
        sawSecurity = true;
        if (ap.ssid.security !== "open" && ap.ssid.passphrase !== profile.passphrase) continue;
        candidates.push({ ...ap, signal });
      }
      candidates.sort((a, b) =>
        b.signal - a.signal
        || (b.id === previousApId ? 1 : 0) - (a.id === previousApId ? 1 : 0)
        || String(a.dev.hostname || a.id).localeCompare(String(b.dev.hostname || b.id))
        || String(a.id).localeCompare(String(b.id))
      );
      const best = candidates[0];
      if (!best) {
        ifc.associationState = sawSecurity ? "auth-failed" : sawInRange ? "auth-failed" : sawSsid ? "out-of-range" : "no-ap";
        continue;
      }
      ifc.associatedApId = best.id;
      ifc.associatedSsid = best.ssid.name;
      ifc.associationState = "associated";
      ifc.signalDbm = best.signal;
      ifc.up = true;
      next[best.id].wireless.associations.push({
        clientId,
        clientHostname: client.hostname,
        clientIface: ifaceName,
        ssid: best.ssid.name,
        security: best.ssid.security,
        signalDbm: best.signal,
        vlan: best.ssid.vlan,
        mac: ifc.mac,
      });
    }
  }
  return next;
}

function wirelessPeersFor(devices = {}, devId, iface) {
  const dev = devices?.[devId];
  if (!dev || !isWirelessIface(dev, iface)) return [];
  const ifc = dev.interfaces?.[iface] || {};
  if (ifc.associatedApId) {
    const ap = devices[ifc.associatedApId];
    const apIface = Object.keys(ap?.interfaces || {}).find((name) => isWirelessIface(ap, name)) || "wlan0";
    if (ap) return [{ peerId: ap.id, peerIface: apIface, link: { id: `wl:${devId}:${iface}:${ap.id}`, type: "wireless", up: true, wireless: true } }];
  }
  if (isWirelessAp(dev)) {
    return (dev.wireless?.associations || []).map((a) => ({
      peerId: a.clientId,
      peerIface: a.clientIface,
      link: { id: `wl:${devId}:${iface}:${a.clientId}:${a.clientIface}`, type: "wireless", up: true, wireless: true, ssid: a.ssid },
    }));
  }
  return [];
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
  if (isWirelessAp(next)) next.wireless = normalizeWirelessConfig(next);
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
      up: false, admUp: false, ip: null, mask: null, gw: null,
      ipv6: null, ipv6PrefixLength: null, ipv6Gw: null, linkLocal: null, ipv6Source: null, ipv6Autoconfig: false, ipv6Enabled: false,
      mac: macFrom(`${next.kind}:${name}`), desc: "",
      ...ifc,
    };
    const v6 = ifaceIpv6(next.interfaces[name]);
    if (v6) {
      next.interfaces[name].ipv6 = v6.ip;
      next.interfaces[name].ipv6PrefixLength = v6.prefixLength;
    }
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
    if (isWirelessAp(next) && isWirelessIface(next, name) && next.wireless?.radioEnabled !== false) {
      next.interfaces[name].up = true;
      next.interfaces[name].admUp = true;
    }
    if (isWirelessIface(next, name) && !isWirelessAp(next)) {
      const security = normalizeWirelessSecurity(next.interfaces[name].security || next.interfaces[name].auth || "open");
      next.interfaces[name] = {
        security,
        passphrase: next.interfaces[name].passphrase || "",
        associationState: next.interfaces[name].associationState || "disconnected",
        associatedApId: next.interfaces[name].associatedApId || null,
        signalDbm: next.interfaces[name].signalDbm ?? null,
        ...next.interfaces[name],
      };
      next.interfaces[name].security = normalizeWirelessSecurity(next.interfaces[name].security || next.interfaces[name].auth || security);
    }
  }
  return recalcConnectedRoutes(next);
}

const STARTUP_VOLATILE_KEYS = new Set([
  "id", "x", "y", "powered",
  "arp", "mac", "runtime", "appRuntime", "packetTracer",
  "startupConfig", "startupConfigState",
]);

function startupConfigSnapshot(d) {
  const normalized = normalizeDevice(d);
  const snap = {};
  for (const [key, value] of Object.entries(normalized || {})) {
    if (STARTUP_VOLATILE_KEYS.has(key)) continue;
    if (value === undefined) continue;
    snap[key] = clone(value);
  }
  if (snap.nat?.translations) snap.nat.translations = [];
  if (snap.dhcp?.bindings) snap.dhcp.bindings = [];
  if (snap.dhcpv6?.bindings) snap.dhcpv6.bindings = [];
  return snap;
}

function defaultReloadDevice(d) {
  const platform = platformForKind(d.kind, d.platform);
  const name = d.name || platform.label || d.hostname || d.kind;
  return makeDevice(d.kind, name, d.x || 0, d.y || 0, {}, {
    platform: d.platform || platform.id,
    model: d.model || platform.label,
    osVersion: d.osVersion || platform.os,
    image: d.image || platform.image,
  });
}

function reloadFromStartupConfig(d) {
  const files = clone(d.files || {});
  const identity = {
    id: d.id,
    x: d.x,
    y: d.y,
    kind: d.kind,
    platform: d.platform,
    model: d.model,
    osVersion: d.osVersion,
    image: d.image,
    packetTracer: clone(d.packetTracer || null),
  };
  const saved = d.startupConfigState && typeof d.startupConfigState === "object"
    ? { ...clone(d.startupConfigState), ...identity, files, powered: true, startupConfig: d.startupConfig || "", startupConfigState: clone(d.startupConfigState) }
    : { ...defaultReloadDevice(d), id: d.id, x: d.x, y: d.y, files, startupConfig: d.startupConfig || "", startupConfigState: null };
  delete saved.runtime;
  delete saved.appRuntime;
  saved.arp = {};
  saved.mac = {};
  if (saved.nat?.translations) saved.nat.translations = [];
  if (saved.dhcp?.bindings) saved.dhcp.bindings = [];
  if (saved.dhcpv6?.bindings) saved.dhcpv6.bindings = [];
  return normalizeDevice(saved);
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
  return { devices: recomputeDynamicRoutes(computeWirelessAssociations(normalized), outLinks), links: outLinks };
}

function findPeer(devices, links, devId, ifaceId) {
  for (const l of links || []) {
    if (l.a === devId && l.ai === ifaceId) return { peerId: l.b, peerIface: l.bi, link: l };
    if (l.b === devId && l.bi === ifaceId) return { peerId: l.a, peerIface: l.ai, link: l };
  }
  return null;
}

function adjacentPeers(devices, links, devId, ifaceId) {
  const peers = [];
  const physical = findPeer(devices, links, devId, ifaceId);
  if (physical) peers.push(physical);
  peers.push(...wirelessPeersFor(devices, devId, ifaceId));
  return peers;
}

function chooseAdjacentPeer(devices, links, devId, ifaceId, nextHopIp, dstIp) {
  const peers = adjacentPeers(devices, links, devId, ifaceId);
  if (peers.length <= 1) return peers[0] || null;
  return peers.find((p) => {
    const d = devices[p.peerId];
    const ifc = d?.interfaces?.[p.peerIface];
    return ifc?.ip === nextHopIp || ifc?.ip === dstIp || ownsIp(d, nextHopIp) || ownsIp(d, dstIp);
  }) || peers[0];
}

function effectiveAdjacencies(devices = {}, links = []) {
  const out = [...(links || [])];
  for (const [id, d] of Object.entries(devices || {})) {
    if (!isWirelessAp(d)) continue;
    const apIface = Object.keys(d.interfaces || {}).find((name) => isWirelessIface(d, name)) || "wlan0";
    for (const a of d.wireless?.associations || []) {
      out.push({ id: `wl:${id}:${a.clientId}:${a.clientIface}`, a: id, ai: apIface, b: a.clientId, bi: a.clientIface, type: "wireless", up: true, wireless: true });
    }
  }
  return out;
}

function dot1qVlanForIface(ifaceName, ifc) {
  const enc = String(ifc?.encapsulation || "");
  const tagged = enc.match(/^dot1q\s+(\d+)$/i);
  if (tagged) return Number(tagged[1]);
  const sub = String(ifaceName || "").match(/\.(\d+)$/);
  if (sub) return Number(sub[1]);
  return null;
}

function parentIfaceForTaggedEgress(devices, links, devId, ifaceName) {
  const dev = devices?.[devId];
  const ifc = dev?.interfaces?.[ifaceName];
  if (!dev || !ifc) return ifaceName;
  if (ifc.parentIface && dev.interfaces?.[ifc.parentIface]) return ifc.parentIface;
  const sub = String(ifaceName || "").match(/^(.+)\.\d+$/);
  if (sub && dev.interfaces?.[sub[1]]) return sub[1];
  if (dot1qVlanForIface(ifaceName, ifc) == null) return ifaceName;
  const linked = Object.entries(dev.interfaces || {}).find(([name, candidate]) =>
    name !== ifaceName &&
    ifacePortInfo(dev, name).media !== "virtual" &&
    candidate.admUp !== false &&
    candidate.up &&
    findPeer(devices, links, devId, name)
  );
  if (linked) return linked[0];
  const physical = Object.keys(dev.interfaces || {}).find((name) =>
    name !== ifaceName &&
    ifacePortInfo(dev, name).media !== "virtual"
  );
  return physical || ifaceName;
}

function taggedEgress(devices, links, devId, ifaceName) {
  const dev = devices?.[devId];
  const ifc = dev?.interfaces?.[ifaceName];
  const vlan = dot1qVlanForIface(ifaceName, ifc);
  return {
    iface: vlan == null ? ifaceName : parentIfaceForTaggedEgress(devices, links, devId, ifaceName),
    vlan,
  };
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

function routeForwarding(dev, route, dstIp) {
  const viaIface = dev.interfaces?.[route?.via];
  return {
    nextHopIp: route?.via === "directly" || viaIface ? dstIp : route?.via,
    iface: viaIface ? route.via : route?.iface,
  };
}

function recalcConnectedRoutes(dev) {
  const next = {
    ...dev,
    routes: (dev.routes || []).filter((r) => r.type !== "C"),
    ipv6Routes: (dev.ipv6Routes || []).filter((r) => r.type !== "C" && r.type !== "L"),
  };
  if (!isRouterLike(next)) return next;
  if (next.ipRouting !== false) {
    for (const [iface, ifc] of Object.entries(next.interfaces || {})) {
      if (ifc.ip && ifc.mask) {
        next.routes.push({ dst: networkAddress(ifc.ip, ifc.mask), mask: ifc.mask, via: "directly", iface, type: "C" });
      }
    }
  }
  if (next.ipv6Routing !== false) {
    for (const [iface, ifc] of Object.entries(next.interfaces || {})) {
      const v6 = ifaceIpv6(ifc);
      if (v6) {
        next.ipv6Routes.push({ prefix: ipv6NetworkAddress(v6.ip, v6.prefixLength), prefixLength: v6.prefixLength, via: "directly", iface, type: "C" });
        next.ipv6Routes.push({ prefix: v6.ip, prefixLength: 128, via: "local", iface, type: "L" });
      } else if (ifc.ipv6Enabled || ifc.linkLocal) {
        next.ipv6Routes.push({ prefix: ipv6LinkLocal(ifc), prefixLength: 128, via: "local", iface, type: "L" });
      }
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

function ifaceForIpv6Via(dev, via) {
  if (dev.interfaces?.[via]) return via;
  for (const [n, ifc] of Object.entries(dev.interfaces || {})) {
    const v6 = ifaceIpv6(ifc);
    if (v6 && sameIpv6Subnet(v6.ip, via, v6.prefixLength)) return n;
    if ((ifc.ipv6Enabled || ifc.linkLocal) && String(via || "").toLowerCase().startsWith("fe80:")) return n;
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

function dynamicIpv6EnabledOn(dev, proto, ifaceName, ifc) {
  if (!isRouterLike(dev) || dev.ipv6Routing === false) return false;
  const v6 = ifaceIpv6(ifc);
  if (!v6) return false;
  const db = proto === "O6" ? Object.values(dev.ospfv3 || {})[0]
           : proto === "D6" ? Object.values(dev.eigrpIpv6 || {})[0]
           : null;
  if (!db || db.passive?.includes?.(ifaceName)) return false;
  if (db.interfaces?.length) return db.interfaces.includes(ifaceName);
  return (db.networks || []).some((n) => ipv6InPrefix(v6.ip, n.prefix, n.prefixLength || 64));
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
  next = Object.fromEntries(Object.entries(next).map(([id, d]) => [id, recalcConnectedRoutes({ ...d, ipv6Routes: (d.ipv6Routes || []).filter((r) => !["O6", "D6"].includes(r.type)) })]));
  for (const proto of ["O6", "D6"]) {
    for (const aId of routerIds) {
      const a = next[aId];
      for (const [aIfName, aIf] of Object.entries(a.interfaces || {})) {
        const aV6 = ifaceIpv6(aIf);
        if (!aV6 || !ifaceIpv6Up(aIfName, aIf) || !dynamicIpv6EnabledOn(a, proto, aIfName, aIf)) continue;
        const peer = findPeer(next, links, aId, aIfName);
        const b = next[peer?.peerId];
        const bIf = b?.interfaces?.[peer?.peerIface];
        const bV6 = ifaceIpv6(bIf);
        if (!b || !bV6 || !ifaceIpv6Up(peer.peerIface, bIf) || !dynamicIpv6EnabledOn(b, proto, peer.peerIface, bIf)) continue;
        if (!sameIpv6Subnet(aV6.ip, bV6.ip, aV6.prefixLength)) continue;
        const learned = (b.ipv6Routes || []).filter((r) => r.type === "C" || r.type === proto);
        for (const r of learned) {
          if (ipv6InPrefix(aV6.ip, r.prefix, r.prefixLength)) continue;
          if ((a.ipv6Routes || []).some((x) => x.prefix === r.prefix && x.prefixLength === r.prefixLength)) continue;
          a.ipv6Routes.push({ prefix: r.prefix, prefixLength: r.prefixLength, via: bV6.ip, iface: aIfName, type: proto });
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

function validateTopology(devices = {}, links = []) {
  const issues = [];
  const byIp = new Map();
  const short = shortIfaceName;
  const label = (d) => d?.hostname || d?.name || d?.id || "device";
  const ifaceLabel = (d, iface) => `${label(d)} ${short(iface)}`.trim();
  const add = (issue) => {
    issues.push({
      severity: "warn",
      category: "ip",
      commands: [],
      ...issue,
      id: issue.id || `validation-${issues.length + 1}`,
    });
  };
  const validIpv4 = (ip) => {
    const parts = String(ip || "").split(".");
    return parts.length === 4 && parts.every((part) => /^\d+$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
  };
  const validMask = (mask) => {
    if (!validIpv4(mask)) return false;
    const n = ipToInt(mask);
    if (n === 0 || n === 0xffffffff) return false;
    const inv = (~n) >>> 0;
    return ((inv + 1) & inv) === 0;
  };
  const vlanList = (value) => {
    if (value == null || String(value).trim().toLowerCase() === "all") return null;
    const out = new Set();
    for (const raw of String(value).split(",")) {
      const [startRaw, endRaw] = raw.trim().split("-");
      const start = Number(startRaw);
      const end = endRaw == null ? start : Number(endRaw);
      if (!Number.isInteger(start) || !Number.isInteger(end)) continue;
      for (let v = Math.max(1, start); v <= Math.min(4094, end); v++) out.add(v);
    }
    return out;
  };
  const vlanOverlap = (a, b) => {
    const av = vlanList(a?.allowedVlans);
    const bv = vlanList(b?.allowedVlans);
    if (!av || !bv) return true;
    for (const v of av) if (bv.has(v)) return true;
    return false;
  };
  const gatewayCandidatesForAccessVlan = (switchId, vlan, hostIp, hostMask) => {
    const candidates = [];
    for (const [devId, dev] of Object.entries(devices || {})) {
      if (!isRouterLike(dev)) continue;
      for (const [iface, ifc] of Object.entries(dev.interfaces || {})) {
        if (!ifc?.ip || !validMask(ifc.mask || hostMask) || !sameSubnet(ifc.ip, hostIp, hostMask)) continue;
        const tagged = dot1qVlanForIface(iface, ifc);
        const isSvi = new RegExp(`^vlan\\s*${vlan}$`, "i").test(iface);
        const peer = findPeer(devices, links, devId, iface);
        const peerDev = devices?.[peer?.peerId];
        const peerIf = peerDev?.interfaces?.[peer?.peerIface];
        const sameAccessVlan = peerDev?.id === switchId && vlanOnIngress(peerIf) === vlan;
        if (isSvi || tagged === vlan || sameAccessVlan) candidates.push({ dev, devId, iface, ifc });
      }
    }
    return candidates;
  };

  for (const [devId, dev] of Object.entries(devices || {})) {
    for (const [iface, ifc] of Object.entries(dev.interfaces || {})) {
      const ip = String(ifc?.ip || "").trim();
      const mask = String(ifc?.mask || "").trim();
      if (ip && ip !== "0.0.0.0") {
        if (validIpv4(ip)) {
          if (!byIp.has(ip)) byIp.set(ip, []);
          byIp.get(ip).push({ devId, dev, iface });
        }
        if (!validMask(mask)) {
          add({
            id: `mask:${devId}:${iface}`,
            severity: "err",
            category: "mask",
            title: `Bad mask on ${ifaceLabel(dev, iface)}`,
            detail: mask ? `${mask} is not a usable contiguous IPv4 subnet mask.` : "An IPv4 address is configured without a subnet mask.",
            deviceId: devId,
            iface,
            commands: [`interface ${iface}`, `ip address ${ip} 255.255.255.0`],
          });
        }
      }
      if (isSwitchLike(dev) && !/^vlan/i.test(iface) && ifc?.mode === "access") {
        const vlan = ifc.vlan ?? 1;
        if (dev.vlans && !Object.prototype.hasOwnProperty.call(dev.vlans, vlan)) {
          add({
            id: `vlan-db:${devId}:${iface}:${vlan}`,
            severity: "warn",
            category: "vlan",
            title: `VLAN ${vlan} missing on ${label(dev)}`,
            detail: `${short(iface)} is an access port for VLAN ${vlan}, but that VLAN is not in the VLAN database.`,
            deviceId: devId,
            iface,
            commands: [`vlan ${vlan}`, `interface ${iface}`, `switchport access vlan ${vlan}`],
          });
        }
      }
    }
  }

  for (const [ip, entries] of byIp.entries()) {
    if (entries.length < 2) continue;
    for (const entry of entries) {
      add({
        id: `duplicate-ip:${ip}:${entry.devId}:${entry.iface}`,
        severity: "err",
        category: "ip",
        title: `Duplicate IP ${ip}`,
        detail: `${ip} is also configured on ${entries.filter((e) => e !== entry).map((e) => ifaceLabel(e.dev, e.iface)).join(", ")}.`,
        deviceId: entry.devId,
        iface: entry.iface,
        commands: [`interface ${entry.iface}`, "ip address <unique-ip> <mask>"],
      });
    }
  }

  for (const [devId, dev] of Object.entries(devices || {})) {
    if (!isHostLike(dev)) continue;
    const hostIface = dev.interfaces?.eth0 ? "eth0" : (dev.interfaces?.en0 ? "en0" : Object.keys(dev.interfaces || {})[0]);
    const ifc = dev.interfaces?.[hostIface];
    if (!ifc?.ip || !validIpv4(ifc.ip) || !validMask(ifc.mask)) continue;
    const gw = String(ifc.gw || "").trim();
    if (!gw || gw === "0.0.0.0") {
      add({
        id: `gateway-missing:${devId}:${hostIface}`,
        severity: "warn",
        category: "gateway",
        title: `Missing gateway on ${label(dev)}`,
        detail: `${short(hostIface)} has ${ifc.ip}/${maskBits(ifc.mask)} but no default gateway.`,
        deviceId: devId,
        iface: hostIface,
        commands: ["ip default-gateway <gateway-ip>"],
      });
      continue;
    }
    if (!validIpv4(gw)) {
      add({
        id: `gateway-invalid:${devId}:${hostIface}`,
        severity: "err",
        category: "gateway",
        title: `Invalid gateway on ${label(dev)}`,
        detail: `${gw} is not a valid IPv4 default gateway.`,
        deviceId: devId,
        iface: hostIface,
        commands: ["ip default-gateway <gateway-ip>"],
      });
      continue;
    }
    if (!sameSubnet(ifc.ip, gw, ifc.mask)) {
      add({
        id: `gateway-subnet:${devId}:${hostIface}`,
        severity: "err",
        category: "gateway",
        title: `Gateway outside subnet on ${label(dev)}`,
        detail: `${gw} is outside ${networkAddress(ifc.ip, ifc.mask)}/${maskBits(ifc.mask)}.`,
        deviceId: devId,
        iface: hostIface,
        commands: [`ip default-gateway <gateway-ip-in-${networkAddress(ifc.ip, ifc.mask)}/${maskBits(ifc.mask)}>`],
      });
      continue;
    }
    const gatewayIfaces = Object.values(devices || {}).flatMap((candidate) => (
      isRouterLike(candidate)
        ? Object.values(candidate.interfaces || {}).filter((candidateIfc) => candidateIfc?.ip === gw)
        : []
    ));
    if (!gatewayIfaces.length) {
      const subnetRouter = Object.values(devices || {}).some((candidate) => (
        isRouterLike(candidate) &&
        Object.values(candidate.interfaces || {}).some((candidateIfc) => candidateIfc?.ip && validMask(candidateIfc.mask || ifc.mask) && sameSubnet(candidateIfc.ip, ifc.ip, ifc.mask))
      ));
      add({
        id: `gateway-candidate:${devId}:${hostIface}`,
        severity: subnetRouter ? "info" : "warn",
        category: "gateway",
        title: `Gateway not found for ${label(dev)}`,
        detail: subnetRouter
          ? `No routed interface is configured with ${gw}; another router interface exists in this subnet.`
          : `No router or SVI candidate was found in ${networkAddress(ifc.ip, ifc.mask)}/${maskBits(ifc.mask)}.`,
        deviceId: devId,
        iface: hostIface,
        commands: ["ip default-gateway <routed-interface-ip>"],
      });
    }
  }

  for (const link of links || []) {
    const a = devices?.[link.a];
    const b = devices?.[link.b];
    const aIf = a?.interfaces?.[link.ai];
    const bIf = b?.interfaces?.[link.bi];
    if (!a || !b || !aIf || !bIf) continue;
    const linkName = `${ifaceLabel(a, link.ai)} to ${ifaceLabel(b, link.bi)}`;

    if (link.up === false) {
      add({
        id: `port-link-down:${link.id}`,
        severity: "warn",
        category: "port",
        title: "Cable is down",
        detail: `${linkName} is marked down.`,
        linkId: link.id,
      });
    }
    for (const side of [{ devId: link.a, dev: a, iface: link.ai, ifc: aIf }, { devId: link.b, dev: b, iface: link.bi, ifc: bIf }]) {
      const reason = side.dev.powered === false ? "device is powered off"
        : side.ifc.admUp === false ? "interface is administratively down"
        : side.ifc.up === false ? "interface is down"
        : null;
      if (!reason) continue;
      add({
        id: `port-down:${link.id}:${side.devId}:${side.iface}:${reason}`,
        severity: side.ifc.admUp === false ? "err" : "warn",
        category: "port",
        title: `Down port on ${ifaceLabel(side.dev, side.iface)}`,
        detail: `${linkName}: ${reason}.`,
        deviceId: side.devId,
        iface: side.iface,
        linkId: link.id,
        commands: side.ifc.admUp === false ? [`interface ${side.iface}`, "no shutdown"] : [],
      });
    }

    const media = cableCompatibility(a, link.ai, b, link.bi, link.type || "auto");
    if (!media.ok || media.warning) {
      add({
        id: `media:${link.id}`,
        severity: media.ok ? "warn" : "err",
        category: "media",
        title: media.ok ? "Cable type looks unusual" : "Wrong cable or media",
        detail: media.reason || media.warning,
        deviceId: link.a,
        iface: link.ai,
        peerDeviceId: link.b,
        linkId: link.id,
      });
    }

    if (isSwitchLike(a) && isSwitchLike(b)) {
      const aMode = aIf.mode || "access";
      const bMode = bIf.mode || "access";
      if (aMode === "access" && bMode === "access" && String(aIf.vlan ?? 1) !== String(bIf.vlan ?? 1)) {
        add({
          id: `vlan-mismatch:${link.id}`,
          severity: "err",
          category: "vlan",
          title: "Access VLAN mismatch",
          detail: `${ifaceLabel(a, link.ai)} is VLAN ${aIf.vlan ?? 1}, but ${ifaceLabel(b, link.bi)} is VLAN ${bIf.vlan ?? 1}.`,
          deviceId: link.a,
          iface: link.ai,
          peerDeviceId: link.b,
          linkId: link.id,
          commands: [`interface ${link.ai}`, `switchport access vlan ${bIf.vlan ?? 1}`],
        });
      }
      if (aMode === "trunk" || bMode === "trunk") {
        if (aMode !== "trunk" || bMode !== "trunk") {
          const accessSide = aMode === "trunk" ? { devId: link.b, iface: link.bi } : { devId: link.a, iface: link.ai };
          add({
            id: `trunk-mode:${link.id}`,
            severity: "err",
            category: "trunk",
            title: "Trunk mode mismatch",
            detail: `${linkName} has trunking enabled on only one side.`,
            deviceId: accessSide.devId,
            iface: accessSide.iface,
            linkId: link.id,
            commands: [`interface ${accessSide.iface}`, "switchport mode trunk"],
          });
        } else {
          if (String(aIf.nativeVlan ?? 1) !== String(bIf.nativeVlan ?? 1)) {
            add({
              id: `trunk-native:${link.id}`,
              severity: "warn",
              category: "trunk",
              title: "Native VLAN mismatch",
              detail: `${ifaceLabel(a, link.ai)} native VLAN ${aIf.nativeVlan ?? 1} differs from ${ifaceLabel(b, link.bi)} native VLAN ${bIf.nativeVlan ?? 1}.`,
              deviceId: link.a,
              iface: link.ai,
              peerDeviceId: link.b,
              linkId: link.id,
              commands: [`interface ${link.ai}`, `switchport trunk native vlan ${bIf.nativeVlan ?? 1}`],
            });
          }
          if (!vlanOverlap(aIf, bIf)) {
            add({
              id: `trunk-allowed:${link.id}`,
              severity: "err",
              category: "trunk",
              title: "Allowed VLANs do not overlap",
              detail: `${ifaceLabel(a, link.ai)} allows ${aIf.allowedVlans || "all"}, but ${ifaceLabel(b, link.bi)} allows ${bIf.allowedVlans || "all"}.`,
              deviceId: link.a,
              iface: link.ai,
              peerDeviceId: link.b,
              linkId: link.id,
              commands: [`interface ${link.ai}`, `switchport trunk allowed vlan ${bIf.allowedVlans || "all"}`],
            });
          }
        }
      }
    }

    for (const side of [{ sw: a, swId: link.a, swIface: link.ai, swIf: aIf, host: b, hostId: link.b, hostIface: link.bi, hostIf: bIf },
                        { sw: b, swId: link.b, swIface: link.bi, swIf: bIf, host: a, hostId: link.a, hostIface: link.ai, hostIf: aIf }]) {
      if (!isSwitchLike(side.sw) || !isHostLike(side.host) || (side.swIf.mode || "access") !== "access") continue;
      if (!side.hostIf?.ip || !validMask(side.hostIf.mask)) continue;
      const vlan = side.swIf.vlan ?? 1;
      const candidates = gatewayCandidatesForAccessVlan(side.swId, vlan, side.hostIf.ip, side.hostIf.mask);
      if (!candidates.length) continue;
      const matchingGw = side.hostIf.gw && candidates.some((candidate) => candidate.ifc.ip === side.hostIf.gw);
      if (!matchingGw) {
        add({
          id: `vlan-host-gateway:${link.id}:${side.hostId}`,
          severity: "warn",
          category: "vlan",
          title: `Host gateway does not match VLAN ${vlan}`,
          detail: `${label(side.host)} is on access VLAN ${vlan}, but its gateway ${side.hostIf.gw || "is missing"} does not match ${candidates.map((candidate) => ifaceLabel(candidate.dev, candidate.iface)).join(", ")}.`,
          deviceId: side.hostId,
          iface: side.hostIface,
          peerDeviceId: side.swId,
          linkId: link.id,
          commands: [`ip default-gateway ${candidates[0].ifc.ip}`],
        });
      }
    }
  }

  return issues;
}

function emptyTraceArtifacts() {
  return { aclHits: [], natTranslations: [], dhcpLease: null, dnsLookup: null, drop: null };
}

function aclPermit(dev, aclName, srcIp, dstIp) {
  const acl = dev.acls?.[aclName];
  if (!acl) return { ok: true, note: `ACL ${aclName} not found`, hit: { aclName, action: "permit", missing: true, note: `ACL ${aclName} not found` } };
  for (let idx = 0; idx < (acl.entries || []).length; idx++) {
    const e = acl.entries[idx];
    if (e.action === "remark") continue;
    const srcOk = !e.src || e.src === "any" || inNet(srcIp, e.src, wildcardToMask(e.srcWildcard || "0.0.0.0"));
    const dstOk = acl.type === "standard" || !e.dst || e.dst === "any" || inNet(dstIp, e.dst, wildcardToMask(e.dstWildcard || "0.0.0.0"));
    if (srcOk && dstOk) {
      return {
        ok: e.action === "permit",
        note: `${aclName} ${e.action}`,
        hit: {
          aclName,
          aclType: acl.type,
          index: idx,
          sequence: (idx + 1) * 10,
          action: e.action,
          spec: e.spec || `${e.src || "any"}${e.dst ? ` ${e.dst}` : ""}`,
          source: srcIp,
          destination: dstIp,
          implicit: false,
        },
      };
    }
  }
  return {
    ok: false,
    note: `${aclName} implicit deny`,
    hit: { aclName, aclType: acl.type, action: "deny", source: srcIp, destination: dstIp, implicit: true, spec: "implicit deny ip any any" },
  };
}

function interfaceAclCheck(dev, ifaceName, direction, srcIp, dstIp) {
  const ifc = dev.interfaces?.[ifaceName];
  const aclName = ifc?.acl?.[direction];
  if (!aclName) return { ok: true };
  const result = aclPermit(dev, aclName, srcIp, dstIp);
  return {
    ...result,
    hit: result.hit ? { ...result.hit, deviceId: dev.id, device: dev.hostname, iface: ifaceName, direction } : null,
  };
}

function ownsIp(dev, ip) {
  for (const [n, ifc] of Object.entries(dev.interfaces || {})) {
    if (ifc.ip === ip) return n;
  }
  return null;
}

function hostIp(dev) {
  const usable = Object.entries(dev.interfaces || {}).filter(([, ifc]) => ifc.ip && ifc.mask && ifc.admUp !== false && ifc.up);
  const preferred = usable.find(([name]) => name === "eth0" || name === "en0") || usable.find(([name]) => isWirelessIface(dev, name)) || usable[0];
  if (preferred) return { ip: preferred[1].ip, iface: preferred[0], mask: preferred[1].mask };
  const eth = dev.interfaces?.eth0;
  if (eth?.ip) return { ip: eth.ip, iface: "eth0", mask: eth.mask };
  const en = dev.interfaces?.en0;
  if (en?.ip) return { ip: en.ip, iface: "en0", mask: en.mask };
  const wl = Object.entries(dev.interfaces || {}).find(([name, ifc]) => isWirelessIface(dev, name) && ifc.ip);
  if (wl) return { ip: wl[1].ip, iface: wl[0], mask: wl[1].mask };
  for (const [n, ifc] of Object.entries(dev.interfaces || {})) {
    if (ifc.ip && (ifc.up || (ifc.admUp !== false && dot1qVlanForIface(n, ifc) != null))) {
      return { ip: ifc.ip, iface: n, mask: ifc.mask };
    }
  }
  return null;
}

function hostIpv6(dev) {
  const preferred = [dev.interfaces?.eth0 && ["eth0", dev.interfaces.eth0], dev.interfaces?.en0 && ["en0", dev.interfaces.en0], ...Object.entries(dev.interfaces || {})].filter(Boolean);
  for (const [name, ifc] of preferred) {
    const v6 = ifaceIpv6(ifc);
    if (v6 && ifaceIpv6Up(name, ifc)) return { ...v6, iface: name };
  }
  for (const [name, ifc] of preferred) {
    if ((ifc.ipv6Enabled || ifc.linkLocal) && ifaceIpv6Up(name, ifc)) return { ip: ipv6LinkLocal(ifc), prefixLength: 64, iface: name, linkLocal: true };
  }
  return null;
}

function ownsIpv6(dev, ip) {
  const target = normalizeIpv6(ip);
  if (!target) return null;
  for (const [n, ifc] of Object.entries(dev.interfaces || {})) {
    const v6 = ifaceIpv6(ifc);
    if (v6?.ip === target) return n;
    if ((ifc.ipv6Enabled || ifc.linkLocal || v6) && ipv6LinkLocal(ifc) === target) return n;
  }
  return null;
}

function ifaceForIpv6Dest(dev, dstIp) {
  for (const [name, ifc] of Object.entries(dev.interfaces || {})) {
    const v6 = ifaceIpv6(ifc);
    if (v6 && ipv6InPrefix(dstIp, v6.ip, v6.prefixLength)) return { name, ifc, ...v6 };
  }
  return null;
}

function lookupIpv6Route(dev, dstIp) {
  let best = null, bestBits = -1;
  for (const r of dev.ipv6Routes || []) {
    if (ipv6InPrefix(dstIp, r.prefix, r.prefixLength)) {
      const b = Number(r.prefixLength || 0);
      if (b > bestBits) { best = r; bestBits = b; }
    }
  }
  return best;
}

function routeIpv6Forwarding(dev, route, dstIp) {
  const viaIface = dev.interfaces?.[route?.via];
  return {
    nextHopIp: route?.via === "directly" || route?.via === "local" || viaIface ? dstIp : route?.via,
    iface: viaIface ? route.via : route?.iface,
  };
}

function planPath(devices, links, srcId, dstIp, opts = {}) {
  const family = opts.family || (isIpv6(dstIp) ? "ipv6" : "ipv4");
  if (family === "ipv6") return planIpv6Path(devices, links, srcId, dstIp);
  if (!opts.legacy && window.OPT_ProtocolRuntime?.simulate) {
    const sim = window.OPT_ProtocolRuntime.simulate(devices, links, { type: "icmpEcho", srcId, dstIp }, opts.runtime || {});
    return window.OPT_ProtocolRuntime.toLegacyPlan(sim);
  }
  devices = computeWirelessAssociations(devices);
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
    const fwd = routeForwarding(src, route, dstIp);
    nextHopIp = fwd.nextHopIp; egressIface = fwd.iface;
    hops.push({ devId: srcId, action: "route", iface: egressIface, note: `route ${route.dst}/${maskBits(route.mask)} ${route.type} via ${route.via}` });
  } else {
    const e = src.interfaces?.[origin.iface];
    if (!e.gw) return { ok: false, error: `${src.hostname}: destination off-net and no default gateway configured`, hops };
    nextHopIp = e.gw; egressIface = origin.iface;
    hops.push({ devId: srcId, action: "arp-gw", iface: egressIface, note: `${dstIp} off-net; gateway ${nextHopIp}` });
  }

  let curDev = src, curIface = egressIface, ingressIface = null, vlan = null;
  let guard = 0;
  while (guard++ < 48) {
    const outCheck = interfaceAclCheck(curDev, curIface, "out", srcIp, dstIp);
    if (!outCheck.ok) return { ok: false, error: `${curDev.hostname} ${curIface}: ${outCheck.note}`, hops: [...hops, { devId: curDev.id, action: "drop", note: outCheck.note, ok: false }] };
    const egress = taggedEgress(devices, links, curDev.id, curIface);
    const outIface = egress.iface || curIface;
    const outVlan = egress.vlan ?? vlan;
    const logicalIf = curDev.interfaces?.[curIface];
    const physicalIf = curDev.interfaces?.[outIface];
    if (!physicalIf || physicalIf.admUp === false || !physicalIf.up || logicalIf?.admUp === false) {
      if (isWirelessIface(curDev, outIface)) return { ok: false, error: wirelessFailureReason(curDev, outIface), hops };
      return { ok: false, error: `${curDev.hostname} ${curIface} is down`, hops };
    }
    const peer = chooseAdjacentPeer(devices, links, curDev.id, outIface, nextHopIp, dstIp);
    if (!peer) {
      const reason = isWirelessIface(curDev, outIface) ? wirelessFailureReason(curDev, outIface) : `No link connected to ${curDev.hostname} ${curIface}`;
      return { ok: false, error: reason, hops };
    }
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

    if (nb.kind === "ap") {
      const inIf = nb.interfaces[ingressIface];
      const assoc = (nb.wireless?.associations || []).find((a) => a.clientId === curDev.id || a.clientIface === ingressIface);
      vlan = assoc?.vlan || inIf?.vlan || outVlan || vlan || 1;
      const candidates = [];
      for (const [pname, pifc] of Object.entries(nb.interfaces || {})) {
        if (pname === ingressIface) continue;
        if (!pifc.up || pifc.admUp === false) continue;
        for (const next of adjacentPeers(devices, links, nb.id, pname)) {
          const nd = devices[next.peerId], nif = nd?.interfaces?.[next.peerIface];
          if (!nd || !nif || !nd.powered || !nif.up || nif.admUp === false) continue;
          candidates.push({ pname, next, nd, nif });
        }
      }
      let chosen = candidates.find((c) => c.nif.ip === nextHopIp || c.nif.ip === dstIp || ownsIp(c.nd, nextHopIp) || ownsIp(c.nd, dstIp));
      if (!chosen) chosen = candidates.find((c) => !isWirelessIface(nb, c.pname));
      if (!chosen) return { ok: false, error: `${nb.hostname}: no wireless bridge path toward ${dstIp}`, hops };
      hops.push({ devId: nb.id, action: "bridge", iface: chosen.pname, note: `SSID bridge VLAN ${vlan} egress ${chosen.pname}` });
      curDev = nb; curIface = chosen.pname;
      continue;
    }

    if (isSwitchLike(nb) && !nb.interfaces[ingressIface]?.routed) {
      const inIf = nb.interfaces[ingressIface];
      vlan = outVlan ?? vlan ?? vlanOnIngress(inIf);
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
        for (const next of adjacentPeers(devices, links, nb.id, pname)) {
          const nd = devices[next.peerId], nif = nd?.interfaces?.[next.peerIface];
          if (!nd || !nif) continue;
          candidates.push({ pname, next, nd, nif });
        }
      }
      chosen = candidates.find((c) => c.nif.ip === nextHopIp || c.nif.ip === dstIp || ownsIp(c.nd, nextHopIp) || ownsIp(c.nd, dstIp));
      if (!chosen) chosen = candidates.find((c) => c.nd.kind === "ap" && (c.nd.wireless?.associations || []).some((a) => ownsIp(devices[a.clientId], dstIp) || ownsIp(devices[a.clientId], nextHopIp)));
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
      const fwd = routeForwarding(nb, route, dstIp);
      nextHopIp = fwd.nextHopIp;
      if (nb.interfaces[ingressIface]?.natRole === "inside" && nb.interfaces[route.iface]?.natRole === "outside") {
        hops.push({ devId: nb.id, action: "nat", iface: route.iface, note: `PAT source ${srcIp} to ${nb.interfaces[route.iface].ip || "outside interface"}` });
      }
      hops.push({ devId: nb.id, action: "route", iface: fwd.iface, note: `route ${route.dst}/${maskBits(route.mask)} ${route.type} via ${route.via}` });
      curDev = nb; curIface = fwd.iface; vlan = dot1qVlanForIface(fwd.iface, nb.interfaces?.[fwd.iface]);
      continue;
    }
    return { ok: false, error: `Unsupported hop at ${nb.hostname}`, hops };
  }
  return { ok: false, error: "Hop limit exceeded", hops };
}

function planIpv6Path(devices, links, srcId, targetIp) {
  const dstIp = normalizeIpv6(targetIp);
  const src = devices[srcId];
  if (!src) return { ok: false, error: "Source device not found", hops: [], family: "ipv6" };
  if (!dstIp) return { ok: false, error: `Invalid IPv6 destination ${targetIp}`, hops: [], family: "ipv6" };
  if (!src.powered) return { ok: false, error: `${src.hostname} is powered off`, hops: [], family: "ipv6" };
  if (src.kind === "l2switch") return { ok: false, error: `${src.hostname} is a layer-2 switch - no routed management SVI is configured`, hops: [], family: "ipv6" };

  const origin = hostIpv6(src);
  if (!origin) return { ok: false, error: `${src.hostname} has no IPv6 configured on an up interface`, hops: [], family: "ipv6" };
  const srcIp = origin.ip;
  const hops = [{ devId: srcId, action: "originate", note: `${src.hostname} crafts ICMPv6 echo ${srcIp} -> ${dstIp}` }];

  let nextHopIp = null, egressIface = null;
  const local = ifaceForIpv6Dest(src, dstIp);
  if (local) {
    nextHopIp = dstIp; egressIface = local.name;
    hops.push({ devId: srcId, action: "nd-local", iface: egressIface, note: `${dstIp} is local on ${egressIface}` });
  } else if (isRouterLike(src)) {
    if (src.ipv6Routing === false) return { ok: false, error: `${src.hostname}: IPv6 unicast routing is disabled`, hops, family: "ipv6" };
    const route = lookupIpv6Route(src, dstIp);
    if (!route) return { ok: false, error: `${src.hostname}: no IPv6 route to ${dstIp}`, hops, family: "ipv6" };
    const fwd = routeIpv6Forwarding(src, route, dstIp);
    nextHopIp = fwd.nextHopIp; egressIface = fwd.iface;
    hops.push({ devId: srcId, action: "route", iface: egressIface, note: `IPv6 route ${route.prefix}/${route.prefixLength} ${route.type} via ${route.via}` });
  } else {
    const e = src.interfaces?.[origin.iface];
    if (!e?.ipv6Gw) return { ok: false, error: `${src.hostname}: destination off-link and no IPv6 default gateway configured`, hops, family: "ipv6" };
    nextHopIp = normalizeIpv6(e.ipv6Gw) || e.ipv6Gw; egressIface = origin.iface;
    hops.push({ devId: srcId, action: "nd-gw", iface: egressIface, note: `${dstIp} off-link; IPv6 gateway ${nextHopIp}` });
  }

  let curDev = src, curIface = egressIface, ingressIface = null, vlan = null;
  let guard = 0;
  while (guard++ < 48) {
    const egress = taggedEgress(devices, links, curDev.id, curIface);
    const outIface = egress.iface || curIface;
    const outVlan = egress.vlan ?? vlan;
    const logicalIf = curDev.interfaces?.[curIface];
    const physicalIf = curDev.interfaces?.[outIface];
    if (!physicalIf || physicalIf.admUp === false || !physicalIf.up || logicalIf?.admUp === false) {
      return { ok: false, error: `${curDev.hostname} ${curIface} is down`, hops, family: "ipv6" };
    }
    const peer = findPeer(devices, links, curDev.id, outIface);
    if (!peer) return { ok: false, error: `No link connected to ${curDev.hostname} ${curIface}`, hops, family: "ipv6" };
    if (!peer.link.up) return { ok: false, error: `Link ${curDev.hostname} ${curIface} is down`, hops, family: "ipv6" };
    const nb = devices[peer.peerId], nbIf = nb?.interfaces?.[peer.peerIface];
    if (!nb || !nb.powered || !nbIf?.up || nbIf.admUp === false) return { ok: false, error: `Neighbor on ${curDev.hostname} ${curIface} is unreachable`, hops, family: "ipv6" };
    ingressIface = peer.peerIface;
    hops.push({ devId: nb.id, action: "ingress", iface: ingressIface, note: `arrives at ${nb.hostname} ${ingressIface}` });

    const owned = ownsIpv6(nb, dstIp);
    if (owned) {
      hops.push({ devId: nb.id, action: "deliver", iface: owned, note: `delivered to ${nb.hostname} ${owned}`, ok: true });
      hops.push({ devId: nb.id, action: "reply", note: `${nb.hostname} sends ICMPv6 echo-reply`, ok: true });
      return { ok: true, hops, family: "ipv6" };
    }

    if (isSwitchLike(nb) && !nb.interfaces[ingressIface]?.routed) {
      const inIf = nb.interfaces[ingressIface];
      vlan = outVlan ?? vlan ?? vlanOnIngress(inIf);
      if (!nb.vlans?.[vlan]) return { ok: false, error: `${nb.hostname}: VLAN ${vlan} does not exist`, hops, family: "ipv6" };
      if (!vlanAllows(inIf, vlan)) return { ok: false, error: `${nb.hostname} ${ingressIface}: VLAN ${vlan} not allowed`, hops, family: "ipv6" };
      if (inIf.stp?.state === "blocking") return { ok: false, error: `${nb.hostname} ${ingressIface}: STP blocking`, hops, family: "ipv6" };
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
      let chosen = candidates.find((c) => ownsIpv6(c.nd, nextHopIp) || ownsIpv6(c.nd, dstIp));
      if (!chosen) chosen = candidates.find((c) => isRouterLike(c.nd));
      if (!chosen) chosen = candidates.find((c) => isHostLike(c.nd) && ifaceIpv6(c.nif) && ipv6InPrefix(dstIp, ifaceIpv6(c.nif).ip, ifaceIpv6(c.nif).prefixLength));
      if (!chosen) return { ok: false, error: `${nb.hostname}: no IPv6 forwarding path in VLAN ${vlan} toward ${dstIp}`, hops, family: "ipv6" };
      hops.push({ devId: nb.id, action: "switch", iface: chosen.pname, note: `VLAN ${vlan} egress ${chosen.pname}` });
      curDev = nb; curIface = chosen.pname;
      continue;
    }

    if (isRouterLike(nb)) {
      if (nb.ipv6Routing === false) return { ok: false, error: `${nb.hostname}: IPv6 unicast routing is disabled`, hops: [...hops, { devId: nb.id, action: "drop", note: "IPv6 unicast routing disabled", ok: false }], family: "ipv6" };
      const route = lookupIpv6Route(nb, dstIp);
      if (!route) return { ok: false, error: `${nb.hostname}: no IPv6 route to host ${dstIp}`, hops: [...hops, { devId: nb.id, action: "drop", note: "no IPv6 route", ok: false }], family: "ipv6" };
      const fwd = routeIpv6Forwarding(nb, route, dstIp);
      nextHopIp = fwd.nextHopIp;
      hops.push({ devId: nb.id, action: "route", iface: fwd.iface, note: `IPv6 route ${route.prefix}/${route.prefixLength} ${route.type} via ${route.via}` });
      curDev = nb; curIface = fwd.iface; vlan = dot1qVlanForIface(fwd.iface, nb.interfaces?.[fwd.iface]);
      continue;
    }
    return { ok: false, error: `Unsupported IPv6 hop at ${nb.hostname}`, hops, family: "ipv6" };
  }
  return { ok: false, error: "IPv6 hop limit exceeded", hops, family: "ipv6" };
}

function allocateDhcp(devices, links, clientId) {
  devices = computeWirelessAssociations(devices);
  const client = devices[clientId];
  const entries = Object.entries(client?.interfaces || {});
  const wanted = entries.find(([, ifc]) => ifc.dhcp && ifc.admUp !== false);
  const wireless = entries.find(([name, ifc]) => isWirelessIface(client, name) && ifc.ssid && ifc.admUp !== false);
  const wired = entries.find(([name]) => name === "eth0") || entries.find(([name]) => name === "en0");
  const clientIfaceName = (wanted || wireless || wired || entries[0] || [null])[0];
  if (!clientIfaceName) return { devices, message: "No host interface" };
  const peer = chooseAdjacentPeer(devices, links, clientId, clientIfaceName, null, null);
  if (!peer) {
    const reason = isWirelessIface(client, clientIfaceName) ? wirelessFailureReason(client, clientIfaceName) : "No DHCP server reachable";
    return { devices, message: reason };
  }
  let vlan = 1, gatewayIp = null, server = null, poolName = null;
  const firstHop = devices[peer.peerId];
  if (isSwitchLike(firstHop)) vlan = vlanOnIngress(firstHop.interfaces?.[peer.peerIface]);
  if (firstHop?.kind === "ap") {
    const assoc = (firstHop.wireless?.associations || []).find((a) => a.clientId === clientId && a.clientIface === clientIfaceName);
    vlan = assoc?.vlan || vlan;
  }
  const walk = [peer.peerId];
  const seen = new Set();
  while (walk.length && !server) {
    const id = walk.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    const d = devices[id];
    if (!d) continue;
    if (isSwitchLike(d) || d.kind === "ap") {
      for (const [ifaceName, ifc] of Object.entries(d.interfaces || {})) {
        if (!ifc?.up || ifc.admUp === false) continue;
        if (isSwitchLike(d) && !vlanAllows(ifc, vlan)) continue;
        for (const next of adjacentPeers(devices, links, id, ifaceName)) {
          walk.push(next.peerId);
        }
      }
    }
    for (const [name, ifc] of Object.entries(d.interfaces || {})) {
      const taggedVlan = dot1qVlanForIface(name, ifc);
      const ifaceUsable = ifc.ip && (ifc.up || (ifc.admUp !== false && taggedVlan != null));
      if (ifaceUsable && (taggedVlan == null || String(taggedVlan) === String(vlan))) {
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
  const broadcast = (base | (~ipToInt(pool.mask) >>> 0)) >>> 0;
  for (let n = base + 10; n < broadcast; n++) {
    const ip = intToIp(n);
    if (!used.has(ip) && !isExcluded(ip) && ip !== gatewayIp) { offered = ip; break; }
  }
  if (!offered) return { devices, message: `DHCP pool ${poolName} has no free addresses` };
  const next = clone(devices);
  next[clientId].interfaces[clientIfaceName] = { ...next[clientId].interfaces[clientIfaceName], ip: offered, mask: pool.mask, gw: gatewayIp, dhcp: true };
  next[server.id].dhcp.bindings.push({ ip: offered, client: client.hostname, mac: client.interfaces[clientIfaceName].mac, pool: poolName });
  return { devices: next, message: `${client.hostname} leased ${offered} from ${server.hostname}` };
}

function reachableLayer2Devices(devices, links, clientId, clientIfaceName) {
  devices = computeWirelessAssociations(devices);
  const peer = chooseAdjacentPeer(devices, links, clientId, clientIfaceName, null, null);
  if (!peer) return [];
  const firstHop = devices[peer.peerId];
  let vlan = 1;
  if (isSwitchLike(firstHop)) vlan = vlanOnIngress(firstHop.interfaces?.[peer.peerIface]);
  if (firstHop?.kind === "ap") {
    const assoc = (firstHop.wireless?.associations || []).find((a) => a.clientId === clientId && a.clientIface === clientIfaceName);
    vlan = assoc?.vlan || vlan;
  }
  const out = [];
  const walk = [{ id: peer.peerId, ingress: peer.peerIface }];
  const seen = new Set([clientId]);
  while (walk.length) {
    const current = walk.shift();
    const id = current.id;
    if (seen.has(id)) continue;
    seen.add(id);
    const d = devices[id];
    if (!d) continue;
    out.push({ id, dev: d, ingress: current.ingress, vlan });
    if (!isSwitchLike(d) && d.kind !== "ap") continue;
    for (const [ifaceName, ifc] of Object.entries(d.interfaces || {})) {
      if (!ifc?.up || ifc.admUp === false) continue;
      if (isSwitchLike(d) && !vlanAllows(ifc, vlan)) continue;
      for (const next of adjacentPeers(devices, links, id, ifaceName)) {
        walk.push({ id: next.peerId, ingress: next.peerIface });
      }
    }
  }
  return out;
}

function ipv6RouterAdvertisement(devices, links, clientId, clientIfaceName) {
  for (const item of reachableLayer2Devices(devices, links, clientId, clientIfaceName)) {
    const d = item.dev;
    if (!isRouterLike(d) || d.ipv6Routing === false) continue;
    for (const [iface, ifc] of Object.entries(d.interfaces || {})) {
      if (item.ingress && iface !== item.ingress && ifacePortInfo(d, iface).media !== "virtual") continue;
      const v6 = ifaceIpv6(ifc);
      if (!v6 || !ifaceIpv6Up(iface, ifc)) continue;
      if (findPeer(devices, links, d.id, iface) || dot1qVlanForIface(iface, ifc) != null) {
        return { router: d, iface, ifc, prefix: ipv6NetworkAddress(v6.ip, v6.prefixLength), prefixLength: v6.prefixLength, gateway: ipv6LinkLocal(ifc), managed: !!ifc.ipv6NdManaged, other: !!ifc.ipv6NdOther };
      }
    }
  }
  return null;
}

function applySlaac(devices, links, clientId, ifaceName) {
  const client = devices[clientId];
  const clientIfaceName = ifaceName || (client?.interfaces?.eth0 ? "eth0" : (client?.interfaces?.en0 ? "en0" : Object.keys(client?.interfaces || {})[0]));
  if (!clientIfaceName) return { devices, message: "No host interface" };
  const ra = ipv6RouterAdvertisement(devices, links, clientId, clientIfaceName);
  if (!ra) return { devices, message: "No IPv6 router advertisement reachable" };
  const next = clone(devices);
  const ifc = next[clientId].interfaces[clientIfaceName] || {};
  next[clientId].interfaces[clientIfaceName] = {
    ...ifc,
    ipv6: ipv6FromPrefix(ra.prefix, ra.prefixLength, ifc),
    ipv6PrefixLength: ra.prefixLength,
    ipv6Gw: ra.gateway,
    linkLocal: ipv6LinkLocal(ifc),
    ipv6Source: "slaac",
    ipv6Autoconfig: true,
    ipv6Enabled: true,
  };
  return { devices: next, message: `${client.hostname} autoconfigured ${next[clientId].interfaces[clientIfaceName].ipv6}/${ra.prefixLength}` };
}

function dhcpv6PoolsFor(server) {
  const pools = { ...(server.dhcpv6?.pools || {}) };
  for (const p of server.serverConfig?.dhcpv6?.pools || []) {
    if (p.poolName) pools[p.poolName] = { ...p };
  }
  return pools;
}

function allocateDhcpv6(devices, links, clientId, ifaceName) {
  const client = devices[clientId];
  const clientIfaceName = ifaceName || (client?.interfaces?.eth0 ? "eth0" : (client?.interfaces?.en0 ? "en0" : Object.keys(client?.interfaces || {})[0]));
  if (!clientIfaceName) return { devices, message: "No host interface" };
  const reachable = reachableLayer2Devices(devices, links, clientId, clientIfaceName);
  const ra = ipv6RouterAdvertisement(devices, links, clientId, clientIfaceName);
  let server = null, poolName = null, pool = null;
  for (const item of reachable) {
    const d = item.dev;
    if (!d?.services?.dhcpv6) continue;
    const pools = dhcpv6PoolsFor(d);
    for (const [name, p] of Object.entries(pools)) {
      if (p.prefix && isIpv6(p.prefix)) {
        server = d; poolName = name; pool = p; break;
      }
    }
    if (server) break;
  }
  if (!server || !pool) return { devices, message: "No DHCPv6 pool reachable" };
  const prefixLength = ipv6PrefixLength(pool.prefixLength ?? pool.length, 64);
  const prefix = ipv6NetworkAddress(pool.prefix, prefixLength);
  const used = new Set([...(server.dhcpv6?.bindings || []), ...(server.serverConfig?.dhcpv6?.bindings || [])].map((b) => normalizeIpv6(b.ipv6)));
  let offered = "";
  const base = parseIpv6Address(prefix) || 0n;
  for (let n = 0x100n; n < 0xffffn; n++) {
    const candidate = bigIntToIpv6(base + n);
    if (!used.has(candidate)) { offered = candidate; break; }
  }
  if (!offered) return { devices, message: `DHCPv6 pool ${poolName} has no free addresses` };
  const next = clone(devices);
  const ifc = next[clientId].interfaces[clientIfaceName] || {};
  next[clientId].interfaces[clientIfaceName] = {
    ...ifc,
    ipv6: offered,
    ipv6PrefixLength: prefixLength,
    ipv6Gw: pool.gateway || ra?.gateway || ifc.ipv6Gw || null,
    ipv6Dns: pool.dnsServer || pool.dns || null,
    ipv6DomainName: pool.domainName || "",
    linkLocal: ipv6LinkLocal(ifc),
    ipv6Source: "dhcpv6",
    ipv6Autoconfig: false,
    ipv6Enabled: true,
  };
  next[server.id].dhcpv6 = next[server.id].dhcpv6 || { pools: {}, bindings: [] };
  next[server.id].dhcpv6.bindings = [...(next[server.id].dhcpv6.bindings || []), { ipv6: offered, client: client.hostname, mac: client.interfaces[clientIfaceName].mac, pool: poolName }];
  return { devices: next, message: `${client.hostname} leased ${offered} from ${server.hostname}` };
}

function serializeConfig(d) {
  const out = ["!", `! ${d.model || d.kind} running-config`, "!", `hostname ${d.hostname}`];
  if (d.secrets?.enable) out.push(`enable secret ${d.secrets.enable}`);
  if (d.services?.passwordEncryption) out.push("service password-encryption");
  if (d.domainName) out.push(`ip domain-name ${d.domainName}`);
  if (d.ipv6Routing) out.push("ipv6 unicast-routing");
  if (d.ssh?.version) out.push(`ip ssh version ${d.ssh.version}`);
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
  if (d.wireless?.radioEnabled === false) out.push("wireless radio off");
  if (d.wireless?.ssid) out.push(`wireless ssid ${d.wireless.ssid}`);
  if (d.wireless?.security) out.push(`wireless security ${d.wireless.security}${d.wireless.passphrase ? ` ${d.wireless.passphrase}` : ""}`);
  if (d.wireless?.vlan && Number(d.wireless.vlan) !== 1) out.push(`wireless vlan ${d.wireless.vlan}`);
  for (const e of d.dhcp?.excluded || []) out.push(`ip dhcp excluded-address ${e.start}${e.end && e.end !== e.start ? ` ${e.end}` : ""}`);
  for (const [name, p] of Object.entries(d.dhcp?.pools || {})) {
    out.push(`ip dhcp pool ${name}`);
    if (p.network) out.push(` network ${p.network} ${p.mask}`);
    if (p.defaultRouter) out.push(` default-router ${p.defaultRouter}`);
    if (p.dnsServer) out.push(` dns-server ${p.dnsServer}`);
    if (p.domainName) out.push(` domain-name ${p.domainName}`);
    if (p.netbiosServer) out.push(` netbios-name-server ${p.netbiosServer}`);
    out.push("!");
  }
  for (const [name, p] of Object.entries(d.dhcpv6?.pools || {})) {
    out.push(`ipv6 dhcp pool ${name}`);
    if (p.prefix) out.push(` address prefix ${p.prefix}/${p.prefixLength || p.length || 64}`);
    if (p.dnsServer) out.push(` dns-server ${p.dnsServer}`);
    if (p.domainName) out.push(` domain-name ${p.domainName}`);
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
    if (ifc.helperAddress) out.push(` ip helper-address ${ifc.helperAddress}`);
    const v6 = ifaceIpv6(ifc);
    if (v6) out.push(` ipv6 address ${v6.ip}/${v6.prefixLength}`);
    if (ifc.ipv6Autoconfig) out.push(" ipv6 address autoconfig");
    if (ifc.ipv6Enabled || ifc.linkLocal || v6) out.push(" ipv6 enable");
    if (ifc.ipv6NdManaged) out.push(" ipv6 nd managed-config-flag");
    if (ifc.ipv6NdOther) out.push(" ipv6 nd other-config-flag");
    for (const [pid, proc] of Object.entries(d.ospfv3 || {})) if (proc.interfaces?.includes(n)) out.push(` ipv6 ospf ${pid} area ${proc.areas?.[n] || 0}`);
    for (const [asn, proc] of Object.entries(d.eigrpIpv6 || {})) if (proc.interfaces?.includes(n)) out.push(` ipv6 eigrp ${asn}`);
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
    if (ifc.trunkEncapsulation) out.push(` switchport trunk encapsulation ${ifc.trunkEncapsulation}`);
    if (ifc.ospfPriority !== undefined) out.push(` ip ospf priority ${ifc.ospfPriority}`);
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
  for (const r of d.ipv6Routes || []) if (r.type === "S") out.push(`ipv6 route ${r.prefix}/${r.prefixLength} ${r.via}`);
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
  for (const [pid, o] of Object.entries(d.ospfv3 || {})) {
    out.push(`ipv6 router ospf ${pid}`);
    if (o.routerId) out.push(` router-id ${o.routerId}`);
    out.push("!");
  }
  for (const [asn] of Object.entries(d.eigrpIpv6 || {})) {
    out.push(`ipv6 router eigrp ${asn}`);
    out.push("!");
  }
  if (d.lines?.console) {
    out.push("line console 0");
    if (d.lines.console.password) out.push(` password ${d.lines.console.password}`);
    if (d.lines.console.login) out.push(" login");
    if (d.lines.console.loggingSync) out.push(" logging synchronous");
    if (d.lines.console.timeout) out.push(` exec-timeout ${d.lines.console.timeout.minutes} ${d.lines.console.timeout.seconds || 0}`);
    out.push("!");
  }
  if (d.lines?.vty) {
    out.push("line vty 0 4");
    if (d.lines.vty.password) out.push(` password ${d.lines.vty.password}`);
    if (d.lines.vty.login) out.push(" login");
    if (d.lines.vty.transport?.length) out.push(` transport input ${d.lines.vty.transport.join(" ")}`);
    if (d.lines.vty.loggingSync) out.push(" logging synchronous");
    if (d.lines.vty.timeout) out.push(` exec-timeout ${d.lines.vty.timeout.minutes} ${d.lines.vty.timeout.seconds || 0}`);
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
    for (const e of acl.entries || []) out.push(` ${e.action}${e.spec ? ` ${e.spec}` : ` ${e.src || "any"}${e.dst ? ` ${e.dst}` : ""}`}`);
    out.push("!");
  }
  out.push("end");
  return out.join("\n");
}

window.OPT_Engine = {
  uid, makeStarter, makeDevice, platformForKind, PLATFORM_PROFILES,
  normalizeDevice, normalizeTopology, startupConfigSnapshot, reloadFromStartupConfig, serializeConfig,
  planPath, allocateDhcp, allocateDhcpv6, applySlaac, recomputeDynamicRoutes, recalcConnectedRoutes,
  ipToInt, intToIp, maskBits, wildcardToMask, networkAddress, sameSubnet, inNet,
  isIpv6, normalizeIpv6, ipv6NetworkAddress, ipv6InPrefix, sameIpv6Subnet, ipv6LinkLocal, ipv6FromPrefix,
  findPeer, lookupRoute, ifaceForDest, ifaceForVia, shortIfaceName, shortIfaceNamesInText,
  adjacentPeers, wirelessPeersFor, effectiveAdjacencies, computeWirelessAssociations, normalizeWirelessSecurity,
  lookupIpv6Route, ifaceForIpv6Via,
  dot1qVlanForIface, parentIfaceForTaggedEgress,
  validateTopology,
  normalizeCableType, cableTypeLabel, ifacePortInfo, cableFitsPort, recommendedCableTypeForPorts, cableCompatibility,
  isRouterLike, isSwitchLike, isHostLike,
};
