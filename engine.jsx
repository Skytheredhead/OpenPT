// engine.jsx - OpenPT IOS XE-flavored simulation engine
// Owns platform profiles, config helpers, route generation, and packet planning.

const uid = (p = "id") => `${p}_${Math.random().toString(36).slice(2, 8)}`;

const PLATFORM_PROFILES = {
  isr4321: {
    id: "isr4321",
    label: "Cisco ISR4321",
    os: "Cisco IOS XE Dublin 17.12.x",
    image: "isr4300-universalk9.17.12",
    ifaces: ["GigabitEthernet0/0/0", "GigabitEthernet0/0/1", "Serial0/1/0", "Serial0/1/1"],
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
  genericPc: { id: "genericPc", label: "Generic PC", os: "OpenPT host shell", image: "host", ifaces: ["eth0"] },
  genericServer: { id: "genericServer", label: "Generic Server", os: "OpenPT server shell", image: "server", ifaces: ["eth0"] },
};

function platformForKind(kind) {
  if (kind === "router") return PLATFORM_PROFILES.isr4321;
  if (kind === "l2switch" || kind === "l3switch") return PLATFORM_PROFILES.c9200l;
  if (kind === "server") return PLATFORM_PROFILES.genericServer;
  return PLATFORM_PROFILES.genericPc;
}

function defaultStateFor(kind) {
  const isSwitch = kind === "l2switch" || kind === "l3switch";
  return {
    startupConfig: "",
    users: {},
    secrets: {},
    lines: {
      console: { password: "", login: false, loggingSync: false },
      vty: { password: "", login: false, transport: ["ssh", "telnet"] },
    },
    services: { passwordEncryption: false, cdp: true, lldp: false, ssh: false, http: false },
    dhcp: { excluded: [], pools: {}, bindings: [] },
    ospf: {},
    rip: {},
    eigrp: {},
    bgp: {},
    acls: {},
    nat: { rules: [], pools: {}, translations: [] },
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
    ipRouting: kind === "router",
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
  const isSwitch = kind === "l2switch" || kind === "l3switch";
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
  }
  return out;
}

function makeDevice(kind, name, x, y, seededIfaces = {}, extra = {}) {
  const profile = platformForKind(kind);
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
    vlans: (kind === "l2switch" || kind === "l3switch") ? { 1: "default" } : undefined,
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
    "GigabitEthernet1/0/1": { up: true, admUp: true, vlan: 10, mode: "access", desc: "to R1" },
    "GigabitEthernet1/0/2": { up: true, admUp: true, vlan: 10, mode: "access", desc: "to PC1" },
    "GigabitEthernet1/0/3": { up: true, admUp: true, vlan: 10, mode: "access", desc: "to PC2" },
  }, { vlans: { 1: "default", 10: "USERS", 20: "VOICE" } });

  const SW2 = makeDevice("l2switch", "SW2", 920, 420, {
    "GigabitEthernet1/0/1": { up: true, admUp: true, vlan: 20, mode: "access", desc: "to R2" },
    "GigabitEthernet1/0/2": { up: true, admUp: true, vlan: 20, mode: "access", desc: "to PC3" },
    "GigabitEthernet1/0/3": { up: true, admUp: true, vlan: 20, mode: "access", desc: "to SRV" },
  }, { vlans: { 1: "default", 20: "USERS", 30: "DMZ" } });

  const PC1 = makeDevice("pc", "PC1", 170, 560, { eth0: { ip: "192.168.10.10", mask: "255.255.255.0", gw: "192.168.10.1", up: true, admUp: true } });
  const PC2 = makeDevice("pc", "PC2", 320, 600, { eth0: { ip: "192.168.10.11", mask: "255.255.255.0", gw: "192.168.10.1", up: true, admUp: true } });
  const PC3 = makeDevice("pc", "PC3", 920, 600, { eth0: { ip: "192.168.20.10", mask: "255.255.255.0", gw: "192.168.20.1", up: true, admUp: true } });
  const SRV = makeDevice("server", "SRV1", 1070, 560, { eth0: { ip: "192.168.20.20", mask: "255.255.255.0", gw: "192.168.20.1", up: true, admUp: true } });

  let devices = { [R1.id]: R1, [R2.id]: R2, [SW1.id]: SW1, [SW2.id]: SW2, [PC1.id]: PC1, [PC2.id]: PC2, [PC3.id]: PC3, [SRV.id]: SRV };
  const lnk = (a, ai, b, bi, type = "copper") => ({ id: uid("l"), a, ai, b, bi, type, up: true });
  const links = [
    lnk(R1.id, "GigabitEthernet0/0/0", SW1.id, "GigabitEthernet1/0/1"),
    lnk(R1.id, "GigabitEthernet0/0/1", R2.id, "GigabitEthernet0/0/1", "serial"),
    lnk(R2.id, "GigabitEthernet0/0/0", SW2.id, "GigabitEthernet1/0/1"),
    lnk(SW1.id, "GigabitEthernet1/0/2", PC1.id, "eth0"),
    lnk(SW1.id, "GigabitEthernet1/0/3", PC2.id, "eth0"),
    lnk(SW2.id, "GigabitEthernet1/0/2", PC3.id, "eth0"),
    lnk(SW2.id, "GigabitEthernet1/0/3", SRV.id, "eth0"),
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
function isSwitchLike(d) { return d?.kind === "l2switch" || d?.kind === "l3switch"; }
function isRouterLike(d) { return d?.kind === "router" || d?.kind === "l3switch"; }
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

function normalizeDevice(d) {
  if (!d) return d;
  const profile = platformForKind(d.kind);
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
      const real = `GigabitEthernet1/0/${oldSwitch[1]}`;
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
    if (isSwitchLike(dev) && m) return `GigabitEthernet1/0/${m[1]}`;
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
      if (!chosen) chosen = candidates.find((c) => (c.nd.kind === "pc" || c.nd.kind === "server") && c.nif.ip && sameSubnet(c.nif.ip, dstIp, c.nif.mask || "255.255.255.0"));
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
  findPeer, lookupRoute, ifaceForDest, ifaceForVia, shortIfaceName, shortIfaceNamesInText, isRouterLike, isSwitchLike,
};
