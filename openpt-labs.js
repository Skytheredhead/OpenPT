// openpt-labs.js - shared authored OpenPT lab registry.
(function () {
  const COURSE = "CCNA-B";

  function engine() {
    if (!window.OPT_Engine) throw new Error("OpenPT lab factories require OPT_Engine.");
    return window.OPT_Engine;
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function iface(seed = {}) {
    return { ip: null, mask: null, gw: null, up: true, admUp: true, mac: mac(), desc: "", ...seed };
  }

  function switchIface(seed = {}) {
    return iface({ mode: "access", vlan: 1, nativeVlan: 1, allowedVlans: "all", stp: { portfast: false, bpduguard: false, state: "forwarding" }, ...seed });
  }

  function mac() {
    const E = engine();
    return typeof E.uid === "function"
      ? `AA:${Array.from({ length: 5 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0").toUpperCase()).join(":")}`
      : "AA:00:00:00:00:01";
  }

  function makeDevice(spec) {
    const E = engine();
    const ifaces = {};
    for (const [name, data] of Object.entries(spec.ifaces || {})) {
      ifaces[name] = spec.kind === "l2switch" || spec.kind === "l3switch" ? switchIface(data) : iface(data);
    }
    const dev = E.makeDevice(spec.kind, spec.name, spec.x, spec.y, ifaces, clone(spec.extra || {}));
    if (spec.vlans) dev.vlans = { ...(dev.vlans || {}), ...spec.vlans };
    if (spec.ospf) dev.ospf = clone(spec.ospf);
    if (spec.acls) dev.acls = clone(spec.acls);
    if (spec.hosts) dev.hosts = clone(spec.hosts);
    if (spec.dhcp) dev.dhcp = clone(spec.dhcp);
    if (spec.nat) dev.nat = clone(spec.nat);
    return dev;
  }

  function connect(devicesByName, aName, ai, bName, bi, type = "copper") {
    const E = engine();
    const a = devicesByName[aName];
    const b = devicesByName[bName];
    a.interfaces[ai] = { ...(a.interfaces[ai] || iface()), up: true, admUp: true };
    b.interfaces[bi] = { ...(b.interfaces[bi] || iface()), up: true, admUp: true };
    return { id: E.uid("l"), a: a.id, ai, b: b.id, bi, type, up: true };
  }

  function instructions(title, tasks, notes = []) {
    const taskList = tasks.map((task) => `<li>${task}</li>`).join("");
    const noteText = notes.map((note) => `<p>${note}</p>`).join("");
    return `<h1>Tasks</h1><p>${title}</p><ul>${taskList}</ul>${noteText}`;
  }

  function cleanCommand(raw) {
    return String(raw || "")
      .replace(/^[A-Za-z0-9_-]+(?:\([^)]*\))?[>#]\s*/, "")
      .replace(/^[A-Za-z0-9_-]+\(config[^)]*\)#\s*/, "")
      .trim();
  }

  function expandRange(text) {
    const raw = String(text || "").trim();
    if (raw.includes(",")) return raw.split(",").flatMap((part) => expandRange(part.trim())).filter(Boolean);
    const match = raw.match(/^(.+?)(\d+)\s*-\s*(\d+)$/);
    if (!match) return [raw];
    const out = [];
    for (let i = Number(match[2]); i <= Number(match[3]); i++) out.push(`${match[1]}${i}`);
    return out;
  }

  function assessmentItems(title, answerCommands) {
    const items = [];
    for (const [device, lines] of Object.entries(answerCommands || {})) {
      let ifaces = [];
      let context = "Configuration";
      let vlanId = null;
      for (const raw of lines || []) {
        const cmd = cleanCommand(raw);
        if (!cmd || /^(enable|configure terminal|end|exit)$/i.test(cmd)) continue;
        if (/^no \d+$/.test(cmd) || /^no network /.test(cmd)) continue;
        let match = cmd.match(/^interface range (.+)$/i);
        if (match) { ifaces = expandRange(match[1]); context = "Interface Configuration"; continue; }
        match = cmd.match(/^interface (.+)$/i);
        if (match) { ifaces = [match[1]]; context = "Interface Configuration"; continue; }
        match = cmd.match(/^vlan (\d+)$/i);
        if (match) { vlanId = match[1]; context = "VLAN Configuration"; items.push(item(title, device, null, cmd, context)); continue; }
        if (/^router /.test(cmd)) { ifaces = []; context = "Routing Configuration"; items.push(item(title, device, null, cmd, context)); continue; }
        if (/^ip dhcp pool /.test(cmd)) { ifaces = []; context = "DHCP Configuration"; items.push(item(title, device, null, cmd, context)); continue; }
        if (/^ip access-list /.test(cmd)) { ifaces = []; context = "ACL Configuration"; items.push(item(title, device, null, cmd, context)); continue; }
        if (/^line /.test(cmd)) { ifaces = []; context = "Line Configuration"; continue; }
        if (/^name /.test(cmd) && vlanId) {
          items.push(item(title, device, null, `vlan ${vlanId} ${cmd}`, "VLAN Configuration"));
          continue;
        }
        const targets = ifaces.length ? ifaces : [null];
        for (const ifaceName of targets) items.push(item(title, device, ifaceName, cmd, context));
      }
    }
    return items;
  }

  function item(rootName, device, ifaceName, command, components) {
    return {
      device,
      iface: ifaceName || undefined,
      name: command,
      value: command,
      components,
      rootName,
    };
  }

  function activity(lab) {
    const items = assessmentItems(lab.title, lab.answerCommands).map((entry, index) => ({
      id: `${lab.id}-${index}`,
      points: 1,
      pathParts: [entry.device, entry.iface, entry.name].filter(Boolean),
      parentPath: [entry.rootName, entry.device, entry.iface].filter(Boolean).join(" / "),
      path: [entry.rootName, entry.device, entry.iface, entry.name].filter(Boolean).join(" / "),
      ...entry,
    }));
    return {
      format: "openpt-authored-lab",
      labKey: lab.id,
      title: lab.title,
      sourceName: `${lab.id}.opt`,
      category: lab.category || "CCNA Practice",
      difficulty: lab.difficulty || "intermediate",
      estimatedMinutes: lab.estimatedMinutes || 10,
      skills: clone(lab.skills || []),
      summary: lab.summary || "",
      instructionsHtml: lab.instructionsHtml,
      hints: lab.hints || [],
      answerCommands: clone(lab.answerCommands || {}),
      assessmentItems: items,
      autograder: {
        mode: "answer-command-checks",
        itemCount: items.length,
        deterministic: true,
      },
    };
  }

  function buildLab(lab) {
    const devicesByName = Object.fromEntries((lab.devices || []).map((spec) => {
      const dev = makeDevice(spec);
      return [spec.name, dev];
    }));
    const links = (lab.links || []).map((link) => connect(devicesByName, ...link));
    return {
      id: lab.id,
      title: lab.title,
      fileName: lab.id,
      devices: Object.fromEntries(Object.values(devicesByName).map((dev) => [dev.id, dev])),
      links,
      activity: activity(lab),
    };
  }

  function r(name, x, y, ifaces = {}, extra = {}) { return { kind: "router", name, x, y, ifaces, extra }; }
  function sw(name, x, y, ifaces = {}, extra = {}) { return { kind: "l2switch", name, x, y, ifaces, extra }; }
  function pc(name, x, y, ip = "", gw = "") { return { kind: "pc", name, x, y, ifaces: { eth0: { ip, mask: ip ? "255.255.255.0" : "", gw } } }; }
  function server(name, x, y, ip = "") { return { kind: "server", name, x, y, ifaces: { eth0: { ip, mask: ip ? "255.255.255.0" : "", gw: "" } } }; }

  function generatedLab(seed) {
    return {
      quizBank: seed.quizBank || "openpt/core",
      estimatedMinutes: seed.estimatedMinutes || 12,
      difficulty: seed.difficulty || "intermediate",
      skills: seed.skills || [],
      summary: seed.summary || seed.title,
      generated: true,
      ...seed,
      instructionsHtml: seed.instructionsHtml || instructions(seed.summary || seed.title, seed.tasks || [], seed.notes || []),
      hints: seed.hints || [
        "Use the exact device names shown in the topology.",
        "Configure only the devices named in the task list; the autograder checks running configuration and interface state.",
      ],
    };
  }

  function generatedVlanLabs() {
    const defs = [
      ["campus-vlan-access-trunks", "Campus Access VLANs and Trunk", "ASW1", "DSW1", "10,20,30", [["10", "Students", "FastEthernet0/3-4"], ["20", "Faculty", "FastEthernet0/5-6"], ["30", "Guests", "FastEthernet0/7"]]],
      ["voice-data-access-edge", "Voice and Data Access Edge", "ASW2", "DSW1", "40,50,150", [["40", "DATA", "FastEthernet0/3-5"], ["50", "VOICE-USERS", "FastEthernet0/6"], ["150", "MGMT", "FastEthernet0/7"]]],
      ["warehouse-vlan-cutover", "Warehouse VLAN Cutover", "WH-SW1", "CORE1", "12,22,32", [["12", "Scanners", "FastEthernet0/3-4"], ["22", "Printers", "FastEthernet0/5"], ["32", "Cameras", "FastEthernet0/6-7"]]],
      ["branch-vlan-trunk-restrict", "Branch Trunk VLAN Restriction", "BR-SW1", "BR-SW2", "60,70,80", [["60", "Sales", "FastEthernet0/3"], ["70", "Support", "FastEthernet0/4-5"], ["80", "IoT", "FastEthernet0/6"]]],
      ["native-vlan-hardening", "Native VLAN Hardening", "SW-A", "SW-B", "110,120,999", [["110", "Users", "FastEthernet0/3-4"], ["120", "Servers", "FastEthernet0/5"], ["999", "Blackhole", "FastEthernet0/6"]], 999],
      ["access-layer-migration", "Access Layer Migration", "EDGE1", "DIST1", "210,220,230", [["210", "Blue", "FastEthernet0/8-9"], ["220", "Green", "FastEthernet0/10"], ["230", "Orange", "FastEthernet0/11-12"]]],
    ];
    return defs.map((def, index) => {
      const [slug, title, left, right, allowed, vlanDefs, nativeVlan] = def;
      const ifaces = { "FastEthernet0/1": {}, "FastEthernet0/2": {} };
      for (const [, , ports] of vlanDefs) for (const port of expandRange(ports)) ifaces[port] = {};
      const commands = [];
      for (const [id, name, ports] of vlanDefs) commands.push("vlan " + id, "name " + name, "interface range " + ports, "switchport mode access", "switchport access vlan " + id);
      commands.push("interface FastEthernet0/1", "switchport trunk encapsulation dot1q", "switchport mode trunk", "switchport trunk allowed vlan " + allowed);
      if (nativeVlan) commands.push("switchport trunk native vlan " + nativeVlan);
      return generatedLab({
        id: "openpt-vlan-" + slug,
        questionSlide: 100 + index,
        title,
        category: "Switching",
        skills: ["VLANs", "trunks", "access ports"],
        devices: [
          sw(left, 280, 220, ifaces),
          sw(right, 670, 220, { "FastEthernet0/1": { mode: "trunk", allowedVlans: allowed, nativeVlan: nativeVlan || 1 } }),
          pc("Host-" + vlanDefs[0][1], 160, 430, "192.168." + vlanDefs[0][0] + ".10"),
          pc("Host-" + vlanDefs[1][1], 400, 430, "192.168." + vlanDefs[1][0] + ".10"),
        ],
        links: [[left, "FastEthernet0/1", right, "FastEthernet0/1"], [left, expandRange(vlanDefs[0][2])[0], "Host-" + vlanDefs[0][1], "eth0"], [left, expandRange(vlanDefs[1][2])[0], "Host-" + vlanDefs[1][1], "eth0"]],
        summary: "Create named VLANs, place access ports, and restrict the uplink trunk to the required VLAN list.",
        tasks: [
          "Create the VLANs and names shown in the lab title panel.",
          "Configure the listed access ports for the correct VLANs.",
          "Configure Fa0/1 as an 802.1Q trunk and allow only VLANs " + allowed + ".",
          nativeVlan ? "Move the trunk native VLAN to VLAN " + nativeVlan + "." : "Leave the native VLAN unchanged.",
        ],
        hints: ["Build VLANs before assigning access ports.", "The autograder checks the trunk allowed VLAN list exactly."],
        answerCommands: { [left]: commands },
      });
    });
  }

  function generatedRouterStickLabs() {
    const defs = [
      ["router-stick-school", "Router-on-a-Stick School LAN", "R-EDGE1", "SW-STUDENT", [["10", "192.168.10.1"], ["20", "192.168.20.1"], ["30", "192.168.30.1"]]],
      ["router-stick-clinic", "Clinic Inter-VLAN Gateway", "R-CLINIC", "SW-CLINIC", [["31", "10.31.0.1"], ["32", "10.32.0.1"], ["33", "10.33.0.1"]]],
      ["router-stick-branch", "Branch Router-on-a-Stick", "BR-R1", "BR-SW1", [["41", "172.16.41.1"], ["42", "172.16.42.1"], ["43", "172.16.43.1"]]],
      ["router-stick-lab", "Training Lab Subinterfaces", "LAB-R1", "LAB-SW1", [["51", "192.0.2.1"], ["52", "192.0.52.1"], ["53", "192.0.53.1"]]],
      ["router-stick-retail", "Retail Floor VLAN Gateways", "RTR-STORE", "SW-STORE", [["61", "10.61.0.1"], ["62", "10.62.0.1"], ["63", "10.63.0.1"]]],
      ["router-stick-dmz", "Small Office DMZ Router-on-a-Stick", "SOHO-R1", "SOHO-SW1", [["71", "172.20.71.1"], ["72", "172.20.72.1"], ["73", "172.20.73.1"]]],
    ];
    return defs.map((def, index) => {
      const [slug, title, router, switchName, vlans] = def;
      const routerIfaces = { "GigabitEthernet0/0/0": {} };
      const switchIfaces = { "FastEthernet0/1": {} };
      const rCommands = ["interface GigabitEthernet0/0/0", "no shutdown"];
      const sCommands = [];
      vlans.forEach(([vlan, gateway], i) => {
        routerIfaces["GigabitEthernet0/0/0." + vlan] = {};
        switchIfaces["FastEthernet0/" + (i + 2)] = {};
        rCommands.push("interface GigabitEthernet0/0/0." + vlan, "encapsulation dot1q " + vlan, "ip address " + gateway + " 255.255.255.0", "no shutdown");
        sCommands.push("vlan " + vlan, "name VLAN" + vlan, "interface FastEthernet0/" + (i + 2), "switchport mode access", "switchport access vlan " + vlan);
      });
      sCommands.push("interface FastEthernet0/1", "switchport trunk encapsulation dot1q", "switchport mode trunk", "switchport trunk allowed vlan " + vlans.map(([vlan]) => vlan).join(","));
      return generatedLab({
        id: "openpt-ros-" + slug,
        questionSlide: 120 + index,
        title,
        category: "Routing",
        skills: ["router-on-a-stick", "subinterfaces", "VLAN gateways"],
        devices: [
          r(router, 300, 210, routerIfaces),
          sw(switchName, 650, 210, switchIfaces),
          pc("VLAN" + vlans[0][0] + "-PC", 540, 420, vlans[0][1].replace(/\.1$/, ".10"), vlans[0][1]),
          pc("VLAN" + vlans[1][0] + "-PC", 750, 420, vlans[1][1].replace(/\.1$/, ".10"), vlans[1][1]),
        ],
        links: [[router, "GigabitEthernet0/0/0", switchName, "FastEthernet0/1"], [switchName, "FastEthernet0/2", "VLAN" + vlans[0][0] + "-PC", "eth0"], [switchName, "FastEthernet0/3", "VLAN" + vlans[1][0] + "-PC", "eth0"]],
        summary: "Build VLAN gateways on router subinterfaces and trunk the access switch uplink.",
        tasks: [
          "Enable the router physical interface.",
          "Create one dot1Q subinterface for each listed VLAN.",
          "Address each subinterface with the listed default gateway.",
          "Configure the switch uplink as a trunk and place access ports in the matching VLANs.",
        ],
        hints: ["The subinterface number matches the VLAN ID.", "Use encapsulation dot1q before assigning the subinterface IP address."],
        answerCommands: { [router]: rCommands, [switchName]: sCommands },
      });
    });
  }

  function generatedStaticRouteLabs() {
    const defs = [
      ["static-triangle", "Three-Router Static Route Triangle", "10.10", "172.16.10"],
      ["default-branch", "Branch Default Route and Return Paths", "10.20", "172.16.20"],
      ["floating-backup", "Floating Backup Static Routes", "10.30", "172.16.30"],
      ["hub-spoke-routes", "Hub and Spoke Static Routing", "10.40", "172.16.40"],
      ["dmz-return-routes", "DMZ Return Static Routes", "10.50", "172.16.50"],
      ["wan-summary", "WAN Summary Static Routes", "10.60", "172.16.60"],
    ];
    return defs.map((def, index) => {
      const [slug, title, transit, lan] = def;
      const leftLan = lan + ".0";
      const rightPrefix = lan.replace("172.16.", "172.17.");
      const rightLan = rightPrefix + ".0";
      return generatedLab({
        id: "openpt-route-" + slug,
        questionSlide: 140 + index,
        title,
        category: "Routing",
        skills: ["static routes", "default routes", "return paths"],
        devices: [
          r("R1", 170, 240, { "GigabitEthernet0/0/0": { ip: lan + ".1", mask: "255.255.255.0" }, "Serial0/1/0": { ip: transit + ".0.1", mask: "255.255.255.252" } }),
          r("R2", 460, 240, { "Serial0/1/0": { ip: transit + ".0.2", mask: "255.255.255.252" }, "Serial0/1/1": { ip: transit + ".0.5", mask: "255.255.255.252" } }),
          r("R3", 750, 240, { "Serial0/1/0": { ip: transit + ".0.6", mask: "255.255.255.252" }, "GigabitEthernet0/0/0": { ip: rightPrefix + ".1", mask: "255.255.255.0" } }),
          pc("PC-A", 90, 430, lan + ".10", lan + ".1"),
          pc("PC-C", 830, 430, rightPrefix + ".10", rightPrefix + ".1"),
        ],
        links: [["PC-A", "eth0", "R1", "GigabitEthernet0/0/0"], ["R1", "Serial0/1/0", "R2", "Serial0/1/0", "serial"], ["R2", "Serial0/1/1", "R3", "Serial0/1/0", "serial"], ["R3", "GigabitEthernet0/0/0", "PC-C", "eth0"]],
        summary: "Complete static routing so the edge LANs can reach each other across the WAN.",
        tasks: [
          "Add R1 and R3 routes toward the remote LAN.",
          "Add R2 return routes toward both edge LANs.",
          "Use the next-hop addresses on the serial transit links.",
        ],
        hints: ["R2 needs both LAN routes because it is the transit router.", "The LAN masks are /24 and the serial masks are /30."],
        answerCommands: {
          R1: ["ip route " + rightLan + " 255.255.255.0 " + transit + ".0.2"],
          R2: ["ip route " + leftLan + " 255.255.255.0 " + transit + ".0.1", "ip route " + rightLan + " 255.255.255.0 " + transit + ".0.6"],
          R3: ["ip route " + leftLan + " 255.255.255.0 " + transit + ".0.5"],
        },
      });
    });
  }

  function generatedDynamicRoutingLabs() {
    const defs = [
      ["ospf-area0-baseline", "OSPF Area 0 Baseline", "ospf", "1", [["10.1.0.0", "0.0.0.3", "0"], ["192.168.1.0", "0.0.0.255", "0"]]],
      ["ospf-passive-edge", "OSPF Passive LAN Edge", "ospf", "10", [["10.2.0.0", "0.0.0.3", "0"], ["192.168.2.0", "0.0.0.255", "0"]], "GigabitEthernet0/0/1"],
      ["ospf-default-originate", "OSPF Default Origination", "ospf", "20", [["10.3.0.0", "0.0.0.3", "0"], ["192.168.3.0", "0.0.0.255", "0"]], null, true],
      ["rip-v2-no-auto", "RIP Version 2 Advertisement", "rip", "rip", [["10.4.0.0"], ["192.168.4.0"]]],
      ["eigrp-dual-lans", "EIGRP Dual LAN Advertisement", "eigrp", "100", [["10.5.0.0", "0.0.0.3"], ["192.168.5.0", "0.0.0.255"]]],
      ["bgp-edge-neighbor", "Single-Homed BGP Edge", "bgp", "65010", [["203.0.113.0", "255.255.255.252"], ["198.51.100.0", "255.255.255.0"]]],
    ];
    return defs.map((def, index) => {
      const [slug, title, proto, pid, networks, passiveIface, originate] = def;
      const commands = proto === "rip" ? ["router rip", "version 2", ...networks.map(([net]) => "network " + net)] :
        proto === "bgp" ? ["router bgp " + pid, "neighbor 203.0.113.2 remote-as 65020", "network " + networks[1][0] + " mask " + networks[1][1]] :
        ["router " + proto + " " + pid, "router-id " + (index + 1) + "." + (index + 1) + "." + (index + 1) + "." + (index + 1), ...networks.map((n) => "network " + n[0] + " " + n[1] + (proto === "ospf" ? " area " + n[2] : "")), ...(passiveIface ? ["passive-interface " + passiveIface] : []), ...(originate ? ["default-information originate"] : [])];
      return generatedLab({
        id: "openpt-dyn-" + slug,
        questionSlide: 160 + index,
        title,
        category: "Routing Protocols",
        skills: [proto.toUpperCase(), "routing process", "network statements"],
        devices: [
          r("EDGE1", 250, 230, { "GigabitEthernet0/0/0": { ip: networks[0][0].replace(/\.0$/, ".1"), mask: "255.255.255.252" }, "GigabitEthernet0/0/1": { ip: networks[1][0].replace(/\.0$/, ".1"), mask: "255.255.255.0" } }),
          r("EDGE2", 610, 230, { "GigabitEthernet0/0/0": { ip: networks[0][0].replace(/\.0$/, ".2"), mask: "255.255.255.252" }, "GigabitEthernet0/0/1": { ip: networks[1][0].replace(/\.0$/, ".2"), mask: "255.255.255.0" } }),
          pc("LAN-PC", 250, 430, networks[1][0].replace(/\.0$/, ".10"), networks[1][0].replace(/\.0$/, ".1")),
        ],
        links: [["EDGE1", "GigabitEthernet0/0/0", "EDGE2", "GigabitEthernet0/0/0"], ["EDGE1", "GigabitEthernet0/0/1", "LAN-PC", "eth0"]],
        summary: "Configure the requested dynamic routing process and advertise the exact connected networks.",
        tasks: ["Create the routing process.", "Set the router ID when requested.", "Advertise the WAN and LAN networks.", originate ? "Originate a default route into the process." : "Keep the scope limited to the listed networks."],
        hints: ["Use wildcard masks for OSPF and EIGRP network statements.", "The autograder checks the exact routing process commands."],
        answerCommands: { EDGE1: commands },
      });
    });
  }

  function generatedDhcpDnsLabs() {
    const defs = [
      ["dhcp-basic-office", "Office DHCP Pool", "R-DHCP1", "192.168.81.0", "192.168.81.1", "pool81"],
      ["dhcp-voice-option", "Voice VLAN DHCP Pool", "R-DHCP2", "192.168.82.0", "192.168.82.1", "voice82"],
      ["dhcp-relay-campus", "Campus DHCP Relay", "R-ACCESS", "192.168.83.0", "192.168.83.1", "campus83", "10.83.0.2"],
      ["dhcp-guest-scope", "Guest DHCP Scope", "R-GUEST", "192.168.84.0", "192.168.84.1", "guest84"],
      ["dns-host-records", "DNS Host Records", "R-DNS", "198.51.100.0", "198.51.100.1", "webpool", null, true],
      ["dhcp-exclusions", "DHCP Exclusion Cleanup", "R-POOL", "192.168.86.0", "192.168.86.1", "pool86"],
    ];
    return defs.map((def, index) => {
      const [slug, title, router, network, gateway, pool, helper, dnsOnly] = def;
      const commands = dnsOnly
        ? ["ip host www.openpt.local " + network.replace(/\.0$/, ".10"), "ip host api.openpt.local " + network.replace(/\.0$/, ".11")]
        : ["ip dhcp excluded-address " + gateway + " " + network.replace(/\.0$/, ".20"), "ip dhcp pool " + pool, "network " + network + " 255.255.255.0", "default-router " + gateway, "dns-server " + network.replace(/\.0$/, ".53"), "domain-name openpt.local", ...(helper ? [] : ["netbios-name-server " + network.replace(/\.0$/, ".54")])];
      const relayCommands = helper ? ["interface GigabitEthernet0/0/0", "ip helper-address " + helper] : [];
      return generatedLab({
        id: "openpt-dhcp-" + slug,
        questionSlide: 180 + index,
        title,
        category: "Services",
        skills: dnsOnly ? ["DNS host records"] : ["DHCP", "address pools", helper ? "relay" : "scope options"],
        devices: [r(router, 320, 230, { "GigabitEthernet0/0/0": { ip: gateway, mask: "255.255.255.0" } }), server("Services", 650, 230, helper || network.replace(/\.0$/, ".53")), pc("Client", 320, 430)],
        links: [[router, "GigabitEthernet0/0/0", "Client", "eth0"], [router, "GigabitEthernet0/0/1", "Services", "eth0"]],
        summary: dnsOnly ? "Create local DNS host records for the web services." : "Configure a DHCP scope with exclusions and client options.",
        tasks: dnsOnly ? ["Create A-record style host mappings for www.openpt.local and api.openpt.local."] : ["Exclude reserved addresses.", "Create the named DHCP pool.", "Set network, gateway, DNS, domain, and optional NetBIOS values.", helper ? "Configure the client-facing interface as a DHCP relay." : "Leave relay configuration unchanged."],
        hints: ["DHCP pool subcommands are graded as running configuration.", helper ? "The helper address belongs on the client-facing interface." : "Excluded addresses are global DHCP commands."],
        answerCommands: { [router]: [...commands, ...relayCommands] },
      });
    });
  }

  function generatedAclNatLabs() {
    const defs = [
      ["pat-lan-overload", "PAT Overload for LAN Users", "192.168.91.0", "203.0.91"],
      ["static-nat-web", "Static NAT for Web Server", "192.168.92.0", "203.0.92"],
      ["nat-pool-overload", "NAT Pool Overload", "192.168.93.0", "203.0.93"],
      ["web-acl-filter", "Extended Web ACL Filter", "192.168.94.0", "198.51.94"],
      ["ssh-only-acl", "SSH-Only Management ACL", "192.168.95.0", "198.51.95"],
      ["dmz-acl-nat", "DMZ ACL and PAT Edge", "192.168.96.0", "203.0.96"],
    ];
    return defs.map((def, index) => {
      const [slug, title, insideNet, outsideBase] = def;
      const insideGw = insideNet.replace(/\.0$/, ".1");
      const publicIp = outsideBase + ".2";
      const commands = [
        "interface GigabitEthernet0/0/0", "ip nat inside",
        "interface GigabitEthernet0/0/1", "ip nat outside",
        "access-list 10 permit " + insideNet + " 0.0.0.255",
        index % 3 === 1 ? "ip nat inside source static " + insideNet.replace(/\.0$/, ".10") + " " + outsideBase + ".10" :
          index % 3 === 2 ? "ip nat pool PUBLIC " + outsideBase + ".20 " + outsideBase + ".30 netmask 255.255.255.0" : "ip nat inside source list 10 interface GigabitEthernet0/0/1 overload",
      ];
      if (index % 3 === 2) commands.push("ip nat inside source list 10 pool PUBLIC overload");
      if (index >= 3) commands.push("ip access-list extended WEB-FILTER", "10 permit tcp " + insideNet + " 0.0.0.255 any eq www", "20 permit tcp " + insideNet + " 0.0.0.255 any eq 443", "30 deny ip any any", "interface GigabitEthernet0/0/1", "ip access-group WEB-FILTER out");
      return generatedLab({
        id: "openpt-edge-" + slug,
        questionSlide: 200 + index,
        title,
        category: "Security",
        skills: ["ACLs", "NAT", "edge policy"],
        devices: [r("EDGE-R1", 360, 240, { "GigabitEthernet0/0/0": { ip: insideGw, mask: "255.255.255.0" }, "GigabitEthernet0/0/1": { ip: publicIp, mask: "255.255.255.0" } }), pc("Inside-PC", 120, 420, insideNet.replace(/\.0$/, ".20"), insideGw), server("Internet-Web", 720, 420, outsideBase + ".80")],
        links: [["Inside-PC", "eth0", "EDGE-R1", "GigabitEthernet0/0/0"], ["EDGE-R1", "GigabitEthernet0/0/1", "Internet-Web", "eth0"]],
        summary: "Configure inside/outside NAT roles, translation rules, and an edge ACL where requested.",
        tasks: ["Mark the LAN interface as NAT inside and the WAN interface as NAT outside.", "Permit the inside LAN with ACL 10.", "Configure the specified NAT translation.", index >= 3 ? "Apply the extended ACL outbound on the WAN interface." : "Do not add an extended edge filter."],
        hints: ["NAT role commands are interface commands.", "Named extended ACL sequence numbers are accepted by OpenPT."],
        answerCommands: { "EDGE-R1": commands },
      });
    });
  }

  function generatedSwitchSecurityLabs() {
    const defs = [
      ["port-security-basic", "Access Port Security Baseline", "SW-SEC1", "10"],
      ["port-security-restrict", "Port Security Restrict Mode", "SW-SEC2", "20"],
      ["stp-root-hardening", "STP Root Hardening", "SW-ROOT", "30"],
      ["bpduguard-edge", "BPDU Guard on Edge Ports", "SW-BPDU", "40"],
      ["dhcp-snooping-dai", "DHCP Snooping and DAI", "SW-SNOOP", "50"],
      ["storm-portfast", "PortFast and Root Guard", "SW-GUARD", "60"],
    ];
    return defs.map((def, index) => {
      const [slug, title, switchName, vlan] = def;
      const commands = ["vlan " + vlan, "name USERS", "interface range FastEthernet0/3-4", "switchport mode access", "switchport access vlan " + vlan, "switchport port-security", "switchport port-security maximum " + (index + 2), "switchport port-security violation " + (index % 2 ? "restrict" : "shutdown")];
      if (index >= 2) commands.push("spanning-tree vlan " + vlan + " root primary");
      if (index >= 3) commands.push("interface range FastEthernet0/3-4", "spanning-tree portfast", "spanning-tree bpduguard enable");
      if (index >= 4) commands.push("ip dhcp snooping", "ip dhcp snooping vlan " + vlan, "ip arp inspection vlan " + vlan, "interface FastEthernet0/1", "ip dhcp snooping trust", "ip arp inspection trust");
      if (index === 5) commands.push("interface FastEthernet0/1", "spanning-tree guard root");
      return generatedLab({
        id: "openpt-switchsec-" + slug,
        questionSlide: 220 + index,
        title,
        category: "Switch Security",
        skills: ["port security", "STP hardening", "DHCP snooping"],
        devices: [sw(switchName, 360, 240, { "FastEthernet0/1": {}, "FastEthernet0/3": {}, "FastEthernet0/4": {} }), sw("DIST", 680, 240, { "FastEthernet0/1": { mode: "trunk" } }), pc("User-A", 270, 430), pc("User-B", 450, 430)],
        links: [[switchName, "FastEthernet0/1", "DIST", "FastEthernet0/1"], [switchName, "FastEthernet0/3", "User-A", "eth0"], [switchName, "FastEthernet0/4", "User-B", "eth0"]],
        summary: "Harden access ports and enable layer-2 protections appropriate for the scenario.",
        tasks: ["Create the user VLAN.", "Secure access ports Fa0/3-4.", index >= 2 ? "Make this switch the spanning-tree root for the user VLAN." : "Leave STP root settings unchanged.", index >= 4 ? "Enable DHCP snooping and dynamic ARP inspection for the user VLAN." : "Do not enable DHCP snooping unless listed."],
        hints: ["Port security maximum and violation mode are checked separately.", "Trust only the uplink for DHCP snooping and DAI."],
        answerCommands: { [switchName]: commands },
      });
    });
  }

  function generatedManagementLabs() {
    const defs = [
      ["ssh-baseline", "SSH Management Baseline", "R-MGMT1", "openpt.local"],
      ["secure-lines", "Secure Console and VTY Lines", "SW-MGMT2", "branch.local"],
      ["snmp-ntp-logging", "SNMP NTP and Syslog", "R-MGMT3", "ops.local"],
      ["aaa-login", "AAA Login Skeleton", "SW-MGMT4", "aaa.local"],
      ["domain-hosts", "Local Host Table and SSH", "R-MGMT5", "dns.local"],
      ["hardening-combo", "Device Hardening Combo", "SW-MGMT6", "secure.local"],
    ];
    return defs.map((def, index) => {
      const [slug, title, device, domain] = def;
      const kind = device.includes("SW") ? "l2switch" : "router";
      const commands = ["hostname " + device, "enable secret cisco123", "service password-encryption", "ip domain-name " + domain, "username admin secret netacad", "crypto key generate rsa modulus 2048", "ip ssh version 2", "line console 0", "exec-timeout " + (index + 3) + " 0", "logging synchronous", "line vty 0 4", "transport input ssh", "exec-timeout 10 0"];
      if (index >= 2) commands.push("ntp server 192.0.2.123", "logging host 192.0.2.200", "snmp-server community OPENPT RO");
      if (index >= 3) commands.push("aaa new-model", "aaa authentication login default local");
      if (index >= 4) commands.push("ip host files.openpt.local 192.0.2.50", "ip host monitor.openpt.local 192.0.2.60");
      return generatedLab({
        id: "openpt-mgmt-" + slug,
        questionSlide: 240 + index,
        title,
        category: "Management",
        skills: ["SSH", "line security", "management services"],
        devices: [kind === "router" ? r(device, 360, 240, { "GigabitEthernet0/0/0": { ip: "192.0.2." + (index + 1), mask: "255.255.255.0" } }) : sw(device, 360, 240, { Vlan1: { ip: "192.0.2." + (index + 1), mask: "255.255.255.0" } }), pc("Admin-PC", 650, 240, "192.0.2.100", "192.0.2.1")],
        links: [[device, kind === "router" ? "GigabitEthernet0/0/0" : "FastEthernet0/1", "Admin-PC", "eth0"]],
        summary: "Configure secure management access and supporting management services.",
        tasks: ["Set identity, encrypted enable secret, and local admin user.", "Enable SSH version 2 with RSA keys and a domain name.", "Restrict VTY access to SSH.", index >= 2 ? "Add NTP, syslog, and SNMP monitoring." : "No monitoring service is required."],
        hints: ["Use line console 0 and line vty 0 4 for timers and transports.", "OpenPT grades the resulting running configuration."],
        answerCommands: { [device]: commands },
      });
    });
  }

  function generatedCoreLabs() {
    return [
      ...generatedVlanLabs(),
      ...generatedRouterStickLabs(),
      ...generatedStaticRouteLabs(),
      ...generatedDynamicRoutingLabs(),
      ...generatedDhcpDnsLabs(),
      ...generatedAclNatLabs(),
      ...generatedSwitchSecurityLabs(),
      ...generatedManagementLabs(),
    ];
  }

  const LABS = [
    {
      id: "ccna-b-q1-48-etherchannel-vlan",
      quizBank: "ccna-b/quiz-01",
      questionSlide: 48,
      title: "VLAN Access Ports and LACP EtherChannel",
      estimatedMinutes: 8,
      devices: [
        sw("SwitchA", 250, 170, { "FastEthernet0/1": {}, "FastEthernet0/2": {}, "FastEthernet0/3": {}, "FastEthernet0/4": {}, "FastEthernet0/8": {}, "FastEthernet0/9": {}, "Port-channel1": { mode: "trunk" } }),
        sw("SwitchB", 650, 170, { "FastEthernet0/1": { mode: "trunk" }, "FastEthernet0/2": { mode: "trunk" }, "FastEthernet0/3": { vlan: 10 }, "FastEthernet0/8": { vlan: 20 } }, { vlans: { 10: "VLAN10", 20: "VLAN20" } }),
        pc("PC1", 120, 420, "192.168.10.11"), pc("PC2", 320, 420, "192.168.20.11"), pc("PC3", 560, 420, "192.168.10.12"), pc("PC4", 760, 420, "192.168.20.12"),
      ],
      links: [["SwitchA", "FastEthernet0/1", "SwitchB", "FastEthernet0/1"], ["SwitchA", "FastEthernet0/2", "SwitchB", "FastEthernet0/2"], ["SwitchA", "FastEthernet0/3", "PC1", "eth0"], ["SwitchA", "FastEthernet0/8", "PC2", "eth0"], ["SwitchB", "FastEthernet0/3", "PC3", "eth0"], ["SwitchB", "FastEthernet0/8", "PC4", "eth0"]],
      instructionsHtml: instructions("Configure SwitchA.", ["Place Fa0/3-4 in VLAN 10 and Fa0/8-9 in VLAN 20.", "Bundle Fa0/1-2 into channel-group 1 using LACP active mode.", "Configure Port-channel1 as an 802.1Q trunk."]),
      hints: ["Use channel-group 1 mode active for LACP.", "Configure the port-channel as the trunk."],
      answerCommands: { SwitchA: ["interface range FastEthernet0/3-4", "switchport mode access", "switchport access vlan 10", "interface range FastEthernet0/8-9", "switchport mode access", "switchport access vlan 20", "interface range FastEthernet0/1-2", "channel-protocol lacp", "channel-group 1 mode active", "interface Port-channel1", "switchport trunk encapsulation dot1q", "switchport mode trunk"] },
    },
    {
      id: "ccna-b-q1-49-dhcp-routerb",
      quizBank: "ccna-b/quiz-01",
      questionSlide: 49,
      title: "RouterB DHCP Server",
      estimatedMinutes: 6,
      devices: [r("RouterB", 360, 180, { "FastEthernet0/0": { ip: "192.168.11.1", mask: "255.255.255.0" } }), pc("HostB", 360, 420)],
      links: [["RouterB", "FastEthernet0/0", "HostB", "eth0", "cross"]],
      instructionsHtml: instructions("Configure RouterB DHCP for its connected hosts.", ["Reserve 192.168.11.1 through 192.168.11.10.", "Create pool1 for 192.168.11.0/24.", "Set gateway, DNS, domain, and NetBIOS options."]),
      hints: ["The gateway is RouterB Fa0/0: 192.168.11.1.", "Use domain-name boson.com."],
      answerCommands: { RouterB: ["ip dhcp excluded-address 192.168.11.1 192.168.11.10", "ip dhcp pool pool1", "network 192.168.11.0 255.255.255.0", "default-router 192.168.11.1", "dns-server 192.168.11.3", "domain-name boson.com", "netbios-name-server 192.168.11.4"] },
    },
    {
      id: "ccna-b-q1-50-ospf-dr",
      quizBank: "ccna-b/quiz-01",
      questionSlide: 50,
      title: "Single-Area OSPF DR Election",
      estimatedMinutes: 8,
      devices: [
        r("RouterA", 460, 130, { "FastEthernet0/0": { ip: "10.10.10.1", mask: "255.255.255.248" }, "FastEthernet0/1": { ip: "192.168.1.1", mask: "255.255.255.0" } }),
        r("RouterB", 220, 360, { "FastEthernet0/0": { ip: "10.10.10.2", mask: "255.255.255.248" }, "FastEthernet0/1": { ip: "192.168.2.1", mask: "255.255.255.0" } }),
        r("RouterC", 700, 360, { "FastEthernet0/0": { ip: "10.10.10.3", mask: "255.255.255.248" }, "FastEthernet0/1": { ip: "192.168.3.1", mask: "255.255.255.0" } }),
        sw("SwitchA", 460, 280, { "FastEthernet0/1": {}, "FastEthernet0/2": {}, "FastEthernet0/3": {} }),
      ],
      links: [["RouterA", "FastEthernet0/0", "SwitchA", "FastEthernet0/1"], ["RouterB", "FastEthernet0/0", "SwitchA", "FastEthernet0/2"], ["RouterC", "FastEthernet0/0", "SwitchA", "FastEthernet0/3"]],
      instructionsHtml: instructions("Configure OSPF area 0 and DR priorities.", ["Advertise the shared 10.10.10.0/29 network and each router LAN.", "Set RouterA Fa0/0 priority to 255.", "Set RouterC Fa0/0 priority to 0."]),
      hints: ["Use wildcard 0.0.0.7 for the /29 segment.", "Use wildcard 0.0.0.255 for each /24 LAN."],
      answerCommands: { RouterA: ["router ospf 1", "network 10.10.10.0 0.0.0.7 area 0", "network 192.168.1.0 0.0.0.255 area 0", "interface FastEthernet0/0", "ip ospf priority 255"], RouterB: ["router ospf 1", "network 10.10.10.0 0.0.0.7 area 0", "network 192.168.2.0 0.0.0.255 area 0"], RouterC: ["router ospf 1", "network 10.10.10.0 0.0.0.7 area 0", "network 192.168.3.0 0.0.0.255 area 0", "interface FastEthernet0/0", "ip ospf priority 0"] },
    },
    {
      id: "ccna-b-q1-51-ssh-lines",
      quizBank: "ccna-b/quiz-01",
      questionSlide: 51,
      title: "SSH and Line Access Controls",
      estimatedMinutes: 7,
      devices: [sw("CSW1", 300, 220), sw("CSW2", 620, 220)],
      links: [["CSW1", "FastEthernet0/1", "CSW2", "FastEthernet0/1"]],
      instructionsHtml: instructions("Configure console timers, VTY access, and SSH.", ["CSW1 console timeout is 3 minutes.", "CSW2 console timeout is disabled.", "CSW1 VTY accepts SSH only; CSW2 VTY accepts none.", "Enable SSHv2 on CSW1 using domain boson.com."]),
      hints: ["Use line console 0 and line vty 0 4.", "crypto key generate rsa uses the default modulus in OpenPT."],
      answerCommands: { CSW1: ["line console 0", "exec-timeout 3 0", "line vty 0 4", "transport input ssh", "ip domain-name boson.com", "crypto key generate rsa", "ip ssh version 2"], CSW2: ["line console 0", "exec-timeout 0 0", "line vty 0 4", "transport input none"] },
    },
    {
      id: "ccna-b-q2-53-pagp-trunk",
      quizBank: "ccna-b/quiz-02",
      questionSlide: 53,
      title: "PAgP EtherChannel Trunk",
      estimatedMinutes: 6,
      devices: [sw("SwitchA", 300, 220, { "FastEthernet0/1": {}, "FastEthernet0/2": {}, "Port-channel1": { mode: "trunk" } }), sw("SwitchB", 650, 220, { "FastEthernet0/1": {}, "FastEthernet0/2": {} })],
      links: [["SwitchA", "FastEthernet0/1", "SwitchB", "FastEthernet0/1"], ["SwitchA", "FastEthernet0/2", "SwitchB", "FastEthernet0/2"]],
      instructionsHtml: instructions("Configure SwitchA EtherChannel.", ["Use Cisco-proprietary PAgP negotiation.", "Use channel-group 1 mode desirable.", "Configure Port-channel1 for 802.1Q trunking and disable DTP."]),
      hints: ["Cisco-proprietary EtherChannel negotiation is PAgP.", "switchport nonegotiate disables DTP."],
      answerCommands: { SwitchA: ["interface range FastEthernet0/1-2", "channel-protocol pagp", "channel-group 1 mode desirable", "interface Port-channel1", "switchport trunk encapsulation dot1q", "switchport mode trunk", "switchport nonegotiate"] },
    },
    {
      id: "ccna-b-q2-54-nat-pat",
      quizBank: "ccna-b/quiz-02",
      questionSlide: 54,
      title: "Static NAT and PAT",
      estimatedMinutes: 7,
      devices: [r("Router1", 430, 260, { "Serial0/0": { ip: "203.0.113.2", mask: "255.255.255.252" }, "FastEthernet0/0": { ip: "198.51.100.1", mask: "255.255.255.0" }, "FastEthernet0/1": { ip: "192.168.51.1", mask: "255.255.255.0" } }), server("Intranet", 720, 120, "198.51.100.10"), pc("LAN-PC", 720, 430, "192.168.51.20", "192.168.51.1")],
      links: [["Router1", "FastEthernet0/0", "Intranet", "eth0"], ["Router1", "FastEthernet0/1", "LAN-PC", "eth0"]],
      instructionsHtml: instructions("Configure static NAT for the DMZ host and PAT for the LAN.", ["Mark Serial0/0 outside.", "Mark Fa0/0 and Fa0/1 inside.", "Map 198.51.100.10 to 203.0.113.4.", "Use ACL 10 and Serial0/0 overload for the LAN."]),
      hints: ["ACL 10 should match 192.168.51.0/24.", "Use ip nat inside source list 10 interface serial 0/0 overload."],
      answerCommands: { Router1: ["interface Serial0/0", "ip nat outside", "interface FastEthernet0/0", "ip nat inside", "interface FastEthernet0/1", "ip nat inside", "ip nat inside source static 198.51.100.10 203.0.113.4", "access-list 10 permit 192.168.51.0 0.0.0.255", "ip nat inside source list 10 interface Serial0/0 overload"] },
    },
    {
      id: "ccna-b-q2-55-dns-webftp-acl",
      quizBank: "ccna-b/quiz-02",
      questionSlide: 55,
      title: "DNS and webftp ACL Repair",
      estimatedMinutes: 8,
      devices: [
        r("Router1", 280, 220, { "Serial0/0": { ip: "203.0.113.1", mask: "255.255.255.252" }, "FastEthernet0/0": { ip: "198.51.100.1", mask: "255.255.255.0" } }),
        { ...r("Router2", 620, 220, { "Serial0/0": { ip: "203.0.113.2", mask: "255.255.255.252" }, "FastEthernet0/0": { ip: "192.0.2.1", mask: "255.255.255.0" } }), acls: { webftp: { type: "extended", entries: [{ seq: 20, action: "permit", spec: "tcp 192.0.2.0 0.0.0.63 host 198.51.100.10 eq www" }, { seq: 30, action: "permit", spec: "tcp 192.0.2.0 0.0.1.255 host 198.51.100.11 eq ftp" }] } } },
        server("www", 120, 410, "198.51.100.10"), server("ftp", 330, 410, "198.51.100.11"), pc("Sales", 760, 410, "192.0.2.70", "192.0.2.1"),
      ],
      links: [["Router1", "Serial0/0", "Router2", "Serial0/0", "serial"], ["Router1", "FastEthernet0/0", "www", "eth0"], ["Router1", "FastEthernet0/0", "ftp", "eth0"], ["Router2", "FastEthernet0/0", "Sales", "eth0"]],
      instructionsHtml: instructions("Fix DNS records and webftp ACL entries.", ["Add DNS host records for www and www.example.com.", "Allow HTTP to www from 192.0.2.0/24.", "Limit FTP to ftp from 192.0.2.0/26."]),
      hints: ["Edit the named extended ACL webftp on Router2.", "Remove the wrong sequence numbers before adding corrected entries."],
      answerCommands: { Router1: ["ip host www 198.51.100.10", "ip host www.example.com 198.51.100.10"], Router2: ["ip access-list extended webftp", "no 20", "20 permit tcp 192.0.2.0 0.0.0.255 host 198.51.100.10 eq www", "no 30", "30 permit tcp 192.0.2.0 0.0.0.63 host 198.51.100.11 eq ftp"] },
    },
    {
      id: "ccna-b-q2-56-vlan-trunks",
      quizBank: "ccna-b/quiz-02",
      questionSlide: 56,
      title: "VLAN Names, Access Ports, and Trunks",
      estimatedMinutes: 10,
      devices: [sw("SwitchA", 300, 220, { "FastEthernet0/0": { mode: "trunk" }, "FastEthernet0/1": {}, "FastEthernet0/2": {}, "FastEthernet0/3": {}, "FastEthernet0/4": {}, "FastEthernet0/5": {}, "FastEthernet0/6": {} }), sw("SwitchB", 650, 220, { "FastEthernet0/0": { mode: "trunk" }, "FastEthernet0/1": {}, "FastEthernet0/2": {}, "FastEthernet0/3": {}, "FastEthernet0/4": {}, "FastEthernet0/5": {} })],
      links: [["SwitchA", "FastEthernet0/0", "SwitchB", "FastEthernet0/0"]],
      instructionsHtml: instructions("Create VLANs, assign ports, and restrict trunks.", ["Create VLANs 3 Development, 4 Manufacturing, 5 Finance, and 6 HR.", "Assign the listed access ports on both switches.", "Allow VLANs 3-6 and 67 on Fa0/0 trunks."]),
      hints: ["Use switchport trunk allowed vlan 3-6,67 on both trunks."],
      answerCommands: { SwitchA: ["vlan 3", "name Development", "vlan 4", "name Manufacturing", "vlan 5", "name Finance", "vlan 6", "name HR", "interface range FastEthernet0/1-2", "switchport mode access", "switchport access vlan 3", "interface FastEthernet0/5", "switchport mode access", "switchport access vlan 4", "interface range FastEthernet0/3-4", "switchport mode access", "switchport access vlan 5", "interface FastEthernet0/6", "switchport mode access", "switchport access vlan 6", "interface FastEthernet0/0", "switchport mode trunk", "switchport trunk allowed vlan 3-6,67"], SwitchB: ["vlan 3", "name Development", "vlan 4", "name Manufacturing", "vlan 5", "name Finance", "vlan 6", "name HR", "interface FastEthernet0/2", "switchport mode access", "switchport access vlan 3", "interface FastEthernet0/4", "switchport mode access", "switchport access vlan 4", "interface range FastEthernet0/1, FastEthernet0/3", "switchport mode access", "switchport access vlan 5", "interface FastEthernet0/5", "switchport mode access", "switchport access vlan 6", "interface FastEthernet0/0", "switchport mode trunk", "switchport trunk allowed vlan 3-6,67"] },
    },
    {
      id: "ccna-b-q3-47-stp-roots",
      quizBank: "ccna-b/quiz-03",
      questionSlide: 47,
      title: "STP Roots and PortFast",
      estimatedMinutes: 7,
      devices: [sw("ASW1", 180, 170, { "FastEthernet0/5": {} }), sw("ASW2", 180, 400, { "FastEthernet0/5": {} }), sw("DSW1", 470, 170), sw("DSW2", 470, 400), pc("PC1", 70, 170), pc("PC2", 70, 400)],
      links: [["PC1", "eth0", "ASW1", "FastEthernet0/5"], ["PC2", "eth0", "ASW2", "FastEthernet0/5"], ["ASW1", "FastEthernet0/1", "DSW1", "FastEthernet0/1"], ["ASW2", "FastEthernet0/1", "DSW2", "FastEthernet0/1"]],
      instructionsHtml: instructions("Configure PortFast and STP roots.", ["Enable PortFast only on PC-facing access ports.", "Make DSW1 VLAN 5 primary and VLAN 6 secondary.", "Make DSW2 VLAN 6 primary and VLAN 5 secondary."]),
      hints: ["Use spanning-tree vlan <vlan> root primary/secondary."],
      answerCommands: { ASW1: ["interface FastEthernet0/5", "spanning-tree portfast"], ASW2: ["interface FastEthernet0/5", "spanning-tree portfast"], DSW1: ["spanning-tree vlan 5 root primary", "spanning-tree vlan 6 root secondary"], DSW2: ["spanning-tree vlan 6 root primary", "spanning-tree vlan 5 root secondary"] },
    },
    {
      id: "ccna-b-q3-48-ospf-repair",
      quizBank: "ccna-b/quiz-03",
      questionSlide: 48,
      title: "OSPF Multi-Area Repair",
      estimatedMinutes: 9,
      devices: [r("HQ", 320, 180, { "Serial0/0": { ip: "203.0.113.2", mask: "255.255.255.252" }, "FastEthernet0/0": { ip: "10.0.0.1", mask: "255.255.255.252" } }), r("MEM", 620, 300, { "FastEthernet0/0": { ip: "192.0.2.2", mask: "255.255.255.252" }, "Loopback0": { ip: "2.2.2.2", mask: "255.255.255.255" } }), r("BNA", 620, 120, { "FastEthernet0/0": { ip: "192.0.2.1", mask: "255.255.255.252" } })],
      links: [["HQ", "FastEthernet0/0", "BNA", "FastEthernet0/0"], ["BNA", "FastEthernet0/1", "MEM", "FastEthernet0/0"]],
      instructionsHtml: instructions("Repair MEM OSPF and originate the default route from HQ.", ["Set MEM router-id and Loopback0 to 3.3.3.3/32.", "Advertise MEM Loopback0 and 192.0.2.0/30 in Area 1.", "Originate the default route from HQ OSPF process 10."]),
      hints: ["Clear OSPF is not required for OpenPT grading once state is corrected."],
      answerCommands: { MEM: ["router ospf 1", "router-id 3.3.3.3", "interface Loopback0", "ip address 3.3.3.3 255.255.255.255", "router ospf 1", "no network 3.3.3.3 0.0.0.0 area 0", "no network 192.0.2.0 0.0.0.3 area 0", "network 3.3.3.3 0.0.0.0 area 1", "network 192.0.2.0 0.0.0.3 area 1"], HQ: ["router ospf 10", "default-information originate"] },
    },
    {
      id: "ccna-b-q3-49-ipv6-static",
      quizBank: "ccna-b/quiz-03",
      questionSlide: 49,
      title: "IPv6 Static Routing",
      estimatedMinutes: 8,
      devices: [r("RouterA", 200, 260, { "FastEthernet0/0": {}, "FastEthernet0/1": {} }), r("RouterB", 500, 260, { "FastEthernet0/0": {}, "FastEthernet0/1": {} }), r("RouterC", 800, 260, { "FastEthernet0/0": {}, "FastEthernet0/1": {} })],
      links: [["RouterA", "FastEthernet0/0", "RouterB", "FastEthernet0/0"], ["RouterB", "FastEthernet0/1", "RouterC", "FastEthernet0/0"]],
      instructionsHtml: instructions("Enable IPv6 routing, address interfaces, and add static routes.", ["Use 2001:db8:a::/64 on RouterA LAN.", "Use two /126 transit links through RouterB.", "Use 2001:db8:c::/64 on RouterC LAN.", "Point RouterA and RouterC defaults at RouterB and add RouterB routes back."]),
      hints: ["Use ipv6 unicast-routing on all routers."],
      answerCommands: { RouterA: ["ipv6 unicast-routing", "interface FastEthernet0/1", "ipv6 address 2001:db8:a::1/64", "no shutdown", "interface FastEthernet0/0", "ipv6 address 2001:db8:b::2/126", "no shutdown", "ipv6 route ::/0 2001:db8:b::1"], RouterB: ["ipv6 unicast-routing", "interface FastEthernet0/0", "ipv6 address 2001:db8:b::1/126", "no shutdown", "interface FastEthernet0/1", "ipv6 address 2001:db8:b::5/126", "no shutdown", "ipv6 route 2001:db8:a::/64 2001:db8:b::2", "ipv6 route 2001:db8:c::/64 2001:db8:b::6"], RouterC: ["ipv6 unicast-routing", "interface FastEthernet0/1", "ipv6 address 2001:db8:c::1/64", "no shutdown", "interface FastEthernet0/0", "ipv6 address 2001:db8:b::6/126", "no shutdown", "ipv6 route ::/0 2001:db8:b::5"] },
    },
    {
      id: "ccna-b-q3-50-dhcp-relay",
      quizBank: "ccna-b/quiz-03",
      questionSlide: 50,
      title: "DHCP Server and Relay",
      estimatedMinutes: 6,
      devices: [r("RouterA", 350, 260, { "FastEthernet0/1": { ip: "192.168.44.1", mask: "255.255.255.0" }, "FastEthernet0/0": { ip: "10.0.0.1", mask: "255.255.255.252" } }), r("RouterB", 650, 260, { "FastEthernet0/0": { ip: "10.0.0.2", mask: "255.255.255.252" } }), pc("DHCP-Client", 120, 260)],
      links: [["DHCP-Client", "eth0", "RouterA", "FastEthernet0/1"], ["RouterA", "FastEthernet0/0", "RouterB", "FastEthernet0/0"]],
      instructionsHtml: instructions("Configure RouterB as DHCP server and RouterA as relay.", ["Exclude RouterA's LAN gateway.", "Create pool boson for 192.168.44.0/24.", "Set RouterA Fa0/1 as default gateway.", "Relay DHCP from RouterA Fa0/1 to RouterB 10.0.0.2."]),
      hints: ["The helper address goes on the client-facing RouterA interface."],
      answerCommands: { RouterB: ["ip dhcp excluded-address 192.168.44.1", "ip dhcp pool boson", "network 192.168.44.0 255.255.255.0", "default-router 192.168.44.1"], RouterA: ["interface FastEthernet0/1", "ip helper-address 10.0.0.2"] },
    },
    ...generatedCoreLabs(),
  ];

  const byId = Object.fromEntries(LABS.map((lab) => [lab.id, lab]));
  const byQuestion = Object.fromEntries(LABS.map((lab) => [`${lab.quizBank}:${lab.questionSlide}`, lab]));

  function compareLabs(a, b) {
    return (
      String(a.quizBank || "").localeCompare(String(b.quizBank || "")) ||
      Number(a.questionSlide || 0) - Number(b.questionSlide || 0) ||
      String(a.title || "").localeCompare(String(b.title || ""))
    );
  }

  function labsForBanks(banks = []) {
    const wanted = new Set((banks || []).map((bank) => String(bank || "").trim()).filter(Boolean));
    const allCcnaB = wanted.has("ccna-b/all");
    const allOpenPt = wanted.has("openpt/all");
    return LABS
      .filter((lab) => allOpenPt || (allCcnaB && String(lab.quizBank || "").startsWith("ccna-b/")) || wanted.has(lab.quizBank))
      .sort(compareLabs);
  }

  function labsForRefs(refs = []) {
    const seen = new Set();
    const labs = [];
    for (const ref of refs || []) {
      const lab = byId[String(ref || "").trim()];
      if (!lab || seen.has(lab.id)) continue;
      seen.add(lab.id);
      labs.push(lab);
    }
    return labs.sort(compareLabs);
  }

  function catalogReport() {
    const report = {
      labCount: LABS.length,
      generatedCount: LABS.filter((lab) => lab.generated).length,
      assessmentItemCount: 0,
      estimatedMinutes: 0,
      byCategory: {},
      byDifficulty: {},
      byQuizBank: {},
      skills: {},
    };
    for (const lab of LABS) {
      const category = lab.category || "CCNA Practice";
      const difficulty = lab.difficulty || "intermediate";
      report.byCategory[category] = (report.byCategory[category] || 0) + 1;
      report.byDifficulty[difficulty] = (report.byDifficulty[difficulty] || 0) + 1;
      report.byQuizBank[lab.quizBank || "uncategorized"] = (report.byQuizBank[lab.quizBank || "uncategorized"] || 0) + 1;
      report.estimatedMinutes += Number(lab.estimatedMinutes || 0);
      report.assessmentItemCount += assessmentItems(lab.title, lab.answerCommands).length;
      for (const skill of lab.skills || []) report.skills[skill] = (report.skills[skill] || 0) + 1;
    }
    return report;
  }

  window.OpenPTLabs = {
    all: LABS,
    byId,
    byQuestion,
    metadata: (id) => byId[id] || null,
    metadataForQuestion: (bank, slide) => byQuestion[`${bank}:${slide}`] || null,
    labsForBanks,
    labsForRefs,
    catalogReport,
    build: (id) => {
      const lab = byId[id];
      return lab ? buildLab(lab) : null;
    },
    menuItems: () =>
      LABS.map((lab) => ({
        key: lab.id,
        title: lab.title,
        desc: lab.summary || `${COURSE} ${lab.quizBank.replace("ccna-b/", "").toUpperCase()} question ${lab.questionSlide}`,
        category: lab.category || "CCNA Practice",
        difficulty: lab.difficulty || "intermediate",
        estimatedMinutes: lab.estimatedMinutes || 10,
      })),
  };
})();
