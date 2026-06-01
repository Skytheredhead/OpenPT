import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEngine() {
  const source = readFileSync(join(__dirname, "..", "engine.jsx"), "utf8");
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.window.OPT_Engine;
}

function link(a, ai, b, bi, type = "copper") {
  return { id: `${a.id}-${b.id}-${ai}-${bi}`, a: a.id, ai, b: b.id, bi, type, up: true };
}

test("open SSID association supports DHCP and ping through a bridged AP", () => {
  const E = loadEngine();
  const router = E.makeDevice("router", "R1", 0, 0, {
    "GigabitEthernet0/0/0": { ip: "192.168.10.1", mask: "255.255.255.0", up: true, admUp: true },
  }, {
    dhcp: { excluded: [], pools: { WLAN: { network: "192.168.10.0", mask: "255.255.255.0", defaultRouter: "192.168.10.1" } }, bindings: [] },
  });
  const ap = E.makeDevice("ap", "AP1", 80, 0, {
    eth0: { up: true, admUp: true },
    wlan0: { up: true, admUp: true },
  }, { wireless: { radioEnabled: true, ssids: [{ name: "Campus", security: "open", vlan: 1, enabled: true }] } });
  const laptop = E.makeDevice("laptop", "LAP1", 110, 0, {
    wlan0: { ssid: "Campus", security: "open", dhcp: true, up: true, admUp: true },
  });
  const devices = { [router.id]: router, [ap.id]: ap, [laptop.id]: laptop };
  const links = [link(ap, "eth0", router, "GigabitEthernet0/0/0")];

  const leased = E.allocateDhcp(devices, links, laptop.id);
  assert.match(leased.message, /leased 192\.168\.10\./);
  const plan = E.planPath(leased.devices, links, laptop.id, "192.168.10.1");
  assert.equal(plan.ok, true);
  assert.ok(plan.hops.some((hop) => hop.action === "bridge"));
});

test("WPA2-PSK mismatch prevents association and blocks traffic", () => {
  const E = loadEngine();
  const ap = E.makeDevice("ap", "AP1", 0, 0, { wlan0: { up: true, admUp: true } }, {
    wireless: { radioEnabled: true, ssids: [{ name: "Secure", security: "wpa2-psk", passphrase: "correct", vlan: 1, enabled: true }] },
  });
  const laptop = E.makeDevice("laptop", "LAP1", 40, 0, {
    wlan0: { ip: "192.168.30.10", mask: "255.255.255.0", gw: "192.168.30.1", ssid: "Secure", security: "wpa2-psk", passphrase: "wrong", up: true, admUp: true },
  });
  const devices = { [ap.id]: ap, [laptop.id]: laptop };
  const sim = E.computeWirelessAssociations(devices);
  assert.equal(sim[laptop.id].interfaces.wlan0.associationState, "auth-failed");
  const plan = E.planPath(devices, [], laptop.id, "192.168.30.1");
  assert.equal(plan.ok, false);
  assert.match(plan.error, /authentication mismatch/i);
});

test("client roams to the strongest compatible AP", () => {
  const E = loadEngine();
  const ap1 = E.makeDevice("ap", "AP1", 0, 0, { wlan0: { up: true, admUp: true } }, {
    wireless: { radioEnabled: true, ssids: [{ name: "Campus", security: "open", vlan: 1, enabled: true }] },
  });
  const ap2 = E.makeDevice("ap", "AP2", 300, 0, { wlan0: { up: true, admUp: true } }, {
    wireless: { radioEnabled: true, ssids: [{ name: "Campus", security: "open", vlan: 1, enabled: true }] },
  });
  const laptop = E.makeDevice("laptop", "LAP1", 280, 0, { wlan0: { ssid: "Campus", security: "open", up: true, admUp: true } });
  let devices = { [ap1.id]: ap1, [ap2.id]: ap2, [laptop.id]: laptop };
  let sim = E.computeWirelessAssociations(devices);
  assert.equal(sim[laptop.id].interfaces.wlan0.associatedApId, ap2.id);

  devices = { ...devices, [laptop.id]: { ...laptop, x: 20, interfaces: { ...laptop.interfaces, wlan0: { ...laptop.interfaces.wlan0, associatedApId: ap2.id } } } };
  sim = E.computeWirelessAssociations(devices);
  assert.equal(sim[laptop.id].interfaces.wlan0.associatedApId, ap1.id);
});

test("radio disabled drops associations", () => {
  const E = loadEngine();
  const ap = E.makeDevice("ap", "AP1", 0, 0, { wlan0: { up: true, admUp: true } }, {
    wireless: { radioEnabled: false, ssids: [{ name: "Campus", security: "open", vlan: 1, enabled: true }] },
  });
  const laptop = E.makeDevice("laptop", "LAP1", 40, 0, { wlan0: { ssid: "Campus", security: "open", up: true, admUp: true } });
  const sim = E.computeWirelessAssociations({ [ap.id]: ap, [laptop.id]: laptop });
  assert.equal(sim[laptop.id].interfaces.wlan0.associatedApId, null);
  assert.equal(sim[laptop.id].interfaces.wlan0.associationState, "no-ap");
});

test("WRT wireless client receives DHCP from the LAN side", () => {
  const E = loadEngine();
  const wrt = E.makeDevice("wrt", "WRT1", 0, 0, {
    Ethernet1: { ip: "192.168.2.1", mask: "255.255.255.0", up: true, admUp: true },
    wlan0: { up: true, admUp: true },
  }, {
    wireless: { radioEnabled: true, ssids: [{ name: "Home", security: "wpa2-psk", passphrase: "openpt123", vlan: 1, enabled: true }] },
    dhcp: { excluded: [], pools: { LAN: { network: "192.168.2.0", mask: "255.255.255.0", defaultRouter: "192.168.2.1" } }, bindings: [] },
  });
  const laptop = E.makeDevice("laptop", "LAP1", 50, 0, {
    wlan0: { ssid: "Home", security: "wpa2-psk", passphrase: "openpt123", dhcp: true, up: true, admUp: true },
  });
  const devices = { [wrt.id]: wrt, [laptop.id]: laptop };
  const leased = E.allocateDhcp(devices, [], laptop.id);
  assert.match(leased.message, /leased 192\.168\.2\./);
  assert.equal(E.planPath(leased.devices, [], laptop.id, "192.168.2.1").ok, true);
});
