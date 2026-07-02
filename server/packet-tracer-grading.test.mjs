import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appSource = readFileSync(join(__dirname, "..", "app.jsx"), "utf8");
const start = appSource.indexOf("function packetTracerAssessmentText");
const end = appSource.indexOf("function sanitizePacketTracerHtml");
if (start < 0 || end < 0 || end <= start) throw new Error("Could not locate Packet Tracer grading helpers in app.jsx");

const context = {
  OPT_Engine: {
    shortIfaceName(name) {
      return String(name || "")
        .replace(/^FastEthernet/i, "Fa")
        .replace(/^GigabitEthernet/i, "Gi")
        .replace(/^Serial/i, "Se")
        .replace(/^Port-channel/i, "Po");
    },
    serializeConfig(device = {}) {
      const out = [`hostname ${device.hostname || device.name || "Device"}`];
      for (const [name, ifc] of Object.entries(device.interfaces || {})) {
        out.push(`interface ${name}`);
        if (ifc.mode) out.push(` switchport mode ${ifc.mode}`);
        if (ifc.vlan) out.push(` switchport access vlan ${ifc.vlan}`);
        if (ifc.nativeVlan && ifc.nativeVlan !== 1) out.push(` switchport trunk native vlan ${ifc.nativeVlan}`);
        if (ifc.allowedVlans && ifc.allowedVlans !== "all") out.push(` switchport trunk allowed vlan ${ifc.allowedVlans}`);
        if (ifc.channelGroup) out.push(` channel-group ${ifc.channelGroup.id} mode ${ifc.channelGroup.mode}`);
        if (ifc.portSecurity?.enabled) out.push(" switchport port-security");
        if (ifc.ospfPriority !== undefined) out.push(` ip ospf priority ${ifc.ospfPriority}`);
        if (ifc.ip) out.push(` ip address ${ifc.ip} ${ifc.mask}`);
      }
      for (const route of device.routes || []) if (route.type === "S") out.push(`ip route ${route.dst} ${route.mask} ${route.via}`);
      for (const [name, acl] of Object.entries(device.acls || {})) for (const entry of acl.entries || []) out.push(`access-list ${name} ${entry.action} ${entry.spec || ""}`.trim());
      for (const rule of device.nat?.rules || []) out.push(rule.config);
      for (const [name, pool] of Object.entries(device.dhcp?.pools || {})) out.push(`ip dhcp pool ${name}`, ` network ${pool.network} ${pool.mask}`);
      if (device.dhcpSnooping?.enabled) out.push("ip dhcp snooping");
      if (device.stp?.vlanPriority?.[10]) out.push(`spanning-tree vlan 10 priority ${device.stp.vlanPriority[10]}`);
      if (device.ssh?.version) out.push(`ip ssh version ${device.ssh.version}`);
      return out.join("\n");
    },
    planPath(devices, links, srcId, dstIp) {
      return dstIp === "192.0.2.10"
        ? { ok: true, hops: [{ devId: srcId, action: "deliver" }] }
        : { ok: false, error: "no route", hops: [] };
    },
  },
};
vm.createContext(context);
vm.runInContext(`
function packetTracerAssessmentPathParts(item) {
  if (Array.isArray(item?.pathParts) && item.pathParts.length) return item.pathParts;
  return String(item?.path || item?.name || "Assessment Item").split(/\\s*\\/\\s*/).filter(Boolean);
}
${appSource.slice(start, end)}
globalThis.gradePacketTracerActivity = gradePacketTracerActivity;
`, context);

function switchDevice(id, hostname, interfaces = {}) {
  return {
    id,
    kind: "l2switch",
    hostname,
    name: hostname,
    packetTracer: { name: hostname },
    interfaces,
  };
}

function routerDevice(id, hostname, extra = {}) {
  return {
    id,
    kind: "router",
    hostname,
    name: hostname,
    packetTracer: { name: hostname },
    interfaces: {},
    routes: [],
    acls: {},
    nat: { pools: {}, rules: [], translations: [] },
    dhcp: { excluded: [], pools: {}, bindings: [] },
    dhcpSnooping: { enabled: false, vlans: [], trusted: [] },
    stp: { vlanPriority: {} },
    ...extra,
  };
}

function iface(extra = {}) {
  return {
    up: true,
    admUp: true,
    mode: "access",
    vlan: 1,
    nativeVlan: 1,
    allowedVlans: "all",
    ...extra,
  };
}

function grade(activity, devices, links) {
  return context.gradePacketTracerActivity(activity, devices, links);
}

test("grades a decoded expected link only when the peer and interface match", () => {
  const devices = {
    a: switchDevice("a", "SWA", { "GigabitEthernet0/1": iface() }),
    b: switchDevice("b", "SWB", { "GigabitEthernet0/1": iface() }),
    c: switchDevice("c", "SWC", { "GigabitEthernet0/1": iface() }),
  };
  const links = [{ id: "l1", a: "a", ai: "GigabitEthernet0/1", b: "b", bi: "GigabitEthernet0/1", type: "copper" }];
  const correct = grade({
    assessmentItems: [{
      path: "SWA / GigabitEthernet0/1 / Link to SWB: connects to GigabitEthernet0/1",
      pathParts: ["SWA", "GigabitEthernet0/1", "Link to SWB: connects to GigabitEthernet0/1"],
      components: "Device Connections",
      points: 1,
    }],
  }, devices, links).assessmentItems[0];
  assert.equal(correct.correct, true);
  assert.equal(correct.earnedPoints, 1);

  const wrong = grade({
    assessmentItems: [{
      path: "SWA / GigabitEthernet0/1 / Link to SWC: connects to GigabitEthernet0/1",
      pathParts: ["SWA", "GigabitEthernet0/1", "Link to SWC: connects to GigabitEthernet0/1"],
      components: "Device Connections",
      points: 1,
    }],
  }, devices, links).assessmentItems[0];
  assert.equal(wrong.correct, false);
  assert.equal(wrong.status, "Incorrect");
  assert.equal(wrong.earnedPoints, 0);
});

test("leaves generic connection and unsupported items unchecked", () => {
  const devices = {
    a: switchDevice("a", "SWA", { "GigabitEthernet0/1": iface() }),
    b: switchDevice("b", "SWB", { "GigabitEthernet0/1": iface() }),
  };
  const links = [{ id: "l1", a: "a", ai: "GigabitEthernet0/1", b: "b", bi: "GigabitEthernet0/1", type: "copper" }];
  const result = grade({
    assessmentItems: [
      {
        path: "SWA / GigabitEthernet0/1 / Connection",
        pathParts: ["SWA", "GigabitEthernet0/1", "Connection"],
        components: "Device Connections",
        points: 1,
      },
      {
        path: "SWA / GigabitEthernet0/1 / VLAN Name",
        pathParts: ["SWA", "GigabitEthernet0/1", "VLAN Name"],
        components: "Device Connections",
        points: 1,
      },
    ],
  }, devices, links);
  assert.equal(result.assessmentItems[0].status, "Unchecked");
  assert.equal(result.assessmentItems[0].earnedPoints, 0);
  assert.equal(result.assessmentItems[1].status, "Unchecked");
  assert.equal(result.progress.score, "0/2");
});

test("parses interface ranges for trunk and channel grading", () => {
  const devices = {
    a: switchDevice("a", "SWA", {
      "GigabitEthernet0/1": iface({ mode: "trunk", channelGroup: { id: 1, mode: "active" } }),
      "GigabitEthernet0/2": iface({ mode: "trunk", channelGroup: { id: 1, mode: "active" } }),
    }),
  };
  const result = grade({
    answerCommands: {
      SWA: [
        "interface range GigabitEthernet0/1 - 2",
        "switchport mode trunk",
        "channel-group 1 mode active",
      ],
    },
    assessmentItems: [
      {
        path: "SWA / GigabitEthernet0/2 / Port Mode",
        pathParts: ["SWA", "GigabitEthernet0/2", "Port Mode"],
        components: "Trunk Configuration",
        points: 1,
      },
      {
        path: "SWA / GigabitEthernet0/2 / Channel Group",
        pathParts: ["SWA", "GigabitEthernet0/2", "Channel Group"],
        components: "EtherChannel Configuration",
        points: 3,
      },
      {
        path: "SWA / GigabitEthernet0/2 / Channel Mode",
        pathParts: ["SWA", "GigabitEthernet0/2", "Channel Mode"],
        components: "EtherChannel Configuration",
        points: 3,
      },
    ],
  }, devices, []);
  assert.equal(result.progress.score, "7/7");
  assert.equal(result.assessmentItems.every((item) => item.correct), true);
});

test("grades structured assessmentModel leaves before legacy flat items", () => {
  const devices = {
    r1: routerDevice("r1", "R1", {
      interfaces: { "GigabitEthernet0/0": iface({ ip: "10.0.0.1", mask: "255.255.255.0" }) },
    }),
  };
  const result = grade({
    assessmentModel: {
      leaves: [{
        visible: true,
        path: "R1 / GigabitEthernet0/0 / IP Address",
        pathParts: ["R1", "GigabitEthernet0/0", "IP Address"],
        components: "IP Configuration",
        points: 2,
        expected: { primary: "10.0.0.1", ip: "10.0.0.1" },
        target: { deviceName: "R1", interfaceName: "GigabitEthernet0/0" },
      }],
    },
    assessmentItems: [{
      path: "R1 / GigabitEthernet0/0 / IP Address",
      pathParts: ["R1", "GigabitEthernet0/0", "IP Address"],
      components: "IP Configuration",
      points: 99,
      value: "192.0.2.1",
    }],
  }, devices, []);
  assert.equal(result.assessmentItems.length, 1);
  assert.equal(result.assessmentItems[0].correct, true);
  assert.equal(result.assessmentItems[0].earnedPoints, 2);
  assert.equal(result.assessmentItems[0].checkerId, "interface.ip");
  assert.equal(result.gradingProfile.mode, "structured-checker-registry");
});

test("grades IP address, default gateway, and SSH line/service checks with evidence", () => {
  const devices = {
    pc1: switchDevice("pc1", "PC1", { eth0: iface({ ip: "192.168.1.10", mask: "255.255.255.0", gw: "192.168.1.1" }) }),
    r1: routerDevice("r1", "R1", {
      interfaces: { "GigabitEthernet0/0": iface({ ip: "192.168.1.1", mask: "255.255.255.0" }) },
      ssh: { version: 2 },
      lines: { vty: { transport: ["ssh"] } },
    }),
  };
  const result = grade({
    assessmentItems: [
      { path: "PC1 / eth0 / IP Address", pathParts: ["PC1", "eth0", "IP Address"], components: "IP Configuration", points: 1, value: "192.168.1.10" },
      { path: "PC1 / eth0 / Default Gateway", pathParts: ["PC1", "eth0", "Default Gateway"], components: "IP Configuration", points: 1, value: "192.168.1.1" },
      { path: "R1 / ip ssh version 2", pathParts: ["R1", "ip ssh version 2"], components: "SSH Configuration", points: 1, value: "ip ssh version 2" },
      { path: "R1 / line vty 0 4 / transport input ssh", pathParts: ["R1", "line vty 0 4", "transport input ssh"], components: "Line Configuration", points: 1, value: "transport input ssh" },
    ],
  }, devices, []);
  assert.equal(result.progress.score, "4/4");
  assert.equal(result.assessmentItems.every((item) => item.correct), true);
  assert.equal(result.assessmentItems[0].checkerId, "interface.ip");
  assert.equal(result.assessmentItems[2].evidence.target.device, "R1");
});

test("grades routing, ACL, NAT, DHCP, and STP/security checker families", () => {
  const devices = {
    r1: routerDevice("r1", "R1", {
      interfaces: { "GigabitEthernet0/0": iface({ portSecurity: { enabled: true } }) },
      routes: [{ type: "S", dst: "10.10.10.0", mask: "255.255.255.0", via: "192.168.1.2" }],
      acls: { 10: { type: "standard", entries: [{ action: "permit", spec: "192.168.1.0 0.0.0.255", src: "192.168.1.0" }] } },
      nat: { pools: {}, rules: [{ config: "ip nat inside source list 10 interface GigabitEthernet0/0 overload" }], translations: [] },
      dhcp: { excluded: [], pools: { LAN: { network: "192.168.1.0", mask: "255.255.255.0" } }, bindings: [] },
      stp: { vlanPriority: { 10: 24576 } },
    }),
  };
  const familyItems = [
      { path: "R1 / Static Route", pathParts: ["R1", "Static Route"], components: "Routing", points: 1, value: "ip route 10.10.10.0 255.255.255.0 192.168.1.2" },
      { path: "R1 / ACL", pathParts: ["R1", "ACL"], components: "ACL", points: 1, value: "access-list 10 permit 192.168.1.0 0.0.0.255" },
      { path: "R1 / NAT", pathParts: ["R1", "NAT"], components: "NAT", points: 1, value: "ip nat inside source list 10 interface GigabitEthernet0/0 overload" },
      { path: "R1 / DHCP Pool", pathParts: ["R1", "DHCP Pool"], components: "DHCP", points: 1, value: "ip dhcp pool LAN" },
      { path: "R1 / spanning-tree vlan 10 priority 24576", pathParts: ["R1", "spanning-tree vlan 10 priority 24576"], components: "STP", points: 1, value: "spanning-tree vlan 10 priority 24576" },
      { path: "R1 / GigabitEthernet0/0 / switchport port-security", pathParts: ["R1", "GigabitEthernet0/0", "switchport port-security"], components: "Switching", points: 1, value: "switchport port-security" },
  ];
  const result = grade({
    assessmentModel: { leaves: familyItems.map((item) => ({ ...item, visible: true })) },
  }, devices, []);
  assert.equal(result.progress.score, "6/6");
  assert.equal(result.assessmentItems.every((item) => item.correct), true);
  assert.equal(result.assessmentItems.some((item) => item.checkerId === "routing-and-services.config"), true);
});

test("uses planPath for decoded connectivity checks", () => {
  const devices = {
    pc1: routerDevice("pc1", "PC1", { interfaces: { eth0: iface({ ip: "192.0.2.5", mask: "255.255.255.0" }) } }),
  };
  const ok = grade({
    assessmentItems: [{
      path: "PC1 / Connectivity / Ping 192.0.2.10",
      pathParts: ["PC1", "Connectivity", "Ping 192.0.2.10"],
      components: "Connectivity Tests",
      points: 1,
      value: "192.0.2.10",
    }],
  }, devices, []).assessmentItems[0];
  assert.equal(ok.correct, true);
  assert.equal(ok.checkerId, "connectivity.plan-path");

  const bad = grade({
    assessmentItems: [{
      path: "PC1 / Connectivity / Ping 203.0.113.10",
      pathParts: ["PC1", "Connectivity", "Ping 203.0.113.10"],
      components: "Connectivity Tests",
      points: 1,
      value: "203.0.113.10",
    }],
  }, devices, []).assessmentItems[0];
  assert.equal(bad.status, "Incorrect");
  assert.equal(bad.earnedPoints, 0);
});

test("reports unsupported decoded checks separately from incorrect checks", () => {
  const devices = {
    a: switchDevice("a", "SWA", { "GigabitEthernet0/1": iface() }),
  };
  const result = grade({
    assessmentItems: [{
      path: "SWA / GigabitEthernet0/1 / Proprietary Packet Tracer Widget",
      pathParts: ["SWA", "GigabitEthernet0/1", "Proprietary Packet Tracer Widget"],
      components: "Packet Tracer UI",
      points: 5,
      value: "",
    }],
  }, devices, []);
  assert.equal(result.assessmentItems[0].status, "Unchecked");
  assert.equal(result.assessmentItems[0].unchecked, true);
  assert.equal(result.progress.counts.unchecked, 1);
  assert.equal(result.progress.counts.incorrect, 0);
  assert.equal(result.gradingRun.unsupported[0].reason, "missing-xml-mapping");
});

test("leaves transferred Packet Tracer state unchecked unless grading explicitly opts in", () => {
  const devices = {
    r1: routerDevice("r1", "R1", {
      interfaces: { "GigabitEthernet0/0": iface() },
    }),
  };
  const leaf = {
    path: "Network / R1 / Ports / GigabitEthernet0/0 / BIA",
    pathParts: ["Network", "R1", "Ports", "GigabitEthernet0/0", "BIA"],
    components: "Physical",
    points: 1,
    value: "0030.F22E.9001",
    visible: true,
    rawXml: "<NODE><NAME>BIA</NAME></NODE>",
  };
  const result = grade({
    assessmentModel: { leaves: [leaf] },
    packetTracerState: {
      assessmentByPath: {
        [leaf.path]: {
          path: leaf.path,
          value: leaf.value,
          classification: "packet-tracer-internal-state",
          source: { assessmentPath: leaf.path, sourceValue: leaf.value },
        },
      },
    },
  }, devices, []);

  assert.equal(result.assessmentItems[0].status, "Unchecked");
  assert.notEqual(result.assessmentItems[0].checkerId, "packet-tracer.transferred-state");
  assert.equal(result.assessmentItems[0].earnedPoints, 0);
  assert.equal(result.progress.counts.unchecked, 1);
});

test("grades transferred Packet Tracer state only after explicit opt-in", () => {
  const devices = {
    r1: routerDevice("r1", "R1", {
      interfaces: { "GigabitEthernet0/0": iface() },
    }),
  };
  const leaf = {
    path: "Network / R1 / Ports / GigabitEthernet0/0 / BIA",
    pathParts: ["Network", "R1", "Ports", "GigabitEthernet0/0", "BIA"],
    components: "Physical",
    points: 1,
    value: "0030.F22E.9001",
    visible: true,
    rawXml: "<NODE><NAME>BIA</NAME></NODE>",
  };
  const result = grade({
    gradingProfile: { allowTransferredStateGrading: true },
    assessmentModel: { leaves: [leaf] },
    packetTracerState: {
      assessmentByPath: {
        [leaf.path]: {
          path: leaf.path,
          value: leaf.value,
          classification: "packet-tracer-internal-state",
          source: { assessmentPath: leaf.path, sourceValue: leaf.value },
        },
      },
    },
  }, devices, []);

  assert.equal(result.assessmentItems[0].status, "Correct");
  assert.equal(result.assessmentItems[0].checkerId, "packet-tracer.transferred-state");
  assert.equal(result.assessmentItems[0].evidence.transferredStateOptIn, true);
  assert.equal(result.progress.counts.unchecked, 0);
  assert.equal(result.gradingRun.unsupported.length, 0);
});
