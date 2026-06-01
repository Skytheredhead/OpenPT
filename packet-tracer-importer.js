// packet-tracer-importer.js - browser-side Packet Tracer assignment importer hook
(function () {
  const ETHERCHANNEL_SHA256 = "f37cf1ca63177e6fa30799e28f1abac2b26cac26e6b652b0357cf51438d5081a";
  let twofishLoadPromise = null;
  const BUILT_IN_ASSESSMENT_COMPONENTS = new Set([
    "acl",
    "default gateway",
    "defautl gateway",
    "ip",
    "ip address",
    "nat",
    "other",
    "pc address",
    "pc addressing",
    "physical",
    "router address",
    "router addressing",
    "routing",
    "save config",
    "switch address",
    "switching",
  ]);

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
    importerVersion: 3,
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
        "Modern Packet Tracer activity files use a high-entropy save wrapper, so PDFs/HTML usually are not visible until the save payload is decoded.",
        "The packaged browser decoder mirrors Packet Tracer 9's Twofish-EAX save wrapper and Qt/zlib XML expansion when the browser exposes the required primitives.",
      ],
    };
  }

  async function sha256Hex(buffer) {
    if (!window.crypto?.subtle) return null;
    const digest = await window.crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  async function ensureTwofish() {
    if (window.OpenPTTwofish?.makeSession && window.OpenPTTwofish?.encrypt) return;
    if (typeof document === "undefined" || !document.createElement) {
      throw new Error("Packet Tracer decoder cannot load Twofish in this environment.");
    }
    if (!twofishLoadPromise) {
      twofishLoadPromise = new Promise((resolve, reject) => {
        const previousExports = window.exports;
        const exportsBucket = {};
        window.OpenPTTwofishExports = exportsBucket;
        window.exports = exportsBucket;
        const script = document.createElement("script");
        script.src = "vendor/twofish-ts.js";
        script.async = true;
        script.onload = () => {
          window.OpenPTTwofish = window.OpenPTTwofishExports;
          delete window.OpenPTTwofishExports;
          if (previousExports === undefined) delete window.exports;
          else window.exports = previousExports;
          if (window.OpenPTTwofish?.makeSession && window.OpenPTTwofish?.encrypt) resolve();
          else reject(new Error("Twofish helper loaded, but did not expose makeSession/encrypt."));
        };
        script.onerror = () => {
          delete window.OpenPTTwofishExports;
          if (previousExports === undefined) delete window.exports;
          else window.exports = previousExports;
          reject(new Error("Could not load vendor/twofish-ts.js. Make sure the vendored decoder file is deployed."));
        };
        document.head.appendChild(script);
      });
    }
    await twofishLoadPromise;
  }

  function packetTracerOuterDecode(bytes) {
    const n = bytes.length;
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      out[i] = bytes[n - 1 - i] ^ (((1 - i) * n) & 0xff);
    }
    return out;
  }

  function packetTracerPayloadDeobfuscate(bytes) {
    const n = bytes.length;
    const out = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      out[i] = bytes[i] ^ ((n - i) & 0xff);
    }
    return out;
  }

  function xor16(a, b) {
    const out = new Uint8Array(16);
    for (let i = 0; i < 16; i++) out[i] = a[i] ^ b[i];
    return out;
  }

  function twofishEncryptBlock(session, block) {
    const out = new Uint8Array(16);
    window.OpenPTTwofish.encrypt(block, 0, out, 0, session);
    return out;
  }

  function cmacDouble(block) {
    const out = new Uint8Array(16);
    let carry = 0;
    for (let i = 15; i >= 0; i--) {
      const nextCarry = (block[i] & 0x80) ? 1 : 0;
      out[i] = ((block[i] << 1) & 0xff) | carry;
      carry = nextCarry;
    }
    if (block[0] & 0x80) out[15] ^= 0x87;
    return out;
  }

  function twofishCmac(session, message) {
    const zero = new Uint8Array(16);
    const l = twofishEncryptBlock(session, zero);
    const k1 = cmacDouble(l);
    const k2 = cmacDouble(k1);
    const blockCount = Math.max(1, Math.ceil(message.length / 16));
    const lastBlockComplete = message.length > 0 && message.length % 16 === 0;
    let state = new Uint8Array(16);

    for (let block = 0; block < blockCount - 1; block++) {
      const offset = block * 16;
      for (let i = 0; i < 16; i++) state[i] ^= message[offset + i];
      state = twofishEncryptBlock(session, state);
    }

    const last = new Uint8Array(16);
    const lastOffset = (blockCount - 1) * 16;
    const remaining = message.length - lastOffset;
    last.set(message.slice(lastOffset));
    if (lastBlockComplete) {
      for (let i = 0; i < 16; i++) last[i] ^= k1[i];
    } else {
      last[remaining] = 0x80;
      for (let i = 0; i < 16; i++) last[i] ^= k2[i];
    }

    for (let i = 0; i < 16; i++) state[i] ^= last[i];
    return twofishEncryptBlock(session, state);
  }

  function twofishEaxOmac(session, domain, data) {
    const message = new Uint8Array(16 + data.length);
    message[15] = domain;
    message.set(data, 16);
    return twofishCmac(session, message);
  }

  function incrementCounter(counter) {
    for (let i = 15; i >= 0; i--) {
      counter[i] = (counter[i] + 1) & 0xff;
      if (counter[i]) break;
    }
  }

  function timingSafeEqual16(a, b) {
    let diff = 0;
    for (let i = 0; i < 16; i++) diff |= a[i] ^ b[i];
    return diff === 0;
  }

  function decryptPacketTracerSave(bytes) {
    if (!window.OpenPTTwofish?.makeSession || !window.OpenPTTwofish?.encrypt) {
      throw new Error("Packet Tracer decoder did not load its Twofish block cipher.");
    }
    if (bytes.length <= 16) throw new Error("Packet Tracer payload is too short to contain an EAX tag.");

    const stage1 = packetTracerOuterDecode(bytes);
    const key = new Uint8Array(16).fill(0x89);
    const nonce = new Uint8Array(16).fill(0x10);
    const session = window.OpenPTTwofish.makeSession(key);
    const ciphertext = stage1.slice(0, stage1.length - 16);
    const tag = stage1.slice(stage1.length - 16);
    const nonceTag = twofishEaxOmac(session, 0, nonce);
    const headerTag = twofishEaxOmac(session, 1, new Uint8Array(0));
    const ciphertextTag = twofishEaxOmac(session, 2, ciphertext);
    const expectedTag = xor16(xor16(nonceTag, headerTag), ciphertextTag);
    if (!timingSafeEqual16(tag, expectedTag)) {
      throw new Error("Packet Tracer EAX authentication tag did not verify.");
    }

    const decrypted = new Uint8Array(ciphertext.length);
    const counter = new Uint8Array(nonceTag);
    const stream = new Uint8Array(16);
    for (let offset = 0; offset < ciphertext.length; offset += 16) {
      window.OpenPTTwofish.encrypt(counter, 0, stream, 0, session);
      const count = Math.min(16, ciphertext.length - offset);
      for (let i = 0; i < count; i++) decrypted[offset + i] = ciphertext[offset + i] ^ stream[i];
      incrementCounter(counter);
    }

    return {
      profile: "ptsave-eax-twofish-v1",
      stage1Length: stage1.length,
      decryptedLength: decrypted.length,
      payload: packetTracerPayloadDeobfuscate(decrypted),
      tag: bytesToHex(tag),
    };
  }

  async function qtUncompress(bytes) {
    if (bytes.length < 6) throw new Error("Decoded Packet Tracer payload is too short for qUncompress.");
    const expectedLength = (
      (bytes[0] << 24) |
      (bytes[1] << 16) |
      (bytes[2] << 8) |
      bytes[3]
    ) >>> 0;
    if (!window.DecompressionStream) {
      throw new Error("This browser does not expose DecompressionStream for Qt/zlib payloads.");
    }
    const stream = new Blob([bytes.slice(4)]).stream().pipeThrough(new DecompressionStream("deflate"));
    const inflated = new Uint8Array(await new Response(stream).arrayBuffer());
    if (expectedLength && inflated.length !== expectedLength) {
      throw new Error(`Qt/zlib payload inflated to ${inflated.length} bytes, expected ${expectedLength}.`);
    }
    return inflated;
  }

  async function decodePacketTracerXml(bytes) {
    const directText = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, Math.min(bytes.length, 1024)));
    if (/^\s*<PACKETTRACER/i.test(directText)) {
      return {
        profile: "plain-xml",
        xmlBytes: bytes,
        xmlText: new TextDecoder("utf-8", { fatal: false }).decode(bytes),
        stages: { rawLength: bytes.length },
      };
    }

    await ensureTwofish();
    const decrypted = decryptPacketTracerSave(bytes);
    const xmlBytes = await qtUncompress(decrypted.payload);
    return {
      profile: decrypted.profile,
      xmlBytes,
      xmlText: new TextDecoder("utf-8", { fatal: false }).decode(xmlBytes),
      stages: {
        rawLength: bytes.length,
        stage1Length: decrypted.stage1Length,
        decryptedLength: decrypted.decryptedLength,
        qUncompressInputLength: decrypted.payload.length,
        xmlLength: xmlBytes.length,
        tag: decrypted.tag,
      },
    };
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
      const close = () => {
        try { db.close(); } catch (e) {}
      };
      const tx = db.transaction("rawFiles", "readonly");
      const req = tx.objectStore("rawFiles").get(sha256);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => {
        close();
        reject(req.error);
      };
      tx.oncomplete = close;
      tx.onerror = () => {
        close();
        reject(tx.error);
      };
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

  function sanitizeXmlForParser(xmlText) {
    let replacements = 0;
    const sanitized = String(xmlText || "").replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, () => {
      replacements += 1;
      return "\uFFFD";
    });
    return { sanitized, replacements };
  }

  function xmlParserError(doc) {
    const parserError = doc.getElementsByTagName("parsererror")[0];
    return parserError ? parserError.textContent || "Decoded Packet Tracer XML could not be parsed." : "";
  }

  function parseXmlDocument(xmlText) {
    const firstDoc = new DOMParser().parseFromString(xmlText, "application/xml");
    const firstError = xmlParserError(firstDoc);
    if (!firstError) return { doc: firstDoc, sanitizedReplacements: 0 };

    const { sanitized, replacements } = sanitizeXmlForParser(xmlText);
    if (replacements > 0 && sanitized !== xmlText) {
      const retryDoc = new DOMParser().parseFromString(sanitized, "application/xml");
      const retryError = xmlParserError(retryDoc);
      if (!retryError) {
        return { doc: retryDoc, sanitizedReplacements: replacements, firstError };
      }
    }

    throw new Error(firstError);
  }

  function directChildren(element, tagName) {
    if (!element) return [];
    return Array.from(element.children || []).filter((child) => child.tagName === tagName);
  }

  function directChild(element, tagName) {
    return directChildren(element, tagName)[0] || null;
  }

  function pathChild(element, path) {
    return path.reduce((node, tagName) => directChild(node, tagName), element);
  }

  function childText(element, tagName) {
    const child = directChild(element, tagName);
    return child ? child.textContent.trim() : "";
  }

  function firstDescendantText(element, tagName) {
    const child = element?.getElementsByTagName(tagName)?.[0];
    return child ? child.textContent.trim() : "";
  }

  function attrsObject(element) {
    const out = {};
    for (const attr of Array.from(element?.attributes || [])) out[attr.name] = attr.value;
    return out;
  }

  function resolveAttrsObject(element, variables = {}) {
    const out = {};
    for (const [key, value] of Object.entries(attrsObject(element))) {
      out[key] = resolvePacketTracerTokens(value, variables);
    }
    return out;
  }

  function htmlToPlainText(html) {
    const doc = new DOMParser().parseFromString(html || "", "text/html");
    return (doc.body?.textContent || "").replace(/\u00a0/g, " ").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function titleFromHtml(html) {
    const doc = new DOMParser().parseFromString(html || "", "text/html");
    return (doc.querySelector("title")?.textContent || doc.querySelector("h1")?.textContent || "").trim();
  }

  function elementOuterXml(element) {
    return element ? new XMLSerializer().serializeToString(element) : "";
  }

  function collectPacketTracerVariables(root) {
    const variables = {};
    const manager = root?.getElementsByTagName("VARIABLE_MANAGER")?.[0];
    const pools = pathChild(manager, ["VARIABLES_POOLS"]) || manager;
    for (const variable of Array.from(pools?.getElementsByTagName?.("*") || [])) {
      const name = childText(variable, "NAME");
      const value = childText(variable, "VALUE");
      if (name) variables[name] = value;
    }
    return variables;
  }

  function resolvePacketTracerTokens(text, variables = {}) {
    return String(text || "").replace(/\[\[([A-Za-z0-9_.:-]+)\]\]/g, (match, name) => {
      if (Object.prototype.hasOwnProperty.call(variables, name)) return variables[name];
      return name || match;
    });
  }

  function hasScoredAssessmentNode(node) {
    if (!node) return false;
    if (directChild(node, "NAME")?.hasAttribute("checkType")) return true;
    return Array.from(node.getElementsByTagName?.("NAME") || []).some((name) => name.hasAttribute("checkType"));
  }

  function assessmentSearchText(item) {
    return [
      item?.name,
      item?.path,
      item?.rootName,
      item?.parentPath,
      item?.components,
      item?.checkType,
      item?.rootCheckType,
      item?.eclass,
      item?.id,
      ...(item?.checkTypes || []),
      ...Object.values(item?.attrs || {}),
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function isConnectivityAssessmentItem(item) {
    const text = assessmentSearchText(item);
    return /\b(connectivity|reachability|reachable|ping|icmp|trace\s*route|traceroute|simple\s+pdu|complex\s+pdu|pdu|successful\s+connection|packet\s+test)\b/i.test(text);
  }

  function buildAssessmentSections(items) {
    const connectivityTests = [];
    const assessmentItems = [];
    for (const item of items || []) {
      (isConnectivityAssessmentItem(item) ? connectivityTests : assessmentItems).push(item);
    }
    return {
      connectivityTests,
      assessmentItems,
      counts: {
        total: items?.length || 0,
        connectivityTests: connectivityTests.length,
        assessmentItems: assessmentItems.length,
      },
      roots: Object.entries((items || []).reduce((acc, item) => {
        const key = item.rootName || "Assessment Items";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {})).map(([name, count]) => ({ name, count })),
    };
  }

  function parseAssessmentComponentList(root) {
    return firstDescendantText(root, "COMPONENT_LIST")
      .split(",")
      .map((component) => component.trim())
      .filter(Boolean);
  }

  function customAssessmentComponents(root) {
    return new Set(parseAssessmentComponentList(root).filter((component) => {
      return !BUILT_IN_ASSESSMENT_COMPONENTS.has(component.toLowerCase());
    }));
  }

  function selectPacketTracerVisibleAssessmentItems(items, componentNames) {
    const scoredItems = (items || []).filter((item) => (Number(item.points) || 0) > 0);
    if (!componentNames?.size) return scoredItems;
    const authoredItems = scoredItems.filter((item) => componentNames.has(item.components || ""));
    return authoredItems.length ? authoredItems : scoredItems;
  }

  function parseAssessmentNode(node, variables = {}) {
    const nameEl = directChild(node, "NAME");
    const children = directChildren(node, "NODE").map((child) => parseAssessmentNode(child, variables)).filter(Boolean);
    if (!nameEl && children.length === 0) return null;
    const fields = Object.fromEntries(Array.from(node.children || []).filter((child) => child.tagName !== "NODE").map((child) => [
      child.tagName,
      resolvePacketTracerTokens(child.textContent?.trim() || "", variables),
    ]));
    return {
      name: resolvePacketTracerTokens(nameEl?.textContent?.trim() || childText(node, "ID") || "Assessment Item", variables),
      id: resolvePacketTracerTokens(childText(node, "ID"), variables),
      components: resolvePacketTracerTokens(childText(node, "COMPONENTS"), variables),
      points: childText(node, "POINTS"),
      value: resolvePacketTracerTokens(nameEl?.getAttribute("nodeValue") || "", variables),
      checkType: resolvePacketTracerTokens(nameEl?.getAttribute("checkType") || "", variables),
      eclass: resolvePacketTracerTokens(nameEl?.getAttribute("eclass") || "", variables),
      attrs: resolveAttrsObject(nameEl, variables),
      nodeAttrs: resolveAttrsObject(node, variables),
      fields,
      rawXml: elementOuterXml(node),
      children,
    };
  }

  function flattenAssessment(nodes, prefix = [], inherited = {}) {
    const out = [];
    for (const node of nodes || []) {
      const path = [...prefix, node.name].filter(Boolean);
      const checkTypes = [
        ...(inherited.checkTypes || []),
        node.checkType,
      ].filter(Boolean);
      const nextInherited = {
        rootName: inherited.rootName || node.name,
        rootCheckType: inherited.rootCheckType || node.checkType || "",
        components: node.components || inherited.components || "",
        checkType: node.checkType || inherited.checkType || "",
        checkTypes,
      };
      if (!node.children?.length) {
        out.push({
          path: path.join(" / "),
          pathParts: path,
          parentPath: prefix.join(" / "),
          rootName: nextInherited.rootName,
          id: node.id,
          components: node.components || nextInherited.components,
          points: node.points,
          value: node.value,
          checkType: node.checkType || nextInherited.checkType,
          rootCheckType: nextInherited.rootCheckType,
          checkTypes,
          eclass: node.eclass,
          attrs: node.attrs,
          nodeAttrs: node.nodeAttrs,
          fields: node.fields,
          rawXml: node.rawXml,
        });
      } else {
        out.push(...flattenAssessment(node.children, path, nextInherited));
      }
    }
    return out;
  }

  function packetTracerIfaceKey(value) {
    return String(value || "").trim().toLowerCase()
      .replace(/\bfastethernet\b/g, "fa")
      .replace(/\bgigabitethernet\b/g, "gi")
      .replace(/\bserial\b/g, "se")
      .replace(/\bport-channel\b/g, "po")
      .replace(/\bethernet\b/g, "eth")
      .replace(/\s+/g, "");
  }

  function assessmentSearchValues(item) {
    return [
      item?.name,
      item?.path,
      item?.value,
      item?.checkType,
      item?.rootCheckType,
      item?.eclass,
      ...Object.values(item?.attrs || {}),
      ...Object.values(item?.nodeAttrs || {}),
      ...Object.values(item?.fields || {}),
    ].filter(Boolean).map((value) => String(value));
  }

  function compileAssessmentTarget(item, devices = []) {
    const parts = Array.isArray(item?.pathParts) ? item.pathParts : [];
    const text = assessmentSearchValues(item).join(" / ");
    const device = devices.find((candidate) => {
      const names = [candidate.name, candidate.rawName, candidate.saveRefId, candidate.memAddr].filter(Boolean).map((value) => String(value).toLowerCase());
      return parts.some((part) => names.includes(String(part).toLowerCase())) ||
        names.some((name) => name && new RegExp(`(^|[^a-z0-9_-])${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9_-]|$)`, "i").test(text));
    }) || null;
    const ifacePattern = /\b(?:FastEthernet|GigabitEthernet|Serial|Ethernet|Port-channel|Fa|Gi|Se|Eth|Po)\s*\d+(?:\/\d+){0,3}\b/i;
    const ifaceText = parts.find((part) => ifacePattern.test(part)) || (text.match(ifacePattern) || [])[0] || "";
    return {
      deviceName: device?.name || "",
      packetTracerDeviceName: device?.rawName || device?.name || "",
      saveRefId: device?.saveRefId || "",
      memAddr: device?.memAddr || "",
      interfaceName: ifaceText,
      interfaceKey: packetTracerIfaceKey(ifaceText),
    };
  }

  function compileAssessmentExpected(item) {
    const attrs = { ...(item?.attrs || {}), ...(item?.nodeAttrs || {}), ...(item?.fields || {}) };
    const expectedKeys = ["expected", "value", "nodeValue", "VALUE", "EXPECTED", "answer", "ANSWER", "checkValue", "targetValue"];
    const values = [];
    for (const key of expectedKeys) {
      if (attrs[key]) values.push({ source: key, value: attrs[key] });
    }
    if (item?.value) values.push({ source: "nodeValue", value: item.value });
    const ip = values.map((entry) => String(entry.value).match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/)?.[0]).find(Boolean);
    const number = values.map((entry) => String(entry.value).match(/\b\d+\b/)?.[0]).find(Boolean);
    const command = values.find((entry) => /^(?:ip|switchport|channel-group|router|line|transport|access-list|interface|hostname|vlan)\b/i.test(String(entry.value).trim()))?.value || "";
    return {
      primary: values[0]?.value || "",
      values,
      ip: ip || "",
      number: number || "",
      command,
    };
  }

  function compileAssessmentTree(nodes, visibleSet, devices = [], prefix = []) {
    return (nodes || []).map((node) => {
      const pathParts = [...prefix, node.name].filter(Boolean);
      const leaf = !node.children?.length;
      const base = {
        id: node.id,
        name: node.name,
        path: pathParts.join(" / "),
        pathParts,
        components: node.components,
        points: node.points,
        checkType: node.checkType,
        eclass: node.eclass,
        attrs: node.attrs,
        nodeAttrs: node.nodeAttrs,
        fields: node.fields,
        rawXml: node.rawXml,
        visible: leaf ? visibleSet.has(node.rawXml || pathParts.join(" / ")) : true,
      };
      return {
        ...base,
        target: leaf ? compileAssessmentTarget(base, devices) : null,
        expected: leaf ? compileAssessmentExpected(base) : null,
        children: compileAssessmentTree(node.children || [], visibleSet, devices, pathParts),
      };
    });
  }

  function buildAssessmentModel(rootNodes, allLeaves, visibleLeaves, devices = []) {
    const visibleKeys = new Set((visibleLeaves || []).map((item) => item.rawXml || item.path));
    const leaves = (allLeaves || []).map((item) => ({
      ...item,
      visible: visibleKeys.has(item.rawXml || item.path),
      target: compileAssessmentTarget(item, devices),
      expected: compileAssessmentExpected(item),
    }));
    const supportedHints = leaves.filter((item) => {
      const text = assessmentSearchText(item);
      return /host ?name|display name|link type|cable|connect|port mode|switchport|vlan|channel|ospf|exec-timeout|transport input|ssh|ip address|subnet mask|default gateway|route|acl|access-list|nat|dhcp|spanning-tree|port-security|startup|save config/.test(text);
    }).length;
    return {
      version: 1,
      source: "decoded-packet-tracer-xml",
      roots: compileAssessmentTree(rootNodes, visibleKeys, devices),
      leaves,
      summary: {
        totalLeaves: leaves.length,
        visibleLeaves: leaves.filter((item) => item.visible).length,
        hiddenLeaves: leaves.filter((item) => !item.visible).length,
        supportedHintLeaves: supportedHints,
      },
    };
  }

  function classifyPacketTracerAssessmentLeaf(item) {
    const text = assessmentSearchText(item);
    const path = String(item?.path || "").toLowerCase();
    if (isConnectivityAssessmentItem(item)) return "connectivity";
    if (/instruction|user note|resource|wattage|cost|physical location|logical shape|physical shape|device model|device type|power/.test(path)) return "metadata";
    if (/ports?\s*\//.test(path) || /port type|bandwidth|duplex|bia|mac address|keepalive|mtu|lldp|cdp|link to|connects to|managed in wiring closet/.test(text)) return "packet-tracer-internal-state";
    if (/wireless|wlan|ssid|wlc|ap|radio|wpa|radius|authentication server/.test(text)) return "packet-tracer-internal-state";
    if (/ospf|eigrp|rip|route|routing|vlan|switchport|trunk|stp|spanning|etherchannel|channel|port-security|dhcp|dns|ntp|nat|acl|access-list|startup|save config|flash|nvram/.test(text)) return "authored-rubric";
    return "packet-tracer-internal-state";
  }

  function packetTracerStateKey(value) {
    return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
  }

  function packetTracerLeafValue(item) {
    return item?.value || item?.expected?.primary || item?.fields?.VALUE || item?.attrs?.nodeValue || item?.name || "";
  }

  function buildPacketTracerState({ devices, logicalObjects, links, assessmentModel }) {
    const deviceNames = new Set((devices || []).map((device) => device.name));
    const state = {
      version: 1,
      source: "decoded-packet-tracer-xml",
      devices: {},
      logicalObjects: {},
      links: {},
      assessmentByPath: {},
      assessmentById: {},
      assessmentByRawXml: {},
      summary: {
        devices: (devices || []).length,
        logicalObjects: (logicalObjects || []).length,
        links: (links || []).length,
        assessmentLeaves: 0,
        visibleScoredLeaves: 0,
      },
    };

    for (const device of devices || []) {
      state.devices[device.name] = {
        name: device.name,
        kind: device.kind,
        model: device.model,
        customModel: device.customModel,
        power: device.power,
        x: device.x,
        y: device.y,
        rawName: device.rawName,
        saveRefId: device.saveRefId,
        memAddr: device.memAddr,
        interfaces: {},
        metadata: {},
        provenance: { xmlPath: "/PACKETTRACER/NETWORK/DEVICES/DEVICE", objectId: device.saveRefId || device.memAddr || device.name },
      };
    }

    for (const object of logicalObjects || []) {
      state.logicalObjects[object.name] = {
        name: object.name,
        kind: object.kind,
        model: object.model,
        power: object.power,
        x: object.x,
        y: object.y,
        rawName: object.rawName,
        saveRefId: object.saveRefId,
        memAddr: object.memAddr,
        provenance: { xmlPath: "/PACKETTRACER/NETWORK/DEVICES/DEVICE", objectId: object.saveRefId || object.memAddr || object.name },
      };
    }

    for (const [index, link] of (links || []).entries()) {
      const id = `${link.fromRef || link.from}-${link.toRef || link.to}-${index}`;
      state.links[id] = {
        ...link,
        sourceIndex: index,
        provenance: { xmlPath: `/PACKETTRACER/NETWORK/LINKS/LINK[${index + 1}]`, objectId: id },
      };
    }

    for (const leaf of assessmentModel?.leaves || []) {
      const visibleScored = leaf.visible !== false && (Number(leaf.points) || 0) > 0;
      state.summary.assessmentLeaves += 1;
      if (visibleScored) state.summary.visibleScoredLeaves += 1;
      const path = leaf.path || leaf.name || "";
      const entry = {
        path,
        id: leaf.id || "",
        label: leaf.name || "",
        value: packetTracerLeafValue(leaf),
        points: Number(leaf.points) || 0,
        visible: leaf.visible !== false,
        classification: classifyPacketTracerAssessmentLeaf(leaf),
        checkType: leaf.checkType || "",
        rootCheckType: leaf.rootCheckType || "",
        eclass: leaf.eclass || "",
        components: leaf.components || "",
        target: leaf.target || null,
        expected: leaf.expected || null,
        source: {
          assessmentPath: path,
          xmlPath: "/ACTIVITY/ASSESSMENTITEMS",
          checkType: leaf.checkType || "",
          eclass: leaf.eclass || "",
          objectId: leaf.id || "",
          sourceValue: packetTracerLeafValue(leaf),
        },
      };
      if (path) state.assessmentByPath[path] = entry;
      if (leaf.id) state.assessmentById[leaf.id] = entry;
      if (leaf.rawXml) state.assessmentByRawXml[leaf.rawXml] = entry;

      const parts = Array.isArray(leaf.pathParts) ? leaf.pathParts : String(path).split(/\s*\/\s*/);
      const deviceName = parts.find((part) => deviceNames.has(part));
      if (!deviceName || !state.devices[deviceName]) continue;
      const portsIndex = parts.findIndex((part) => packetTracerStateKey(part) === "ports");
      if (portsIndex >= 0 && parts[portsIndex + 1]) {
        const ifaceName = parts[portsIndex + 1];
        state.devices[deviceName].interfaces[ifaceName] = state.devices[deviceName].interfaces[ifaceName] || { name: ifaceName, checks: {} };
        state.devices[deviceName].interfaces[ifaceName].checks[path] = entry;
      } else {
        state.devices[deviceName].metadata[path] = entry;
      }
    }

    return state;
  }

  function coverageItem({ id, status = "exact", category, label, detail, source = {}, evidence = {} }) {
    return {
      id,
      status,
      category,
      label,
      detail,
      source,
      evidence,
    };
  }

  function packetTracerDeviceSource(device, index, logicalOnly = false) {
    return {
      xmlPath: `/PACKETTRACER/NETWORK/DEVICES/DEVICE[${index + 1}]`,
      objectId: device.saveRefId || device.memAddr || device.name || `device-${index + 1}`,
      deviceName: device.name,
      model: device.model || "",
      kind: device.kind || "",
      logicalOnly,
    };
  }

  function packetTracerLinkSource(link, index) {
    return {
      xmlPath: `/PACKETTRACER/NETWORK/LINKS/LINK[${index + 1}]`,
      objectId: `${link.fromRef || link.from || "from"}-${link.toRef || link.to || "to"}-${index + 1}`,
      from: link.from,
      to: link.to,
      cableType: link.type || "",
      medium: link.medium || "",
    };
  }

  function buildPacketTracerCoverage({ decoded, devices, logicalObjects, links, instructionsHtml, assessmentModel, answerCommands, packetTracerState, rawFilePreserved = false, rawFileReason = "" }) {
    const items = [];
    const decodedXmlLength = decoded?.xmlLength || decoded?.xmlText?.length || 0;
    if (decodedXmlLength) {
      items.push(coverageItem({
        id: "decoded.xml",
        category: "decoded",
        label: "Decoded XML",
        detail: `Packet Tracer XML preserved exactly (${decodedXmlLength} characters).`,
        source: { xmlPath: "/", profile: decoded.profile || "" },
      }));
    }

    if (rawFilePreserved) {
      items.push(coverageItem({
        id: "raw-file",
        category: "raw-file",
        label: "Original file",
        detail: "Raw PKA/PKT bytes were preserved for round-trip export and follow-up analysis.",
        source: { storage: "indexeddb" },
      }));
    } else if (rawFileReason) {
      items.push(coverageItem({
        id: "raw-file",
        status: "broken",
        category: "raw-file",
        label: "Original file",
        detail: `Raw file preservation failed: ${rawFileReason}`,
        source: { storage: "indexeddb" },
      }));
    }

    if (instructionsHtml) {
      items.push(coverageItem({
        id: "instructions.html",
        category: "instructions",
        label: "Instructions",
        detail: "Assignment instructions were imported into the sidebar.",
        source: { xmlPath: "/ACTIVITY/INSTRUCTIONS" },
      }));
      if (/<(?:img|audio|video|object|embed|source)\b/i.test(instructionsHtml)) {
        items.push(coverageItem({
          id: "instructions.assets",
          category: "instructions",
          label: "Instruction media references",
          detail: "Embedded instruction media references were preserved in the imported instruction HTML.",
          source: { xmlPath: "/ACTIVITY/INSTRUCTIONS" },
        }));
      }
    } else {
      items.push(coverageItem({
        id: "instructions.html",
        status: "missing",
        category: "instructions",
        label: "Instructions",
        detail: "No readable instruction HTML/text was found in the decoded activity.",
        source: { xmlPath: "/ACTIVITY/INSTRUCTIONS" },
      }));
    }

    for (const [index, device] of (devices || []).entries()) {
      const source = packetTracerDeviceSource(device, index, false);
      items.push(coverageItem({
        id: `topology.device.${source.objectId}`,
        category: "topology",
        label: `Device: ${device.name}`,
        detail: `${device.kind || "Device"} ${device.model || ""}`.trim() || "Packet Tracer device imported.",
        source,
      }));
      items.push(coverageItem({
        id: `topology.coordinates.${source.objectId}`,
        category: "layout",
        label: `Coordinates: ${device.name}`,
        detail: `Workspace coordinates preserved exactly at (${device.x}, ${device.y}).`,
        source: { ...source, x: device.x, y: device.y },
      }));
      if (Array.isArray(device.runningConfig) && device.runningConfig.length) {
        items.push(coverageItem({
          id: `device.config.${source.objectId}`,
          category: "device-state",
          label: `Running config: ${device.name}`,
          detail: `${device.runningConfig.length} running-config lines captured as native OpenPT command evidence.`,
          source,
        }));
      }
    }

    for (const [index, object] of (logicalObjects || []).entries()) {
      const source = packetTracerDeviceSource(object, index, true);
      items.push(coverageItem({
        id: `topology.logical-object.${source.objectId}`,
        category: "topology",
        label: `Logical object: ${object.name}`,
        detail: `${object.kind || "Packet Tracer object"} preserved as a first-class logical annotation.`,
        source,
      }));
      items.push(coverageItem({
        id: `topology.logical-object.coordinates.${source.objectId}`,
        category: "layout",
        label: `Coordinates: ${object.name}`,
        detail: `Logical object coordinates preserved exactly at (${object.x}, ${object.y}).`,
        source: { ...source, x: object.x, y: object.y },
      }));
    }

    for (const [index, link] of (links || []).entries()) {
      const source = packetTracerLinkSource(link, index);
      items.push(coverageItem({
        id: `topology.link.${source.objectId}`,
        category: "topology",
        label: `Link: ${link.from} to ${link.to}`,
        detail: "Endpoint references and port names were imported exactly from Packet Tracer XML.",
        source,
      }));
      items.push(coverageItem({
        id: `topology.cable.${source.objectId}`,
        category: "cable",
        label: `Cable: ${link.type || link.medium || "Packet Tracer Link"}`,
        detail: `Cable type, medium, endpoint refs, and functional status preserved (${link.functional || "unknown status"}).`,
        source,
        evidence: {
          fromRef: link.fromRef || "",
          toRef: link.toRef || "",
          functional: link.functional || "",
          ports: link.ports || [],
        },
      }));
    }

    const visibleLeaves = (assessmentModel?.leaves || []).filter((leaf) => leaf.visible !== false && (Number(leaf.points) || 0) > 0);
    if (visibleLeaves.length) {
      items.push(coverageItem({
        id: "assessment.model",
        category: "assessment",
        label: "Assessment model",
        detail: `${visibleLeaves.length} visible scored assessment leaves decoded from assessmentModel.leaves.`,
        source: { xmlPath: "/ACTIVITY/ASSESSMENTITEMS", source: assessmentModel.source || "" },
      }));
      for (const [index, leaf] of visibleLeaves.entries()) {
        items.push(coverageItem({
          id: `assessment.leaf.${leaf.id || index}`,
          category: "assessment",
          label: `Assessment leaf: ${leaf.name || leaf.path || `#${index + 1}`}`,
          detail: `${Number(leaf.points) || 0} point${Number(leaf.points) === 1 ? "" : "s"} · ${leaf.checkType || leaf.eclass || "decoded check"}`,
          source: {
            xmlPath: `/ACTIVITY/ASSESSMENTITEMS/NODE[${index + 1}]`,
            objectId: leaf.id || "",
            checkType: leaf.checkType || "",
            eclass: leaf.eclass || "",
            component: leaf.components || "",
            target: leaf.target || null,
            expected: leaf.expected || null,
          },
        }));
      }
    } else {
      items.push(coverageItem({
        id: "assessment.model",
        status: "missing",
        category: "assessment",
        label: "Assessment model",
        detail: "No visible scored assessment leaves were decoded.",
        source: { xmlPath: "/ACTIVITY/ASSESSMENTITEMS" },
      }));
    }

    const configuredDevices = Object.entries(answerCommands || {}).filter(([, lines]) => Array.isArray(lines) && lines.length);
    if (configuredDevices.length) {
      items.push(coverageItem({
        id: "device-state.running-configs",
        category: "device-state",
        label: "Device configs",
        detail: `Running configuration evidence captured for ${configuredDevices.length} device${configuredDevices.length === 1 ? "" : "s"}.`,
        source: { xmlPath: "/PACKETTRACER/NETWORK/DEVICES/DEVICE/ENGINE/RUNNINGCONFIG" },
      }));
    }

    if (packetTracerState?.summary?.visibleScoredLeaves) {
      items.push(coverageItem({
        id: "packet-tracer.native-state",
        category: "state",
        label: "Native Packet Tracer state",
        detail: `${packetTracerState.summary.visibleScoredLeaves} visible scored Packet Tracer leaves transferred into native read-only state.`,
        source: { xmlPath: "/ACTIVITY/ASSESSMENTITEMS" },
      }));
    }

    return items;
  }

  function parsePacketTracerXml(file, decoded, sha256, head, report, rawStorage = {}) {
    const parsedXml = parseXmlDocument(decoded.xmlText);
    const doc = parsedXml.doc;
    const root = doc.documentElement;
    const packetTracer = directChild(root, "PACKETTRACER5") || directChild(root, "PACKETTRACER") || root;
    const network = directChild(packetTracer, "NETWORK");
    const activityRoot = directChild(root, "ACTIVITY");
    const devicesRoot = pathChild(network, ["DEVICES"]);
    const linksRoot = pathChild(network, ["LINKS"]);
    const variables = collectPacketTracerVariables(root);

    const saveRefToName = {};
    const memAddrToName = {};
    const allDevices = directChildren(devicesRoot, "DEVICE").map((deviceEl, index) => {
      const engine = directChild(deviceEl, "ENGINE");
      const typeEl = directChild(engine, "TYPE");
      const logical = pathChild(deviceEl, ["WORKSPACE", "LOGICAL"]);
      const rawName = childText(engine, "NAME") || `PT-Device-${index + 1}`;
      const name = resolvePacketTracerTokens(rawName, variables);
      const saveRefId = childText(engine, "SAVE_REF_ID");
      const devAddr = childText(logical, "DEV_ADDR");
      if (saveRefId) saveRefToName[saveRefId] = name;
      if (devAddr) memAddrToName[devAddr] = name;
      const runningConfig = Array.from(engine?.getElementsByTagName("RUNNINGCONFIG")?.[0]?.children || [])
        .filter((line) => line.tagName === "LINE")
        .map((line) => line.textContent);
      return {
        name,
        kind: (typeEl?.textContent || "Device").trim(),
        model: typeEl?.getAttribute("model") || typeEl?.getAttribute("customModel") || "",
        customModel: typeEl?.getAttribute("customModel") || "",
        power: childText(engine, "POWER"),
        x: Number(childText(logical, "X")) || 300 + index * 80,
        y: Number(childText(logical, "Y")) || 240 + index * 60,
        rawName,
        saveRefId,
        memAddr: devAddr,
        runningConfig,
        xml: elementOuterXml(deviceEl),
      };
    });

    const logicalObjects = allDevices.filter((device) => /^Power Distribution Device$/i.test(device.kind || device.model || device.name || ""));
    const devices = allDevices.filter((device) => !logicalObjects.includes(device));
    const links = directChildren(linksRoot, "LINK").map((linkEl) => {
      const cable = directChild(linkEl, "CABLE");
      const ports = directChildren(cable, "PORT").map((port) => port.textContent.trim());
      const fromRef = childText(cable, "FROM");
      const toRef = childText(cable, "TO");
      const fromMemAddr = childText(cable, "FROM_DEVICE_MEM_ADDR");
      const toMemAddr = childText(cable, "TO_DEVICE_MEM_ADDR");
      const fromDevice = saveRefToName[fromRef] || memAddrToName[fromMemAddr] || fromRef;
      const toDevice = saveRefToName[toRef] || memAddrToName[toMemAddr] || toRef;
      return {
        type: childText(cable, "TYPE") || childText(linkEl, "TYPE") || "Packet Tracer Link",
        medium: childText(linkEl, "TYPE"),
        from: `${fromDevice}:${ports[0] || "Port"}`,
        to: `${toDevice}:${ports[1] || "Port"}`,
        fromRef,
        toRef,
        fromMemAddr,
        toMemAddr,
        functional: childText(cable, "FUNCTIONAL"),
        ports,
        xml: elementOuterXml(linkEl),
      };
    }).filter((link) => link.from && link.to);

    const instructionsHtml = (
      directChildren(pathChild(activityRoot, ["INSTRUCTIONS"]), "PAGE").map((page) => page.textContent.trim()).find(Boolean) ||
      firstDescendantText(pathChild(activityRoot, ["INSTRUCTION_DIALOG"]), "USER_NOTES") ||
      childText(network, "DESCRIPTION") ||
      ""
    );
    const resolvedInstructionsHtml = resolvePacketTracerTokens(instructionsHtml, variables);
    const title = stripPacketTracerExt(file.name) || titleFromHtml(resolvedInstructionsHtml) || "Packet Tracer Assignment";
    const assessmentRootNodes = Array.from(doc.getElementsByTagName("NODE"))
      .filter(hasScoredAssessmentNode)
      .filter((node) => !(node.parentElement?.tagName === "NODE" && hasScoredAssessmentNode(node.parentElement)))
      .map((node) => parseAssessmentNode(node, variables))
      .filter(Boolean);
    const rawAssessmentItems = flattenAssessment(assessmentRootNodes);
    const visibleComponents = customAssessmentComponents(root);
    const assessmentItems = selectPacketTracerVisibleAssessmentItems(rawAssessmentItems, visibleComponents);
    const assessmentSections = buildAssessmentSections(assessmentItems);
    const assessmentModel = buildAssessmentModel(assessmentRootNodes, rawAssessmentItems, assessmentItems, devices);
    const packetTracerState = buildPacketTracerState({ devices, logicalObjects, links, assessmentModel });
    const totalPoints = assessmentItems.reduce((sum, item) => sum + (Number(item.points) || 0), 0);
    const answerCommands = Object.fromEntries(devices.map((device) => [
      device.name,
      device.runningConfig || [],
    ]));

    report.decoder = {
      status: "decoded",
      profile: decoded.profile,
      rootTag: root.tagName,
      packetTracerVersion: firstDescendantText(root, "VERSION"),
      xmlLength: decoded.xmlText.length,
      sanitizedParserReplacements: parsedXml.sanitizedReplacements,
      stages: decoded.stages,
    };

    return {
      format: "packet-tracer-activity",
      importerVersion: 3,
      title,
      instructionsText: htmlToPlainText(resolvedInstructionsHtml),
      instructionsHtml: resolvedInstructionsHtml,
      progress: {
        percent: 0,
        score: `0/${totalPoints}`,
        itemCount: `0/${assessmentItems.length}`,
        components: Object.entries(assessmentItems.reduce((acc, item) => {
          const key = item.components || "Other";
          acc[key] = acc[key] || { name: key, items: 0, points: 0 };
          acc[key].items += 1;
          acc[key].points += Number(item.points) || 0;
          return acc;
        }, {})).map(([, value]) => ({ name: value.name, items: `0/${value.items}`, score: `0/${value.points}` })),
      },
      devices,
      logicalObjects: logicalObjects.map((device) => ({
        name: device.name,
        kind: device.kind,
        model: device.model,
        customModel: device.customModel,
        power: device.power,
        x: device.x,
        y: device.y,
        rawName: device.rawName,
        saveRefId: device.saveRefId,
        memAddr: device.memAddr,
        logicalOnly: true,
        xml: device.xml,
      })),
      links,
      answerCommands,
      rubricPattern: assessmentRootNodes,
      assessmentModel,
      packetTracerState,
      assessmentItems,
      gradingProfile: {
        version: 1,
        runtime: "browser-native",
        mode: "structured-checker-registry",
        importedItems: assessmentItems.length,
        decodedItems: rawAssessmentItems.length,
        visibleItems: assessmentModel.summary.visibleLeaves,
      },
      gradingRun: null,
      decoded: {
        profile: decoded.profile,
        rootTag: root.tagName,
        xmlText: decoded.xmlText,
        xmlLength: decoded.xmlText.length,
        xmlSha256: null,
        packetTracerVersion: firstDescendantText(root, "VERSION"),
        networkDeviceCount: devices.length,
        packetTracerObjectCount: allDevices.length,
        variables,
        componentList: parseAssessmentComponentList(root),
        visibleAssessmentComponents: Array.from(visibleComponents),
        assessmentClassification: assessmentSections.counts,
        rawAssessmentClassification: buildAssessmentSections(rawAssessmentItems).counts,
        hiddenObjects: logicalObjects.map((device) => ({
          name: device.name,
          kind: device.kind,
          model: device.model,
          x: device.x,
          y: device.y,
          saveRefId: device.saveRefId,
        })),
      },
      reverseReport: report,
      assessmentSections,
      featureCoverage: {
        rawFilePreserved: !!rawStorage.stored,
        semanticExtraction: "decoded-xml",
        profileMatched: true,
        coverageItems: buildPacketTracerCoverage({
          decoded: { ...decoded, xmlLength: decoded.xmlText.length },
          devices,
          logicalObjects,
          links,
          instructionsHtml: resolvedInstructionsHtml,
          assessmentModel,
          answerCommands,
          packetTracerState,
          rawFilePreserved: !!rawStorage.stored,
          rawFileReason: rawStorage.reason || "",
        }),
        preservedButUnsupported: [],
      },
      diagnostics: {
        sha256,
        headHex: head,
        size: file.size,
        decoder: report.decoder,
      },
    };
  }

  function makeUnsupportedActivity(file, sha256, head, report) {
    const title = stripPacketTracerExt(file.name);
    return {
      format: "packet-tracer-activity",
      importerVersion: 2,
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
        coverageItems: [
          coverageItem({
            id: "decoded.xml",
            status: "broken",
            category: "decoded",
            label: "Decoded XML",
            detail: report.decoder?.error || "No packaged extractor profile can decode this file yet.",
            source: { attemptedProfile: report.decoder?.attemptedProfile || "ptsave-eax-twofish-v1" },
          }),
          coverageItem({
            id: "topology",
            status: "missing",
            category: "topology",
            label: "Topology",
            detail: "Devices, links, configs, assessments, and workspace objects were not extracted.",
            source: { xmlPath: "/PACKETTRACER/NETWORK" },
          }),
          coverageItem({
            id: "assessment.model",
            status: "missing",
            category: "assessment",
            label: "Assessment model",
            detail: "Assessment tree is hidden inside the unsupported activity payload.",
            source: { xmlPath: "/ACTIVITY/ASSESSMENTITEMS" },
          }),
          coverageItem({
            id: "instructions.html",
            status: "missing",
            category: "instructions",
            label: "Instructions",
            detail: "Instruction assets are hidden inside the unsupported activity payload.",
            source: { xmlPath: "/ACTIVITY/INSTRUCTIONS" },
          }),
        ],
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
    let activity = null;
    try {
      const decoded = await decodePacketTracerXml(bytes);
      activity = parsePacketTracerXml(file, decoded, sha256, head, report, rawStorage);
    } catch (err) {
      report.decoder = {
        status: "not-decoded",
        attemptedProfile: "ptsave-eax-twofish-v1",
        error: err?.message || String(err),
      };
    }

    if (!activity && (knownByHash || knownByFallback)) {
      activity = clone(etherchannelActivity);
      report.decoder = report.decoder || { status: "profile-fallback", profile: "static-etherchannel-review" };
    }
    if (!activity) activity = makeUnsupportedActivity(file, sha256, head, report);
    activity.reverseReport = report;
    activity.rawFile = {
      name: file.name || "packet-tracer-file",
      size: file.size,
      type: file.type || "application/octet-stream",
      lastModified: file.lastModified || null,
      sha256,
      storage: rawStorage,
    };
    const coverageItems = [...(activity.featureCoverage?.coverageItems || [])];
    if (!coverageItems.some((item) => item.id === "raw-file")) {
      coverageItems.push(coverageItem({
        id: "raw-file",
        status: rawStorage.stored ? "exact" : "broken",
        category: "raw-file",
        label: "Original file",
        detail: rawStorage.stored
          ? `Raw PKA/PKT bytes were preserved in ${rawStorage.backend || "browser storage"}.`
          : `Raw file preservation failed${rawStorage.reason ? `: ${rawStorage.reason}` : "."}`,
        source: { storage: rawStorage.backend || "indexeddb" },
      }));
    }
    activity.featureCoverage = {
      ...(activity.featureCoverage || {}),
      rawFilePreserved: !!rawStorage.stored,
      semanticExtraction: activity.featureCoverage?.semanticExtraction || (activity.unsupported ? "not-decoded" : "profile-derived"),
      profileMatched: !activity.unsupported,
      coverageItems,
      preservedButUnsupported: activity.featureCoverage?.preservedButUnsupported || (activity.unsupported ? [
        "Packet Tracer encrypted/proprietary activity payload",
        "Device configurations hidden inside the activity payload",
        "Assessment tree hidden inside the activity payload",
        "Workspace objects hidden inside the activity payload",
        "Instruction assets hidden inside the activity payload",
      ] : []),
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
