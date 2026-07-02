import test from "node:test";
import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, "..");
const fixtureDir = join(rootDir, "test", "fixtures");
const ptFixtureDir = join(fixtureDir, "packet-tracer");

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function loadOpenPTCore() {
  const context = {
    console,
    setTimeout,
    clearTimeout,
    TextDecoder,
    TextEncoder,
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(await readFile(join(rootDir, "engine.jsx"), "utf8"), context, { filename: "engine.jsx" });
  vm.runInContext(await readFile(join(rootDir, "openpt-format.js"), "utf8"), context, { filename: "openpt-format.js" });
  return { context, engine: context.OPT_Engine, format: context.OpenPTFormat };
}

async function loadPacketTracerImporter({ importLimits = null } = {}) {
  const context = {
    console,
    setTimeout,
    clearTimeout,
    TextDecoder,
    TextEncoder,
    crypto: webcrypto,
  };
  if (importLimits) context.OpenPTPacketTracerImportLimits = importLimits;
  context.window = context;
  vm.createContext(context);
  vm.runInContext(await readFile(join(rootDir, "packet-tracer-importer.js"), "utf8"), context, { filename: "packet-tracer-importer.js" });
  return context.PacketTracerImporter;
}

function asBrowserFile(name, bytes) {
  return {
    name,
    size: bytes.byteLength,
    type: "application/octet-stream",
    lastModified: 0,
    async arrayBuffer() {
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    },
  };
}

function assertLinksHaveEndpoints(topology) {
  for (const link of topology.links) {
    assert.ok(topology.devices[link.a], `missing link endpoint ${link.a}`);
    assert.ok(topology.devices[link.b], `missing link endpoint ${link.b}`);
    assert.ok(topology.devices[link.a].interfaces[link.ai], `missing interface ${link.a}:${link.ai}`);
    assert.ok(topology.devices[link.b].interfaces[link.bi], `missing interface ${link.b}:${link.bi}`);
  }
}

test("Packet Tracer importer rejects oversized files before decoding", async () => {
  const importer = await loadPacketTracerImporter({ importLimits: { maxFileBytes: 32, maxXmlBytes: 1024, maxXmlDepth: 16 } });
  await assert.rejects(
    () => importer.importPacketTracerFile(asBrowserFile("oversized.pkt", new Uint8Array(33))),
    /Packet Tracer file exceeds the 32 byte Packet Tracer import limit/
  );
});

test("Packet Tracer importer rejects oversized and deeply nested XML payloads", async () => {
  const importer = await loadPacketTracerImporter({ importLimits: { maxFileBytes: 4096, maxXmlBytes: 128, maxXmlDepth: 8 } });
  const largeXml = new TextEncoder().encode(`<PACKETTRACER>${"x".repeat(160)}</PACKETTRACER>`);
  await assert.rejects(
    () => importer.importPacketTracerFile(asBrowserFile("large.pkt", largeXml)),
    /Plain Packet Tracer XML payload exceeds the 128 byte Packet Tracer import limit/
  );

  const depthImporter = await loadPacketTracerImporter({ importLimits: { maxFileBytes: 4096, maxXmlBytes: 4096, maxXmlDepth: 8 } });
  const nestedXml = new TextEncoder().encode(`${"<PACKETTRACER>"}${"<NODE>".repeat(10)}${"</NODE>".repeat(10)}</PACKETTRACER>`);
  await assert.rejects(
    () => depthImporter.importPacketTracerFile(asBrowserFile("deep.pkt", nestedXml)),
    /Packet Tracer XML nesting exceeds the 8 level import limit/
  );
});

test("JSON/OPT topology normalizes and re-imports without dropping state", async () => {
  const { engine, format } = await loadOpenPTCore();
  const fixture = await readJson(join(fixtureDir, "rich-topology.json"));
  const normalized = engine.normalizeTopology(fixture.devices, fixture.links);
  const document = format.projectDocFromState({
    title: "Fixture Rich Topology",
    devices: normalized.devices,
    links: normalized.links,
    uiState: {
      selectedIds: ["r1", "l-r1-sw1"],
      openConsoles: ["r1"],
      activeBottom: "events",
      topologyViewState: { zoom: 0.85, pan: { x: 12, y: -4 } },
    },
    metadata: { fixture: true },
  }, engine);
  const reimported = engine.normalizeTopology(document.devices, document.links);

  assert.deepEqual(reimported, normalized);
  assertLinksHaveEndpoints(reimported);
  assert.equal(document.schemaVersion, 1);
  assert.equal(document.metadata.app, "OpenPT");
  assert.equal(document.metadata.fixture, true);
  assert.equal(document.devices.sw1.packetTracer.name, "Switch0");
  assert.equal(document.links[0].packetTracer.type, "Copper Straight-Through");
  assert.deepEqual(document.uiState.selectedIds, ["r1", "l-r1-sw1"]);
});

test(".otp package round-trips project, assignment, session, and provenance", async () => {
  const { engine, format } = await loadOpenPTCore();
  const fixture = await readJson(join(fixtureDir, "rich-topology.json"));
  const normalized = engine.normalizeTopology(fixture.devices, fixture.links);
  const assignment = {
    format: "packet-tracer-activity",
    title: "Fixture Packet Tracer Activity",
    sourceName: "fixture-lab.pka",
    sourceSha256: "abc123",
    decoded: { xmlText: "<PACKETTRACER />" },
    rawFile: { name: "fixture-lab.pka", sha256: "abc123", storage: { stored: false } },
    devices: [{ name: "R1", model: "ISR4321" }],
    links: [],
    assessmentItems: [{ path: "R1 / Host Name", points: 1 }],
  };
  const pkg = format.buildOtpPackage({
    title: "Fixture Rich Topology",
    devices: normalized.devices,
    links: normalized.links,
    uiState: {
      selectedIds: ["r1"],
      openConsoles: ["r1"],
      activeBottom: "events",
      ptSidebarOpen: true,
      topologyViewState: { zoom: 1.1 },
    },
    ptActivity: assignment,
    events: [{ t: 1, kind: "event", msg: "fixture" }],
    packets: [{ id: "pkt-1", from: "pc1", to: "r1" }],
    packetEvents: [{ id: "trace-1", protocol: "icmp", summary: "fixture trace" }],
    cliHistory: [{ deviceId: "r1", command: "show ip interface brief" }],
    cloudProjectId: "cloud-fixture",
    cloudVersion: 7,
    exportedAt: "2026-05-27T18:00:00.000Z",
    appVersion: "roundtrip-test",
  }, engine);
  const reopened = format.projectDocumentFromOtpPackage(pkg);

  assert.equal(pkg.format, "openpt-otp");
  assert.equal(pkg.generator.version, "roundtrip-test");
  assert.equal(pkg.summary.devices, 3);
  assert.equal(pkg.summary.links, 2);
  assert.equal(pkg.summary.assignment, "Fixture Packet Tracer Activity");
  assert.equal(pkg.provenance.cloudProjectId, "cloud-fixture");
  assert.equal(pkg.provenance.cloudVersion, 7);
  assert.equal(pkg.provenance.packetTracerRawFile.name, "fixture-lab.pka");
  assert.equal(pkg.provenance.packetTracerDecodedXml, true);
  assert.deepEqual(JSON.parse(JSON.stringify(pkg.session.events)), [{ t: 1, kind: "event", msg: "fixture" }]);
  assert.deepEqual(JSON.parse(JSON.stringify(pkg.session.packets)), [{ id: "pkt-1", from: "pc1", to: "r1" }]);
  assert.deepEqual(JSON.parse(JSON.stringify(pkg.session.packetEvents)), [{ id: "trace-1", protocol: "icmp", summary: "fixture trace" }]);
  assert.deepEqual(JSON.parse(JSON.stringify(pkg.session.cliHistory)), [{ deviceId: "r1", command: "show ip interface brief" }]);
  assert.equal(reopened.uiState.ptActivity.sourceSha256, "abc123");
  assert.equal(reopened.uiState.ptSidebarOpen, true);
  assert.deepEqual(engine.normalizeTopology(reopened.devices, reopened.links), normalized);

  const otpFixture = await readJson(join(fixtureDir, "rich-topology.otp"));
  const fixtureDocument = format.projectDocumentFromOtpPackage(otpFixture);
  assert.equal(fixtureDocument.title, "Fixture Rich Topology");
  assert.equal(fixtureDocument.uiState.ptActivity.title, "Fixture Packet Tracer Activity");
  assert.equal(fixtureDocument.uiState.ptSidebarOpen, true);
  assertLinksHaveEndpoints(engine.normalizeTopology(fixtureDocument.devices, fixtureDocument.links));
});

test(".otp generated device configs match serializer and preserve startup/files", async () => {
  const { engine, format } = await loadOpenPTCore();
  const fixture = await readJson(join(fixtureDir, "rich-topology.json"));
  const normalized = engine.normalizeTopology(fixture.devices, fixture.links);
  const pkg = format.buildOtpPackage({
    title: "Fixture Rich Topology",
    devices: normalized.devices,
    links: normalized.links,
    uiState: {},
    exportedAt: "2026-05-27T18:00:00.000Z",
  }, engine);

  for (const [id, device] of Object.entries(normalized.devices)) {
    assert.equal(pkg.generated.deviceConfigs[id].runningConfig, engine.serializeConfig(device));
    assert.equal(pkg.generated.deviceConfigs[id].startupConfig, device.startupConfig || "");
    assert.deepEqual(pkg.generated.deviceConfigs[id].files, device.files || {});
  }

  const r1Config = pkg.generated.deviceConfigs.r1.runningConfig;
  assert.match(r1Config, /hostname R1/);
  assert.match(r1Config, /interface GigabitEthernet0\/0\/0/);
  assert.match(r1Config, /ip address 10\.0\.0\.1 255\.255\.255\.252/);
  assert.match(r1Config, /ip dhcp pool USERS/);
  assert.match(r1Config, /ip nat inside source list WEB interface GigabitEthernet0\/0\/0 overload/);
  assert.match(r1Config, /ip access-list extended WEB/);
  assert.match(r1Config, /line vty 0 4/);
  assert.match(r1Config, /transport input ssh/);
  assert.equal(pkg.generated.deviceConfigs.r1.files["flash:site-notes.txt"], "OpenPT fixture file");

  const sw1Config = pkg.generated.deviceConfigs.sw1.runningConfig;
  assert.match(sw1Config, /hostname SW1/);
  assert.match(sw1Config, /vlan 10/);
  assert.match(sw1Config, /name USERS/);
  assert.match(sw1Config, /switchport mode trunk/);
  assert.match(sw1Config, /switchport trunk allowed vlan 10,20/);
  assert.equal(pkg.generated.deviceConfigs.sw1.files["flash:vlan.dat"], "fixture vlan database");
});

test("Packet Tracer fixtures import, fingerprint, and survive .otp packaging", async () => {
  const { engine, format } = await loadOpenPTCore();
  const importer = await loadPacketTracerImporter();
  const expectedHashes = {
    "unsupported-routing-lab.pkt": "1010872e1f21298ba50476303da716f12d36b68e8a887b5339580ad9cf2eadd3",
  };
  const fixtureNames = (await readdir(ptFixtureDir)).filter((name) => /\.(pka|pkt)$/i.test(name)).sort();

  assert.ok(fixtureNames.length > 0, "expected at least one committed Packet Tracer fixture");
  assert.deepEqual(fixtureNames, Object.keys(expectedHashes).sort());

  for (const name of fixtureNames) {
    const bytes = await readFile(join(ptFixtureDir, name));
    const hash = sha256(bytes);
    assert.equal(hash, expectedHashes[name], `${name} fixture hash changed`);

    const activity = await importer.importPacketTracerFile(asBrowserFile(name, bytes));
    assert.equal(activity.format, "packet-tracer-activity");
    assert.equal(activity.sourceName, name);
    assert.equal(activity.sourceSize, bytes.byteLength);
    assert.equal(activity.sourceSha256, hash);
    assert.equal(activity.rawFile.name, name);
    assert.equal(activity.rawFile.sha256, hash);
    assert.ok(activity.reverseReport);
    assert.ok(activity.reverseReport.interestingStrings.some((item) => /Packet Tracer/i.test(item.text)));

    if (activity.unsupported) {
      assert.equal(activity.reverseReport.decoder.status, "not-decoded");
      assert.match(activity.instructionsText, /reverse-engineering report/i);
    } else {
      assert.ok(activity.devices.length > 0 || activity.assessmentItems?.length > 0);
      assert.ok(activity.progress);
    }

    const topology = format.buildTopologyFromPacketTracer(activity, engine);
    assert.equal(Object.keys(topology.devices).length, activity.devices.length);
    assert.equal(topology.links.length, activity.links.length);
    assertLinksHaveEndpoints(topology);

    const pkg = format.buildOtpPackage({
      title: activity.title,
      devices: topology.devices,
      links: topology.links,
      uiState: { ptActivity: activity, ptSidebarOpen: true },
      ptActivity: activity,
      exportedAt: "2026-05-27T18:00:00.000Z",
      appVersion: "roundtrip-test",
    }, engine);
    const reopened = format.projectDocumentFromOtpPackage(pkg);

    assert.equal(pkg.summary.assignment, activity.title || activity.sourceName);
    assert.equal(pkg.provenance.packetTracerRawFile.name, name);
    assert.equal(reopened.uiState.ptActivity.sourceSha256, hash);
    assert.equal(reopened.uiState.ptSidebarOpen, true);
    assert.deepEqual(engine.normalizeTopology(reopened.devices, reopened.links), engine.normalizeTopology(topology.devices, topology.links));
  }
});
