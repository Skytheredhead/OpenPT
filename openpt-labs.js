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
    return {
      format: "openpt-authored-lab",
      labKey: lab.id,
      title: lab.title,
      sourceName: `${lab.id}.opt`,
      instructionsHtml: lab.instructionsHtml,
      hints: lab.hints || [],
      answerCommands: clone(lab.answerCommands || {}),
      assessmentItems: assessmentItems(lab.title, lab.answerCommands).map((entry, index) => ({
        id: `${lab.id}-${index}`,
        points: 1,
        pathParts: [entry.device, entry.iface, entry.name].filter(Boolean),
        parentPath: [entry.rootName, entry.device, entry.iface].filter(Boolean).join(" / "),
        path: [entry.rootName, entry.device, entry.iface, entry.name].filter(Boolean).join(" / "),
        ...entry,
      })),
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
  ];

  const byId = Object.fromEntries(LABS.map((lab) => [lab.id, lab]));
  const byQuestion = Object.fromEntries(LABS.map((lab) => [`${lab.quizBank}:${lab.questionSlide}`, lab]));

  window.OpenPTLabs = {
    all: LABS,
    byId,
    byQuestion,
    metadata: (id) => byId[id] || null,
    metadataForQuestion: (bank, slide) => byQuestion[`${bank}:${slide}`] || null,
    build: (id) => {
      const lab = byId[id];
      return lab ? buildLab(lab) : null;
    },
    menuItems: () => LABS.map((lab) => ({ key: lab.id, title: lab.title, desc: `${COURSE} ${lab.quizBank.replace("ccna-b/", "").toUpperCase()} question ${lab.questionSlide}` })),
  };
})();
