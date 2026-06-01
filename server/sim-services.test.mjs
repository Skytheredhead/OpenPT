import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadRuntime() {
  const context = { console, window: null };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(readFileSync(join(__dirname, "..", "engine.jsx"), "utf8"), context);
  vm.runInContext(readFileSync(join(__dirname, "..", "sim-services.jsx"), "utf8"), context);
  return context;
}

function lab(context) {
  const { OPT_Engine } = context;
  const pc = OPT_Engine.makeDevice("pc", "PC1", 0, 0, {
    eth0: { ip: "192.168.1.10", mask: "255.255.255.0", gw: "", up: true, admUp: true },
  });
  const server = OPT_Engine.makeDevice("server", "SRV1", 120, 0, {
    eth0: { ip: "192.168.1.20", mask: "255.255.255.0", gw: "", up: true, admUp: true },
  });
  server.serverConfig = {
    http: { http: true, https: false, files: [{ name: "index.html", editable: true, content: "<h1>OpenPT Server</h1>" }] },
    dns: { service: true, records: [{ name: "srv.local", type: "A Record", detail: "192.168.1.20" }] },
    email: { smtp: true, pop3: true, domain: "openpt.local", users: [{ username: "alice", password: "pw" }, { username: "bob", password: "pw" }] },
    aaa: { service: true, users: [{ username: "alice", password: "pw" }] },
    iot: { service: true, registrations: [], devices: [] },
  };
  server.snmp = { communities: [{ name: "public", access: "RO" }], hosts: [] };
  server.services = { ...(server.services || {}), http: true, dns: true, smtp: true, pop3: true, snmp: true, vpn: true, pppoe: true, iot: true };
  const link = { id: "l1", a: pc.id, ai: "eth0", b: server.id, bi: "eth0", type: "copper", up: true };
  return { devices: { [pc.id]: pc, [server.id]: server }, links: [link], pc, server };
}

test("resolves DNS records and serves HTTP files through topology reachability", () => {
  const context = loadRuntime();
  const { devices, links, pc } = lab(context);
  const resolved = context.OPT_Services.resolveName({ devices, sourceId: pc.id, target: "srv.local" });
  assert.equal(resolved.ok, true);
  assert.equal(resolved.ip, "192.168.1.20");

  const response = context.OPT_Services.requestHttp({ devices, links, sourceId: pc.id, url: "http://srv.local/index.html" });
  assert.equal(response.ok, true);
  assert.match(response.body, /OpenPT Server/);
});

test("HTTP reports service disabled and missing route distinctly", () => {
  const context = loadRuntime();
  const { devices, links, pc, server } = lab(context);
  server.services.http = false;
  server.serverConfig.http.http = false;
  const disabled = context.OPT_Services.requestHttp({ devices, links, sourceId: pc.id, url: "http://192.168.1.20" });
  assert.equal(disabled.ok, false);
  assert.match(disabled.error, /HTTP service is off/);

  server.services.http = true;
  server.serverConfig.http.http = true;
  links[0].up = false;
  const unrouted = context.OPT_Services.requestHttp({ devices, links, sourceId: pc.id, url: "http://192.168.1.20" });
  assert.equal(unrouted.ok, false);
  assert.match(unrouted.error, /down|unreachable|No link/i);
});

test("SMTP send and POP3 fetch use server users and mailboxes", () => {
  const context = loadRuntime();
  const { devices, links, pc } = lab(context);
  const account = { address: "alice@openpt.local", password: "pw", smtp: "192.168.1.20", pop3: "192.168.1.20" };
  const sent = context.OPT_Services.sendMail({ devices, links, sourceId: pc.id, account, message: { to: "bob@openpt.local", subject: "Lab", body: "Ready" } });
  assert.equal(sent.ok, true);
  const fetched = context.OPT_Services.fetchMail({ devices, links, sourceId: pc.id, account: { ...account, address: "bob@openpt.local" } });
  assert.equal(fetched.ok, true);
  assert.equal(fetched.messages[0].subject, "Lab");

  const bad = context.OPT_Services.sendMail({ devices, links, sourceId: pc.id, account: { ...account, password: "bad" }, message: { to: "bob@openpt.local" } });
  assert.equal(bad.ok, false);
  assert.match(bad.error, /authentication/i);
});

test("SNMP checks communities and returns deterministic OID values", () => {
  const context = loadRuntime();
  const { devices, links, pc } = lab(context);
  const ok = context.OPT_Services.querySnmp({ devices, links, sourceId: pc.id, target: "192.168.1.20", community: "public", oid: "1.3.6.1.2.1.1.5.0" });
  assert.equal(ok.ok, true);
  assert.match(ok.value, /SRV1/);
  const bad = context.OPT_Services.querySnmp({ devices, links, sourceId: pc.id, target: "192.168.1.20", community: "private" });
  assert.equal(bad.ok, false);
  assert.match(bad.error, /community/i);
});

test("endpoint firewall rules deny matching app traffic", () => {
  const context = loadRuntime();
  const { devices, links, pc } = lab(context);
  pc.appSettings = { firewall: { enabled: true, rules: [{ action: "deny", protocol: "tcp", src: "any", dst: "192.168.1.20", port: "80", direction: "out" }] } };
  const response = context.OPT_Services.requestHttp({ devices, links, sourceId: pc.id, url: "http://192.168.1.20" });
  assert.equal(response.ok, false);
  assert.match(response.error, /firewall denies/i);
});

test("VPN and PPPoE sessions authenticate against AAA users", () => {
  const context = loadRuntime();
  const { devices, links, pc } = lab(context);
  const vpn = context.OPT_Services.connectVpn({ devices, links, sourceId: pc.id, target: "192.168.1.20", username: "alice", password: "pw" });
  assert.equal(vpn.ok, true);
  assert.equal(devices[pc.id].appRuntime.sessions.vpn.connected, true);

  const pppoe = context.OPT_Services.connectPppoe({ devices, links, sourceId: pc.id, target: "192.168.1.20", username: "alice", password: "bad" });
  assert.equal(pppoe.ok, false);
  assert.match(pppoe.error, /authentication/i);
});

test("IoT registration and script runs persist runtime state", () => {
  const context = loadRuntime();
  const { devices, links, pc, server } = lab(context);
  const reg = context.OPT_Services.registerIotDevice({ devices, links, sourceId: pc.id, server: "192.168.1.20", zone: "Lab" });
  assert.equal(reg.ok, true);
  assert.equal(devices[server.id].appRuntime.iot.registrations[0].name, "PC1");

  const run = context.OPT_Services.runIotScript({ devices, sourceId: pc.id, project: "door", language: "JavaScript", code: "toggle('led0')" });
  assert.equal(run.ok, true);
  assert.equal(devices[pc.id].appRuntime.iot.scripts[0].project, "door");
});
