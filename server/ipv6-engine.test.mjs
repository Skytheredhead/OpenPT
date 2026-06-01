import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function loadEngine() {
  const code = fs.readFileSync(new URL("../engine.jsx", import.meta.url), "utf8");
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(code, context, { filename: "engine.jsx" });
  return context.window.OPT_Engine;
}

const E = loadEngine();

function link(a, ai, b, bi) {
  return { id: E.uid("l"), a: a.id, ai, b: b.id, bi, type: "copper", up: true };
}

test("normalizes IPv6 and matches prefixes", () => {
  assert.equal(E.normalizeIpv6("2001:0db8:0001:0000:0000:0000:0000:0010"), "2001:db8:1::10");
  assert.equal(E.ipv6NetworkAddress("2001:db8:1::abcd", 64), "2001:db8:1::");
  assert.equal(E.ipv6InPrefix("2001:db8:1::20", "2001:db8:1::", 64), true);
  assert.equal(E.ipv6InPrefix("2001:db8:2::20", "2001:db8:1::", 64), false);
});

test("plans same-link IPv6 ping through a switch", () => {
  const sw = E.makeDevice("l2switch", "SW1", 0, 0, {
    "FastEthernet0/1": { up: true, admUp: true, vlan: 10 },
    "FastEthernet0/2": { up: true, admUp: true, vlan: 10 },
  }, { vlans: { 1: "default", 10: "USERS" } });
  const pc1 = E.makeDevice("pc", "PC1", 0, 0, { eth0: { ipv6: "2001:db8:10::10", ipv6PrefixLength: 64, up: true, admUp: true } });
  const pc2 = E.makeDevice("pc", "PC2", 0, 0, { eth0: { ipv6: "2001:db8:10::20", ipv6PrefixLength: 64, up: true, admUp: true } });
  const devices = { [sw.id]: sw, [pc1.id]: pc1, [pc2.id]: pc2 };
  const links = [link(sw, "FastEthernet0/1", pc1, "eth0"), link(sw, "FastEthernet0/2", pc2, "eth0")];
  const plan = E.planPath(devices, links, pc1.id, "2001:db8:10::20");
  assert.equal(plan.ok, true, plan.error);
  assert.equal(plan.family, "ipv6");
});

test("routes IPv6 across a router when unicast routing is enabled", () => {
  const r1 = E.makeDevice("router", "R1", 0, 0, {
    "GigabitEthernet0/0/0": { ipv6: "2001:db8:1::1", ipv6PrefixLength: 64, up: true, admUp: true },
    "GigabitEthernet0/0/1": { ipv6: "2001:db8:2::1", ipv6PrefixLength: 64, up: true, admUp: true },
  });
  const pc1 = E.makeDevice("pc", "PC1", 0, 0, { eth0: { ipv6: "2001:db8:1::10", ipv6PrefixLength: 64, ipv6Gw: E.ipv6LinkLocal(r1.interfaces["GigabitEthernet0/0/0"]), up: true, admUp: true } });
  const pc2 = E.makeDevice("pc", "PC2", 0, 0, { eth0: { ipv6: "2001:db8:2::20", ipv6PrefixLength: 64, up: true, admUp: true } });
  let devices = { [r1.id]: r1, [pc1.id]: pc1, [pc2.id]: pc2 };
  const links = [link(pc1, "eth0", r1, "GigabitEthernet0/0/0"), link(r1, "GigabitEthernet0/0/1", pc2, "eth0")];
  devices = E.recomputeDynamicRoutes(devices, links);
  const plan = E.planPath(devices, links, pc1.id, "2001:db8:2::20");
  assert.equal(plan.ok, true, plan.error);
});

test("fails routed IPv6 when router unicast routing is disabled", () => {
  const r1 = E.makeDevice("router", "R1", 0, 0, {
    "GigabitEthernet0/0/0": { ipv6: "2001:db8:1::1", ipv6PrefixLength: 64, up: true, admUp: true },
    "GigabitEthernet0/0/1": { ipv6: "2001:db8:2::1", ipv6PrefixLength: 64, up: true, admUp: true },
  }, { ipv6Routing: false });
  const pc1 = E.makeDevice("pc", "PC1", 0, 0, { eth0: { ipv6: "2001:db8:1::10", ipv6PrefixLength: 64, ipv6Gw: E.ipv6LinkLocal(r1.interfaces["GigabitEthernet0/0/0"]), up: true, admUp: true } });
  const pc2 = E.makeDevice("pc", "PC2", 0, 0, { eth0: { ipv6: "2001:db8:2::20", ipv6PrefixLength: 64, up: true, admUp: true } });
  let devices = { [r1.id]: r1, [pc1.id]: pc1, [pc2.id]: pc2 };
  const links = [link(pc1, "eth0", r1, "GigabitEthernet0/0/0"), link(r1, "GigabitEthernet0/0/1", pc2, "eth0")];
  devices = E.recomputeDynamicRoutes(devices, links);
  const plan = E.planPath(devices, links, pc1.id, "2001:db8:2::20");
  assert.equal(plan.ok, false);
  assert.match(plan.error, /IPv6 unicast routing is disabled/);
});

test("SLAAC assigns host address from reachable router prefix", () => {
  const r1 = E.makeDevice("router", "R1", 0, 0, {
    "GigabitEthernet0/0/0": { ipv6: "2001:db8:55::1", ipv6PrefixLength: 64, up: true, admUp: true },
  });
  const pc1 = E.makeDevice("pc", "PC1", 0, 0, { eth0: { up: true, admUp: true } });
  let devices = { [r1.id]: r1, [pc1.id]: pc1 };
  const links = [link(pc1, "eth0", r1, "GigabitEthernet0/0/0")];
  const result = E.applySlaac(devices, links, pc1.id);
  assert.match(result.devices[pc1.id].interfaces.eth0.ipv6, /^2001:db8:55:/);
  assert.equal(result.devices[pc1.id].interfaces.eth0.ipv6Source, "slaac");
});

test("DHCPv6 leases a host address from Server-PT pool", () => {
  const sw = E.makeDevice("l2switch", "SW1", 0, 0, {
    "FastEthernet0/1": { up: true, admUp: true, vlan: 10 },
    "FastEthernet0/2": { up: true, admUp: true, vlan: 10 },
  }, { vlans: { 1: "default", 10: "USERS" } });
  const srv = E.makeDevice("server", "SRV", 0, 0, {
    eth0: { ipv6: "2001:db8:66::5", ipv6PrefixLength: 64, up: true, admUp: true },
  }, { services: { dhcpv6: true }, dhcpv6: { pools: { IPv6Pool: { prefix: "2001:db8:66::", prefixLength: 64, dnsServer: "2001:db8:66::5" } }, bindings: [] } });
  const pc1 = E.makeDevice("pc", "PC1", 0, 0, { eth0: { up: true, admUp: true } });
  const devices = { [sw.id]: sw, [srv.id]: srv, [pc1.id]: pc1 };
  const links = [link(sw, "FastEthernet0/1", srv, "eth0"), link(sw, "FastEthernet0/2", pc1, "eth0")];
  const result = E.allocateDhcpv6(devices, links, pc1.id);
  assert.equal(result.devices[pc1.id].interfaces.eth0.ipv6, "2001:db8:66::100");
  assert.equal(result.devices[pc1.id].interfaces.eth0.ipv6Source, "dhcpv6");
});
