// engine.jsx — OpenPT network engine
// State: devices, links, interfaces, routes, ARP, MAC table, packet queue.
// Simulation: hop-by-hop with explainable forwarding decisions.

const uid = (p = "id") => `${p}_${Math.random().toString(36).slice(2, 8)}`;

// ── Default starter scenario: 2 routers, 2 switches, a few PCs + a server
function makeStarter() {
  const dev = (kind, name, x, y, extra = {}) => ({
    id: uid("d"),
    kind, name, x, y,
    powered: true,
    hostname: name,
    privileged: false,
    interfaces: {},
    routes: [],
    arp: {},
    mac: {},
    vlans: { 1: "default" },
    ...extra,
  });

  const R1 = dev("router", "R1", 280, 180);
  R1.interfaces = {
    "G0/0": { ip: "192.168.10.1", mask: "255.255.255.0", up: true, admUp: true, mac: "0001.AA00.0001", desc: "to SW1" },
    "G0/1": { ip: "10.0.0.1",     mask: "255.255.255.252", up: true, admUp: true, mac: "0001.AA00.0002", desc: "to R2" },
    "S0/0/0": { ip: null, mask: null, up: false, admUp: false, mac: "0001.AA00.0003", desc: "" },
  };
  R1.routes = [
    { dst: "192.168.10.0", mask: "255.255.255.0", via: "directly", iface: "G0/0", type: "C" },
    { dst: "10.0.0.0",     mask: "255.255.255.252", via: "directly", iface: "G0/1", type: "C" },
    { dst: "192.168.20.0", mask: "255.255.255.0", via: "10.0.0.2",  iface: "G0/1", type: "S" },
  ];

  const R2 = dev("router", "R2", 920, 200);
  R2.interfaces = {
    "G0/0": { ip: "192.168.20.1", mask: "255.255.255.0", up: true, admUp: true, mac: "0001.BB00.0001", desc: "to SW2" },
    "G0/1": { ip: "10.0.0.2",     mask: "255.255.255.252", up: true, admUp: true, mac: "0001.BB00.0002", desc: "to R1" },
    "S0/0/0": { ip: null, mask: null, up: false, admUp: false, mac: "0001.BB00.0003", desc: "" },
  };
  R2.routes = [
    { dst: "192.168.20.0", mask: "255.255.255.0", via: "directly", iface: "G0/0", type: "C" },
    { dst: "10.0.0.0",     mask: "255.255.255.252", via: "directly", iface: "G0/1", type: "C" },
    { dst: "192.168.10.0", mask: "255.255.255.0", via: "10.0.0.1",  iface: "G0/1", type: "S" },
  ];

  const SW1 = dev("l2switch", "SW1", 320, 420);
  SW1.interfaces = {
    "F0/1": { up: true, admUp: true, mac: "0011.AA00.0001", vlan: 10, mode: "access", desc: "to R1" },
    "F0/2": { up: true, admUp: true, mac: "0011.AA00.0002", vlan: 10, mode: "access", desc: "to PC1" },
    "F0/3": { up: true, admUp: true, mac: "0011.AA00.0003", vlan: 10, mode: "access", desc: "to PC2" },
    "F0/4": { up: false, admUp: true, mac: "0011.AA00.0004", vlan: 1, mode: "access", desc: "" },
  };
  SW1.vlans = { 1: "default", 10: "USERS", 20: "VOICE" };

  const SW2 = dev("l2switch", "SW2", 920, 420);
  SW2.interfaces = {
    "F0/1": { up: true, admUp: true, mac: "0011.BB00.0001", vlan: 20, mode: "access", desc: "to R2" },
    "F0/2": { up: true, admUp: true, mac: "0011.BB00.0002", vlan: 20, mode: "access", desc: "to PC3" },
    "F0/3": { up: true, admUp: true, mac: "0011.BB00.0003", vlan: 20, mode: "access", desc: "to SRV" },
    "F0/4": { up: false, admUp: true, mac: "0011.BB00.0004", vlan: 1, mode: "access", desc: "" },
  };
  SW2.vlans = { 1: "default", 20: "USERS", 30: "DMZ" };

  const PC1 = dev("pc", "PC1", 170, 560);
  PC1.interfaces = { "eth0": { ip: "192.168.10.10", mask: "255.255.255.0", gw: "192.168.10.1", up: true, admUp: true, mac: "00:1A:2B:00:00:01" } };
  const PC2 = dev("pc", "PC2", 320, 600);
  PC2.interfaces = { "eth0": { ip: "192.168.10.11", mask: "255.255.255.0", gw: "192.168.10.1", up: true, admUp: true, mac: "00:1A:2B:00:00:02" } };
  const PC3 = dev("pc", "PC3", 920, 600);
  PC3.interfaces = { "eth0": { ip: "192.168.20.10", mask: "255.255.255.0", gw: "192.168.20.1", up: true, admUp: true, mac: "00:1A:2B:00:00:03" } };
  const SRV = dev("server", "SRV1", 1070, 560);
  SRV.interfaces = { "eth0": { ip: "192.168.20.20", mask: "255.255.255.0", gw: "192.168.20.1", up: true, admUp: true, mac: "00:1A:2B:00:00:04" } };

  const devices = { [R1.id]: R1, [R2.id]: R2, [SW1.id]: SW1, [SW2.id]: SW2,
                    [PC1.id]: PC1, [PC2.id]: PC2, [PC3.id]: PC3, [SRV.id]: SRV };

  const lnk = (a, ai, b, bi, type = "copper") => ({ id: uid("l"), a, ai, b, bi, type, up: true });
  const links = [
    lnk(R1.id, "G0/0", SW1.id, "F0/1"),
    lnk(R1.id, "G0/1", R2.id, "G0/1", "serial"),
    lnk(R2.id, "G0/0", SW2.id, "F0/1"),
    lnk(SW1.id, "F0/2", PC1.id, "eth0"),
    lnk(SW1.id, "F0/3", PC2.id, "eth0"),
    lnk(SW2.id, "F0/2", PC3.id, "eth0"),
    lnk(SW2.id, "F0/3", SRV.id, "eth0"),
  ];
  return { devices, links };
}

// ── Network helpers ────────────────────────────────────
function ipToInt(ip) {
  if (!ip) return 0;
  const p = ip.split(".").map(Number);
  return ((p[0] << 24) | (p[1] << 16) | (p[2] << 8) | p[3]) >>> 0;
}
function maskBits(mask) {
  let n = ipToInt(mask), c = 0;
  while (n) { c += n & 1; n >>>= 1; }
  return c;
}
function sameSubnet(a, b, mask) {
  return (ipToInt(a) & ipToInt(mask)) === (ipToInt(b) & ipToInt(mask));
}
function inNet(ip, dst, mask) {
  return (ipToInt(ip) & ipToInt(mask)) === (ipToInt(dst) & ipToInt(mask));
}

// Find the other end of a link from a (devId, ifaceId)
function findPeer(devices, links, devId, ifaceId) {
  for (const l of links) {
    if (l.a === devId && l.ai === ifaceId) return { peerId: l.b, peerIface: l.bi, link: l };
    if (l.b === devId && l.bi === ifaceId) return { peerId: l.a, peerIface: l.ai, link: l };
  }
  return null;
}
function ifaceOfPeer(devices, links, devId, ifaceId) {
  const p = findPeer(devices, links, devId, ifaceId); return p;
}

// Find iface for a given IP on a device
function ifaceForDest(dev, dstIp) {
  for (const [name, ifc] of Object.entries(dev.interfaces || {})) {
    if (ifc.ip && ifc.mask && inNet(dstIp, ifc.ip, ifc.mask)) return { name, ifc };
  }
  return null;
}

// Longest-prefix-match route lookup
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

// ── Build a hop-by-hop plan for an ICMP echo from src→dst
function planPath(devices, links, srcId, dstIp) {
  const src = devices[srcId];
  if (!src) return { ok: false, error: "Source device not found", hops: [] };
  if (!src.powered) return { ok: false, error: `${src.hostname} is powered off`, hops: [] };

  // Determine source IP based on device kind
  let srcIp = null, srcIface = null;
  if (src.kind === "pc" || src.kind === "server") {
    const e = src.interfaces?.["eth0"];
    if (!e || !e.ip) return { ok: false, error: `${src.hostname} has no IP configured on eth0`, hops: [] };
    srcIp = e.ip; srcIface = "eth0";
  } else if (src.kind === "router" || src.kind === "l3switch") {
    for (const [n, ifc] of Object.entries(src.interfaces)) {
      if (ifc.ip && ifc.up) { srcIp = ifc.ip; srcIface = n; break; }
    }
    if (!srcIp) return { ok: false, error: `${src.hostname} has no IP configured on any up interface`, hops: [] };
  } else if (src.kind === "l2switch") {
    return { ok: false, error: `${src.hostname} is a layer-2 switch — no IP layer to ping from`, hops: [] };
  } else {
    return { ok: false, error: `${src.hostname}: unsupported ping origin`, hops: [] };
  }

  const hops = [{ devId: srcId, action: "originate", note: `${src.hostname} crafts ICMP echo → ${dstIp}` }];

  // Egress decision: directly connected → out that iface; else route or default-gw
  let nextHopIp = null, egressIface = null;
  for (const [n, ifc] of Object.entries(src.interfaces)) {
    if (ifc.ip && ifc.mask && inNet(dstIp, ifc.ip, ifc.mask)) {
      nextHopIp = dstIp;
      egressIface = n;
      hops.push({ devId: srcId, action: "arp-local", note: `${dstIp} is on local subnet (${n})` });
      break;
    }
  }
  if (!egressIface) {
    if (src.kind === "router" || src.kind === "l3switch") {
      const route = lookupRoute(src, dstIp);
      if (!route) return { ok: false, error: `${src.hostname}: no route to ${dstIp}`, hops };
      nextHopIp = (route.via === "directly") ? dstIp : route.via;
      egressIface = route.iface;
      hops.push({ devId: srcId, action: "route", iface: egressIface, note: `route lookup → ${route.dst}/${maskBits(route.mask)} via ${route.via === "directly" ? "directly connected" : route.via}` });
    } else {
      const e = src.interfaces.eth0;
      nextHopIp = e.gw;
      if (!nextHopIp) return { ok: false, error: `${src.hostname}: destination off-net and no default gateway configured`, hops };
      egressIface = "eth0";
      hops.push({ devId: srcId, action: "arp-gw", note: `${dstIp} off-net; resolving gateway ${nextHopIp}` });
    }
  }

  // Walk: from src device's egress iface, traverse switches/routers until we reach dst
  let curDev = src;
  let curIface = egressIface;
  let guard = 0;
  while (guard++ < 32) {
    const peer = findPeer(devices, links, curDev.id, curIface);
    if (!peer) return { ok: false, error: `No link connected to ${curDev.hostname} ${curIface}`, hops };
    if (!peer.link.up) return { ok: false, error: `Link ${curDev.hostname} ${curIface} ↔ peer is down`, hops };
    const nb = devices[peer.peerId];
    if (!nb || !nb.powered) return { ok: false, error: `Neighbor ${nb?.hostname || "?"} is unreachable`, hops };

    // Arrive at neighbor
    hops.push({ devId: nb.id, action: "ingress", iface: peer.peerIface, note: `arrives at ${nb.hostname} on ${peer.peerIface}` });

    // Have we arrived at a device that owns the destination IP on any interface?
    let owned = null;
    for (const [n, ifc] of Object.entries(nb.interfaces)) {
      if (ifc.ip === dstIp) { owned = n; break; }
    }
    if (owned) {
      hops.push({ devId: nb.id, action: "deliver", note: `delivered to ${nb.hostname} (${dstIp})`, ok: true });
      hops.push({ devId: nb.id, action: "reply", note: `${nb.hostname} sends ICMP echo-reply`, ok: true });
      return { ok: true, hops };
    }

    if (nb.kind === "l2switch" || nb.kind === "l3switch") {
      // L2 forward — find which other port leads toward the next-hop or destination subnet
      const ingressIfc = nb.interfaces[peer.peerIface];
      const vlan = ingressIfc?.vlan ?? 1;
      // Find the matching uplink (a port on same vlan that leads somewhere useful).
      // Heuristic: pick the link to a router if next-hop is a gateway IP, else broadcast through other access ports in vlan.
      let chosen = null;
      for (const [pname, pifc] of Object.entries(nb.interfaces)) {
        if (pname === peer.peerIface) continue;
        if (!pifc.up || !pifc.admUp) continue;
        if (pifc.vlan != null && pifc.vlan !== vlan) continue;
        const next = findPeer(devices, links, nb.id, pname);
        if (!next) continue;
        const nd = devices[next.peerId];
        if (!nd) continue;
        // Prefer link whose endpoint owns next-hop IP, or leads to that subnet
        const ifc = nd.interfaces?.[next.peerIface];
        if (ifc?.ip === nextHopIp) { chosen = { pname, next }; break; }
        if (ifc?.ip === dstIp)     { chosen = { pname, next }; break; }
        if (nd.kind === "router") chosen = chosen || { pname, next };
        if (nd.kind === "l3switch") chosen = chosen || { pname, next };
        if ((nd.kind === "pc" || nd.kind === "server") && ifc?.ip && sameSubnet(ifc.ip, dstIp, ifc.mask || "255.255.255.0")) {
          chosen = { pname, next }; break;
        }
      }
      if (!chosen) return { ok: false, error: `${nb.hostname}: no forwarding entry for VLAN ${vlan} toward ${dstIp}`, hops };
      hops.push({ devId: nb.id, action: "switch", iface: chosen.pname, note: `switch VLAN ${vlan} egress ${chosen.pname}` });
      curDev = nb;
      curIface = chosen.pname;
      continue;
    }

    if (nb.kind === "router") {
      // L3 lookup
      const route = lookupRoute(nb, dstIp);
      if (!route) {
        hops.push({ devId: nb.id, action: "drop", note: `${nb.hostname}: no route to ${dstIp}`, ok: false });
        return { ok: false, error: `${nb.hostname}: no route to host ${dstIp}`, hops };
      }
      // If directly connected, the next-hop becomes the dest itself
      nextHopIp = (route.via === "directly") ? dstIp : route.via;
      hops.push({ devId: nb.id, action: "route", iface: route.iface, note: `route lookup → ${route.dst}/${maskBits(route.mask)} via ${route.via === "directly" ? "directly connected" : route.via} (${route.iface})` });
      curDev = nb;
      curIface = route.iface;
      continue;
    }

    // Unknown kind — bail
    return { ok: false, error: `Unsupported hop at ${nb.hostname}`, hops };
  }
  return { ok: false, error: "Hop limit exceeded (loop?)", hops };
}

window.OPT_Engine = {
  uid, makeStarter, planPath, ipToInt, maskBits, sameSubnet, inNet,
  findPeer, lookupRoute, ifaceForDest,
};
