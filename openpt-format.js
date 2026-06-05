// openpt-format.js - pure import/export helpers shared by the app and tests.
(function (global) {
  function cloneJson(value) {
    if (value == null) return value;
    return JSON.parse(JSON.stringify(value));
  }

  function packetTracerFunctionalUp(value) {
    if (value == null || value === "") return true;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    const text = String(value).trim().toLowerCase();
    if (!text) return true;
    if (/^(false|no|0|down|off|broken|failed|failure|non[-\s]?functional|not[-\s]?functional)$/i.test(text)) return false;
    return true;
  }

  function engineOrThrow(engine) {
    const resolved = engine || global.OPT_Engine;
    if (!resolved) throw new Error("OpenPT format helpers require OPT_Engine.");
    return resolved;
  }

  function projectDocFromState({ title, devices, links, uiState, metadata = {} }, engine) {
    const OPT_Engine = engineOrThrow(engine);
    const normalized = OPT_Engine.normalizeTopology(devices || {}, links || []);
    return {
      schemaVersion: 1,
      title: title || "Untitled OpenPT project",
      devices: normalized.devices,
      links: normalized.links,
      uiState: uiState || {},
      metadata: { app: "OpenPT", ...metadata },
    };
  }

  function buildOtpPackage({
    title,
    devices,
    links,
    uiState,
    ptActivity,
    events,
    packets,
    packetEvents,
    cliHistory,
    cloudProjectId,
    cloudVersion,
    exportedAt,
    appVersion,
  }, engine) {
    const OPT_Engine = engineOrThrow(engine);
    const normalized = OPT_Engine.normalizeTopology(devices || {}, links || []);
    const assignment = cloneJson(ptActivity || null);
    const exportTime = exportedAt || new Date().toISOString();
    const project = projectDocFromState({
      title,
      devices: normalized.devices,
      links: normalized.links,
      uiState: { ...(uiState || {}), ptActivity: null },
      metadata: {
        format: "openpt-otp",
        otpVersion: 1,
        exportedAt: exportTime,
      },
    }, OPT_Engine);
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
        version: appVersion || global.OPENPT_VERSION || "test",
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
        packetEvents: cloneJson(packetEvents || []),
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

  function packetTracerEndpointWithDevices(endpoint, deviceMap = {}) {
    const text = String(endpoint || "");
    const names = Object.keys(deviceMap).filter(Boolean).sort((a, b) => b.length - a.length);
    for (const name of names) {
      if (text === name) return { deviceName: name, iface: "" };
      if (text.startsWith(`${name}:`)) return { deviceName: name, iface: text.slice(name.length + 1) };
    }
    return packetTracerEndpoint(endpoint);
  }

  function stableMac(seed) {
    let h = 0;
    for (let i = 0; i < String(seed).length; i++) h = ((h << 5) - h + String(seed).charCodeAt(i)) >>> 0;
    const bytes = [0xaa, (h >>> 24) & 255, (h >>> 16) & 255, (h >>> 8) & 255, h & 255, (h * 31) & 255];
    return bytes.map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(":");
  }

  function packetTracerIfaceSeed(kind, name, deviceName) {
    const isSwitch = kind === "l2switch" || kind === "l3switch" || kind === "wrt";
    const iface = {
      ip: null,
      mask: null,
      gw: null,
      up: true,
      admUp: true,
      mac: stableMac(`${deviceName}:${name}`),
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

  function buildTopologyFromPacketTracer(activity, engine) {
    const OPT_Engine = engineOrThrow(engine);
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
          name: src.name || null,
          rawName: src.rawName || null,
          saveRefId: src.saveRefId || null,
          memAddr: src.memAddr || null,
        },
        packetTracerState: cloneJson(activity?.packetTracerState?.devices?.[src.name] || null),
      });
      dev.model = src.model && !/hidden/i.test(src.model) ? src.model : dev.model;
      devices[dev.id] = dev;
      deviceMap[src.name] = dev.id;
      if (src.rawName) deviceMap[src.rawName] = dev.id;
      if (src.saveRefId) deviceMap[src.saveRefId] = dev.id;
      if (src.memAddr) deviceMap[src.memAddr] = dev.id;
    }

    for (const src of activity?.logicalObjects || []) {
      const dev = OPT_Engine.makeDevice("annotation", src.name || "PT-Object", Number(src.x) || 300, Number(src.y) || 240, {}, {
        powered: false,
        platform: "pt-logical-object",
        model: src.model || src.kind || "Packet Tracer logical object",
        interfaces: {},
        packetTracer: {
          logicalOnly: true,
          model: src.model || null,
          power: src.power || null,
          name: src.name || null,
          rawName: src.rawName || null,
          saveRefId: src.saveRefId || null,
          memAddr: src.memAddr || null,
          kind: src.kind || null,
          customModel: src.customModel || null,
        },
      });
      dev.logicalOnly = true;
      devices[dev.id] = dev;
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
    for (const [srcIndex, src] of (activity?.links || []).entries()) {
      const a = packetTracerEndpointWithDevices(src.from, deviceMap);
      const b = packetTracerEndpointWithDevices(src.to, deviceMap);
      const aId = deviceMap[src.fromRef] || deviceMap[src.fromMemAddr] || deviceMap[a.deviceName];
      const bId = deviceMap[src.toRef] || deviceMap[src.toMemAddr] || deviceMap[b.deviceName];
      if (!aId || !bId || !a.iface || !b.iface) continue;
      ensureIface(aId, a.iface);
      ensureIface(bId, b.iface);
      const packetTracerState = cloneJson(Object.values(activity?.packetTracerState?.links || {}).find((link) => link.sourceIndex === srcIndex) || null);
      const explicitUp = typeof src.up === "boolean" ? src.up : null;
      links.push({
        id: OPT_Engine.uid("l"),
        a: aId,
        ai: a.iface,
        b: bId,
        bi: b.iface,
        type: /serial/i.test(src.type || "") ? "serial" : "copper",
        up: explicitUp ?? packetTracerFunctionalUp(src.functional ?? packetTracerState?.functional),
        packetTracer: {
          type: src.type || null,
          medium: src.medium || null,
          from: src.from || null,
          to: src.to || null,
          fromRef: src.fromRef || null,
          toRef: src.toRef || null,
          fromMemAddr: src.fromMemAddr || null,
          toMemAddr: src.toMemAddr || null,
          fromStatus: src.fromStatus || null,
          toStatus: src.toStatus || null,
          functional: src.functional || null,
          ports: cloneJson(src.ports || []),
        },
        packetTracerState,
      });
    }

    return { devices, links };
  }

  global.OpenPTFormat = {
    projectDocFromState,
    buildOtpPackage,
    projectDocumentFromOtpPackage,
    buildTopologyFromPacketTracer,
    _internals: {
      packetTracerKind,
      packetTracerPlatform,
      packetTracerEndpoint,
      improvePacketTracerImportLayout,
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
