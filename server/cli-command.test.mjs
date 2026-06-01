import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { transformSync } from "@babel/core";

const __dirname = dirname(fileURLToPath(import.meta.url));
let loadedContext;

async function loadCliContext() {
  if (loadedContext) return loadedContext;

  const context = {
    window: {},
    console,
    setTimeout,
    clearTimeout,
    requestAnimationFrame: (fn) => setTimeout(fn, 0),
    cancelAnimationFrame: clearTimeout,
  };
  context.globalThis = context;
  vm.createContext(context);

  const engineSource = await readFile(join(__dirname, "..", "engine.jsx"), "utf8");
  vm.runInContext(engineSource, context, { filename: "engine.jsx" });

  const cliSource = await readFile(join(__dirname, "..", "cli.jsx"), "utf8");
  const transformed = transformSync(cliSource, {
    filename: "cli.jsx",
    presets: [["@babel/preset-react", { runtime: "classic" }]],
    babelrc: false,
    configFile: false,
  }).code;
  vm.runInContext(transformed, context, { filename: "cli.jsx" });

  loadedContext = context;
  return context;
}

function createReactHarness(context, props) {
  const hookValues = [];
  let hookIndex = 0;
  let tree;

  const React = {
    createElement(type, props, ...children) {
      return {
        type,
        props: {
          ...(props || {}),
          children: children.length <= 1 ? children[0] : children,
        },
      };
    },
    useRef(initialValue) {
      const index = hookIndex++;
      if (!hookValues[index]) hookValues[index] = { current: initialValue };
      return hookValues[index];
    },
    useState(initialValue) {
      const index = hookIndex++;
      if (!(index in hookValues)) {
        hookValues[index] = typeof initialValue === "function" ? initialValue() : initialValue;
      }
      const setState = (nextValue) => {
        hookValues[index] = typeof nextValue === "function" ? nextValue(hookValues[index]) : nextValue;
        render();
      };
      return [hookValues[index], setState];
    },
    useEffect() {
      hookIndex++;
    },
  };

  function render() {
    hookIndex = 0;
    context.React = React;
    tree = context.window.CLI(props);
    return tree;
  }

  function command(text) {
    const input = findByType(tree, "input");
    assert.ok(input, "expected CLI input to render");
    input.props.onChange({ target: { value: text } });
    const form = findByType(tree, "form");
    assert.ok(form, "expected CLI form to render");
    form.props.onSubmit({ preventDefault() {} });
  }

  function setInput(text) {
    const input = findByType(tree, "input");
    assert.ok(input, "expected CLI input to render");
    input.props.onChange({ target: { value: text } });
  }

  function keyDown(key, extra = {}) {
    const input = findByType(tree, "input");
    assert.ok(input, "expected CLI input to render");
    input.props.onKeyDown({
      key,
      preventDefault() {},
      ctrlKey: false,
      ...extra,
    });
  }

  function inputValue() {
    const input = findByType(tree, "input");
    assert.ok(input, "expected CLI input to render");
    return input.props.value;
  }

  function lines() {
    return findAll(tree, (node) => typeof node?.props?.className === "string" && node.props.className.startsWith("cli-line "))
      .map((node) => ({
        cls: node.props.className.replace(/^cli-line\s*/, ""),
        text: textContent(node),
      }));
  }

  function text() {
    return lines().map((line) => line.text).join("\n");
  }

  function prompt() {
    const node = findAll(tree, (candidate) => candidate?.props?.className === "cli-prompt").at(-1);
    return node ? textContent(node) : "";
  }

  render();
  return { command, setInput, keyDown, inputValue, lines, text, prompt, tree: () => tree };
}

function findByType(root, type) {
  return findAll(root, (node) => node?.type === type)[0] || null;
}

function findAll(root, predicate, out = []) {
  if (Array.isArray(root)) {
    root.forEach((child) => findAll(child, predicate, out));
    return out;
  }
  if (!root || typeof root !== "object") return out;
  if (predicate(root)) out.push(root);
  findAll(root.props?.children, predicate, out);
  return out;
}

function textContent(node) {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textContent).join("");
  return textContent(node.props?.children);
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

async function makeHarness({ device, devices, links = [], onApply = () => {}, onPing = () => {}, onTraceEvent = () => {} }) {
  const context = await loadCliContext();
  return createReactHarness(context, {
    device,
    devices: devices || { [device.id]: device },
    links,
    onApply,
    onPing,
    onTraceEvent,
    active: true,
  });
}

async function makeDevice(kind, hostname, seededIfaces = {}, extra = {}) {
  const context = await loadCliContext();
  const device = context.window.OPT_Engine.makeDevice(kind, hostname, 0, 0, seededIfaces, extra);
  device.id = extra.id || `${kind}-${hostname.toLowerCase()}`;
  return device;
}

test("drives IOS mode flow, abbreviations, show output, and interface config payloads", async () => {
  const applies = [];
  const router = await makeDevice("router", "R1", {
    "GigabitEthernet0/0": {
      ip: "192.168.10.1",
      mask: "255.255.255.0",
      up: true,
      admUp: true,
      desc: "LAN",
      mac: "00:11:22:33:44:55",
    },
    "GigabitEthernet0/1": {
      ip: "10.0.0.1",
      mask: "255.255.255.252",
      up: true,
      admUp: true,
      mac: "00:11:22:33:44:66",
    },
  }, {
    id: "router-r1",
    platform: "2911",
    startupConfig: "version 15.2\nhostname R1\nend",
    files: { "flash:packages.conf": "IOS package manifest", "flash:notes.txt": "hello" },
  });
  router.routes = [
    { type: "C", dst: "192.168.10.0", mask: "255.255.255.0", via: "directly", iface: "GigabitEthernet0/0" },
    { type: "S", dst: "198.51.100.0", mask: "255.255.255.0", via: "10.0.0.2", iface: "GigabitEthernet0/1" },
  ];

  const cli = await makeHarness({ device: router, onApply: (cmd) => applies.push(cmd) });
  assert.equal(cli.prompt(), "R1>");

  cli.command("en");
  assert.equal(cli.prompt(), "R1#");

  cli.command("sh ver");
  assert.match(cli.text(), /R1# sh ver/);
  assert.match(cli.text(), /Cisco IOS 15\.2\(4\)M/);
  assert.match(cli.text(), /System image file is "flash:c2900-universalk9-mz\.SPA\.152-4\.M\.bin"/);

  cli.command("show ip int br");
  assert.match(cli.text(), /Interface\s+IP-Address\s+OK\? Method Status\s+Protocol/);
  assert.match(cli.text(), /Gi0\/0\s+192\.168\.10\.1\s+YES manual up\s+up/);

  cli.command("show ip route");
  assert.match(cli.text(), /Codes: C - connected, S - static, O - OSPF/);
  assert.match(cli.text(), /S\s+198\.51\.100\.0\/24 via 10\.0\.0\.2, Gi0\/1/);

  cli.command("dir");
  assert.match(cli.text(), /Directory of flash:\//);
  assert.match(cli.text(), /notes\.txt/);

  cli.command("show inventory");
  assert.match(cli.text(), /NAME: "R1", DESCR: "2911"/);
  assert.match(cli.text(), /SN: OPENPTTER-R1/);

  cli.command("conf t");
  assert.match(cli.text(), /Enter configuration commands, one per line\. End with CNTL\/Z\./);
  assert.equal(cli.prompt(), "R1(config)#");

  cli.command("int gi0/0");
  assert.equal(cli.prompt(), "R1(config-if)#");

  cli.command("description Uplink to SW1");
  cli.command("ip address 192.0.2.1 255.255.255.0");
  cli.command("no shutdown");
  cli.command("do show interfaces gi0/0");
  assert.match(cli.text(), /Gi0\/0 is up, line protocol is up/);
  assert.match(cli.text(), /Internet address is 192\.168\.10\.1\/24/);

  cli.command("exit");
  assert.equal(cli.prompt(), "R1(config)#");
  cli.command("end");
  assert.equal(cli.prompt(), "R1#");

  assert.deepEqual(plain(applies), [
    { kind: "desc", iface: "GigabitEthernet0/0", value: "Uplink to SW1" },
    { kind: "ip-address", iface: "GigabitEthernet0/0", ip: "192.0.2.1", mask: "255.255.255.0" },
    { kind: "admin", iface: "GigabitEthernet0/0", up: true },
  ]);
});

test("provides contextual IOS help, completion, abbreviation errors, and interface suggestions", async () => {
  const router = await makeDevice("router", "RHELP", {
    "GigabitEthernet0/0": { ip: "192.0.2.1", mask: "255.255.255.0", up: true, admUp: true },
  }, {
    id: "router-help",
    platform: "2911",
  });
  const cli = await makeHarness({ device: router });

  cli.command("?");
  assert.match(cli.text(), /\benable\b/);
  assert.match(cli.text(), /\bshow\b/);

  cli.command("enable");
  cli.command("show ?");
  assert.match(cli.text(), /\brunning-config\b/);
  assert.match(cli.text(), /\bip\b/);
  assert.match(cli.text(), /<cr>/);

  cli.command("show ip ?");
  assert.match(cli.text(), /\binterface\b/);
  assert.match(cli.text(), /\broute\b/);

  cli.command("show ip");
  assert.match(cli.text(), /% Incomplete command\./);
  cli.command("show ip r");
  assert.match(cli.text(), /% Ambiguous command: "show ip r"/);

  cli.setInput("conf");
  cli.keyDown("Tab");
  assert.equal(cli.inputValue(), "configure ");
  cli.setInput("configure t");
  cli.keyDown("Tab");
  assert.equal(cli.inputValue(), "configure terminal ");

  cli.command("conf t");
  assert.equal(cli.prompt(), "RHELP(config)#");
  cli.command("interface ?");
  assert.match(cli.text(), /Gi0\/0/);
  assert.match(cli.text(), /\brange\b/);

  cli.setInput("interface g");
  cli.keyDown("Tab");
  assert.equal(cli.inputValue(), "interface Gi0/");
  cli.setInput("interface gi0/0");
  cli.keyDown("Tab");
  assert.equal(cli.inputValue(), "interface Gi0/0 ");
  cli.command("int gi0/0");
  assert.equal(cli.prompt(), "RHELP(config-if)#");

  cli.command("s");
  assert.match(cli.text(), /% Ambiguous command: "s"/);
});

test("provides contextual host and macOS help and completion without stealing ipconfig slash-help", async () => {
  const pc = await makeDevice("pc", "PCHelp", {
    eth0: { ip: "192.168.1.10", mask: "255.255.255.0", gw: "192.168.1.1", up: true, admUp: true },
  }, { id: "pc-help" });
  const pcCli = await makeHarness({ device: pc });

  pcCli.command("?");
  assert.match(pcCli.text(), /\bipconfig\b/);
  assert.match(pcCli.text(), /\bnslookup\b/);

  pcCli.setInput("tel");
  pcCli.keyDown("Tab");
  assert.equal(pcCli.inputValue(), "telnet ");

  pcCli.command("ipconfig /?");
  assert.match(pcCli.text(), /USAGE: ipconfig \[\/all\] \[\/release\] \[\/renew\]/);

  const mac = await makeDevice("mac", "MacHelp", {
    en0: { ip: "10.10.10.25", mask: "255.255.255.0", gw: "10.10.10.1", up: true, admUp: true },
  }, { id: "mac-help" });
  const macCli = await makeHarness({ device: mac });

  macCli.command("?");
  assert.match(macCli.text(), /\bifconfig\b/);
  assert.match(macCli.text(), /\bnetworksetup\b/);

  macCli.setInput("ifc");
  macCli.keyDown("Tab");
  assert.equal(macCli.inputValue(), "ifconfig ");
});

test("handles startup-config checkpoints and virtual config files", async () => {
  const applies = [];
  const router = await makeDevice("router", "R1", {
    "GigabitEthernet0/0": {
      ip: "192.168.10.1",
      mask: "255.255.255.0",
      up: true,
      admUp: true,
      desc: "LAN",
      mac: "00:11:22:33:44:55",
    },
  }, {
    id: "router-r1",
    platform: "2911",
    files: { "flash:notes.txt": "hello" },
  });
  const context = await loadCliContext();
  router.startupConfig = context.window.OPT_Engine.serializeConfig(router);
  router.startupConfigState = context.window.OPT_Engine.startupConfigSnapshot(router);
  router.hostname = "Unsaved";

  const cli = await makeHarness({ device: router, onApply: (cmd) => applies.push(cmd) });
  cli.command("enable");
  cli.command("show running-config");
  cli.command("show startup-config");
  cli.command("dir nvram:");
  cli.command("more nvram:startup-config");
  cli.command("more system:running-config");
  cli.command("write memory");
  cli.command("reload");
  cli.command("delete nvram:startup-config");

  const output = cli.text();
  assert.match(output, /hostname Unsaved/);
  assert.match(output, /hostname R1/);
  assert.match(output, /Directory of nvram:\//);
  assert.match(output, /\d+\s+startup-config/);
  assert.match(output, /System Bootstrap, reloading from startup-config/);
  assert.equal(applies.at(-3).kind, "save-startup");
  assert.match(applies.at(-3).config, /hostname Unsaved/);
  assert.equal(applies.at(-3).state.hostname, "Unsaved");
  assert.deepEqual(plain(applies.at(-2)), { kind: "reload" });
  assert.deepEqual(plain(applies.at(-1)), { kind: "file-delete", path: "nvram:startup-config" });
});

test("renders Cisco-like switching show commands", async () => {
  const sw = await makeDevice("l2switch", "SW1", {
    "FastEthernet0/1": {
      up: true,
      admUp: true,
      mode: "access",
      vlan: 10,
      mac: "00:AA:BB:CC:DD:01",
      portSecurity: { enabled: true, maximum: 2, macs: ["00:AA:BB:CC:DD:01"], violation: "restrict" },
    },
    "FastEthernet0/2": {
      up: true,
      admUp: true,
      mode: "trunk",
      nativeVlan: 99,
      allowedVlans: "10,20,99",
      mac: "00:AA:BB:CC:DD:02",
      dhcpSnoopingTrust: true,
      daiTrust: true,
    },
  }, {
    id: "switch-sw1",
    platform: "2960-24tt",
  });
  Object.assign(sw.interfaces["FastEthernet0/1"], {
    up: true,
    admUp: true,
    mode: "access",
    vlan: 10,
    mac: "00:AA:BB:CC:DD:01",
    portSecurity: { enabled: true, maximum: 2, macs: ["00:AA:BB:CC:DD:01"], violation: "restrict" },
  });
  Object.assign(sw.interfaces["FastEthernet0/2"], {
    up: true,
    admUp: true,
    mode: "trunk",
    nativeVlan: 99,
    allowedVlans: "10,20,99",
    mac: "00:AA:BB:CC:DD:02",
    dhcpSnoopingTrust: true,
    daiTrust: true,
  });
  sw.vlans = { 1: "default", 10: "Users", 20: "Voice", 99: "Native" };
  sw.dhcpSnooping = { enabled: true, vlans: [10, 20] };
  sw.dai = { vlans: [10, 20] };

  const cli = await makeHarness({ device: sw });
  cli.command("enable");
  cli.command("show vlan brief");
  cli.command("show interfaces trunk");
  cli.command("show mac address-table");
  cli.command("show spanning-tree");
  cli.command("show port-security");
  cli.command("show ip dhcp snooping");
  cli.command("show ip arp inspection");

  const output = cli.text();
  assert.match(output, /VLAN Name\s+Status\s+Ports/);
  assert.match(output, /10\s+Users\s+active\s+Fa0\/1/);
  assert.match(output, /Port\s+Mode\s+Native vlan\s+Vlans allowed on trunk/);
  assert.match(output, /Fa0\/2\s+on\s+99\s+10,20,99/);
  assert.match(output, /Mac Address Table/);
  assert.match(output, /00:AA:BB:CC:DD:01\s+DYNAMIC\s+Fa0\/1/);
  assert.match(output, /Spanning tree enabled protocol rapid-pvst/);
  assert.match(output, /Secure Port\s+MaxSecureAddr\s+CurrentAddr\s+SecurityViolation\s+Action/);
  assert.match(output, /Fa0\/1\s+2\s+1\s+0\s+restrict/);
  assert.match(output, /Switch DHCP snooping is enabled/);
  assert.match(output, /Trusted interface: Fa0\/2/);
  assert.match(output, /Dynamic ARP inspection VLANs: 10,20/);
});

test("emits apply payloads across global, routing, switching, and policy config commands", async () => {
  const routerApplies = [];
  const router = await makeDevice("router", "R2", {}, { id: "router-r2", platform: "2911" });
  const routerCli = await makeHarness({ device: router, onApply: (cmd) => routerApplies.push(cmd) });

  [
    "enable",
    "configure terminal",
    "hostname Edge",
    "interface gi0/1",
    "ip nat inside",
    "exit",
    "ip route 203.0.113.0 255.255.255.0 10.0.0.2",
    "router ospf 1",
    "network 10.0.0.0 0.0.0.255 area 0",
    "exit",
    "ip dhcp pool LAN",
    "network 192.168.1.0 255.255.255.0",
    "default-router 192.168.1.1",
    "exit",
    "ip access-list extended WEB",
    "permit tcp any any eq 80",
    "exit",
    "line vty 0 4",
    "transport input ssh",
    "exit",
    "route-map PBR permit 10",
    "match ip address WEB",
    "set ip next-hop 10.0.0.2",
    "exit",
    "class-map match-any VOICE",
    "match dscp ef",
    "exit",
    "policy-map WAN",
    "class VOICE",
    "priority percent 30",
    "exit",
    "exit",
    "ip sla 1",
    "icmp-echo 198.51.100.1",
    "frequency 30",
  ].forEach((cmd) => routerCli.command(cmd));

  assert.deepEqual(plain(routerApplies.find((cmd) => cmd.kind === "hostname")), { kind: "hostname", value: "Edge" });
  assert.deepEqual(plain(routerApplies.find((cmd) => cmd.kind === "nat-role")), { kind: "nat-role", iface: "GigabitEthernet0/1", value: "inside" });
  assert.deepEqual(plain(routerApplies.find((cmd) => cmd.kind === "ip-route")), { kind: "ip-route", dst: "203.0.113.0", mask: "255.255.255.0", via: "10.0.0.2" });
  assert.deepEqual(plain(routerApplies.find((cmd) => cmd.kind === "ospf-network")), { kind: "ospf-network", pid: "1", network: "10.0.0.0", wildcard: "0.0.0.255", area: "0" });
  assert.deepEqual(plain(routerApplies.find((cmd) => cmd.kind === "dhcp-default-router")), { kind: "dhcp-default-router", pool: "LAN", ip: "192.168.1.1" });
  assert.deepEqual(plain(routerApplies.find((cmd) => cmd.kind === "acl-entry")), { kind: "acl-entry", name: "WEB", aclType: "extended", action: "permit", spec: "tcp any any eq 80" });
  assert.deepEqual(plain(routerApplies.find((cmd) => cmd.kind === "line-transport")), { kind: "line-transport", line: "vty", value: ["ssh"] });
  assert.deepEqual(plain(routerApplies.find((cmd) => cmd.kind === "route-map-line" && cmd.field === "set")), { kind: "route-map-line", name: "PBR", seq: 10, field: "set", value: "ip next-hop 10.0.0.2" });
  assert.deepEqual(plain(routerApplies.find((cmd) => cmd.kind === "class-map-match")), { kind: "class-map-match", name: "VOICE", match: "dscp ef" });
  assert.deepEqual(plain(routerApplies.find((cmd) => cmd.kind === "policy-map-action")), { kind: "policy-map-action", policy: "WAN", className: "VOICE", action: "priority percent 30" });
  assert.deepEqual(plain(routerApplies.find((cmd) => cmd.kind === "ip-sla-field" && cmd.field === "frequency")), { kind: "ip-sla-field", id: "1", field: "frequency", value: 30 });

  const switchApplies = [];
  const sw = await makeDevice("l2switch", "SW2", {}, { id: "switch-sw2", platform: "2960-24tt" });
  const switchCli = await makeHarness({ device: sw, onApply: (cmd) => switchApplies.push(cmd) });
  [
    "enable",
    "configure terminal",
    "vlan 20",
    "name Users",
    "exit",
    "interface fa0/1",
    "switchport mode access",
    "switchport access vlan 20",
    "interface range fa0/1 - 2",
    "switchport mode trunk",
  ].forEach((cmd) => switchCli.command(cmd));

  assert.deepEqual(plain(switchApplies.find((cmd) => cmd.kind === "vlan-add")), { kind: "vlan-add", id: 20 });
  assert.deepEqual(plain(switchApplies.find((cmd) => cmd.kind === "vlan-name")), { kind: "vlan-name", id: 20, name: "Users" });
  assert.deepEqual(plain(switchApplies.find((cmd) => cmd.kind === "swvlan")), { kind: "swvlan", iface: "FastEthernet0/1", value: 20 });
  assert.deepEqual(
    plain(switchApplies.filter((cmd) => cmd.kind === "swmode" && cmd.value === "trunk").map((cmd) => cmd.iface)),
    ["FastEthernet0/1", "FastEthernet0/2"]
  );
});

test("reports Cisco-like invalid input, unsupported platform, and host service errors", async () => {
  const router = await makeDevice("router", "R3", {}, { id: "router-r3", platform: "2911" });
  const routerCli = await makeHarness({ device: router });
  routerCli.command("configure terminal");
  assert.match(routerCli.text(), /% Invalid input detected at '\^' marker\. \(try 'enable'\)/);

  routerCli.command("enable");
  routerCli.command("show bananas");
  assert.match(routerCli.text(), /% Invalid input detected at '\^' marker\.\s+Try "show running-config"\./);

  routerCli.command("configure terminal");
  routerCli.command("vlan 10");
  assert.match(routerCli.text(), /% switching is not supported on 2911\./);
  routerCli.command("interface gi0/0");
  routerCli.command("switchport mode access");
  assert.match(routerCli.text(), /% switchport configuration is not supported on 2911\./);
  routerCli.command("interface banana");
  assert.match(routerCli.text(), /% Invalid interface 'banana'/);
  routerCli.command("show vlan");
  assert.match(routerCli.text(), /% VLAN database is not available on this device/);

  const sw = await makeDevice("l2switch", "SW3", {}, { id: "switch-sw3", platform: "2960-24tt" });
  const switchCli = await makeHarness({ device: sw });
  switchCli.command("enable");
  switchCli.command("show ip route");
  assert.match(switchCli.text(), /% IP routing table is not available on this device/);
  switchCli.command("configure terminal");
  switchCli.command("ip route 203.0.113.0 255.255.255.0 10.0.0.1");
  assert.match(switchCli.text(), /% Layer 3 routing is not supported on 2960-24TT\./);
  switchCli.command("interface range fa0/99 - 100");
  assert.match(switchCli.text(), /% Invalid interface range 'fa0\/99 - 100'/);

  const pc = await makeDevice("pc", "PC1", {
    eth0: { ip: "192.168.1.10", mask: "255.255.255.0", gw: "192.168.1.1", up: true, admUp: true },
  }, { id: "pc-pc1" });
  const pcCli = await makeHarness({ device: pc });
  pcCli.command("telnet 203.0.113.1");
  assert.match(pcCli.text(), /Connecting To 203\.0\.113\.1\.\.\./);
  assert.match(pcCli.text(), /Could not open connection to the host, on port 23: Connect failed/);
});

test("covers host, macOS shell, ping, and traceroute output", async () => {
  const pc = await makeDevice("pc", "PC2", {
    eth0: {
      ip: "192.168.1.20",
      mask: "255.255.255.0",
      gw: "192.168.1.1",
      dns: "192.168.1.53",
      mac: "00:12:34:56:78:9A",
      up: true,
      admUp: true,
    },
  }, {
    id: "pc-pc2",
    arp: { "192.168.1.1": "00:11:22:33:44:55" },
  });
  pc.arp = { "192.168.1.1": "00:11:22:33:44:55" };

  const pcCli = await makeHarness({
    device: pc,
    onPing(id, target, options, done) {
      if (options.trace) {
        return {
          ok: true,
          devices: { [pc.id]: pc },
          hops: [{ devId: pc.id, action: "deliver", note: `reached ${target}`, ok: true }],
        };
      }
      done({ ok: target === "192.168.1.1", error: "unreachable" });
    },
  });

  pcCli.command("ipconfig /all");
  pcCli.command("arp -a");
  pcCli.command("ping 192.168.1.1");
  pcCli.command("ping 203.0.113.9");
  pcCli.command("tracert 192.168.1.1");

  assert.match(pcCli.text(), /Windows IP Configuration/);
  assert.match(pcCli.text(), /Physical Address\. .+ : 00-12-34-56-78-9A/);
  assert.match(pcCli.text(), /Interface: 192\.168\.1\.20 --- 0x1/);
  assert.match(pcCli.text(), /Success rate is 100 percent \(5\/5\)/);
  assert.match(pcCli.text(), /Success rate is 0 percent \(0\/5\) - unreachable/);
  assert.match(pcCli.text(), /Tracing the route to 192\.168\.1\.1/);
  assert.match(pcCli.text(), /Trace complete\./);

  const mac = await makeDevice("mac", "Mac1", {
    en0: {
      ip: "10.10.10.25",
      mask: "255.255.255.0",
      gw: "10.10.10.1",
      mac: "AA:BB:CC:DD:EE:FF",
      up: true,
      admUp: true,
    },
  }, { id: "mac-mac1" });
  const macCli = await makeHarness({ device: mac });
  assert.equal(macCli.prompt(), "Mac1:~ admin$");

  macCli.command("pwd");
  macCli.command("ifconfig");
  macCli.command("man ifconfig");

  assert.match(macCli.text(), /\/Users\/admin/);
  assert.match(macCli.text(), /en0: flags=8863<UP,BROADCAST,SMART,RUNNING,SIMPLEX,MULTICAST> mtu 1500/);
  assert.match(macCli.text(), /inet 10\.10\.10\.25 netmask 0xffffff00 broadcast 10\.10\.10\.255/);
  assert.match(macCli.text(), /IFCONFIG\(1\)\s+General Commands Manual/);
  assert.match(macCli.text(), /ifconfig - configure network interface parameters/);
});

test("host CLI emits packet trace events for DNS and service checks", async () => {
  const pc = await makeDevice("pc", "PCTrace", {
    eth0: { ip: "192.168.20.10", mask: "255.255.255.0", gw: "192.168.20.1", dns: "192.168.20.53", up: true, admUp: true },
  }, { id: "pc-trace" });
  const server = await makeDevice("server", "WEB1", {
    eth0: { ip: "192.168.20.80", mask: "255.255.255.0", gw: "192.168.20.1", up: true, admUp: true },
  }, { id: "server-web1" });
  server.services.http = true;
  server.services.ssh = true;
  server.services.dns = true;
  server.serverConfig = {
    ...(server.serverConfig || {}),
    dns: { service: true, records: [{ name: "web1.local", type: "A Record", detail: "192.168.20.80" }] },
  };
  const traces = [];
  const cli = await makeHarness({
    device: pc,
    devices: { [pc.id]: pc, [server.id]: server },
    onPing(id, target, options, done) {
      const result = { ok: true, devices: { [pc.id]: pc, [server.id]: server }, hops: [{ devId: pc.id, action: "route", note: `toward ${target}`, ok: true }] };
      if (typeof done === "function") done(result);
      return result;
    },
    onTraceEvent: (trace) => traces.push(plain(trace)),
  });

  cli.command("nslookup web1.local");
  cli.command("curl http://web1.local");
  cli.command("ssh WEB1");

  assert.equal(traces[0].protocol, "dns");
  assert.equal(traces[0].artifacts.dnsLookup.answer, "192.168.20.80");
  assert.equal(traces[1].protocol, "http");
  assert.equal(traces[1].status, "ok");
  assert.equal(traces[2].protocol, "ssh");
  assert.equal(traces[2].status, "ok");
});
