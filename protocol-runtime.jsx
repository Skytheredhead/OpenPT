// protocol-runtime.jsx - structured CCNA protocol runtime for OpenPT.
// Models protocol exchanges as deterministic events and keeps legacy topology
// behavior available through a planPath-compatible adapter.

(function () {
  const E = window.OPT_Engine;
  const BROADCAST = "FF:FF:FF:FF:FF:FF";
  const ARP_AGE_MS = 20 * 60 * 1000;
  const MAC_AGE_MS = 5 * 60 * 1000;

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function nowSeed(options) {
    return Number(options?.nowMs || 0);
  }

  function runtimeForDevice(d) {
    const existing = d.runtime || {};
    return {
      arp: { entries: {}, ...(existing.arp || {}) },
      macTable: { entries: {}, ...(existing.macTable || {}) },
      dhcp: { leases: {}, ...(existing.dhcp || {}) },
      dns: { cache: {}, ...(existing.dns || {}) },
      nat: { nextPort: existing.nat?.nextPort || 10000, translations: existing.nat?.translations || [] },
      ospf: { neighbors: {}, lsdb: {}, ...(existing.ospf || {}) },
      stp: { rootByVlan: {}, blocked: {}, ...(existing.stp || {}) },
      tcp: { sessions: {}, ...(existing.tcp || {}) },
      counters: { ...(existing.counters || {}) },
    };
  }

  function normalizeRuntime(devices) {
    const out = clone(devices || {});
    for (const d of Object.values(out)) {
      d.runtime = runtimeForDevice(d);
      d.arp = { ...(d.arp || {}) };
      d.mac = { ...(d.mac || {}) };
      d.nat = d.nat || { rules: [], pools: {}, translations: [] };
      d.nat.translations = d.nat.translations || [];
      d.dhcp = d.dhcp || { excluded: [], pools: {}, bindings: [] };
    }
    return out;
  }

  function makeContext(devices, links, intent, options) {
    const ctx = {
      devices: normalizeRuntime(devices),
      links: clone(links || []),
      intent: intent || {},
      options: options || {},
      timeMs: nowSeed(options),
      events: [],
      packets: [],
      ok: false,
      error: "",
      tables: {},
    };
    ctx.emit = (event) => {
      const full = {
        timeMs: ctx.timeMs,
        kind: event.kind || "note",
        proto: event.proto || ctx.intent.type || "ip",
        ...event,
      };
      ctx.events.push(full);
      if (event.packet || event.frame || ["arp", "icmp", "udp", "tcp", "http", "ftp", "tftp", "dns", "ospf", "stp", "nat", "drop"].includes(full.proto)) {
        ctx.packets.push({
          id: `pkt_${ctx.packets.length + 1}`,
          proto: full.proto,
          srcDevice: full.srcDevice,
          dstDevice: full.dstDevice,
          ingress: full.ingress,
          egress: full.egress,
          vlan: full.vlan,
          decision: full.decision,
          note: full.note,
        });
      }
      ctx.timeMs += Number(event.durationMs || 1);
      return full;
    };
    return ctx;
  }

  function isIpv4(ip) {
    const p = String(ip || "").split(".").map(Number);
    return p.length === 4 && p.every((n) => Number.isInteger(n) && n >= 0 && n <= 255);
  }

  function firstIp(dev) {
    return Object.entries(dev?.interfaces || {}).find(([, i]) => i.ip)?.[1]?.ip || "";
  }

  function primaryHostIface(dev) {
    if (dev?.interfaces?.eth0) return ["eth0", dev.interfaces.eth0];
    if (dev?.interfaces?.en0) return ["en0", dev.interfaces.en0];
    return Object.entries(dev?.interfaces || {}).find(([, i]) => i.ip) || Object.entries(dev?.interfaces || {})[0] || [null, null];
  }

  function hostIp(dev) {
    const [name, ifc] = primaryHostIface(dev);
    if (ifc?.ip && ifc.up !== false && ifc.admUp !== false) return { ip: ifc.ip, iface: name, mask: ifc.mask };
    for (const [n, i] of Object.entries(dev?.interfaces || {})) {
      if (i.ip && (i.up || (i.admUp !== false && E.dot1qVlanForIface(n, i) != null))) return { ip: i.ip, iface: n, mask: i.mask };
    }
    return null;
  }

  function ownsIp(dev, ip) {
    for (const [name, ifc] of Object.entries(dev?.interfaces || {})) if (ifc.ip === ip) return name;
    return null;
  }

  function vlanAllows(ifc, vlan) {
    if (!ifc) return false;
    if (ifc.mode !== "trunk") return String(ifc.vlan ?? 1) === String(vlan);
    if (ifc.allowedVlans == null || ifc.allowedVlans === "all") return true;
    return String(ifc.allowedVlans).split(",").some((part) => {
      const [a, b] = part.split("-").map(Number);
      const v = Number(vlan);
      return Number.isFinite(b) ? v >= a && v <= b : v === a;
    });
  }

  function vlanOnIngress(ifc) {
    return ifc?.mode === "trunk" ? (ifc.nativeVlan || 1) : (ifc?.vlan || 1);
  }

  function routeForwarding(dev, route, dstIp) {
    const viaIface = dev.interfaces?.[route?.via];
    return {
      nextHopIp: route?.via === "directly" || viaIface ? dstIp : route?.via,
      iface: viaIface ? route.via : route?.iface,
    };
  }

  function wildcardToMask(wildcard) {
    return E.wildcardToMask ? E.wildcardToMask(wildcard || "0.0.0.0") : "255.255.255.255";
  }

  function matchAddress(ip, addr, wildcard) {
    if (!addr || addr === "any") return true;
    return E.inNet(ip, addr, wildcardToMask(wildcard || "0.0.0.0"));
  }

  function parsePortSpec(words, idx) {
    if (words[idx] === "eq") return { op: "eq", port: Number(words[idx + 1]) || servicePort(words[idx + 1]), next: idx + 2 };
    return { next: idx };
  }

  function aclEntryMatches(entry, packet) {
    if (!entry || entry.action === "remark") return false;
    const proto = String(entry.proto || "ip").toLowerCase();
    if (proto !== "ip" && proto !== String(packet.proto || "ip").toLowerCase()) return false;
    if (!matchAddress(packet.srcIp, entry.src, entry.srcWildcard)) return false;
    if (entry.dst && !matchAddress(packet.dstIp, entry.dst, entry.dstWildcard)) return false;
    if (entry.dstPort != null && Number(packet.dstPort) !== Number(entry.dstPort)) return false;
    if (entry.srcPort != null && Number(packet.srcPort) !== Number(entry.srcPort)) return false;
    return true;
  }

  function parseAclSpec(action, spec, aclType) {
    const words = String(spec || "").trim().split(/\s+/).filter(Boolean);
    const parseHost = (idx) => {
      if (words[idx] === "any") return { value: "any", wildcard: "255.255.255.255", next: idx + 1 };
      if (words[idx] === "host") return { value: words[idx + 1], wildcard: "0.0.0.0", next: idx + 2 };
      return { value: words[idx], wildcard: words[idx + 1] || "0.0.0.0", next: idx + 2 };
    };
    if (aclType === "standard") {
      const src = parseHost(0);
      return { action, spec, src: src.value, srcWildcard: src.wildcard };
    }
    let idx = 0;
    let proto = "ip";
    if (/^(ip|icmp|tcp|udp)$/i.test(words[idx])) proto = words[idx++].toLowerCase();
    const src = parseHost(idx);
    const srcPort = parsePortSpec(words, src.next);
    const dst = parseHost(srcPort.next);
    const dstPort = parsePortSpec(words, dst.next);
    return {
      action, spec, proto,
      src: src.value, srcWildcard: src.wildcard,
      dst: dst.value, dstWildcard: dst.wildcard,
      ...(srcPort.op ? { srcPort: srcPort.port } : {}),
      ...(dstPort.op ? { dstPort: dstPort.port } : {}),
    };
  }

  function aclPermit(dev, aclName, packet) {
    const acl = dev.acls?.[aclName];
    if (!acl) return { ok: true, note: `ACL ${aclName} not found`, hit: { aclName, missing: true, action: "permit", note: `ACL ${aclName} not found` } };
    for (let idx = 0; idx < (acl.entries || []).length; idx++) {
      const raw = acl.entries[idx];
      if (raw.action === "remark") continue;
      const entry = raw.spec && raw.proto == null && raw.dst == null ? parseAclSpec(raw.action, raw.spec, acl.type) : raw;
      const pkt = acl.type === "standard" ? { ...packet, dstIp: packet.srcIp } : packet;
      if (aclEntryMatches(entry, pkt)) {
        return {
          ok: entry.action === "permit",
          note: `${aclName} ${entry.action}`,
          hit: {
            aclName,
            aclType: acl.type,
            index: idx,
            sequence: (idx + 1) * 10,
            action: entry.action,
            spec: raw.spec || entry.spec || `${entry.src || "any"}${entry.dst ? ` ${entry.dst}` : ""}`,
            source: packet.srcIp,
            destination: packet.dstIp,
            protocol: packet.proto,
            implicit: false,
          },
        };
      }
    }
    return {
      ok: false,
      note: `${aclName} implicit deny`,
      hit: { aclName, aclType: acl.type, action: "deny", source: packet.srcIp, destination: packet.dstIp, protocol: packet.proto, implicit: true, spec: "implicit deny ip any any" },
    };
  }

  function interfaceAclCheck(dev, ifaceName, direction, packet) {
    const aclName = dev.interfaces?.[ifaceName]?.acl?.[direction];
    const result = aclName ? aclPermit(dev, aclName, packet) : { ok: true };
    return {
      ...result,
      hit: result.hit ? { ...result.hit, deviceId: dev.id, device: dev.hostname, iface: ifaceName, direction } : null,
    };
  }

  function servicePort(name) {
    return ({ ftp: 21, ssh: 22, telnet: 23, smtp: 25, dns: 53, dhcp: 67, tftp: 69, http: 80, pop3: 110, ntp: 123, snmp: 161, radius: 1645, https: 443, syslog: 514, aaa: 1645 })[String(name || "").toLowerCase()] || Number(name) || 0;
  }

  function serviceEnabled(device, name) {
    if (!device) return false;
    if (Object.prototype.hasOwnProperty.call(device.services || {}, name)) return !!device.services[name];
    if (name === "ftp") return device.serverConfig?.ftp?.service ?? device.kind === "server";
    if (name === "https") return device.serverConfig?.http?.https ?? false;
    if (name === "smtp") return device.serverConfig?.email?.smtp ?? false;
    if (name === "pop3") return device.serverConfig?.email?.pop3 ?? false;
    if (name === "dns") return device.serverConfig?.dns?.service ?? false;
    if (name === "dhcp") return device.serverConfig?.dhcp?.service ?? false;
    if (name === "tftp") return device.serverConfig?.tftp?.service ?? false;
    if (name === "ssh") return !!(device.services?.ssh || device.crypto?.rsaKeys?.generated || device.lines?.vty?.transport?.includes?.("ssh"));
    if (name === "telnet") return !!(device.services?.telnet || device.lines?.vty?.transport?.includes?.("telnet"));
    if (name === "http") return device.serverConfig?.http?.http ?? device.services?.http ?? false;
    return !!device.services?.[name];
  }

  function deviceByIpOrName(devices, target) {
    const clean = String(target || "").replace(/\.$/, "").toLowerCase();
    if (!clean) return null;
    return Object.values(devices || {}).find((d) => {
      if ([d.hostname, d.name, d.model].some((v) => String(v || "").toLowerCase() === clean)) return true;
      return Object.values(d.interfaces || {}).some((i) => String(i.ip || "").toLowerCase() === clean);
    }) || null;
  }

  function resolveName(devices, name) {
    if (isIpv4(name)) return name;
    const dev = deviceByIpOrName(devices, name);
    if (dev) return firstIp(dev);
    const clean = String(name || "").replace(/\.$/, "").toLowerCase();
    for (const server of Object.values(devices || {})) {
      if (!serviceEnabled(server, "dns")) continue;
      for (const record of server.serverConfig?.dns?.records || []) {
        const recordName = String(record.name || "").replace(/\.$/, "").toLowerCase();
        const recordType = String(record.type || "").toLowerCase();
        if (recordName === clean && (!recordType || recordType.includes("a record") || recordType === "a")) return record.detail || "";
      }
    }
    return "";
  }

  function findReachableArpTarget(ctx, devId, ifaceName, targetIp, vlan) {
    const dev = ctx.devices[devId];
    const peer = E.findPeer(ctx.devices, ctx.links, devId, ifaceName);
    if (!peer) return null;
    const queue = [{ devId: peer.peerId, iface: peer.peerIface, vlan }];
    const seen = new Set();
    while (queue.length) {
      const item = queue.shift();
      const key = `${item.devId}:${item.iface}:${item.vlan}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const d = ctx.devices[item.devId];
      const ifc = d?.interfaces?.[item.iface];
      if (!d || !ifc || ifc.up === false || ifc.admUp === false) continue;
      const owned = ownsIp(d, targetIp);
      if (owned) return { dev: d, iface: owned, viaIface: item.iface, mac: d.interfaces[owned]?.mac || ifc.mac };
      if (!E.isSwitchLike(d) || ifc.routed) continue;
      const currentVlan = item.vlan ?? vlanOnIngress(ifc);
      for (const [name, pif] of Object.entries(d.interfaces || {})) {
        if (name === item.iface || name.toLowerCase().startsWith("vlan")) continue;
        if (!pif.up || pif.admUp === false || pif.stp?.state === "blocking" || !vlanAllows(pif, currentVlan)) continue;
        const next = E.findPeer(ctx.devices, ctx.links, d.id, name);
        if (next?.link?.up) queue.push({ devId: next.peerId, iface: next.peerIface, vlan: currentVlan });
      }
    }
    return null;
  }

  function arpResolve(ctx, dev, ifaceName, targetIp, vlan) {
    const ifc = dev.interfaces?.[ifaceName];
    if (!ifc) return { ok: false, error: `${dev.hostname} ${ifaceName} missing` };
    const cached = dev.runtime.arp.entries[targetIp] || (dev.arp?.[targetIp] ? { mac: dev.arp[targetIp], learnedAt: ctx.timeMs } : null);
    if (cached && ctx.timeMs - (cached.learnedAt || 0) < ARP_AGE_MS) {
      ctx.emit({ kind: "cache-hit", proto: "arp", srcDevice: dev.id, egress: ifaceName, vlan, note: `ARP cache hit ${targetIp} -> ${cached.mac}` });
      return { ok: true, mac: cached.mac };
    }
    ctx.emit({
      kind: "request",
      proto: "arp",
      srcDevice: dev.id,
      egress: ifaceName,
      vlan,
      frame: { srcMac: ifc.mac, dstMac: BROADCAST, etherType: "arp" },
      packet: { op: "request", senderIp: ifc.ip, targetIp },
      note: `${dev.hostname} asks who has ${targetIp}`,
    });
    const target = findReachableArpTarget(ctx, dev.id, ifaceName, targetIp, vlan);
    if (!target) {
      ctx.emit({ kind: "drop", proto: "arp", srcDevice: dev.id, egress: ifaceName, vlan, decision: "unresolved", note: `ARP unresolved for ${targetIp}` });
      return { ok: false, error: `ARP unresolved for ${targetIp}` };
    }
    const mac = target.mac || target.dev.interfaces[target.iface]?.mac;
    dev.runtime.arp.entries[targetIp] = { mac, iface: ifaceName, learnedAt: ctx.timeMs };
    dev.arp[targetIp] = mac;
    target.dev.runtime.arp.entries[ifc.ip] = { mac: ifc.mac, iface: target.iface, learnedAt: ctx.timeMs };
    target.dev.arp[ifc.ip] = ifc.mac;
    ctx.emit({
      kind: "reply",
      proto: "arp",
      srcDevice: target.dev.id,
      dstDevice: dev.id,
      ingress: target.iface,
      egress: ifaceName,
      vlan,
      frame: { srcMac: mac, dstMac: ifc.mac, etherType: "arp" },
      packet: { op: "reply", senderIp: targetIp, targetIp: ifc.ip },
      note: `${target.dev.hostname} replies ${targetIp} is ${mac}`,
    });
    return { ok: true, mac };
  }

  function learnMac(ctx, switchDev, iface, vlan, mac) {
    if (!mac) return;
    const key = `${vlan}:${mac}`;
    switchDev.runtime.macTable.entries[key] = { mac, vlan, iface, learnedAt: ctx.timeMs };
    switchDev.mac[key] = iface;
    for (const [k, entry] of Object.entries(switchDev.runtime.macTable.entries)) {
      if (ctx.timeMs - (entry.learnedAt || 0) > MAC_AGE_MS) delete switchDev.runtime.macTable.entries[k];
    }
  }

  function channelCompatible(aIf, bIf) {
    if (!aIf?.channelGroup && !bIf?.channelGroup) return true;
    if (!aIf?.channelGroup || !bIf?.channelGroup) return false;
    if (String(aIf.channelGroup.id) !== String(bIf.channelGroup.id)) return false;
    const a = aIf.channelGroup.mode, b = bIf.channelGroup.mode;
    if (a === "on" || b === "on") return a === b;
    if (["active", "passive"].includes(a) || ["active", "passive"].includes(b)) return ["active", "passive"].includes(a) && ["active", "passive"].includes(b) && (a === "active" || b === "active");
    if (["desirable", "auto"].includes(a) || ["desirable", "auto"].includes(b)) return ["desirable", "auto"].includes(a) && ["desirable", "auto"].includes(b) && (a === "desirable" || b === "desirable");
    return true;
  }

  function maybeNat(ctx, dev, ingressIface, egressIface, packet) {
    const inIf = dev.interfaces?.[ingressIface];
    const outIf = dev.interfaces?.[egressIface];
    if (!inIf || !outIf || inIf.natRole !== "inside" || outIf.natRole !== "outside") return packet;
    const rule = (dev.nat?.rules || []).find((r) => r.type === "static" || r.type === "pat-interface" || r.type === "pat-pool");
    if (!rule) return packet;
    let insideGlobal = packet.srcIp;
    let port = null;
    if (rule.type === "static" && rule.inside === packet.srcIp) {
      insideGlobal = rule.outside;
    } else if (rule.type === "pat-interface") {
      insideGlobal = outIf.ip || packet.srcIp;
      port = dev.runtime.nat.nextPort;
    } else if (rule.type === "pat-pool") {
      const pool = dev.nat?.pools?.[rule.pool];
      insideGlobal = pool?.start || outIf.ip || packet.srcIp;
      port = dev.runtime.nat.nextPort;
    }
    if (insideGlobal === packet.srcIp) return packet;
    const existing = (dev.nat?.translations || dev.runtime.nat.translations || []).find((item) => {
      const global = String(item.insideGlobal || "").split(":")[0];
      return (item.proto || "ip") === (packet.proto || "ip") &&
        item.insideLocal === packet.srcIp &&
        global === insideGlobal &&
        item.outsideLocal === packet.dstIp &&
        item.outsideGlobal === packet.dstIp;
    });
    if (existing) {
      const existingPort = String(existing.insideGlobal || "").match(/:(\d+)$/)?.[1];
      ctx.emit({ kind: "translate", proto: "nat", srcDevice: dev.id, egress: egressIface, packet, note: `NAT ${packet.srcIp} -> ${existing.insideGlobal}` });
      return { ...packet, preNatSrcIp: packet.srcIp, srcIp: String(existing.insideGlobal || insideGlobal).split(":")[0], srcPort: existingPort ? Number(existingPort) : packet.srcPort };
    }
    if (port) dev.runtime.nat.nextPort++;
    const translation = {
      proto: packet.proto || "ip",
      insideLocal: packet.srcIp,
      insideGlobal: port ? `${insideGlobal}:${port}` : insideGlobal,
      outsideLocal: packet.dstIp,
      outsideGlobal: packet.dstIp,
      createdAt: ctx.timeMs,
    };
    dev.runtime.nat.translations.push(translation);
    dev.nat.translations = [...(dev.nat.translations || []), translation];
    ctx.emit({ kind: "translate", proto: "nat", srcDevice: dev.id, egress: egressIface, packet, note: `NAT ${packet.srcIp} -> ${translation.insideGlobal}` });
    return { ...packet, preNatSrcIp: packet.srcIp, srcIp: insideGlobal, srcPort: port || packet.srcPort };
  }

  function computePath(ctx, srcId, dstIp, packetOptions = {}) {
    const src = ctx.devices[srcId];
    if (!src) return { ok: false, error: "Source device not found", hops: [] };
    if (!src.powered) return { ok: false, error: `${src.hostname} is powered off`, hops: [] };
    if (src.kind === "l2switch") return { ok: false, error: `${src.hostname} is a layer-2 switch - no routed management SVI is configured`, hops: [] };
    const origin = hostIp(src);
    if (!origin) return { ok: false, error: `${src.hostname} has no IP configured on an up interface`, hops: [] };

    let packet = {
      proto: packetOptions.proto || "icmp",
      srcIp: packetOptions.srcIp || origin.ip,
      dstIp,
      srcPort: packetOptions.srcPort,
      dstPort: packetOptions.dstPort,
      ttl: packetOptions.ttl || 64,
    };
    const hops = [{ devId: srcId, action: "originate", proto: packet.proto, note: `${src.hostname} crafts ${packet.proto.toUpperCase()} ${packet.srcIp} -> ${dstIp}` }];
    ctx.emit({ kind: "originate", proto: packet.proto, srcDevice: srcId, packet, note: hops[0].note });

    let nextHopIp = null, egressIface = null;
    const local = E.ifaceForDest(src, dstIp);
    if (local) {
      nextHopIp = dstIp; egressIface = local.name;
      hops.push({ devId: srcId, action: "arp-local", iface: egressIface, proto: "arp", note: `${dstIp} is local on ${egressIface}` });
    } else if (E.isRouterLike(src)) {
      const route = E.lookupRoute(src, dstIp);
      if (!route) return fail(ctx, `${src.hostname}: no route to ${dstIp}`, hops);
      const fwd = routeForwarding(src, route, dstIp);
      nextHopIp = fwd.nextHopIp; egressIface = fwd.iface;
      hops.push({ devId: srcId, action: "route", iface: egressIface, proto: packet.proto, note: `route ${route.dst}/${E.maskBits(route.mask)} ${route.type} via ${route.via}` });
    } else {
      const e = src.interfaces?.[origin.iface];
      if (!e.gw) return fail(ctx, `${src.hostname}: destination off-net and no default gateway configured`, hops);
      nextHopIp = e.gw; egressIface = origin.iface;
      hops.push({ devId: srcId, action: "arp-gw", iface: egressIface, proto: "arp", note: `${dstIp} off-net; gateway ${nextHopIp}` });
    }

    let curDev = src, curIface = egressIface, ingressIface = null, vlan = null;
    let guard = 0;
    while (guard++ < 64) {
      const outCheck = interfaceAclCheck(curDev, curIface, "out", packet);
      if (outCheck.hit) ctx.emit({ kind: "acl", proto: "acl", srcDevice: curDev.id, egress: curIface, decision: outCheck.ok ? "permit" : "deny", aclHit: outCheck.hit, packet, note: outCheck.note });
      if (!outCheck.ok) return fail(ctx, `${curDev.hostname} ${curIface}: ${outCheck.note}`, hops, curDev.id, outCheck.note);
      const egress = taggedEgress(ctx, curDev.id, curIface);
      const outIface = egress.iface || curIface;
      const outVlan = egress.vlan ?? vlan;
      const logicalIf = curDev.interfaces?.[curIface];
      const physicalIf = curDev.interfaces?.[outIface];
      if (!physicalIf || physicalIf.admUp === false || !physicalIf.up || logicalIf?.admUp === false) return fail(ctx, `${curDev.hostname} ${curIface} is down`, hops);
      if (nextHopIp) {
        const arp = arpResolve(ctx, curDev, outIface, nextHopIp, outVlan);
        if (!arp.ok) return fail(ctx, `${curDev.hostname}: ${arp.error}`, hops);
      }
      const peer = E.findPeer(ctx.devices, ctx.links, curDev.id, outIface);
      if (!peer) return fail(ctx, `No link connected to ${curDev.hostname} ${curIface}`, hops);
      if (!peer.link.up) return fail(ctx, `Link ${curDev.hostname} ${curIface} is down`, hops);
      const nb = ctx.devices[peer.peerId], nbIf = nb?.interfaces?.[peer.peerIface];
      if (!nb || !nb.powered || !nbIf?.up || nbIf.admUp === false) return fail(ctx, `Neighbor on ${curDev.hostname} ${curIface} is unreachable`, hops);
      if (!channelCompatible(physicalIf, nbIf)) return fail(ctx, `${curDev.hostname} ${outIface}: EtherChannel negotiation failed`, hops, curDev.id, "EtherChannel mismatch");
      ingressIface = peer.peerIface;
      hops.push({ devId: nb.id, action: "ingress", iface: ingressIface, proto: packet.proto, note: `arrives at ${nb.hostname} ${ingressIface}` });
      ctx.emit({
        kind: "deliver-l1",
        proto: packet.proto,
        srcDevice: curDev.id,
        dstDevice: nb.id,
        egress: outIface,
        ingress: ingressIface,
        vlan: outVlan,
        frame: { etherType: packet.proto === "icmp" ? "ipv4" : packet.proto },
        packet,
        note: `${curDev.hostname} ${outIface} -> ${nb.hostname} ${ingressIface}`,
      });

      const inCheck = interfaceAclCheck(nb, ingressIface, "in", packet);
      if (inCheck.hit) ctx.emit({ kind: "acl", proto: "acl", srcDevice: nb.id, ingress: ingressIface, decision: inCheck.ok ? "permit" : "deny", aclHit: inCheck.hit, packet, note: inCheck.note });
      if (!inCheck.ok) return fail(ctx, `${nb.hostname} ${ingressIface}: ${inCheck.note}`, hops, nb.id, inCheck.note);

      const owned = ownsIp(nb, dstIp);
      if (owned) {
        hops.push({ devId: nb.id, action: "deliver", iface: owned, proto: packet.proto, note: `delivered to ${nb.hostname} ${owned}`, ok: true });
        ctx.emit({ kind: "deliver-l3", proto: packet.proto, dstDevice: nb.id, ingress: owned, packet, decision: "accept", note: `delivered to ${nb.hostname} ${owned}` });
        return { ok: true, hops, packet };
      }

      if (E.isSwitchLike(nb) && !nb.interfaces[ingressIface]?.routed) {
        const inIf = nb.interfaces[ingressIface];
        vlan = outVlan ?? vlan ?? vlanOnIngress(inIf);
        learnMac(ctx, nb, ingressIface, vlan, curDev.interfaces?.[outIface]?.mac);
        if (!nb.vlans?.[vlan]) return fail(ctx, `${nb.hostname}: VLAN ${vlan} does not exist`, hops);
        if (!vlanAllows(inIf, vlan)) return fail(ctx, `${nb.hostname} ${ingressIface}: VLAN ${vlan} not allowed`, hops);
        if (inIf.stp?.state === "blocking" || nb.runtime?.stp?.blocked?.[`${vlan}:${ingressIface}`]) return fail(ctx, `${nb.hostname} ${ingressIface}: STP blocking`, hops);
        const candidates = [];
        for (const [pname, pifc] of Object.entries(nb.interfaces || {})) {
          if (pname === ingressIface || pname.toLowerCase().startsWith("vlan")) continue;
          if (!pifc.up || pifc.admUp === false || pifc.stp?.state === "blocking" || nb.runtime?.stp?.blocked?.[`${vlan}:${pname}`] || !vlanAllows(pifc, vlan)) continue;
          const next = E.findPeer(ctx.devices, ctx.links, nb.id, pname);
          if (!next?.link?.up) continue;
          const nd = ctx.devices[next.peerId], nif = nd?.interfaces?.[next.peerIface];
          if (!nd || !nif) continue;
          candidates.push({ pname, next, nd, nif });
        }
        let chosen = candidates.find((c) => c.nif.ip === nextHopIp || c.nif.ip === dstIp || ownsIp(c.nd, nextHopIp) || ownsIp(c.nd, dstIp));
        if (!chosen) chosen = candidates.find((c) => E.isRouterLike(c.nd));
        if (!chosen) chosen = candidates.find((c) => E.isHostLike(c.nd) && c.nif.ip && E.sameSubnet(c.nif.ip, dstIp, c.nif.mask || "255.255.255.0"));
        if (!chosen) return fail(ctx, `${nb.hostname}: no forwarding path in VLAN ${vlan} toward ${dstIp}`, hops);
        learnMac(ctx, nb, chosen.pname, vlan, chosen.nif.mac);
        hops.push({ devId: nb.id, action: "switch", iface: chosen.pname, proto: packet.proto, note: `VLAN ${vlan} egress ${chosen.pname}` });
        ctx.emit({ kind: "forward-l2", proto: packet.proto, srcDevice: nb.id, egress: chosen.pname, vlan, packet, decision: "forward", note: `VLAN ${vlan} egress ${chosen.pname}` });
        curDev = nb; curIface = chosen.pname;
        continue;
      }

      if (E.isRouterLike(nb)) {
        packet = { ...packet, ttl: packet.ttl - 1 };
        if (packet.ttl <= 0) return fail(ctx, `${nb.hostname}: TTL expired`, hops, nb.id, "ICMP time exceeded");
        const route = E.lookupRoute(nb, dstIp);
        if (!route) return fail(ctx, `${nb.hostname}: no route to host ${dstIp}`, hops, nb.id, "no route");
        const fwd = routeForwarding(nb, route, dstIp);
        packet = maybeNat(ctx, nb, ingressIface, fwd.iface, packet);
        nextHopIp = fwd.nextHopIp;
        hops.push({ devId: nb.id, action: "route", iface: fwd.iface, proto: packet.proto, note: `route ${route.dst}/${E.maskBits(route.mask)} ${route.type} via ${route.via}` });
        ctx.emit({ kind: "forward-l3", proto: packet.proto, srcDevice: nb.id, ingress: ingressIface, egress: fwd.iface, packet, decision: "route", note: `route ${route.dst}/${E.maskBits(route.mask)} via ${route.via}` });
        curDev = nb; curIface = fwd.iface; vlan = E.dot1qVlanForIface(fwd.iface, nb.interfaces?.[fwd.iface]);
        continue;
      }
      return fail(ctx, `Unsupported hop at ${nb.hostname}`, hops);
    }
    return fail(ctx, "Hop limit exceeded", hops);
  }

  function taggedEgress(ctx, devId, ifaceName) {
    const dev = ctx.devices?.[devId];
    const ifc = dev?.interfaces?.[ifaceName];
    const vlan = E.dot1qVlanForIface(ifaceName, ifc);
    return {
      iface: vlan == null ? ifaceName : (E.parentIfaceForTaggedEgress ? E.parentIfaceForTaggedEgress(ctx.devices, ctx.links, devId, ifaceName) : ifaceName),
      vlan,
    };
  }

  function fail(ctx, error, hops, devId, note) {
    ctx.emit({ kind: "drop", proto: "drop", srcDevice: devId, decision: "drop", note: note || error });
    return { ok: false, error, hops: [...(hops || []), ...(devId ? [{ devId, action: "drop", proto: "drop", note: note || error, ok: false }] : [])] };
  }

  function simulateIcmp(ctx) {
    const target = ctx.intent.dstIp || ctx.intent.targetIp || resolveName(ctx.devices, ctx.intent.target || "");
    const path = computePath(ctx, ctx.intent.srcId, target, { proto: "icmp", ttl: ctx.intent.ttl || 64 });
    if (!path.ok) return finish(ctx, path.ok, path.error, path.hops);
    ctx.emit({ kind: "echo-request", proto: "icmp", srcDevice: ctx.intent.srcId, dstDevice: path.hops.at(-1)?.devId, packet: path.packet, note: `ICMP echo request ${path.packet.srcIp} -> ${target}` });
    ctx.emit({ kind: "echo-reply", proto: "icmp", srcDevice: path.hops.at(-1)?.devId, dstDevice: ctx.intent.srcId, packet: { ...path.packet, srcIp: target, dstIp: path.packet.srcIp }, note: `ICMP echo reply ${target} -> ${path.packet.srcIp}` });
    const hops = [...path.hops, { devId: path.hops.at(-1)?.devId, action: "reply", proto: "icmp", note: `${ctx.devices[path.hops.at(-1)?.devId]?.hostname || "target"} sends ICMP echo-reply`, ok: true }];
    return finish(ctx, true, "", hops);
  }

  function simulateTcpConnect(ctx, protocolName) {
    const protoName = protocolName || ctx.intent.protocol || "tcp";
    const dstIp = ctx.intent.dstIp || resolveName(ctx.devices, ctx.intent.target || "");
    const target = deviceByIpOrName(ctx.devices, dstIp);
    const port = ctx.intent.dstPort || servicePort(protoName);
    const path = computePath(ctx, ctx.intent.srcId, dstIp, { proto: "tcp", dstPort: port, srcPort: ctx.intent.srcPort || 49152 });
    if (!path.ok) return finish(ctx, false, path.error, path.hops);
    ctx.emit({ kind: "syn", proto: "tcp", srcDevice: ctx.intent.srcId, dstDevice: target?.id, packet: { dstPort: port }, note: `TCP SYN dst port ${port}` });
    if (!target || !serviceEnabled(target, protoName)) {
      ctx.emit({ kind: "rst", proto: "tcp", srcDevice: target?.id, dstDevice: ctx.intent.srcId, decision: "closed", note: `${protoName} port ${port} refused` });
      return finish(ctx, false, `Connection refused on port ${port}`, path.hops);
    }
    ctx.emit({ kind: "syn-ack", proto: "tcp", srcDevice: target.id, dstDevice: ctx.intent.srcId, packet: { srcPort: port }, note: `TCP SYN-ACK from ${target.hostname}` });
    ctx.emit({ kind: "ack", proto: "tcp", srcDevice: ctx.intent.srcId, dstDevice: target.id, note: `TCP session established to ${target.hostname}:${port}` });
    return finish(ctx, true, "", path.hops);
  }

  function simulateDns(ctx) {
    const serverIp = ctx.intent.serverIp || findDnsServer(ctx.devices, ctx.intent.srcId);
    const name = ctx.intent.name || ctx.intent.target || "";
    if (!serverIp) return finish(ctx, false, "No DNS server configured", []);
    const udp = computePath(ctx, ctx.intent.srcId, serverIp, { proto: "udp", dstPort: 53, srcPort: 53000 });
    if (!udp.ok) return finish(ctx, false, udp.error, udp.hops);
    const answer = resolveName(ctx.devices, name);
    const src = ctx.devices[ctx.intent.srcId];
    if (src) src.runtime.dns.cache[name] = { answer, learnedAt: ctx.timeMs, ttl: 60 };
    ctx.emit({ kind: "query", proto: "dns", srcDevice: ctx.intent.srcId, packet: { qname: name, qtype: "A" }, note: `DNS A query ${name}` });
    ctx.emit({ kind: answer ? "answer" : "nxdomain", proto: "dns", dstDevice: ctx.intent.srcId, packet: { qname: name, answer }, decision: answer ? "answer" : "nxdomain", note: answer ? `${name} -> ${answer}` : `${name} NXDOMAIN` });
    return finish(ctx, !!answer, answer ? "" : `${name}: NXDOMAIN`, udp.hops, { answer });
  }

  function findDnsServer(devices, srcId) {
    const src = devices[srcId];
    const [, ifc] = primaryHostIface(src);
    if (ifc?.dns) return ifc.dns;
    const server = Object.values(devices || {}).find((d) => serviceEnabled(d, "dns") && firstIp(d));
    return firstIp(server);
  }

  function simulateHttp(ctx) {
    const raw = String(ctx.intent.url || ctx.intent.target || "").trim();
    const withoutScheme = raw.replace(/^https?:\/\//, "");
    const host = withoutScheme.split(/[/:]/)[0];
    const path = `/${withoutScheme.split("/").slice(1).join("/") || "index.html"}`.replace(/\/$/, "/index.html");
    const dstIp = ctx.intent.dstIp || resolveName(ctx.devices, host) || host;
    const target = deviceByIpOrName(ctx.devices, dstIp);
    const service = raw.startsWith("https://") ? "https" : "http";
    const tcp = simulateTcpConnect({ ...ctx, intent: { ...ctx.intent, dstIp, protocol: service, dstPort: servicePort(service) } }, service);
    if (!tcp.ok) return tcp;
    const fileName = path.replace(/^\//, "") || "index.html";
    const serverFile = (target?.serverConfig?.http?.files || []).find((f) => f.name === fileName) || (target?.serverConfig?.http?.files || []).find((f) => f.name === "index.html");
    const body = target?.files?.[`flash:${fileName}`] || target?.files?.["flash:index.html"] || serverFile?.content || `<html><body><h1>${target?.hostname || host}</h1></body></html>`;
    ctx.emit({ kind: "request", proto: "http", srcDevice: ctx.intent.srcId, dstDevice: target?.id, packet: { method: "GET", path }, note: `HTTP GET ${path}` });
    ctx.emit({ kind: "response", proto: "http", srcDevice: target?.id, dstDevice: ctx.intent.srcId, packet: { status: 200 }, note: "HTTP/1.1 200 OK" });
    return finish(ctx, true, "", tcp.hops, { body, status: 200 });
  }

  function simulateDhcp(ctx) {
    const client = ctx.devices[ctx.intent.srcId || ctx.intent.clientId];
    const [ifaceName, ifc] = primaryHostIface(client);
    if (!client || !ifaceName) return finish(ctx, false, "No host interface", []);
    const peer = E.findPeer(ctx.devices, ctx.links, client.id, ifaceName);
    if (!peer) return finish(ctx, false, "No DHCP server reachable", []);
    const vlan = E.isSwitchLike(ctx.devices[peer.peerId]) ? vlanOnIngress(ctx.devices[peer.peerId].interfaces?.[peer.peerIface]) : 1;
    ctx.emit({ kind: "discover", proto: "dhcp", srcDevice: client.id, egress: ifaceName, vlan, packet: { chaddr: ifc.mac }, note: `${client.hostname} broadcasts DHCPDISCOVER` });
    const found = findDhcpServer(ctx, client.id, ifaceName, vlan);
    if (!found) return finish(ctx, false, `No DHCP pool reachable for VLAN ${vlan}`, []);
    const { server, poolName, gatewayIp } = found;
    const pool = server.dhcp.pools[poolName];
    const used = new Set((server.dhcp.bindings || []).map((b) => b.ip));
    const excluded = server.dhcp.excluded || [];
    const isExcluded = (ip) => excluded.some((e) => E.ipToInt(ip) >= E.ipToInt(e.start) && E.ipToInt(ip) <= E.ipToInt(e.end || e.start));
    const base = E.ipToInt(E.networkAddress(pool.network, pool.mask));
    const broadcast = (base | (~E.ipToInt(pool.mask) >>> 0)) >>> 0;
    let offered = null;
    for (let n = base + 10; n < broadcast; n++) {
      const ip = E.intToIp(n);
      if (!used.has(ip) && !isExcluded(ip) && ip !== gatewayIp) { offered = ip; break; }
    }
    if (!offered) return finish(ctx, false, `DHCP pool ${poolName} has no free addresses`, []);
    ctx.emit({ kind: "offer", proto: "dhcp", srcDevice: server.id, dstDevice: client.id, packet: { yiaddr: offered, server: firstIp(server) }, note: `${server.hostname} offers ${offered}` });
    ctx.emit({ kind: "request", proto: "dhcp", srcDevice: client.id, dstDevice: server.id, packet: { requestedIp: offered }, note: `${client.hostname} requests ${offered}` });
    client.interfaces[ifaceName] = { ...client.interfaces[ifaceName], ip: offered, mask: pool.mask, gw: gatewayIp, dns: pool.dnsServer || ifc.dns || null, dnsSuffix: pool.domainName || ifc.dnsSuffix || "", dhcp: true, up: true, admUp: true };
    server.dhcp.bindings.push({ ip: offered, client: client.hostname, mac: ifc.mac, pool: poolName });
    server.runtime.dhcp.leases[ifc.mac] = { ip: offered, client: client.hostname, pool: poolName, leasedAt: ctx.timeMs, leaseMs: (pool.leaseDays || 1) * 86400000 };
    ctx.emit({ kind: "ack", proto: "dhcp", srcDevice: server.id, dstDevice: client.id, packet: { yiaddr: offered, router: gatewayIp, dns: pool.dnsServer }, note: `${client.hostname} leased ${offered} from ${server.hostname}` });
    return finish(ctx, true, "", [], { message: `${client.hostname} leased ${offered} from ${server.hostname}`, clientId: client.id, iface: ifaceName, ip: offered });
  }

  function findDhcpServer(ctx, clientId, clientIface, vlan) {
    const firstPeer = E.findPeer(ctx.devices, ctx.links, clientId, clientIface);
    const queue = firstPeer ? [firstPeer.peerId] : [];
    const seen = new Set();
    while (queue.length) {
      const id = queue.shift();
      if (seen.has(id)) continue;
      seen.add(id);
      const d = ctx.devices[id];
      if (!d) continue;
      for (const [name, ifc] of Object.entries(d.interfaces || {})) {
        const taggedVlan = E.dot1qVlanForIface(name, ifc);
        const ifaceUsable = ifc.ip && (ifc.up || (ifc.admUp !== false && taggedVlan != null));
        if (!ifaceUsable || (taggedVlan != null && String(taggedVlan) !== String(vlan))) continue;
        for (const [poolName, p] of Object.entries(d.dhcp?.pools || {})) {
          if (p.network && p.mask && E.sameSubnet(ifc.ip, p.network, p.mask)) return { server: d, poolName, gatewayIp: p.defaultRouter || ifc.ip };
        }
      }
      if (E.isSwitchLike(d)) {
        for (const l of ctx.links) {
          const iface = l.a === id ? l.ai : l.b === id ? l.bi : null;
          if (!iface) continue;
          const ifc = d.interfaces?.[iface];
          if (ifc?.up && ifc.admUp !== false && vlanAllows(ifc, vlan)) queue.push(l.a === id ? l.b : l.a);
        }
      }
      for (const ifc of Object.values(d.interfaces || {})) if (ifc.helperAddress) {
        const helper = deviceByIpOrName(ctx.devices, ifc.helperAddress);
        if (helper) queue.push(helper.id);
      }
    }
    return null;
  }

  function simulateUdp(ctx) {
    const dstIp = ctx.intent.dstIp || resolveName(ctx.devices, ctx.intent.target || "");
    const path = computePath(ctx, ctx.intent.srcId, dstIp, { proto: "udp", dstPort: ctx.intent.dstPort, srcPort: ctx.intent.srcPort });
    if (!path.ok) return finish(ctx, false, path.error, path.hops);
    ctx.emit({ kind: "datagram", proto: "udp", srcDevice: ctx.intent.srcId, dstDevice: path.hops.at(-1)?.devId, packet: { dstPort: ctx.intent.dstPort }, note: `UDP datagram to ${dstIp}:${ctx.intent.dstPort || 0}` });
    return finish(ctx, true, "", path.hops);
  }

  function simulateFileProtocol(ctx, protoName) {
    if (protoName === "tftp") {
      const dstIp = ctx.intent.dstIp || resolveName(ctx.devices, ctx.intent.target || "");
      const target = deviceByIpOrName(ctx.devices, dstIp);
      const udp = simulateUdp({ ...ctx, intent: { ...ctx.intent, dstIp, dstPort: 69 } });
      if (!udp.ok) return udp;
      if (!target || !serviceEnabled(target, "tftp")) return finish(ctx, false, "TFTP service unavailable", udp.hops);
      ctx.emit({ kind: "rrq", proto: "tftp", srcDevice: ctx.intent.srcId, dstDevice: target.id, packet: { file: ctx.intent.file || "startup-config" }, note: `TFTP RRQ ${ctx.intent.file || "startup-config"}` });
      ctx.emit({ kind: "data", proto: "tftp", srcDevice: target.id, dstDevice: ctx.intent.srcId, note: "TFTP DATA block 1" });
      return finish(ctx, true, "", udp.hops);
    }
    const tcp = simulateTcpConnect(ctx, protoName);
    if (!tcp.ok) return tcp;
    ctx.emit({ kind: "banner", proto: protoName, note: `${protoName.toUpperCase()} service ready` });
    return tcp;
  }

  function simulateOspf(ctx) {
    ctx.devices = E.recomputeDynamicRoutes(ctx.devices, ctx.links);
    const routers = Object.values(ctx.devices).filter((d) => E.isRouterLike(d) && Object.keys(d.ospf || {}).length);
    for (const a of routers) {
      for (const [aIfName, aIf] of Object.entries(a.interfaces || {})) {
        if (!aIf.ip || !aIf.up) continue;
        const peer = E.findPeer(ctx.devices, ctx.links, a.id, aIfName);
        const b = ctx.devices[peer?.peerId];
        const bIf = b?.interfaces?.[peer?.peerIface];
        if (!b || !bIf?.ip || !Object.keys(b.ospf || {}).length || !E.sameSubnet(aIf.ip, bIf.ip, aIf.mask)) continue;
        const ospfA = Object.values(a.ospf || {})[0] || {};
        const ospfB = Object.values(b.ospf || {})[0] || {};
        const ridA = ospfA.routerId || aIf.ip;
        const ridB = ospfB.routerId || bIf.ip;
        a.runtime.ospf.neighbors[ridB] = { routerId: ridB, state: "FULL", iface: aIfName, address: bIf.ip };
        b.runtime.ospf.neighbors[ridA] = { routerId: ridA, state: "FULL", iface: peer.peerIface, address: aIf.ip };
        ctx.emit({ kind: "hello", proto: "ospf", srcDevice: a.id, dstDevice: b.id, egress: aIfName, ingress: peer.peerIface, note: `${a.hostname} discovers OSPF neighbor ${ridB}` });
        ctx.emit({ kind: "adjacency", proto: "ospf", srcDevice: a.id, dstDevice: b.id, decision: "FULL", note: `${a.hostname} and ${b.hostname} reach FULL` });
      }
    }
    return finish(ctx, true, "", [], { routers: routers.length });
  }

  function simulateStp(ctx) {
    const switches = Object.values(ctx.devices).filter((d) => E.isSwitchLike(d));
    const vlans = new Set(switches.flatMap((d) => Object.keys(d.vlans || { 1: "default" })));
    for (const vlan of vlans) {
      const root = switches.slice().sort((a, b) => {
        const pa = Number(a.stp?.vlanPriority?.[vlan] ?? 32768);
        const pb = Number(b.stp?.vlanPriority?.[vlan] ?? 32768);
        return pa - pb || String(a.hostname).localeCompare(String(b.hostname));
      })[0];
      for (const sw of switches) sw.runtime.stp.rootByVlan[vlan] = root?.id || null;
      const seenPairs = new Set();
      for (const l of ctx.links) {
        const a = ctx.devices[l.a], b = ctx.devices[l.b];
        if (!E.isSwitchLike(a) || !E.isSwitchLike(b)) continue;
        const key = [a.id, b.id, vlan].sort().join(":");
        const aIf = a.interfaces?.[l.ai], bIf = b.interfaces?.[l.bi];
        if (!vlanAllows(aIf, vlan) || !vlanAllows(bIf, vlan)) continue;
        if (seenPairs.has(key)) {
          const blockDev = a.id === root?.id ? b : a;
          const blockIface = blockDev.id === a.id ? l.ai : l.bi;
          blockDev.runtime.stp.blocked[`${vlan}:${blockIface}`] = true;
          blockDev.interfaces[blockIface].stp = { ...(blockDev.interfaces[blockIface].stp || {}), state: "blocking" };
          ctx.emit({ kind: "port-state", proto: "stp", srcDevice: blockDev.id, egress: blockIface, vlan, decision: "blocking", note: `${blockDev.hostname} ${blockIface} blocks VLAN ${vlan}` });
        } else {
          seenPairs.add(key);
        }
      }
      ctx.emit({ kind: "root", proto: "stp", srcDevice: root?.id, vlan, decision: "root", note: `${root?.hostname || "switch"} is root for VLAN ${vlan}` });
    }
    return finish(ctx, true, "", [], { vlans: [...vlans] });
  }

  function finish(ctx, ok, error = "", hops = [], extra = {}) {
    ctx.ok = ok;
    ctx.error = error;
    ctx.tables = collectTables(ctx.devices);
    return { ok, error, devices: ctx.devices, events: ctx.events, packets: ctx.packets, tables: ctx.tables, hops, ...extra };
  }

  function collectTables(devices) {
    const tables = {};
    for (const [id, d] of Object.entries(devices || {})) {
      tables[id] = {
        arp: d.runtime?.arp?.entries || {},
        mac: d.runtime?.macTable?.entries || {},
        dhcp: d.runtime?.dhcp?.leases || {},
        nat: d.runtime?.nat?.translations || [],
        ospf: d.runtime?.ospf?.neighbors || {},
        stp: d.runtime?.stp || {},
      };
    }
    return tables;
  }

  function simulate(devices, links, intent, options = {}) {
    const ctx = makeContext(devices, links, intent, options);
    try {
      switch (intent?.type) {
        case "icmpEcho": return simulateIcmp(ctx);
        case "traceroute": return simulateIcmp({ ...ctx, intent: { ...ctx.intent, ttl: ctx.intent.ttl || 64 } });
        case "dhcpClient": return simulateDhcp(ctx);
        case "dnsQuery": return simulateDns(ctx);
        case "httpGet": return simulateHttp(ctx);
        case "ftpSession": return simulateFileProtocol(ctx, "ftp");
        case "tftpTransfer": return simulateFileProtocol(ctx, "tftp");
        case "sshSession": return simulateTcpConnect(ctx, "ssh");
        case "telnetSession": return simulateTcpConnect(ctx, "telnet");
        case "tcpConnect": return simulateTcpConnect(ctx, intent.protocol || "tcp");
        case "udpDatagram": return simulateUdp(ctx);
        case "ospfTick": return simulateOspf(ctx);
        case "stpTick": return simulateStp(ctx);
        default: return finish(ctx, false, `Unsupported intent ${intent?.type || "(missing)"}`, []);
      }
    } catch (err) {
      return finish(ctx, false, err?.message || String(err), []);
    }
  }

  function toLegacyPlan(result) {
    const events = result.events || [];
    const natTranslations = events
      .filter((event) => event.kind === "translate" && event.proto === "nat")
      .map((event) => ({
        deviceId: event.srcDevice,
        proto: event.packet?.proto || "ip",
        insideLocal: event.packet?.preNatSrcIp || event.packet?.srcIp,
        insideGlobal: event.note?.match(/->\s*(\S+)$/)?.[1] || event.packet?.srcIp,
        outsideLocal: event.packet?.dstIp,
        outsideGlobal: event.packet?.dstIp,
        egressIface: event.egress,
      }));
    const dnsAnswer = [...events].reverse().find((event) => event.proto === "dns" && (event.kind === "answer" || event.kind === "nxdomain"));
    const dhcpAck = [...events].reverse().find((event) => event.proto === "dhcp" && event.kind === "ack");
    const drop = [...events].reverse().find((event) => event.kind === "drop");
    return {
      ok: !!result.ok,
      error: result.error || "",
      hops: (result.hops || []).map((h) => ({ ...h, proto: h.proto || "icmp" })),
      events,
      packets: result.packets || [],
      devices: result.devices,
      tables: result.tables,
      artifacts: {
        aclHits: events.filter((event) => event.kind === "acl" && event.aclHit).map((event) => event.aclHit),
        natTranslations,
        dhcpLease: dhcpAck ? {
          ip: dhcpAck.packet?.yiaddr,
          router: dhcpAck.packet?.router,
          dns: dhcpAck.packet?.dns,
          serverId: dhcpAck.srcDevice,
          clientId: dhcpAck.dstDevice,
        } : null,
        dnsLookup: dnsAnswer ? {
          qname: dnsAnswer.packet?.qname,
          answer: dnsAnswer.packet?.answer || "",
          status: dnsAnswer.kind === "answer" ? "answer" : "nxdomain",
          serverId: dnsAnswer.srcDevice,
        } : null,
        drop: drop ? { deviceId: drop.srcDevice, reason: drop.note || result.error || "drop", decision: drop.decision } : null,
      },
    };
  }

  window.OPT_ProtocolRuntime = {
    simulate,
    toLegacyPlan,
    normalizeRuntime,
    serviceEnabled,
    servicePort,
    resolveName,
    parseAclSpec,
  };
})();
