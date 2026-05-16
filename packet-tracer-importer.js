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

  function bytesToHex(bytes) {
    return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function shannonEntropy(bytes) {
    if (!bytes.length) return 0;
    const counts = new Array(256).fill(0);
    for (const b of bytes) counts[b]++;
    let entropy = 0;
    for (const count of counts) {
      if (!count) continue;
      const p = count / bytes.length;
      entropy -= p * Math.log2(p);
    }
    return Number(entropy.toFixed(4));
  }

  function windowEntropy(bytes, windowSize = 4096, limit = 16) {
    const out = [];
    for (let offset = 0; offset < bytes.length && out.length < limit; offset += windowSize) {
      const chunk = bytes.slice(offset, Math.min(bytes.length, offset + windowSize));
      out.push({ offset, length: chunk.length, entropy: shannonEntropy(chunk) });
    }
    return out;
  }

  function findNeedle(bytes, needle, start = 0) {
    outer: for (let i = start; i <= bytes.length - needle.length; i++) {
      for (let j = 0; j < needle.length; j++) {
        if (bytes[i + j] !== needle[j]) continue outer;
      }
      return i;
    }
    return -1;
  }

  function findSignatures(bytes) {
    const signatures = [
      { label: "PDF", bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
      { label: "ZIP local file", bytes: [0x50, 0x4b, 0x03, 0x04] },
      { label: "ZIP end record", bytes: [0x50, 0x4b, 0x05, 0x06] },
      { label: "GZIP", bytes: [0x1f, 0x8b, 0x08] },
      { label: "PNG", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
      { label: "JPEG", bytes: [0xff, 0xd8, 0xff] },
      { label: "RTF", bytes: [0x7b, 0x5c, 0x72, 0x74, 0x66] },
      { label: "HTML", bytes: [0x3c, 0x68, 0x74, 0x6d, 0x6c] },
      { label: "SQLite", bytes: [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00] },
    ];
    const hits = [];
    for (const sig of signatures) {
      let offset = findNeedle(bytes, sig.bytes);
      while (offset !== -1 && hits.length < 200) {
        hits.push({ label: sig.label, offset, hex: bytesToHex(sig.bytes) });
        offset = findNeedle(bytes, sig.bytes, offset + 1);
      }
    }
    return hits.sort((a, b) => a.offset - b.offset);
  }

  function extractAsciiStrings(bytes, minLength = 8, limit = 120) {
    const strings = [];
    let start = -1;
    let chars = [];
    const flush = (offset) => {
      if (chars.length >= minLength) strings.push({ offset: start, length: chars.length, text: chars.join("") });
      start = -1;
      chars = [];
    };
    for (let i = 0; i < bytes.length && strings.length < limit; i++) {
      const b = bytes[i];
      if (b >= 32 && b <= 126) {
        if (start === -1) start = i;
        chars.push(String.fromCharCode(b));
      } else {
        flush(i);
      }
    }
    flush(bytes.length);
    return strings.slice(0, limit);
  }

  function buildReverseReport(file, bytes, sha256, head) {
    const strings = extractAsciiStrings(bytes);
    const interestingPatterns = /(packet|tracer|cisco|html|pdf|rtf|assessment|rubric|score|device|router|switch|interface|config|activity|instruction)/i;
    return {
      fileName: file.name || "packet-tracer-file",
      size: file.size,
      sha256,
      headHex: head,
      tailHex: headHex(bytes.slice(Math.max(0, bytes.length - 16)), 16),
      entropy: shannonEntropy(bytes),
      entropyByWindow: windowEntropy(bytes),
      signatures: findSignatures(bytes),
      strings,
      interestingStrings: strings.filter((s) => interestingPatterns.test(s.text)).slice(0, 40),
      notes: [
        "The original PKA/PKT bytes are preserved in browser storage by SHA-256 when IndexedDB is available.",
        "Modern Packet Tracer activity files usually look high-entropy and do not expose raw PDFs or HTML by file signature.",
        "This browser report is useful for fingerprinting and profile matching; full assignment extraction still needs a known profile or a Packet Tracer-assisted local extraction pass.",
      ],
    };
  }

  async function sha256Hex(buffer) {
    if (!window.crypto?.subtle) return null;
    const digest = await window.crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  function openPacketTracerDb() {
    if (!window.indexedDB) return Promise.resolve(null);
    return new Promise((resolve, reject) => {
      const req = window.indexedDB.open("OpenPTPacketTracer", 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("rawFiles")) {
          db.createObjectStore("rawFiles", { keyPath: "sha256" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function storeRawPacketTracerFile(file, buffer, sha256) {
    if (!sha256) return { stored: false, backend: null, reason: "sha256 unavailable" };
    const db = await openPacketTracerDb();
    if (!db) return { stored: false, backend: null, reason: "IndexedDB unavailable" };
    const record = {
      sha256,
      name: file.name || "packet-tracer-file",
      size: file.size,
      type: file.type || "application/octet-stream",
      lastModified: file.lastModified || null,
      storedAt: new Date().toISOString(),
      bytes: buffer.slice(0),
    };
    return new Promise((resolve, reject) => {
      const tx = db.transaction("rawFiles", "readwrite");
      tx.objectStore("rawFiles").put(record);
      tx.oncomplete = () => {
        db.close();
        resolve({ stored: true, backend: "indexeddb", key: sha256, size: file.size });
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
    });
  }

  async function getRawPacketTracerFile(sha256) {
    if (!sha256) return null;
    const db = await openPacketTracerDb();
    if (!db) return null;
    return new Promise((resolve, reject) => {
      const tx = db.transaction("rawFiles", "readonly");
      const req = tx.objectStore("rawFiles").get(sha256);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
      tx.onerror = () => db.close();
    });
  }

  function reverseReportText(report) {
    const signatureLines = report.signatures.length
      ? report.signatures.slice(0, 20).map((s) => `- ${s.label} at 0x${s.offset.toString(16)}`).join("\n")
      : "- No embedded PDF/ZIP/RTF/HTML/image signatures found.";
    const stringLines = (report.interestingStrings.length ? report.interestingStrings : report.strings.slice(0, 20))
      .map((s) => `- 0x${s.offset.toString(16)} ${s.text}`)
      .join("\n") || "- No printable strings of interest found.";
    return `Packet Tracer reverse-engineering report

File: ${report.fileName}
Size: ${report.size} bytes
SHA-256: ${report.sha256 || "unavailable"}
Header: ${report.headHex}
Tail: ${report.tailHex}
Entropy: ${report.entropy} bits/byte

Embedded signature scan:
${signatureLines}

String sample:
${stringLines}

Notes:
${report.notes.map((n) => `- ${n}`).join("\n")}`;
  }

  function reverseReportHtml(title, report) {
    const signatureRows = report.signatures.length
      ? report.signatures.slice(0, 40).map((s) => `<tr><td>${escapeHtml(s.label)}</td><td>0x${s.offset.toString(16)}</td><td><code>${escapeHtml(s.hex)}</code></td></tr>`).join("")
      : `<tr><td colspan="3">No embedded PDF/ZIP/RTF/HTML/image signatures found.</td></tr>`;
    const strings = report.interestingStrings.length ? report.interestingStrings : report.strings.slice(0, 30);
    const stringRows = strings.length
      ? strings.map((s) => `<tr><td>0x${s.offset.toString(16)}</td><td>${s.length}</td><td><code>${escapeHtml(s.text)}</code></td></tr>`).join("")
      : `<tr><td colspan="3">No printable strings of interest found.</td></tr>`;
    return `
      <article class="pt-assignment">
        <h1>${escapeHtml(title)}</h1>
        <p>This Packet Tracer file was fingerprinted in the browser, but no full extractor profile is packaged for it yet.</p>
        <h2>Fingerprint</h2>
        <table>
          <tbody>
            <tr><th>Size</th><td>${report.size} bytes</td></tr>
            <tr><th>SHA-256</th><td><code>${escapeHtml(report.sha256 || "unavailable")}</code></td></tr>
            <tr><th>Header</th><td><code>${escapeHtml(report.headHex)}</code></td></tr>
            <tr><th>Tail</th><td><code>${escapeHtml(report.tailHex)}</code></td></tr>
            <tr><th>Entropy</th><td>${report.entropy} bits/byte</td></tr>
          </tbody>
        </table>
        <h2>Embedded Signature Scan</h2>
        <table><thead><tr><th>Type</th><th>Offset</th><th>Signature</th></tr></thead><tbody>${signatureRows}</tbody></table>
        <h2>Printable String Sample</h2>
        <table><thead><tr><th>Offset</th><th>Length</th><th>Text</th></tr></thead><tbody>${stringRows}</tbody></table>
      </article>
    `;
  }

  function makeUnsupportedActivity(file, sha256, head, report) {
    const title = stripPacketTracerExt(file.name);
    return {
      format: "packet-tracer-activity",
      importerVersion: 1,
      unsupported: true,
      title,
      instructionsText: reverseReportText(report),
      instructionsHtml: reverseReportHtml(title, report),
      progress: null,
      devices: [],
      links: [],
      answerCommands: {},
      reverseReport: report,
      featureCoverage: {
        rawFilePreserved: false,
        semanticExtraction: "not-decoded",
        preservedButUnsupported: [
          "Packet Tracer encrypted/proprietary activity payload",
          "Device configurations hidden inside the activity payload",
          "Assessment tree hidden inside the activity payload",
          "Workspace objects hidden inside the activity payload",
          "Instruction assets hidden inside the activity payload",
        ],
      },
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
    const report = buildReverseReport(file, bytes, sha256, head);
    const rawStorage = await storeRawPacketTracerFile(file, buffer, sha256).catch((err) => ({
      stored: false,
      backend: "indexeddb",
      reason: err?.message || String(err),
    }));
    const activity = (knownByHash || knownByFallback) ? clone(etherchannelActivity) : makeUnsupportedActivity(file, sha256, head, report);
    activity.reverseReport = report;
    activity.rawFile = {
      name: file.name || "packet-tracer-file",
      size: file.size,
      type: file.type || "application/octet-stream",
      lastModified: file.lastModified || null,
      sha256,
      storage: rawStorage,
    };
    activity.featureCoverage = {
      rawFilePreserved: !!rawStorage.stored,
      semanticExtraction: activity.unsupported ? "not-decoded" : "profile-derived",
      profileMatched: !activity.unsupported,
      preservedButUnsupported: activity.unsupported ? [
        "Packet Tracer encrypted/proprietary activity payload",
        "Device configurations hidden inside the activity payload",
        "Assessment tree hidden inside the activity payload",
        "Workspace objects hidden inside the activity payload",
        "Instruction assets hidden inside the activity payload",
      ] : [],
    };
    activity.sourceName = file.name || "packet-tracer-file";
    activity.sourceSize = file.size;
    activity.sourceSha256 = sha256;
    activity.sourceHeadHex = head;
    return activity;
  }

  window.PacketTracerImporter = {
    importPacketTracerFile,
    getRawPacketTracerFile,
    profiles: {
      [ETHERCHANNEL_SHA256]: etherchannelActivity.title,
    },
  };
})();
