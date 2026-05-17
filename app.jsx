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

  return { devices, links };
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
const OPENPT_VERSION = "0.2.3-sync.20260516";
const SYNC_AUTOSAVE_CHANGES = 20;
const SYNC_AUTOSAVE_MS = 60_000;
const SYNC_MIN_SAVE_MS = 10_000;

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

function mergeProjectIntoTabs(tabs, activeWid, project) {
  const title = project?.title || "Synced project";
  return tabs.map((tab) => tab.id === activeWid ? { ...tab, name: `${title}.opt`, cloudProjectId: project?.id || tab.cloudProjectId } : tab);
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
          loaded: true,
        };
      }
    } catch (e) {}
    const s = OPT_Engine.makeStarter();
    return {
      tabs: [{ id: "w-0", name: "lab-01 · two-router-vlan.opt" }],
      activeWid: "w-0",
      snapshots: { "w-0": { devices: s.devices, links: s.links, selectedIds: [], openConsoles: [], activeBottom: "events", ptActivity: null, ptSidebarOpen: false } },
      devices: s.devices,
      links: s.links,
      selectedIds: [],
      openConsoles: [],
      activeBottom: "events",
      ptActivity: null,
      ptSidebarOpen: false,
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
    snapshotsRef.current[activeWid] = { devices, links, selectedIds, openConsoles, activeBottom, ptActivity, ptSidebarOpen };
  }, [devices, links, selectedIds, openConsoles, activeBottom, ptActivity, ptSidebarOpen, activeWid]);

  // Persist to localStorage (debounced)
  useEffect(() => {
    const handle = setTimeout(() => {
      try {
        // Ensure current snap is up-to-date before saving
        snapshotsRef.current[activeWid] = { devices, links, selectedIds, openConsoles, activeBottom, ptActivity, ptSidebarOpen };
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          tabs, activeWid, snapshots: snapshotsRef.current,
        }));
      } catch (e) {}
    }, 250);
    return () => clearTimeout(handle);
  }, [tabs, activeWid, devices, links, selectedIds, openConsoles, activeBottom, ptActivity, ptSidebarOpen]);

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
  };
  const newBlankTab = () => {
    snapshotsRef.current[activeWid] = { devices, links, selectedIds, openConsoles, activeBottom, ptActivity, ptSidebarOpen };
    const id = `w-${Date.now()}`;
    snapshotsRef.current[id] = { devices: {}, links: [], selectedIds: [], openConsoles: [], activeBottom: "events", ptActivity: null, ptSidebarOpen: false };
    setTabs((ts) => [...ts, { id, name: `untitled-${ts.length}.opt` }]);
    setActiveWid(id);
    setDevices({}); setLinks([]); setSelectedId(null); setOpenConsoles([]); setActiveBottom("events"); setPtActivity(null); setPtSidebarOpen(false);
    setCloudProjectId(null); setCloudVersion(0); setCloudBaseDoc(null); setCloudLease(null); setShareToken(null); setShareMode(null); setSyncStatus({ state: cloudUser ? "local" : "local", message: cloudUser ? "Signed in" : "Local only" });
  };
  const newStarterTab = () => {
    snapshotsRef.current[activeWid] = { devices, links, selectedIds, openConsoles, activeBottom, ptActivity, ptSidebarOpen };
    const id = `w-${Date.now()}`;
    const s = OPT_Engine.makeStarter();
    snapshotsRef.current[id] = { devices: s.devices, links: s.links, selectedIds: [], openConsoles: [], activeBottom: "events", ptActivity: null, ptSidebarOpen: false };
    setTabs((ts) => [...ts, { id, name: `lab-${ts.length + 1}.opt` }]);
    setActiveWid(id);
    setDevices(s.devices); setLinks(s.links); setSelectedId(null); setOpenConsoles([]); setActiveBottom("events"); setPtActivity(null); setPtSidebarOpen(false);
    setCloudProjectId(null); setCloudVersion(0); setCloudBaseDoc(null); setCloudLease(null); setShareToken(null); setShareMode(null); setSyncStatus({ state: cloudUser ? "local" : "local", message: cloudUser ? "Signed in" : "Local only" });
  };
  const closeTab = (id) => {
    setTabs((ts) => {
      const remaining = ts.filter(x => x.id !== id);
      if (!remaining.length) return ts;
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
  const [fileDropActive, setFileDropActive] = useState(false);
  const [ctx, setCtx] = useState(null);  // { x, y, devId }
  const [pendingCmd, setPendingCmd] = useState(null);  // { devId, cmd, nonce }
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
  const lastSaveAtRef = useRef(0);
  const saveInFlightRef = useRef(false);

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
    setMeaningfulChanges((n) => n + 1);
    setFirstDirtyAt((t) => t || Date.now());
    if (cloudProjectId || shareToken) setSyncStatus({ state: "dirty", message: "Unsaved changes" });
    return true;
  };

  const currentProjectTitle = (tabs.find((tab) => tab.id === activeWid)?.name || "Untitled OpenPT project").replace(/\.opt$/i, "");
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

  const applyProjectDocument = (document, project = null) => {
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
    if (project) setTabs((ts) => mergeProjectIntoTabs(ts, activeWid, project));
  };

  const refreshProjects = async () => {
    if (!syncClient || !cloudUser) return;
    const data = await syncClient.listProjects();
    setCloudProjects(data.projects || []);
  };

  const saveCloudNow = async () => {
    if (!syncClient || saveInFlightRef.current || meaningfulChanges <= 0) return;
    if (!cloudProjectId || !cloudBaseDoc || !cloudLease) return;
    const now = Date.now();
    if (now - lastSaveAtRef.current < SYNC_MIN_SAVE_MS) return;
    const patches = Sync.buildProjectPatches(cloudBaseDoc, currentProjectDoc);
    const uiStatePatch = Sync.buildUiPatches(cloudBaseDoc, currentProjectDoc);
    if (!patches.length && !uiStatePatch.length) {
      setMeaningfulChanges(0);
      setFirstDirtyAt(null);
      return;
    }
    const batch = {
      baseVersion: cloudVersion,
      leaseId: cloudLease.id,
      patches,
      uiStatePatch,
    };
    saveInFlightRef.current = true;
    setSyncStatus({ state: "saving", message: "Saving..." });
    try {
      const data = shareToken
        ? await syncClient.saveSharePatch(shareToken, batch)
        : await syncClient.savePatch(cloudProjectId, batch);
      lastSaveAtRef.current = Date.now();
      setCloudVersion(data.project.version);
      setCloudBaseDoc(data.document);
      setMeaningfulChanges(0);
      setFirstDirtyAt(null);
      setSyncStatus({ state: "synced", message: `Saved v${data.project.version}` });
      await Sync.saveLocalDocument(`project:${cloudProjectId}`, data.document, { version: data.project.version });
    } catch (err) {
      if (err.status === 409) {
        setConflict(err.data || { error: err.message });
        setSyncStatus({ state: "conflict", message: "Server has a newer version" });
      } else if (err.status === 423) {
        setCloudLease(null);
        setSyncStatus({ state: "readonly", message: err.data?.lease?.clientLabel ? `Editing on ${err.data.lease.clientLabel}` : "Edit lease required" });
      } else if (!navigator.onLine || err.status === 0 || !err.status) {
        await Sync.enqueue({ projectId: cloudProjectId, shareToken, batch });
        setSyncStatus({ state: "offline", message: "Offline changes queued" });
      } else if (err.status === 429) {
        setSyncStatus({ state: "dirty", message: "Waiting for autosave limit" });
        setTimeout(() => saveCloudNow(), SYNC_MIN_SAVE_MS);
      } else {
        setSyncStatus({ state: "err", message: err.message || "Save failed" });
      }
    } finally {
      saveInFlightRef.current = false;
    }
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
          if (row.shareToken) await syncClient.saveSharePatch(row.shareToken, row.batch);
          else await syncClient.savePatch(row.projectId, row.batch);
          await Sync.dequeue(row.id);
        } catch (err) {
          if (err.status === 409) setConflict(err.data || { error: err.message });
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
    try {
      setSyncStatus({ state: "saving", message: "Creating cloud project..." });
      const data = await syncClient.createProject(currentProjectTitle, currentProjectDoc);
      setCloudProjectId(data.project.id);
      setCloudVersion(data.project.version);
      setCloudBaseDoc(data.document);
      lastSaveAtRef.current = Date.now();
      setMeaningfulChanges(0);
      setFirstDirtyAt(null);
      const lease = await syncClient.acquireLease(data.project.id, true);
      setCloudLease(lease.lease);
      setTabs((ts) => mergeProjectIntoTabs(ts, activeWid, data.project));
      setSyncStatus({ state: "synced", message: `Cloud project saved v${data.project.version}` });
      await refreshProjects();
    } catch (err) {
      setSyncStatus({ state: "err", message: err.message || "Could not create project" });
    }
  };

  const openCloudProject = async (projectId) => {
    if (!syncClient) return;
    try {
      const data = await syncClient.loadProject(projectId);
      setCloudProjectId(data.project.id);
      setShareToken(null);
      setShareMode(null);
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
      if (meaningfulChanges > 0) await saveCloudNow();
      const data = await syncClient.shareProject(cloudProjectId, mode);
      const absolute = `${location.origin}${data.share.url}`;
      await navigator.clipboard?.writeText(absolute).catch(() => {});
      setToast({ kind: "ok", msg: `${mode === "edit" ? "Editable" : "Read-only"} link copied` });
    } catch (err) {
      setToast({ kind: "err", msg: err.message || "Could not create share link" });
    }
  };

  const restoreRollback = async (target) => {
    if (!syncClient || !cloudProjectId || shareToken) return;
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
    syncClient.loadShare(token).then((data) => {
      setShareToken(token);
      setShareMode(data.project.mode);
      setCloudProjectId(data.project.id);
      setCloudVersion(data.project.version);
      setCloudBaseDoc(data.document);
      applyProjectDocument(data.document, data.project);
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

  const openImportedTopology = (topology, filename) => {
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
    setToast({ kind: "ok", msg: `Imported ${filename}` });
    log("ok", "import", `loaded ${filename}`);
  };

  const openImportedPacketTracer = (activity, filename) => {
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
      throw new Error("Drop an OpenPT .json/.opt file, or a Packet Tracer .pka/.pkt file for extractor diagnostics.");
    } catch (err) {
      const msg = err?.message || `Could not import ${name}`;
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
    log("ok", "system", "OpenPT initialized · starter scenario loaded (R1, R2, SW1, SW2, PC1-3, SRV1)");
  }, []);

  // ── Device + link operations ─────────────────────────
  const addDevice = (catalogId, x, y) => {
    if (!markProjectChanged("add-device")) return;
    const cat = DeviceCatalog.find(c => c.id === catalogId) || DeviceCatalog.find(c => c.kind === catalogId);
    const kind = cat?.kind || catalogId;
    // pick a friendly name
    const existing = Object.values(devices).filter(d => (cat?.platform ? d.platform === cat.platform : d.kind === kind)).length + 1;
    const baseName = { router: "R", l2switch: "SW", l3switch: "MLS", pc: "PC", laptop: "LAP", server: "SRV", wrt: "WRT", asa: "ASA", printer: "PRN", phone: "IPPHONE", ap: "AP", cloud: "CLOUD", internet: "INET", dslmodem: "DSL", cablemodem: "CABLE" }[kind] || "DEV";
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
  const onLinkRequest = (aId, bId) => {
    if (!markProjectChanged("add-link")) return;
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
    log("ok", "topology", `wired ${a.hostname} ${ifaceName(aFree)} ↔ ${b.hostname} ${ifaceName(bFree)} (${type})`);
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
        case "interface-create":
          if (!ifaces[cmd.iface]) {
            ifaces[cmd.iface] = { ip: null, mask: null, up: true, admUp: true, mac: randMac(), desc: "" };
            if (cmd.iface.toLowerCase().startsWith("vlan")) {
              const id = Number(cmd.iface.replace(/\D/g, ""));
              d.vlans = { ...(d.vlans || {}), [id]: d.vlans?.[id] || `VLAN${id}` };
            }
            log("ok", d.hostname, `interface ${ifaceName(cmd.iface)} created`);
          }
          break;
        case "host-ip":
          ifaces.eth0 = { ...ifaces.eth0, ip: cmd.ip, mask: cmd.mask, gw: cmd.gw, dhcp: false, up: true, admUp: true };
          log("ok", d.hostname, `eth0 address ${cmd.ip} ${cmd.mask} gateway ${cmd.gw}`);
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
    routers: Object.values(devices).filter(d => OPT_Engine.isRouterLike?.(d) && !OPT_Engine.isSwitchLike?.(d)).length,
    switches: Object.values(devices).filter(d => OPT_Engine.isSwitchLike?.(d)).length,
    hosts: Object.values(devices).filter(d => OPT_Engine.isHostLike?.(d)).length,
    links: links.length,
  };

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
        accept=".json,.opt,.pka,.pkt"
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
          onReset={() => {
            if (!markProjectChanged("reset")) return;
            const s = OPT_Engine.makeStarter();
            setDevices(s.devices); setLinks(s.links); setSelectedId(null);
            setEvents([]); setPackets([]); setPtActivity(null);
            log("ok", "system", "scenario reset to starter");
          }}
          onClearAll={() => { if (!markProjectChanged("clear")) return; setDevices({}); setLinks([]); setSelectedId(null); setEvents([]); setPackets([]); setPtActivity(null); log("warn", "system", "topology cleared"); }}
          onDeleteSelected={() => selectedId && deleteDevice(selectedId)}
          onPing={(srcName, dst) => {
            const src = Object.values(devices).find(d => d.hostname === srcName);
            if (src) handlePing(src.id, dst);
          }}
          onLab={(key) => {
            if (key === "starter") {
              if (!markProjectChanged("load-lab")) return;
              const s = OPT_Engine.makeStarter();
              setDevices(s.devices); setLinks(s.links); setSelectedId(null);
              setPtActivity(null);
              log("ok", "system", "loaded lab: Two-router VLAN routing");
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
          <div className={`tb-status-chip ${syncStatus.state}`}>
            <span className="dot"/>
            {syncStatus.message}
          </div>
        </div>
        <div className="tb-actions">
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

      {/* Workspace */}
      <div className="workspace">
        {ptActivity && ptSidebarOpen && (
          <PacketTracerSidebar
            activity={ptActivity}
            onClose={() => setPtSidebarOpen(false)}
          />
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
            packetMode={packetMode}
            setPacketMode={setPacketMode}
            onLinkRequest={onLinkRequest}
            onPacketRequest={(srcId, dstId) => {
              const dst = devices[dstId];
              const target = Object.values(dst?.interfaces || {}).find(i => i.ip)?.ip;
              if (!target) return log("err", "packet", `${dst?.hostname || "destination"} has no IP address`);
              handlePing(srcId, target);
            }}
            simRunning={simRunning}
            packets={packets}
            activeHopDeviceId={activeHopDeviceId}
            viewState={topologyViewState}
            onViewStateChange={setTopologyViewState}
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
                    devices={devices}
                    links={links}
                    onApply={(cmd) => onApplyToDevice(id, cmd)}
                    onPing={handlePing}
                    pendingCmd={pendingCmd && pendingCmd.devId === id ? pendingCmd : null}
                    active={activeBottom === id}
                    scrollState={terminalScrolls[id]}
                    onScrollStateChange={(devId, state) => setTerminalScrolls((m) => ({ ...m, [devId]: state }))}
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

      {fileDropActive && (
        <div className="file-drop-overlay">
          <div className="file-drop-panel">
            <div className="file-drop-title">Drop lab file</div>
            <div className="file-drop-subtitle">OpenPT JSON/OPT and Packet Tracer PKA/PKT files open in a new tab.</div>
          </div>
        </div>
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
          onLogout={async () => {
            await syncClient?.logout().catch(() => {});
            setCloudUser(null);
            setCloudProjects([]);
            setCloudProjectId(null);
            setCloudLease(null);
            setCloudBaseDoc(null);
            setProjectsOpen(false);
            setSyncStatus({ state: "local", message: "Local only" });
          }}
          onRollback={restoreRollback}
          canRollback={!!cloudProjectId && !shareToken}
        />
      )}

      {shareOpen && (
        <ShareDialog
          onClose={() => setShareOpen(false)}
          onShare={createShareLink}
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
            snapshotsRef.current[id] = { devices, links, selectedIds, openConsoles, activeBottom, ptActivity };
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
          if (!markProjectChanged("fault")) return;
          const iface = r1.interfaces["GigabitEthernet0/0/1"] ? "GigabitEthernet0/0/1" : "G0/1";
          setDevices((m) => ({ ...m, [r1.id]: { ...m[r1.id], interfaces: { ...m[r1.id].interfaces, [iface]: { ...m[r1.id].interfaces[iface], admUp: false, up: false } } } }));
          setLinks((ls) => ls.map(l => (l.a === r1.id && l.ai === iface) || (l.b === r1.id && l.bi === iface) ? { ...l, up: false } : l));
          log("warn", "R1", `${ifaceName(iface)} administratively shut down`);
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
                handlePing(id, prompt("Ping target IP:", "192.168.20.20") || "");
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
      { label: "Import Packet Tracer File...", on: () => { props.onImportPacketTracer(); } },
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
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, padding: "0 4px 6px" }}>
                  {DeviceCatalog.map((d) => (
                    <div
                      key={d.id || d.kind}
                      draggable
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
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const data = mode === "login"
        ? await syncClient.login(email, password)
        : await syncClient.register(email, password, { company, startedAt });
      onSignedIn(data.user);
    } catch (err) {
      setError(err.message || "Sign in failed");
    }
  };
  return (
    <ModalShell title="OpenPT account" onClose={onClose}>
      <form className="modal-body" onSubmit={submit}>
        <div className="segmented">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Sign in</button>
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>Create account</button>
        </div>
        <label>Email<input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required /></label>
        <label>Password<input value={password} onChange={(e) => setPassword(e.target.value)} type="password" minLength={8} required /></label>
        <label className="hp-field">Company<input value={company} onChange={(e) => setCompany(e.target.value)} tabIndex="-1" autoComplete="off" /></label>
        {error && <div className="modal-error">{error}</div>}
        <button className="tb-btn primary" type="submit">{mode === "login" ? "Sign in" : "Create account"}</button>
      </form>
    </ModalShell>
  );
}

function ProjectsDialog({ projects, cloudUser, syncStatus, onClose, onOpen, onCreate, onRefresh, onLogout, onRollback, canRollback }) {
  return (
    <ModalShell title="Synced projects" onClose={onClose}>
      <div className="modal-body">
        <div className="account-row">
          <span>{cloudUser?.email}</span>
          <button className="tb-btn" onClick={onLogout}>Logout</button>
        </div>
        <div className="sync-line">{syncStatus.message}</div>
        <div className="modal-actions">
          <button className="tb-btn primary" onClick={onCreate}>Save current project to cloud</button>
          <button className="tb-btn" onClick={onRefresh}>Refresh</button>
        </div>
        <div className="project-list">
          {!projects.length && <div className="empty-row">No synced projects yet.</div>}
          {projects.map((p) => (
            <button key={p.id} className="project-row" onClick={() => onOpen(p.id)}>
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
                <button key={target} className="tb-btn" onClick={() => onRollback(target)}>Rollback {target}</button>
              ))}
            </div>
          </>
        )}
      </div>
    </ModalShell>
  );
}

function ShareDialog({ onClose, onShare }) {
  return (
    <ModalShell title="Share project" onClose={onClose}>
      <div className="modal-body">
        <button className="tb-btn" onClick={() => onShare("read")}>Create read-only link</button>
        <button className="tb-btn primary" onClick={() => onShare("edit")}>Create editable link</button>
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

function computeDiagnostics(devices, links) {
  const items = [];
  for (const d of Object.values(devices)) {
    if (OPT_Engine.isHostLike?.(d)) {
      const e = d.interfaces?.eth0;
      if (!e || !e.ip) items.push({ label: `⚠ ${d.hostname}: no IP on eth0`, disabled: true });
      else if (!e.gw) items.push({ label: `⚠ ${d.hostname}: no default gateway`, disabled: true });
    }
    if (OPT_Engine.isRouterLike?.(d) && !OPT_Engine.isSwitchLike?.(d) && (!d.routes || d.routes.length === 0)) {
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

function packetTracerAssessmentSections(activity) {
  const allItems = activity?.assessmentItems || [];
  if (activity?.assessmentSections) {
    return {
      connectivityTests: activity.assessmentSections.connectivityTests || [],
      assessmentItems: activity.assessmentSections.assessmentItems || [],
      roots: activity.assessmentSections.roots || [],
    };
  }
  const connectivityTests = allItems.filter(packetTracerIsConnectivityAssessment);
  const connectivitySet = new Set(connectivityTests);
  return {
    connectivityTests,
    assessmentItems: allItems.filter((item) => !connectivitySet.has(item)),
    roots: Object.entries(allItems.reduce((acc, item) => {
      const key = item.rootName || "Assessment Items";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})).map(([name, count]) => ({ name, count })),
  };
}

function PacketTracerAssessmentRows({ items, empty }) {
  if (!items?.length) return <div style={{ color: "var(--fg-3)", padding: "8px 0 12px" }}>{empty}</div>;
  return (
    <>
      <div className="event" style={{ gridTemplateColumns: "1fr 120px 70px" }}>
        <span className="s dim">item</span><span className="s dim">check</span><span className="s dim">points</span>
      </div>
      {items.slice(0, 160).map((item, i) => (
        <div key={`${item.path || item.name || "assessment"}-${i}`} className="event" style={{ gridTemplateColumns: "1fr 120px 70px" }}>
          <span className="m" style={{ minWidth: 0 }}>
            <span style={{ color: "var(--fg-1)" }}>{item.path || item.name || "Assessment Item"}</span>
            {(item.components || item.rootName) && (
              <span style={{ display: "block", color: "var(--fg-3)", fontSize: 10.5, marginTop: 2 }}>
                {[item.components, item.rootName].filter(Boolean).join(" · ")}
              </span>
            )}
          </span>
          <span className="s dim" style={{ overflowWrap: "anywhere" }}>{item.checkType || item.rootCheckType || "n/a"}</span>
          <span className="t">{item.points || "0"}</span>
        </div>
      ))}
      {items.length > 160 && <div style={{ color: "var(--fg-3)", padding: "8px 0" }}>Showing first 160 of {items.length} items.</div>}
    </>
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

const PacketTracerReverseReport = React.memo(function PacketTracerReverseReport({ activity }) {
  const [reportTab, setReportTab] = useState("overview");
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
    <div className="events" style={{ padding: 16, overflow: "auto" }}>
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

      <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto" }}>
        {[
          ["overview", "Overview", null],
          ["connectivity", "Connectivity Tests", assessmentSections.connectivityTests.length],
          ["assessment", "Assessment Items", assessmentSections.assessmentItems.length],
          ["raw", "Raw Evidence", null],
        ].map(([key, label, badge]) => (
          <button
            key={key}
            className={`hud-btn ${reportTab === key ? "active" : ""}`}
            style={{ width: "auto", padding: "0 10px", fontSize: 11, whiteSpace: "nowrap" }}
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
  if (!html) return "";
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, "")
    .replace(/\sjavascript:/gi, " ");
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

function PacketTracerSidebar({ activity, onClose }) {
  const [topTab, setTopTab] = useState("progress");
  const [sub, setSub] = useState("overview");
  if (!activity) return null;

  const progress = activity.progress || null;
  const { primary, secondary } = progressDisplay(progress);
  const sections = packetTracerAssessmentSections(activity);
  const connectivityItems = sections.connectivityTests || [];
  const assessmentOnly = sections.assessmentItems || [];
  const components = progress?.components || [];
  const title = activity.title || activity.sourceName || "Packet Tracer Activity";
  const isPerfect = typeof progress?.percent === "number" && progress.percent >= 100;
  const rubricRoots = normalizeRubricPattern(activity.rubricPattern, activity.assessmentItems);

  return (
    <div className="pt-sidebar">
      <div className="pt-sb-head">
        <div className="pt-sb-title" title={title}>{title}</div>
        <div className="pt-sb-head-right">
          <div className={`pt-sb-score ${isPerfect ? "ok" : ""}`} title="Progress">
            <span className="pt-sb-score-primary">{primary}</span>
            {secondary && <span className="pt-sb-score-secondary">{secondary}</span>}
          </div>
          {onClose && (
            <button className="pt-sb-close" onClick={onClose} title="Hide sidebar">×</button>
          )}
        </div>
      </div>

      <div className="pt-sb-instructions">
        {activity.instructionsHtml
          ? <div className="pt-sb-html" dangerouslySetInnerHTML={{ __html: sanitizeActivityHtml(activity.instructionsHtml) }} />
          : activity.instructionsText
            ? <pre className="pt-sb-text">{activity.instructionsText}</pre>
            : <div className="pt-sb-empty">No instructions were embedded in this activity.</div>}
      </div>

      <div className="side-tabs pt-sb-tabs">
        {[
          ["progress", "Progress"],
          ["rubric", `Rubric${rubricRoots.length ? ` (${rubricRoots.length})` : ""}`],
        ].map(([k, lbl]) => (
          <div
            key={k}
            className={`side-tab ${topTab === k ? "active" : ""}`}
            onClick={() => setTopTab(k)}
          >{lbl}</div>
        ))}
      </div>

      {topTab === "progress" && (
        <>
          <div className="pt-sb-subtabs">
            {[
              ["overview", "Overview"],
              ["items", `Assessment Items${assessmentOnly.length ? ` (${assessmentOnly.length})` : ""}`],
              ["connectivity", `Connectivity Tests${connectivityItems.length ? ` (${connectivityItems.length})` : ""}`],
            ].map(([k, lbl]) => (
              <div
                key={k}
                className={`pt-sb-subtab ${sub === k ? "active" : ""}`}
                onClick={() => setSub(k)}
              >{lbl}</div>
            ))}
          </div>

          <div className="pt-sb-body">
            {sub === "overview" && (
              <div className="pt-sb-section">
                <div className="pt-sb-summary">
                  <div className="pt-sb-summary-row"><span className="k">Score</span><span className="v">{progress?.score || "—"}</span></div>
                  <div className="pt-sb-summary-row"><span className="k">Items</span><span className="v">{progress?.itemCount || `${(assessmentOnly.length + connectivityItems.length)}`}</span></div>
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
            )}

            {sub === "items" && (
              <div className="pt-sb-section">
                {assessmentOnly.length === 0 ? (
                  <div className="pt-sb-empty">No assessment items extracted.</div>
                ) : (
                  <div className="pt-sb-items">
                    {assessmentOnly.slice(0, 400).map((it, i) => (
                      <div key={`${it.path || it.id || i}-${i}`} className="pt-sb-item">
                        <div className="pt-sb-item-main">
                          <div className="pt-sb-item-name" title={it.path}>{it.path || it.name || it.id || `Item ${i + 1}`}</div>
                          {(it.components || it.rootName) && (
                            <div className="pt-sb-item-meta">{[it.components, it.rootName].filter(Boolean).join(" · ")}</div>
                          )}
                          {it.checkType && <div className="pt-sb-item-meta dim">{it.checkType}</div>}
                        </div>
                        <div className="pt-sb-item-points">{it.points || 0} pts</div>
                      </div>
                    ))}
                    {assessmentOnly.length > 400 && (
                      <div className="pt-sb-empty">Showing first 400 of {assessmentOnly.length} items.</div>
                    )}
                  </div>
                )}
              </div>
            )}

            {sub === "connectivity" && (
              <div className="pt-sb-section">
                {connectivityItems.length === 0 ? (
                  <div className="pt-sb-empty">No connectivity tests in this activity.</div>
                ) : (
                  <div className="pt-sb-items">
                    {connectivityItems.slice(0, 400).map((it, i) => (
                      <div key={`${it.path || it.id || i}-${i}`} className="pt-sb-item">
                        <div className="pt-sb-item-main">
                          <div className="pt-sb-item-name" title={it.path}>{it.path || it.name || it.id || `Test ${i + 1}`}</div>
                          {(it.components || it.rootName) && (
                            <div className="pt-sb-item-meta">{[it.components, it.rootName].filter(Boolean).join(" · ")}</div>
                          )}
                          {it.checkType && <div className="pt-sb-item-meta dim">{it.checkType}</div>}
                        </div>
                        <div className="pt-sb-item-points">{it.points || 0} pts</div>
                      </div>
                    ))}
                    {connectivityItems.length > 400 && (
                      <div className="pt-sb-empty">Showing first 400 of {connectivityItems.length} tests.</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {topTab === "rubric" && (
        <div className="pt-sb-body">
          <div className="pt-sb-section">
            {rubricRoots.length === 0 ? (
              <div className="pt-sb-empty">No rubric extracted from this activity.</div>
            ) : (
              <div className="pt-sb-rubric">
                {rubricRoots.map((root, i) => (
                  <RubricNode key={`${root?.id || root?.name || i}-${i}`} node={root} depth={0} />
                ))}
              </div>
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
    if (OPT_Engine.isHostLike?.(d)) {
      const e = d.interfaces.eth0;
      if (!e || !e.ip) issues.push({ s: "err", host: d.hostname, m: `no IP configured on eth0` });
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
function freeIface(d, links, devId) {
  for (const n of Object.keys(d.interfaces)) {
    const taken = links.some(l => (l.a === devId && l.ai === n) || (l.b === devId && l.bi === n));
    if (!taken) return n;
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
