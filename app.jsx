// app.jsx — OpenPT main application

const { useState, useEffect, useRef, useMemo } = React;
const Topology = window.Topology;
const CLI = window.CLI;
const Inspector = window.Inspector;
const Icon = window.Icon;
const Glyph = window.Glyph;
const DeviceCatalog = window.DeviceCatalog;
const OPT_Engine = window.OPT_Engine;
const PacketTracerImporter = window.PacketTracerImporter;
const useTweaks = window.useTweaks;
const TweaksPanel = window.TweaksPanel;
const TweakSection = window.TweakSection;
const TweakSlider = window.TweakSlider;
const TweakToggle = window.TweakToggle;
const TweakColor = window.TweakColor;
const TweakButton = window.TweakButton;
const ifaceName = (name) => OPT_Engine.shortIfaceName ? OPT_Engine.shortIfaceName(name) : name;
const ifaceText = (text) => OPT_Engine.shortIfaceNamesInText ? OPT_Engine.shortIfaceNamesInText(text) : text;

function deviceLabel(device, fallback = "device") {
  return device?.hostname || device?.name || device?.model || device?.id || fallback;
}

function linkLabel(link, devices) {
  const a = devices?.[link?.a];
  const b = devices?.[link?.b];
  const left = `${deviceLabel(a, "device")} ${ifaceName(link?.ai || "")}`.trim();
  const right = `${deviceLabel(b, "device")} ${ifaceName(link?.bi || "")}`.trim();
  return `${left} to ${right}${link?.type ? ` (${link.type})` : ""}`;
}

function withoutPosition(device) {
  if (!device) return device;
  const { x, y, ...rest } = device;
  return rest;
}

function sameJson(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function plural(count, one, many = `${one}s`) {
  return `${count} ${count === 1 ? one : many}`;
}

function describeTopologyChange(before = {}, after = {}) {
  const beforeDevices = before.devices || {};
  const afterDevices = after.devices || {};
  const beforeLinks = before.links || [];
  const afterLinks = after.links || [];
  const beforeLinkMap = Object.fromEntries(beforeLinks.map((link) => [link.id, link]));
  const afterLinkMap = Object.fromEntries(afterLinks.map((link) => [link.id, link]));
  const addedDeviceIds = Object.keys(afterDevices).filter((id) => !beforeDevices[id]);
  const removedDeviceIds = Object.keys(beforeDevices).filter((id) => !afterDevices[id]);
  const addedLinkIds = afterLinks.map((link) => link.id).filter((id) => !beforeLinkMap[id]);
  const removedLinkIds = beforeLinks.map((link) => link.id).filter((id) => !afterLinkMap[id]);
  const changedDeviceIds = Object.keys(afterDevices).filter((id) => beforeDevices[id] && !sameJson(beforeDevices[id], afterDevices[id]));
  const changedLinkIds = afterLinks
    .filter((link) => beforeLinkMap[link.id] && !sameJson(beforeLinkMap[link.id], link))
    .map((link) => link.id);
  const beforeCount = Object.keys(beforeDevices).length + beforeLinks.length;
  const afterCount = Object.keys(afterDevices).length + afterLinks.length;

  if (!beforeCount && afterCount) return `created topology with ${plural(Object.keys(afterDevices).length, "device")} and ${plural(afterLinks.length, "cable")}`;
  if (beforeCount && !afterCount) return "cleared topology";

  if (addedDeviceIds.length === 1 && !removedDeviceIds.length && !addedLinkIds.length && !removedLinkIds.length) {
    const d = afterDevices[addedDeviceIds[0]];
    return `added ${d?.model || d?.kind || "device"} ${deviceLabel(d)}`;
  }
  if (removedDeviceIds.length === 1 && !addedDeviceIds.length) {
    const d = beforeDevices[removedDeviceIds[0]];
    const cableText = removedLinkIds.length ? ` and ${plural(removedLinkIds.length, "cable")}` : "";
    return `removed ${deviceLabel(d)}${cableText}`;
  }
  if (addedLinkIds.length === 1 && !removedLinkIds.length && !addedDeviceIds.length && !removedDeviceIds.length && !changedLinkIds.length) {
    return `wired ${linkLabel(afterLinkMap[addedLinkIds[0]], afterDevices)}`;
  }
  if (removedLinkIds.length === 1 && !addedLinkIds.length && !addedDeviceIds.length && !removedDeviceIds.length && !changedLinkIds.length) {
    return `removed cable ${linkLabel(beforeLinkMap[removedLinkIds[0]], beforeDevices)}`;
  }

  const onlyDeviceChanges = !addedDeviceIds.length && !removedDeviceIds.length && !addedLinkIds.length && !removedLinkIds.length && !changedLinkIds.length;
  if (onlyDeviceChanges && changedDeviceIds.length === 1) {
    const id = changedDeviceIds[0];
    const prev = beforeDevices[id];
    const next = afterDevices[id];
    if (prev.hostname !== next.hostname) return `renamed ${deviceLabel(prev)} to ${deviceLabel(next)}`;
    if (prev.powered !== next.powered) return `${deviceLabel(next)} power ${next.powered ? "on" : "off"}`;
    if ((prev.x !== next.x || prev.y !== next.y) && sameJson(withoutPosition(prev), withoutPosition(next))) return `moved ${deviceLabel(next)}`;
    return `updated ${deviceLabel(next)}`;
  }
  if (onlyDeviceChanges && changedDeviceIds.length > 1) {
    const movedOnly = changedDeviceIds.every((id) => {
      const prev = beforeDevices[id];
      const next = afterDevices[id];
      return (prev.x !== next.x || prev.y !== next.y) && sameJson(withoutPosition(prev), withoutPosition(next));
    });
    return movedOnly ? `moved ${plural(changedDeviceIds.length, "device")}` : `updated ${plural(changedDeviceIds.length, "device")}`;
  }

  const parts = [];
  if (addedDeviceIds.length) parts.push(`added ${plural(addedDeviceIds.length, "device")}`);
  if (removedDeviceIds.length) parts.push(`removed ${plural(removedDeviceIds.length, "device")}`);
  if (addedLinkIds.length) parts.push(`added ${plural(addedLinkIds.length, "cable")}`);
  if (removedLinkIds.length) parts.push(`removed ${plural(removedLinkIds.length, "cable")}`);
  if (changedDeviceIds.length) parts.push(`updated ${plural(changedDeviceIds.length, "device")}`);
  if (changedLinkIds.length) parts.push(`updated ${plural(changedLinkIds.length, "cable")}`);
  return parts.length ? parts.join(", ") : "changed topology";
}

function packetTracerKind(device) {
  const text = `${device?.kind || ""} ${device?.model || ""} ${device?.name || ""}`.toLowerCase();
  if (text.includes("2960")) return "l2switch";
  if (text.includes("3560")) return "l3switch";
  if (text.includes("2911") || text.includes("1941") || text.includes("4321") || text.includes("4331")) return "router";
  if (text.includes("laptop")) return "laptop";
  if (text.includes("printer")) return "printer";
  if (text.includes("phone")) return "phone";
  if (text.includes("wrt300n")) return "wrt";
  if (text.includes("asa")) return "asa";
  if (text.includes("dsl")) return "dslmodem";
  if (text.includes("cable")) return "cablemodem";
  if (text.includes("internet")) return "internet";
  if (text.includes("router")) return "router";
  if (text.includes("server")) return "server";
  if (text.includes("mac")) return "mac";
  if (text.includes("pc")) return "pc";
  if (text.includes("switch") || /^sw/i.test(device?.name || "")) return "l2switch";
  return device?.kind || "l2switch";
}

function packetTracerPlatform(device) {
  const text = `${device?.kind || ""} ${device?.model || ""} ${device?.name || ""}`.toLowerCase();
  if (text.includes("2960")) return "2960-24tt";
  if (text.includes("3560")) return "3560-24ps";
  if (text.includes("2911")) return "2911";
  if (text.includes("1941")) return "1941";
  if (text.includes("4331")) return "isr4331";
  if (text.includes("4321")) return "isr4321";
  if (text.includes("wrt300n")) return "wrt300n";
  if (text.includes("asa")) return "asa5506x";
  if (text.includes("laptop")) return "laptop";
  if (text.includes("printer")) return "printer";
  if (text.includes("phone")) return "ipphone";
  if (text.includes("server")) return "genericServer";
  if (text.includes("mac")) return "mac";
  if (text.includes("dsl")) return "dslmodem";
  if (text.includes("cable")) return "cablemodem";
  if (text.includes("internet")) return "internet";
  return null;
}

function packetTracerEndpoint(endpoint) {
  const [deviceName, ...ifaceParts] = String(endpoint || "").split(":");
  return { deviceName, iface: ifaceParts.join(":") };
}

function packetTracerIfaceSeed(kind, name, deviceName) {
  const isSwitch = kind === "l2switch" || kind === "l3switch" || kind === "wrt";
  const iface = {
    ip: null,
    mask: null,
    gw: null,
    up: true,
    admUp: true,
    mac: randMac(),
    desc: `imported from ${deviceName}`,
  };
  if (isSwitch && !String(name).toLowerCase().startsWith("vlan")) {
    iface.mode = "trunk";
    iface.vlan = 1;
    iface.nativeVlan = 1;
    iface.allowedVlans = "all";
    iface.stp = { portfast: false, bpduguard: false, state: "forwarding" };
  }
  return iface;
}

function improvePacketTracerImportLayout(devices, links) {
  const list = Object.values(devices || {});
  if (list.length < 2) return devices;

  const desiredGap = 148;
  const minGap = 118;
  const bounds = list.reduce((box, d) => ({
    minX: Math.min(box.minX, Number(d.x) || 0),
    minY: Math.min(box.minY, Number(d.y) || 0),
    maxX: Math.max(box.maxX, Number(d.x) || 0),
    maxY: Math.max(box.maxY, Number(d.y) || 0),
  }), { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity });
  const cx = (bounds.minX + bounds.maxX) / 2;
  const cy = (bounds.minY + bounds.maxY) / 2;

  const nearestDistances = list.map((a) => {
    let nearest = Infinity;
    for (const b of list) {
      if (a.id === b.id) continue;
      nearest = Math.min(nearest, Math.hypot((Number(a.x) || 0) - (Number(b.x) || 0), (Number(a.y) || 0) - (Number(b.y) || 0)));
    }
    return nearest;
  }).filter(Number.isFinite).sort((a, b) => a - b);
  const medianNearest = nearestDistances[Math.floor(nearestDistances.length / 2)] || desiredGap;
  const compactSpan = (bounds.maxX - bounds.minX) < 220 && (bounds.maxY - bounds.minY) < 180;
  const scale = Math.max(1, Math.min(2.2, desiredGap / Math.max(1, medianNearest), compactSpan ? 1.45 : 1));

  let next = Object.fromEntries(list.map((d, index) => {
    const angle = (index / Math.max(1, list.length)) * Math.PI * 2;
    const sameSpotNudge = medianNearest < 4 ? { x: Math.cos(angle) * desiredGap, y: Math.sin(angle) * desiredGap } : { x: 0, y: 0 };
    return [d.id, {
      ...d,
      x: cx + ((Number(d.x) || cx) - cx) * scale + sameSpotNudge.x,
      y: cy + ((Number(d.y) || cy) - cy) * scale + sameSpotNudge.y,
    }];
  }));

  const neighborPairs = new Set((links || []).map((l) => [l.a, l.b].filter(Boolean).sort().join(":")));
  for (let pass = 0; pass < 18; pass++) {
    const moved = {};
    const values = Object.values(next);
    for (let i = 0; i < values.length; i++) {
      for (let j = i + 1; j < values.length; j++) {
        const a = values[i], b = values[j];
        const key = [a.id, b.id].sort().join(":");
        const target = neighborPairs.has(key) ? minGap : desiredGap;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy);
        if (dist >= target) continue;
        if (dist < 1) {
          const angle = ((i + j + 1) * 2.399963229728653) % (Math.PI * 2);
          dx = Math.cos(angle);
          dy = Math.sin(angle);
          dist = 1;
        }
        const push = (target - dist) * 0.5;
        const ux = dx / dist;
        const uy = dy / dist;
        moved[a.id] = moved[a.id] || { x: 0, y: 0 };
        moved[b.id] = moved[b.id] || { x: 0, y: 0 };
        moved[a.id].x -= ux * push;
        moved[a.id].y -= uy * push;
        moved[b.id].x += ux * push;
        moved[b.id].y += uy * push;
      }
    }
    for (const [id, delta] of Object.entries(moved)) {
      next[id] = { ...next[id], x: next[id].x + delta.x, y: next[id].y + delta.y };
    }
  }

  const finalValues = Object.values(next);
  const finalMinX = Math.min(...finalValues.map((d) => d.x));
  const finalMinY = Math.min(...finalValues.map((d) => d.y));
  const shiftX = finalMinX < 90 ? 90 - finalMinX : 0;
  const shiftY = finalMinY < 90 ? 90 - finalMinY : 0;
  return Object.fromEntries(finalValues.map((d) => [d.id, {
    ...d,
    x: Math.round(d.x + shiftX),
    y: Math.round(d.y + shiftY),
  }]));
}

function buildTopologyFromPacketTracer(activity) {
  const deviceMap = {};
  const devices = {};
  for (const src of activity?.devices || []) {
    const kind = packetTracerKind(src);
    const platform = packetTracerPlatform(src);
    const dev = OPT_Engine.makeDevice(kind, src.name || "PT-Device", Number(src.x) || 300, Number(src.y) || 240, {}, {
      platform,
      packetTracer: {
        model: src.model || null,
        power: src.power || null,
      },
    });
    dev.model = src.model && !/hidden/i.test(src.model) ? src.model : dev.model;
    devices[dev.id] = dev;
    deviceMap[src.name] = dev.id;
  }

  const ensureIface = (devId, iface) => {
    const dev = devices[devId];
    if (!dev || !iface) return;
    if (!dev.interfaces[iface]) {
      dev.interfaces[iface] = packetTracerIfaceSeed(dev.kind, iface, dev.hostname);
    } else {
      dev.interfaces[iface] = { ...dev.interfaces[iface], up: true, admUp: true };
      if ((dev.kind === "l2switch" || dev.kind === "l3switch" || dev.kind === "wrt") && !String(iface).toLowerCase().startsWith("vlan")) {
        dev.interfaces[iface] = {
          mode: "trunk",
          vlan: 1,
          nativeVlan: 1,
          allowedVlans: "all",
          stp: { portfast: false, bpduguard: false, state: "forwarding" },
          ...dev.interfaces[iface],
        };
      }
    }
  };

  const links = [];
  for (const src of activity?.links || []) {
    const a = packetTracerEndpoint(src.from);
    const b = packetTracerEndpoint(src.to);
    const aId = deviceMap[a.deviceName];
    const bId = deviceMap[b.deviceName];
    if (!aId || !bId || !a.iface || !b.iface) continue;
    ensureIface(aId, a.iface);
    ensureIface(bId, b.iface);
    links.push({
      id: OPT_Engine.uid("l"),
      a: aId,
      ai: a.iface,
      b: bId,
      bi: b.iface,
      type: /serial/i.test(src.type || "") ? "serial" : "copper",
      up: true,
      packetTracer: {
        type: src.type || null,
        fromStatus: src.fromStatus || null,
        toStatus: src.toStatus || null,
      },
    });
  }

  return { devices: improvePacketTracerImportLayout(devices, links), links };
}

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "cyan",
  "density": "regular",
  "showGrid": true,
  "labelLinks": true,
  "packetSpeed": 1
}/*EDITMODE-END*/;

const ACCENTS = {
  cyan:    { a: "oklch(0.78 0.13 220)", dim: "oklch(0.48 0.11 220)" },
  azure:   { a: "oklch(0.74 0.16 245)", dim: "oklch(0.48 0.13 245)" },
  teal:    { a: "oklch(0.78 0.14 195)", dim: "oklch(0.48 0.12 195)" },
  jade:    { a: "oklch(0.78 0.15 165)", dim: "oklch(0.48 0.13 165)" },
  violet:  { a: "oklch(0.74 0.16 290)", dim: "oklch(0.48 0.14 290)" },
  amber:   { a: "oklch(0.80 0.15 75)",  dim: "oklch(0.50 0.12 75)" },
};

const Sync = window.OpenPTSync;
const OPENPT_VERSION = "0.2.4-sync.20260518";
const SYNC_AUTOSAVE_CHANGES = 20;
const SYNC_AUTOSAVE_MS = 60_000;
const SYNC_MIN_SAVE_MS = 10_000;
const CLI_REVEAL_MIN_HEIGHT = 360;

const SERVER_CONFIG_SECTIONS = [
  ["http", "HTTP"],
  ["dhcp", "DHCP"],
  ["dhcpv6", "DHCPv6"],
  ["tftp", "TFTP"],
  ["dns", "DNS"],
  ["syslog", "SYSLOG"],
  ["aaa", "AAA"],
  ["ntp", "NTP"],
  ["email", "EMAIL"],
  ["ftp", "FTP"],
  ["iot", "IoT"],
  ["vm", "VM Management"],
  ["radiusEap", "Radius EAP"],
  ["prp", "PRP"],
];

const SERVER_FILE_LIBRARY = [
  "asa842-k8.bin",
  "asa923-k8.bin",
  "c1841-advipservicesk9-mz.124-15.T1.bin",
  "c1841-ipbase-mz.123-14.T7.bin",
  "c1841-ipbasek9-mz.124-12.bin",
  "c1900-universalk9-mz.SPA.155-3.M4a.bin",
  "c2600-advipservicesk9-mz.124-15.T1.bin",
  "c2600-i-mz.122-28.bin",
  "c2600-ipbasek9-mz.124-8.bin",
  "c2800nm-advipservicesk9-mz.124-15.T1.bin",
  "c2800nm-advipservicesk9-mz.151-4.M4.bin",
  "c2800nm-ipbase-mz.123-14.T7.bin",
  "c2900-universalk9-mz.SPA.155-3.M4a.bin",
  "cat3k_caa-universalk9.16.03.02.SPA.bin",
];

const SERVER_WEB_FILES = [
  { name: "copyrights.html", editable: true, content: "<h1>OpenPT Server</h1>" },
  { name: "cscoptlogo177x111.jpg", editable: false, content: "" },
  { name: "helloworld.html", editable: true, content: "<h1>Hello world</h1>" },
  { name: "image.html", editable: true, content: "<img src=\"cscoptlogo177x111.jpg\" alt=\"logo\">" },
  { name: "index.html", editable: true, content: "<h1>Server-PT</h1>" },
];

const SERVER_DESKTOP_APPS = [
  { key: "ip", label: "IP Configuration", kind: "Network" },
  { key: "browser", label: "Web Browser", kind: "Application" },
  { key: "wireless", label: "PC Wireless", kind: "Network" },
  { key: "vpn", label: "VPN", kind: "Security" },
  { key: "accounting", label: "AAA Accounting", kind: "Logs" },
  { key: "traffic", label: "Traffic Generator", kind: "Utility" },
  { key: "mib", label: "MIB Browser", kind: "Application" },
  { key: "communicator", label: "Cisco IP Communicator", kind: "Voice" },
  { key: "email", label: "Email", kind: "Application" },
  { key: "pppoe", label: "PPPoE Dialer", kind: "Network" },
  { key: "editor", label: "Text Editor", kind: "Application" },
  { key: "firewall", label: "Firewall", kind: "Security" },
  { key: "ipv6firewall", label: "IPv6 Firewall", kind: "Security" },
  { key: "netflow", label: "Netflow Collector", kind: "Analytics" },
  { key: "iox", label: "IoX IDE", kind: "Developer" },
  { key: "iotmon", label: "IoT Monitor", kind: "IoT" },
  { key: "iotide", label: "IoT IDE", kind: "IoT" },
];

const ENDPOINT_DESKTOP_APPS = [
  { key: "ip", label: "IP Configuration", kind: "Network" },
  { key: "dialup", label: "Dial-up", kind: "Network" },
  { key: "browser", label: "Web Browser", kind: "Application" },
  { key: "wireless", label: "PC Wireless", kind: "Network" },
  { key: "vpn", label: "VPN", kind: "Security" },
  { key: "traffic", label: "Traffic Generator", kind: "Utility" },
  { key: "mib", label: "MIB Browser", kind: "Application" },
  { key: "communicator", label: "Cisco IP Communicator", kind: "Voice" },
  { key: "email", label: "Email", kind: "Application" },
  { key: "pppoe", label: "PPPoE Dialer", kind: "Network" },
  { key: "editor", label: "Text Editor", kind: "Application" },
  { key: "firewall", label: "Firewall", kind: "Security" },
  { key: "ipv6firewall", label: "IPv6 Firewall", kind: "Security" },
  { key: "netflow", label: "Netflow Collector", kind: "Analytics" },
  { key: "iox", label: "IoX IDE", kind: "Developer" },
  { key: "tftp", label: "TFTP Service", kind: "Service" },
  { key: "bluetooth", label: "Bluetooth", kind: "Network" },
  { key: "iotmon", label: "IoT Monitor", kind: "IoT" },
  { key: "iotide", label: "IoT IDE", kind: "IoT" },
];

function isEndpointAppsDevice(device) {
  return device?.kind === "pc" || device?.kind === "mac" || device?.kind === "laptop";
}

function endpointAppByKey(key) {
  return ENDPOINT_DESKTOP_APPS.find((app) => app.key === key) || null;
}

function endpointAppTabId(wid, deviceId, appKey) {
  return `app:${wid}:${deviceId}:${appKey}`;
}

function defaultServerConfig(device = {}) {
  const services = device.services || {};
  const dhcpPools = device.dhcp?.pools || {};
  const primaryPool = Object.entries(dhcpPools)[0];
  return {
    http: {
      http: services.http ?? true,
      https: services.https ?? true,
      files: SERVER_WEB_FILES,
    },
    dhcp: {
      service: services.dhcp ?? false,
      selectedPool: primaryPool?.[0] || "serverPool",
      pools: Object.entries(dhcpPools).map(([name, pool]) => ({
        poolName: name,
        defaultGateway: pool.defaultRouter || "0.0.0.0",
        dnsServer: pool.dnsServer || "0.0.0.0",
        startIp: pool.startIp || pool.network || "209.165.200.0",
        subnetMask: pool.mask || "255.255.255.0",
        maxUsers: pool.maxUsers || 512,
        tftpServer: pool.tftpServer || "0.0.0.0",
        wlcAddress: pool.wlcAddress || "0.0.0.0",
      })),
    },
    dhcpv6: { service: services.dhcpv6 ?? false, pools: [], prefixes: [], delegations: [], localPools: [] },
    tftp: { service: services.tftp ?? true, files: SERVER_FILE_LIBRARY },
    dns: { service: services.dns ?? true, records: [] },
    syslog: { service: services.syslog ?? true, logs: [] },
    aaa: { service: services.aaa ?? true, radiusPort: "1645", clients: [], users: [] },
    ntp: { service: services.ntp ?? true, auth: false, key: "", password: "", date: "2019-10-12", time: "09:15:20" },
    email: { smtp: services.smtp ?? true, pop3: services.pop3 ?? true, domain: "", users: [] },
    ftp: { service: services.ftp ?? true, users: [{ username: "cisco", password: "cisco", permission: "RWDNL" }], files: SERVER_FILE_LIBRARY.slice(0, 8) },
    iot: { service: services.iot ?? false, registrations: [], devices: [] },
    vm: { service: services.vm ?? true, vms: [] },
    radiusEap: { allowEapMd5: false },
    prp: { enabled: false },
  };
}

function ensureServerConfig(device = {}) {
  const base = defaultServerConfig(device);
  const saved = cloneState(device.serverConfig || {});
  const merged = { ...base, ...saved };
  for (const key of Object.keys(base)) {
    merged[key] = { ...base[key], ...(saved[key] || {}) };
  }
  if (!merged.dhcp.pools?.length) merged.dhcp.pools = defaultServerConfig(device).dhcp.pools;
  if (!merged.http.files?.length) merged.http.files = SERVER_WEB_FILES;
  if (!merged.tftp.files?.length) merged.tftp.files = SERVER_FILE_LIBRARY;
  if (!merged.ftp.files?.length) merged.ftp.files = SERVER_FILE_LIBRARY.slice(0, 8);
  return merged;
}

function ipParts(ip) {
  const parts = String(ip || "").split(".").map((n) => Number(n));
  return parts.length === 4 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255) ? parts : null;
}

function networkFromIpMask(ip, mask) {
  const a = ipParts(ip), b = ipParts(mask);
  if (!a || !b) return ip || "0.0.0.0";
  return a.map((part, i) => part & b[i]).join(".");
}

function cloneState(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function projectDocFromState({ title, devices, links, uiState, metadata = {} }) {
  return {
    schemaVersion: 1,
    title: title || "Untitled OpenPT project",
    devices: OPT_Engine.normalizeTopology(devices || {}, links || []).devices,
    links: OPT_Engine.normalizeTopology(devices || {}, links || []).links,
    uiState: uiState || {},
    metadata: { app: "OpenPT", ...metadata },
  };
}

function terminalScrollPayload(scrolls) {
  const out = {};
  for (const [id, state] of Object.entries(scrolls || {})) {
    if (state && !state.atBottom) out[id] = { top: state.top || 0 };
  }
  return out;
}

function cloneJson(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function stripProjectExtension(name) {
  return (name || "Untitled OpenPT project").replace(/\.(json|opt|otp|pka|pkt)$/i, "");
}

function safeExportName(name, ext) {
  const base = stripProjectExtension(name)
    .trim()
    .replace(/[^\w.-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "openpt-project";
  return `${base}.${ext}`;
}

function buildOtpPackage({ title, devices, links, uiState, ptActivity, events, packets, cliHistory, cloudProjectId, cloudVersion }) {
  const normalized = OPT_Engine.normalizeTopology(devices || {}, links || []);
  const assignment = cloneJson(ptActivity || null);
  const project = projectDocFromState({
    title,
    devices: normalized.devices,
    links: normalized.links,
    uiState: { ...(uiState || {}), ptActivity: null },
    metadata: {
      format: "openpt-otp",
      otpVersion: 1,
      exportedAt: new Date().toISOString(),
    },
  });
  const deviceConfigs = Object.fromEntries(Object.entries(normalized.devices || {}).map(([id, device]) => [id, {
    hostname: device.hostname || device.name || id,
    kind: device.kind,
    platform: device.platform || null,
    model: device.model || null,
    osVersion: device.osVersion || null,
    runningConfig: OPT_Engine.serializeConfig(device),
    startupConfig: device.startupConfig || "",
    files: cloneJson(device.files || {}),
  }]));

  return {
    format: "openpt-otp",
    otpVersion: 1,
    title: project.title,
    createdAt: project.metadata.exportedAt,
    generator: {
      app: "OpenPT",
      version: OPENPT_VERSION,
    },
    summary: {
      devices: Object.keys(normalized.devices || {}).length,
      links: (normalized.links || []).length,
      assignment: assignment ? assignment.title || assignment.sourceName || "Packet Tracer activity" : null,
    },
    project,
    assignment,
    generated: {
      deviceConfigs,
    },
    session: {
      events: cloneJson(events || []),
      packets: cloneJson(packets || []),
      cliHistory: cloneJson(cliHistory || []),
    },
    provenance: {
      cloudProjectId: cloudProjectId || null,
      cloudVersion: cloudVersion || 0,
      packetTracerRawFile: cloneJson(assignment?.rawFile || null),
      packetTracerDecodedXml: !!assignment?.decoded?.xmlText,
    },
  };
}

function projectDocumentFromOtpPackage(pkg) {
  if (!pkg || typeof pkg !== "object") return null;
  const project = pkg.project || pkg.document || null;
  if (!project || typeof project !== "object" || !project.devices || !Array.isArray(project.links)) return null;
  const assignment = pkg.assignment || project.uiState?.ptActivity || null;
  return {
    ...project,
    uiState: {
      ...(project.uiState || {}),
      ptActivity: assignment,
      ptSidebarOpen: project.uiState?.ptSidebarOpen ?? !!assignment,
    },
  };
}

function mergeProjectIntoTabs(tabs, activeWid, project) {
  const title = project?.title || "Synced project";
  return tabs.map((tab) => tab.id === activeWid ? { ...tab, name: `${title}.opt`, cloudProjectId: project?.id || tab.cloudProjectId } : tab);
}

const OPENPT_PRACTICE_LABS = [
  { key: "etherchannel-vlan", title: "VLAN Trunks and EtherChannel", desc: "Configure access VLANs, LACP, and a trunking port-channel between two switches." },
  { key: "dhcp-routerb", title: "RouterB DHCP Pool", desc: "Build a DHCP pool with reserved addresses, gateway, DNS, domain, and NetBIOS options." },
  { key: "ospf-area0-dr", title: "OSPF Area 0 DR Election", desc: "Advertise exact subnets and tune shared-segment OSPF priorities." },
  { key: "ssh-line-access", title: "SSH and Line Access Controls", desc: "Set console idle timers, VTY transports, SSH keys, and SSHv2." },
];

function practiceActivity({ title, instructionsHtml, hints, answerCommands = {}, assessmentItems = [] }) {
  return {
    title,
    sourceName: `${title}.opt`,
    instructionsHtml,
    hints,
    answerCommands,
    assessmentItems: assessmentItems.map((item, index) => ({
      id: `${title}-${index}`,
      points: item.points || 1,
      rootName: item.rootName || title,
      components: item.components || "Assessment Items",
      name: item.name,
      pathParts: item.pathParts || [item.device, item.iface, item.name].filter(Boolean),
      parentPath: item.parentPath || [item.rootName || title, item.device, item.iface].filter(Boolean).join(" / "),
      path: item.path || [item.rootName || title, item.device, item.iface, item.name].filter(Boolean).join(" / "),
      value: item.value || "",
    })),
  };
}

function legacyIface(seed = {}) {
  return { ip: null, mask: null, gw: null, up: false, admUp: false, mac: randMac(), desc: "", ...seed };
}

function switchPort(seed = {}) {
  return { ip: null, mask: null, gw: null, up: false, admUp: false, mac: randMac(), desc: "", mode: "access", vlan: 1, nativeVlan: 1, allowedVlans: "all", stp: { portfast: false, bpduguard: false, state: "forwarding" }, ...seed };
}

function setLegacyIfaces(device, ifaces) {
  device.interfaces = { ...(device.interfaces || {}), ...ifaces };
  return device;
}

function connect(a, ai, b, bi, type = "copper") {
  a.interfaces[ai] = { ...(a.interfaces[ai] || legacyIface()), up: true, admUp: true };
  b.interfaces[bi] = { ...(b.interfaces[bi] || legacyIface()), up: true, admUp: true };
  return { id: OPT_Engine.uid("l"), a: a.id, ai, b: b.id, bi, type, up: true };
}

function practiceLabInstructions(title, paragraphs, tasks, notes = []) {
  const p = paragraphs.map((line) => `<p>${line}</p>`).join("");
  const t = tasks.length ? `<ul>${tasks.map((task) => `<li>${task}</li>`).join("")}</ul>` : "";
  const n = notes.map((line) => `<p>${line}</p>`).join("");
  return `<h1>Tasks</h1>${p}${t}${n}`;
}

function makeOpenPtPracticeLab(key) {
  switch (key) {
    case "etherchannel-vlan": return makeEtherchannelVlanLab();
    case "dhcp-routerb": return makeDhcpRouterBLab();
    case "ospf-area0-dr": return makeOspfArea0DrLab();
    case "ssh-line-access": return makeSshLineAccessLab();
    default: return null;
  }
}

function makeEtherchannelVlanLab() {
  const SwitchA = OPT_Engine.makeDevice("l2switch", "SwitchA", 260, 160);
  const SwitchB = OPT_Engine.makeDevice("l2switch", "SwitchB", 760, 160, {}, { vlans: { 1: "default", 10: "VLAN10", 20: "VLAN20" } });
  for (const iface of ["FastEthernet0/1", "FastEthernet0/2"]) {
    SwitchA.interfaces[iface] = switchPort({ up: true, admUp: true, desc: "to SwitchB" });
    SwitchB.interfaces[iface] = switchPort({ up: true, admUp: true, mode: "trunk", channelGroup: { id: 1, mode: "active" }, desc: "to SwitchA" });
  }
  SwitchB.interfaces["Port-channel1"] = switchPort({ up: true, admUp: true, mode: "trunk", trunkEncapsulation: "dot1q", desc: "LACP trunk to SwitchA" });
  SwitchB.etherchannels = { 1: { protocol: "LACP", members: ["FastEthernet0/1", "FastEthernet0/2"] } };
  for (const [iface, vlan] of [["FastEthernet0/3", 10], ["FastEthernet0/4", 10], ["FastEthernet0/8", 20], ["FastEthernet0/9", 20]]) {
    SwitchB.interfaces[iface] = switchPort({ vlan, mode: "access", admUp: true, desc: `access VLAN ${vlan}` });
  }
  const PC1 = OPT_Engine.makeDevice("pc", "PC1", 140, 390, { eth0: { ip: "192.168.10.11", mask: "255.255.255.0", gw: "", up: true, admUp: true } });
  const PC2 = OPT_Engine.makeDevice("pc", "PC2", 360, 390, { eth0: { ip: "192.168.20.11", mask: "255.255.255.0", gw: "", up: true, admUp: true } });
  const PC3 = OPT_Engine.makeDevice("pc", "PC3", 640, 390, { eth0: { ip: "192.168.10.12", mask: "255.255.255.0", gw: "", up: true, admUp: true } });
  const PC4 = OPT_Engine.makeDevice("pc", "PC4", 860, 390, { eth0: { ip: "192.168.20.12", mask: "255.255.255.0", gw: "", up: true, admUp: true } });
  const links = [
    connect(SwitchA, "FastEthernet0/1", SwitchB, "FastEthernet0/1"),
    connect(SwitchA, "FastEthernet0/2", SwitchB, "FastEthernet0/2"),
    connect(SwitchA, "FastEthernet0/3", PC1, "eth0"),
    connect(SwitchA, "FastEthernet0/8", PC2, "eth0"),
    connect(SwitchB, "FastEthernet0/3", PC3, "eth0"),
    connect(SwitchB, "FastEthernet0/8", PC4, "eth0"),
  ];
  const activity = practiceActivity({
    title: "VLAN Trunks and EtherChannel",
    instructionsHtml: practiceLabInstructions("VLAN Trunks and EtherChannel", [
      "Your company's network includes two switches, SwitchA and SwitchB. SwitchB has already been configured with the correct VLAN, trunk, and EtherChannel settings.",
      "Configure SwitchA with the following parameters:",
    ], [
      "Switch ports FastEthernet 0/3, FastEthernet 0/4, FastEthernet 0/8, and FastEthernet 0/9 should be explicitly configured as access ports.",
      "VLAN 10 should contain switch ports FastEthernet 0/3 and FastEthernet 0/4.",
      "VLAN 20 should contain switch ports FastEthernet 0/8 and FastEthernet 0/9.",
      "Switch ports FastEthernet 0/1 and FastEthernet 0/2 should use a standards-based EtherChannel negotiation protocol.",
      "Switch ports FastEthernet 0/1 and FastEthernet 0/2 should be members of EtherChannel port-group 1 and actively negotiate EtherChannel links.",
      "The EtherChannel virtual interface should use standards-based trunk encapsulation and always function as a trunk.",
    ]),
    hints: [
      "Standards-based EtherChannel negotiation means LACP. On Cisco-style switches, active mode initiates LACP negotiation.",
      "Configure the physical member interfaces first with channel-group 1 mode active, then configure interface Port-channel1 as the trunk.",
      "Use switchport trunk encapsulation dot1q and switchport mode trunk on the port-channel.",
    ],
    answerCommands: {
      SwitchA: [
        "interface range FastEthernet0/3-4", "switchport mode access", "switchport access vlan 10",
        "interface range FastEthernet0/8-9", "switchport mode access", "switchport access vlan 20",
        "interface range FastEthernet0/1-2", "channel-group 1 mode active",
        "interface Port-channel1", "switchport trunk encapsulation dot1q", "switchport mode trunk",
      ],
    },
    assessmentItems: [
      ...["FastEthernet0/3", "FastEthernet0/4"].flatMap((iface) => [
        { device: "SwitchA", iface, name: "switchport mode access", components: "VLAN Configuration" },
        { device: "SwitchA", iface, name: "switchport access vlan 10", components: "VLAN Configuration" },
      ]),
      ...["FastEthernet0/8", "FastEthernet0/9"].flatMap((iface) => [
        { device: "SwitchA", iface, name: "switchport mode access", components: "VLAN Configuration" },
        { device: "SwitchA", iface, name: "switchport access vlan 20", components: "VLAN Configuration" },
      ]),
      ...["FastEthernet0/1", "FastEthernet0/2"].flatMap((iface) => [
        { device: "SwitchA", iface, name: "channel group 1", components: "EtherChannel Configuration", points: 2 },
        { device: "SwitchA", iface, name: "channel mode active", components: "EtherChannel Configuration", points: 2 },
      ]),
      { device: "SwitchA", iface: "Port-channel1", name: "switchport mode trunk", components: "Trunk Configuration" },
      { device: "SwitchA", iface: "Port-channel1", name: "switchport trunk encapsulation dot1q", components: "Trunk Configuration", value: "switchport trunk encapsulation dot1q" },
    ],
  });
  return { title: activity.title, fileName: "vlan-etherchannel", devices: { [SwitchA.id]: SwitchA, [SwitchB.id]: SwitchB, [PC1.id]: PC1, [PC2.id]: PC2, [PC3.id]: PC3, [PC4.id]: PC4 }, links, activity };
}

function makeDhcpRouterBLab() {
  const RouterA = setLegacyIfaces(OPT_Engine.makeDevice("router", "RouterA", 300, 120), {
    "FastEthernet0/0": legacyIface({ ip: "10.0.12.1", mask: "255.255.255.252", up: true, admUp: true, desc: "to RouterB" }),
    "FastEthernet0/1": legacyIface({ ip: "10.0.13.1", mask: "255.255.255.252", up: true, admUp: true, desc: "to RouterC" }),
  });
  const RouterB = setLegacyIfaces(OPT_Engine.makeDevice("router", "RouterB", 300, 300), {
    "FastEthernet0/0": legacyIface({ ip: "192.168.11.1", mask: "255.255.255.0", up: true, admUp: true, desc: "to HostB LAN" }),
    "FastEthernet0/1": legacyIface({ ip: "10.0.12.2", mask: "255.255.255.252", up: true, admUp: true, desc: "to RouterA" }),
  });
  const RouterC = setLegacyIfaces(OPT_Engine.makeDevice("router", "RouterC", 620, 120), {
    "FastEthernet0/0": legacyIface({ ip: "10.0.13.2", mask: "255.255.255.252", up: true, admUp: true, desc: "to RouterA" }),
    "FastEthernet0/1": legacyIface({ ip: "10.0.34.1", mask: "255.255.255.252", up: true, admUp: true, desc: "to RouterD" }),
  });
  const RouterD = setLegacyIfaces(OPT_Engine.makeDevice("router", "RouterD", 620, 300), {
    "FastEthernet0/0": legacyIface({ ip: "192.168.44.1", mask: "255.255.255.0", up: true, admUp: true, desc: "to HostD LAN" }),
    "FastEthernet0/1": legacyIface({ ip: "10.0.34.2", mask: "255.255.255.252", up: true, admUp: true, desc: "to RouterC" }),
  });
  for (const r of [RouterA, RouterB, RouterC, RouterD]) r.secrets.enable = "cisco";
  const HostB = OPT_Engine.makeDevice("pc", "HostB", 300, 480, { eth0: { ip: "", mask: "", gw: "", dhcp: true, up: true, admUp: true } });
  const HostD = OPT_Engine.makeDevice("pc", "HostD", 620, 480, { eth0: { ip: "192.168.44.10", mask: "255.255.255.0", gw: "192.168.44.1", up: true, admUp: true } });
  const links = [
    connect(RouterA, "FastEthernet0/0", RouterB, "FastEthernet0/1", "cross"),
    connect(RouterA, "FastEthernet0/1", RouterC, "FastEthernet0/0", "cross"),
    connect(RouterC, "FastEthernet0/1", RouterD, "FastEthernet0/1", "cross"),
    connect(RouterB, "FastEthernet0/0", HostB, "eth0", "cross"),
    connect(RouterD, "FastEthernet0/0", HostD, "eth0", "cross"),
  ];
  const activity = practiceActivity({
    title: "RouterB DHCP Pool",
    instructionsHtml: practiceLabInstructions("RouterB DHCP Pool", [
      "You want to configure dynamic IP addressing on RouterB for its connected hosts. The first 10 addresses on the subnet should be reserved for static addresses; the remainder of the subnet should be available for dynamic IP address allocation.",
      "Your supervisor has asked you to complete the following tasks:",
    ], [
      "Configure a pool named <strong>pool1</strong> on RouterB to assign IP addresses for the hosts on the network connected to the FastEthernet 0/0 interface of RouterB.",
      "Ensure that the hosts use RouterB as the default gateway.",
      "Ensure that the hosts use the DNS server at 192.168.11.3.",
      "Ensure that the hosts use the domain name <strong>openpt.dev</strong>.",
      "Ensure that the hosts use the NetBIOS server at 192.168.11.4.",
    ], [
      "Configure only RouterB to complete these tasks. Host configuration will be performed by another administrator.",
      "All router interfaces are operational, and the proper IP addresses have been configured.",
      "All passwords are set to <strong>cisco</strong>.",
    ]),
    hints: [
      "The network on RouterB FastEthernet0/0 is 192.168.11.0/24, and RouterB itself is 192.168.11.1.",
      "Reserve the first 10 usable addresses with ip dhcp excluded-address 192.168.11.1 192.168.11.10.",
      "Inside ip dhcp pool pool1, configure network, default-router, dns-server, domain-name, and netbios-name-server.",
    ],
    assessmentItems: [
      { device: "RouterB", name: "ip dhcp excluded-address 192.168.11.1 192.168.11.10", components: "DHCP Configuration", value: "ip dhcp excluded-address 192.168.11.1 192.168.11.10" },
      { device: "RouterB", name: "ip dhcp pool pool1", components: "DHCP Configuration", value: "ip dhcp pool pool1" },
      { device: "RouterB", name: "network 192.168.11.0 255.255.255.0", components: "DHCP Configuration", value: "network 192.168.11.0 255.255.255.0" },
      { device: "RouterB", name: "default-router 192.168.11.1", components: "DHCP Configuration", value: "default-router 192.168.11.1" },
      { device: "RouterB", name: "dns-server 192.168.11.3", components: "DHCP Configuration", value: "dns-server 192.168.11.3" },
      { device: "RouterB", name: "domain-name openpt.dev", components: "DHCP Configuration", value: "domain-name openpt.dev" },
      { device: "RouterB", name: "netbios-name-server 192.168.11.4", components: "DHCP Configuration", value: "netbios-name-server 192.168.11.4" },
    ],
  });
  return { title: activity.title, fileName: "routerb-dhcp", devices: { [RouterA.id]: RouterA, [RouterB.id]: RouterB, [RouterC.id]: RouterC, [RouterD.id]: RouterD, [HostB.id]: HostB, [HostD.id]: HostD }, links, activity };
}

function makeOspfArea0DrLab() {
  const RouterA = setLegacyIfaces(OPT_Engine.makeDevice("router", "RouterA", 460, 150), {
    "FastEthernet0/0": legacyIface({ ip: "10.10.10.1", mask: "255.255.255.0", up: true, admUp: true, desc: "shared segment" }),
    "FastEthernet0/1": legacyIface({ ip: "192.168.1.1", mask: "255.255.255.0", up: true, admUp: true, desc: "to HostA" }),
  });
  const RouterB = setLegacyIfaces(OPT_Engine.makeDevice("router", "RouterB", 220, 390), {
    "FastEthernet0/0": legacyIface({ ip: "10.10.10.2", mask: "255.255.255.0", up: true, admUp: true, desc: "shared segment" }),
    "FastEthernet0/1": legacyIface({ ip: "192.168.2.1", mask: "255.255.255.0", up: true, admUp: true, desc: "to HostB" }),
  });
  const RouterC = setLegacyIfaces(OPT_Engine.makeDevice("router", "RouterC", 700, 390), {
    "FastEthernet0/0": legacyIface({ ip: "10.10.10.3", mask: "255.255.255.0", up: true, admUp: true, desc: "shared segment" }),
    "FastEthernet0/1": legacyIface({ ip: "192.168.3.1", mask: "255.255.255.0", up: true, admUp: true, desc: "to HostC" }),
  });
  const SwitchA = OPT_Engine.makeDevice("l2switch", "SwitchA", 460, 300, {
    "FastEthernet0/1": switchPort({ up: true, admUp: true, desc: "to RouterA" }),
    "FastEthernet0/2": switchPort({ up: true, admUp: true, desc: "to RouterB" }),
    "FastEthernet0/3": switchPort({ up: true, admUp: true, desc: "to RouterC" }),
  });
  const HostA = OPT_Engine.makeDevice("pc", "HostA", 460, 40, { eth0: { ip: "192.168.1.10", mask: "255.255.255.0", gw: "192.168.1.1", up: true, admUp: true } });
  const HostB = OPT_Engine.makeDevice("pc", "HostB", 220, 540, { eth0: { ip: "192.168.2.10", mask: "255.255.255.0", gw: "192.168.2.1", up: true, admUp: true } });
  const HostC = OPT_Engine.makeDevice("pc", "HostC", 700, 540, { eth0: { ip: "192.168.3.10", mask: "255.255.255.0", gw: "192.168.3.1", up: true, admUp: true } });
  const links = [
    connect(HostA, "eth0", RouterA, "FastEthernet0/1", "cross"),
    connect(RouterA, "FastEthernet0/0", SwitchA, "FastEthernet0/1"),
    connect(RouterB, "FastEthernet0/0", SwitchA, "FastEthernet0/2"),
    connect(RouterC, "FastEthernet0/0", SwitchA, "FastEthernet0/3"),
    connect(RouterB, "FastEthernet0/1", HostB, "eth0", "cross"),
    connect(RouterC, "FastEthernet0/1", HostC, "eth0", "cross"),
  ];
  const activity = practiceActivity({
    title: "OSPF Area 0 DR Election",
    instructionsHtml: practiceLabInstructions("OSPF Area 0 DR Election", [
      "Your company's network includes three routers: RouterA, RouterB, and RouterC. Each router is connected to SwitchA over its FastEthernet 0/0 interface. IP addresses have been configured on all devices in the topology.",
      "Perform the following configurations:",
    ], [
      "Configure OSPF on each router by using OSPF process ID 1.",
      "Configure OSPF to advertise the specific subnetworks that are configured on each router interface.",
      "Configure all OSPF interfaces to operate in OSPF Area 0.",
      "Configure RouterA so that, in the future, it will almost always assume the role as the DR of the routers' shared segment, even if other routers are connected to the shared segment.",
      "Configure RouterC so that, in the future, it will never assume the role as the DR of the routers' shared segment.",
    ]),
    hints: [
      "Use wildcard masks with network statements. A /24 subnet uses wildcard 0.0.0.255.",
      "The shared segment is 10.10.10.0/24. Each router also has its own /24 LAN.",
      "Set ip ospf priority 255 on RouterA FastEthernet0/0 and ip ospf priority 0 on RouterC FastEthernet0/0.",
    ],
    assessmentItems: [
      ...[
        ["RouterA", "10.10.10.0 0.0.0.255", "192.168.1.0 0.0.0.255"],
        ["RouterB", "10.10.10.0 0.0.0.255", "192.168.2.0 0.0.0.255"],
        ["RouterC", "10.10.10.0 0.0.0.255", "192.168.3.0 0.0.0.255"],
      ].flatMap(([device, shared, lan]) => [
        { device, name: "router ospf 1", components: "OSPF Configuration", value: "router ospf 1" },
        { device, name: `network ${shared} area 0`, components: "OSPF Configuration", value: `network ${shared} area 0` },
        { device, name: `network ${lan} area 0`, components: "OSPF Configuration", value: `network ${lan} area 0` },
      ]),
      { device: "RouterA", iface: "FastEthernet0/0", name: "ip ospf priority 255", components: "OSPF Configuration", value: "ip ospf priority 255" },
      { device: "RouterC", iface: "FastEthernet0/0", name: "ip ospf priority 0", components: "OSPF Configuration", value: "ip ospf priority 0" },
    ],
  });
  return { title: activity.title, fileName: "ospf-area0-dr", devices: { [RouterA.id]: RouterA, [RouterB.id]: RouterB, [RouterC.id]: RouterC, [SwitchA.id]: SwitchA, [HostA.id]: HostA, [HostB.id]: HostB, [HostC.id]: HostC }, links, activity };
}

function makeSshLineAccessLab() {
  const ASW1 = OPT_Engine.makeDevice("l2switch", "ASW1", 250, 170);
  const ASW2 = OPT_Engine.makeDevice("l2switch", "ASW2", 250, 380);
  const DSW1 = OPT_Engine.makeDevice("l2switch", "DSW1", 500, 170);
  const DSW2 = OPT_Engine.makeDevice("l2switch", "DSW2", 500, 380);
  const CSW1 = OPT_Engine.makeDevice("l2switch", "CSW1", 760, 170);
  const CSW2 = OPT_Engine.makeDevice("l2switch", "CSW2", 760, 380);
  const R1 = OPT_Engine.makeDevice("router", "R1", 1010, 170);
  const R2 = OPT_Engine.makeDevice("router", "R2", 1010, 380);
  const PC1 = OPT_Engine.makeDevice("pc", "PC1", 80, 170, { eth0: { ip: "10.10.10.11", mask: "255.255.255.0", gw: "", up: true, admUp: true } });
  const PC2 = OPT_Engine.makeDevice("pc", "PC2", 80, 380, { eth0: { ip: "10.10.20.11", mask: "255.255.255.0", gw: "", up: true, admUp: true } });
  const links = [
    connect(PC1, "eth0", ASW1, "FastEthernet0/1"),
    connect(PC2, "eth0", ASW2, "FastEthernet0/1"),
    connect(ASW1, "FastEthernet0/23", DSW1, "FastEthernet0/1"),
    connect(ASW2, "FastEthernet0/23", DSW2, "FastEthernet0/1"),
    connect(ASW1, "FastEthernet0/24", DSW2, "FastEthernet0/2"),
    connect(ASW2, "FastEthernet0/24", DSW1, "FastEthernet0/2"),
    connect(DSW1, "FastEthernet0/23", CSW1, "FastEthernet0/1"),
    connect(DSW2, "FastEthernet0/23", CSW2, "FastEthernet0/1"),
    connect(DSW1, "FastEthernet0/24", CSW2, "FastEthernet0/2"),
    connect(DSW2, "FastEthernet0/24", CSW1, "FastEthernet0/2"),
    connect(CSW1, "FastEthernet0/23", R1, "GigabitEthernet0/0/0"),
    connect(CSW2, "FastEthernet0/23", R2, "GigabitEthernet0/0/0"),
    connect(CSW1, "FastEthernet0/24", R2, "GigabitEthernet0/0/1"),
    connect(CSW2, "FastEthernet0/24", R1, "GigabitEthernet0/0/1"),
  ];
  const activity = practiceActivity({
    title: "SSH and Line Access Controls",
    instructionsHtml: practiceLabInstructions("SSH and Line Access Controls", [
      "You are responsible for configuring switches CSW1 and CSW2. You have been asked to achieve the following goals:",
    ], [
      "Configure the console port on CSW1 to disconnect the current session after three minutes of inactivity.",
      "Configure the console port on CSW2 to never disconnect an idle session.",
      "Configure the first five vty ports on CSW1 to accept only the SSH protocol for inbound connections.",
      "Configure the first five vty ports on CSW2 to accept no protocols for inbound connections.",
      "Enable the SSH server on CSW1. Use the domain <strong>openpt.dev</strong> and the default modulus value when generating RSA keys for the SSH server.",
      "Ensure that CSW1 will accept only SSHv2 connections.",
    ]),
    hints: [
      "Use line console 0 for console idle timers. exec-timeout 0 0 means never time out.",
      "The first five VTY ports are line vty 0 4. Use transport input ssh on CSW1 and transport input none on CSW2.",
      "On CSW1, set ip domain-name openpt.dev, generate RSA keys without specifying a modulus, then set ip ssh version 2.",
    ],
    assessmentItems: [
      { device: "CSW1", name: "line console 0 exec-timeout 3 0", components: "Line Configuration", value: "exec-timeout 3 0" },
      { device: "CSW2", name: "line console 0 exec-timeout 0 0", components: "Line Configuration", value: "exec-timeout 0 0" },
      { device: "CSW1", name: "line vty 0 4 transport input ssh", components: "Line Configuration", value: "transport input ssh" },
      { device: "CSW2", name: "line vty 0 4 transport input none", components: "Line Configuration", value: "transport input none" },
      { device: "CSW1", name: "ip domain-name openpt.dev", components: "SSH Configuration", value: "ip domain-name openpt.dev" },
      { device: "CSW1", name: "crypto key generate rsa modulus 2048", components: "SSH Configuration", value: "crypto key generate rsa modulus 2048" },
      { device: "CSW1", name: "ip ssh version 2", components: "SSH Configuration", value: "ip ssh version 2" },
    ],
  });
  return { title: activity.title, fileName: "ssh-line-access", devices: { [ASW1.id]: ASW1, [ASW2.id]: ASW2, [DSW1.id]: DSW1, [DSW2.id]: DSW2, [CSW1.id]: CSW1, [CSW2.id]: CSW2, [R1.id]: R1, [R2.id]: R2, [PC1.id]: PC1, [PC2.id]: PC2 }, links, activity };
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const dragDepth = useRef(0);
  const importFileInputRef = useRef(null);

  // ── Apply accent tweak to CSS variables
  useEffect(() => {
    const c = ACCENTS[t.accent] || ACCENTS.cyan;
    document.documentElement.style.setProperty("--accent", c.a);
    document.documentElement.style.setProperty("--accent-dim", c.dim);
    document.documentElement.style.setProperty("--accent-soft", `color-mix(in oklab, ${c.a} 14%, transparent)`);
  }, [t.accent]);

  useEffect(() => {
    document.documentElement.style.setProperty("--grid-dot", t.showGrid ? "oklch(0.42 0.012 240 / 0.45)" : "transparent");
  }, [t.showGrid]);

  // ── Persisted state ─────────────────────────────────────
  const STORAGE_KEY = "openpt:v1";
  const initial = React.useMemo(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        const cur = data.snapshots?.[data.activeWid] || {};
        const norm = OPT_Engine.normalizeTopology(cur.devices || {}, cur.links || []);
        return {
          tabs: data.tabs || [{ id: "w-0", name: "lab-01 · two-router-vlan.opt" }],
          activeWid: data.activeWid || "w-0",
          snapshots: data.snapshots || {},
          devices: norm.devices,
          links: norm.links,
          selectedIds: cur.selectedIds || (cur.selectedId ? [cur.selectedId] : []),
          openConsoles: cur.openConsoles || [],
          activeBottom: (cur.activeBottom && cur.activeBottom !== "pka-report") ? cur.activeBottom : "events",
          ptActivity: cur.ptActivity || null,
          ptSidebarOpen: cur.ptSidebarOpen ?? !!cur.ptActivity,
          starterScreenVisible: !!data.starterScreenVisible && !Object.keys(norm.devices).length && !cur.ptActivity,
          loaded: true,
        };
      }
    } catch (e) {}
    return {
      tabs: [{ id: "w-0", name: "untitled-0.opt" }],
      activeWid: "w-0",
      snapshots: { "w-0": { devices: {}, links: [], selectedIds: [], openConsoles: [], activeBottom: "events", ptActivity: null, ptSidebarOpen: false } },
      devices: {},
      links: [],
      selectedIds: [],
      openConsoles: [],
      activeBottom: "events",
      ptActivity: null,
      ptSidebarOpen: false,
      starterScreenVisible: true,
      loaded: false,
    };
  }, []);

  // ── Network state ──────────────────────────────────────
  const [devices, setDevices] = useState(initial.devices);
  const [links, setLinks] = useState(initial.links);
  const [selectedIds, setSelectedIds] = useState(initial.selectedIds || []);
  const [activityTab, setActivityTab] = useState("labs");
  const [openConsoles, setOpenConsoles] = useState(initial.openConsoles);
  const [activeBottom, setActiveBottom] = useState(initial.activeBottom);
  const [ptActivity, setPtActivity] = useState(initial.ptActivity);
  const [ptSidebarOpen, setPtSidebarOpen] = useState(initial.ptSidebarOpen ?? !!initial.ptActivity);
  const [starterScreenVisible, setStarterScreenVisible] = useState(initial.starterScreenVisible || false);
  const [bottomCollapsed, setBottomCollapsed] = useState(() => {
    try { return localStorage.getItem("openpt:bottom-collapsed") === "1"; } catch (e) { return false; }
  });

  // Derived: the most-recently-selected device (used for inspector / context menu)
  const selectedId = selectedIds[selectedIds.length - 1] || null;
  const setSelectedId = (id) => setSelectedIds(id ? [id] : []);
  const selectDevice = (id, additive) => {
    if (!id) { setSelectedIds([]); return; }
    if (additive) {
      setSelectedIds((ids) => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
    } else {
      setSelectedIds([id]);
    }
  };

  // Workspace tabs (multiple labs open at once)
  const [tabs, setTabs] = useState(initial.tabs);
  const [activeWid, setActiveWid] = useState(initial.activeWid);
  const snapshotsRef = useRef(initial.snapshots);
  const [dirtyTabs, setDirtyTabs] = useState({});
  const [selectedLinkId, setSelectedLinkId] = useState(null);
  const [eventFilter, setEventFilter] = useState("all");
  const [pingDialog, setPingDialog] = useState(null);
  const [recentPingTargets, setRecentPingTargets] = useState(() => {
    try { return JSON.parse(localStorage.getItem("openpt:recent-pings") || "[]"); } catch (e) { return []; }
  });
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [lastShareUrl, setLastShareUrl] = useState("");
  const [lastImportReport, setLastImportReport] = useState(null);
  const [serverModuleOpen, setServerModuleOpen] = useState(false);
  const [serverModuleTab, setServerModuleTab] = useState("config");
  const [serverConfigSection, setServerConfigSection] = useState("http");
  const [serverModuleWidth, setServerModuleWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem("openpt:server-module-width"));
      return Number.isFinite(saved) ? Math.max(430, Math.min(saved, 780)) : 680;
    } catch (e) {
      return 680;
    }
  });
  const [appsSidebarOpen, setAppsSidebarOpen] = useState(false);
  const [appsSidebarWidth, setAppsSidebarWidth] = useState(() => {
    try {
      const saved = Number(localStorage.getItem("openpt:apps-sidebar-width"));
      return Number.isFinite(saved) ? Math.max(380, Math.min(saved, 560)) : 420;
    } catch (e) {
      return 420;
    }
  });
  const [openAppTabs, setOpenAppTabs] = useState([]);
  const [activeCenterTab, setActiveCenterTab] = useState("topology");
  const [cliGhostSuggestions, setCliGhostSuggestions] = useState(() => {
    try { return localStorage.getItem("openpt:cli-ghost") !== "0"; } catch (e) { return true; }
  });
  const appUndoRef = useRef({ past: [], future: [] });
  const suppressHistoryRef = useRef(false);
  const dragStartSnapRef = useRef(null);
  const latestTopologyRef = useRef({ devices, links });
  const [historyVersion, setHistoryVersion] = useState(0);
  useEffect(() => {
    latestTopologyRef.current = { devices, links };
  }, [devices, links]);
  useEffect(() => {
    try { localStorage.setItem("openpt:server-module-width", String(serverModuleWidth)); } catch (e) {}
  }, [serverModuleWidth]);
  useEffect(() => {
    try { localStorage.setItem("openpt:apps-sidebar-width", String(appsSidebarWidth)); } catch (e) {}
  }, [appsSidebarWidth]);

  useEffect(() => {
    try { localStorage.setItem("openpt:bottom-collapsed", bottomCollapsed ? "1" : "0"); } catch (e) {}
  }, [bottomCollapsed]);
  useEffect(() => {
    try { localStorage.setItem("openpt:cli-ghost", cliGhostSuggestions ? "1" : "0"); } catch (e) {}
  }, [cliGhostSuggestions]);
  useEffect(() => {
    try { localStorage.setItem("openpt:recent-pings", JSON.stringify(recentPingTargets.slice(0, 8))); } catch (e) {}
  }, [recentPingTargets]);

  const requestConfirm = (options) => new Promise((resolve) => {
    setConfirmDialog({ ...options, resolve });
  });
  const resolveConfirm = (answer) => {
    setConfirmDialog((dialog) => {
      dialog?.resolve?.(answer);
      return null;
    });
  };
  useEffect(() => {
    snapshotsRef.current[activeWid] = { devices, links, selectedIds, openConsoles, activeBottom, ptActivity, ptSidebarOpen };
  }, [devices, links, selectedIds, openConsoles, activeBottom, ptActivity, ptSidebarOpen, activeWid]);

  const captureAppSnapshot = () => {
    snapshotsRef.current[activeWid] = { devices, links, selectedIds, openConsoles, activeBottom, ptActivity, ptSidebarOpen };
    return cloneState({
      tabs,
      activeWid,
      snapshots: snapshotsRef.current,
      devices,
      links,
      selectedIds,
      openConsoles,
      activeBottom,
      ptActivity,
      ptSidebarOpen,
      starterScreenVisible,
      cloudProjectId,
      cloudVersion,
      cloudBaseDoc,
      cloudLease,
      shareToken,
      shareMode,
      syncStatus,
      dirtyTabs,
      topologyViewState,
      terminalScrolls,
    });
  };

  const applyAppSnapshot = (snap) => {
    if (!snap) return;
    snapshotsRef.current = cloneState(snap.snapshots || {});
    setTabs(snap.tabs || [{ id: "w-0", name: "untitled-0.opt" }]);
    setActiveWid(snap.activeWid || "w-0");
    setDevices(snap.devices || {});
    setLinks(snap.links || []);
    setSelectedIds(snap.selectedIds || []);
    setOpenConsoles(snap.openConsoles || []);
    setActiveBottom(snap.activeBottom || "events");
    setPtActivity(snap.ptActivity || null);
    setPtSidebarOpen(!!snap.ptSidebarOpen);
    setStarterScreenVisible(!!snap.starterScreenVisible);
    setCloudProjectId(snap.cloudProjectId || null);
    setCloudVersion(snap.cloudVersion || 0);
    setCloudBaseDoc(snap.cloudBaseDoc || null);
    setCloudLease(snap.cloudLease || null);
    setShareToken(snap.shareToken || null);
    setShareMode(snap.shareMode || null);
    setSyncStatus(snap.syncStatus || { state: "local", message: "Local only" });
    setDirtyTabs(snap.dirtyTabs || {});
    setTopologyViewState(snap.topologyViewState || {});
    setTerminalScrolls(snap.terminalScrolls || {});
    setSelectedLinkId(null);
  };

  const pushAppUndo = (label, before, after = null) => {
    appUndoRef.current.past.push({ label, before, after });
    if (appUndoRef.current.past.length > 40) appUndoRef.current.past.shift();
    appUndoRef.current.future = [];
    setHistoryVersion((n) => n + 1);
  };

  // Persist to localStorage (debounced)
  useEffect(() => {
    const handle = setTimeout(() => {
      try {
        // Ensure current snap is up-to-date before saving
        snapshotsRef.current[activeWid] = { devices, links, selectedIds, openConsoles, activeBottom, ptActivity, ptSidebarOpen };
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          tabs, activeWid, snapshots: snapshotsRef.current, starterScreenVisible,
        }));
      } catch (e) {}
    }, 250);
    return () => clearTimeout(handle);
  }, [tabs, activeWid, devices, links, selectedIds, openConsoles, activeBottom, ptActivity, ptSidebarOpen, starterScreenVisible]);

  // Hide boot splash on first mount (with a brief hold so the splash is actually seen)
  useEffect(() => {
    const root = document.getElementById("root");
    const boot = document.getElementById("boot");
    // give the splash a beat, then cross-fade
    const t = setTimeout(() => {
      if (root) root.classList.add("ready");
      if (boot) {
        boot.classList.add("fading");
        setTimeout(() => boot.remove(), 650);
      }
    }, 500);
    return () => clearTimeout(t);
  }, []);
  const switchTab = (newId) => {
    if (newId === activeWid) return;
    snapshotsRef.current[activeWid] = { devices, links, selectedIds, openConsoles, activeBottom, ptActivity, ptSidebarOpen };
    const snap = snapshotsRef.current[newId];
    const norm = OPT_Engine.normalizeTopology(snap?.devices || {}, snap?.links || []);
    setActiveWid(newId);
    setDevices(norm.devices);
    setLinks(norm.links);
    setSelectedIds(snap?.selectedIds || (snap?.selectedId ? [snap.selectedId] : []));
    setOpenConsoles(snap?.openConsoles || []);
    setActiveBottom((snap?.activeBottom && snap.activeBottom !== "pka-report") ? snap.activeBottom : "events");
    setPtActivity(snap?.ptActivity || null);
    setPtSidebarOpen(snap?.ptSidebarOpen ?? !!snap?.ptActivity);
    setServerModuleOpen(false);
    setAppsSidebarOpen(false);
    setActiveCenterTab("topology");
  };
  const newBlankTab = () => {
    setStarterScreenVisible(false);
    snapshotsRef.current[activeWid] = { devices, links, selectedIds, openConsoles, activeBottom, ptActivity, ptSidebarOpen };
    const id = `w-${Date.now()}`;
    snapshotsRef.current[id] = { devices: {}, links: [], selectedIds: [], openConsoles: [], activeBottom: "events", ptActivity: null, ptSidebarOpen: false };
    setTabs((ts) => [...ts, { id, name: `untitled-${ts.length}.opt` }]);
    setActiveWid(id);
    setDevices({}); setLinks([]); setSelectedId(null); setOpenConsoles([]); setActiveBottom("events"); setPtActivity(null); setPtSidebarOpen(false);
    setServerModuleOpen(false);
    setAppsSidebarOpen(false);
    setActiveCenterTab("topology");
    setCloudProjectId(null); setCloudVersion(0); setCloudBaseDoc(null); setCloudLease(null); setShareToken(null); setShareMode(null); setSyncStatus({ state: cloudUser ? "local" : "local", message: cloudUser ? "Signed in" : "Local only" });
  };
  const newStarterTab = () => {
    const before = captureAppSnapshot();
    setStarterScreenVisible(false);
    snapshotsRef.current[activeWid] = { devices, links, selectedIds, openConsoles, activeBottom, ptActivity, ptSidebarOpen };
    const id = `w-${Date.now()}`;
    const s = OPT_Engine.makeStarter();
    snapshotsRef.current[id] = { devices: s.devices, links: s.links, selectedIds: [], openConsoles: [], activeBottom: "events", ptActivity: null, ptSidebarOpen: false };
    setTabs((ts) => [...ts, { id, name: `lab-${ts.length + 1}.opt` }]);
    setActiveWid(id);
    skipNextSnapshot.current = true;
    setDevices(s.devices); setLinks(s.links); setSelectedId(null); setOpenConsoles([]); setActiveBottom("events"); setPtActivity(null); setPtSidebarOpen(false);
    setServerModuleOpen(false);
    setAppsSidebarOpen(false);
    setActiveCenterTab("topology");
    setCloudProjectId(null); setCloudVersion(0); setCloudBaseDoc(null); setCloudLease(null); setShareToken(null); setShareMode(null); setSyncStatus({ state: cloudUser ? "local" : "local", message: cloudUser ? "Signed in" : "Local only" });
    setDirtyTabs((m) => ({ ...m, [id]: true }));
    pushAppUndo("opened starter lab", before);
  };
  const loadPracticeLab = async (key) => {
    const lab = makeOpenPtPracticeLab(key);
    if (!lab) return;
    const ok = await requestConfirm({ title: `Load ${lab.title}?`, message: "Replace the current topology with this practice lab?", confirmLabel: "Load lab", danger: true });
    if (!ok) return;
    if (!markProjectChanged("load-practice-lab")) return;
    const norm = OPT_Engine.normalizeTopology(lab.devices, lab.links);
    setStarterScreenVisible(false);
    setDevices(norm.devices);
    setLinks(norm.links);
    setSelectedId(null);
    setSelectedLinkId(null);
    setEvents([]);
    setPackets([]);
    setPtActivity(lab.activity);
    setPtSidebarOpen(true);
    setActiveCenterTab("topology");
    setTabs((ts) => ts.map((tab) => tab.id === activeWid ? { ...tab, name: `${lab.fileName}.opt` } : tab));
    log("ok", "system", `loaded lab: ${lab.title}`);
  };
  const closeTab = async (id) => {
    if (dirtyTabs[id]) {
      const ok = await requestConfirm({
        title: "Close changed tab?",
        message: "This tab has unsaved local changes. Close it anyway?",
        confirmLabel: "Close tab",
        danger: true,
      });
      if (!ok) return;
    }
    const remaining = tabs.filter(x => x.id !== id);
    if (!remaining.length) return;
    if (activeWid === id) {
      const target = remaining[remaining.length - 1];
      const snap = snapshotsRef.current[target.id];
      const norm = OPT_Engine.normalizeTopology(snap?.devices || {}, snap?.links || []);
      delete snapshotsRef.current[id];
      setActiveWid(target.id);
      setDevices(norm.devices);
      setLinks(norm.links);
      setSelectedIds(snap?.selectedIds || (snap?.selectedId ? [snap.selectedId] : []));
      setOpenConsoles(snap?.openConsoles || []);
      setActiveBottom((snap?.activeBottom && snap.activeBottom !== "pka-report") ? snap.activeBottom : "events");
      setPtActivity(snap?.ptActivity || null);
      setPtSidebarOpen(snap?.ptSidebarOpen ?? !!snap?.ptActivity);
      setAppsSidebarOpen(false);
      setActiveCenterTab("topology");
    } else {
      delete snapshotsRef.current[id];
    }
    setTabs(remaining);
    setOpenAppTabs((items) => items.filter((item) => item.wid !== id));
    setDirtyTabs((m) => {
      const next = { ...m };
      delete next[id];
      return next;
    });
  };
  const renameTab = (id, name) => {
    setTabs((ts) => ts.map(x => x.id === id ? { ...x, name } : x));
  };

  // ── Undo/Redo (devices + links, scoped per workspace) ─────
  const undoRef = useRef({});  // { [wid]: { past: [], future: [] } }
  const skipNextSnapshot = useRef(false);
  const prevSnap = useRef({ devices, links });
  useEffect(() => {
    if (suppressHistoryRef.current) return;
    if (skipNextSnapshot.current) {
      skipNextSnapshot.current = false;
      prevSnap.current = { devices, links };
      return;
    }
    if (prevSnap.current.devices === devices && prevSnap.current.links === links) return;
    const wid = activeWid;
    if (!undoRef.current[wid]) undoRef.current[wid] = { past: [], future: [] };
    const h = undoRef.current[wid];
    h.past.push(prevSnap.current);
    if (h.past.length > 80) h.past.shift();
    h.future = [];
    prevSnap.current = { devices, links };
    setHistoryVersion((n) => n + 1);
  }, [devices, links, activeWid]);

  // When switching tabs, the snapshot ref needs to reset prev
  useEffect(() => { prevSnap.current = { devices, links }; }, [activeWid]);

  const undo = () => {
    const h = undoRef.current[activeWid];
    if ((!h || !h.past.length) && appUndoRef.current.past.length) {
      const entry = appUndoRef.current.past.pop();
      entry.after = entry.after || captureAppSnapshot();
      appUndoRef.current.future.push(entry);
      applyAppSnapshot(entry.before);
      log("dim", "system", `undid ${entry.label}`);
      setHistoryVersion((n) => n + 1);
      return;
    }
    if (!h || !h.past.length) return;
    const prev = h.past.pop();
    const current = { devices, links };
    const description = describeTopologyChange(prev, current);
    h.future.push(current);
    skipNextSnapshot.current = true;
    setDevices(prev.devices);
    setLinks(prev.links);
    log("dim", "system", `undid ${description}`);
    setHistoryVersion((n) => n + 1);
  };
  const redo = () => {
    const h = undoRef.current[activeWid];
    if ((!h || !h.future.length) && appUndoRef.current.future.length) {
      const entry = appUndoRef.current.future.pop();
      appUndoRef.current.past.push(entry);
      applyAppSnapshot(entry.after);
      log("dim", "system", `redid ${entry.label}`);
      setHistoryVersion((n) => n + 1);
      return;
    }
    if (!h || !h.future.length) return;
    const next = h.future.pop();
    const current = { devices, links };
    const description = describeTopologyChange(current, next);
    h.past.push(current);
    skipNextSnapshot.current = true;
    setDevices(next.devices);
    setLinks(next.links);
    log("dim", "system", `redid ${description}`);
    setHistoryVersion((n) => n + 1);
  };
  const canUndo = !!undoRef.current[activeWid]?.past?.length || !!appUndoRef.current.past.length || historyVersion < 0;
  const canRedo = !!undoRef.current[activeWid]?.future?.length || !!appUndoRef.current.future.length || historyVersion < 0;
  const [cliHistory, setCliHistory] = useState([]);
  const [events, setEvents] = useState([]);
  const [packets, setPackets] = useState([]);
  const [packetsCounter, setPacketsCounter] = useState(0);
  const [linkMode, setLinkMode] = useState(false);
  const [forceLinkType, setForceLinkType] = useState(null);
  const [packetMode, setPacketMode] = useState(null);  // { stage: "src" | "dst", src?: id }
  const [activeHopDeviceId, setActiveHopDeviceId] = useState(null);
  const [simRunning, setSimRunning] = useState(false);
  const [toast, setToast] = useState(null);
  const [fileDropActive, setFileDropActive] = useState(false);
  const [ctx, setCtx] = useState(null);  // { x, y, devId }
  const [pendingCmd, setPendingCmd] = useState(null);  // { devId, cmd, nonce }
  const [cliFocusNonce, setCliFocusNonce] = useState(0);
  const [bottomPanelHeight, setBottomPanelHeight] = useState(() => {
    try {
      const saved = Number(localStorage.getItem("openpt:bottom-height"));
      return Number.isFinite(saved) ? Math.max(120, Math.min(640, saved)) : 280;
    } catch (e) { return 280; }
  });
  const [packetTracerSidebarWidth, setPacketTracerSidebarWidth] = useState(340);
  const syncClient = useMemo(() => Sync ? new Sync.OpenPTSyncClient() : null, []);
  const [cloudUser, setCloudUser] = useState(null);
  const [cloudProjects, setCloudProjects] = useState([]);
  const [cloudProjectId, setCloudProjectId] = useState(null);
  const [cloudVersion, setCloudVersion] = useState(0);
  const [cloudBaseDoc, setCloudBaseDoc] = useState(null);
  const [cloudLease, setCloudLease] = useState(null);
  const [shareToken, setShareToken] = useState(null);
  const [shareMode, setShareMode] = useState(null);
  const [syncStatus, setSyncStatus] = useState({ state: "local", message: "Local only" });
  const [authOpen, setAuthOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [conflict, setConflict] = useState(null);
  const [meaningfulChanges, setMeaningfulChanges] = useState(0);
  const [firstDirtyAt, setFirstDirtyAt] = useState(null);
  const [topologyViewState, setTopologyViewState] = useState({});
  const [terminalScrolls, setTerminalScrolls] = useState({});
  const [clockTick, setClockTick] = useState(0);
  const lastSaveAtRef = useRef(0);
  const saveInFlightRef = useRef(false);
  const savePromiseRef = useRef(null);
  const createProjectInFlightRef = useRef(false);
  const latestSaveStateRef = useRef({});

  useEffect(() => {
    try { localStorage.setItem("openpt:bottom-height", String(bottomPanelHeight)); } catch (e) {}
  }, [bottomPanelHeight]);
  useEffect(() => {
    if (meaningfulChanges <= 0) return;
    const t = setInterval(() => setClockTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [meaningfulChanges]);

  const readOnlyReason = (() => {
    if (shareMode === "read") return "This share link is read-only.";
    if ((cloudProjectId || shareToken) && !cloudLease) return "Acquire the edit lease before editing.";
    return "";
  })();
  const canEditProject = !readOnlyReason;

  const markProjectChanged = (reason) => {
    if (!canEditProject) {
      setToast({ kind: "warn", msg: readOnlyReason });
      return false;
    }
    setDirtyTabs((m) => ({ ...m, [activeWid]: true }));
    setMeaningfulChanges((n) => n + 1);
    setFirstDirtyAt((t) => t || Date.now());
    if (cloudProjectId || shareToken) setSyncStatus({ state: "dirty", message: "Unsaved changes" });
    return true;
  };

  const currentProjectTitle = stripProjectExtension(tabs.find((tab) => tab.id === activeWid)?.name || "Untitled OpenPT project");
  const currentProjectDoc = useMemo(() => projectDocFromState({
    title: currentProjectTitle,
    devices,
    links,
    uiState: {
      selectedIds,
      openConsoles,
      activeBottom,
      ptActivity,
      ptSidebarOpen,
      topologyViewState,
      terminalScrolls: terminalScrollPayload(terminalScrolls),
    },
  }), [currentProjectTitle, devices, links, selectedIds, openConsoles, activeBottom, ptActivity, ptSidebarOpen, topologyViewState, terminalScrolls]);
  latestSaveStateRef.current = {
    activeWid,
    currentProjectDoc,
    cloudProjectId,
    cloudVersion,
    cloudBaseDoc,
    cloudLease,
    shareToken,
    meaningfulChanges,
  };
  const gradedPtActivity = useMemo(() => gradePacketTracerActivity(ptActivity, devices, links), [ptActivity, devices, links]);

  const exportOtpPackage = () => {
    const pkg = buildOtpPackage({
      title: currentProjectTitle,
      devices,
      links,
      uiState: {
        selectedIds,
        openConsoles,
        activeBottom,
        ptSidebarOpen,
        topologyViewState,
        terminalScrolls: terminalScrollPayload(terminalScrolls),
      },
      ptActivity: gradedPtActivity || ptActivity,
      events,
      packets,
      cliHistory,
      cloudProjectId,
      cloudVersion,
    });
    downloadJSON(pkg, safeExportName(currentProjectTitle, "otp"), "application/openpt+json");
    log("ok", "export", `exported ${safeExportName(currentProjectTitle, "otp")}`);
  };

  const applyProjectDocument = (document, project = null) => {
    setStarterScreenVisible(false);
    const norm = OPT_Engine.normalizeTopology(document?.devices || {}, document?.links || []);
    setDevices(norm.devices);
    setLinks(norm.links);
    setSelectedIds(document?.uiState?.selectedIds || []);
    setOpenConsoles(document?.uiState?.openConsoles || []);
    setActiveBottom((document?.uiState?.activeBottom && document.uiState.activeBottom !== "pka-report") ? document.uiState.activeBottom : "events");
    setPtActivity(document?.uiState?.ptActivity || null);
    setPtSidebarOpen(document?.uiState?.ptSidebarOpen ?? !!document?.uiState?.ptActivity);
    setTopologyViewState(document?.uiState?.topologyViewState || {});
    setTerminalScrolls(document?.uiState?.terminalScrolls || {});
    setAppsSidebarOpen(false);
    setActiveCenterTab("topology");
    if (project) setTabs((ts) => mergeProjectIntoTabs(ts, activeWid, project));
  };

  const resetSyncState = ({ clearProject = false, clearShare = false, clearSaveCounters = false, clearDirty = false, status = null } = {}) => {
    if (clearProject) {
      setCloudProjectId(null);
      setCloudVersion(0);
      setCloudBaseDoc(null);
    }
    if (clearShare) {
      setShareToken(null);
      setShareMode(null);
    }
    setCloudLease(null);
    if (clearSaveCounters || clearDirty) {
      setMeaningfulChanges(0);
      setFirstDirtyAt(null);
    }
    if (clearDirty) {
      setDirtyTabs((m) => ({ ...m, [activeWid]: false }));
    }
    if (status) setSyncStatus(status);
  };

  const releaseCurrentLease = async () => {
    const state = latestSaveStateRef.current;
    if (!syncClient || !state.cloudProjectId || !state.cloudLease || state.shareToken) return;
    await syncClient.releaseLease(state.cloudProjectId, state.cloudLease.id).catch(() => {});
  };

  const refreshProjects = async () => {
    if (!syncClient || !cloudUser) return;
    const data = await syncClient.listProjects();
    setCloudProjects(data.projects || []);
  };

  const saveCloudNow = async ({ force = false, queueOffline = true } = {}) => {
    if (!syncClient) return { ok: false, reason: "sync-unavailable" };
    if (savePromiseRef.current) {
      if (force) {
        await savePromiseRef.current.catch(() => {});
        return saveCloudNow({ force, queueOffline });
      }
      return { ok: false, reason: "in-flight" };
    }
    saveInFlightRef.current = true;
    const runSave = async () => {
      let state = latestSaveStateRef.current;
      if (state.meaningfulChanges <= 0) return { ok: true, saved: false };
      if (!state.cloudProjectId || !state.cloudBaseDoc || !state.cloudLease) {
        if (force) throw new Error("Save the project and acquire the edit lease before sharing.");
        return { ok: false, reason: "not-ready" };
      }
      const minDelay = SYNC_MIN_SAVE_MS - (Date.now() - lastSaveAtRef.current);
      if (minDelay > 0) {
        if (!force) return { ok: false, reason: "rate-limited" };
        setSyncStatus({ state: "saving", message: "Waiting to save latest changes..." });
        await new Promise((resolve) => setTimeout(resolve, minDelay));
      }
      state = latestSaveStateRef.current;
      if (state.meaningfulChanges <= 0) return { ok: true, saved: false };
      if (!state.cloudProjectId || !state.cloudBaseDoc || !state.cloudLease) {
        if (force) throw new Error("Save the project and acquire the edit lease before sharing.");
        return { ok: false, reason: "not-ready" };
      }
      const patches = Sync.buildProjectPatches(state.cloudBaseDoc, state.currentProjectDoc);
      const uiStatePatch = Sync.buildUiPatches(state.cloudBaseDoc, state.currentProjectDoc);
      if (!patches.length && !uiStatePatch.length) {
        setMeaningfulChanges(0);
        setFirstDirtyAt(null);
        return { ok: true, saved: false };
      }
      const batch = {
        baseVersion: state.cloudVersion,
        leaseId: state.cloudLease.id,
        patches,
        uiStatePatch,
      };
      setSyncStatus({ state: "saving", message: "Saving..." });
      try {
        const data = state.shareToken
          ? await syncClient.saveSharePatch(state.shareToken, batch)
          : await syncClient.savePatch(state.cloudProjectId, batch);
        lastSaveAtRef.current = Date.now();
        setCloudVersion(data.project.version);
        setCloudBaseDoc(data.document);
        setMeaningfulChanges(0);
        setFirstDirtyAt(null);
        setDirtyTabs((m) => ({ ...m, [state.activeWid]: false }));
        setSyncStatus({ state: "synced", message: `Saved v${data.project.version}` });
        await Sync.saveLocalDocument(state.shareToken ? `share:${state.shareToken}` : `project:${state.cloudProjectId}`, data.document, { version: data.project.version });
        return { ok: true, saved: true, project: data.project, document: data.document };
      } catch (err) {
        if (err.status === 409) {
          setConflict(err.data || { error: err.message });
          setSyncStatus({ state: "conflict", message: "Server has a newer version" });
        } else if (err.status === 423) {
          setCloudLease(null);
          setSyncStatus({ state: "readonly", message: err.data?.lease?.clientLabel ? `Editing on ${err.data.lease.clientLabel}` : "Edit lease required" });
        } else if (!navigator.onLine || err.status === 0 || !err.status) {
          if (queueOffline) {
            await Sync.enqueue({ projectId: state.cloudProjectId, shareToken: state.shareToken, batch });
            setSyncStatus({ state: "offline", message: "Offline changes queued" });
            return { ok: false, queued: true, reason: "offline" };
          }
          setSyncStatus({ state: "err", message: "Save must finish online before sharing" });
        } else if (err.status === 429) {
          setSyncStatus({ state: "dirty", message: "Waiting for autosave limit" });
          if (!force) setTimeout(() => saveCloudNow(), SYNC_MIN_SAVE_MS);
        } else {
          setSyncStatus({ state: "err", message: err.message || "Save failed" });
        }
        if (force) throw err;
        return { ok: false, reason: "failed", error: err };
      }
    };
    savePromiseRef.current = runSave().finally(() => {
      saveInFlightRef.current = false;
      savePromiseRef.current = null;
    });
    return savePromiseRef.current;
  };

  useEffect(() => {
    if (!syncClient) return;
    Sync.saveLocalDocument(`local:${activeWid}`, currentProjectDoc, { activeWid }).catch(() => {});
  }, [syncClient, activeWid, currentProjectDoc]);

  useEffect(() => {
    if (!syncClient || meaningfulChanges <= 0 || (!cloudProjectId && !shareToken) || !cloudLease) return;
    const elapsed = firstDirtyAt ? Date.now() - firstDirtyAt : 0;
    const saveDelay = meaningfulChanges >= SYNC_AUTOSAVE_CHANGES ? 0 : Math.max(0, SYNC_AUTOSAVE_MS - elapsed);
    const minDelay = Math.max(0, SYNC_MIN_SAVE_MS - (Date.now() - lastSaveAtRef.current));
    const t = setTimeout(() => saveCloudNow(), Math.max(saveDelay, minDelay));
    return () => clearTimeout(t);
  }, [syncClient, meaningfulChanges, firstDirtyAt, cloudProjectId, shareToken, cloudLease?.id, cloudVersion, currentProjectDoc]);

  useEffect(() => {
    if (!syncClient) return;
    const replay = async () => {
      if (!navigator.onLine) return;
      const rows = await Sync.queued().catch(() => []);
      for (const row of rows) {
        try {
          const data = row.shareToken
            ? await syncClient.saveSharePatch(row.shareToken, row.batch)
            : await syncClient.savePatch(row.projectId, row.batch);
          await Sync.dequeue(row.id);
          const active = latestSaveStateRef.current;
          if ((row.shareToken && row.shareToken === active.shareToken) || (!row.shareToken && row.projectId === active.cloudProjectId)) {
            setCloudVersion(data.project.version);
            setCloudBaseDoc(data.document);
            setMeaningfulChanges(0);
            setFirstDirtyAt(null);
            setDirtyTabs((m) => ({ ...m, [active.activeWid]: false }));
            setSyncStatus({ state: "synced", message: `Queued save synced v${data.project.version}` });
          }
        } catch (err) {
          if (err.status === 409) {
            setConflict(err.data || { error: err.message });
            setSyncStatus({ state: "conflict", message: "Queued save has a newer server version" });
          } else if (err.status === 423) {
            setCloudLease(null);
            setSyncStatus({ state: "readonly", message: "Queued save paused until a fresh edit lease is acquired" });
          } else if (err.status === 429) {
            setSyncStatus({ state: "offline", message: "Queued save will retry after the autosave limit" });
          }
          break;
        }
      }
    };
    window.addEventListener("online", replay);
    replay();
    return () => window.removeEventListener("online", replay);
  }, [syncClient]);

  const createSyncedProject = async () => {
    if (!syncClient || !cloudUser) return setAuthOpen(true);
    if (createProjectInFlightRef.current) return;
    createProjectInFlightRef.current = true;
    try {
      setSyncStatus({ state: "saving", message: "Creating cloud project..." });
      const data = await syncClient.createProject(currentProjectTitle, currentProjectDoc);
      resetSyncState({ clearShare: true, clearDirty: true });
      setCloudProjectId(data.project.id);
      setCloudVersion(data.project.version);
      setCloudBaseDoc(data.document);
      lastSaveAtRef.current = Date.now();
      setMeaningfulChanges(0);
      setFirstDirtyAt(null);
      const lease = await syncClient.acquireLease(data.project.id, true);
      setCloudLease(lease.lease);
      setTabs((ts) => mergeProjectIntoTabs(ts, activeWid, data.project));
      setDirtyTabs((m) => ({ ...m, [activeWid]: false }));
      setSyncStatus({ state: "synced", message: `Cloud project saved v${data.project.version}` });
      await refreshProjects();
    } catch (err) {
      setSyncStatus({ state: "err", message: err.message || "Could not create project" });
    } finally {
      createProjectInFlightRef.current = false;
    }
  };

  const openCloudProject = async (projectId) => {
    if (!syncClient) return;
    if (dirtyTabs[activeWid] || meaningfulChanges > 0) {
      const ok = await requestConfirm({
        title: "Open synced project?",
        message: "This tab has unsaved changes. Opening a synced project will replace the current tab contents.",
        confirmLabel: "Open project",
        danger: true,
      });
      if (!ok) return;
    }
    try {
      await releaseCurrentLease();
      const data = await syncClient.loadProject(projectId);
      resetSyncState({ clearShare: true, clearDirty: true });
      setCloudProjectId(data.project.id);
      setCloudVersion(data.project.version);
      setCloudBaseDoc(data.document);
      applyProjectDocument(data.document, data.project);
      try {
        const lease = await syncClient.acquireLease(projectId, false);
        setCloudLease(lease.lease);
        setSyncStatus({ state: "synced", message: `Opened v${data.project.version}` });
      } catch (err) {
        setCloudLease(null);
        setSyncStatus({ state: "readonly", message: err.data?.lease?.clientLabel ? `Read-only: editing on ${err.data.lease.clientLabel}` : "Read-only: lease unavailable" });
      }
      setProjectsOpen(false);
    } catch (err) {
      setToast({ kind: "err", msg: err.message || "Could not open project" });
    }
  };

  const acquireCurrentLease = async (takeover = false) => {
    if (!syncClient || !cloudProjectId) return;
    try {
      const data = shareToken
        ? await syncClient.acquireShareLease(shareToken, takeover)
        : await syncClient.acquireLease(cloudProjectId, takeover);
      setCloudLease(data.lease);
      setSyncStatus({ state: "synced", message: takeover ? "Edit lease taken" : "Edit lease acquired" });
    } catch (err) {
      setSyncStatus({ state: "readonly", message: err.data?.lease?.clientLabel ? `Editing on ${err.data.lease.clientLabel}` : err.message });
    }
  };

  const createShareLink = async (mode) => {
    if (!syncClient || !cloudProjectId) return;
    try {
      if (meaningfulChanges > 0) {
        const saveResult = await saveCloudNow({ force: true, queueOffline: false });
        if (!saveResult?.ok) throw new Error("Latest changes were not saved, so the share link was not created.");
      }
      const data = await syncClient.shareProject(cloudProjectId, mode);
      const absolute = `${location.origin}${data.share.url}`;
      setLastShareUrl(absolute);
      await navigator.clipboard?.writeText(absolute).catch(() => {});
      setToast({ kind: "ok", msg: `${mode === "edit" ? "Editable" : "Read-only"} link copied` });
    } catch (err) {
      setToast({ kind: "err", msg: err.message || "Could not create share link" });
    }
  };

  const logoutCloud = async () => {
    await releaseCurrentLease();
    await syncClient?.logout().catch(() => {});
    setCloudUser(null);
    setCloudProjects([]);
    resetSyncState({
      clearProject: true,
      clearShare: true,
      clearSaveCounters: true,
      status: { state: "local", message: "Local only" },
    });
    setProjectsOpen(false);
  };

  const restoreRollback = async (target) => {
    if (!syncClient || !cloudProjectId || shareToken) return;
    const ok = await requestConfirm({
      title: `Rollback ${target}?`,
      message: "OpenPT will restore an older version by creating a new cloud version. Your current server version remains in history.",
      confirmLabel: "Rollback",
      danger: true,
    });
    if (!ok) return;
    try {
      const data = await syncClient.rollback(cloudProjectId, target);
      setCloudVersion(data.project.version);
      setCloudBaseDoc(data.document);
      applyProjectDocument(data.document, data.project);
      setMeaningfulChanges(0);
      setFirstDirtyAt(null);
      setSyncStatus({ state: "synced", message: `Restored ${target} rollback` });
    } catch (err) {
      setToast({ kind: "err", msg: err.message || "Rollback failed" });
    }
  };

  // Run a show-command in a device's console (opens if needed)
  const runConsoleCmd = (devId, cmd) => {
    openConsole(devId);
    setPendingCmd({ devId, cmd, nonce: Date.now() });
  };

  useEffect(() => {
    if (!toast) return;
    const x = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(x);
  }, [toast]);

  useEffect(() => {
    if (!linkMode) setForceLinkType(null);
  }, [linkMode]);

  useEffect(() => {
    if (!syncClient) return;
    syncClient.me().then((data) => {
      setCloudUser(data.user || null);
      if (data.user) setSyncStatus({ state: "local", message: "Signed in" });
    }).catch(() => setSyncStatus({ state: "local", message: "Local only" }));
  }, [syncClient]);

  useEffect(() => {
    if (!syncClient || !cloudUser) return;
    refreshProjects().catch(() => {});
  }, [syncClient, cloudUser?.id]);

  useEffect(() => {
    if (!syncClient) return;
    const match = location.pathname.match(/^\/share\/([^/]+)/);
    if (!match) return;
    const token = decodeURIComponent(match[1]);
    releaseCurrentLease();
    resetSyncState({ clearProject: true, clearShare: true, clearDirty: true });
    syncClient.loadShare(token).then((data) => {
      setShareToken(token);
      setShareMode(data.project.mode);
      setCloudProjectId(data.project.id);
      setCloudVersion(data.project.version);
      setCloudBaseDoc(data.document);
      applyProjectDocument(data.document, data.project);
      setDirtyTabs((m) => ({ ...m, [activeWid]: false }));
      setSyncStatus({ state: data.project.mode === "edit" ? "readonly" : "readonly", message: data.project.mode === "edit" ? "Shared project opened. Acquire edit lease to save." : "Read-only share" });
    }).catch((err) => {
      setToast({ kind: "err", msg: err.message || "Could not open share link" });
    });
  }, [syncClient]);

  useEffect(() => {
    if (!syncClient || !cloudProjectId || !cloudLease || shareToken) return;
    const t = setInterval(() => {
      syncClient.renewLease(cloudProjectId, cloudLease.id).then((data) => {
        setCloudLease(data.lease);
      }).catch(() => {
        setCloudLease(null);
        setSyncStatus({ state: "readonly", message: "Edit lease expired" });
      });
    }, 15_000);
    return () => clearInterval(t);
  }, [syncClient, cloudProjectId, cloudLease?.id, shareToken]);

  useEffect(() => {
    if (!syncClient || !shareToken || !cloudLease) return;
    const t = setInterval(() => {
      // Shared editable sessions renew by reacquiring the same lease.
      syncClient.acquireShareLease(shareToken, false).then((data) => setCloudLease(data.lease)).catch(() => {
        setCloudLease(null);
        setSyncStatus({ state: "readonly", message: "Edit lease expired" });
      });
    }, 15_000);
    return () => clearInterval(t);
  }, [syncClient, shareToken, cloudLease?.id]);

  const log = (severity, source, message) => {
    setEvents((e) => [
      ...e.slice(-200),
      { t: new Date().toLocaleTimeString("en-GB", { hour12: false }).slice(3), s: severity, src: source, m: ifaceText(message) },
    ]);
  };

  const beginResize = (kind, event) => {
    event.preventDefault();
    const startX = event.clientX;
    const startY = event.clientY;
    const startHeight = bottomPanelHeight;
    const startWidth = packetTracerSidebarWidth;
    const startServerWidth = serverModuleWidth;
    const startAppsWidth = appsSidebarWidth;
    document.body.classList.add("is-resizing-layout");
    const onMove = (moveEvent) => {
      if (kind === "sidebar") {
        const maxWidth = Math.max(300, Math.min(window.innerWidth * 0.48, window.innerWidth - 420));
        setPacketTracerSidebarWidth(Math.max(260, Math.min(maxWidth, startWidth + moveEvent.clientX - startX)));
        return;
      }
      if (kind === "server") {
        const maxWidth = Math.max(460, Math.min(window.innerWidth * 0.58, window.innerWidth - 420));
        setServerModuleWidth(Math.max(430, Math.min(maxWidth, startServerWidth - (moveEvent.clientX - startX))));
        return;
      }
      if (kind === "apps") {
        const maxWidth = Math.max(360, Math.min(window.innerWidth * 0.44, window.innerWidth - 420));
        setAppsSidebarWidth(Math.max(380, Math.min(maxWidth, startAppsWidth - (moveEvent.clientX - startX))));
        return;
      }
      const maxHeight = Math.max(180, window.innerHeight - 170);
      setBottomPanelHeight(Math.max(120, Math.min(maxHeight, startHeight - (moveEvent.clientY - startY))));
    };
    const onUp = () => {
      document.body.classList.remove("is-resizing-layout");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    window.addEventListener("pointercancel", onUp, { once: true });
  };

  const createEmptyProjectFromStarterScreen = () => {
    const blank = {
      devices: {},
      links: [],
      selectedIds: [],
      openConsoles: [],
      activeBottom: "events",
      ptActivity: null,
      ptSidebarOpen: false,
    };
    snapshotsRef.current[activeWid] = blank;
    setDevices({});
    setLinks([]);
    setSelectedIds([]);
    setOpenConsoles([]);
    setActiveBottom("events");
    setPtActivity(null);
    setPtSidebarOpen(false);
    setTopologyViewState({});
    setTerminalScrolls({});
    setEvents([]);
    setPackets([]);
    setStarterScreenVisible(false);
    setCloudProjectId(null); setCloudVersion(0); setCloudBaseDoc(null); setCloudLease(null); setShareToken(null); setShareMode(null);
    setSyncStatus({ state: cloudUser ? "local" : "local", message: cloudUser ? "Signed in" : "Local only" });
    log("ok", "system", "created new empty project");
  };

  const openImportedTopology = (topology, filename) => {
    const before = captureAppSnapshot();
    setStarterScreenVisible(false);
    const norm = OPT_Engine.normalizeTopology(topology.devices || {}, topology.links || []);
    const tabName = filename.replace(/\.(json|opt)$/i, "") || "imported-lab";
    snapshotsRef.current[activeWid] = { devices, links, selectedIds, openConsoles, activeBottom, ptActivity, ptSidebarOpen };
    const id = `w-${Date.now()}`;
    snapshotsRef.current[id] = {
      devices: norm.devices,
      links: norm.links,
      selectedIds: [],
      openConsoles: [],
      activeBottom: "events",
      ptActivity: null,
      ptSidebarOpen: false,
    };
    setTabs((ts) => [...ts, { id, name: `${tabName}.opt` }]);
    setActiveWid(id);
    skipNextSnapshot.current = true;
    setDevices(norm.devices);
    setLinks(norm.links);
    setSelectedIds([]);
    setOpenConsoles([]);
    setActiveBottom("events");
    setPtActivity(null);
    setPtSidebarOpen(false);
    setCloudProjectId(null); setCloudVersion(0); setCloudBaseDoc(null); setCloudLease(null); setShareToken(null); setShareMode(null);
    setEvents([]);
    setPackets([]);
    setDirtyTabs((m) => ({ ...m, [id]: true }));
    setToast({ kind: "ok", msg: `Imported ${filename}` });
    log("ok", "import", `loaded ${filename}`);
    pushAppUndo(`imported ${filename}`, before);
  };

  const openImportedOtpPackage = (pkg, filename) => {
    const before = captureAppSnapshot();
    const document = projectDocumentFromOtpPackage(pkg);
    if (!document) throw new Error("Expected an OpenPT OTP package with a project document.");
    setStarterScreenVisible(false);
    const norm = OPT_Engine.normalizeTopology(document.devices || {}, document.links || []);
    const tabName = stripProjectExtension(document.title || filename) || "imported-lab";
    const restoredUi = document.uiState || {};
    snapshotsRef.current[activeWid] = { devices, links, selectedIds, openConsoles, activeBottom, ptActivity, ptSidebarOpen };
    const id = `w-${Date.now()}`;
    snapshotsRef.current[id] = {
      devices: norm.devices,
      links: norm.links,
      selectedIds: restoredUi.selectedIds || [],
      openConsoles: restoredUi.openConsoles || [],
      activeBottom: (restoredUi.activeBottom && restoredUi.activeBottom !== "pka-report") ? restoredUi.activeBottom : "events",
      ptActivity: restoredUi.ptActivity || null,
      ptSidebarOpen: restoredUi.ptSidebarOpen ?? !!restoredUi.ptActivity,
    };
    setTabs((ts) => [...ts, { id, name: `${tabName}.otp`, source: "openpt-otp" }]);
    setActiveWid(id);
    skipNextSnapshot.current = true;
    setDevices(norm.devices);
    setLinks(norm.links);
    setSelectedIds(restoredUi.selectedIds || []);
    setOpenConsoles(restoredUi.openConsoles || []);
    setActiveBottom((restoredUi.activeBottom && restoredUi.activeBottom !== "pka-report") ? restoredUi.activeBottom : "events");
    setPtActivity(restoredUi.ptActivity || null);
    setPtSidebarOpen(restoredUi.ptSidebarOpen ?? !!restoredUi.ptActivity);
    setTopologyViewState(restoredUi.topologyViewState || {});
    setTerminalScrolls(restoredUi.terminalScrolls || {});
    setCloudProjectId(null); setCloudVersion(0); setCloudBaseDoc(null); setCloudLease(null); setShareToken(null); setShareMode(null);
    setEvents(pkg.session?.events || []);
    setPackets(pkg.session?.packets || []);
    setCliHistory(pkg.session?.cliHistory || []);
    setDirtyTabs((m) => ({ ...m, [id]: true }));
    setToast({ kind: "ok", msg: `Imported ${filename}` });
    log("ok", "import", `loaded OpenPT package ${filename}`);
    pushAppUndo(`imported ${filename}`, before);
  };

  const openImportedPacketTracer = (activity, filename) => {
    const before = captureAppSnapshot();
    setStarterScreenVisible(false);
    const topology = buildTopologyFromPacketTracer(activity);
    const norm = OPT_Engine.normalizeTopology(topology.devices || {}, topology.links || []);
    const title = activity?.title || filename.replace(/\.(pka|pkt)$/i, "") || "packet-tracer-assignment";
    snapshotsRef.current[activeWid] = { devices, links, selectedIds, openConsoles, activeBottom, ptActivity, ptSidebarOpen };
    const id = `w-${Date.now()}`;
    // Assignment instructions, progress, and rubric all live in the left sidebar now;
    // the PKA Report bottom panel is no longer auto-opened (and is hidden) on import.
    snapshotsRef.current[id] = {
      devices: norm.devices,
      links: norm.links,
      selectedIds: [],
      openConsoles: [],
      activeBottom: "events",
      ptActivity: activity,
      ptSidebarOpen: true,
    };
    setTabs((ts) => [...ts, { id, name: `${title}.pka`, source: "packet-tracer" }]);
    setActiveWid(id);
    skipNextSnapshot.current = true;
    setDevices(norm.devices);
    setLinks(norm.links);
    setSelectedIds([]);
    setOpenConsoles([]);
    setActiveBottom("events");
    setPtActivity(activity);
    setPtSidebarOpen(true);
    setCloudProjectId(null); setCloudVersion(0); setCloudBaseDoc(null); setCloudLease(null); setShareToken(null); setShareMode(null);
    setEvents([]);
    setPackets([]);
    setDirtyTabs((m) => ({ ...m, [id]: true }));
    setLastImportReport(activity);
    pushAppUndo(`imported ${filename}`, before);
    if (activity?.unsupported) {
      const shortHash = activity.sourceSha256 ? activity.sourceSha256.slice(0, 12) : activity.sourceHeadHex;
      const decoderError = activity.reverseReport?.decoder?.error;
      setToast({ kind: "warn", msg: decoderError ? `Could not decode ${filename}` : `No extractor profile for ${filename}` });
      log("warn", "import", decoderError
        ? `Packet Tracer decoder failed for ${filename}${shortHash ? ` (${shortHash})` : ""}: ${decoderError}`
        : `Packet Tracer file recognized, but no extractor profile is packaged for ${filename}${shortHash ? ` (${shortHash})` : ""}`);
      return;
    }
    setToast({ kind: "ok", msg: `Imported ${filename}` });
    const detail = activity?.progress?.score ? ` score ${activity.progress.score}` : `${norm.links.length} links`;
    log("ok", "import", `loaded Packet Tracer assignment ${filename} (${detail})`);
  };

  const importPacketTracerActivity = async (file) => {
    if (!PacketTracerImporter?.importPacketTracerFile) {
      throw new Error("Packet Tracer importer module did not load.");
    }
    return PacketTracerImporter.importPacketTracerFile(file);
  };

  const openPacketTracerFilePicker = () => {
    if (!importFileInputRef.current) return;
    importFileInputRef.current.value = "";
    importFileInputRef.current.click();
  };

  const handleImportFile = async (file) => {
    const name = file.name || "dropped-file";
    const lower = name.toLowerCase();
    try {
      if (lower.endsWith(".otp")) {
        const data = JSON.parse(await file.text());
        openImportedOtpPackage(data, name);
        return;
      }
      if (lower.endsWith(".json") || lower.endsWith(".opt")) {
        const data = JSON.parse(await file.text());
        if (!data || typeof data !== "object" || !data.devices || !Array.isArray(data.links)) {
          throw new Error("Expected an OpenPT topology with devices and links.");
        }
        openImportedTopology(data, name);
        return;
      }
      if (lower.endsWith(".pka") || lower.endsWith(".pkt")) {
        const activity = await importPacketTracerActivity(file);
        openImportedPacketTracer(activity, name);
        return;
      }
      throw new Error("Drop an OpenPT .json/.opt/.otp file, or a Packet Tracer .pka/.pkt file for extractor diagnostics.");
    } catch (err) {
      const msg = err?.message || `Could not import ${name}`;
      setLastImportReport({ sourceName: name, unsupported: true, reverseReport: { decoder: { status: "failed", error: msg } } });
      setToast({ kind: "err", msg });
      log("err", "import", msg);
    }
  };

  const isFileDrag = (e) => Array.from(e.dataTransfer?.types || []).includes("Files");

  const handleDragEnter = (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragDepth.current += 1;
    setFileDropActive(true);
  };

  const handleDragOver = (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDragLeave = (e) => {
    if (!isFileDrag(e)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setFileDropActive(false);
  };

  const handleDrop = (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    dragDepth.current = 0;
    setFileDropActive(false);
    const files = Array.from(e.dataTransfer.files || []);
    if (files[0]) handleImportFile(files[0]);
  };

  useEffect(() => {
    log("ok", "system", starterScreenVisible ? "OpenPT initialized · waiting for a project" : "OpenPT initialized");
  }, []);

  // ── Device + link operations ─────────────────────────
  const addDevice = (catalogId, x, y) => {
    if (!markProjectChanged("add-device")) return;
    setStarterScreenVisible(false);
    const cat = DeviceCatalog.find(c => c.id === catalogId) || DeviceCatalog.find(c => c.kind === catalogId);
    const kind = cat?.kind || catalogId;
    // pick a friendly name
    const existing = Object.values(devices).filter(d => (cat?.platform ? d.platform === cat.platform : d.kind === kind)).length + 1;
    const baseName = { router: "R", l2switch: "SW", l3switch: "MLS", pc: "PC", mac: "MAC", laptop: "LAP", server: "SRV", wrt: "WRT", asa: "ASA", printer: "PRN", phone: "IPPHONE", ap: "AP", cloud: "CLOUD", internet: "INET", dslmodem: "DSL", cablemodem: "CABLE" }[kind] || "DEV";
    const d = OPT_Engine.makeDevice(kind, `${baseName}${existing}`, x, y, {}, { platform: cat?.platform });
    const id = d.id;
    if (OPT_Engine.isHostLike?.(d) || kind === "server") {
      const hostIface = d.interfaces.eth0 ? "eth0" : Object.keys(d.interfaces)[0];
      if (hostIface) {
        d.interfaces[hostIface].up = true;
        d.interfaces[hostIface].admUp = true;
      }
    }
    d.powered = cat?.pwr ?? true;
    setDevices((m) => ({ ...m, [id]: d }));
    log("ok", "topology", `added ${(cat?.label || d.model)} ${d.hostname}`);
    setSelectedId(id);
  };

  const visibleCanvasCenter = () => {
    const pan = topologyViewState?.pan || { x: 0, y: 0, k: 1 };
    const wrap = document.querySelector(".canvas-wrap");
    if (wrap) {
      const r = wrap.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) {
        return {
          x: (r.width / 2 - pan.x) / (pan.k || 1),
          y: (r.height / 2 - pan.y) / (pan.k || 1),
        };
      }
    }

    const ds = Object.values(devices);
    if (!ds.length) return { x: 320, y: 240 };
    return {
      x: (Math.min(...ds.map((d) => d.x)) + Math.max(...ds.map((d) => d.x))) / 2,
      y: (Math.min(...ds.map((d) => d.y)) + Math.max(...ds.map((d) => d.y))) / 2,
    };
  };

  const openCanvasPointNear = (base) => {
    const occupied = Object.values(devices);
    if (!occupied.length) return { x: Math.round(base.x), y: Math.round(base.y) };

    const clear = (p) => occupied.every((d) => Math.hypot((d.x || 0) - p.x, (d.y || 0) - p.y) >= 86);
    for (let ring = 0; ring <= 8; ring++) {
      const radius = ring * 72;
      const steps = ring ? Math.max(8, ring * 8) : 1;
      for (let i = 0; i < steps; i++) {
        const angle = -Math.PI / 2 + (i / steps) * Math.PI * 2;
        const p = {
          x: base.x + Math.cos(angle) * radius,
          y: base.y + Math.sin(angle) * radius,
        };
        if (clear(p)) return { x: Math.round(p.x), y: Math.round(p.y) };
      }
    }

    const offset = occupied.length * 36;
    return { x: Math.round(base.x + offset), y: Math.round(base.y + offset) };
  };

  const addDeviceFromMenu = (catalogId) => {
    const p = openCanvasPointNear(visibleCanvasCenter());
    setActiveCenterTab("topology");
    addDevice(catalogId, p.x, p.y);
  };

  const moveDevice = (id, x, y) => {
    if (!markProjectChanged("move-device")) return;
    setDevices((m) => ({ ...m, [id]: { ...m[id], x, y } }));
  };

  const deleteDevice = (id) => {
    if (!markProjectChanged("delete-device")) return;
    setLinks((ls) => ls.filter(l => l.a !== id && l.b !== id));
    setDevices((m) => {
      const next = { ...m }; const name = next[id]?.hostname; delete next[id];
      log("warn", "topology", `removed ${name}`);
      return next;
    });
    setSelectedId(null);
    setOpenConsoles((cs) => cs.filter(x => x !== id));
    setActiveBottom((cur) => cur === id ? "events" : cur);
  };

  const togglePower = (id) => {
    if (!markProjectChanged("power")) return;
    setDevices((m) => {
      const d = m[id];
      const powered = !d.powered;
      const ifaces = Object.fromEntries(Object.entries(d.interfaces).map(([k, v]) => [k, { ...v, up: powered ? v.up : false }]));
      log(powered ? "ok" : "warn", d.hostname, powered ? "power on" : "power off");
      return { ...m, [id]: { ...d, powered, interfaces: ifaces } };
    });
  };

  const renameDevice = (id, name) => {
    if (!markProjectChanged("rename-device")) return;
    setDevices((m) => ({ ...m, [id]: { ...m[id], hostname: name || m[id].hostname } }));
  };

  // ── Link creation
  const onLinkRequest = (aEndpoint, bEndpoint) => {
    const aId = typeof aEndpoint === "string" ? aEndpoint : aEndpoint?.devId;
    const bId = typeof bEndpoint === "string" ? bEndpoint : bEndpoint?.devId;
    const a = devices[aId], b = devices[bId];
    if (!a || !b) return;
    const requestedType = OPT_Engine.normalizeCableType?.(forceLinkType || "auto") || (forceLinkType || "auto");
    const aFree = aEndpoint?.iface || freeIface(a, links, aId, requestedType);
    const bFree = bEndpoint?.iface || freeIface(b, links, bId, requestedType);
    if (!aFree || !bFree) {
      const blocked = !aFree ? a : b;
      log("err", "topology", `no compatible free port on ${blocked.hostname}`);
      setToast({ kind: "err", msg: `No compatible free port on ${blocked.hostname}` });
      return;
    }
    const existing = links.find(l => (l.a === aId && l.ai === aFree) || (l.b === aId && l.bi === aFree) || (l.a === bId && l.ai === bFree) || (l.b === bId && l.bi === bFree));
    if (existing) {
      setToast({ kind: "err", msg: "That port is already connected." });
      return;
    }
    const compat = OPT_Engine.cableCompatibility?.(a, aFree, b, bFree, requestedType) || { ok: true, type: autoLinkType(a, b) };
    if (!compat.ok) {
      log("err", "topology", compat.reason);
      setToast({ kind: "err", msg: compat.reason });
      return;
    }
    if (!markProjectChanged("add-link")) return;
    const type = compat.type || autoLinkType(a, b);
    setForceLinkType(null);
    const link = { id: OPT_Engine.uid("l"), a: aId, ai: aFree, b: bId, bi: bFree, type, up: true };
    setLinks((ls) => [...ls, link]);
    // bring interfaces up
    setDevices((m) => ({
      ...m,
      [aId]: { ...m[aId], interfaces: { ...m[aId].interfaces, [aFree]: { ...m[aId].interfaces[aFree], up: true, admUp: true } } },
      [bId]: { ...m[bId], interfaces: { ...m[bId].interfaces, [bFree]: { ...m[bId].interfaces[bFree], up: true, admUp: true } } },
    }));
    log("ok", "topology", `wired ${a.hostname} ${ifaceName(aFree)} ↔ ${b.hostname} ${ifaceName(bFree)} (${type})`);
    if (compat.warning) {
      log("warn", "topology", compat.warning);
      setToast({ kind: "warn", msg: compat.warning });
    }
  };

  const onDeleteLink = (id) => {
    if (!markProjectChanged("delete-link")) return;
    const l = links.find(x => x.id === id);
    setLinks((ls) => ls.filter(x => x.id !== id));
    if (l) log("warn", "topology", `removed cable ${devices[l.a]?.hostname} ↔ ${devices[l.b]?.hostname}`);
  };

  // ── Apply CLI configuration command to a specific device
  const onApplyToDevice = (devId, cmd) => {
    if (!devId) return;
    if (!markProjectChanged("cli-command")) return;
    setDevices((m) => {
      if (cmd.kind === "host-dhcp") {
        const result = OPT_Engine.allocateDhcp(m, links, devId);
        log(result.message.startsWith("No ") ? "err" : "ok", m[devId].hostname, result.message);
        return OPT_Engine.recomputeDynamicRoutes(result.devices, links);
      }
      const baseDevice = OPT_Engine.normalizeDevice(m[devId]);
      const d = {
        ...baseDevice,
        interfaces: { ...baseDevice.interfaces },
        vlans: m[devId].vlans ? { ...m[devId].vlans } : undefined,
        routes: [...(m[devId].routes || [])],
        users: { ...(m[devId].users || {}) },
        secrets: { ...(m[devId].secrets || {}) },
        services: { ...(m[devId].services || {}) },
        lines: JSON.parse(JSON.stringify(m[devId].lines || {})),
        dhcp: JSON.parse(JSON.stringify(m[devId].dhcp || { excluded: [], pools: {}, bindings: [] })),
        ospf: JSON.parse(JSON.stringify(m[devId].ospf || {})),
        rip: JSON.parse(JSON.stringify(m[devId].rip || {})),
        eigrp: JSON.parse(JSON.stringify(m[devId].eigrp || {})),
        bgp: JSON.parse(JSON.stringify(m[devId].bgp || {})),
        acls: JSON.parse(JSON.stringify(m[devId].acls || {})),
        nat: JSON.parse(JSON.stringify(m[devId].nat || { pools: {}, rules: [], translations: [] })),
        routeMaps: JSON.parse(JSON.stringify(m[devId].routeMaps || {})),
        prefixLists: JSON.parse(JSON.stringify(m[devId].prefixLists || {})),
        vrfs: JSON.parse(JSON.stringify(m[devId].vrfs || {})),
        aaa: JSON.parse(JSON.stringify(m[devId].aaa || { enabled: false, methods: [] })),
        crypto: JSON.parse(JSON.stringify(m[devId].crypto || {})),
        snmp: JSON.parse(JSON.stringify(m[devId].snmp || { communities: [], hosts: [] })),
        ntp: JSON.parse(JSON.stringify(m[devId].ntp || { servers: [] })),
        netflow: JSON.parse(JSON.stringify(m[devId].netflow || { exporters: {}, monitors: {} })),
        ipSla: JSON.parse(JSON.stringify(m[devId].ipSla || {})),
        tracks: JSON.parse(JSON.stringify(m[devId].tracks || {})),
        qos: JSON.parse(JSON.stringify(m[devId].qos || { classMaps: {}, policyMaps: {}, servicePolicies: {} })),
        etherchannels: JSON.parse(JSON.stringify(m[devId].etherchannels || {})),
        span: JSON.parse(JSON.stringify(m[devId].span || [])),
        vtp: JSON.parse(JSON.stringify(m[devId].vtp || { mode: "transparent", domain: "" })),
        dhcpSnooping: JSON.parse(JSON.stringify(m[devId].dhcpSnooping || { enabled: false, vlans: [], trusted: [] })),
        dai: JSON.parse(JSON.stringify(m[devId].dai || { vlans: [], trusted: [] })),
        wireless: JSON.parse(JSON.stringify(m[devId].wireless || null)),
        firewall: JSON.parse(JSON.stringify(m[devId].firewall || null)),
        loggingHosts: [...(m[devId].loggingHosts || [])],
        files: { ...(m[devId].files || {}) },
      };
      const ifaces = { ...d.interfaces };
      switch (cmd.kind) {
        case "save-startup":
          d.startupConfig = cmd.config || OPT_Engine.serializeConfig(d);
          log("ok", d.hostname, "startup-config updated");
          break;
        case "erase-startup":
          d.startupConfig = "";
          log("warn", d.hostname, "startup-config erased");
          break;
        case "file-delete":
          delete d.files[cmd.path.startsWith("flash:") ? cmd.path : `flash:${cmd.path}`];
          break;
        case "hostname":
          d.hostname = cmd.value;
          log("ok", d.hostname, `hostname changed`);
          break;
        case "enable-secret":
          d.secrets.enable = cmd.value;
          log("ok", d.hostname, "enable secret set");
          break;
        case "service":
          d.services[cmd.name] = cmd.value;
          log("ok", d.hostname, `${cmd.value ? "" : "no "}service ${cmd.name}`);
          break;
        case "ip-domain-name":
          d.domainName = cmd.value;
          log("ok", d.hostname, cmd.value ? `ip domain-name ${cmd.value}` : "no ip domain-name");
          break;
        case "wireless":
          d.wireless = d.wireless || {};
          d.wireless[cmd.field] = cmd.value;
          log("ok", d.hostname, `wireless ${cmd.field} ${cmd.value}`);
          break;
        case "username":
          d.users[cmd.user] = { secret: cmd.secret };
          log("ok", d.hostname, `username ${cmd.user} configured`);
          break;
        case "line-password":
          d.lines[cmd.line] = { ...(d.lines[cmd.line] || {}), password: cmd.value };
          break;
        case "line-login":
          d.lines[cmd.line] = { ...(d.lines[cmd.line] || {}), login: cmd.value };
          break;
        case "line-transport":
          d.lines[cmd.line] = { ...(d.lines[cmd.line] || {}), transport: cmd.value };
          break;
        case "line-logging":
          d.lines[cmd.line] = { ...(d.lines[cmd.line] || {}), loggingSync: cmd.value };
          break;
        case "line-timeout":
          d.lines[cmd.line] = { ...(d.lines[cmd.line] || {}), timeout: { minutes: cmd.minutes, seconds: cmd.seconds } };
          break;
        case "ssh-version":
          d.ssh = { ...(d.ssh || {}), version: cmd.version };
          d.services.ssh = true;
          break;
        case "interface-create":
          if (!ifaces[cmd.iface]) {
            const sub = String(cmd.iface).match(/^(.+)\.(\d+)$/);
            ifaces[cmd.iface] = { ip: null, mask: null, up: true, admUp: true, mac: randMac(), desc: "", ...(sub ? { parentIface: sub[1] } : {}) };
            if (cmd.iface.toLowerCase().startsWith("vlan")) {
              const id = Number(cmd.iface.replace(/\D/g, ""));
              d.vlans = { ...(d.vlans || {}), [id]: d.vlans?.[id] || `VLAN${id}` };
            }
            log("ok", d.hostname, `interface ${ifaceName(cmd.iface)} created`);
          }
          break;
        case "host-ip":
          {
            const hostIface = cmd.iface || (ifaces.eth0 ? "eth0" : (ifaces.en0 ? "en0" : Object.keys(ifaces)[0]));
            ifaces[hostIface] = { ...ifaces[hostIface], ip: cmd.ip, mask: cmd.mask, gw: cmd.gw, dhcp: false, up: true, admUp: true };
            log("ok", d.hostname, `${ifaceName(hostIface)} address ${cmd.ip} ${cmd.mask} gateway ${cmd.gw}`);
          }
          break;
        case "ip-address":
          ifaces[cmd.iface] = { ...ifaces[cmd.iface], ip: cmd.ip, mask: cmd.mask };
          log("ok", d.hostname, `${ifaceName(cmd.iface)} address ${cmd.ip} ${cmd.mask}`);
          break;
        case "admin":
          ifaces[cmd.iface] = { ...ifaces[cmd.iface], admUp: cmd.up, up: cmd.up && hasLink(devId, cmd.iface, links) };
          log(cmd.up ? "ok" : "warn", d.hostname, `${ifaceName(cmd.iface)} ${cmd.up ? "no shutdown" : "shutdown"}`);
          break;
        case "desc":
          ifaces[cmd.iface] = { ...ifaces[cmd.iface], desc: cmd.value };
          break;
        case "nameif":
          ifaces[cmd.iface] = { ...ifaces[cmd.iface], nameif: cmd.value };
          break;
        case "security-level":
          ifaces[cmd.iface] = { ...ifaces[cmd.iface], securityLevel: cmd.value };
          break;
        case "swmode":
          ifaces[cmd.iface] = { ...ifaces[cmd.iface], routed: false, mode: cmd.value };
          log("ok", d.hostname, `${ifaceName(cmd.iface)} switchport mode ${cmd.value}`);
          break;
        case "swvlan":
          d.vlans = { ...(d.vlans || {}), [cmd.value]: d.vlans?.[cmd.value] || `VLAN${cmd.value}` };
          ifaces[cmd.iface] = { ...ifaces[cmd.iface], vlan: cmd.value };
          log("ok", d.hostname, `${ifaceName(cmd.iface)} access vlan ${cmd.value}`);
          break;
        case "voice-vlan":
          d.vlans = { ...(d.vlans || {}), [cmd.value]: d.vlans?.[cmd.value] || `VOICE${cmd.value}` };
          ifaces[cmd.iface] = { ...ifaces[cmd.iface], voiceVlan: cmd.value };
          log("ok", d.hostname, `${ifaceName(cmd.iface)} voice vlan ${cmd.value}`);
          break;
        case "trunk-native":
          d.vlans = { ...(d.vlans || {}), [cmd.value]: d.vlans?.[cmd.value] || `VLAN${cmd.value}` };
          ifaces[cmd.iface] = { ...ifaces[cmd.iface], nativeVlan: cmd.value, mode: "trunk" };
          log("ok", d.hostname, `${ifaceName(cmd.iface)} trunk native vlan ${cmd.value}`);
          break;
        case "trunk-allowed":
          ifaces[cmd.iface] = { ...ifaces[cmd.iface], allowedVlans: cmd.value, mode: "trunk" };
          log("ok", d.hostname, `${ifaceName(cmd.iface)} trunk allowed vlan ${cmd.value}`);
          break;
        case "routed-port":
          ifaces[cmd.iface] = { ...ifaces[cmd.iface], routed: cmd.value, mode: cmd.value ? undefined : "access", vlan: cmd.value ? undefined : (ifaces[cmd.iface].vlan || 1) };
          log("ok", d.hostname, `${ifaceName(cmd.iface)} ${cmd.value ? "no switchport" : "switchport"}`);
          break;
        case "iface-acl":
          ifaces[cmd.iface] = { ...ifaces[cmd.iface], acl: { ...(ifaces[cmd.iface].acl || {}), [cmd.dir]: cmd.acl } };
          if (!cmd.acl) delete ifaces[cmd.iface].acl[cmd.dir];
          log("ok", d.hostname, `${ifaceName(cmd.iface)} access-group ${cmd.dir} ${cmd.acl || "removed"}`);
          break;
        case "policy-route":
          ifaces[cmd.iface] = { ...ifaces[cmd.iface], policyRouteMap: cmd.name };
          log("ok", d.hostname, `${ifaceName(cmd.iface)} policy route-map ${cmd.name}`);
          break;
        case "nat-role":
          ifaces[cmd.iface] = { ...ifaces[cmd.iface], natRole: cmd.value };
          log("ok", d.hostname, `${ifaceName(cmd.iface)} nat role ${cmd.value || "removed"}`);
          break;
        case "stp-portfast":
          ifaces[cmd.iface] = { ...ifaces[cmd.iface], stp: { ...(ifaces[cmd.iface].stp || {}), portfast: cmd.value } };
          break;
        case "stp-guard":
          ifaces[cmd.iface] = { ...ifaces[cmd.iface], stp: { ...(ifaces[cmd.iface].stp || {}), guard: cmd.value } };
          break;
        case "stp-bpduguard":
          ifaces[cmd.iface] = { ...ifaces[cmd.iface], stp: { ...(ifaces[cmd.iface].stp || {}), bpduguard: cmd.value } };
          break;
        case "port-security":
          ifaces[cmd.iface] = { ...ifaces[cmd.iface], portSecurity: { ...(ifaces[cmd.iface].portSecurity || {}), ...cmd, enabled: cmd.enabled ?? ifaces[cmd.iface].portSecurity?.enabled ?? true } };
          delete ifaces[cmd.iface].portSecurity.kind;
          delete ifaces[cmd.iface].portSecurity.iface;
          break;
        case "channel-group": {
          const po = `Port-channel${cmd.id}`;
          ifaces[cmd.iface] = { ...ifaces[cmd.iface], channelGroup: { id: cmd.id, mode: cmd.mode } };
          if (!ifaces[po]) ifaces[po] = { ip: null, mask: null, up: true, admUp: true, mac: randMac(), desc: "", mode: ifaces[cmd.iface].mode || "trunk", vlan: ifaces[cmd.iface].vlan || 1, nativeVlan: ifaces[cmd.iface].nativeVlan || 1, allowedVlans: ifaces[cmd.iface].allowedVlans || "all" };
          d.etherchannels[cmd.id] = { protocol: ["active", "passive"].includes(cmd.mode) ? "LACP" : ["auto", "desirable"].includes(cmd.mode) ? "PAgP" : "static", members: [...new Set([...(d.etherchannels[cmd.id]?.members || []), cmd.iface])] };
          log("ok", d.hostname, `${ifaceName(cmd.iface)} joined channel-group ${cmd.id}`);
          break;
        }
        case "storm-control":
          ifaces[cmd.iface] = { ...ifaces[cmd.iface], stormControl: { ...(ifaces[cmd.iface].stormControl || {}), ...cmd } };
          delete ifaces[cmd.iface].stormControl.kind;
          delete ifaces[cmd.iface].stormControl.iface;
          break;
        case "dhcp-snoop-trust":
          ifaces[cmd.iface] = { ...ifaces[cmd.iface], dhcpSnoopingTrust: cmd.value };
          d.dhcpSnooping.trusted = cmd.value ? [...new Set([...(d.dhcpSnooping.trusted || []), cmd.iface])] : (d.dhcpSnooping.trusted || []).filter(x => x !== cmd.iface);
          break;
        case "dai-trust":
          ifaces[cmd.iface] = { ...ifaces[cmd.iface], daiTrust: cmd.value };
          d.dai.trusted = cmd.value ? [...new Set([...(d.dai.trusted || []), cmd.iface])] : (d.dai.trusted || []).filter(x => x !== cmd.iface);
          break;
        case "encapsulation":
          ifaces[cmd.iface] = { ...ifaces[cmd.iface], encapsulation: cmd.value };
          break;
        case "trunk-encapsulation":
          ifaces[cmd.iface] = { ...ifaces[cmd.iface], trunkEncapsulation: cmd.value, mode: "trunk" };
          break;
        case "ospf-priority":
          ifaces[cmd.iface] = { ...ifaces[cmd.iface], ospfPriority: cmd.priority };
          break;
        case "tunnel-source":
          ifaces[cmd.iface] = { ...ifaces[cmd.iface], tunnelSource: cmd.value };
          break;
        case "tunnel-destination":
          ifaces[cmd.iface] = { ...ifaces[cmd.iface], tunnelDestination: cmd.value };
          break;
        case "service-policy":
          ifaces[cmd.iface] = { ...ifaces[cmd.iface], servicePolicy: { ...(ifaces[cmd.iface].servicePolicy || {}), [cmd.dir]: cmd.policy } };
          break;
        case "pim":
          ifaces[cmd.iface] = { ...ifaces[cmd.iface], pim: cmd.mode };
          break;
        case "igmp-join":
          ifaces[cmd.iface] = { ...ifaces[cmd.iface], igmpGroups: [...new Set([...(ifaces[cmd.iface].igmpGroups || []), cmd.group])] };
          break;
        case "hsrp":
          ifaces[cmd.iface] = { ...ifaces[cmd.iface], hsrp: { ...(ifaces[cmd.iface].hsrp || {}), [cmd.group]: { ...(ifaces[cmd.iface].hsrp?.[cmd.group] || {}), ...(cmd.ip ? { ip: cmd.ip } : {}), ...(cmd.priority ? { priority: cmd.priority } : {}), priority: cmd.priority || ifaces[cmd.iface].hsrp?.[cmd.group]?.priority || 100 } } };
          break;
        case "speed":
        case "duplex":
          ifaces[cmd.iface] = { ...ifaces[cmd.iface], [cmd.kind]: cmd.value };
          break;
        case "vlan-add":
          d.vlans = { ...(d.vlans || {}), [cmd.id]: d.vlans?.[cmd.id] || `VLAN${cmd.id}` };
          log("ok", d.hostname, `vlan ${cmd.id} created`);
          break;
        case "vlan-remove":
          if (d.vlans) delete d.vlans[cmd.id];
          for (const [n, ifc] of Object.entries(ifaces)) if (String(ifc.vlan) === String(cmd.id)) ifaces[n] = { ...ifc, vlan: 1 };
          log("warn", d.hostname, `vlan ${cmd.id} removed`);
          break;
        case "vlan-name":
          d.vlans = { ...(d.vlans || {}), [cmd.id]: cmd.name };
          log("ok", d.hostname, `vlan ${cmd.id} named ${cmd.name}`);
          break;
        case "ip-route":
          d.routes = [...(d.routes || []).filter(r => !(r.type === "S" && r.dst === cmd.dst && r.mask === cmd.mask && r.via === cmd.via)), { dst: cmd.dst, mask: cmd.mask, via: cmd.via, iface: OPT_Engine.ifaceForVia(d, cmd.via), type: "S" }];
          log("ok", d.hostname, `ip route ${cmd.dst} ${cmd.mask} ${cmd.via}`);
          break;
        case "no-ip-route":
          d.routes = (d.routes || []).filter(r => !(r.type === "S" && r.dst === cmd.dst && r.mask === cmd.mask && r.via === cmd.via));
          log("warn", d.hostname, `removed ip route ${cmd.dst} ${cmd.mask} ${cmd.via}`);
          break;
        case "ip-routing":
          d.ipRouting = cmd.value;
          log(cmd.value ? "ok" : "warn", d.hostname, `${cmd.value ? "" : "no "}ip routing`);
          break;
        case "ospf-create":
          d.ospf[cmd.pid] = d.ospf[cmd.pid] || { networks: [], passive: [] };
          break;
        case "routing-create": {
          const db = cmd.proto === "eigrp" ? d.eigrp : cmd.proto === "rip" ? d.rip : d.bgp;
          db[cmd.id] = db[cmd.id] || { networks: [], passive: [], neighbors: [] };
          break;
        }
        case "routing-router-id": {
          const db = cmd.proto === "ospf" ? d.ospf : cmd.proto === "eigrp" ? d.eigrp : cmd.proto === "rip" ? d.rip : d.bgp;
          db[cmd.id] = { ...(db[cmd.id] || { networks: [], passive: [], neighbors: [] }), routerId: cmd.routerId };
          break;
        }
        case "ospf-network": {
          const ospf = d.ospf[cmd.pid] || { networks: [], passive: [] };
          ospf.networks = [...(ospf.networks || []).filter(n => !(n.network === cmd.network && n.wildcard === cmd.wildcard && n.area === cmd.area)), { network: cmd.network, wildcard: cmd.wildcard, area: cmd.area }];
          d.ospf[cmd.pid] = ospf;
          log("ok", d.hostname, `ospf ${cmd.pid} network ${cmd.network}`);
          break;
        }
        case "ospf-passive": {
          const ospf = d.ospf[cmd.pid] || { networks: [], passive: [] };
          ospf.passive = cmd.value ? [...new Set([...(ospf.passive || []), cmd.iface])] : (ospf.passive || []).filter(x => x !== cmd.iface);
          d.ospf[cmd.pid] = ospf;
          break;
        }
        case "ospf-default":
          d.ospf[cmd.pid] = { ...(d.ospf[cmd.pid] || { networks: [], passive: [] }), defaultOriginate: cmd.value };
          break;
        case "routing-network": {
          const db = cmd.proto === "eigrp" ? d.eigrp : cmd.proto === "rip" ? d.rip : d.bgp;
          const id = cmd.id || (cmd.proto === "rip" ? "rip" : "1");
          db[id] = db[id] || { networks: [], passive: [], neighbors: [] };
          db[id].networks = [...(db[id].networks || []).filter(n => n.network !== cmd.network), { network: cmd.network, wildcard: cmd.wildcard, mask: cmd.mask || wildcardToMaskSafe(cmd.wildcard) }];
          log("ok", d.hostname, `${cmd.proto} network ${cmd.network}`);
          break;
        }
        case "routing-passive": {
          const db = cmd.proto === "ospf" ? d.ospf : cmd.proto === "eigrp" ? d.eigrp : cmd.proto === "rip" ? d.rip : d.bgp;
          db[cmd.id] = db[cmd.id] || { networks: [], passive: [], neighbors: [] };
          db[cmd.id].passive = cmd.value ? [...new Set([...(db[cmd.id].passive || []), cmd.iface])] : (db[cmd.id].passive || []).filter(x => x !== cmd.iface);
          break;
        }
        case "routing-field": {
          const db = cmd.proto === "rip" ? d.rip : cmd.proto === "eigrp" ? d.eigrp : d.bgp;
          db[cmd.id] = { ...(db[cmd.id] || { networks: [], passive: [], neighbors: [] }), [cmd.field]: cmd.value };
          break;
        }
        case "bgp-neighbor":
          d.bgp[cmd.id] = d.bgp[cmd.id] || { networks: [], passive: [], neighbors: [] };
          d.bgp[cmd.id].neighbors = [...(d.bgp[cmd.id].neighbors || []).filter(n => n.ip !== cmd.ip), { ip: cmd.ip, remoteAs: cmd.remoteAs }];
          break;
        case "dhcp-pool":
          d.dhcp.pools[cmd.name] = d.dhcp.pools[cmd.name] || {};
          break;
        case "dhcp-exclude":
          d.dhcp.excluded = [...(d.dhcp.excluded || []), { start: cmd.start, end: cmd.end }];
          break;
        case "no-dhcp-exclude":
          d.dhcp.excluded = (d.dhcp.excluded || []).filter(e => !(e.start === cmd.start && e.end === cmd.end));
          break;
        case "dhcp-network":
          d.dhcp.pools[cmd.pool] = { ...(d.dhcp.pools[cmd.pool] || {}), network: cmd.network, mask: cmd.mask };
          log("ok", d.hostname, `dhcp pool ${cmd.pool} network ${cmd.network}`);
          break;
        case "dhcp-default-router":
          d.dhcp.pools[cmd.pool] = { ...(d.dhcp.pools[cmd.pool] || {}), defaultRouter: cmd.ip };
          break;
        case "dhcp-dns":
          d.dhcp.pools[cmd.pool] = { ...(d.dhcp.pools[cmd.pool] || {}), dnsServer: cmd.ip };
          break;
        case "dhcp-domain":
          d.dhcp.pools[cmd.pool] = { ...(d.dhcp.pools[cmd.pool] || {}), domainName: cmd.domain };
          break;
        case "dhcp-netbios":
          d.dhcp.pools[cmd.pool] = { ...(d.dhcp.pools[cmd.pool] || {}), netbiosServer: cmd.ip };
          break;
        case "dhcp-lease":
          d.dhcp.pools[cmd.pool] = { ...(d.dhcp.pools[cmd.pool] || {}), leaseDays: cmd.days };
          break;
        case "acl-create":
          d.acls[cmd.name] = d.acls[cmd.name] || { type: cmd.aclType, entries: [] };
          break;
        case "acl-entry": {
          const entry = parseAclEntry(cmd.action, cmd.spec, cmd.aclType);
          d.acls[cmd.name] = d.acls[cmd.name] || { type: cmd.aclType, entries: [] };
          d.acls[cmd.name].entries.push(entry);
          log("ok", d.hostname, `ACL ${cmd.name} ${cmd.action}`);
          break;
        }
        case "acl-remark":
          d.acls[cmd.name] = d.acls[cmd.name] || { type: "extended", entries: [] };
          d.acls[cmd.name].entries.push({ action: "remark", spec: cmd.value });
          break;
        case "prefix-list-entry":
          d.prefixLists[cmd.name] = d.prefixLists[cmd.name] || { entries: [] };
          d.prefixLists[cmd.name].entries.push({ action: cmd.action, prefix: cmd.prefix });
          break;
        case "route-map-create":
          d.routeMaps[cmd.name] = d.routeMaps[cmd.name] || { sequences: [] };
          if (!d.routeMaps[cmd.name].sequences.some(s => s.seq === cmd.seq)) d.routeMaps[cmd.name].sequences.push({ seq: cmd.seq, action: cmd.action });
          break;
        case "route-map-line": {
          d.routeMaps[cmd.name] = d.routeMaps[cmd.name] || { sequences: [] };
          let seq = d.routeMaps[cmd.name].sequences.find(s => s.seq === cmd.seq);
          if (!seq) { seq = { seq: cmd.seq, action: "permit" }; d.routeMaps[cmd.name].sequences.push(seq); }
          seq[cmd.field] = cmd.value;
          break;
        }
        case "vrf-create":
          d.vrfs[cmd.name] = d.vrfs[cmd.name] || { afs: [] };
          break;
        case "vrf-rd":
          d.vrfs[cmd.name] = { ...(d.vrfs[cmd.name] || { afs: [] }), rd: cmd.rd };
          break;
        case "vrf-af":
          d.vrfs[cmd.name] = d.vrfs[cmd.name] || { afs: [] };
          d.vrfs[cmd.name].afs = [...new Set([...(d.vrfs[cmd.name].afs || []), cmd.af])];
          break;
        case "nat-pool":
          d.nat.pools[cmd.name] = { start: cmd.start, end: cmd.end, mask: cmd.mask };
          break;
        case "nat-rule":
          d.nat.rules = [...(d.nat.rules || []).filter(r => r.config !== cmd.config), { config: cmd.config, ...cmd.rule }];
          break;
        case "aaa":
          d.aaa.enabled = cmd.enabled;
          break;
        case "aaa-method":
          d.aaa.methods = [...(d.aaa.methods || []).filter(x => !(x.service === cmd.service && x.list === cmd.list)), { service: cmd.service, list: cmd.list, methods: cmd.methods }];
          break;
        case "crypto-rsa":
          d.crypto.rsaKeys = { modulus: cmd.modulus, generated: true };
          d.services.ssh = true;
          break;
        case "ntp-server":
          d.ntp.servers = [...new Set([...(d.ntp.servers || []), cmd.server])];
          break;
        case "snmp-community":
          d.snmp.communities = [...(d.snmp.communities || []).filter(c => c.name !== cmd.name), { name: cmd.name, access: cmd.access }];
          break;
        case "snmp-host":
          d.snmp.hosts = [...(d.snmp.hosts || []).filter(h => h.host !== cmd.host), { host: cmd.host, community: cmd.community }];
          break;
        case "logging-host":
          d.loggingHosts = [...new Set([...(d.loggingHosts || []), cmd.host])];
          break;
        case "dhcp-snooping":
          d.dhcpSnooping.enabled = cmd.enabled;
          break;
        case "dhcp-snooping-vlan":
          d.dhcpSnooping.vlans = cmd.vlans;
          break;
        case "dai-vlan":
          d.dai.vlans = cmd.vlans;
          break;
        case "stp-root":
          d.stp = d.stp || { mode: "rapid-pvst", vlanPriority: {} };
          d.stp.vlanPriority = { ...(d.stp.vlanPriority || {}), [cmd.vlan]: cmd.role === "primary" ? 24576 : 28672 };
          break;
        case "stp-priority":
          d.stp = d.stp || { mode: "rapid-pvst", vlanPriority: {} };
          d.stp.vlanPriority = { ...(d.stp.vlanPriority || {}), [cmd.vlan]: cmd.priority };
          break;
        case "span-source": {
          const s = d.span.find(x => x.session === cmd.session) || { session: cmd.session };
          s.source = cmd.iface;
          d.span = [...d.span.filter(x => x.session !== cmd.session), s];
          break;
        }
        case "span-dest": {
          const s = d.span.find(x => x.session === cmd.session) || { session: cmd.session };
          s.destination = cmd.iface;
          d.span = [...d.span.filter(x => x.session !== cmd.session), s];
          break;
        }
        case "vtp":
          d.vtp[cmd.field] = cmd.value;
          break;
        case "class-map-create":
          d.qos.classMaps[cmd.name] = d.qos.classMaps[cmd.name] || { matchType: cmd.matchType, matches: [] };
          break;
        case "class-map-match":
          d.qos.classMaps[cmd.name] = d.qos.classMaps[cmd.name] || { matchType: "match-any", matches: [] };
          d.qos.classMaps[cmd.name].matches.push(cmd.match);
          break;
        case "policy-map-create":
          d.qos.policyMaps[cmd.name] = d.qos.policyMaps[cmd.name] || { classes: [] };
          break;
        case "policy-map-class":
          d.qos.policyMaps[cmd.policy] = d.qos.policyMaps[cmd.policy] || { classes: [] };
          if (!d.qos.policyMaps[cmd.policy].classes.some(c => c.name === cmd.className)) d.qos.policyMaps[cmd.policy].classes.push({ name: cmd.className, actions: [] });
          break;
        case "policy-map-action": {
          d.qos.policyMaps[cmd.policy] = d.qos.policyMaps[cmd.policy] || { classes: [] };
          let cls = d.qos.policyMaps[cmd.policy].classes.find(c => c.name === cmd.className);
          if (!cls) { cls = { name: cmd.className, actions: [] }; d.qos.policyMaps[cmd.policy].classes.push(cls); }
          cls.actions.push(cmd.action);
          break;
        }
        case "ip-sla-create":
          d.ipSla[cmd.id] = d.ipSla[cmd.id] || {};
          break;
        case "ip-sla-field":
          d.ipSla[cmd.id] = { ...(d.ipSla[cmd.id] || {}), [cmd.field]: cmd.value, lastOk: true };
          break;
        case "track":
          d.tracks[cmd.id] = { object: cmd.object, state: "up" };
          break;
      }
      d.interfaces = ifaces;
      const next = { ...m, [devId]: OPT_Engine.recalcConnectedRoutes(d) };
      return OPT_Engine.recomputeDynamicRoutes(next, links);
    });
  };
  const onApply = (cmd) => onApplyToDevice(selectedId, cmd);

  const updateServerDevice = (devId, mutator, message) => {
    if (!devId) return;
    if (!markProjectChanged("server-config")) return;
    const hostname = devices[devId]?.hostname || "Server";
    setDevices((m) => {
      const current = m[devId];
      if (!current || current.kind !== "server") return m;
      const base = OPT_Engine.normalizeDevice(current);
      const d = {
        ...base,
        services: { ...(base.services || {}) },
        dhcp: cloneState(base.dhcp || { excluded: [], pools: {}, bindings: [] }),
        users: { ...(base.users || {}) },
        files: { ...(base.files || {}) },
        serverConfig: ensureServerConfig(base),
      };
      mutator(d, d.serverConfig);
      d.serverConfig = ensureServerConfig(d);
      const next = { ...m, [devId]: OPT_Engine.recalcConnectedRoutes(d) };
      return OPT_Engine.recomputeDynamicRoutes(next, links);
    });
    if (message) log("ok", hostname, message);
  };

  // ── Ping & packet animation
  const animatePath = (plan, snapshot, onDone) => {
    if (!plan.hops.length) { onDone?.(); return; }
    setSimRunning(true);
    const speed = 1 / Math.max(0.25, t.packetSpeed || 1);
    const packetCount = 5;
    const packetGapMs = Math.max(35, 85 * speed);
    const segMs = Math.max(45, 110 * speed);
    const legPauseMs = Math.max(8, 14 * speed);
    const turnPauseMs = Math.max(18, 36 * speed);
    const dropHoldMs = 600;

    // Deduped device waypoint sequence
    const waypoints = [];
    for (const h of plan.hops) {
      const d = snapshot[h.devId];
      if (!d) continue;
      if (waypoints.length === 0 || waypoints[waypoints.length - 1].id !== d.id) waypoints.push(d);
    }
    if (!waypoints.length) {
      setSimRunning(false);
      onDone?.();
      return;
    }
    // For failures, stop forward at the drop device
    let stopIdx = waypoints.length - 1;
    if (!plan.ok) {
      const dropHop = plan.hops.find(h => h.action === "drop") || plan.hops[plan.hops.length - 1];
      const idx = waypoints.findIndex(w => w.id === dropHop?.devId);
      if (idx >= 0) stopIdx = idx;
    }

    const placePacket = (pid, x, y, proto) => {
      setPackets((arr) => {
        const exists = arr.find(p => p.id === pid);
        if (exists) return arr.map(p => p.id === pid ? { ...p, x, y, proto } : p);
        return [...arr, { id: pid, x, y, proto }];
      });
    };

    const removePacket = (pid) => setPackets((arr) => arr.filter(p => p.id !== pid));
    let remaining = packetCount;
    const finishPacket = () => {
      remaining -= 1;
      if (remaining > 0) return;
      setActiveHopDeviceId(null);
      setSimRunning(false);
      onDone?.();
    };

    const runPacket = (delayMs) => {
      const pid = OPT_Engine.uid("p");
      let isReply = false;
      let seq = waypoints.slice(0, stopIdx + 1);
      let i = 0;

      const step = () => {
        if (i >= seq.length - 1) {
          if (!isReply && plan.ok) {
            isReply = true;
            seq = waypoints.slice().reverse();
            i = 0;
            setTimeout(step, turnPauseMs);
            return;
          }
          if (!plan.ok) {
            const drop = seq[seq.length - 1];
            placePacket(pid, drop.x, drop.y, "drop");
          }
          setTimeout(() => {
            removePacket(pid);
            finishPacket();
          }, plan.ok ? 80 : dropHoldMs);
          return;
        }
        const from = seq[i], to = seq[i + 1];
        const start = performance.now();
        const animate = (now) => {
          const u = Math.min(1, (now - start) / segMs);
          const x = from.x + (to.x - from.x) * u;
          const y = from.y + (to.y - from.y) * u;
          placePacket(pid, x, y, "icmp");
          if (u < 1) requestAnimationFrame(animate);
          else {
            setActiveHopDeviceId(to.id);
            i++;
            setTimeout(step, legPauseMs);
          }
        };
        requestAnimationFrame(animate);
      };
      setTimeout(() => {
        placePacket(pid, waypoints[0].x, waypoints[0].y, "icmp");
        setActiveHopDeviceId(waypoints[0].id);
        step();
      }, delayMs);
    };

    for (let n = 0; n < packetCount; n++) {
      runPacket(n * packetGapMs);
    }
  };

  const handlePing = (srcId, target, opts = {}, onComplete) => {
    const plan = OPT_Engine.planPath(devices, links, srcId, target);
    plan.devices = devices;
    if (opts.silent || opts.trace) {
      onComplete && onComplete(plan);
      return plan;
    }
    log(plan.ok ? "ok" : "err", "ping", `${devices[srcId].hostname} → ${target}: ${plan.ok ? "in flight" : plan.error}`);
    animatePath(plan, devices, () => {
      if (plan.ok) log("ok", "ping", `${devices[srcId].hostname} → ${target}: success`);
      onComplete && onComplete(plan);
    });
    return plan;
  };

  const submitPingTarget = (devId, target) => {
    const cleaned = String(target || "").trim();
    if (!devId || !cleaned) return;
    setRecentPingTargets((items) => [cleaned, ...items.filter((item) => item !== cleaned)].slice(0, 8));
    setPingDialog(null);
    handlePing(devId, cleaned);
  };

  const revealCliPanel = () => {
    setBottomCollapsed(false);
    setBottomPanelHeight((height) => {
      const maxHeight = Math.max(180, window.innerHeight - 170);
      const target = Math.min(maxHeight, Math.max(CLI_REVEAL_MIN_HEIGHT, Math.round(window.innerHeight * 0.42)));
      return Math.max(height, target);
    });
  };

  const reportImportError = async (activity = lastImportReport) => {
    if (!syncClient || !activity) return;
    try {
      await syncClient.reportError({
        appVersion: OPENPT_VERSION,
        page: location.href,
        userAgent: navigator.userAgent,
        message: activity?.reverseReport?.decoder?.error || activity?.diagnostics?.decoder?.error || "Packet Tracer import issue",
        activity,
      });
      setToast({ kind: "ok", msg: "Error report sent" });
    } catch (err) {
      setToast({ kind: "err", msg: err.message || "Could not send report" });
    }
  };

  // ── Packet-mode click handler (HUD)
  useEffect(() => {
    if (!packetMode) return;
    setActiveBottom("events");
  }, [packetMode]);

  const openConsole = (id) => {
    setSelectedId(id);
    setOpenConsoles((cs) => cs.includes(id) ? cs : [...cs, id]);
    revealCliPanel();
    setActiveBottom(id);
    setCliFocusNonce((n) => n + 1);
  };
  const openServerModule = (id) => {
    setSelectedId(id);
    setAppsSidebarOpen(false);
    setServerModuleOpen(true);
    setServerModuleTab("config");
    setActiveCenterTab("topology");
  };
  const openEndpointApp = (id, appKey) => {
    const device = devices[id];
    const app = endpointAppByKey(appKey);
    if (!device || !isEndpointAppsDevice(device) || !app) return;
    const tabId = endpointAppTabId(activeWid, id, app.key);
    setSelectedId(id);
    setServerModuleOpen(false);
    setAppsSidebarOpen(true);
    setOpenAppTabs((items) => (
      items.some((item) => item.id === tabId)
        ? items
        : [...items, { id: tabId, wid: activeWid, deviceId: id, appKey: app.key }]
    ));
    setActiveCenterTab(tabId);
  };
  const closeEndpointApp = (tabId) => {
    setOpenAppTabs((items) => items.filter((item) => item.id !== tabId));
    setActiveCenterTab((cur) => cur === tabId ? "topology" : cur);
  };
  const openDeviceModule = (id) => {
    const device = devices[id];
    if (device?.kind === "server") openServerModule(id);
    else if (isEndpointAppsDevice(device)) {
      setSelectedId(id);
      setServerModuleOpen(false);
      setAppsSidebarOpen(true);
      setActiveCenterTab("topology");
    }
    else openConsole(id);
  };
  const consoleDevice = openConsole;
  const closeConsole = (id) => {
    setOpenConsoles((cs) => cs.filter(x => x !== id));
    setActiveBottom((cur) => {
      if (cur !== id) return cur;
      const remaining = openConsoles.filter(x => x !== id);
      return remaining.length ? remaining[remaining.length - 1] : "events";
    });
  };
  const updateEndpointDevice = (id, mutator, message = "app settings updated") => {
    if (!markProjectChanged("endpoint-app")) return;
    setDevices((m) => {
      const current = m[id];
      if (!current) return m;
      const nextDevice = cloneState(current);
      mutator(nextDevice);
      log("ok", current.hostname, message);
      return { ...m, [id]: nextDevice };
    });
  };

  // ── Top-level keyboard
  useEffect(() => {
    const k = (e) => {
      // Undo/redo always intercept (Cmd/Ctrl + Z / Shift+Z)
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        // Only intercept when focus is NOT in a text input/textarea — console etc.
        // Cisco's own Ctrl-Z is handled inside CLI.
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "l") setLinkMode((v) => !v);
      if (e.key === "p") setPacketMode((v) => v ? null : { stage: "src" });
      if (e.key === "Delete" && selectedLinkId) {
        onDeleteLink(selectedLinkId);
        setSelectedLinkId(null);
        return;
      }
      if (e.key === "Delete" && selectedIds.length) {
        selectedIds.forEach(id => deleteDevice(id));
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [selectedIds, selectedLinkId, activeWid, devices, links]);

  const selected = selectedId ? devices[selectedId] : null;
  const appsSelected = selected && isEndpointAppsDevice(selected);
  const appTabsForWorkspace = openAppTabs.filter((item) => item.wid === activeWid && devices[item.deviceId]);
  const activeAppTab = activeCenterTab === "topology" ? null : appTabsForWorkspace.find((item) => item.id === activeCenterTab);
  const activeAppDevice = activeAppTab ? devices[activeAppTab.deviceId] : null;
  const activeEndpointApp = activeAppTab ? endpointAppByKey(activeAppTab.appKey) : null;
  useEffect(() => {
    if (appsSidebarOpen && !appsSelected) setAppsSidebarOpen(false);
  }, [appsSidebarOpen, appsSelected, selectedId]);
  useEffect(() => {
    setOpenAppTabs((items) => {
      const next = items.filter((item) => item.wid !== activeWid || devices[item.deviceId]);
      return next.length === items.length ? items : next;
    });
    if (activeCenterTab !== "topology" && !activeAppTab) setActiveCenterTab("topology");
  }, [devices, activeWid, activeCenterTab, activeAppTab]);
  const cnt = {
    routers: Object.values(devices).filter(d => OPT_Engine.isRouterLike?.(d) && !OPT_Engine.isSwitchLike?.(d)).length,
    switches: Object.values(devices).filter(d => OPT_Engine.isSwitchLike?.(d)).length,
    hosts: Object.values(devices).filter(d => OPT_Engine.isHostLike?.(d)).length,
    links: links.length,
  };
  const autosaveDueMs = meaningfulChanges > 0 && (cloudProjectId || shareToken) && cloudLease
    ? Math.max(0, Math.max(
        meaningfulChanges >= SYNC_AUTOSAVE_CHANGES ? 0 : SYNC_AUTOSAVE_MS - (firstDirtyAt ? Date.now() - firstDirtyAt : 0),
        SYNC_MIN_SAVE_MS - (Date.now() - lastSaveAtRef.current)
      ))
    : 0;
  const syncDetail = meaningfulChanges > 0 && (cloudProjectId || shareToken) && cloudLease
    ? `Autosave in ${Math.ceil(autosaveDueMs / 1000)}s`
    : syncStatus.message;

  return (
    <div
      className="app"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input
        ref={importFileInputRef}
        type="file"
        accept=".json,.opt,.otp,.pka,.pkt"
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImportFile(file);
          e.target.value = "";
        }}
      />
      {/* Title bar */}
      <div className="titlebar">
        <div className="tb-logo">
          <div className="glyph"/>
          OpenPT
          <span style={{ color: "var(--fg-3)", fontWeight: 400, fontSize: 11, marginLeft: 6 }}>{OPENPT_VERSION}</span>
        </div>
        <TitleMenus
          devices={devices}
          selectedId={selectedId}
          links={links}
          tweaks={t}
          setTweak={setTweak}
          onNewBlankTab={newBlankTab}
          onNewStarterTab={newStarterTab}
          onImportPacketTracer={openPacketTracerFilePicker}
          onExportOtp={exportOtpPackage}
          onReset={async () => {
            const ok = await requestConfirm({ title: "Reset to starter?", message: "Replace the current topology with the starter scenario?", confirmLabel: "Reset", danger: true });
            if (!ok) return;
            if (!markProjectChanged("reset")) return;
            const s = OPT_Engine.makeStarter();
            setDevices(s.devices); setLinks(s.links); setSelectedId(null);
            setEvents([]); setPackets([]); setPtActivity(null);
            log("ok", "system", "scenario reset to starter");
          }}
          onClearAll={async () => {
            const ok = await requestConfirm({ title: "Clear topology?", message: "Remove every device and cable from the current tab?", confirmLabel: "Clear", danger: true });
            if (!ok) return;
            if (!markProjectChanged("clear")) return;
            setDevices({}); setLinks([]); setSelectedId(null); setSelectedLinkId(null); setEvents([]); setPackets([]); setPtActivity(null); log("warn", "system", "topology cleared");
          }}
          onDeleteSelected={() => selectedId && deleteDevice(selectedId)}
          onAddDeviceFromMenu={addDeviceFromMenu}
          onPing={(srcName, dst) => {
            const src = Object.values(devices).find(d => d.hostname === srcName);
            if (src) handlePing(src.id, dst);
          }}
          onLab={async (key) => {
            if (key === "starter") {
              const ok = await requestConfirm({ title: "Load starter lab?", message: "Replace the current topology with the starter lab?", confirmLabel: "Load lab", danger: true });
              if (!ok) return;
              if (!markProjectChanged("load-lab")) return;
              const s = OPT_Engine.makeStarter();
              setDevices(s.devices); setLinks(s.links); setSelectedId(null);
              setPtActivity(null);
              log("ok", "system", "loaded lab: Two-router VLAN routing");
            } else {
              await loadPracticeLab(key);
            }
          }}
          onLinkR1G01={() => {
            const r1 = Object.values(devices).find(d => d.hostname === "R1");
            if (!r1) return;
            if (!markProjectChanged("fault")) return;
            const iface = r1.interfaces["GigabitEthernet0/0/1"] ? "GigabitEthernet0/0/1" : "G0/1";
            setDevices((m) => ({ ...m, [r1.id]: { ...m[r1.id], interfaces: { ...m[r1.id].interfaces, [iface]: { ...m[r1.id].interfaces[iface], admUp: false, up: false } } } }));
            setLinks((ls) => ls.map(l => (l.a === r1.id && l.ai === iface) || (l.b === r1.id && l.bi === iface) ? { ...l, up: false } : l));
            log("warn", "R1", `${ifaceName(iface)} administratively shut down`);
          }}
          onEnterLinkMode={(type) => { setLinkMode(true); setForceLinkType(type); }}
        />
        <div className="tb-center">
          {syncStatus.message !== "Local only" && (
            <div className={`tb-status-chip ${syncStatus.state}`}>
              <span className="dot"/>
              {syncDetail}
            </div>
          )}
        </div>
        <div className="tb-actions">
          {(cloudProjectId || shareToken) && meaningfulChanges > 0 && cloudLease && (
            <button className="tb-btn primary" onClick={() => saveCloudNow({ force: true }).catch((err) => setToast({ kind: "err", msg: err.message || "Save failed" }))}>Save Now</button>
          )}
          {(cloudProjectId || shareToken) && !cloudLease && shareMode !== "read" && (
            <button className="tb-btn primary" onClick={() => acquireCurrentLease(false)}>Edit</button>
          )}
          {cloudUser && !cloudProjectId && !shareToken && (
            <button className="tb-btn primary" onClick={createSyncedProject}>Save to cloud</button>
          )}
          {cloudUser && (
            <button className="tb-btn" onClick={() => setProjectsOpen(true)}>Projects</button>
          )}
          {(cloudProjectId && !shareToken) && (
            <button className="tb-btn" onClick={() => setShareOpen(true)}>Share</button>
          )}
          <button className="tb-btn" onClick={() => cloudUser ? setProjectsOpen(true) : setAuthOpen(true)}>
            {cloudUser ? cloudUser.email.split("@")[0] : "Login / Sign up"}
          </button>
        </div>
      </div>

      {readOnlyReason && (
        <div className="lease-banner">
          <span>{readOnlyReason}</span>
          {shareMode !== "read" && <button className="tb-btn primary" onClick={() => acquireCurrentLease(false)}>Edit</button>}
          {shareMode !== "read" && <button className="tb-btn" onClick={() => acquireCurrentLease(true)}>Take Over</button>}
        </div>
      )}

      {/* Workspace */}
      <div
        className="workspace"
        style={{
          "--bottom-panel-height": bottomCollapsed ? "32px" : `${bottomPanelHeight}px`,
          "--pt-sidebar-width": `${packetTracerSidebarWidth}px`,
          "--server-module-width": `${serverModuleWidth}px`,
          "--apps-sidebar-width": `${appsSidebarWidth}px`,
        }}
      >
        {/* (Labs/Diagnostics moved to top menus) */}
        {ptActivity && ptSidebarOpen && (
          <>
            <PacketTracerSidebar
              activity={gradedPtActivity}
              onClose={() => setPtSidebarOpen(false)}
              onReportError={() => reportImportError(gradedPtActivity)}
            />
            <div
              className="pt-sidebar-resizer"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize assignment sidebar"
              onPointerDown={(event) => beginResize("sidebar", event)}
            />
          </>
        )}
        {ptActivity && !ptSidebarOpen && (
          <div
            className="pt-sidebar-stub"
            onClick={() => setPtSidebarOpen(true)}
            title="Show assignment instructions"
          >
            <span>▸</span>
          </div>
        )}

        {/* Center */}
        <div className="center-col">
          <div className="tab-bar">
            {tabs.map((tb) => (
              <div
                key={tb.id}
                className={`tab ${activeWid === tb.id && activeCenterTab === "topology" ? "active" : ""} ${dirtyTabs[tb.id] ? "dirty" : ""}`}
                onClick={() => activeWid === tb.id ? setActiveCenterTab("topology") : switchTab(tb.id)}
              >
                <span className="dot"/>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{tb.name}</span>
                {tabs.length > 1 && (
                  <span
                    className="close"
                    style={{ marginLeft: 12 }}
                    onClick={(e) => { e.stopPropagation(); closeTab(tb.id); }}
                  >×</span>
                )}
              </div>
            ))}
            <div className="tab-new" title="New blank tab" onClick={newBlankTab}>+</div>
            {appTabsForWorkspace.map((item) => {
              const dev = devices[item.deviceId];
              const app = endpointAppByKey(item.appKey);
              if (!dev || !app) return null;
              return (
                <div
                  key={item.id}
                  className={`tab app-page-tab ${activeCenterTab === item.id ? "active" : ""}`}
                  onClick={() => setActiveCenterTab(item.id)}
                  title={`${dev.hostname} - ${app.label}`}
                >
                  <AppLibraryIcon kind={app.key} className="tab-app-icon" />
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{dev.hostname} - {app.label}</span>
                  <span
                    className="close"
                    onClick={(e) => { e.stopPropagation(); closeEndpointApp(item.id); }}
                    title="Close app"
                  >×</span>
                </div>
              );
            })}
            <div className="tab-spacer"/>
            {activeCenterTab === "topology" && <div className="tab-tools">
              <div className={`tab-tool ${linkMode ? "active" : ""}`} title="Cable mode (L)" onClick={() => setLinkMode(!linkMode)}>{Icon.link()}</div>
              <div className={`tab-tool ${packetMode ? "active" : ""}`} title="Packet mode (P)" onClick={() => setPacketMode(packetMode ? null : { stage: "src" })}>{Icon.packet()}</div>
            </div>}
          </div>

          {activeAppTab && activeAppDevice && activeEndpointApp ? (
            <EndpointAppWorkspace
              tab={activeAppTab}
              app={activeEndpointApp}
              device={activeAppDevice}
              devices={devices}
              links={links}
              onClose={() => closeEndpointApp(activeAppTab.id)}
              onUpdateDevice={(mutator, message) => updateEndpointDevice(activeAppDevice.id, mutator, message)}
              onApplyCommand={(cmd) => onApplyToDevice(activeAppDevice.id, cmd)}
              onPing={handlePing}
              scrollState={terminalScrolls[activeAppTab.id] || terminalScrolls[activeAppDevice.id]}
              onScrollStateChange={(devId, state) => setTerminalScrolls((m) => ({ ...m, [activeAppTab.id]: state }))}
              historyState={cliHistory[activeAppTab.id] || {}}
              onHistoryChange={(history) => setCliHistory((m) => ({ ...(m && !Array.isArray(m) ? m : {}), [activeAppTab.id]: history }))}
              ghostSuggestions={cliGhostSuggestions}
            />
          ) : (
            <Topology
              devices={devices}
              links={links}
              selectedIds={selectedIds}
              onSelect={(id, additive) => selectDevice(id, additive)}
              selectedLinkId={selectedLinkId}
              onSelectLink={(id) => { setSelectedLinkId(id); if (id) setSelectedIds([]); }}
              onMarqueeSelect={(ids, additive) => {
                setSelectedLinkId(null);
                setSelectedIds((current) => additive ? [...new Set([...current, ...ids])] : ids);
              }}
              onMoveStart={() => {
                dragStartSnapRef.current = latestTopologyRef.current;
                suppressHistoryRef.current = true;
              }}
              onMoveEnd={(moved) => {
                const start = dragStartSnapRef.current;
                suppressHistoryRef.current = false;
                dragStartSnapRef.current = null;
                if (!moved || !start) {
                  prevSnap.current = latestTopologyRef.current;
                  return;
                }
                const h = undoRef.current[activeWid] || (undoRef.current[activeWid] = { past: [], future: [] });
                h.past.push(start);
                if (h.past.length > 80) h.past.shift();
                h.future = [];
                prevSnap.current = latestTopologyRef.current;
                setHistoryVersion((n) => n + 1);
              }}
              onMoveDevices={(idDeltas) => {
                if (!markProjectChanged("move-devices")) return;
                setDevices((m) => {
                  const next = { ...m };
                  for (const { id, x, y } of idDeltas) {
                    if (next[id]) next[id] = { ...next[id], x, y };
                  }
                  return next;
                });
              }}
              onAddDevice={addDevice}
              onDeleteLink={onDeleteLink}
              linkMode={linkMode}
              setLinkMode={setLinkMode}
              forceLinkType={forceLinkType || "auto"}
              packetMode={packetMode}
              setPacketMode={setPacketMode}
              onLinkRequest={onLinkRequest}
              onPacketRequest={(srcId, dstId) => {
                const dst = devices[dstId];
                const target = Object.values(dst?.interfaces || {}).find(i => i.ip)?.ip;
                if (!target) {
                  const msg = `${dst?.hostname || "destination"} has no IP address. Configure an interface IP before sending a packet.`;
                  setToast({ kind: "err", msg });
                  return log("err", "packet", msg);
                }
                handlePing(srcId, target);
              }}
              simRunning={simRunning}
              packets={packets}
              activeHopDeviceId={activeHopDeviceId}
              viewState={topologyViewState}
              onViewStateChange={setTopologyViewState}
              starterScreenVisible={starterScreenVisible}
              onCreateProject={createEmptyProjectFromStarterScreen}
              onCreateStarter={newStarterTab}
              onImportPacketTracer={openPacketTracerFilePicker}
              onOpenConsole={openDeviceModule}
              onContextMenu={(e, d) => setCtx({ x: e.clientX, y: e.clientY, devId: d.id })}
              onLinkContextMenu={(e, l) => setCtx({ x: e.clientX, y: e.clientY, linkId: l.id })}
            />
          )}

          <div className="bottom-panel">
            {!bottomCollapsed && (
              <div
                className="bottom-resizer"
                role="separator"
                aria-orientation="horizontal"
                aria-label="Resize bottom panel"
                onPointerDown={(event) => beginResize("bottom", event)}
              />
            )}
            <div className="bp-tabs">
              {openConsoles.map((id) => {
                const dev = devices[id];
                if (!dev) return null;
                const isActive = activeBottom === id;
                return (
                  <div key={id} className={`bp-tab device-tab ${isActive ? "active" : ""}`} onClick={() => setActiveBottom(id)}>
                    {Icon.terminal()}
                    <span style={{ textTransform: "none", letterSpacing: 0, fontFamily: "var(--font-mono)", fontSize: 12 }}>{dev.hostname}</span>
                    <span className="close-tab" onClick={(e) => { e.stopPropagation(); closeConsole(id); }} title="Close session">×</span>
                  </div>
                );
              })}
              {openConsoles.length > 0 && <div style={{ width: 1, background: "var(--line)" }}/>}
              {[
                ["events", "Events", events.length || null],
                ["packets", "Packets", null],
              ].map(([k, lbl, badge]) => (
                <div key={k} className={`bp-tab ${activeBottom === k ? "active" : ""}`} onClick={() => setActiveBottom(k)}>
                  {lbl}
                  {badge != null && <span className={`badge ${k === "events" && events.some(e => e.s === "err") ? "alert" : ""}`}>{badge}</span>}
                </div>
              ))}
              <div className="bp-spacer"/>
              {activeBottom === "events" && !bottomCollapsed && (
                <div className="event-tools">
                  {["all", "err", "warn", "ok"].map((kind) => (
                    <button key={kind} className={eventFilter === kind ? "active" : ""} onClick={() => setEventFilter(kind)}>{kind}</button>
                  ))}
                  <button onClick={() => navigator.clipboard?.writeText(events.map((e) => `${e.t} ${e.s} ${e.src}: ${e.m}`).join("\n")).catch(() => {})}>Copy</button>
                  <button onClick={() => setEvents([])}>Clear</button>
                </div>
              )}
              <button className="bp-collapse" title={bottomCollapsed ? "Expand bottom panel" : "Collapse bottom panel"} onClick={() => setBottomCollapsed((v) => !v)}>
                {bottomCollapsed ? "▴" : "▾"}
              </button>
            </div>
            {!bottomCollapsed && <div style={{ minHeight: 0, overflow: "hidden", position: "relative" }}>
              {openConsoles.map((id) => (
                <div key={id} style={{
                  position: "absolute", inset: 0,
                  display: activeBottom === id ? "block" : "none",
                }}>
                  <CLI
                    device={devices[id]}
                    devices={devices}
                    links={links}
                    onApply={(cmd) => onApplyToDevice(id, cmd)}
                    onPing={handlePing}
                    pendingCmd={pendingCmd && pendingCmd.devId === id ? pendingCmd : null}
                    active={activeBottom === id}
                    focusNonce={cliFocusNonce}
                    scrollState={terminalScrolls[id]}
                    onScrollStateChange={(devId, state) => setTerminalScrolls((m) => ({ ...m, [devId]: state }))}
                    historyState={cliHistory[id] || {}}
                    onHistoryChange={(history) => setCliHistory((m) => ({ ...(m && !Array.isArray(m) ? m : {}), [id]: history }))}
                    ghostSuggestions={cliGhostSuggestions}
                  />
                </div>
              ))}
              {openConsoles.length === 0 && activeBottom !== "events" && activeBottom !== "packets" && (
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--fg-3)", gap: 8 }}>
                  <div style={{ fontSize: 13, color: "var(--fg-2)" }}>No consoles open</div>
                  <div style={{ fontSize: 11.5 }}>Right-click a device on the canvas → Open Console</div>
                </div>
              )}
              <div style={{ position: "absolute", inset: 0, display: activeBottom === "events" ? "block" : "none" }}>
                <Events events={eventFilter === "all" ? events : events.filter((e) => e.s === eventFilter)} />
              </div>
              <div style={{ position: "absolute", inset: 0, display: activeBottom === "packets" ? "block" : "none" }}>
                <PacketLog events={events.filter(e => e.src === "ping")} />
              </div>
            </div>}
          </div>
        </div>

        {appsSidebarOpen && appsSelected && (
          <>
            <div
              className="apps-sidebar-resizer"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize apps sidebar"
              onPointerDown={(event) => beginResize("apps", event)}
            />
            <AppsSidebar
              device={selected}
              activeAppKey={activeAppTab?.deviceId === selected.id ? activeAppTab.appKey : null}
              onOpenApp={(appKey) => openEndpointApp(selected.id, appKey)}
              onClose={() => setAppsSidebarOpen(false)}
            />
          </>
        )}

        {serverModuleOpen && selected?.kind === "server" && (
          <>
            <div
              className="server-module-resizer"
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize server module"
              onPointerDown={(event) => beginResize("server", event)}
            />
            <ServerModuleSidebar
              device={selected}
              activeTab={serverModuleTab}
              activeConfig={serverConfigSection}
              onTabChange={setServerModuleTab}
              onConfigChange={setServerConfigSection}
              onUpdate={(mutator, message) => updateServerDevice(selected.id, mutator, message)}
              onClose={() => setServerModuleOpen(false)}
            />
          </>
        )}
      </div>

      {/* (status bar removed) */}

      {fileDropActive && (
        <div className="file-drop-overlay">
          <div className="file-drop-panel">
            <div className="file-drop-title">Drop lab file</div>
            <div className="file-drop-subtitle">OpenPT JSON/OPT/OTP and Packet Tracer PKA/PKT files open in a new tab.</div>
          </div>
        </div>
      )}

      {lastImportReport && (lastImportReport.unsupported || lastImportReport.reverseReport?.decoder?.error || lastImportReport.diagnostics?.decoder?.error) && (
        <ImportReportBanner
          activity={lastImportReport}
          onReport={() => reportImportError(lastImportReport)}
          onClose={() => setLastImportReport(null)}
        />
      )}

      {toast && (
        <div className={`toast ${toast.kind || ""}`}>
          <span className="dot"/>
          <span>{toast.msg}</span>
        </div>
      )}

      {authOpen && (
        <AuthDialog
          syncClient={syncClient}
          onClose={() => setAuthOpen(false)}
          onSignedIn={(user) => {
            setCloudUser(user);
            setAuthOpen(false);
            setSyncStatus({ state: "local", message: "Signed in" });
          }}
        />
      )}

      {projectsOpen && (
        <ProjectsDialog
          projects={cloudProjects}
          cloudUser={cloudUser}
          syncStatus={syncStatus}
          onClose={() => setProjectsOpen(false)}
          onOpen={openCloudProject}
          onCreate={createSyncedProject}
          onRefresh={refreshProjects}
          onLogout={logoutCloud}
          onRollback={restoreRollback}
          canRollback={!!cloudProjectId && !shareToken}
        />
      )}

      {shareOpen && (
        <ShareDialog
          onClose={() => setShareOpen(false)}
          onShare={createShareLink}
          shareUrl={lastShareUrl}
        />
      )}

      {conflict && (
        <ConflictDialog
          message={conflict.error || "Server has a newer project version."}
          onClose={() => setConflict(null)}
          onLoadServer={async () => {
            if (cloudProjectId) await openCloudProject(cloudProjectId);
            setConflict(null);
          }}
          onDuplicate={() => {
            const id = `w-${Date.now()}`;
            snapshotsRef.current[id] = { devices, links, selectedIds, openConsoles, activeBottom, ptActivity, ptSidebarOpen };
            setTabs((ts) => [...ts, { id, name: `${currentProjectTitle}-local-copy.opt` }]);
            setActiveWid(id);
            setCloudProjectId(null);
            setCloudLease(null);
            setCloudBaseDoc(null);
            setConflict(null);
            setSyncStatus({ state: "local", message: "Local duplicate" });
          }}
          onTakeOver={() => {
            acquireCurrentLease(true);
            setConflict(null);
          }}
        />
      )}

      {pingDialog && (
        <PingDialog
          device={devices[pingDialog.devId]}
          initialTarget={pingDialog.target}
          recentTargets={recentPingTargets}
          onClose={() => setPingDialog(null)}
          onSubmit={(target) => submitPingTarget(pingDialog.devId, target)}
        />
      )}

      {confirmDialog && (
        <ConfirmDialog
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          danger={confirmDialog.danger}
          onCancel={() => resolveConfirm(false)}
          onConfirm={() => resolveConfirm(true)}
        />
      )}

      <TweaksPanel>
        <TweakSection label="Theme" />
        <TweakColor label="Accent" value={ACCENTS[t.accent]?.a || ACCENTS.cyan.a}
          options={Object.entries(ACCENTS).map(([k, v]) => v.a)}
          onChange={(v) => {
            const key = Object.entries(ACCENTS).find(([k, val]) => val.a === v)?.[0] || "cyan";
            setTweak("accent", key);
          }} />
        <TweakToggle label="Grid dots" value={t.showGrid} onChange={(v) => setTweak("showGrid", v)} />
        <TweakSection label="Simulation" />
        <TweakSlider label="Packet speed" min={0.25} max={3} step={0.25} value={t.packetSpeed}
          onChange={(v) => setTweak("packetSpeed", v)} unit="×" />
        <TweakSection label="CLI" />
        <TweakToggle label="Ghost suggestions" value={cliGhostSuggestions} onChange={setCliGhostSuggestions} />
        <TweakSection label="Diagnostics" />
        <TweakButton label="Trigger PC1 → SRV1 ping" onClick={() => {
          const pc1 = Object.values(devices).find(d => d.hostname === "PC1");
          if (pc1) handlePing(pc1.id, "192.168.20.20");
        }} />
        <TweakButton label="Trigger PC1 → 8.8.8.8 (should fail)" onClick={() => {
          const pc1 = Object.values(devices).find(d => d.hostname === "PC1");
          if (pc1) handlePing(pc1.id, "8.8.8.8");
        }} />
        <TweakButton label="Shutdown R1 G0/1" onClick={() => {
          const r1 = Object.values(devices).find(d => d.hostname === "R1");
          if (!r1) return;
          if (!markProjectChanged("fault")) return;
          const iface = r1.interfaces["GigabitEthernet0/0/1"] ? "GigabitEthernet0/0/1" : "G0/1";
          setDevices((m) => ({ ...m, [r1.id]: { ...m[r1.id], interfaces: { ...m[r1.id].interfaces, [iface]: { ...m[r1.id].interfaces[iface], admUp: false, up: false } } } }));
          setLinks((ls) => ls.map(l => (l.a === r1.id && l.ai === iface) || (l.b === r1.id && l.bi === iface) ? { ...l, up: false } : l));
          log("warn", "R1", `${ifaceName(iface)} administratively shut down`);
        }} />
      </TweaksPanel>

      {ctx && (
        ctx.linkId ? (
          <LinkContextMenu
            x={ctx.x}
            y={ctx.y}
            link={links.find((l) => l.id === ctx.linkId)}
            devices={devices}
            onClose={() => setCtx(null)}
            onDelete={() => {
              onDeleteLink(ctx.linkId);
              setSelectedLinkId(null);
              setCtx(null);
            }}
          />
        ) : (
          <ContextMenu
            x={ctx.x} y={ctx.y}
            device={devices[ctx.devId]}
            onClose={() => setCtx(null)}
            onAction={(action) => {
            const id = ctx.devId;
            const d = devices[id];
            if (!d) return setCtx(null);
            switch (action) {
              case "server-module":
                openServerModule(id); break;
              case "apps":
                openEndpointApp(id, "ip");
                break;
              case "console":
                openConsole(id); break;
              case "show-int":
                runConsoleCmd(id, "show interfaces"); break;
              case "show-route":
                runConsoleCmd(id, "show ip route"); break;
              case "show-vlan":
                runConsoleCmd(id, "show vlan brief"); break;
              case "show-mac":
                runConsoleCmd(id, "show mac address-table"); break;
              case "show-run":
                runConsoleCmd(id, "show running-config"); break;
              case "power":
                togglePower(id); break;
              case "restart":
                // power off then on
                if (d.powered) togglePower(id);
                setTimeout(() => {
                  setDevices((m) => m[id]?.powered ? m : { ...m, [id]: { ...m[id], powered: true,
                    interfaces: Object.fromEntries(Object.entries(m[id].interfaces).map(([k,v])=>[k,{...v, up: hasLink(id, k, links)}])) } });
                  log("ok", d.hostname, "device restarted");
                }, 600);
                log("warn", d.hostname, "restarting…");
                break;
              case "delete":
                deleteDevice(id); break;
              case "ping":
                setPingDialog({ devId: id, target: recentPingTargets[0] || "192.168.20.20" });
                break;
              case "duplicate": {
                if (!markProjectChanged("duplicate")) break;
                const newD = { ...d, id: OPT_Engine.uid("d"), x: d.x + 60, y: d.y + 40, hostname: d.hostname + "-copy" };
                setDevices((m) => ({ ...m, [newD.id]: newD }));
                log("ok", "topology", `duplicated ${d.hostname}`);
                break;
              }
            }
            setCtx(null);
          }}
          />
        )
      )}
    </div>
  );
}

// ── Helper components ────────────────────────────────────
function TitleMenus(props) {
  const [open, setOpen] = useState(null);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(null); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const toggle = (k) => setOpen((cur) => cur === k ? null : k);
  const close = () => setOpen(null);
  const tweak = (k, v) => { props.setTweak(k, v); close(); };
  const deviceGroups = [
    { title: "Routers", kinds: ["router"] },
    { title: "Switches", kinds: ["l2switch", "l3switch"] },
    { title: "End Devices", kinds: ["pc", "mac", "laptop", "server", "printer", "phone", "ap"] },
  ].map((group) => ({
    ...group,
    devices: DeviceCatalog.filter((d) => group.kinds.includes(d.kind)),
  })).filter((group) => group.devices.length);
  const groupedDeviceIds = new Set(deviceGroups.flatMap((group) => group.devices.map((d) => d.id || d.kind)));
  const otherDevices = DeviceCatalog.filter((d) => !groupedDeviceIds.has(d.id || d.kind));
  if (otherDevices.length) deviceGroups.push({ title: "Other", devices: otherDevices });

  const menus = {
    File: [
      { label: "New blank tab", kbd: "⌘N", on: () => { props.onNewBlankTab(); } },
      { label: "New starter scenario tab", on: () => { props.onNewStarterTab(); } },
      { label: "Import lab file...", on: () => { props.onImportPacketTracer(); } },
      { sep: true },
      { sect: "Export" },
      { label: "Export project as OTP", on: () => props.onExportOtp() },
      { label: "Export topology as JSON", on: () => { downloadJSON({ devices: props.devices, links: props.links }, "openpt-topology.json"); } },
      { label: "Export selected device config", on: () => {
          const d = props.devices[props.selectedId];
          if (d) downloadText(generateConfig(d), `${d.hostname}.cfg`);
        }, disabled: !props.selectedId },
      { sep: true },
      { label: "Reset to starter", kbd: "⌘R", on: () => props.onReset() },
      { label: "Clear saved state & reload", on: () => {
          try { localStorage.removeItem("openpt:v1"); } catch (e) {}
          location.reload();
        } },
    ],
    Edit: [
      { label: "Delete selected device", kbd: "Del", on: () => props.onDeleteSelected(), disabled: !props.selectedId },
      { label: "Clear topology", on: () => props.onClearAll() },
      { sep: true },
      { sect: "Reorder" },
      { label: "Bring selected to front", disabled: true },
      { label: "Auto-arrange (TODO)", disabled: true },
    ],
    View: [
      { sect: "Display" },
      { label: `${props.tweaks.showGrid ? "Hide" : "Show"} grid dots`, on: () => tweak("showGrid", !props.tweaks.showGrid) },
      { sep: true },
      { sect: "Theme" },
      ...Object.keys(ACCENTS).map((k) => ({
        label: `Accent: ${k}${props.tweaks.accent === k ? "  •" : ""}`,
        on: () => tweak("accent", k),
      })),
    ],
    Lab: [
      { sect: "CCNA labs" },
      { label: "Two-router VLAN routing  ●", on: () => props.onLab("starter") },
      { label: "Static routing basics", disabled: true },
      { label: "Spanning-tree loop", disabled: true },
      ...OPENPT_PRACTICE_LABS.map((lab) => ({
        label: lab.title,
        on: () => props.onLab(lab.key),
      })),
    ],
    Devices: { kind: "devices" },
    Simulation: [
      { label: "Ping PC1 → SRV1", on: () => props.onPing("PC1", "192.168.20.20") },
      { label: "Ping PC1 → PC2 (same VLAN)", on: () => props.onPing("PC1", "192.168.10.11") },
      { label: "Ping PC1 → 8.8.8.8 (expected fail)", on: () => props.onPing("PC1", "8.8.8.8") },
      { sep: true },
      { sect: "Fault injection" },
      { label: "Shutdown R1 G0/1", on: () => props.onLinkR1G01() },
      { sep: true },
      { sect: "Speed" },
      { label: `Slow (0.5×)${props.tweaks.packetSpeed === 0.5 ? "  •" : ""}`, on: () => tweak("packetSpeed", 0.5) },
      { label: `Normal (1×)${props.tweaks.packetSpeed === 1 ? "  •" : ""}`, on: () => tweak("packetSpeed", 1) },
      { label: `Fast (2×)${props.tweaks.packetSpeed === 2 ? "  •" : ""}`, on: () => tweak("packetSpeed", 2) },
      { sep: true },
      { sect: "Network diagnostics" },
      ...computeDiagnostics(props.devices, props.links),
    ],
    Help: [
      { sect: "About" },
      { label: "OpenPT v0.1", disabled: true },
      { label: "A browser-native CCNA sandbox", disabled: true },
      { sep: true },
      { sect: "Keyboard shortcuts" },
      { label: "L — cable mode", disabled: true },
      { label: "P — packet mode", disabled: true },
      { label: "Esc — cancel mode", disabled: true },
      { label: "Del — delete selected", disabled: true },
      { label: "⌘+scroll — zoom canvas", disabled: true },
      { label: "Tab — autocomplete in CLI", disabled: true },
    ],
  };

  return (
    <div className="tb-menus" ref={ref}>
      {Object.keys(menus).map((name) => (
        <div key={name} style={{ position: "relative" }}>
          <div
            className={`tb-menu ${open === name ? "open" : ""}`}
            onClick={() => toggle(name)}
            onMouseEnter={() => { if (open) setOpen(name); }}
          >
            {name}
          </div>
          {open === name && (
            menus[name].kind === "devices" ? (
              <div className="tb-dropdown" style={{ minWidth: 340, maxHeight: "calc(100vh - 70px)", overflowY: "auto" }}>
                {deviceGroups.map((group) => (
                  <div key={group.title}>
                    <div className="tb-dropdown-section">{group.title}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, padding: "0 4px 6px" }}>
                      {group.devices.map((d) => (
                        <div
                          key={d.id || d.kind}
                          draggable
                          onClick={() => {
                            props.onAddDeviceFromMenu && props.onAddDeviceFromMenu(d.id || d.kind);
                            close();
                          }}
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = "copy";
                            e.dataTransfer.setData("text/x-openpt-device", d.id || d.kind);
                            // close menu shortly after drag start so the drop target receives
                            setTimeout(close, 80);
                          }}
                          style={{
                            display: "flex", flexDirection: "column", alignItems: "center",
                            gap: 4, padding: "10px 4px 6px",
                            background: "var(--bg-2)", border: "1px solid transparent",
                            borderRadius: 7, cursor: "copy",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--line)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
                        >
                          <div style={{ color: d.color }}>
                            {React.createElement(Glyph[d.kind] || Glyph.router, { size: 28 })}
                          </div>
                          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--fg-1)" }}>{d.short}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="tb-dropdown-sep"/>
                <div className="tb-dropdown-section">Cables</div>
                <div className="tb-dropdown-item" onClick={() => { props.onEnterLinkMode("auto"); close(); }}>
                  <span style={{ display: "inline-block", width: 18, height: 2, background: "var(--fg-1)", borderRadius: 1 }}/>
                  <span>Auto cable</span>
                  <span className="kbd">L</span>
                </div>
                <div className="tb-dropdown-item" onClick={() => { props.onEnterLinkMode("copper"); close(); }}>
                  <span style={{ display: "inline-block", width: 18, height: 2, background: "var(--fg-1)", borderRadius: 1 }}/>
                  <span>Copper straight-through</span>
                </div>
                <div className="tb-dropdown-item" onClick={() => { props.onEnterLinkMode("cross"); close(); }}>
                  <span style={{ display: "inline-block", width: 18, height: 2, background: "repeating-linear-gradient(90deg, var(--magenta) 0 3px, transparent 3px 5px)" }}/>
                  <span>Copper crossover</span>
                </div>
                <div className="tb-dropdown-item" onClick={() => { props.onEnterLinkMode("serial"); close(); }}>
                  <span style={{ display: "inline-block", width: 18, height: 2, background: "var(--warn)", borderRadius: 1 }}/>
                  <span>Serial DCE</span>
                </div>
                <div className="tb-dropdown-item" onClick={() => { props.onEnterLinkMode("fiber"); close(); }}>
                  <span style={{ display: "inline-block", width: 18, height: 2, background: "linear-gradient(90deg, var(--violet), var(--accent))" }}/>
                  <span>Fiber</span>
                </div>
                <div className="tb-dropdown-item" onClick={() => { props.onEnterLinkMode("console"); close(); }}>
                  <span style={{ display: "inline-block", width: 18, height: 1, background: "var(--fg-3)", outline: "0.5px dashed var(--fg-3)", outlineOffset: 1 }}/>
                  <span>Console</span>
                </div>
              </div>
            ) : (
              <div className="tb-dropdown">
                {menus[name].map((it, i) => {
                  if (it.sep) return <div key={i} className="tb-dropdown-sep"/>;
                  if (it.sect) return <div key={i} className="tb-dropdown-section">{it.sect}</div>;
                  return (
                    <div
                      key={i}
                      className="tb-dropdown-item"
                      style={it.disabled ? { color: "var(--fg-3)", pointerEvents: "none" } : null}
                      onClick={() => { if (!it.disabled && it.on) { it.on(); close(); } }}
                    >
                      <span>{it.label}</span>
                      {it.kbd && <span className="kbd">{it.kbd}</span>}
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      ))}
    </div>
  );
}

function ModalShell({ title, onClose, children }) {
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-head">
          <div className="modal-title">{title}</div>
          <button className="icon-btn" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AuthDialog({ syncClient, onClose, onSignedIn }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [company, setCompany] = useState("");
  const [startedAt] = useState(Date.now());
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);
    try {
      const data = mode === "login"
        ? await syncClient.login(email, password)
        : await syncClient.register(email, password, { company, startedAt });
      onSignedIn(data.user);
    } catch (err) {
      setError(err.message || "Sign in failed");
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <ModalShell title="OpenPT account" onClose={onClose}>
      <form className="modal-body" onSubmit={submit}>
        <div className="segmented">
          <button type="button" disabled={submitting} className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Sign in</button>
          <button type="button" disabled={submitting} className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Create account</button>
        </div>
        <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required disabled={submitting} /></label>
        <label>Password<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" minLength={8} required disabled={submitting} /></label>
        <label className="hp-field">Company<input value={company} onChange={(e) => setCompany(e.target.value)} tabIndex="-1" autoComplete="off" /></label>
        {error && <div className="modal-error">{error}</div>}
        <button className="tb-btn primary" type="submit" disabled={submitting}>{submitting ? "Working..." : (mode === "login" ? "Sign in" : "Create account")}</button>
      </form>
    </ModalShell>
  );
}

function ProjectsDialog({ projects, cloudUser, syncStatus, onClose, onOpen, onCreate, onRefresh, onLogout, onRollback, canRollback }) {
  const [pending, setPending] = useState("");
  const run = async (name, action) => {
    if (pending) return;
    setPending(name);
    try {
      await action();
    } finally {
      setPending("");
    }
  };
  return (
    <ModalShell title="Synced projects" onClose={onClose}>
      <div className="modal-body">
        <div className="account-row">
          <span>{cloudUser?.email}</span>
          <button className="tb-btn" disabled={!!pending} onClick={() => run("logout", onLogout)}>Logout</button>
        </div>
        <div className="sync-line">{syncStatus.message}</div>
        <div className="modal-actions">
          <button className="tb-btn primary" disabled={!!pending} onClick={() => run("create", onCreate)}>{pending === "create" ? "Saving..." : "Save current project to cloud"}</button>
          <button className="tb-btn" disabled={!!pending} onClick={() => run("refresh", onRefresh)}>Refresh</button>
        </div>
        <div className="project-list">
          {!projects.length && <div className="empty-row">No synced projects yet.</div>}
          {projects.map((p) => (
            <button key={p.id} className="project-row" disabled={!!pending} onClick={() => run(`open:${p.id}`, () => onOpen(p.id))}>
              <span>{p.title}</span>
              <small>v{p.version} · {Math.round((p.bytes || 0) / 1024)} KB</small>
            </button>
          ))}
        </div>
        {canRollback && (
          <>
            <div className="modal-sep"/>
            <div className="rollback-row">
              {["1m", "5m", "10m", "30m", "1h"].map((target) => (
                <button key={target} className="tb-btn" disabled={!!pending} onClick={() => run(`rollback:${target}`, () => onRollback(target))}>Rollback {target}</button>
              ))}
            </div>
          </>
        )}
      </div>
    </ModalShell>
  );
}

function ShareDialog({ onClose, onShare, shareUrl }) {
  const [pending, setPending] = useState("");
  const create = async (mode) => {
    if (pending) return;
    setPending(mode);
    try {
      await onShare(mode);
    } finally {
      setPending("");
    }
  };
  return (
    <ModalShell title="Share project" onClose={onClose}>
      <div className="modal-body">
        <button className="tb-btn" disabled={!!pending} onClick={() => create("read")}>{pending === "read" ? "Creating..." : "Create read-only link"}</button>
        <button className="tb-btn primary" disabled={!!pending} onClick={() => create("edit")}>{pending === "edit" ? "Creating..." : "Create editable link"}</button>
        {shareUrl && (
          <div className="share-url">
            <span>{shareUrl}</span>
            <button className="tb-btn" onClick={() => navigator.clipboard?.writeText(shareUrl).catch(() => {})}>Copy</button>
          </div>
        )}
      </div>
    </ModalShell>
  );
}

function ConflictDialog({ message, onClose, onLoadServer, onDuplicate, onTakeOver }) {
  return (
    <ModalShell title="Sync conflict" onClose={onClose}>
      <div className="modal-body">
        <div className="modal-error">{message}</div>
        <button className="tb-btn" onClick={onLoadServer}>Load server copy</button>
        <button className="tb-btn" onClick={onDuplicate}>Keep local as duplicate</button>
        <button className="tb-btn primary" onClick={onTakeOver}>Take edit lease</button>
      </div>
    </ModalShell>
  );
}

function ConfirmDialog({ title, message, confirmLabel = "Confirm", danger = false, onCancel, onConfirm }) {
  return (
    <ModalShell title={title || "Confirm"} onClose={onCancel}>
      <div className="modal-body">
        <div className={danger ? "modal-error" : "sync-line"}>{message}</div>
        <div className="modal-actions">
          <button className="tb-btn" onClick={onCancel}>Cancel</button>
          <button className={`tb-btn ${danger ? "" : "primary"}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </ModalShell>
  );
}

function PingDialog({ device, initialTarget, recentTargets, onClose, onSubmit }) {
  const [target, setTarget] = useState(initialTarget || "");
  const valid = target.trim().length > 0;
  return (
    <ModalShell title={`Ping from ${device?.hostname || "device"}`} onClose={onClose}>
      <form className="modal-body" onSubmit={(e) => { e.preventDefault(); if (valid) onSubmit(target); }}>
        <label>Target IP or hostname<input value={target} onChange={(e) => setTarget(e.target.value)} autoFocus /></label>
        {recentTargets?.length > 0 && (
          <div className="recent-row">
            {recentTargets.slice(0, 5).map((item) => (
              <button key={item} type="button" className="tb-btn" onClick={() => setTarget(item)}>{item}</button>
            ))}
          </div>
        )}
        <button className="tb-btn primary" type="submit" disabled={!valid}>Send ping</button>
      </form>
    </ModalShell>
  );
}

function computeDiagnostics(devices, links) {
  const items = [];
  for (const d of Object.values(devices)) {
    if (OPT_Engine.isHostLike?.(d)) {
      const hostIface = d.interfaces?.eth0 ? "eth0" : (d.interfaces?.en0 ? "en0" : Object.keys(d.interfaces || {})[0]);
      const e = d.interfaces?.[hostIface];
      if (!e || !e.ip) items.push({ label: `⚠ ${d.hostname}: no IP on ${hostIface || "host interface"}`, disabled: true });
      else if (!e.gw) items.push({ label: `⚠ ${d.hostname}: no default gateway`, disabled: true });
    }
    if (OPT_Engine.isRouterLike?.(d) && !OPT_Engine.isSwitchLike?.(d) && (!d.routes || d.routes.length === 0)) {
      items.push({ label: `⚠ ${d.hostname}: routing table empty`, disabled: true });
    }
  }
  if (!items.length) items.push({ label: "✓ All baseline checks passing", disabled: true });
  return items;
}

function downloadJSON(data, filename, type = "application/json") {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function downloadText(text, filename) {
  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function generateConfig(d) {
  return OPT_Engine.serializeConfig(d);
}

function packetTracerAssessmentText(item) {
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

function packetTracerIsConnectivityAssessment(item) {
  return /\b(connectivity|reachability|reachable|ping|icmp|trace\s*route|traceroute|simple\s+pdu|complex\s+pdu|pdu|successful\s+connection|packet\s+test)\b/i.test(packetTracerAssessmentText(item));
}

const PACKET_TRACER_BUILT_IN_COMPONENTS = new Set([
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

function packetTracerVisibleAssessmentItems(activity, allItems) {
  const scoredItems = (allItems || []).filter((item) => (Number(item.points) || 0) > 0);
  if (!scoredItems.length) return [];
  const authoredComponents = new Set((activity?.decoded?.visibleAssessmentComponents || []).filter(Boolean));
  if (!authoredComponents.size) {
    for (const item of scoredItems) {
      const component = item.components || "";
      if (component && !PACKET_TRACER_BUILT_IN_COMPONENTS.has(component.toLowerCase())) authoredComponents.add(component);
    }
  }
  if (!authoredComponents.size) return scoredItems;
  const authoredItems = scoredItems.filter((item) => authoredComponents.has(item.components || ""));
  return authoredItems.length ? authoredItems : scoredItems;
}

function packetTracerAssessmentSections(activity) {
  const allItems = activity?.assessmentItems || [];
  const visibleItems = allItems.length ? packetTracerVisibleAssessmentItems(activity, allItems) : [];
  if (!visibleItems.length && activity?.assessmentSections) {
    const storedItems = [
      ...(activity.assessmentSections.assessmentItems || []),
      ...(activity.assessmentSections.connectivityTests || []),
    ];
    const fallbackItems = packetTracerVisibleAssessmentItems(activity, storedItems);
    const connectivityTests = fallbackItems.filter(packetTracerIsConnectivityAssessment);
    const connectivitySet = new Set(connectivityTests);
    return {
      connectivityTests,
      assessmentItems: fallbackItems.filter((item) => !connectivitySet.has(item)),
      roots: activity.assessmentSections.roots || [],
    };
  }
  const connectivityTests = visibleItems.filter(packetTracerIsConnectivityAssessment);
  const connectivitySet = new Set(connectivityTests);
  const assessmentItems = visibleItems.filter((item) => !connectivitySet.has(item));
  return {
    connectivityTests,
    assessmentItems,
    roots: Object.entries(visibleItems.reduce((acc, item) => {
      const key = item.rootName || "Assessment Items";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})).map(([name, count]) => ({ name, count })),
  };
}

function packetTracerRubricLeafComponent(label, pathParts = []) {
  const text = [...pathParts, label].join(" ").toLowerCase();
  if (/\blink\b|connection|cable/.test(text)) return "Device Connections";
  if (/channel/.test(text)) return "EtherChannel Configuration";
  if (/trunk|port mode/.test(text)) return "Trunk Configuration";
  if (/gateway|address|mask|ip\b/.test(text)) return "IP Configuration";
  return "Assessment Items";
}

function packetTracerRubricLeafPoints(label, pathParts = []) {
  const component = packetTracerRubricLeafComponent(label, pathParts);
  if (component === "EtherChannel Configuration") return 3;
  return 1;
}

function packetTracerItemsFromRubricPattern(pattern) {
  if (!pattern || typeof pattern !== "object") return [];
  const items = [];
  const walk = (value, parts) => {
    if (Array.isArray(value)) {
      for (const entry of value) {
        if (typeof entry === "string") {
          const pathParts = [...parts, entry];
          items.push({
            name: entry,
            path: pathParts.join(" / "),
            pathParts,
            parentPath: parts.join(" / "),
            rootName: parts[0] || "Assessment Items",
            components: packetTracerRubricLeafComponent(entry, parts),
            points: packetTracerRubricLeafPoints(entry, parts),
          });
        } else {
          walk(entry, parts);
        }
      }
      return;
    }
    if (value && typeof value === "object") {
      for (const [key, child] of Object.entries(value)) walk(child, [...parts, key]);
    }
  };
  walk(pattern, []);
  return items;
}

function packetTracerGradeSourceItems(activity) {
  const imported = packetTracerVisibleAssessmentItems(activity, activity?.assessmentItems || []);
  if (imported.length) return imported;
  return packetTracerItemsFromRubricPattern(activity?.rubricPattern || []);
}

function packetTracerNormText(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function packetTracerIfaceKey(value) {
  return packetTracerNormText(value)
    .replace(/\bfastethernet\b/g, "fa")
    .replace(/\bgigabitethernet\b/g, "gi")
    .replace(/\bserial\b/g, "se")
    .replace(/\bport-channel\b/g, "po")
    .replace(/\bethernet\b/g, "eth")
    .replace(/\s+/g, "");
}

function packetTracerDeviceByName(devices, name) {
  const wanted = packetTracerNormText(name);
  if (!wanted) return null;
  return Object.values(devices || {}).find((device) => {
    return [device.hostname, device.name, device.packetTracer?.name].some((candidate) => packetTracerNormText(candidate) === wanted);
  }) || null;
}

function packetTracerEscapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function packetTracerExtractDeviceFromText(devices, text) {
  const source = packetTracerNormText(text);
  if (!source) return null;
  return Object.values(devices || {}).find((device) => {
    return [device.hostname, device.name, device.packetTracer?.name].some((candidate) => {
      const name = packetTracerNormText(candidate);
      return name && new RegExp(`(^|[^a-z0-9_-])${packetTracerEscapeRegex(name)}([^a-z0-9_-]|$)`, "i").test(source);
    });
  }) || null;
}

function packetTracerIfaceByName(device, name) {
  const wanted = packetTracerIfaceKey(name);
  if (!device || !wanted) return null;
  return Object.keys(device.interfaces || {}).find((iface) => packetTracerIfaceKey(iface) === wanted || packetTracerIfaceKey(OPT_Engine.shortIfaceName?.(iface) || iface) === wanted) || null;
}

function packetTracerExtractIfaceFromText(device, text) {
  if (!device) return null;
  const source = String(text || "");
  const ifacePattern = /\b(?:FastEthernet|GigabitEthernet|Serial|Ethernet|Port-channel|Fa|Gi|Se|Eth|Po)\s*\d+(?:\/\d+){0,3}\b/gi;
  const matches = source.match(ifacePattern) || [];
  for (const match of matches) {
    const iface = packetTracerIfaceByName(device, match);
    if (iface) return iface;
  }
  return null;
}

function packetTracerItemTarget(item, devices) {
  const parts = packetTracerAssessmentPathParts(item);
  let device = null;
  let iface = null;
  for (const part of parts) {
    device = packetTracerDeviceByName(devices, part);
    if (device) break;
  }
  if (!device) device = packetTracerExtractDeviceFromText(devices, [item?.path, item?.name, item?.parentPath].filter(Boolean).join(" / "));
  if (device) {
    for (const part of parts) {
      iface = packetTracerIfaceByName(device, part);
      if (iface) break;
    }
    if (!iface) iface = packetTracerExtractIfaceFromText(device, item?.path || item?.name);
  }
  return { device, iface, parts };
}

function packetTracerFindLink(devices, links, device, iface) {
  if (!device || !iface) return null;
  return (links || []).find((link) => {
    return (link.a === device.id && link.ai === iface) || (link.b === device.id && link.bi === iface);
  }) || null;
}

function packetTracerLinkPeer(devices, link, device) {
  if (!link || !device) return {};
  const peerId = link.a === device.id ? link.b : link.a;
  const peerIface = link.a === device.id ? link.bi : link.ai;
  return { peer: devices?.[peerId], peerIface };
}

function packetTracerExpectedLinkPeer(text) {
  const source = String(text || "");
  return (
    source.match(/link to\s+([^:\/]+):?\s*connects to\s+([a-z-]+\s*\d+(?:\/\d+){0,3})/i) ||
    source.match(/connects to\s+([^:\/]+):\s*([a-z-]+\s*\d+(?:\/\d+){0,3})/i) ||
    source.match(/cable to\s+([^:\/]+):\s*([a-z-]+\s*\d+(?:\/\d+){0,3})/i)
  );
}

function packetTracerExpandIfaceRange(text, device) {
  const raw = String(text || "").trim();
  const range = raw.match(/^(.+?)(\d+)\s*-\s*(\d+)$/);
  if (!range) {
    const iface = packetTracerIfaceByName(device, raw);
    return iface ? [iface] : [];
  }
  const prefix = range[1];
  const start = Number(range[2]);
  const end = Number(range[3]);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return [];
  const out = [];
  for (let n = start; n <= end; n++) {
    const iface = packetTracerIfaceByName(device, `${prefix}${n}`);
    if (iface) out.push(iface);
  }
  return out;
}

function packetTracerAnswerExpectations(activity, devices) {
  const expected = {};
  for (const [deviceName, commands] of Object.entries(activity?.answerCommands || {})) {
    const device = packetTracerDeviceByName(devices, deviceName);
    if (!device) continue;
    const devExpected = expected[device.id] = expected[device.id] || { hostname: deviceName, interfaces: {} };
    let ifaces = [];
    for (const raw of commands || []) {
      const cmd = packetTracerNormText(raw);
      let match = cmd.match(/^hostname (.+)$/);
      if (match) {
        devExpected.hostname = match[1];
        continue;
      }
      match = cmd.match(/^interface range (.+)$/);
      if (match) {
        ifaces = packetTracerExpandIfaceRange(match[1], device);
        continue;
      }
      match = cmd.match(/^interface (.+)$/);
      if (match) {
        const iface = packetTracerIfaceByName(device, match[1]);
        ifaces = iface ? [iface] : [];
        continue;
      }
      const setForIfaces = (fn) => {
        for (const iface of ifaces) {
          devExpected.interfaces[iface] = devExpected.interfaces[iface] || {};
          fn(devExpected.interfaces[iface]);
        }
      };
      match = cmd.match(/^switchport mode (access|trunk)$/);
      if (match) setForIfaces((data) => { data.mode = match[1]; });
      match = cmd.match(/^switchport access vlan (\d+)$/);
      if (match) setForIfaces((data) => { data.vlan = Number(match[1]); data.mode = data.mode || "access"; });
      match = cmd.match(/^switchport trunk native vlan (\d+)$/);
      if (match) setForIfaces((data) => { data.nativeVlan = Number(match[1]); data.mode = "trunk"; });
      match = cmd.match(/^switchport trunk allowed vlan (.+)$/);
      if (match) setForIfaces((data) => { data.allowedVlans = match[1]; data.mode = "trunk"; });
      match = cmd.match(/^channel-group (\d+) mode (\S+)$/);
      if (match) setForIfaces((data) => { data.channelGroup = { id: Number(match[1]), mode: match[2] }; });
      match = cmd.match(/^ip address (\S+) (\S+)$/);
      if (match) setForIfaces((data) => { data.ip = match[1]; data.mask = match[2]; });
    }
  }
  return expected;
}

function packetTracerCompare(actual, expected) {
  return packetTracerNormText(actual) === packetTracerNormText(expected);
}

function packetTracerGradeItem(item, context) {
  const points = Number(item?.points) || 0;
  const text = packetTracerAssessmentText(item);
  const { device, iface } = packetTracerItemTarget(item, context.devices);
  const expected = device ? context.expected[device.id] : null;
  const expectedIface = iface ? expected?.interfaces?.[iface] : null;
  const actualIface = iface ? device?.interfaces?.[iface] : null;
  const correct = (feedback = "Passed") => ({ ...item, points, earnedPoints: points, correct: true, status: "Correct", feedback });
  const incorrect = (feedback = "Does not match the expected state") => ({ ...item, points, earnedPoints: 0, correct: false, status: "Incorrect", feedback });
  const unchecked = (feedback = "OpenPT does not have a checker for this Packet Tracer item yet") => ({ ...item, points, earnedPoints: 0, correct: false, unchecked: true, status: "Unchecked", feedback });

  if (/display name|host ?name/.test(text) && device && expected?.hostname) {
    return packetTracerCompare(device.hostname, expected.hostname)
      ? correct(`${device.hostname} matches`)
      : incorrect(`Expected hostname ${expected.hostname}`);
  }

  if (/link type|cable type/.test(text) && device && iface) {
    const link = packetTracerFindLink(context.devices, context.links, device, iface);
    if (!link) return incorrect(`No link on ${device.hostname} ${iface}`);
    if (/serial/.test(text)) return /serial/i.test(link.type || link.packetTracer?.type || "") ? correct("Serial link") : incorrect("Expected serial link");
    if (/copper|ethernet|straight/.test(text) || /trunk configuration/.test(text)) {
      return /serial/i.test(link.type || "") ? incorrect("Expected Ethernet/copper link") : correct("Ethernet link");
    }
    return correct("Link type present");
  }

  if (/link to|connects to|connection|cable/.test(text) && device && iface) {
    const peerMatch = packetTracerExpectedLinkPeer(text);
    if (!peerMatch) return unchecked("Expected link peer was not decoded for this item");
    const link = packetTracerFindLink(context.devices, context.links, device, iface);
    if (!link) return incorrect(`No link on ${device.hostname} ${iface}`);
    const { peer, peerIface } = packetTracerLinkPeer(context.devices, link, device);
    const peerNameOk = packetTracerCompare(peer?.hostname, peerMatch[1]) || packetTracerCompare(peer?.name, peerMatch[1]) || packetTracerCompare(peer?.packetTracer?.name, peerMatch[1]);
    const peerIfaceOk = packetTracerIfaceKey(peerIface) === packetTracerIfaceKey(peerMatch[2]);
    return peerNameOk && peerIfaceOk
      ? correct(`Linked to ${peer.hostname} ${peerIface}`)
      : incorrect(`Expected link to ${peerMatch[1]} ${peerMatch[2]}`);
  }

  if (/port mode|switchport mode/.test(text) && actualIface) {
    const want = expectedIface?.mode || (/trunk/.test(text) ? "trunk" : /access/.test(text) ? "access" : null);
    if (!want) return unchecked();
    return actualIface.mode === want ? correct(`${iface} is ${want}`) : incorrect(`Expected ${iface} switchport mode ${want}`);
  }

  if (/access vlan|vlan membership|assigned vlan/.test(text) && actualIface) {
    const want = expectedIface?.vlan || (String(item?.value || item?.name || "").match(/\b(\d+)\b/) || [])[1];
    if (!want) return unchecked();
    return Number(actualIface.vlan) === Number(want)
      ? correct(`${iface} is assigned to VLAN ${want}`)
      : incorrect(`Expected ${iface} access VLAN ${want}`);
  }

  if (/channel group/.test(text) && actualIface) {
    const want = expectedIface?.channelGroup?.id;
    if (!want) return unchecked();
    return Number(actualIface.channelGroup?.id) === Number(want)
      ? correct(`${iface} is in channel-group ${want}`)
      : incorrect(`Expected ${iface} in channel-group ${want}`);
  }

  if (/channel mode/.test(text) && actualIface) {
    const want = expectedIface?.channelGroup?.mode;
    if (!want) return unchecked();
    return packetTracerCompare(actualIface.channelGroup?.mode, want)
      ? correct(`${iface} channel mode ${want}`)
      : incorrect(`Expected ${iface} channel mode ${want}`);
  }

  if (/ospf priority/.test(text) && actualIface) {
    const want = (String(item?.value || item?.name || "").match(/priority\s+(\d+)/i) || [])[1];
    if (!want) return unchecked();
    return Number(actualIface.ospfPriority) === Number(want)
      ? correct(`${iface} OSPF priority ${want}`)
      : incorrect(`Expected ${iface} OSPF priority ${want}`);
  }

  if (/exec-timeout/.test(text) && device) {
    const match = String(item?.value || item?.name || "").match(/exec-timeout\s+(\d+)\s+(\d+)/i);
    const line = /vty/.test(text) ? "vty" : "console";
    if (!match) return unchecked();
    const actual = device.lines?.[line]?.timeout;
    return Number(actual?.minutes) === Number(match[1]) && Number(actual?.seconds || 0) === Number(match[2])
      ? correct(`${line} exec-timeout ${match[1]} ${match[2]}`)
      : incorrect(`Expected ${line} exec-timeout ${match[1]} ${match[2]}`);
  }

  if (/transport input/.test(text) && device) {
    const want = (String(item?.value || item?.name || "").match(/transport input\s+(.+)$/i) || [])[1]?.trim();
    if (!want) return unchecked();
    const actual = (device.lines?.vty?.transport || []).join(" ");
    return packetTracerCompare(actual, want)
      ? correct(`vty transport input ${want}`)
      : incorrect(`Expected vty transport input ${want}`);
  }

  if (/ip ssh version/.test(text) && device) {
    const want = (String(item?.value || item?.name || "").match(/ip ssh version\s+(\d+)/i) || [])[1];
    if (!want) return unchecked();
    return Number(device.ssh?.version) === Number(want)
      ? correct(`SSH version ${want}`)
      : incorrect(`Expected ip ssh version ${want}`);
  }

  const value = item?.value || item?.attrs?.value || item?.attrs?.expected || "";
  if (/ip address/.test(text) && actualIface && /\d+\.\d+\.\d+\.\d+/.test(value)) {
    return packetTracerCompare(actualIface.ip, value) ? correct(`${iface} IP matches`) : incorrect(`Expected ${iface} IP ${value}`);
  }
  if (/subnet mask/.test(text) && actualIface && /\d+\.\d+\.\d+\.\d+/.test(value)) {
    return packetTracerCompare(actualIface.mask, value) ? correct(`${iface} mask matches`) : incorrect(`Expected ${iface} mask ${value}`);
  }
  if (/default gateway/.test(text) && device && /\d+\.\d+\.\d+\.\d+/.test(value)) {
    const gateways = Object.values(device.interfaces || {}).map((ifc) => ifc.gw).filter(Boolean);
    return gateways.some((gw) => packetTracerCompare(gw, value)) ? correct("Default gateway matches") : incorrect(`Expected default gateway ${value}`);
  }
  if (value && device) {
    const config = packetTracerNormText(OPT_Engine.serializeConfig?.(device) || "");
    if (config.includes(packetTracerNormText(value))) return correct("Expected config value found");
  }
  return unchecked();
}

function packetTracerProgressFromItems(items) {
  const totalPoints = items.reduce((sum, item) => sum + (Number(item.points) || 0), 0);
  const earnedPoints = items.reduce((sum, item) => sum + (Number(item.earnedPoints) || 0), 0);
  const totalItems = items.length;
  const earnedItems = items.filter((item) => item.correct).length;
  return {
    percent: totalPoints ? Math.round((earnedPoints / totalPoints) * 100) : 0,
    score: `${earnedPoints}/${totalPoints}`,
    itemCount: `${earnedItems}/${totalItems}`,
    components: Object.values(items.reduce((acc, item) => {
      const name = item.components || "Other";
      acc[name] = acc[name] || { name, earnedItems: 0, items: 0, earnedPoints: 0, points: 0 };
      acc[name].items += 1;
      acc[name].points += Number(item.points) || 0;
      if (item.correct) acc[name].earnedItems += 1;
      acc[name].earnedPoints += Number(item.earnedPoints) || 0;
      return acc;
    }, {})).map((component) => ({
      name: component.name,
      items: `${component.earnedItems}/${component.items}`,
      score: `${component.earnedPoints}/${component.points}`,
    })),
  };
}

function gradePacketTracerActivity(activity, devices, links) {
  if (!activity) return null;
  const sourceItems = packetTracerGradeSourceItems(activity);
  if (!sourceItems.length) return activity;
  const context = {
    devices,
    links,
    expected: packetTracerAnswerExpectations(activity, devices),
  };
  const assessmentItems = sourceItems.map((item) => packetTracerGradeItem(item, context));
  return {
    ...activity,
    assessmentItems,
    progress: packetTracerProgressFromItems(assessmentItems),
  };
}

function sanitizePacketTracerHtml(html) {
  const source = String(html || "");
  if (!source.trim()) return "";
  try {
    const doc = new DOMParser().parseFromString(source, "text/html");
    doc.querySelectorAll("script,style,link,meta,iframe,object,embed").forEach((node) => node.remove());
    doc.body.querySelectorAll("*").forEach((node) => {
      Array.from(node.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase();
        const value = String(attr.value || "");
        if (
          name.startsWith("on") ||
          name === "style" ||
          name === "bgcolor" ||
          name === "background" ||
          name === "color" ||
          name === "text" ||
          ((name === "href" || name === "src") && /^\s*javascript:/i.test(value))
        ) {
          node.removeAttribute(attr.name);
        }
      });
    });
    return doc.body.innerHTML;
  } catch (error) {
    return "";
  }
}

function PacketTracerAssignmentSidebar({ activity, activeTab, onTabChange }) {
  const assessmentSections = packetTracerAssessmentSections(activity);
  const assessmentCount = (assessmentSections.assessmentItems?.length || 0) + (assessmentSections.connectivityTests?.length || 0);
  const hasProgress = !!activity?.progress || assessmentCount > 0;
  const title = activity?.title || activity?.sourceName || "Packet Tracer assignment";
  return (
    <aside className="side-panel pt-side-panel">
      <div className="pt-side-title">
        <div>
          <div className="pt-side-kicker">Assignment</div>
          <div className="pt-side-name" title={title}>{title}</div>
        </div>
        {activity?.progress?.itemCount && <span className="pt-score-chip">{activity.progress.itemCount}</span>}
      </div>
      <div className="side-tabs pt-side-tabs" role="tablist" aria-label="Assignment sidebar">
        {[
          ["instructions", "Instructions"],
          ["progress", "Progress"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={activeTab === key}
            className={`side-tab ${activeTab === key ? "active" : ""}`}
            onClick={() => onTabChange(key)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="pt-side-body">
        {activeTab === "instructions" ? (
          <PacketTracerInstructions activity={activity} />
        ) : (
          <PacketTracerProgress activity={activity} assessmentSections={assessmentSections} hasProgress={hasProgress} />
        )}
      </div>
    </aside>
  );
}

function PacketTracerInstructions({ activity }) {
  const html = useMemo(() => sanitizePacketTracerHtml(activity?.instructionsHtml), [activity?.instructionsHtml]);
  if (html) {
    return <div className="pt-instructions-html" dangerouslySetInnerHTML={{ __html: html }} />;
  }
  return (
    <div className="pt-empty">
      {activity?.instructionsText || "No assignment instructions were found in this Packet Tracer file."}
    </div>
  );
}

function PacketTracerProgress({ activity, assessmentSections, hasProgress }) {
  const components = activity?.progress?.components || [];
  const totalAssessmentItems = assessmentSections.assessmentItems.length + assessmentSections.connectivityTests.length;
  if (!hasProgress) return <div className="pt-empty">No progress or assessment data was decoded for this assignment.</div>;
  return (
    <div className="pt-progress">
      <div className="pt-metric-grid">
        <div className="pt-metric">
          <span>Items</span>
          <strong>{activity?.progress?.itemCount || `${totalAssessmentItems}/${totalAssessmentItems}`}</strong>
        </div>
        <div className="pt-metric">
          <span>Connectivity</span>
          <strong>{assessmentSections.connectivityTests.length}</strong>
        </div>
        <div className="pt-metric">
          <span>Assessment</span>
          <strong>{assessmentSections.assessmentItems.length}</strong>
        </div>
      </div>

      {components.length > 0 && (
        <>
          <div className="pt-section-title">Components</div>
          <div className="pt-table">
            <div className="pt-table-row pt-table-head">
              <span>Component</span>
              <span>Items</span>
              <span>Score</span>
            </div>
            {components.map((component, index) => (
              <div className="pt-table-row" key={`${component.name || "component"}-${index}`}>
                <span title={component.name}>{component.name}</span>
                <span>{component.items || "0/0"}</span>
                <span>{component.score || "0 pts"}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {assessmentSections.roots?.length > 0 && (
        <>
          <div className="pt-section-title">Assessment Roots</div>
          <div className="pt-table two-col">
            <div className="pt-table-row pt-table-head">
              <span>Root</span>
              <span>Items</span>
            </div>
            {assessmentSections.roots.map((root, index) => (
              <div className="pt-table-row" key={`${root.name}-${index}`}>
                <span title={root.name}>{root.name}</span>
                <span>{root.count}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function packetTracerAssessmentPathParts(item) {
  if (Array.isArray(item?.pathParts) && item.pathParts.length) return item.pathParts;
  return String(item?.path || item?.name || "Assessment Item").split(/\s*\/\s*/).filter(Boolean);
}

function buildPacketTracerAssessmentTree(items) {
  const root = { key: "root", name: "root", depth: -1, children: [], childMap: new Map() };
  for (const item of items || []) {
    let cursor = root;
    const parts = packetTracerAssessmentPathParts(item);
    parts.forEach((part, index) => {
      const key = `${cursor.key}/${part}`;
      let next = cursor.childMap.get(part);
      if (!next) {
        next = { key, name: part, depth: index, children: [], childMap: new Map(), item: null };
        cursor.childMap.set(part, next);
        cursor.children.push(next);
      }
      if (index === parts.length - 1) next.item = item;
      cursor = next;
    });
  }
  const rows = [];
  const visit = (node, parentKeys = []) => {
    for (const child of node.children) {
      rows.push({
        ...child,
        parentKeys,
        isLeaf: !!child.item && child.children.length === 0,
      });
      visit(child, [...parentKeys, child.key]);
    }
  };
  visit(root);
  return rows;
}

function packetTracerComponentSummary(items) {
  return Object.values((items || []).reduce((acc, item) => {
    const name = item.components || "Other";
    acc[name] = acc[name] || { name, items: 0, points: 0, earnedItems: 0, earnedPoints: 0 };
    acc[name].items += 1;
    acc[name].points += Number(item.points) || 0;
    if (item.correct) acc[name].earnedItems += 1;
    acc[name].earnedPoints += Number(item.earnedPoints) || 0;
    return acc;
  }, {}));
}

function PacketTracerAssessmentSummary({ items }) {
  const components = packetTracerComponentSummary(items);
  const totalPoints = items.reduce((sum, item) => sum + (Number(item.points) || 0), 0);
  const earnedPoints = items.reduce((sum, item) => sum + (Number(item.earnedPoints) || 0), 0);
  const earnedItems = items.filter((item) => item.correct).length;
  return (
    <aside className="pt-check-summary">
      <div className="pt-check-score">
        <div><strong>Score</strong><span>{earnedPoints}/{totalPoints}</span></div>
        <div><strong>Item Count</strong><span>{earnedItems}/{items.length}</span></div>
      </div>
      <div className="pt-component-table">
        <div className="pt-component-head"><span>Component</span><span>Items/Total</span><span>Score</span></div>
        {components.map((component) => (
          <div className="pt-component-row" key={component.name}>
            <span title={component.name}>{component.name}</span>
            <span>{component.earnedItems || 0}/{component.items}</span>
            <span>{component.earnedPoints || 0}/{component.points}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}

function PacketTracerAssessmentRows({ items, empty }) {
  const rows = useMemo(() => buildPacketTracerAssessmentTree(items || []), [items]);
  const expandableKeys = useMemo(() => rows.filter((row) => row.children.length).map((row) => row.key), [rows]);
  const [expanded, setExpanded] = useState(() => new Set(expandableKeys));
  const [showIncorrectOnly, setShowIncorrectOnly] = useState(() => (items || []).some((item) => item.correct === false));
  const [query, setQuery] = useState("");
  useEffect(() => {
    setExpanded(new Set(expandableKeys));
  }, [expandableKeys.join("|")]);
  const allExpanded = expandableKeys.length > 0 && expandableKeys.every((key) => expanded.has(key));
  if (!items?.length) return <div className="pt-check-empty">{empty}</div>;
  const visibleKeys = new Set();
  if (showIncorrectOnly) {
    for (const row of rows) {
      if (row.item && !row.item.correct) {
        visibleKeys.add(row.key);
        row.parentKeys.forEach((key) => visibleKeys.add(key));
      }
    }
  }
  const q = query.trim().toLowerCase();
  const visibleRows = rows.filter((row) => {
    if (!row.parentKeys.every((key) => expanded.has(key))) return false;
    if (showIncorrectOnly && !visibleKeys.has(row.key)) return false;
    if (!q) return true;
    const item = row.item;
    return [row.name, item?.status, item?.components, item?.feedback, item?.path].filter(Boolean).join(" ").toLowerCase().includes(q);
  });
  const uncheckedCount = (items || []).filter((item) => item.unchecked).length;
  const toggleNode = (key) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };
  return (
    <div className="pt-check-layout">
      <div className="pt-check-main">
        <div className="pt-check-actions">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search assessment items" />
          <button type="button" onClick={() => setExpanded(allExpanded ? new Set() : new Set(expandableKeys))}>Expand/Collapse All</button>
          <button type="button" onClick={() => setShowIncorrectOnly((value) => !value)}>{showIncorrectOnly ? "Show All Items" : "Show Incorrect Items"}</button>
          {uncheckedCount > 0 && <span className="pt-check-note">{uncheckedCount} unchecked by OpenPT</span>}
        </div>
        <div className="pt-check-grid" role="table" aria-label="Packet Tracer assessment items">
          <div className="pt-check-row pt-check-head" role="row">
            <span>Assessment Items</span><span>Status</span><span>Points</span><span>Component(s)</span><span>Feedback</span>
          </div>
          {visibleRows.map((row) => {
            const item = row.item;
            const hasChildren = row.children.length > 0;
            return (
              <div className="pt-check-row" role="row" key={row.key}>
                <span className="pt-check-name" style={{ paddingLeft: `${Math.max(0, row.depth) * 20 + 4}px` }} title={item?.path || row.name}>
                  {hasChildren ? (
                    <button type="button" className="pt-check-expander" onClick={() => toggleNode(row.key)} aria-label={`${expanded.has(row.key) ? "Collapse" : "Expand"} ${row.name}`}>
                      {expanded.has(row.key) ? "-" : "+"}
                    </button>
                  ) : <span className="pt-check-spacer" />}
                  {item && <span className="pt-check-x">{item.correct ? "✓" : "x"}</span>}
                  <span>{row.name}</span>
                </span>
                <span>{item ? (item.status || "Unchecked") : ""}</span>
                <span>{item ? `${Number(item.earnedPoints) || 0}/${Number(item.points) || 0}` : ""}</span>
                <span title={item?.components || ""}>{item?.components || ""}</span>
                <span title={item?.feedback || item?.attrs?.incorrectFeedback || item?.attrs?.feedback || ""}>{item?.feedback || item?.attrs?.incorrectFeedback || item?.attrs?.feedback || ""}</span>
              </div>
            );
          })}
        </div>
      </div>
      <PacketTracerAssessmentSummary items={items} />
    </div>
  );
}

function ServerModuleSidebar({ device, activeTab, activeConfig, onTabChange, onConfigChange, onUpdate, onClose }) {
  const cfg = ensureServerConfig(device);
  return (
    <aside className="server-module-sidebar" aria-label={`${device.hostname} server module`}>
      <div className="server-module-head">
        <div className="server-module-title">
          <span>{device.hostname}</span>
          <small>Server-PT</small>
        </div>
        <button className="server-module-close" type="button" onClick={onClose} title="Close server module">×</button>
      </div>
      <div className="server-module-tabs" role="tablist" aria-label="Server module tabs">
        <button type="button" className={activeTab === "config" ? "active" : ""} onClick={() => onTabChange("config")}>Config</button>
        <button type="button" className={activeTab === "desktop" ? "active" : ""} onClick={() => onTabChange("desktop")}>Desktop</button>
      </div>
      {activeTab === "desktop" ? (
        <ServerDesktopPanel />
      ) : (
        <ServerConfigPanel device={device} cfg={cfg} activeConfig={activeConfig} onConfigChange={onConfigChange} onUpdate={onUpdate} />
      )}
    </aside>
  );
}

function ServerConfigPanel({ device, cfg, activeConfig, onConfigChange, onUpdate }) {
  return (
    <div className="server-config-shell">
      <div className="server-config-nav" aria-label="Server Config sections">
        <div className="server-config-nav-title">CONFIG</div>
        {SERVER_CONFIG_SECTIONS.map(([key, label]) => (
          <button key={key} type="button" className={activeConfig === key ? "active" : ""} onClick={() => onConfigChange(key)}>{label}</button>
        ))}
      </div>
      <div className="server-config-body">
        {activeConfig === "http" && <HttpConfig cfg={cfg.http} onUpdate={onUpdate} />}
        {activeConfig === "dhcp" && <DhcpConfig cfg={cfg.dhcp} onUpdate={onUpdate} />}
        {activeConfig === "dhcpv6" && <Dhcpv6Config cfg={cfg.dhcpv6} onUpdate={onUpdate} />}
        {activeConfig === "tftp" && <TftpConfig cfg={cfg.tftp} onUpdate={onUpdate} />}
        {activeConfig === "dns" && <DnsConfig cfg={cfg.dns} onUpdate={onUpdate} />}
        {activeConfig === "syslog" && <SyslogConfig cfg={cfg.syslog} onUpdate={onUpdate} device={device} />}
        {activeConfig === "aaa" && <AaaConfig cfg={cfg.aaa} onUpdate={onUpdate} />}
        {activeConfig === "ntp" && <NtpConfig cfg={cfg.ntp} onUpdate={onUpdate} />}
        {activeConfig === "email" && <EmailConfig cfg={cfg.email} onUpdate={onUpdate} />}
        {activeConfig === "ftp" && <FtpConfig cfg={cfg.ftp} onUpdate={onUpdate} />}
        {activeConfig === "iot" && <SimpleRegistryConfig title="Registration Server" section="iot" cfg={cfg.iot} onUpdate={onUpdate} serviceName="iot" />}
        {activeConfig === "vm" && <VmConfig cfg={cfg.vm} onUpdate={onUpdate} />}
        {activeConfig === "radiusEap" && <RadiusEapConfig cfg={cfg.radiusEap} onUpdate={onUpdate} />}
        {activeConfig === "prp" && <PrpConfig cfg={cfg.prp} onUpdate={onUpdate} />}
      </div>
    </div>
  );
}

function ServiceSwitch({ label = "Service", value, onChange }) {
  return (
    <div className="server-service-row">
      <span>{label}</span>
      <label><input type="radio" checked={!!value} onChange={() => onChange(true)} /> On</label>
      <label><input type="radio" checked={!value} onChange={() => onChange(false)} /> Off</label>
    </div>
  );
}

function ServerTable({ columns, rows, selectedIndex, onSelect, empty = "No entries" }) {
  return (
    <div className="server-table">
      <div className="server-table-head" style={{ gridTemplateColumns: columns.map((c) => c.width || "1fr").join(" ") }}>
        {columns.map((c) => <span key={c.key}>{c.label}</span>)}
      </div>
      <div className="server-table-body">
        {!rows.length && <div className="server-table-empty">{empty}</div>}
        {rows.map((row, i) => (
          <button key={row.id || row.name || row.username || i} type="button" className={`server-table-row ${selectedIndex === i ? "selected" : ""}`} style={{ gridTemplateColumns: columns.map((c) => c.width || "1fr").join(" ") }} onClick={() => onSelect?.(i)}>
            {columns.map((c) => <span key={c.key}>{row[c.key] || ""}</span>)}
          </button>
        ))}
      </div>
    </div>
  );
}

function HttpConfig({ cfg, onUpdate }) {
  const [selected, setSelected] = useState(null);
  const files = cfg.files || SERVER_WEB_FILES;
  const setToggle = (key, value) => onUpdate((d, c) => {
    c.http[key] = value;
    d.services[key] = value;
  }, `${key.toUpperCase()} service ${value ? "enabled" : "disabled"}`);
  const editFile = (index) => {
    const file = files[index];
    if (!file?.editable) return;
    const content = window.prompt(`Edit ${file.name}`, file.content || "");
    if (content == null) return;
    onUpdate((d, c) => {
      c.http.files[index] = { ...c.http.files[index], content };
      d.files[`flash:${file.name}`] = content;
    }, `${file.name} updated`);
  };
  return (
    <div className="server-section">
      <h3>HTTP</h3>
      <div className="server-two-col">
        <ServiceSwitch label="HTTP" value={cfg.http} onChange={(v) => setToggle("http", v)} />
        <ServiceSwitch label="HTTPS" value={cfg.https} onChange={(v) => setToggle("https", v)} />
      </div>
      <h4>File Manager</h4>
      <ServerTable columns={[{ key: "name", label: "File Name" }, { key: "edit", label: "Edit", width: "76px" }, { key: "del", label: "Delete", width: "86px" }]} rows={files.map((f) => ({ ...f, edit: f.editable ? "(edit)" : "", del: "(delete)" }))} selectedIndex={selected} onSelect={setSelected} />
      <div className="server-actions">
        <button type="button" onClick={() => {
          const name = window.prompt("New file name", "newfile.html");
          if (!name) return;
          onUpdate((d, c) => { c.http.files.push({ name, editable: true, content: "" }); d.files[`flash:${name}`] = ""; }, `${name} created`);
        }}>New File</button>
        <button type="button" onClick={() => {
          const name = window.prompt("Import file name");
          if (!name) return;
          onUpdate((d, c) => { c.http.files.push({ name, editable: /\.(html?|txt)$/i.test(name), content: "" }); d.files[`flash:${name}`] = ""; }, `${name} imported`);
        }}>Import</button>
        <button type="button" disabled={selected == null} onClick={() => editFile(selected)}>Edit</button>
        <button type="button" disabled={selected == null} onClick={() => onUpdate((d, c) => { const [removed] = c.http.files.splice(selected, 1); if (removed) delete d.files[`flash:${removed.name}`]; }, "HTTP file removed")}>Delete</button>
      </div>
    </div>
  );
}

function DhcpConfig({ cfg, onUpdate }) {
  const first = cfg.pools?.[0] || {};
  const [form, setForm] = useState({
    poolName: cfg.selectedPool || first.poolName || "serverPool",
    defaultGateway: first.defaultGateway || "0.0.0.0",
    dnsServer: first.dnsServer || "0.0.0.0",
    startIp: first.startIp || "209.165.200.0",
    subnetMask: first.subnetMask || "255.255.255.0",
    maxUsers: first.maxUsers || 512,
    tftpServer: first.tftpServer || "0.0.0.0",
    wlcAddress: first.wlcAddress || "0.0.0.0",
  });
  useEffect(() => {
    const selected = cfg.pools?.find((p) => p.poolName === cfg.selectedPool) || cfg.pools?.[0];
    if (selected) setForm({ ...selected });
  }, [cfg.selectedPool, cfg.pools?.length]);
  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  return (
    <div className="server-section">
      <h3>DHCP</h3>
      <ServiceSwitch value={cfg.service} onChange={(v) => onUpdate((d, c) => { c.dhcp.service = v; d.services.dhcp = v; }, `DHCP service ${v ? "enabled" : "disabled"}`)} />
      <div className="server-form-grid">
        <label>Pool Name<input value={form.poolName} onChange={(e) => setField("poolName", e.target.value)} /></label>
        <label>Default Gateway<input value={form.defaultGateway} onChange={(e) => setField("defaultGateway", e.target.value)} /></label>
        <label>DNS Server<input value={form.dnsServer} onChange={(e) => setField("dnsServer", e.target.value)} /></label>
        <label>Start IP Address<input value={form.startIp} onChange={(e) => setField("startIp", e.target.value)} /></label>
        <label>Subnet Mask<input value={form.subnetMask} onChange={(e) => setField("subnetMask", e.target.value)} /></label>
        <label>Maximum Number of Users<input value={form.maxUsers} onChange={(e) => setField("maxUsers", e.target.value)} /></label>
        <label>TFTP Server<input value={form.tftpServer} onChange={(e) => setField("tftpServer", e.target.value)} /></label>
        <label>WLC Address<input value={form.wlcAddress} onChange={(e) => setField("wlcAddress", e.target.value)} /></label>
      </div>
      <div className="server-actions">
        <button type="button" onClick={() => setForm({ poolName: "", defaultGateway: "0.0.0.0", dnsServer: "0.0.0.0", startIp: "", subnetMask: "255.255.255.0", maxUsers: 512, tftpServer: "0.0.0.0", wlcAddress: "0.0.0.0" })}>Add</button>
        <button type="button" onClick={() => onUpdate((d, c) => {
          const pool = { ...form, poolName: form.poolName || "serverPool" };
          const idx = c.dhcp.pools.findIndex((p) => p.poolName === pool.poolName);
          if (idx >= 0) c.dhcp.pools[idx] = pool; else c.dhcp.pools.push(pool);
          c.dhcp.selectedPool = pool.poolName;
          d.dhcp.pools[pool.poolName] = { network: networkFromIpMask(pool.startIp, pool.subnetMask), mask: pool.subnetMask, defaultRouter: pool.defaultGateway, dnsServer: pool.dnsServer, startIp: pool.startIp, maxUsers: pool.maxUsers, tftpServer: pool.tftpServer, wlcAddress: pool.wlcAddress };
        }, "DHCP pool saved")}>Save</button>
        <button type="button" onClick={() => onUpdate((d, c) => { c.dhcp.pools = c.dhcp.pools.filter((p) => p.poolName !== form.poolName); delete d.dhcp.pools[form.poolName]; c.dhcp.selectedPool = c.dhcp.pools[0]?.poolName || ""; }, "DHCP pool removed")}>Remove</button>
      </div>
      <ServerTable columns={[{ key: "poolName", label: "Pool Name" }, { key: "defaultGateway", label: "Default Gateway" }, { key: "dnsServer", label: "DNS Server" }, { key: "startIp", label: "Start IP Address" }, { key: "subnetMask", label: "Subnet Mask" }, { key: "maxUsers", label: "Max User", width: "72px" }]} rows={cfg.pools || []} onSelect={(i) => setForm({ ...cfg.pools[i] })} />
    </div>
  );
}

function Dhcpv6Config({ cfg, onUpdate }) {
  return (
    <div className="server-section">
      <h3>DHCPv6</h3>
      <ServiceSwitch value={cfg.service} onChange={(v) => onUpdate((d, c) => { c.dhcpv6.service = v; d.services.dhcpv6 = v; }, `DHCPv6 service ${v ? "enabled" : "disabled"}`)} />
      <div className="server-actions">
        <button type="button" onClick={() => { const poolName = window.prompt("DHCPv6 pool name", "IPv6Pool"); if (!poolName) return; onUpdate((d, c) => { c.dhcpv6.pools.push({ poolName, dnsServer: "", domainName: "" }); }, "DHCPv6 pool created"); }}>Create Pool</button>
        <button type="button" onClick={() => onUpdate((d, c) => { c.dhcpv6.pools.pop(); }, "DHCPv6 pool removed")}>Remove Pool</button>
      </div>
      <h4>IPv6 Address Prefix</h4>
      <ServerTable columns={[{ key: "prefix", label: "Prefix" }, { key: "length", label: "Prefix Length" }, { key: "valid", label: "Valid Lifetime" }, { key: "preferred", label: "Preferred Lifetime" }]} rows={cfg.prefixes || []} />
      <h4>IPv6 Prefix-Delegation</h4>
      <ServerTable columns={[{ key: "prefix", label: "Prefix" }, { key: "duid", label: "DUID" }, { key: "pool", label: "Local Pool" }, { key: "valid", label: "Valid Lifetime" }]} rows={cfg.delegations || []} />
      <h4>IPv6 Local Pool</h4>
      <ServerTable columns={[{ key: "poolName", label: "Pool Name" }, { key: "prefix", label: "Prefix" }, { key: "length", label: "Prefix Length" }]} rows={cfg.localPools || []} />
    </div>
  );
}

function TftpConfig({ cfg, onUpdate }) {
  const [selected, setSelected] = useState(null);
  return (
    <div className="server-section">
      <h3>TFTP</h3>
      <ServiceSwitch value={cfg.service} onChange={(v) => onUpdate((d, c) => { c.tftp.service = v; d.services.tftp = v; }, `TFTP service ${v ? "enabled" : "disabled"}`)} />
      <ServerTable columns={[{ key: "name", label: "File" }]} rows={(cfg.files || []).map((name) => ({ name }))} selectedIndex={selected} onSelect={setSelected} />
      <div className="server-actions">
        <button type="button" onClick={() => { const name = window.prompt("TFTP file name"); if (!name) return; onUpdate((d, c) => { c.tftp.files = [...new Set([...(c.tftp.files || []), name])]; d.files[`flash:${name}`] = d.files[`flash:${name}`] || ""; }, `${name} added`); }}>Add File</button>
        <button type="button" disabled={selected == null} onClick={() => onUpdate((d, c) => { const [name] = c.tftp.files.splice(selected, 1); if (name) delete d.files[`flash:${name}`]; }, "TFTP file removed")}>Remove File</button>
      </div>
    </div>
  );
}

function DnsConfig({ cfg, onUpdate }) {
  const [record, setRecord] = useState({ name: "", type: "A Record", detail: "" });
  const [selected, setSelected] = useState(null);
  return (
    <div className="server-section">
      <h3>DNS</h3>
      <ServiceSwitch label="DNS Service" value={cfg.service} onChange={(v) => onUpdate((d, c) => { c.dns.service = v; d.services.dns = v; }, `DNS service ${v ? "enabled" : "disabled"}`)} />
      <div className="server-form-grid compact">
        <label>Name<input value={record.name} onChange={(e) => setRecord({ ...record, name: e.target.value })} /></label>
        <label>Type<select value={record.type} onChange={(e) => setRecord({ ...record, type: e.target.value })}><option>A Record</option><option>AAAA Record</option><option>CNAME</option><option>MX</option></select></label>
        <label className="span-2">Address<input value={record.detail} onChange={(e) => setRecord({ ...record, detail: e.target.value })} /></label>
      </div>
      <div className="server-actions">
        <button type="button" onClick={() => onUpdate((d, c) => { c.dns.records.push({ ...record, no: c.dns.records.length + 1 }); }, "DNS record added")}>Add</button>
        <button type="button" onClick={() => onUpdate((d, c) => { if (selected != null) c.dns.records[selected] = { ...record, no: selected + 1 }; }, "DNS record saved")}>Save</button>
        <button type="button" onClick={() => onUpdate((d, c) => { if (selected != null) c.dns.records.splice(selected, 1); }, "DNS record removed")}>Remove</button>
      </div>
      <ServerTable columns={[{ key: "no", label: "No.", width: "56px" }, { key: "name", label: "Name" }, { key: "type", label: "Type" }, { key: "detail", label: "Detail" }]} rows={cfg.records || []} selectedIndex={selected} onSelect={(i) => { setSelected(i); setRecord({ ...cfg.records[i] }); }} />
      <button className="server-inline-button" type="button" onClick={() => onUpdate((d, c) => { c.dns.cacheClearedAt = Date.now(); }, "DNS cache cleared")}>DNS Cache</button>
    </div>
  );
}

function SyslogConfig({ cfg, onUpdate, device }) {
  const logs = cfg.logs?.length ? cfg.logs : (device.logging || []);
  return (
    <div className="server-section">
      <h3>Syslog</h3>
      <ServiceSwitch value={cfg.service} onChange={(v) => onUpdate((d, c) => { c.syslog.service = v; d.services.syslog = v; }, `Syslog service ${v ? "enabled" : "disabled"}`)} />
      <ServerTable columns={[{ key: "time", label: "Time" }, { key: "host", label: "HostName" }, { key: "message", label: "Message" }]} rows={logs} empty="No syslog messages" />
      <div className="server-actions"><button type="button" onClick={() => onUpdate((d, c) => { c.syslog.logs = []; d.logging = []; }, "Syslog cleared")}>Clear Log</button></div>
    </div>
  );
}

function AaaConfig({ cfg, onUpdate }) {
  const [client, setClient] = useState({ clientName: "", clientIp: "", serverType: "Radius", key: "" });
  const [user, setUser] = useState({ username: "", password: "" });
  return (
    <div className="server-section">
      <h3>AAA</h3>
      <div className="server-service-row wide">
        <span>Service</span>
        <label><input type="radio" checked={!!cfg.service} onChange={() => onUpdate((d, c) => { c.aaa.service = true; d.services.aaa = true; }, "AAA enabled")} /> On</label>
        <label><input type="radio" checked={!cfg.service} onChange={() => onUpdate((d, c) => { c.aaa.service = false; d.services.aaa = false; }, "AAA disabled")} /> Off</label>
        <label>Radius Port<input value={cfg.radiusPort || "1645"} onChange={(e) => onUpdate((d, c) => { c.aaa.radiusPort = e.target.value; }, "Radius port updated")} /></label>
      </div>
      <h4>Network Configuration</h4>
      <div className="server-form-grid compact">
        <label>Client Name<input value={client.clientName} onChange={(e) => setClient({ ...client, clientName: e.target.value })} /></label>
        <label>Client IP<input value={client.clientIp} onChange={(e) => setClient({ ...client, clientIp: e.target.value })} /></label>
        <label>Secret<input value={client.key} onChange={(e) => setClient({ ...client, key: e.target.value })} /></label>
        <label>ServerType<select value={client.serverType} onChange={(e) => setClient({ ...client, serverType: e.target.value })}><option>Radius</option><option>Tacacs+</option></select></label>
      </div>
      <div className="server-actions"><button type="button" onClick={() => onUpdate((d, c) => { c.aaa.clients.push(client); }, "AAA client added")}>Add</button></div>
      <ServerTable columns={[{ key: "clientName", label: "Client Name" }, { key: "clientIp", label: "Client IP" }, { key: "serverType", label: "Server Type" }, { key: "key", label: "Key" }]} rows={cfg.clients || []} />
      <h4>User Setup</h4>
      <div className="server-form-grid compact">
        <label>Username<input value={user.username} onChange={(e) => setUser({ ...user, username: e.target.value })} /></label>
        <label>Password<input value={user.password} onChange={(e) => setUser({ ...user, password: e.target.value })} /></label>
      </div>
      <div className="server-actions"><button type="button" onClick={() => onUpdate((d, c) => { if (!user.username) return; c.aaa.users.push(user); d.users[user.username] = { secret: user.password }; }, "AAA user added")}>Add</button></div>
      <ServerTable columns={[{ key: "username", label: "Username" }, { key: "password", label: "Password" }]} rows={cfg.users || []} />
    </div>
  );
}

function NtpConfig({ cfg, onUpdate }) {
  return (
    <div className="server-section">
      <h3>NTP</h3>
      <ServiceSwitch value={cfg.service} onChange={(v) => onUpdate((d, c) => { c.ntp.service = v; d.services.ntp = v; }, `NTP service ${v ? "enabled" : "disabled"}`)} />
      <fieldset className="server-fieldset">
        <legend>Authentication</legend>
        <label><input type="radio" checked={!!cfg.auth} onChange={() => onUpdate((d, c) => { c.ntp.auth = true; }, "NTP authentication enabled")} /> Enable</label>
        <label><input type="radio" checked={!cfg.auth} onChange={() => onUpdate((d, c) => { c.ntp.auth = false; }, "NTP authentication disabled")} /> Disable</label>
        <label>Key<input value={cfg.key || ""} onChange={(e) => onUpdate((d, c) => { c.ntp.key = e.target.value; }, "NTP key updated")} /></label>
        <label>Password<input value={cfg.password || ""} onChange={(e) => onUpdate((d, c) => { c.ntp.password = e.target.value; }, "NTP password updated")} /></label>
      </fieldset>
      <div className="server-form-grid compact">
        <label>Date<input type="date" value={cfg.date || ""} onChange={(e) => onUpdate((d, c) => { c.ntp.date = e.target.value; }, "NTP date updated")} /></label>
        <label>Time<input type="time" step="1" value={cfg.time || ""} onChange={(e) => onUpdate((d, c) => { c.ntp.time = e.target.value; }, "NTP time updated")} /></label>
      </div>
    </div>
  );
}

function EmailConfig({ cfg, onUpdate }) {
  const [user, setUser] = useState({ username: "", password: "" });
  return (
    <div className="server-section">
      <h3>EMAIL</h3>
      <div className="server-two-col">
        <ServiceSwitch label="SMTP Service" value={cfg.smtp} onChange={(v) => onUpdate((d, c) => { c.email.smtp = v; d.services.smtp = v; }, `SMTP ${v ? "enabled" : "disabled"}`)} />
        <ServiceSwitch label="POP3 Service" value={cfg.pop3} onChange={(v) => onUpdate((d, c) => { c.email.pop3 = v; d.services.pop3 = v; }, `POP3 ${v ? "enabled" : "disabled"}`)} />
      </div>
      <label className="server-wide-label">Domain Name:<input value={cfg.domain || ""} onChange={(e) => onUpdate((d, c) => { c.email.domain = e.target.value; }, "Email domain set")} /></label>
      <h4>User Setup</h4>
      <div className="server-form-grid compact">
        <label>User<input value={user.username} onChange={(e) => setUser({ ...user, username: e.target.value })} /></label>
        <label>Password<input value={user.password} onChange={(e) => setUser({ ...user, password: e.target.value })} /></label>
      </div>
      <div className="server-actions">
        <button type="button" onClick={() => onUpdate((d, c) => { if (user.username) c.email.users.push(user); }, "Email user added")}>+</button>
        <button type="button" onClick={() => onUpdate((d, c) => { c.email.users.pop(); }, "Email user removed")}>-</button>
        <button type="button" onClick={() => onUpdate((d, c) => { const target = c.email.users.find((u) => u.username === user.username); if (target) target.password = user.password; }, "Email password changed")}>Change Password</button>
      </div>
      <ServerTable columns={[{ key: "username", label: "User" }, { key: "password", label: "Password" }]} rows={cfg.users || []} />
    </div>
  );
}

function FtpConfig({ cfg, onUpdate }) {
  const [user, setUser] = useState({ username: "", password: "", permission: "R" });
  const [selectedFile, setSelectedFile] = useState(null);
  const togglePerm = (letter, checked) => setUser((u) => {
    const next = checked ? [...new Set(`${u.permission}${letter}`.split(""))].join("") : u.permission.replace(letter, "");
    return { ...u, permission: next };
  });
  return (
    <div className="server-section">
      <h3>FTP</h3>
      <ServiceSwitch value={cfg.service} onChange={(v) => onUpdate((d, c) => { c.ftp.service = v; d.services.ftp = v; }, `FTP ${v ? "enabled" : "disabled"}`)} />
      <h4>User Setup</h4>
      <div className="server-form-grid compact">
        <label>Username<input value={user.username} onChange={(e) => setUser({ ...user, username: e.target.value })} /></label>
        <label>Password<input value={user.password} onChange={(e) => setUser({ ...user, password: e.target.value })} /></label>
      </div>
      <div className="server-checkbox-row">
        {["W", "R", "D", "N", "L"].map((p) => <label key={p}><input type="checkbox" checked={user.permission.includes(p)} onChange={(e) => togglePerm(p, e.target.checked)} /> {({ W: "Write", R: "Read", D: "Delete", N: "Rename", L: "List" })[p]}</label>)}
      </div>
      <div className="server-actions"><button type="button" onClick={() => onUpdate((d, c) => { if (user.username) c.ftp.users.push(user); }, "FTP user added")}>Add</button></div>
      <ServerTable columns={[{ key: "username", label: "Username" }, { key: "password", label: "Password" }, { key: "permission", label: "Permission" }]} rows={cfg.users || []} />
      <ServerTable columns={[{ key: "name", label: "File" }]} rows={(cfg.files || []).map((name) => ({ name }))} selectedIndex={selectedFile} onSelect={setSelectedFile} />
      <div className="server-actions"><button type="button" disabled={selectedFile == null} onClick={() => onUpdate((d, c) => { c.ftp.files.splice(selectedFile, 1); }, "FTP file removed")}>Remove</button></div>
    </div>
  );
}

function SimpleRegistryConfig({ title, section, cfg, onUpdate, serviceName }) {
  return (
    <div className="server-section">
      <h3>{title}</h3>
      {section === "iot" && <p className="server-note">This service runs on top of the HTTP or HTTPS service.</p>}
      <ServiceSwitch value={cfg.service} onChange={(v) => onUpdate((d, c) => { c[section].service = v; d.services[serviceName] = v; }, `${title} ${v ? "enabled" : "disabled"}`)} />
      <ServerTable columns={[{ key: "name", label: "Name" }, { key: "status", label: "Status" }]} rows={cfg.registrations || []} />
      <ServerTable columns={[{ key: "id", label: "Device" }, { key: "status", label: "Status" }]} rows={cfg.devices || []} />
      <div className="server-actions"><button type="button" onClick={() => onUpdate((d, c) => { c[section].registrations = []; c[section].devices = []; }, `${title} entries deleted`)}>Delete</button></div>
    </div>
  );
}

function VmConfig({ cfg, onUpdate }) {
  return (
    <div className="server-section">
      <h3>VM Management</h3>
      <ServiceSwitch value={cfg.service} onChange={(v) => onUpdate((d, c) => { c.vm.service = v; d.services.vm = v; }, `VM Management ${v ? "enabled" : "disabled"}`)} />
      <ServerTable columns={[{ key: "vm", label: "VM" }, { key: "status", label: "Status" }]} rows={cfg.vms || []} />
    </div>
  );
}

function RadiusEapConfig({ cfg, onUpdate }) {
  return (
    <div className="server-section">
      <h3>EAP Configuration</h3>
      <label className="server-check"><input type="checkbox" checked={!!cfg.allowEapMd5} onChange={(e) => onUpdate((d, c) => { c.radiusEap.allowEapMd5 = e.target.checked; d.services.radius = e.target.checked; }, `EAP-MD5 ${e.target.checked ? "allowed" : "disabled"}`)} /> Allow EAP-MD5</label>
    </div>
  );
}

function PrpConfig({ cfg, onUpdate }) {
  return (
    <div className="server-section">
      <h3>PRP Configuration</h3>
      <label className="server-check"><input type="checkbox" checked={!!cfg.enabled} onChange={(e) => onUpdate((d, c) => { c.prp.enabled = e.target.checked; d.services.prp = e.target.checked; }, `PRP ${e.target.checked ? "enabled" : "disabled"}`)} /> Enable PRP</label>
    </div>
  );
}

function AppsSidebar({ device, activeAppKey, onOpenApp, onClose }) {
  const meta = DeviceCatalog.find(c => c.platform === device.platform && c.kind === device.kind) || DeviceCatalog.find(c => c.kind === device.kind) || DeviceCatalog[0];

  return (
    <aside className="apps-sidebar" aria-label={`${device.hostname} apps`}>
      <div className="apps-head">
        <div className="apps-device-mark" style={{ color: meta.color }}>
          {React.createElement(Glyph[device.kind] || Glyph.pc, { size: 24 })}
        </div>
        <div className="apps-title">
          <span>{device.hostname}</span>
          <small>Apps</small>
        </div>
        <button className="apps-close" type="button" onClick={onClose} title="Close apps">×</button>
      </div>

      <div className="apps-library" aria-label="App library">
        {ENDPOINT_DESKTOP_APPS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`apps-card ${activeAppKey === item.key ? "active" : ""}`}
            onClick={() => onOpenApp(item.key)}
            title={item.label}
          >
            <AppLibraryIcon kind={item.key} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

function EndpointAppWorkspace({
  tab, app, device, devices, links, onClose, onUpdateDevice, onApplyCommand, onPing,
  scrollState, onScrollStateChange, historyState, onHistoryChange, ghostSuggestions,
}) {
  const isCliApp = app.action === "console";
  return (
    <div className="endpoint-app-page">
      <div className="endpoint-app-head">
        <AppLibraryIcon kind={app.key} />
        <div className="endpoint-app-title">
          <span>{device.hostname} - {app.label}</span>
          <small>{app.kind}</small>
        </div>
        <button type="button" className="endpoint-app-close" onClick={onClose} title="Close app">×</button>
      </div>
      {isCliApp ? (
        <div className="endpoint-cli-panel">
          <CLI
            device={device}
            devices={devices}
            links={links}
            onApply={onApplyCommand}
            onPing={onPing}
            pendingCmd={null}
            active={true}
            scrollState={scrollState}
            onScrollStateChange={onScrollStateChange}
            historyState={historyState}
            onHistoryChange={onHistoryChange}
            ghostSuggestions={ghostSuggestions}
          />
        </div>
      ) : (
        <EndpointAppBody tab={tab} app={app} device={device} onUpdateDevice={onUpdateDevice} />
      )}
    </div>
  );
}

function EndpointAppBody({ app, device, onUpdateDevice }) {
  if (app.key === "ip" || app.key === "wireless") {
    return <EndpointIpApp app={app} device={device} preferWireless={app.key === "wireless"} onUpdateDevice={onUpdateDevice} />;
  }
  if (app.key === "editor") {
    return <EndpointTextEditorApp device={device} onUpdateDevice={onUpdateDevice} />;
  }
  if (app.key === "browser") {
    return <EndpointBrowserApp app={app} device={device} onUpdateDevice={onUpdateDevice} />;
  }
  if (app.key === "email") {
    return <EndpointEmailApp app={app} device={device} onUpdateDevice={onUpdateDevice} />;
  }
  return <EndpointUtilityApp app={app} device={device} onUpdateDevice={onUpdateDevice} />;
}

function appSettings(device, key) {
  return device.appSettings?.[key] || {};
}

function setAppSetting(key, field, value) {
  return (device) => {
    device.appSettings = device.appSettings || {};
    device.appSettings[key] = { ...(device.appSettings[key] || {}), [field]: value };
  };
}

function EndpointIpApp({ app, device, preferWireless, onUpdateDevice }) {
  const ifaceNames = Object.keys(device.interfaces || {});
  const preferred = preferWireless && device.interfaces?.wlan0 ? "wlan0" : (device.interfaces?.eth0 ? "eth0" : ifaceNames[0]);
  const [ifaceNameValue, setIfaceNameValue] = useState(preferred);
  useEffect(() => {
    if (!device.interfaces?.[ifaceNameValue]) setIfaceNameValue(preferred);
  }, [device.id, preferred, ifaceNameValue]);
  const ifc = device.interfaces?.[ifaceNameValue] || {};
  const updateIface = (field, value) => onUpdateDevice((d) => {
    d.interfaces[ifaceNameValue] = { ...(d.interfaces[ifaceNameValue] || {}), [field]: value || null };
  }, `${ifaceName(ifaceNameValue)} ${field} updated`);
  const setDhcp = (enabled) => onUpdateDevice((d) => {
    d.interfaces[ifaceNameValue] = { ...(d.interfaces[ifaceNameValue] || {}), dhcp: enabled };
  }, `${ifaceName(ifaceNameValue)} DHCP ${enabled ? "enabled" : "disabled"}`);
  return (
    <div className="endpoint-app-body">
      <div className="endpoint-form-panel wide">
        <div className="endpoint-panel-title">{app.label}</div>
        <div className="endpoint-form-grid">
          <label>Interface
            <select value={ifaceNameValue || ""} onChange={(e) => setIfaceNameValue(e.target.value)}>
              {ifaceNames.map((name) => <option key={name} value={name}>{ifaceName(name)}</option>)}
            </select>
          </label>
          <label>Assignment
            <select value={ifc.dhcp ? "dhcp" : "static"} onChange={(e) => setDhcp(e.target.value === "dhcp")}>
              <option value="static">Static</option>
              <option value="dhcp">DHCP</option>
            </select>
          </label>
          <label>IPv4 Address<input value={ifc.ip || ""} onChange={(e) => updateIface("ip", e.target.value)} placeholder="192.168.1.10" /></label>
          <label>Subnet Mask<input value={ifc.mask || ""} onChange={(e) => updateIface("mask", e.target.value)} placeholder="255.255.255.0" /></label>
          <label>Default Gateway<input value={ifc.gw || ""} onChange={(e) => updateIface("gw", e.target.value)} placeholder="192.168.1.1" /></label>
          <label>DNS Server<input value={ifc.dns || ""} onChange={(e) => updateIface("dns", e.target.value)} placeholder="8.8.8.8" /></label>
          {preferWireless && <label>SSID<input value={ifc.ssid || ""} onChange={(e) => updateIface("ssid", e.target.value)} placeholder="OpenPT-WLAN" /></label>}
          {preferWireless && <label>Authentication<input value={ifc.auth || ""} onChange={(e) => updateIface("auth", e.target.value)} placeholder="WPA2-PSK" /></label>}
        </div>
      </div>
      <EndpointInterfaceSummary device={device} />
    </div>
  );
}

function EndpointInterfaceSummary({ device }) {
  const rows = Object.entries(device.interfaces || {}).map(([name, ifc]) => ({
    name,
    ip: ifc.ip || "unassigned",
    mask: ifc.mask || "unassigned",
    gw: ifc.gw || "unassigned",
    mac: ifc.mac || "unknown",
    state: ifc.admUp === false ? "admin down" : (ifc.up ? "up" : "down"),
  }));
  return (
    <div className="endpoint-table-panel">
      <div className="endpoint-panel-title">Interfaces</div>
      <div className="endpoint-table">
        <div className="endpoint-table-head"><span>Interface</span><span>Address</span><span>Gateway</span><span>State</span></div>
        {rows.map((row) => (
          <div key={row.name} className="endpoint-table-row">
            <span title={row.name}>{ifaceName(row.name)}</span>
            <span title={`${row.ip} / ${row.mask}`}>{row.ip}</span>
            <span title={row.gw}>{row.gw}</span>
            <span className={row.state === "up" ? "up" : ""}>{row.state}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EndpointTextEditorApp({ device, onUpdateDevice }) {
  const files = device.files || {};
  const name = appSettings(device, "editor").file || "desktop:notes.txt";
  const content = files[name] || "";
  const saveName = (value) => onUpdateDevice((d) => {
    const prev = d.appSettings?.editor?.file || "desktop:notes.txt";
    d.appSettings = d.appSettings || {};
    d.appSettings.editor = { ...(d.appSettings.editor || {}), file: value };
    d.files = d.files || {};
    if (!d.files[value]) d.files[value] = d.files[prev] || "";
  }, "Text Editor file selected");
  return (
    <div className="endpoint-app-body single">
      <div className="endpoint-form-panel fill">
        <div className="endpoint-panel-title">Text Editor</div>
        <label className="endpoint-wide-label">File<input value={name} onChange={(e) => saveName(e.target.value || "desktop:notes.txt")} /></label>
        <textarea
          className="endpoint-textarea"
          value={content}
          onChange={(e) => onUpdateDevice((d) => {
            d.files = d.files || {};
            d.files[name] = e.target.value;
          }, "Text Editor saved")}
        />
      </div>
    </div>
  );
}

function EndpointBrowserApp({ app, device, onUpdateDevice }) {
  const settings = appSettings(device, app.key);
  const url = settings.url || "http://192.168.20.20";
  return (
    <div className="endpoint-app-body single">
      <div className="endpoint-browser-panel">
        <div className="endpoint-browser-bar">
          <input value={url} onChange={(e) => onUpdateDevice(setAppSetting(app.key, "url", e.target.value), "Web Browser URL updated")} />
          <button type="button" onClick={() => onUpdateDevice(setAppSetting(app.key, "lastLoaded", url), "Web Browser loaded")}>Go</button>
        </div>
        <div className="endpoint-browser-page">
          <div className="endpoint-browser-url">{settings.lastLoaded || url}</div>
          <h3>OpenPT Browser</h3>
          <p>HTTP requests from {device.hostname} use this target address in simulations and notes.</p>
        </div>
      </div>
    </div>
  );
}

function EndpointEmailApp({ app, device, onUpdateDevice }) {
  const settings = appSettings(device, app.key);
  const set = (field, value) => onUpdateDevice(setAppSetting(app.key, field, value), "Email updated");
  return (
    <div className="endpoint-app-body">
      <div className="endpoint-form-panel">
        <div className="endpoint-panel-title">Account</div>
        <div className="endpoint-form-grid">
          <label>Email Address<input value={settings.address || ""} onChange={(e) => set("address", e.target.value)} placeholder={`${device.hostname.toLowerCase()}@openpt.local`} /></label>
          <label>Incoming Server<input value={settings.pop3 || ""} onChange={(e) => set("pop3", e.target.value)} placeholder="192.168.20.20" /></label>
          <label>Outgoing Server<input value={settings.smtp || ""} onChange={(e) => set("smtp", e.target.value)} placeholder="192.168.20.20" /></label>
          <label>Password<input value={settings.password || ""} onChange={(e) => set("password", e.target.value)} placeholder="password" /></label>
        </div>
      </div>
      <div className="endpoint-form-panel">
        <div className="endpoint-panel-title">Compose</div>
        <div className="endpoint-form-grid">
          <label>To<input value={settings.to || ""} onChange={(e) => set("to", e.target.value)} /></label>
          <label>Subject<input value={settings.subject || ""} onChange={(e) => set("subject", e.target.value)} /></label>
        </div>
        <textarea className="endpoint-textarea compact" value={settings.body || ""} onChange={(e) => set("body", e.target.value)} />
      </div>
    </div>
  );
}

function EndpointUtilityApp({ app, device, onUpdateDevice }) {
  const settings = appSettings(device, app.key);
  const spec = endpointUtilitySpec(app.key);
  const set = (field, value) => onUpdateDevice(setAppSetting(app.key, field, value), `${app.label} updated`);
  return (
    <div className="endpoint-app-body">
      <div className="endpoint-form-panel">
        <div className="endpoint-panel-title">{app.label}</div>
        <div className="endpoint-form-grid">
          {spec.fields.map((field) => (
            <label key={field.key} className={field.type === "toggle" ? "endpoint-toggle-label" : ""}>
              {field.type === "toggle" ? (
                <><input type="checkbox" checked={!!settings[field.key]} onChange={(e) => set(field.key, e.target.checked)} /> {field.label}</>
              ) : field.type === "select" ? (
                <>{field.label}<select value={settings[field.key] || field.default || ""} onChange={(e) => set(field.key, e.target.value)}>{field.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}</select></>
              ) : (
                <>{field.label}<input value={settings[field.key] || ""} onChange={(e) => set(field.key, e.target.value)} placeholder={field.placeholder || ""} /></>
              )}
            </label>
          ))}
        </div>
      </div>
      <div className="endpoint-status-panel">
        <AppLibraryIcon kind={app.key} />
        <div>
          <div className="endpoint-status-title">{spec.statusTitle}</div>
          <p>{spec.statusText}</p>
        </div>
      </div>
    </div>
  );
}

function endpointUtilitySpec(key) {
  const specs = {
    dialup: { statusTitle: "Dial-up profile", statusText: "Stores modem dial details for lab workflows.", fields: [
      { key: "number", label: "Dial Number", placeholder: "555-0100" },
      { key: "username", label: "Username" },
      { key: "password", label: "Password" },
      { key: "enabled", label: "Connect automatically", type: "toggle" },
    ] },
    vpn: { statusTitle: "VPN profile", statusText: "Tracks tunnel parameters for remote access scenarios.", fields: [
      { key: "server", label: "Server IP", placeholder: "203.0.113.10" },
      { key: "group", label: "Group Name" },
      { key: "username", label: "Username" },
      { key: "connected", label: "Connected", type: "toggle" },
    ] },
    traffic: { statusTitle: "Traffic generator", statusText: "Use these values as the source profile for simulated traffic.", fields: [
      { key: "destination", label: "Destination", placeholder: "192.168.20.20" },
      { key: "protocol", label: "Protocol", type: "select", options: ["ICMP", "TCP", "UDP", "HTTP"], default: "ICMP" },
      { key: "count", label: "Count", placeholder: "5" },
      { key: "running", label: "Running", type: "toggle" },
    ] },
    mib: { statusTitle: "SNMP query", statusText: "Stores SNMP browser query settings.", fields: [
      { key: "agent", label: "Agent IP", placeholder: "192.168.1.1" },
      { key: "community", label: "Community", placeholder: "public" },
      { key: "oid", label: "OID", placeholder: "1.3.6.1.2.1.1.1.0" },
    ] },
    communicator: { statusTitle: "IP communicator", statusText: "Tracks softphone registration details.", fields: [
      { key: "extension", label: "Extension", placeholder: "1001" },
      { key: "server", label: "Call Server", placeholder: "192.168.20.20" },
      { key: "registered", label: "Registered", type: "toggle" },
    ] },
    pppoe: { statusTitle: "PPPoE session", statusText: "Stores broadband dialer credentials.", fields: [
      { key: "service", label: "Service Name" },
      { key: "username", label: "Username" },
      { key: "password", label: "Password" },
      { key: "connected", label: "Connected", type: "toggle" },
    ] },
    firewall: { statusTitle: "IPv4 firewall", statusText: "Endpoint firewall rules for IPv4 lab scenarios.", fields: [
      { key: "enabled", label: "Firewall enabled", type: "toggle" },
      { key: "defaultAction", label: "Default Action", type: "select", options: ["Allow", "Deny"], default: "Allow" },
      { key: "rule", label: "Rule", placeholder: "deny tcp any any eq 80" },
    ] },
    ipv6firewall: { statusTitle: "IPv6 firewall", statusText: "Endpoint firewall rules for IPv6 lab scenarios.", fields: [
      { key: "enabled", label: "Firewall enabled", type: "toggle" },
      { key: "defaultAction", label: "Default Action", type: "select", options: ["Allow", "Deny"], default: "Allow" },
      { key: "rule", label: "Rule", placeholder: "deny tcp any any eq 443" },
    ] },
    netflow: { statusTitle: "NetFlow collector", statusText: "Stores collector listener details.", fields: [
      { key: "collector", label: "Collector IP", placeholder: "192.168.20.20" },
      { key: "port", label: "UDP Port", placeholder: "2055" },
      { key: "listening", label: "Listening", type: "toggle" },
    ] },
    iox: { statusTitle: "IoX workspace", statusText: "Tracks IoX project metadata for exercises.", fields: [
      { key: "project", label: "Project Name" },
      { key: "runtime", label: "Runtime", type: "select", options: ["Python", "Node.js", "Container"], default: "Python" },
      { key: "deployed", label: "Deployed", type: "toggle" },
    ] },
    tftp: { statusTitle: "TFTP service", statusText: "Stores file sharing settings for endpoint labs.", fields: [
      { key: "root", label: "Root Folder", placeholder: "desktop:/tftp" },
      { key: "file", label: "File Name", placeholder: "config.txt" },
      { key: "enabled", label: "Service enabled", type: "toggle" },
    ] },
    bluetooth: { statusTitle: "Bluetooth", statusText: "Stores local pairing state for wireless scenarios.", fields: [
      { key: "enabled", label: "Bluetooth enabled", type: "toggle" },
      { key: "device", label: "Paired Device" },
      { key: "discoverable", label: "Discoverable", type: "toggle" },
    ] },
    iotmon: { statusTitle: "IoT monitor", statusText: "Tracks endpoint IoT monitoring settings.", fields: [
      { key: "server", label: "Registration Server", placeholder: "192.168.20.20" },
      { key: "zone", label: "Zone", placeholder: "Lab" },
      { key: "monitoring", label: "Monitoring", type: "toggle" },
    ] },
    iotide: { statusTitle: "IoT IDE", statusText: "Stores the active IoT script profile.", fields: [
      { key: "project", label: "Project Name" },
      { key: "language", label: "Language", type: "select", options: ["JavaScript", "Python", "Blockly"], default: "JavaScript" },
      { key: "deployed", label: "Deployed", type: "toggle" },
    ] },
  };
  return specs[key] || { statusTitle: "Application settings", statusText: "Stores local application state for this endpoint.", fields: [
    { key: "enabled", label: "Enabled", type: "toggle" },
    { key: "server", label: "Server", placeholder: "192.168.20.20" },
    { key: "notes", label: "Notes" },
  ] };
}

function ServerDesktopPanel() {
  return (
    <div className="server-desktop-panel" aria-label="Server Desktop tools">
      <div className="server-desktop-list" role="table" aria-label="Server desktop applications">
        <div className="server-desktop-list-head" role="row">
          <span>Name</span>
          <span>Kind</span>
        </div>
        {SERVER_DESKTOP_APPS.map((app) => (
          <div key={app.key} className="server-desktop-row" role="row" aria-disabled="true" title={`${app.label} (not implemented yet)`}>
            <span className="server-desktop-name" role="cell">
              <AppLibraryIcon kind={app.key} className="server-desktop-icon" />
              <span>{app.label}</span>
            </span>
            <span className="server-desktop-kind" role="cell">{app.kind}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AppLibraryIcon({ kind, className = "app-library-icon" }) {
  const iconKind = {
    cmd: "terminal",
    ssh: "terminal-lock",
    browser: "globe",
    mib: "globe",
    dialup: "modem",
    vpn: "shield-lock",
    firewall: "shield",
    ipv6firewall: "shield",
    accounting: "list",
    traffic: "send",
    email: "mail",
    communicator: "headset",
    pppoe: "modem",
    editor: "edit",
    netflow: "chart",
    iox: "cube",
    tftp: "folder-network",
    bluetooth: "bluetooth",
    iotmon: "cloud-device",
    iotide: "cloud-device",
  }[kind] || kind;
  return (
    <span className={`${className} ${kind}`} aria-hidden="true">
      <svg viewBox="0 0 32 32" focusable="false">
        {iconKind === "ip" && (
          <>
            <rect x="5" y="7" width="22" height="18" rx="3" />
            <path d="M9 12h6M9 17h14M9 21h10" />
            <path d="M21 11l3 3-3 3" />
          </>
        )}
        {iconKind === "terminal" && (
          <>
            <rect x="5" y="7" width="22" height="18" rx="3" />
            <path d="M10 13l4 3-4 3M16 20h6" />
          </>
        )}
        {iconKind === "terminal-lock" && (
          <>
            <rect x="5" y="7" width="22" height="18" rx="3" />
            <path d="M9 13l4 3-4 3M15 20h4" />
            <rect x="21" y="17" width="6" height="6" rx="1.2" />
            <path d="M22.5 17v-2a1.5 1.5 0 013 0v2" />
          </>
        )}
        {iconKind === "globe" && (
          <>
            <circle cx="16" cy="16" r="10" />
            <path d="M6 16h20M16 6c3 3 4.5 6.3 4.5 10S19 23 16 26M16 6c-3 3-4.5 6.3-4.5 10S13 23 16 26" />
          </>
        )}
        {iconKind === "wireless" && (
          <>
            <path d="M7 13a13 13 0 0118 0M11 17a7 7 0 0110 0M15 21a1.5 1.5 0 012 0" />
            <path d="M16 22v4" />
          </>
        )}
        {iconKind === "shield-lock" && (
          <>
            <path d="M16 4l10 4v7c0 6-4.2 10-10 13C10.2 25 6 21 6 15V8l10-4z" />
            <rect x="12" y="15" width="8" height="7" rx="1.5" />
            <path d="M13.5 15v-2a2.5 2.5 0 015 0v2" />
          </>
        )}
        {iconKind === "shield" && (
          <>
            <path d="M16 4l10 4v7c0 6-4.2 10-10 13C10.2 25 6 21 6 15V8l10-4z" />
            <path d="M11 16h10M16 10v12" />
          </>
        )}
        {iconKind === "list" && (
          <>
            <rect x="6" y="6" width="20" height="20" rx="3" />
            <path d="M11 12h10M11 17h10M11 22h7" />
            <path d="M8.5 12h.1M8.5 17h.1M8.5 22h.1" />
          </>
        )}
        {iconKind === "send" && (
          <>
            <path d="M5 16l21-9-6 19-4-8-8-2z" />
            <path d="M16 18l5-6" />
          </>
        )}
        {iconKind === "mail" && (
          <>
            <rect x="5" y="9" width="22" height="15" rx="3" />
            <path d="M7 12l9 7 9-7" />
          </>
        )}
        {iconKind === "headset" && (
          <>
            <path d="M8 17v-2a8 8 0 0116 0v2" />
            <rect x="5" y="16" width="5" height="7" rx="2" />
            <rect x="22" y="16" width="5" height="7" rx="2" />
            <path d="M22 24c-1.5 2-3.8 3-7 3" />
          </>
        )}
        {iconKind === "modem" && (
          <>
            <rect x="5" y="12" width="22" height="11" rx="3" />
            <path d="M10 17h.1M14 17h.1M18 17h.1M22 17h.1M12 12l-2-5M20 12l2-5" />
          </>
        )}
        {iconKind === "edit" && (
          <>
            <path d="M8 6h13l3 3v17H8z" />
            <path d="M20 6v5h5M11 21l2.5-.5L23 11a2 2 0 00-3-3l-9.5 9.5L10 20z" />
          </>
        )}
        {iconKind === "chart" && (
          <>
            <rect x="5" y="5" width="22" height="22" rx="3" />
            <path d="M10 22v-5M16 22V11M22 22v-8" />
          </>
        )}
        {iconKind === "cube" && (
          <>
            <path d="M16 4l10 6v12l-10 6-10-6V10l10-6z" />
            <path d="M6 10l10 6 10-6M16 16v12" />
          </>
        )}
        {iconKind === "cloud-device" && (
          <>
            <path d="M10 21H8a5 5 0 01.8-9.9A7 7 0 0122 12a4.5 4.5 0 01.5 9H20" />
            <rect x="12" y="17" width="8" height="10" rx="2" />
            <path d="M15 24h2" />
          </>
        )}
        {iconKind === "folder-network" && (
          <>
            <path d="M5 10h8l2 3h12v12H5z" />
            <path d="M9 21h14M16 17v8M11 25h10" />
          </>
        )}
        {iconKind === "bluetooth" && (
          <>
            <path d="M14 5l7 6-7 6V5zM14 17l7 6-7 6V17z" />
            <path d="M8 10l13 13M8 22l13-12" />
          </>
        )}
      </svg>
    </span>
  );
}

function ContextMenu({ x, y, device, onClose, onAction }) {
  const ref = useRef(null);
  useEffect(() => {
    const onDocDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDocDown); document.removeEventListener("keydown", onKey); };
  }, []);
  if (!device) return null;
  const m = DeviceCatalog.find(c => c.platform === device.platform && c.kind === device.kind) || DeviceCatalog.find(c => c.platform === device.platform) || DeviceCatalog.find(c => c.kind === device.kind) || DeviceCatalog[0];
  // clamp to viewport
  const vw = window.innerWidth, vh = window.innerHeight;
  const W = 240, H = 320;
  const px = Math.min(x, vw - W - 8);
  const py = Math.min(y, vh - H - 8);
  const showDeviceCommands = device.kind !== "pc";
  const showApps = isEndpointAppsDevice(device);
  return (
    <div className="ctxmenu" ref={ref} style={{ left: px, top: py }}>
      <div className="ctxmenu-head">
        <div style={{ color: m.color, display: "inline-flex" }}>
          {React.createElement(Glyph[device.kind] || Glyph.router, { size: 22 })}
        </div>
        <div>
          <div className="name">{device.hostname}</div>
          <div style={{ fontSize: 10.5, color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>{m.label}</div>
        </div>
        <div className="meta">{device.powered ? "ON" : "OFF"}</div>
      </div>
      {device.kind === "server" && (
        <div className="ctxmenu-item" onClick={() => onAction("server-module")}>
          <span className="icn">{Icon.settings()}</span>
          <span>Open Server Module</span>
        </div>
      )}
      {showApps && (
        <div className="ctxmenu-item" onClick={() => onAction("apps")}>
          <span className="icn">{Icon.files()}</span>
          <span>Open Apps</span>
        </div>
      )}
      <div className="ctxmenu-item" onClick={() => onAction("console")}>
        <span className="icn">{Icon.terminal()}</span>
        <span>Open Console</span>
        <span className="kbd">⏎</span>
      </div>
      <div className="ctxmenu-item" onClick={() => onAction("ping")}>
        <span className="icn">{Icon.packet()}</span>
        <span>Send ping…</span>
      </div>
      {showDeviceCommands && (
        <>
          <div className="ctxmenu-sep"/>
          <div className="ctxmenu-item" onClick={() => onAction("show-int")}>
            <span className="icn">⌘</span>
            <span>Show interfaces</span>
          </div>
          {OPT_Engine.isRouterLike?.(device) && (
            <div className="ctxmenu-item" onClick={() => onAction("show-route")}>
              <span className="icn">⌘</span>
              <span>Show routing table</span>
            </div>
          )}
          {OPT_Engine.isSwitchLike?.(device) && (
            <div className="ctxmenu-item" onClick={() => onAction("show-vlan")}>
              <span className="icn">⌘</span>
              <span>Show VLANs</span>
            </div>
          )}
          {OPT_Engine.isSwitchLike?.(device) && (
            <div className="ctxmenu-item" onClick={() => onAction("show-mac")}>
              <span className="icn">⌘</span>
              <span>Show MAC address table</span>
            </div>
          )}
          <div className="ctxmenu-item" onClick={() => onAction("show-run")}>
            <span className="icn">⌘</span>
            <span>Show running-config</span>
          </div>
        </>
      )}
      <div className="ctxmenu-sep"/>
      <div className="ctxmenu-item" onClick={() => onAction("power")}>
        <span className="icn">{Icon.power()}</span>
        <span>{device.powered ? "Power off" : "Power on"}</span>
      </div>
      <div className="ctxmenu-item" onClick={() => onAction("restart")}>
        <span className="icn">{Icon.reset()}</span>
        <span>Restart device</span>
      </div>
      <div className="ctxmenu-sep"/>
      <div className="ctxmenu-item" onClick={() => onAction("duplicate")}>
        <span className="icn">⌥</span>
        <span>Duplicate</span>
      </div>
      <div className="ctxmenu-item danger" onClick={() => onAction("delete")}>
        <span className="icn">{Icon.trash()}</span>
        <span>Delete device</span>
        <span className="kbd">Del</span>
      </div>
    </div>
  );
}

function LinkContextMenu({ x, y, link, devices, onClose, onDelete }) {
  const ref = useRef(null);
  useEffect(() => {
    const onDocDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDocDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDocDown); document.removeEventListener("keydown", onKey); };
  }, []);
  if (!link) return null;
  const vw = window.innerWidth, vh = window.innerHeight;
  const W = 240, H = 140;
  const px = Math.min(x, vw - W - 8);
  const py = Math.min(y, vh - H - 8);
  const a = devices[link.a];
  const b = devices[link.b];
  return (
    <div className="ctxmenu" ref={ref} style={{ left: px, top: py }}>
      <div className="ctxmenu-head">
        <div>
          <div className="name">Cable</div>
          <div style={{ fontSize: 10.5, color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>
            {a?.hostname || "A"} {ifaceName(link.ai)} ↔ {b?.hostname || "B"} {ifaceName(link.bi)}
          </div>
        </div>
        <div className="meta">{link.type || "auto"}</div>
      </div>
      <div className="ctxmenu-item danger" onClick={onDelete}>
        <span className="icn">{Icon.trash()}</span>
        <span>Delete cable</span>
        <span className="kbd">Del</span>
      </div>
    </div>
  );
}

function Events({ events }) {
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight; }, [events.length]);
  return (
    <div className="events" ref={ref}>
      {events.length === 0 && <div style={{ padding: 24, color: "var(--fg-3)", textAlign: "center" }}>No events yet. Run a ping or change a device to populate.</div>}
      {events.map((e, i) => (
        <div key={i} className="event">
          <span className="t">{e.t}</span>
          <span className={`s ${e.s}`}>{e.src}</span>
          <span className="m">{e.m}</span>
        </div>
      ))}
    </div>
  );
}

const PacketTracerReverseReport = React.memo(function PacketTracerReverseReport({ activity }) {
  const [reportTab, setReportTab] = useState("assessment");
  const report = activity?.reverseReport || activity?.diagnostics || {};
  const assessmentSections = packetTracerAssessmentSections(activity);
  const assessmentCount = (assessmentSections.assessmentItems?.length || 0) + (assessmentSections.connectivityTests?.length || 0);
  const signatures = report.signatures || [];
  const strings = (report.interestingStrings && report.interestingStrings.length ? report.interestingStrings : report.strings || []).slice(0, 28);
  const entropyRows = (report.entropyByWindow || []).slice(0, 8);
  const download = () => downloadJSON(activity, `${(activity.title || activity.sourceName || "packet-tracer").replace(/[^\w.-]+/g, "-")}-reverse-report.json`);
  const downloadRaw = async () => {
    const record = await PacketTracerImporter?.getRawPacketTracerFile?.(activity.rawFile?.sha256 || activity.sourceSha256);
    if (!record?.bytes) return;
    const blob = new Blob([record.bytes], { type: record.type || "application/octet-stream" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = record.name || activity.sourceName || "packet-tracer-file.pka";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className="events pt-check-window">
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "var(--fg-0)", fontSize: 13, fontWeight: 600 }}>{activity.title || activity.sourceName || "Packet Tracer file"}</div>
          <div style={{ color: "var(--fg-2)", fontFamily: "var(--font-mono)", fontSize: 11, marginTop: 3 }}>
            {activity.unsupported ? "Reverse-engineering report" : "Extractor profile matched"} · {activity.sourceSize || report.size || 0} bytes
          </div>
        </div>
        {activity.rawFile?.storage?.stored && (
          <button className="hud-btn" style={{ width: "auto", padding: "0 10px", fontSize: 11 }} onClick={downloadRaw}>PKA</button>
        )}
        <button className="hud-btn" style={{ width: "auto", padding: "0 10px", fontSize: 11 }} onClick={download}>JSON</button>
      </div>

      <div className="pt-check-tabs" role="tablist" aria-label="Packet Tracer check results">
        {[
          ["overview", "Overall Feedback", null],
          ["assessment", "Assessment Items", null],
          ["connectivity", "Connectivity Tests", null],
          ["raw", "Raw Evidence", null],
        ].map(([key, label, badge]) => (
          <button
            key={key}
            className={`pt-check-tab ${reportTab === key ? "active" : ""}`}
            role="tab"
            aria-selected={reportTab === key}
            onClick={() => setReportTab(key)}
          >
            {label}{badge != null ? ` ${badge}` : ""}
          </button>
        ))}
      </div>

      {reportTab === "overview" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", gap: "6px 12px", fontSize: 11.5, marginBottom: 14 }}>
            <div style={{ color: "var(--fg-3)" }}>SHA-256</div>
            <code style={{ color: "var(--fg-1)", overflowWrap: "anywhere" }}>{activity.sourceSha256 || report.sha256 || "unavailable"}</code>
            <div style={{ color: "var(--fg-3)" }}>Header</div>
            <code style={{ color: "var(--fg-1)" }}>{activity.sourceHeadHex || report.headHex || "n/a"}</code>
            <div style={{ color: "var(--fg-3)" }}>Tail</div>
            <code style={{ color: "var(--fg-1)" }}>{report.tailHex || "n/a"}</code>
            <div style={{ color: "var(--fg-3)" }}>Entropy</div>
            <span style={{ color: "var(--fg-1)" }}>{report.entropy != null ? `${report.entropy} bits/byte` : "n/a"}</span>
            <div style={{ color: "var(--fg-3)" }}>Raw PKA</div>
            <span style={{ color: activity.rawFile?.storage?.stored ? "var(--ok)" : "var(--warn)" }}>
              {activity.rawFile?.storage?.stored ? `preserved in ${activity.rawFile.storage.backend}` : `not preserved${activity.rawFile?.storage?.reason ? `: ${activity.rawFile.storage.reason}` : ""}`}
            </span>
            <div style={{ color: "var(--fg-3)" }}>Semantic coverage</div>
            <span style={{ color: activity.unsupported ? "var(--warn)" : "var(--fg-1)" }}>
              {activity.featureCoverage?.semanticExtraction || (activity.unsupported ? "not-decoded" : "profile-derived")}
            </span>
            <div style={{ color: "var(--fg-3)" }}>Assessment</div>
            <span style={{ color: assessmentCount ? "var(--fg-1)" : "var(--fg-3)" }}>
              {assessmentCount ? `${assessmentCount} items · ${assessmentSections.connectivityTests.length} connectivity` : "none found"}
            </span>
            {report.decoder && (
              <>
                <div style={{ color: "var(--fg-3)" }}>Decoder</div>
                <span style={{ color: report.decoder.status === "decoded" ? "var(--ok)" : "var(--warn)", overflowWrap: "anywhere" }}>
                  {report.decoder.status || "unknown"}
                  {report.decoder.profile ? ` · ${report.decoder.profile}` : report.decoder.attemptedProfile ? ` · ${report.decoder.attemptedProfile}` : ""}
                  {report.decoder.error ? ` · ${report.decoder.error}` : ""}
                </span>
              </>
            )}
            {activity.progress?.score && (
              <>
                <div style={{ color: "var(--fg-3)" }}>Progress</div>
                <span style={{ color: "var(--ok)" }}>{activity.progress.score} · {activity.progress.itemCount}</span>
              </>
            )}
          </div>

          {activity.unsupported && (
            <div style={{ color: "var(--warn)", marginBottom: 14, fontSize: 12 }}>
              No full extractor profile is packaged for this hash yet. The original file is preserved raw when browser storage is available, and unsupported Packet Tracer-only features are tracked below.
            </div>
          )}

          {assessmentCount > 0 && assessmentSections.connectivityTests.length === 0 && (
            <div style={{ color: "var(--warn)", marginBottom: 14, fontSize: 12 }}>
              Assessment data was decoded, but no connectivity tests matched the classifier. Check the assessment roots below to extend the import mapping for this PKA.
            </div>
          )}

          {assessmentSections.roots?.length > 0 && (
            <>
              <div style={{ color: "var(--fg-2)", fontWeight: 600, margin: "10px 0 6px" }}>Assessment Roots</div>
              {assessmentSections.roots.map((root, i) => (
                <div key={`${root.name}-${i}`} className="event" style={{ gridTemplateColumns: "1fr 70px" }}>
                  <span className="m">{root.name}</span>
                  <span className="t">{root.count}</span>
                </div>
              ))}
            </>
          )}

          {activity.featureCoverage?.preservedButUnsupported?.length > 0 && (
            <>
              <div style={{ color: "var(--fg-2)", fontWeight: 600, margin: "10px 0 6px" }}>Preserved But Not Decoded</div>
              {activity.featureCoverage.preservedButUnsupported.map((item, i) => (
                <div key={i} className="event" style={{ gridTemplateColumns: "130px 1fr" }}>
                  <span className="s warn">raw payload</span>
                  <span className="m">{item}</span>
                </div>
              ))}
            </>
          )}
        </>
      )}

      {reportTab === "connectivity" && (
        <div>
          <PacketTracerAssessmentRows items={assessmentSections.connectivityTests} empty="No connectivity tests were classified for this PKA." />
        </div>
      )}

      {reportTab === "assessment" && (
        <div>
          <PacketTracerAssessmentRows items={assessmentSections.assessmentItems} empty="No non-connectivity assessment items were found." />
        </div>
      )}

      {reportTab === "raw" && (
        <>
          <div style={{ color: "var(--fg-2)", fontWeight: 600, margin: "10px 0 6px" }}>Embedded Signatures</div>
          <div className="event" style={{ gridTemplateColumns: "130px 90px 1fr" }}>
            <span className="s dim">type</span><span className="s dim">offset</span><span className="m">signature</span>
          </div>
          {signatures.length === 0 ? (
            <div style={{ color: "var(--fg-3)", padding: "6px 0 12px" }}>No PDF, ZIP, RTF, HTML, or image signatures found.</div>
          ) : signatures.slice(0, 40).map((s, i) => (
            <div key={i} className="event" style={{ gridTemplateColumns: "130px 90px 1fr" }}>
              <span className="s ok">{s.label}</span>
              <span className="t">0x{s.offset.toString(16)}</span>
              <span className="m"><code>{s.hex}</code></span>
            </div>
          ))}

          <div style={{ color: "var(--fg-2)", fontWeight: 600, margin: "12px 0 6px" }}>Entropy Windows</div>
          {entropyRows.map((row, i) => (
            <div key={i} className="event" style={{ gridTemplateColumns: "90px 90px 1fr" }}>
              <span className="t">0x{row.offset.toString(16)}</span>
              <span className="s dim">{row.length}b</span>
              <span className="m">{row.entropy} bits/byte</span>
            </div>
          ))}

          <div style={{ color: "var(--fg-2)", fontWeight: 600, margin: "12px 0 6px" }}>String Sample</div>
          {strings.length === 0 ? (
            <div style={{ color: "var(--fg-3)", padding: "6px 0" }}>No printable strings found.</div>
          ) : strings.map((s, i) => (
            <div key={i} className="event" style={{ gridTemplateColumns: "90px 58px 1fr" }}>
              <span className="t">0x{s.offset.toString(16)}</span>
              <span className="s dim">{s.length}</span>
              <span className="m"><code>{s.text}</code></span>
            </div>
          ))}
        </>
      )}
    </div>
  );
});

function sanitizeActivityHtml(html) {
  const source = String(html || "");
  if (!source.trim()) return "";
  try {
    const doc = new DOMParser().parseFromString(source, "text/html");
    doc.querySelectorAll("script,style,link,meta,iframe,object,embed").forEach((node) => node.remove());
    doc.body.querySelectorAll("*").forEach((node) => {
      Array.from(node.attributes).forEach((attr) => {
        const name = attr.name.toLowerCase();
        const value = String(attr.value || "");
        if (
          name.startsWith("on") ||
          name === "style" ||
          name === "bgcolor" ||
          name === "background" ||
          name === "color" ||
          name === "text" ||
          ((name === "href" || name === "src") && /^\s*javascript:/i.test(value))
        ) {
          node.removeAttribute(attr.name);
        }
      });
    });
    return doc.body.innerHTML;
  } catch (error) {
    return "";
  }
}

function progressDisplay(progress) {
  if (!progress) return { primary: "—", secondary: "" };
  if (typeof progress.percent === "number" && Number.isFinite(progress.percent)) {
    return { primary: `${progress.percent}%`, secondary: progress.score || progress.itemCount || "" };
  }
  if (progress.score) return { primary: progress.score, secondary: progress.itemCount || "" };
  if (progress.itemCount) return { primary: progress.itemCount, secondary: "items" };
  return { primary: "—", secondary: "" };
}

function normalizeRubricPattern(pattern, assessmentItems) {
  if (Array.isArray(pattern)) return pattern;
  if (pattern && typeof pattern === "object") {
    return Object.entries(pattern).map(([name, value]) => ({
      name,
      children: rubricFromValue(value),
    }));
  }
  // Fall back: rebuild a tree from flat assessmentItems by their pathParts/rootName
  if (Array.isArray(assessmentItems) && assessmentItems.length) {
    const root = { children: [] };
    for (const item of assessmentItems) {
      const parts = Array.isArray(item.pathParts) && item.pathParts.length
        ? item.pathParts
        : String(item.path || item.name || "").split(" / ").filter(Boolean);
      let cur = root;
      for (let i = 0; i < parts.length; i++) {
        const isLeaf = i === parts.length - 1;
        let child = cur.children.find((c) => c.name === parts[i]);
        if (!child) {
          child = { name: parts[i], children: [] };
          cur.children.push(child);
        }
        if (isLeaf) {
          child.points = item.points;
          child.checkType = item.checkType;
          child.id = item.id;
        }
        cur = child;
      }
    }
    return root.children;
  }
  return [];
}

function rubricFromValue(value) {
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === "string" ? { name: v } : v));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).map(([k, v]) => ({ name: k, children: rubricFromValue(v) }));
  }
  return [];
}

function RubricNode({ node, depth }) {
  const [open, setOpen] = useState(depth < 2);
  const children = node?.children || [];
  const hasChildren = children.length > 0;
  const points = node?.points;
  const label = node?.name || node?.id || "Item";
  return (
    <div className="pt-sb-rub-node" style={{ paddingLeft: depth * 12 }}>
      <div className="pt-sb-rub-row" onClick={() => hasChildren && setOpen(!open)}>
        <span className="pt-sb-rub-toggle">
          {hasChildren ? (open ? "▾" : "▸") : "·"}
        </span>
        <span className="pt-sb-rub-label" title={label}>{label}</span>
        {node?.checkType && (
          <span className="pt-sb-rub-type">{node.checkType}</span>
        )}
        {points != null && points !== "" && (
          <span className="pt-sb-rub-points">{points} pts</span>
        )}
      </div>
      {hasChildren && open && (
        <div className="pt-sb-rub-children">
          {children.map((child, i) => (
            <RubricNode key={`${child?.id || child?.name || i}-${i}`} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function PacketTracerSidebar({ activity, onClose, onReportError }) {
  const [topTab, setTopTab] = useState("instructions");
  useEffect(() => {
    setTopTab("instructions");
  }, [activity?.title]);
  if (!activity) return null;

  const progress = activity.progress || null;
  const { primary, secondary } = progressDisplay(progress);
  const sections = packetTracerAssessmentSections(activity);
  const connectivityItems = sections.connectivityTests || [];
  const assessmentOnly = sections.assessmentItems || [];
  const allAssessmentItems = [...assessmentOnly, ...connectivityItems];
  const components = progress?.components || [];
  const title = activity.title || activity.sourceName || "Packet Tracer Activity";
  const isPerfect = typeof progress?.percent === "number" && progress.percent >= 100;
  const hasImportIssue = activity.unsupported || activity.reverseReport?.decoder?.error || activity.diagnostics?.decoder?.error;
  const hints = activity.hints || [];

  return (
    <div className="pt-sidebar">
      <div className="pt-sb-head">
        <div className="pt-sb-title" title={title}>{title}</div>
        <div className="pt-sb-head-right">
          {hints.length > 0 && (
            <button className={`pt-sb-help ${topTab === "hints" ? "active" : ""}`} onClick={() => setTopTab(topTab === "hints" ? "instructions" : "hints")} title="Show lab hints">?</button>
          )}
          {hasImportIssue && onReportError && (
            <button className="tb-btn" style={{ padding: "3px 7px", fontSize: 11 }} onClick={onReportError}>Report Error</button>
          )}
          <div className={`pt-sb-score ${isPerfect ? "ok" : ""}`} title="Progress">
            <span className="pt-sb-score-primary">{primary}</span>
            {secondary && <span className="pt-sb-score-secondary">{secondary}</span>}
          </div>
          {onClose && (
            <button className="pt-sb-close" onClick={onClose} title="Hide sidebar">×</button>
          )}
        </div>
      </div>

      <div className="side-tabs pt-sb-tabs">
        {[
          ["instructions", "Instructions"],
          ["assessment", `Assessment Items${allAssessmentItems.length ? ` (${allAssessmentItems.length})` : ""}`],
          ["progress", "Progress"],
        ].map(([k, lbl]) => (
          <div
            key={k}
            className={`side-tab ${topTab === k ? "active" : ""}`}
            onClick={() => setTopTab(k)}
          >{lbl}</div>
        ))}
      </div>

      {topTab === "hints" && (
        <div className="pt-sb-body">
          <div className="pt-sb-hints">
            {hints.map((hint, index) => (
              <div key={index} className="pt-sb-hint">
                <span>{index + 1}</span>
                <p>{hint}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {topTab === "instructions" && (
        <div className="pt-sb-body">
          <div className="pt-sb-instructions">
            {activity.instructionsHtml
              ? <div className="pt-sb-html" dangerouslySetInnerHTML={{ __html: sanitizeActivityHtml(activity.instructionsHtml) }} />
              : activity.instructionsText
                ? <pre className="pt-sb-text">{activity.instructionsText}</pre>
                : <div className="pt-sb-empty">No instructions were embedded in this activity.</div>}
          </div>
        </div>
      )}

      {topTab === "assessment" && (
        <div className="pt-sb-body">
          <div className="pt-sb-section">
            {assessmentOnly.length > 0 && (
              <PacketTracerAssessmentRows items={assessmentOnly} empty="No assessment items extracted." />
            )}
            {assessmentOnly.length === 0 && connectivityItems.length === 0 && (
              <div className="pt-sb-empty">No assessment items extracted.</div>
            )}
            {connectivityItems.length > 0 && (
              <>
                <div className="pt-sb-h">Connectivity Tests</div>
                <PacketTracerAssessmentRows items={connectivityItems} empty="No connectivity tests in this activity." />
              </>
            )}
          </div>
        </div>
      )}

      {topTab === "progress" && (
        <div className="pt-sb-body">
          <div className="pt-sb-section">
            <div className="pt-sb-summary">
              <div className="pt-sb-summary-row"><span className="k">Score</span><span className="v">{progress?.score || "—"}</span></div>
              <div className="pt-sb-summary-row"><span className="k">Items</span><span className="v">{progress?.itemCount || `${allAssessmentItems.length}`}</span></div>
              {typeof progress?.percent === "number" && (
                <div className="pt-sb-summary-row"><span className="k">Percent</span><span className="v">{progress.percent}%</span></div>
              )}
            </div>
            {components.length > 0 ? (
              <>
                <div className="pt-sb-h">Components</div>
                <div className="pt-sb-comp-table">
                  <div className="pt-sb-comp-row head">
                    <span>Component</span><span>Items</span><span>Score</span>
                  </div>
                  {components.map((c, i) => (
                    <div key={i} className="pt-sb-comp-row">
                      <span title={c.name}>{c.name || "—"}</span>
                      <span>{c.items || "—"}</span>
                      <span>{c.score || "—"}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : sections.roots?.length > 0 ? (
              <>
                <div className="pt-sb-h">Sections</div>
                <div className="pt-sb-comp-table">
                  <div className="pt-sb-comp-row head"><span>Section</span><span>Items</span><span/></div>
                  {sections.roots.map((r, i) => (
                    <div key={i} className="pt-sb-comp-row">
                      <span title={r.name}>{r.name}</span>
                      <span>{r.count}</span>
                      <span/>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="pt-sb-empty">No component breakdown available.</div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

function PacketLog({ events }) {
  return (
    <div className="events">
      {events.length === 0 && <div style={{ padding: 24, color: "var(--fg-3)", textAlign: "center" }}>No packets traced yet. Use the play button or run <code style={{ color: "var(--accent)" }}>ping</code> from a host CLI.</div>}
      {events.map((e, i) => (
        <div key={i} className="event">
          <span className="t">{e.t}</span>
          <span className={`s ${e.s}`}>icmp</span>
          <span className="m">{e.m}</span>
        </div>
      ))}
    </div>
  );
}

function ImportReportBanner({ activity, onReport, onClose }) {
  const decoderError = activity?.reverseReport?.decoder?.error || activity?.diagnostics?.decoder?.error;
  return (
    <div className="import-report-banner">
      <div>
        <strong>{activity?.sourceName || "Packet Tracer import"}</strong>
        <span>{decoderError || "This Packet Tracer file could not be fully decoded."}</span>
      </div>
      <button className="tb-btn primary" onClick={onReport}>Report Error</button>
      <button className="icon-btn" onClick={onClose}>×</button>
    </div>
  );
}

function FilesPanel({ devices, links }) {
  const fmt = JSON.stringify({ devices: Object.fromEntries(Object.entries(devices).map(([k, d]) => [k, { kind: d.kind, hostname: d.hostname }])), links: links.length }, null, 2);
  return (
    <div style={{ padding: "0 4px", fontFamily: "var(--font-mono)", fontSize: 11.5, color: "var(--fg-1)", overflow: "auto" }}>
      <div className="side-head"><span>Workspace</span></div>
      {["📁 labs", "  ↳ two-router-vlan.opt ●", "  ↳ stp-loop.opt", "  ↳ ospf-area0.opt", "📁 snippets", "  ↳ baseline-router.cfg", "  ↳ vlan-trunk.cfg", "📁 captures", "  ↳ (empty)"].map((l, i) => (
        <div key={i} style={{ padding: "3px 12px", color: l.includes("●") ? "var(--accent)" : "var(--fg-1)" }}>{l}</div>
      ))}
    </div>
  );
}

function LabsPanel({ onLoadStarter }) {
  return (
    <div style={{ padding: "0 8px", overflow: "auto" }}>
      <div className="side-head"><span>CCNA Labs</span></div>
      {[
        { title: "Two-router VLAN routing", desc: "Configure inter-VLAN routing across two routers connected by a serial link.", active: true },
        { title: "Static routing basics", desc: "Three routers, build static routes to reach loopbacks.", active: false },
        { title: "Spanning-tree loop", desc: "Diagnose a STP convergence issue between two switches.", active: false },
        ...OPENPT_PRACTICE_LABS.map((lab) => ({ title: lab.title, desc: lab.desc, active: false })),
      ].map((l, i) => (
        <div key={i}
             onClick={() => l.active && onLoadStarter()}
             style={{
               padding: "10px 10px",
               borderRadius: 7,
               margin: "4px 0",
               background: l.active ? "var(--accent-soft)" : "transparent",
               border: `1px solid ${l.active ? "var(--accent-dim)" : "transparent"}`,
               cursor: "default",
             }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500, color: l.active ? "var(--accent)" : "var(--fg-1)" }}>
            <span>{l.active ? "●" : "○"}</span><span>{l.title}</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 3, lineHeight: 1.45 }}>{l.desc}</div>
        </div>
      ))}
    </div>
  );
}

function AnalysisPanel({ devices, links, events }) {
  const issues = [];
  // simple checks
  for (const d of Object.values(devices)) {
    if (OPT_Engine.isHostLike?.(d)) {
      const hostIface = d.interfaces.eth0 ? "eth0" : (d.interfaces.en0 ? "en0" : Object.keys(d.interfaces || {})[0]);
      const e = d.interfaces[hostIface];
      if (!e || !e.ip) issues.push({ s: "err", host: d.hostname, m: `no IP configured on ${hostIface || "host interface"}` });
      else if (!e.gw) issues.push({ s: "warn", host: d.hostname, m: `no default gateway` });
    }
    if (OPT_Engine.isRouterLike?.(d) && !OPT_Engine.isSwitchLike?.(d) && (!d.routes || d.routes.length === 0))
      issues.push({ s: "warn", host: d.hostname, m: `no routing table entries` });
  }
  // check unconnected interfaces with IPs
  return (
    <div style={{ padding: "0 8px", overflow: "auto" }}>
      <div className="side-head"><span>Diagnostics</span></div>
      {issues.length === 0 && (
        <div style={{ padding: 10, color: "var(--ok)", fontSize: 11.5 }}>● All baseline checks passing.</div>
      )}
      {issues.map((i, k) => (
        <div key={k} style={{ display: "flex", gap: 8, padding: "6px 10px", fontSize: 11.5 }}>
          <span style={{ color: i.s === "err" ? "var(--err)" : "var(--warn)" }}>●</span>
          <div>
            <div style={{ color: "var(--fg-0)", fontFamily: "var(--font-mono)", fontSize: 11 }}>{i.host}</div>
            <div style={{ color: "var(--fg-2)" }}>{i.m}</div>
          </div>
        </div>
      ))}
      <div className="side-head" style={{ marginTop: 10 }}><span>Topology stats</span></div>
      <div style={{ padding: "0 10px", fontSize: 11.5, color: "var(--fg-1)", fontFamily: "var(--font-mono)" }}>
        <Stat k="devices"  v={Object.keys(devices).length} />
        <Stat k="links"    v={links.length} />
        <Stat k="subnets"  v={new Set(Object.values(devices).flatMap(d => Object.values(d.interfaces).filter(i => i.ip).map(i => `${networkAddress(i.ip, i.mask)}/${OPT_Engine.maskBits(i.mask)}`))).size} />
        <Stat k="events"   v={events.length} />
      </div>
    </div>
  );
}
function Stat({ k, v }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "2px 0", borderBottom: "1px solid var(--line-soft)" }}>
      <span style={{ color: "var(--fg-3)" }}>{k}</span><span>{v}</span>
    </div>
  );
}

// ── Utilities ───────────────────────────────────────────
function freeIface(d, links, devId, cableType = "auto") {
  for (const n of Object.keys(d.interfaces)) {
    const taken = links.some(l => (l.a === devId && l.ai === n) || (l.b === devId && l.bi === n));
    const fits = OPT_Engine.cableFitsPort?.(d, n, cableType)?.ok ?? true;
    if (!taken && fits) return n;
  }
  return null;
}
function autoLinkType(a, b) {
  if ((a.kind === "router" && b.kind === "router")) return "serial";
  if ((OPT_Engine.isHostLike?.(a) || OPT_Engine.isHostLike?.(b)) && (OPT_Engine.isRouterLike?.(a) || OPT_Engine.isRouterLike?.(b))) return "cross";
  return "copper";
}
function hasLink(devId, iface, links) {
  return links.some(l => (l.a === devId && l.ai === iface) || (l.b === devId && l.bi === iface));
}
function randMac() {
  return "AA:" + Array.from({ length: 5 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0").toUpperCase()).join(":");
}
function parseAclEntry(action, spec, aclType) {
  const words = spec.trim().split(/\s+/);
  const parseHost = (idx) => {
    if (words[idx] === "any") return { value: "any", wildcard: "255.255.255.255", next: idx + 1 };
    if (words[idx] === "host") return { value: words[idx + 1], wildcard: "0.0.0.0", next: idx + 2 };
    return { value: words[idx], wildcard: words[idx + 1] || "0.0.0.0", next: idx + 2 };
  };
  if (aclType === "standard") {
    const src = parseHost(0);
    return { action, spec, src: src.value, srcWildcard: src.wildcard };
  }
  let idx = 0;
  let proto = "ip";
  if (/^(ip|icmp|tcp|udp)$/i.test(words[0])) proto = words[idx++];
  const src = parseHost(idx);
  const dst = parseHost(src.next);
  return { action, spec, proto, src: src.value, srcWildcard: src.wildcard, dst: dst.value, dstWildcard: dst.wildcard };
}
function wildcardToMaskSafe(wildcard) {
  if (!wildcard || !wildcard.includes(".")) return "255.255.255.0";
  return OPT_Engine.wildcardToMask ? OPT_Engine.wildcardToMask(wildcard) : "255.255.255.0";
}
function networkAddress(ip, mask) {
  const ipI = OPT_Engine.ipToInt(ip), m = OPT_Engine.ipToInt(mask);
  const n = ipI & m;
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
}
function ifaceForVia(d, via) {
  // Match next-hop to an iface subnet
  for (const [n, ifc] of Object.entries(d.interfaces)) {
    if (ifc.ip && ifc.mask && OPT_Engine.sameSubnet(ifc.ip, via, ifc.mask)) return n;
  }
  return Object.keys(d.interfaces)[0];
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
