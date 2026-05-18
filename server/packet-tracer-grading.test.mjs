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
    serializeConfig() {
      return "";
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
