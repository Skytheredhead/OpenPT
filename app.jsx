// app.jsx — OpenPT main application

const { useState, useEffect, useRef, useMemo } = React;
const Palette = window.Palette;
const Topology = window.Topology;
const CLI = window.CLI;
const Inspector = window.Inspector;
const Icon = window.Icon;
const Glyph = window.Glyph;
const DeviceCatalog = window.DeviceCatalog;
const OPT_Engine = window.OPT_Engine;
const useTweaks = window.useTweaks;
const TweaksPanel = window.TweaksPanel;
const TweakSection = window.TweakSection;
const TweakSlider = window.TweakSlider;
const TweakToggle = window.TweakToggle;
const TweakColor = window.TweakColor;
const TweakButton = window.TweakButton;

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

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

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
        return {
          tabs: data.tabs || [{ id: "w-0", name: "lab-01 · two-router-vlan.opt" }],
          activeWid: data.activeWid || "w-0",
          snapshots: data.snapshots || {},
          devices: cur.devices || {},
          links: cur.links || [],
          selectedIds: cur.selectedIds || (cur.selectedId ? [cur.selectedId] : []),
          openConsoles: cur.openConsoles || [],
          activeBottom: cur.activeBottom || "events",
          loaded: true,
        };
      }
    } catch (e) {}
    const s = OPT_Engine.makeStarter();
    return {
      tabs: [{ id: "w-0", name: "lab-01 · two-router-vlan.opt" }],
      activeWid: "w-0",
      snapshots: { "w-0": { devices: s.devices, links: s.links, selectedIds: [], openConsoles: [], activeBottom: "events" } },
      devices: s.devices,
      links: s.links,
      selectedIds: [],
      openConsoles: [],
      activeBottom: "events",
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
  useEffect(() => {
    snapshotsRef.current[activeWid] = { devices, links, selectedIds, openConsoles, activeBottom };
  }, [devices, links, selectedIds, openConsoles, activeBottom, activeWid]);

  // Persist to localStorage (debounced)
  useEffect(() => {
    const handle = setTimeout(() => {
      try {
        // Ensure current snap is up-to-date before saving
        snapshotsRef.current[activeWid] = { devices, links, selectedIds, openConsoles, activeBottom };
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          tabs, activeWid, snapshots: snapshotsRef.current,
        }));
      } catch (e) {}
    }, 250);
    return () => clearTimeout(handle);
  }, [tabs, activeWid, devices, links, selectedIds, openConsoles, activeBottom]);

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
    snapshotsRef.current[activeWid] = { devices, links, selectedIds, openConsoles, activeBottom };
    const snap = snapshotsRef.current[newId];
    setActiveWid(newId);
    setDevices(snap?.devices || {});
    setLinks(snap?.links || []);
    setSelectedIds(snap?.selectedIds || (snap?.selectedId ? [snap.selectedId] : []));
    setOpenConsoles(snap?.openConsoles || []);
    setActiveBottom(snap?.activeBottom || "events");
  };
  const newBlankTab = () => {
    snapshotsRef.current[activeWid] = { devices, links, selectedIds, openConsoles, activeBottom };
    const id = `w-${Date.now()}`;
    setTabs((ts) => [...ts, { id, name: `untitled-${ts.length}.opt` }]);
    setActiveWid(id);
    setDevices({}); setLinks([]); setSelectedId(null); setOpenConsoles([]); setActiveBottom("events");
  };
  const newStarterTab = () => {
    snapshotsRef.current[activeWid] = { devices, links, selectedIds, openConsoles, activeBottom };
    const id = `w-${Date.now()}`;
    const s = OPT_Engine.makeStarter();
    setTabs((ts) => [...ts, { id, name: `lab-${ts.length + 1}.opt` }]);
    setActiveWid(id);
    setDevices(s.devices); setLinks(s.links); setSelectedId(null); setOpenConsoles([]); setActiveBottom("events");
  };
  const closeTab = (id) => {
    setTabs((ts) => {
      const remaining = ts.filter(x => x.id !== id);
      if (!remaining.length) return ts;
      if (activeWid === id) {
        const target = remaining[remaining.length - 1];
        const snap = snapshotsRef.current[target.id];
        delete snapshotsRef.current[id];
        setActiveWid(target.id);
        setDevices(snap?.devices || {});
        setLinks(snap?.links || []);
        setSelectedIds(snap?.selectedIds || (snap?.selectedId ? [snap.selectedId] : []));
        setOpenConsoles(snap?.openConsoles || []);
        setActiveBottom(snap?.activeBottom || "events");
      } else {
        delete snapshotsRef.current[id];
      }
      return remaining;
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
  }, [devices, links, activeWid]);

  // When switching tabs, the snapshot ref needs to reset prev
  useEffect(() => { prevSnap.current = { devices, links }; }, [activeWid]);

  const undo = () => {
    const h = undoRef.current[activeWid];
    if (!h || !h.past.length) return;
    const prev = h.past.pop();
    h.future.push({ devices, links });
    skipNextSnapshot.current = true;
    setDevices(prev.devices);
    setLinks(prev.links);
    log("dim", "system", "undo");
  };
  const redo = () => {
    const h = undoRef.current[activeWid];
    if (!h || !h.future.length) return;
    const next = h.future.pop();
    h.past.push({ devices, links });
    skipNextSnapshot.current = true;
    setDevices(next.devices);
    setLinks(next.links);
    log("dim", "system", "redo");
  };
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
  const [ctx, setCtx] = useState(null);  // { x, y, devId }
  const [pendingCmd, setPendingCmd] = useState(null);  // { devId, cmd, nonce }

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

  const log = (severity, source, message) => {
    setEvents((e) => [
      ...e.slice(-200),
      { t: new Date().toLocaleTimeString("en-GB", { hour12: false }).slice(3), s: severity, src: source, m: message },
    ]);
  };

  useEffect(() => {
    log("ok", "system", "OpenPT initialized · starter scenario loaded (R1, R2, SW1, SW2, PC1-3, SRV1)");
  }, []);

  // ── Device + link operations ─────────────────────────
  const addDevice = (kind, x, y) => {
    const cat = DeviceCatalog.find(c => c.kind === kind);
    const id = OPT_Engine.uid("d");
    // pick a friendly name
    const existing = Object.values(devices).filter(d => d.kind === kind).length + 1;
    const baseName = { router: "R", l2switch: "SW", l3switch: "MLS", pc: "PC", server: "SRV", ap: "AP", cloud: "NET" }[kind] || "DEV";
    const ifaces = {};
    cat.ifaces.forEach((n) => {
      ifaces[n] = { up: false, admUp: false, ip: null, mask: null, mac: randMac(), desc: "" };
      if (kind === "l2switch" || kind === "l3switch") { ifaces[n].vlan = 1; ifaces[n].mode = "access"; }
      if (kind === "pc" || kind === "server") { ifaces[n].up = true; ifaces[n].admUp = true; }
    });
    const d = {
      id, kind, x, y, powered: cat.pwr,
      hostname: `${baseName}${existing}`,
      privileged: false,
      interfaces: ifaces, routes: [], arp: {}, mac: {},
      vlans: (kind === "l2switch" || kind === "l3switch") ? { 1: "default" } : undefined,
    };
    setDevices((m) => ({ ...m, [id]: d }));
    log("ok", "topology", `added ${cat.label} ${d.hostname}`);
    setSelectedId(id);
  };

  const moveDevice = (id, x, y) => {
    setDevices((m) => ({ ...m, [id]: { ...m[id], x, y } }));
  };

  const deleteDevice = (id) => {
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
    setDevices((m) => {
      const d = m[id];
      const powered = !d.powered;
      const ifaces = Object.fromEntries(Object.entries(d.interfaces).map(([k, v]) => [k, { ...v, up: powered ? v.up : false }]));
      log(powered ? "ok" : "warn", d.hostname, powered ? "power on" : "power off");
      return { ...m, [id]: { ...d, powered, interfaces: ifaces } };
    });
  };

  const renameDevice = (id, name) => {
    setDevices((m) => ({ ...m, [id]: { ...m[id], hostname: name || m[id].hostname } }));
  };

  // ── Link creation
  const onLinkRequest = (aId, bId) => {
    const a = devices[aId], b = devices[bId];
    const aFree = freeIface(a, links, aId);
    const bFree = freeIface(b, links, bId);
    if (!aFree || !bFree) {
      log("err", "topology", `no free interface on ${!aFree ? a.hostname : b.hostname}`);
      setToast({ kind: "err", msg: `No free interface on ${!aFree ? a.hostname : b.hostname}` });
      return;
    }
    const type = (forceLinkType && forceLinkType !== "auto") ? forceLinkType : autoLinkType(a, b);
    setForceLinkType(null);
    const link = { id: OPT_Engine.uid("l"), a: aId, ai: aFree, b: bId, bi: bFree, type, up: true };
    setLinks((ls) => [...ls, link]);
    // bring interfaces up
    setDevices((m) => ({
      ...m,
      [aId]: { ...m[aId], interfaces: { ...m[aId].interfaces, [aFree]: { ...m[aId].interfaces[aFree], up: true, admUp: true } } },
      [bId]: { ...m[bId], interfaces: { ...m[bId].interfaces, [bFree]: { ...m[bId].interfaces[bFree], up: true, admUp: true } } },
    }));
    log("ok", "topology", `wired ${a.hostname} ${aFree} ↔ ${b.hostname} ${bFree} (${type})`);
  };

  const onDeleteLink = (id) => {
    const l = links.find(x => x.id === id);
    setLinks((ls) => ls.filter(x => x.id !== id));
    if (l) log("warn", "topology", `removed cable ${devices[l.a]?.hostname} ↔ ${devices[l.b]?.hostname}`);
  };

  // ── Apply CLI configuration command to a specific device
  const onApplyToDevice = (devId, cmd) => {
    if (!devId) return;
    setDevices((m) => {
      const d = { ...m[devId] };
      const ifaces = { ...d.interfaces };
      switch (cmd.kind) {
        case "hostname":
          d.hostname = cmd.value;
          log("ok", d.hostname, `hostname changed`);
          break;
        case "ip-address":
          ifaces[cmd.iface] = { ...ifaces[cmd.iface], ip: cmd.ip, mask: cmd.mask };
          // refresh connected route on routers/L3 switches
          if (d.kind === "router" || d.kind === "l3switch") {
            const net = networkAddress(cmd.ip, cmd.mask);
            const routes = (d.routes || []).filter(r => !(r.iface === cmd.iface && r.type === "C"));
            routes.push({ dst: net, mask: cmd.mask, via: "directly", iface: cmd.iface, type: "C" });
            d.routes = routes;
          }
          log("ok", d.hostname, `${cmd.iface} address ${cmd.ip} ${cmd.mask}`);
          break;
        case "admin":
          ifaces[cmd.iface] = { ...ifaces[cmd.iface], admUp: cmd.up, up: cmd.up && hasLink(devId, cmd.iface, links) };
          log(cmd.up ? "ok" : "warn", d.hostname, `${cmd.iface} ${cmd.up ? "no shutdown" : "shutdown"}`);
          break;
        case "desc":
          ifaces[cmd.iface] = { ...ifaces[cmd.iface], desc: cmd.value };
          break;
        case "swmode":
          ifaces[cmd.iface] = { ...ifaces[cmd.iface], mode: cmd.value };
          log("ok", d.hostname, `${cmd.iface} switchport mode ${cmd.value}`);
          break;
        case "swvlan":
          ifaces[cmd.iface] = { ...ifaces[cmd.iface], vlan: cmd.value };
          log("ok", d.hostname, `${cmd.iface} access vlan ${cmd.value}`);
          break;
        case "vlan-add":
          d.vlans = { ...(d.vlans || {}), [cmd.id]: d.vlans?.[cmd.id] || `VLAN${cmd.id}` };
          log("ok", d.hostname, `vlan ${cmd.id} created`);
          break;
        case "ip-route":
          d.routes = [...(d.routes || []), { dst: cmd.dst, mask: cmd.mask, via: cmd.via, iface: ifaceForVia(d, cmd.via), type: "S" }];
          log("ok", d.hostname, `ip route ${cmd.dst} ${cmd.mask} ${cmd.via}`);
          break;
      }
      d.interfaces = ifaces;
      return { ...m, [devId]: d };
    });
  };
  const onApply = (cmd) => onApplyToDevice(selectedId, cmd);

  // ── Ping & packet animation
  const animatePath = (plan, snapshot, onDone) => {
    if (!plan.hops.length) { onDone?.(); return; }
    setSimRunning(true);
    const pid = OPT_Engine.uid("p");
    const speed = 1 / Math.max(0.25, t.packetSpeed || 1);
    const segMs = 600 * speed;

    // Deduped device waypoint sequence
    const waypoints = [];
    for (const h of plan.hops) {
      const d = snapshot[h.devId];
      if (!d) continue;
      if (waypoints.length === 0 || waypoints[waypoints.length - 1].id !== d.id) waypoints.push(d);
    }
    // For failures, stop forward at the drop device
    let stopIdx = waypoints.length - 1;
    if (!plan.ok) {
      const dropHop = plan.hops.find(h => h.action === "drop") || plan.hops[plan.hops.length - 1];
      const idx = waypoints.findIndex(w => w.id === dropHop?.devId);
      if (idx >= 0) stopIdx = idx;
    }

    const placePacket = (x, y, proto) => {
      setPackets((arr) => {
        const exists = arr.find(p => p.id === pid);
        if (exists) return arr.map(p => p.id === pid ? { ...p, x, y, proto } : p);
        return [...arr, { id: pid, x, y, proto }];
      });
    };

    placePacket(waypoints[0].x, waypoints[0].y, "icmp");
    setActiveHopDeviceId(waypoints[0].id);

    let isReply = false;
    let seq = waypoints.slice(0, stopIdx + 1);
    let i = 0;

    const step = () => {
      if (i >= seq.length - 1) {
        // end of leg
        if (!isReply && plan.ok) {
          // Start reply animation
          isReply = true;
          seq = waypoints.slice().reverse();
          i = 0;
          setTimeout(step, 220 * speed);
          return;
        }
        // All done
        setActiveHopDeviceId(null);
        if (!plan.ok) {
          placePacket(seq[seq.length - 1].x, seq[seq.length - 1].y, "drop");
        }
        setTimeout(() => {
          setPackets((arr) => arr.filter(p => p.id !== pid));
          setSimRunning(false);
          onDone?.();
        }, plan.ok ? 220 : 600);
        return;
      }
      const from = seq[i], to = seq[i + 1];
      const start = performance.now();
      const animate = (now) => {
        const u = Math.min(1, (now - start) / segMs);
        const x = from.x + (to.x - from.x) * u;
        const y = from.y + (to.y - from.y) * u;
        placePacket(x, y, isReply ? "icmp" : "icmp");
        if (u < 1) requestAnimationFrame(animate);
        else {
          setActiveHopDeviceId(to.id);
          i++;
          setTimeout(step, 90 * speed);
        }
      };
      requestAnimationFrame(animate);
    };
    setTimeout(step, 220 * speed);
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

  // ── Packet-mode click handler (HUD)
  useEffect(() => {
    if (!packetMode) return;
    setActiveBottom("events");
  }, [packetMode]);

  const openConsole = (id) => {
    setSelectedId(id);
    setOpenConsoles((cs) => cs.includes(id) ? cs : [...cs, id]);
    setActiveBottom(id);
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
      if (e.key === "Delete" && selectedIds.length) {
        selectedIds.forEach(id => deleteDevice(id));
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [selectedIds, activeWid, devices, links]);

  const selected = selectedId ? devices[selectedId] : null;
  const cnt = {
    routers: Object.values(devices).filter(d => d.kind === "router").length,
    switches: Object.values(devices).filter(d => d.kind === "l2switch" || d.kind === "l3switch").length,
    hosts: Object.values(devices).filter(d => d.kind === "pc" || d.kind === "server").length,
    links: links.length,
  };

  return (
    <div className="app">
      {/* Title bar */}
      <div className="titlebar">
        <div className="tb-logo">
          <div className="glyph"/>
          OpenPT
          <span style={{ color: "var(--fg-3)", fontWeight: 400, fontSize: 11, marginLeft: 6 }}>v0.1</span>
        </div>
        <TitleMenus
          devices={devices}
          selectedId={selectedId}
          links={links}
          tweaks={t}
          setTweak={setTweak}
          onNewBlankTab={newBlankTab}
          onNewStarterTab={newStarterTab}
          onReset={() => {
            const s = OPT_Engine.makeStarter();
            setDevices(s.devices); setLinks(s.links); setSelectedId(null);
            setEvents([]); setPackets([]);
            log("ok", "system", "scenario reset to starter");
          }}
          onClearAll={() => { setDevices({}); setLinks([]); setSelectedId(null); setEvents([]); setPackets([]); log("warn", "system", "topology cleared"); }}
          onDeleteSelected={() => selectedId && deleteDevice(selectedId)}
          onPing={(srcName, dst) => {
            const src = Object.values(devices).find(d => d.hostname === srcName);
            if (src) handlePing(src.id, dst);
          }}
          onLab={(key) => {
            if (key === "starter") {
              const s = OPT_Engine.makeStarter();
              setDevices(s.devices); setLinks(s.links); setSelectedId(null);
              log("ok", "system", "loaded lab: Two-router VLAN routing");
            }
          }}
          onLinkR1G01={() => {
            const r1 = Object.values(devices).find(d => d.hostname === "R1");
            if (!r1) return;
            setDevices((m) => ({ ...m, [r1.id]: { ...m[r1.id], interfaces: { ...m[r1.id].interfaces, "G0/1": { ...m[r1.id].interfaces["G0/1"], admUp: false, up: false } } } }));
            setLinks((ls) => ls.map(l => (l.a === r1.id && l.ai === "G0/1") || (l.b === r1.id && l.bi === "G0/1") ? { ...l, up: false } : l));
            log("warn", "R1", "G0/1 administratively shut down");
          }}
          onEnterLinkMode={(type) => { setLinkMode(true); setForceLinkType(type); }}
        />
        <div className="tb-center">
        </div>
        <div className="tb-actions">
        </div>
      </div>

      {/* Workspace */}
      <div className="workspace">
        {/* Side panel */}
        <div style={{ display: "none" }} />
        {/* (Labs/Diagnostics moved to top menus) */}

        {/* Center */}
        <div className="center-col">
          <div className="tab-bar">
            {tabs.map((tb) => (
              <div
                key={tb.id}
                className={`tab ${activeWid === tb.id ? "active" : ""}`}
                onClick={() => switchTab(tb.id)}
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
            <div className="tab-spacer"/>
            <div className="tab-tools">
              <div className={`tab-tool ${linkMode ? "active" : ""}`} title="Cable mode (L)" onClick={() => setLinkMode(!linkMode)}>{Icon.link()}</div>
              <div className={`tab-tool ${packetMode ? "active" : ""}`} title="Packet mode (P)" onClick={() => setPacketMode(packetMode ? null : { stage: "src" })}>{Icon.packet()}</div>
            </div>
          </div>

          <Topology
            devices={devices}
            links={links}
            selectedIds={selectedIds}
            onSelect={(id, additive) => selectDevice(id, additive)}
            onMoveDevices={(idDeltas) => {
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
            packetMode={packetMode}
            setPacketMode={setPacketMode}
            onLinkRequest={onLinkRequest}
            simRunning={simRunning}
            packets={packets}
            activeHopDeviceId={activeHopDeviceId}
            onOpenConsole={openConsole}
            onContextMenu={(e, d) => setCtx({ x: e.clientX, y: e.clientY, devId: d.id })}
          />

          <div className="bottom-panel">
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
            </div>
            <div style={{ minHeight: 0, overflow: "hidden", position: "relative" }}>
              {openConsoles.map((id) => (
                <div key={id} style={{
                  position: "absolute", inset: 0,
                  display: activeBottom === id ? "block" : "none",
                }}>
                  <CLI
                    device={devices[id]}
                    onApply={(cmd) => onApplyToDevice(id, cmd)}
                    onPing={handlePing}
                    pendingCmd={pendingCmd && pendingCmd.devId === id ? pendingCmd : null}
                    active={activeBottom === id}
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
                <Events events={events} />
              </div>
              <div style={{ position: "absolute", inset: 0, display: activeBottom === "packets" ? "block" : "none" }}>
                <PacketLog events={events.filter(e => e.src === "ping")} />
              </div>
            </div>
          </div>
        </div>

        {/* Inspector removed — info now accessible via right-click → show commands */}
      </div>

      {/* (status bar removed) */}

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
          setDevices((m) => ({ ...m, [r1.id]: { ...m[r1.id], interfaces: { ...m[r1.id].interfaces, "G0/1": { ...m[r1.id].interfaces["G0/1"], admUp: false, up: false } } } }));
          setLinks((ls) => ls.map(l => (l.a === r1.id && l.ai === "G0/1") || (l.b === r1.id && l.bi === "G0/1") ? { ...l, up: false } : l));
          log("warn", "R1", "G0/1 administratively shut down");
        }} />
      </TweaksPanel>

      {ctx && (
        <ContextMenu
          x={ctx.x} y={ctx.y}
          device={devices[ctx.devId]}
          onClose={() => setCtx(null)}
          onAction={(action) => {
            const id = ctx.devId;
            const d = devices[id];
            if (!d) return setCtx(null);
            switch (action) {
              case "console":
                openConsole(id); break;
              case "show-int":
                runConsoleCmd(id, "show ip interface brief"); break;
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
                handlePing(id, prompt("Ping target IP:", "192.168.20.20") || "");
                break;
              case "duplicate": {
                const newD = { ...d, id: OPT_Engine.uid("d"), x: d.x + 60, y: d.y + 40, hostname: d.hostname + "-copy" };
                setDevices((m) => ({ ...m, [newD.id]: newD }));
                log("ok", "topology", `duplicated ${d.hostname}`);
                break;
              }
            }
            setCtx(null);
          }}
        />
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

  const menus = {
    File: [
      { label: "New blank tab", kbd: "⌘N", on: () => { props.onNewBlankTab(); } },
      { label: "New starter scenario tab", on: () => { props.onNewStarterTab(); } },
      { sep: true },
      { sect: "Export" },
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
      { label: "DHCP & default gateway", disabled: true },
      { label: "OSPF single area", disabled: true },
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
              <div className="tb-dropdown" style={{ minWidth: 300 }}>
                <div className="tb-dropdown-section">Drag onto canvas</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, padding: "0 4px 6px" }}>
                  {DeviceCatalog.map((d) => (
                    <div
                      key={d.kind}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "copy";
                        e.dataTransfer.setData("text/x-openpt-device", d.kind);
                        // close menu shortly after drag start so the drop target receives
                        setTimeout(close, 80);
                      }}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "center",
                        gap: 4, padding: "10px 4px 6px",
                        background: "var(--bg-2)", border: "1px solid transparent",
                        borderRadius: 7, cursor: "grab",
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

function computeDiagnostics(devices, links) {
  const items = [];
  for (const d of Object.values(devices)) {
    if (d.kind === "pc" || d.kind === "server") {
      const e = d.interfaces?.eth0;
      if (!e || !e.ip) items.push({ label: `⚠ ${d.hostname}: no IP on eth0`, disabled: true });
      else if (!e.gw) items.push({ label: `⚠ ${d.hostname}: no default gateway`, disabled: true });
    }
    if (d.kind === "router" && (!d.routes || d.routes.length === 0)) {
      items.push({ label: `⚠ ${d.hostname}: routing table empty`, disabled: true });
    }
  }
  if (!items.length) items.push({ label: "✓ All baseline checks passing", disabled: true });
  return items;
}

function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
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
  const out = [`! ${d.hostname} running-config`, `!`, `hostname ${d.hostname}`, `!`];
  for (const [n, ifc] of Object.entries(d.interfaces)) {
    out.push(`interface ${n}`);
    if (ifc.desc) out.push(` description ${ifc.desc}`);
    if (ifc.ip)   out.push(` ip address ${ifc.ip} ${ifc.mask}`);
    if (ifc.mode) out.push(` switchport mode ${ifc.mode}`);
    if (ifc.vlan && ifc.mode === "access") out.push(` switchport access vlan ${ifc.vlan}`);
    out.push(ifc.admUp === false ? " shutdown" : " no shutdown");
    out.push("!");
  }
  for (const r of (d.routes || [])) {
    if (r.type !== "C") out.push(`ip route ${r.dst} ${r.mask} ${r.via}`);
  }
  out.push("!", "end");
  return out.join("\n");
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
  const m = DeviceCatalog.find(c => c.kind === device.kind) || DeviceCatalog[0];
  // clamp to viewport
  const vw = window.innerWidth, vh = window.innerHeight;
  const W = 240, H = 320;
  const px = Math.min(x, vw - W - 8);
  const py = Math.min(y, vh - H - 8);
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
      <div className="ctxmenu-item" onClick={() => onAction("console")}>
        <span className="icn">{Icon.terminal()}</span>
        <span>Open Console</span>
        <span className="kbd">⏎</span>
      </div>
      <div className="ctxmenu-item" onClick={() => onAction("ping")}>
        <span className="icn">{Icon.packet()}</span>
        <span>Send ping…</span>
      </div>
      <div className="ctxmenu-sep"/>
      <div className="ctxmenu-item" onClick={() => onAction("show-int")}>
        <span className="icn">⌘</span>
        <span>Show interfaces</span>
      </div>
      {(device.kind === "router" || device.kind === "l3switch") && (
        <div className="ctxmenu-item" onClick={() => onAction("show-route")}>
          <span className="icn">⌘</span>
          <span>Show routing table</span>
        </div>
      )}
      {(device.kind === "l2switch" || device.kind === "l3switch") && (
        <div className="ctxmenu-item" onClick={() => onAction("show-vlan")}>
          <span className="icn">⌘</span>
          <span>Show VLANs</span>
        </div>
      )}
      {(device.kind === "l2switch" || device.kind === "l3switch") && (
        <div className="ctxmenu-item" onClick={() => onAction("show-mac")}>
          <span className="icn">⌘</span>
          <span>Show MAC address table</span>
        </div>
      )}
      <div className="ctxmenu-item" onClick={() => onAction("show-run")}>
        <span className="icn">⌘</span>
        <span>Show running-config</span>
      </div>
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
        { title: "DHCP & default gateway", desc: "Configure a DHCP pool and observe address assignment.", active: false },
        { title: "OSPF single area", desc: "Bring up area 0 between three routers, watch neighbor adjacencies.", active: false },
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
    if (d.kind === "pc" || d.kind === "server") {
      const e = d.interfaces.eth0;
      if (!e || !e.ip) issues.push({ s: "err", host: d.hostname, m: `no IP configured on eth0` });
      else if (!e.gw) issues.push({ s: "warn", host: d.hostname, m: `no default gateway` });
    }
    if (d.kind === "router" && (!d.routes || d.routes.length === 0))
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
function freeIface(d, links, devId) {
  for (const n of Object.keys(d.interfaces)) {
    const taken = links.some(l => (l.a === devId && l.ai === n) || (l.b === devId && l.bi === n));
    if (!taken) return n;
  }
  return null;
}
function autoLinkType(a, b) {
  if ((a.kind === "router" && b.kind === "router")) return "serial";
  if ((a.kind === "pc" || b.kind === "pc") && (a.kind === "router" || b.kind === "router")) return "cross";
  return "copper";
}
function hasLink(devId, iface, links) {
  return links.some(l => (l.a === devId && l.ai === iface) || (l.b === devId && l.bi === iface));
}
function randMac() {
  return "AA:" + Array.from({ length: 5 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, "0").toUpperCase()).join(":");
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
