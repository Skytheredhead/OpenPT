import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

async function loadContext() {
  const context = { window: {}, console };
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(await readFile(join(__dirname, "..", "engine.jsx"), "utf8"), context, { filename: "engine.jsx" });
  vm.runInContext(await readFile(join(__dirname, "..", "openpt-format.js"), "utf8"), context, { filename: "openpt-format.js" });
  return context;
}

test("startup config checkpoint reload restores saved config and clears volatile state", async () => {
  const { window } = await loadContext();
  const engine = window.OPT_Engine;
  const router = engine.makeDevice("router", "R1", 120, 140, {
    "GigabitEthernet0/0/0": { ip: "192.0.2.1", mask: "255.255.255.0", admUp: true, up: true, desc: "saved lan" },
  }, { platform: "isr4321" });
  router.id = "router-r1";
  router.secrets.enable = "cisco";
  router.routes.push({ type: "S", dst: "203.0.113.0", mask: "255.255.255.0", via: "192.0.2.254", iface: "GigabitEthernet0/0/0" });

  const startupConfig = engine.serializeConfig(router);
  const startupConfigState = engine.startupConfigSnapshot(router);

  router.hostname = "Unsaved";
  router.interfaces["GigabitEthernet0/0/0"].desc = "unsaved lan";
  router.secrets.enable = "changed";
  router.arp = { "192.0.2.10": "00:11:22:33:44:55" };
  router.mac = { "00:11:22:33:44:55": "GigabitEthernet0/0/0" };
  router.nat.translations = [{ inside: "192.0.2.10", outside: "198.51.100.10" }];
  router.dhcp.bindings = [{ ip: "192.0.2.20", mac: "00:aa:bb:cc:dd:ee" }];
  router.runtime = { selected: true };
  router.startupConfig = startupConfig;
  router.startupConfigState = startupConfigState;
  router.files = { "flash:notes.txt": "persistent file" };

  const reloaded = engine.reloadFromStartupConfig(router);
  assert.equal(reloaded.id, "router-r1");
  assert.equal(reloaded.x, 120);
  assert.equal(reloaded.y, 140);
  assert.equal(reloaded.platform, "isr4321");
  assert.equal(reloaded.hostname, "R1");
  assert.equal(reloaded.secrets.enable, "cisco");
  assert.equal(reloaded.interfaces["GigabitEthernet0/0/0"].desc, "saved lan");
  assert.equal(reloaded.files["flash:notes.txt"], "persistent file");
  assert.deepEqual(plain(reloaded.arp), {});
  assert.deepEqual(plain(reloaded.mac), {});
  assert.deepEqual(plain(reloaded.nat.translations), []);
  assert.deepEqual(plain(reloaded.dhcp.bindings), []);
  assert.equal(reloaded.runtime, undefined);
});

test("reload without structured startup checkpoint falls back to defaults and preserves files", async () => {
  const { window } = await loadContext();
  const engine = window.OPT_Engine;
  const router = engine.makeDevice("router", "R1", 20, 40, {}, { platform: "2911" });
  router.id = "router-r1";
  router.hostname = "Unsaved";
  router.secrets.enable = "changed";
  router.files = { "flash:notes.txt": "persistent file" };
  router.startupConfig = "hostname legacy-only";

  const reloaded = engine.reloadFromStartupConfig(router);
  assert.equal(reloaded.id, "router-r1");
  assert.equal(reloaded.hostname, "R1");
  assert.equal(reloaded.secrets.enable, undefined);
  assert.equal(reloaded.startupConfig, "hostname legacy-only");
  assert.equal(reloaded.startupConfigState, null);
  assert.equal(reloaded.files["flash:notes.txt"], "persistent file");
});

test("project and OTP formats preserve startup checkpoint while exporting generated configs", async () => {
  const { window } = await loadContext();
  const engine = window.OPT_Engine;
  const format = window.OpenPTFormat;
  const router = engine.makeDevice("router", "R1", 10, 10);
  router.id = "router-r1";
  router.startupConfig = engine.serializeConfig(router);
  router.startupConfigState = engine.startupConfigSnapshot(router);
  router.files = { "flash:notes.txt": "hello" };
  router.hostname = "Unsaved";

  const project = format.projectDocFromState({ title: "Lab", devices: { [router.id]: router }, links: [], uiState: {} }, engine);
  assert.equal(project.devices[router.id].startupConfigState.hostname, "R1");
  assert.equal(project.devices[router.id].startupConfig, router.startupConfig);
  assert.equal(project.devices[router.id].files["flash:notes.txt"], "hello");

  const otp = format.buildOtpPackage({ title: "Lab", devices: { [router.id]: router }, links: [], uiState: {} }, engine);
  assert.equal(otp.project.devices[router.id].startupConfigState.hostname, "R1");
  assert.match(otp.generated.deviceConfigs[router.id].runningConfig, /hostname Unsaved/);
  assert.match(otp.generated.deviceConfigs[router.id].startupConfig, /hostname R1/);
  assert.equal(otp.generated.deviceConfigs[router.id].files["flash:notes.txt"], "hello");

  const imported = format.projectDocumentFromOtpPackage(otp);
  assert.equal(imported.devices[router.id].startupConfigState.hostname, "R1");
});
