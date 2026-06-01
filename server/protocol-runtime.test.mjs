import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadRuntime() {
  const context = { window: {}, console };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(readFileSync(join(__dirname, "..", "engine.jsx"), "utf8"), context, { filename: "engine.jsx" });
  vm.runInContext(readFileSync(join(__dirname, "..", "protocol-runtime.jsx"), "utf8"), context, { filename: "protocol-runtime.jsx" });
  return context.window;
}

function up(extra = {}) {
  return { up: true, admUp: true, ...extra };
}

function connect(E, a, ai, b, bi, type = "copper") {
  a.interfaces[ai] = { ...(a.interfaces[ai] || {}), up: true, admUp: true };
  b.interfaces[bi] = { ...(b.interfaces[bi] || {}), up: true, admUp: true };
  return { id: E.uid("l"), a: a.id, ai, b: b.id, bi, type, up: true };
}

function map(devices) {
  return Object.fromEntries(devices.map((d) => [d.id, d]));
}

test("ICMP uses ARP and learns switch MAC entries", () => {
  const { OPT_Engine: E, OPT_ProtocolRuntime: R } = loadRuntime();
  const sw = E.makeDevice("l2switch", "SW1", 300, 200, {
    "FastEthernet0/1": up(),
    "FastEthernet0/2": up(),
  });
  const pc1 = E.makeDevice("pc", "PC1", 100, 300, { eth0: up({ ip: "192.168.1.10", mask: "255.255.255.0" }) });
  const pc2 = E.makeDevice("pc", "PC2", 500, 300, { eth0: up({ ip: "192.168.1.20", mask: "255.255.255.0" }) });
  const links = [
    connect(E, pc1, "eth0", sw, "FastEthernet0/1"),
    connect(E, pc2, "eth0", sw, "FastEthernet0/2"),
  ];

  const result = R.simulate(map([sw, pc1, pc2]), links, { type: "icmpEcho", srcId: pc1.id, dstIp: "192.168.1.20" });

  assert.equal(result.ok, true);
  assert.ok(result.events.some((e) => e.proto === "arp" && e.kind === "request"));
  assert.equal(result.devices[pc1.id].arp["192.168.1.20"], pc2.interfaces.eth0.mac);
  assert.ok(Object.keys(result.tables[sw.id].mac).some((key) => key.startsWith("1:")));
  const plan = R.toLegacyPlan(result);
  assert.ok(plan.hops.some((hop) => hop.action === "switch"));
  assert.ok(plan.hops.some((hop) => hop.action === "deliver"));
});

test("DHCP performs DORA and writes the host lease", () => {
  const { OPT_Engine: E, OPT_ProtocolRuntime: R } = loadRuntime();
  const sw = E.makeDevice("l2switch", "SW1", 300, 200, {
    "FastEthernet0/1": up(),
    "FastEthernet0/2": up(),
  });
  const r1 = E.makeDevice("router", "R1", 500, 200, {
    "GigabitEthernet0/0/0": up({ ip: "192.168.10.1", mask: "255.255.255.0" }),
  });
  r1.dhcp.pools.LAN = { network: "192.168.10.0", mask: "255.255.255.0", defaultRouter: "192.168.10.1", dnsServer: "192.168.10.53" };
  r1.dhcp.excluded = [{ start: "192.168.10.1", end: "192.168.10.10" }];
  const pc = E.makeDevice("pc", "PC1", 100, 200, { eth0: up({ ip: null, mask: null, gw: null, dhcp: true }) });
  const links = [
    connect(E, pc, "eth0", sw, "FastEthernet0/1"),
    connect(E, r1, "GigabitEthernet0/0/0", sw, "FastEthernet0/2"),
  ];

  const result = R.simulate(map([sw, r1, pc]), links, { type: "dhcpClient", srcId: pc.id });

  assert.equal(result.ok, true);
  assert.equal(result.devices[pc.id].interfaces.eth0.ip, "192.168.10.11");
  assert.equal(result.devices[pc.id].interfaces.eth0.gw, "192.168.10.1");
  assert.ok(result.events.some((e) => e.kind === "discover"));
  assert.ok(result.events.some((e) => e.kind === "ack"));
  assert.deepEqual(JSON.parse(JSON.stringify(R.toLegacyPlan(result).artifacts.dhcpLease)), {
    ip: "192.168.10.11",
    router: "192.168.10.1",
    dns: "192.168.10.53",
    serverId: r1.id,
    clientId: pc.id,
  });
});

test("extended ACLs enforce protocol and destination port", () => {
  const { OPT_Engine: E, OPT_ProtocolRuntime: R } = loadRuntime();
  const pc = E.makeDevice("pc", "PC1", 80, 200, { eth0: up({ ip: "192.168.1.10", mask: "255.255.255.0", gw: "192.168.1.1" }) });
  const r1 = E.makeDevice("router", "R1", 300, 200, {
    "GigabitEthernet0/0/0": up({ ip: "192.168.1.1", mask: "255.255.255.0" }),
    "GigabitEthernet0/0/1": up({ ip: "192.168.2.1", mask: "255.255.255.0", acl: { out: "WEBBLOCK" } }),
  });
  r1.acls.WEBBLOCK = {
    type: "extended",
    entries: [{ action: "deny", spec: "tcp any any eq 80" }, { action: "permit", spec: "ip any any" }],
  };
  const srv = E.makeDevice("server", "SRV1", 520, 200, { eth0: up({ ip: "192.168.2.20", mask: "255.255.255.0", gw: "192.168.2.1" }) });
  const links = [
    connect(E, pc, "eth0", r1, "GigabitEthernet0/0/0", "cross"),
    connect(E, srv, "eth0", r1, "GigabitEthernet0/0/1", "cross"),
  ];

  const result = R.simulate(map([pc, r1, srv]), links, { type: "httpGet", srcId: pc.id, url: "http://192.168.2.20/index.html" });

  assert.equal(result.ok, false);
  assert.match(result.error, /WEBBLOCK deny/);
  const aclHit = R.toLegacyPlan(result).artifacts.aclHits[0];
  assert.equal(aclHit.aclName, "WEBBLOCK");
  assert.equal(aclHit.action, "deny");
  assert.equal(aclHit.direction, "out");
  assert.equal(aclHit.iface, "GigabitEthernet0/0/1");
});

test("implicit ACL deny is exposed as packet trace metadata", () => {
  const { OPT_Engine: E, OPT_ProtocolRuntime: R } = loadRuntime();
  const pc = E.makeDevice("pc", "PC1", 80, 200, { eth0: up({ ip: "192.168.1.10", mask: "255.255.255.0", gw: "192.168.1.1" }) });
  const r1 = E.makeDevice("router", "R1", 300, 200, {
    "GigabitEthernet0/0/0": up({ ip: "192.168.1.1", mask: "255.255.255.0" }),
    "GigabitEthernet0/0/1": up({ ip: "192.168.2.1", mask: "255.255.255.0", acl: { out: "ONLYSSH" } }),
  });
  r1.acls.ONLYSSH = {
    type: "extended",
    entries: [{ action: "permit", spec: "tcp any any eq 22" }],
  };
  const srv = E.makeDevice("server", "SRV1", 520, 200, { eth0: up({ ip: "192.168.2.20", mask: "255.255.255.0", gw: "192.168.2.1" }) });
  const links = [
    connect(E, pc, "eth0", r1, "GigabitEthernet0/0/0", "cross"),
    connect(E, srv, "eth0", r1, "GigabitEthernet0/0/1", "cross"),
  ];

  const result = R.simulate(map([pc, r1, srv]), links, { type: "httpGet", srcId: pc.id, url: "http://192.168.2.20/index.html" });
  const aclHit = R.toLegacyPlan(result).artifacts.aclHits[0];

  assert.equal(result.ok, false);
  assert.equal(aclHit.aclName, "ONLYSSH");
  assert.equal(aclHit.action, "deny");
  assert.equal(aclHit.implicit, true);
});

test("PAT creates a NAT translation when crossing inside to outside", () => {
  const { OPT_Engine: E, OPT_ProtocolRuntime: R } = loadRuntime();
  const pc = E.makeDevice("pc", "PC1", 80, 200, { eth0: up({ ip: "10.0.0.10", mask: "255.255.255.0", gw: "10.0.0.1" }) });
  const r1 = E.makeDevice("router", "R1", 300, 200, {
    "GigabitEthernet0/0/0": up({ ip: "10.0.0.1", mask: "255.255.255.0", natRole: "inside" }),
    "GigabitEthernet0/0/1": up({ ip: "203.0.113.1", mask: "255.255.255.0", natRole: "outside" }),
  });
  r1.nat.rules = [{ type: "pat-interface", acl: "1", iface: "GigabitEthernet0/0/1", config: "ip nat inside source list 1 interface GigabitEthernet0/0/1 overload" }];
  const srv = E.makeDevice("server", "INET", 520, 200, { eth0: up({ ip: "203.0.113.20", mask: "255.255.255.0", gw: "203.0.113.1" }) });
  const links = [
    connect(E, pc, "eth0", r1, "GigabitEthernet0/0/0", "cross"),
    connect(E, srv, "eth0", r1, "GigabitEthernet0/0/1", "cross"),
  ];

  const result = R.simulate(map([pc, r1, srv]), links, { type: "icmpEcho", srcId: pc.id, dstIp: "203.0.113.20" });
  const second = R.simulate(result.devices, links, { type: "icmpEcho", srcId: pc.id, dstIp: "203.0.113.20" });

  assert.equal(result.ok, true);
  assert.equal(result.devices[r1.id].nat.translations.length, 1);
  assert.equal(second.devices[r1.id].nat.translations.length, 1);
  assert.ok(result.events.some((e) => e.proto === "nat" && e.kind === "translate"));
  assert.equal(R.toLegacyPlan(result).artifacts.natTranslations[0].insideLocal, "10.0.0.10");
});

test("DNS trace artifacts distinguish record hits and NXDOMAIN", () => {
  const { OPT_Engine: E, OPT_ProtocolRuntime: R } = loadRuntime();
  const pc = E.makeDevice("pc", "PC1", 80, 200, { eth0: up({ ip: "192.168.53.10", mask: "255.255.255.0", gw: "192.168.53.1", dns: "192.168.53.53" }) });
  const dns = E.makeDevice("server", "DNS1", 300, 200, { eth0: up({ ip: "192.168.53.53", mask: "255.255.255.0" }) });
  dns.services.dns = true;
  dns.serverConfig = { ...(dns.serverConfig || {}), dns: { service: true, records: [{ name: "web.openpt.test", type: "A Record", detail: "192.168.53.80" }] } };
  const links = [connect(E, pc, "eth0", dns, "eth0", "cross")];

  const hit = R.simulate(map([pc, dns]), links, { type: "dnsQuery", srcId: pc.id, name: "web.openpt.test" });
  const miss = R.simulate(map([pc, dns]), links, { type: "dnsQuery", srcId: pc.id, name: "missing.openpt.test" });

  assert.equal(hit.ok, true);
  assert.equal(R.toLegacyPlan(hit).artifacts.dnsLookup.answer, "192.168.53.80");
  assert.equal(miss.ok, false);
  assert.equal(R.toLegacyPlan(miss).artifacts.dnsLookup.status, "nxdomain");
});

test("OSPF tick records full neighbors and learned routes", () => {
  const { OPT_Engine: E, OPT_ProtocolRuntime: R } = loadRuntime();
  const r1 = E.makeDevice("router", "R1", 100, 200, {
    "GigabitEthernet0/0/0": up({ ip: "10.0.0.1", mask: "255.255.255.252" }),
    "GigabitEthernet0/0/1": up({ ip: "192.168.1.1", mask: "255.255.255.0" }),
  });
  const r2 = E.makeDevice("router", "R2", 400, 200, {
    "GigabitEthernet0/0/0": up({ ip: "10.0.0.2", mask: "255.255.255.252" }),
    "GigabitEthernet0/0/1": up({ ip: "192.168.2.1", mask: "255.255.255.0" }),
  });
  r1.ospf[1] = { routerId: "1.1.1.1", networks: [{ network: "10.0.0.0", wildcard: "0.0.0.3", area: "0" }, { network: "192.168.1.0", wildcard: "0.0.0.255", area: "0" }], passive: [] };
  r2.ospf[1] = { routerId: "2.2.2.2", networks: [{ network: "10.0.0.0", wildcard: "0.0.0.3", area: "0" }, { network: "192.168.2.0", wildcard: "0.0.0.255", area: "0" }], passive: [] };
  const links = [connect(E, r1, "GigabitEthernet0/0/0", r2, "GigabitEthernet0/0/0", "cross")];

  const result = R.simulate(map([r1, r2]), links, { type: "ospfTick" });

  assert.equal(result.ok, true);
  assert.equal(result.devices[r1.id].runtime.ospf.neighbors["2.2.2.2"].state, "FULL");
  assert.ok(result.devices[r1.id].routes.some((route) => route.type === "O" && route.dst === "192.168.2.0"));
});

test("STP tick blocks a redundant switch-to-switch link", () => {
  const { OPT_Engine: E, OPT_ProtocolRuntime: R } = loadRuntime();
  const a = E.makeDevice("l2switch", "SWA", 100, 200, {
    "FastEthernet0/1": up({ mode: "trunk" }),
    "FastEthernet0/2": up({ mode: "trunk" }),
  });
  const b = E.makeDevice("l2switch", "SWB", 400, 200, {
    "FastEthernet0/1": up({ mode: "trunk" }),
    "FastEthernet0/2": up({ mode: "trunk" }),
  });
  a.stp.vlanPriority[1] = 24576;
  const links = [
    connect(E, a, "FastEthernet0/1", b, "FastEthernet0/1"),
    connect(E, a, "FastEthernet0/2", b, "FastEthernet0/2"),
  ];

  const result = R.simulate(map([a, b]), links, { type: "stpTick" });

  assert.equal(result.ok, true);
  assert.equal(result.devices[a.id].runtime.stp.rootByVlan[1], a.id);
  assert.ok(result.events.some((event) => event.proto === "stp" && event.decision === "blocking"));
});
