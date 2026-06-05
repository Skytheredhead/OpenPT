import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEngine() {
  const context = { console };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(readFileSync(join(__dirname, "..", "engine.jsx"), "utf8"), context, { filename: "engine.jsx" });
  return context.OPT_Engine;
}

const OPT_Engine = loadEngine();

function router(id, iface = "GigabitEthernet0/0/0", extra = {}) {
  return {
    id,
    kind: "router",
    hostname: id.toUpperCase(),
    powered: true,
    interfaces: { [iface]: { up: true, admUp: true, mac: `${id}:mac` } },
    ...extra,
  };
}

function sw(id, iface = "FastEthernet0/1", ifc = {}) {
  return {
    id,
    kind: "l2switch",
    hostname: id.toUpperCase(),
    powered: true,
    interfaces: {
      [iface]: {
        up: true,
        admUp: true,
        mode: "access",
        vlan: 1,
        stp: { state: "forwarding" },
        ...ifc,
      },
    },
  };
}

test("reports green up indicators for healthy links and activity when active", () => {
  const devices = {
    r1: router("r1"),
    sw1: sw("sw1"),
  };
  const link = { id: "l1", a: "r1", ai: "GigabitEthernet0/0/0", b: "sw1", bi: "FastEthernet0/1", type: "copper", up: true };

  assert.equal(OPT_Engine.linkEndpointStatus(devices, link, "a").state, "up");
  assert.equal(OPT_Engine.linkEndpointStatus(devices, link, "b").shape, "triangle-up");
  assert.equal(OPT_Engine.linkEndpointStatus(devices, link, "a", { activeLinkIds: new Set(["l1"]) }).state, "activity");
});

test("reports red down indicators for link, endpoint, interface, and media failures", () => {
  const healthy = {
    r1: router("r1"),
    sw1: sw("sw1"),
  };
  const link = { id: "l1", a: "r1", ai: "GigabitEthernet0/0/0", b: "sw1", bi: "FastEthernet0/1", type: "copper", up: true };

  assert.equal(OPT_Engine.linkEndpointStatus(healthy, { ...link, up: false }, "a").state, "down");
  assert.equal(OPT_Engine.linkEndpointStatus({ ...healthy, r1: { ...healthy.r1, powered: false } }, link, "a").state, "down");
  assert.equal(OPT_Engine.linkEndpointStatus({
    ...healthy,
    r1: router("r1", "GigabitEthernet0/0/0", { interfaces: { "GigabitEthernet0/0/0": { up: true, admUp: false } } }),
  }, link, "a").state, "down");
  assert.equal(OPT_Engine.linkEndpointStatus(healthy, { ...link, type: "serial" }, "a").state, "down");
});

test("reports amber blocking for switch STP and black circle for console links", () => {
  const blockedDevices = {
    sw1: sw("sw1", "FastEthernet0/1", { stp: { state: "blocking" } }),
    sw2: sw("sw2", "FastEthernet0/1"),
  };
  const blockedLink = { id: "l1", a: "sw1", ai: "FastEthernet0/1", b: "sw2", bi: "FastEthernet0/1", type: "copper", up: true };
  const blocked = OPT_Engine.linkEndpointStatus(blockedDevices, blockedLink, "a");
  assert.equal(blocked.state, "blocking");
  assert.equal(blocked.shape, "circle");

  const consoleDevices = {
    pc: router("pc", "Console0"),
    r1: router("r1", "Console0"),
  };
  const consoleLink = { id: "l2", a: "pc", ai: "Console0", b: "r1", bi: "Console0", type: "console", up: true };
  const status = OPT_Engine.linkEndpointStatus(consoleDevices, consoleLink, "a");
  assert.equal(status.state, "console");
  assert.equal(status.color, "black");
});
