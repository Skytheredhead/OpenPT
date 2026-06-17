import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

async function loadOpenPTFormat() {
  const context = {
    console,
    window: {},
    globalThis: {},
    OPT_Engine: {
      makeDevice(kind, name, x, y, seededIfaces = {}, extra = {}) {
        return {
          id: `${kind}-${String(name).toLowerCase()}`,
          kind,
          name,
          hostname: name,
          x,
          y,
          interfaces: seededIfaces,
          ...extra,
        };
      },
      uid(prefix) {
        return `${prefix}-fixture`;
      },
      normalizeTopology(devices, links) {
        return { devices, links };
      },
      serializeConfig(device = {}) {
        return `hostname ${device.hostname || device.name || "Device"}`;
      },
    },
  };
  context.globalThis = context;
  context.window = context;
  vm.createContext(context);
  vm.runInContext(await readFile(join(root, "openpt-format.js"), "utf8"), context, { filename: "openpt-format.js" });
  return context.OpenPTFormat;
}

test("fixture topology imports into the OTP project document corpus", async () => {
  const OpenPTFormat = await loadOpenPTFormat();
  const fixture = JSON.parse(await readFile(join(root, "test/fixtures/rich-topology.json"), "utf8"));

  const state = {
    title: "Fixture Rich Topology",
    devices: fixture.devices,
    links: fixture.links,
    uiState: { selectedIds: ["r1"], openConsoles: ["r1"], activeBottom: "events" },
    ptActivity: { format: "packet-tracer-activity", title: "Fixture Packet Tracer Activity", assessmentItems: [] },
    events: [{ t: 1, kind: "fixture", msg: "created" }],
    packets: [],
    cliHistory: [{ deviceId: "r1", command: "show running-config" }],
  };

  const document = OpenPTFormat.projectDocFromState(state);

  assert.equal(Object.keys(document.devices).length, 3);
  assert.equal(document.links.length, 2);
  assert.deepEqual(document.uiState.selectedIds, ["r1"]);

  const otp = OpenPTFormat.buildOtpPackage(state);
  assert.equal(otp.format, "openpt-otp");
  assert.equal(otp.summary.devices, 3);
  assert.equal(otp.summary.links, 2);

  const imported = OpenPTFormat.projectDocumentFromOtpPackage(otp);
  assert.equal(imported.title, "Fixture Rich Topology");
  assert.deepEqual(Object.keys(imported.devices).sort(), ["pc1", "r1", "sw1"]);
  assert.equal(imported.links[0].packetTracer.type, "Copper Straight-Through");
});

test("committed OTP corpus fixture remains importable", async () => {
  const OpenPTFormat = await loadOpenPTFormat();
  const otp = JSON.parse(await readFile(join(root, "test/fixtures/rich-topology.otp"), "utf8"));
  const imported = OpenPTFormat.projectDocumentFromOtpPackage(otp);

  assert.equal(imported.schemaVersion, 1);
  assert.equal(imported.title, "Fixture Rich Topology");
  assert.equal(Object.keys(imported.devices).length, 3);
  assert.equal(imported.links.length, 2);
  assert.equal(imported.uiState.ptActivity.title, "Fixture Packet Tracer Activity");
});

test("Packet Tracer link import resolves endpoint refs when device names contain colons", async () => {
  const OpenPTFormat = await loadOpenPTFormat();
  const activity = {
    devices: [
      { name: "ISP:ISP", rawName: "ISP:ISP", saveRefId: "save-ref-id:isp", memAddr: "100", kind: "Router", model: "1941", x: 10, y: 20 },
      {
        name: "Switch2",
        rawName: "Switch2",
        saveRefId: "save-ref-id:switch",
        memAddr: "200",
        kind: "Switch",
        model: "2960-24TT",
        x: 30,
        y: 40,
      },
    ],
    links: [
      {
        from: "Switch2:GigabitEthernet0/2",
        to: "ISP:ISP:GigabitEthernet0/1",
        fromRef: "save-ref-id:switch",
        toRef: "save-ref-id:isp",
        type: "eStraightThrough",
        medium: "eCopper",
        ports: ["GigabitEthernet0/2", "GigabitEthernet0/1"],
      },
    ],
  };

  const topology = OpenPTFormat.buildTopologyFromPacketTracer(activity);
  assert.equal(topology.links.length, 1);
  assert.equal(topology.links[0].ai, "GigabitEthernet0/2");
  assert.equal(topology.links[0].bi, "GigabitEthernet0/1");
  assert.equal(topology.links[0].packetTracer.toRef, "save-ref-id:isp");
});

test("Packet Tracer functional link status maps to OpenPT link state unless explicit", async () => {
  const OpenPTFormat = await loadOpenPTFormat();
  const activity = {
    devices: [
      { name: "Router0", rawName: "Router0", saveRefId: "r0", memAddr: "100", kind: "Router", model: "1941", x: 10, y: 20 },
      { name: "Switch0", rawName: "Switch0", saveRefId: "s0", memAddr: "200", kind: "Switch", model: "2960-24TT", x: 30, y: 40 },
    ],
    links: [
      {
        from: "Router0:GigabitEthernet0/0",
        to: "Switch0:FastEthernet0/1",
        fromRef: "r0",
        toRef: "s0",
        type: "eStraightThrough",
        functional: "false",
        ports: ["GigabitEthernet0/0", "FastEthernet0/1"],
      },
      {
        from: "Router0:GigabitEthernet0/1",
        to: "Switch0:FastEthernet0/2",
        fromRef: "r0",
        toRef: "s0",
        type: "eStraightThrough",
        functional: "false",
        up: true,
        ports: ["GigabitEthernet0/1", "FastEthernet0/2"],
      },
    ],
  };

  const topology = OpenPTFormat.buildTopologyFromPacketTracer(activity);
  assert.equal(topology.links.length, 2);
  assert.equal(topology.links[0].up, false);
  assert.equal(topology.links[1].up, true);
});
