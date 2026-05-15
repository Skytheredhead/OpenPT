// packet-tracer-importer.js - browser-side Packet Tracer assignment importer hook
(function () {
  const ETHERCHANNEL_SHA256 = "f37cf1ca63177e6fa30799e28f1abac2b26cac26e6b652b0357cf51438d5081a";

  const etherchannelText = `15.2.7 Packet Tracer - EtherChannel Review

Objectives
Part 1: Build the network
Part 2: Configure EtherChannel

Background
This lab is a review lab of all the various forms and implementations of EtherChannel. You will build the topology, configure trunk ports, and implement LACP and PAgP EtherChannels.

Instructions
Part 1: Build the network.
Use the table below to build the switch topology.

Step 1: Obtain the devices that are required.
a. Click the Network Devices icon in the bottom tool bar.
b. Click the Switches entry in the submenu.
c. Locate the 2960 switch icon. Click and drag the icon for the 2960 switch into the topology area.
d. Repeat the step above so that there are three 2960 switches in the topology area.
e. Arrange the devices into a layout that you can work with by clicking and dragging.

Step 2: Name the devices.
The devices have default names that you will need to change. You will name the devices SWA, SWB, and SWC. You are changing the display names of the devices. This is the text label that appears below each device. It is not the host name. Your display names must match the names that are given in this step exactly.

Step 3: Connect the devices.
Use Ethernet straight-through cables to connect the devices as specified below.

Port Channel 1: SWA to SWB, G0/1 to G0/1, PAgP
Port Channel 1: SWA to SWB, G0/2 to G0/2
Port Channel 2: SWA to SWC, F0/21 to F0/21, LACP
Port Channel 2: SWA to SWC, F0/22 to F0/22
Port Channel 3: SWB to SWC, F0/23 to F0/23, LACP
Port Channel 3: SWB to SWC, F0/24 to F0/24

Part 2: Configure EtherChannel
On each switch, configure the ports that will be used in the Port Channels as static trunk ports.

Step 1: Configure a PAgP EtherChannel.
Configure Port Channel 1 as a PAgP EtherChannel between SWA and SWB. Both sides should negotiate the EtherChannel.

Step 2: Configure a LACP EtherChannel.
Configure Port Channel 2 as an LACP channel between SWA and SWC. Both sides should negotiate the EtherChannel.

Step 3: Configure a Backup LACP EtherChannel.
Configure Port Channel 3 as an LACP channel between SWB and SWC. In this case, SWC initiates negotiation with SWB. SWB does not initiate negotiation of the channel.

End of document`;

  const etherchannelActivity = {
    format: "packet-tracer-activity",
    importerVersion: 1,
    title: "15.2.7 Packet Tracer - EtherChannel Review",
    instructionsText: etherchannelText,
    instructionsHtml: `
      <article class="pt-assignment">
        <h1>15.2.7 Packet Tracer - EtherChannel Review</h1>
        <h2>Objectives</h2>
        <ul>
          <li>Part 1: Build the network</li>
          <li>Part 2: Configure EtherChannel</li>
        </ul>
        <h2>Background</h2>
        <p>This lab is a review lab of all the various forms and implementations of EtherChannel. You will build the topology, configure trunk ports, and implement LACP and PAgP EtherChannels.</p>
        <h2>Part 1: Build the network</h2>
        <h3>Step 1: Obtain the devices that are required.</h3>
        <ol type="a">
          <li>Click the Network Devices icon in the bottom tool bar.</li>
          <li>Click the Switches entry in the submenu.</li>
          <li>Locate the 2960 switch icon. Click and drag the icon for the 2960 switch into the topology area.</li>
          <li>Repeat the step above so that there are three 2960 switches in the topology area.</li>
          <li>Arrange the devices into a layout that you can work with by clicking and dragging.</li>
        </ol>
        <h3>Step 2: Name the devices.</h3>
        <p>Name the switches SWA, SWB, and SWC. These are display names and must match exactly for scoring.</p>
        <h3>Step 3: Connect the devices.</h3>
        <table>
          <thead><tr><th>Port Channel</th><th>Devices</th><th>Port Connections</th><th>Type</th></tr></thead>
          <tbody>
            <tr><td>1</td><td>SWA to SWB</td><td>G0/1 to G0/1</td><td>PAgP</td></tr>
            <tr><td>1</td><td>SWA to SWB</td><td>G0/2 to G0/2</td><td></td></tr>
            <tr><td>2</td><td>SWA to SWC</td><td>F0/21 to F0/21</td><td>LACP</td></tr>
            <tr><td>2</td><td>SWA to SWC</td><td>F0/22 to F0/22</td><td></td></tr>
            <tr><td>3</td><td>SWB to SWC</td><td>F0/23 to F0/23</td><td>LACP</td></tr>
            <tr><td>3</td><td>SWB to SWC</td><td>F0/24 to F0/24</td><td></td></tr>
          </tbody>
        </table>
        <h2>Part 2: Configure EtherChannel</h2>
        <p>On each switch, configure the ports that will be used in the Port Channels as static trunk ports.</p>
        <h3>Step 1: Configure a PAgP EtherChannel.</h3>
        <p>Configure Port Channel 1 as a PAgP EtherChannel between SWA and SWB. Both sides should negotiate the EtherChannel.</p>
        <h3>Step 2: Configure a LACP EtherChannel.</h3>
        <p>Configure Port Channel 2 as an LACP channel between SWA and SWC. Both sides should negotiate the EtherChannel.</p>
        <h3>Step 3: Configure a Backup LACP EtherChannel.</h3>
        <p>Configure Port Channel 3 as an LACP channel between SWB and SWC. SWC initiates negotiation with SWB; SWB does not initiate negotiation.</p>
      </article>
    `,
    progress: {
      percent: 100,
      score: "96/96",
      itemCount: "48/48",
      components: [
        { name: "Device Connections", items: "12/12", score: "12/12" },
        { name: "EtherChannel Configuration", items: "24/24", score: "72/72" },
        { name: "Trunk Configuration", items: "12/12", score: "12/12" },
      ],
    },
    devices: [
      { name: "SWA", kind: "l2switch", model: "2960", power: "On", x: 455, y: 277 },
      { name: "SWB", kind: "l2switch", model: "2960", power: "On", x: 270, y: 532 },
      { name: "SWC", kind: "l2switch", model: "2960", power: "On", x: 619, y: 532 },
    ],
    links: [
      { type: "Copper Straight-Through", from: "SWA:GigabitEthernet0/1", to: "SWB:GigabitEthernet0/1", fromStatus: "Green", toStatus: "Green" },
      { type: "Copper Straight-Through", from: "SWA:GigabitEthernet0/2", to: "SWB:GigabitEthernet0/2", fromStatus: "Green", toStatus: "Green" },
      { type: "Copper Straight-Through", from: "SWA:FastEthernet0/21", to: "SWC:FastEthernet0/21", fromStatus: "Green", toStatus: "Green" },
      { type: "Copper Straight-Through", from: "SWA:FastEthernet0/22", to: "SWC:FastEthernet0/22", fromStatus: "Green", toStatus: "Green" },
      { type: "Copper Straight-Through", from: "SWB:FastEthernet0/23", to: "SWC:FastEthernet0/23", fromStatus: "Green", toStatus: "Amber" },
      { type: "Copper Straight-Through", from: "SWB:FastEthernet0/24", to: "SWC:FastEthernet0/24", fromStatus: "Green", toStatus: "Amber" },
    ],
    rubricPattern: {
      SWA: {
        "FastEthernet0/21": ["Channel Group", "Channel Mode", "Link to SWC: connects to FastEthernet0/21", "Link Type", "Port Mode"],
        "FastEthernet0/22": ["Channel Group", "Channel Mode", "Link to SWC: connects to FastEthernet0/22", "Link Type", "Port Mode"],
        "GigabitEthernet0/1": ["Channel Group", "Channel Mode", "Link to SWB: connects to GigabitEthernet0/1", "Link Type", "Port Mode"],
        "GigabitEthernet0/2": ["Channel Group", "Channel Mode", "Link to SWB: connects to GigabitEthernet0/2", "Link Type", "Port Mode"],
      },
      SWB: {
        "FastEthernet0/23": ["Channel Group", "Channel Mode", "Link to SWC: connects to FastEthernet0/23", "Link Type", "Port Mode"],
        "FastEthernet0/24": ["Channel Group", "Channel Mode", "Link to SWC: connects to FastEthernet0/24", "Link Type", "Port Mode"],
        "GigabitEthernet0/1": ["Channel Group", "Channel Mode", "Port Mode"],
        "GigabitEthernet0/2": ["Channel Group", "Channel Mode", "Port Mode"],
      },
      SWC: {
        "FastEthernet0/21": ["Channel Group", "Channel Mode", "Port Mode"],
        "FastEthernet0/22": ["Channel Group", "Channel Mode", "Port Mode"],
        "FastEthernet0/23": ["Channel Group", "Channel Mode", "Port Mode"],
        "FastEthernet0/24": ["Channel Group", "Channel Mode", "Port Mode"],
      },
    },
    answerCommands: {
      SWA: [
        "hostname SWA",
        "interface range GigabitEthernet0/1 - 2",
        "switchport mode trunk",
        "channel-group 1 mode desirable",
        "interface Port-channel1",
        "switchport mode trunk",
        "interface range FastEthernet0/21 - 22",
        "switchport mode trunk",
        "channel-group 2 mode active",
        "interface Port-channel2",
        "switchport mode trunk",
      ],
      SWB: [
        "hostname SWB",
        "interface range GigabitEthernet0/1 - 2",
        "switchport mode trunk",
        "channel-group 1 mode desirable",
        "interface Port-channel1",
        "switchport mode trunk",
        "interface range FastEthernet0/23 - 24",
        "switchport mode trunk",
        "channel-group 3 mode passive",
        "interface Port-channel3",
        "switchport mode trunk",
      ],
      SWC: [
        "hostname SWC",
        "interface range FastEthernet0/21 - 22",
        "switchport mode trunk",
        "channel-group 2 mode active",
        "interface Port-channel2",
        "switchport mode trunk",
        "interface range FastEthernet0/23 - 24",
        "switchport mode trunk",
        "channel-group 3 mode active",
        "interface Port-channel3",
        "switchport mode trunk",
      ],
    },
  };

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function stripPacketTracerExt(name) {
    return (name || "packet-tracer-assignment").replace(/\.(pka|pkt)$/i, "");
  }

  function headHex(bytes, count) {
    return Array.from(bytes.slice(0, count)).map((b) => b.toString(16).padStart(2, "0")).join(" ");
  }

  async function sha256Hex(buffer) {
    if (!window.crypto?.subtle) return null;
    const digest = await window.crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function makeUnsupportedActivity(file, sha256, head) {
    const title = stripPacketTracerExt(file.name);
    return {
      format: "packet-tracer-activity",
      importerVersion: 1,
      unsupported: true,
      title,
      instructionsText: `Packet Tracer file recognized: ${file.name}\n\nThis activity has not been extracted into OpenPT yet. The importer captured file metadata so a decoder or Packet Tracer UI extraction pass can be added for this hash.`,
      instructionsHtml: `
        <article class="pt-assignment">
          <h1>${escapeHtml(title)}</h1>
          <p>This Packet Tracer file was recognized and opened as an assignment tab, but no extractor profile is packaged for it yet.</p>
          <p>Add an extraction profile for this hash to populate instructions, rubric, devices, links, and answer commands.</p>
        </article>
      `,
      progress: null,
      devices: [],
      links: [],
      answerCommands: {},
      diagnostics: {
        sha256,
        headHex: head,
        size: file.size,
      },
    };
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[ch]));
  }

  async function importPacketTracerFile(file) {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const sha256 = await sha256Hex(buffer);
    const head = headHex(bytes, 16);
    const knownByHash = sha256 === ETHERCHANNEL_SHA256;
    const knownByFallback = !sha256 && file.size === 641292 && /15\.2\.7 packet tracer - etherchannel review/i.test(file.name || "");
    const activity = (knownByHash || knownByFallback) ? clone(etherchannelActivity) : makeUnsupportedActivity(file, sha256, head);
    activity.sourceName = file.name || "packet-tracer-file";
    activity.sourceSize = file.size;
    activity.sourceSha256 = sha256;
    activity.sourceHeadHex = head;
    return activity;
  }

  window.PacketTracerImporter = {
    importPacketTracerFile,
    profiles: {
      [ETHERCHANNEL_SHA256]: etherchannelActivity.title,
    },
  };
})();
