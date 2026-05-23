// topology.jsx — interactive 2D canvas with devices, links, packet animation

function Topology(props) {
  const {
    devices, links, selectedIds, onSelect,
    onMoveDevices, onAddDevice, onDeleteLink,
    linkMode, setLinkMode, forceLinkType, packetMode, setPacketMode,
    onLinkRequest, onPacketRequest, simRunning, packets, activeHopDeviceId,
    viewState, onViewStateChange,
    starterScreenVisible, onCreateProject, onCreateStarter, onImportPacketTracer,
    selectedLinkId, onSelectLink, onLinkContextMenu, onMarqueeSelect,
  } = props;
  const selSet = React.useMemo(() => new Set(selectedIds || []), [selectedIds]);

  const wrapRef = React.useRef(null);
  const worldRef = React.useRef(null);
  const panRef = React.useRef(viewState?.pan || { x: 0, y: 0, k: 1 });
  const viewStateCommitRef = React.useRef(null);
  const panStateCommitRef = React.useRef(null);
  const [pan, setPan] = React.useState(viewState?.pan || { x: 0, y: 0, k: 1 });
  const [drag, setDrag] = React.useState(null);   // { id, ox, oy }
  const [linkPick, setLinkPick] = React.useState(null);  // { devId, iface }
  const [portPicker, setPortPicker] = React.useState(null);  // { devId }
  const [portSearch, setPortSearch] = React.useState("");
  const [marquee, setMarquee] = React.useState(null);
  const [toast, setToast] = React.useState(null);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  function labelScaleForZoom(k) {
    return k > 1 ? 1 / Math.pow(k, 0.45) : 1;
  }

  const applyPanStyles = (nextPan) => {
    if (wrapRef.current) {
      wrapRef.current.style.backgroundPosition = `${nextPan.x}px ${nextPan.y}px`;
      wrapRef.current.style.backgroundSize = `${24 * nextPan.k}px ${24 * nextPan.k}px`;
    }
    if (worldRef.current) {
      worldRef.current.style.transform = `translate(${nextPan.x}px, ${nextPan.y}px) scale(${nextPan.k})`;
      worldRef.current.style.setProperty("--canvas-label-scale", labelScaleForZoom(nextPan.k));
    }
  };

  const updatePan = (nextPan, options = {}) => {
    panRef.current = nextPan;
    applyPanStyles(nextPan);

    clearTimeout(panStateCommitRef.current);
    if (options.render) {
      setPan(nextPan);
    } else {
      panStateCommitRef.current = setTimeout(() => setPan(panRef.current), 220);
    }

    if (!onViewStateChange) return;
    clearTimeout(viewStateCommitRef.current);
    viewStateCommitRef.current = setTimeout(() => {
      onViewStateChange({ pan: panRef.current });
    }, 500);
  };

  React.useEffect(() => {
    if (viewState?.pan) {
      panRef.current = viewState.pan;
      setPan(viewState.pan);
      requestAnimationFrame(() => applyPanStyles(viewState.pan));
    }
  }, [viewState?.pan?.x, viewState?.pan?.y, viewState?.pan?.k]);

  React.useEffect(() => {
    requestAnimationFrame(() => applyPanStyles(panRef.current));
    return () => {
      clearTimeout(viewStateCommitRef.current);
      clearTimeout(panStateCommitRef.current);
    };
  }, []);

  const screenToWorld = (px, py) => {
    const r = wrapRef.current.getBoundingClientRect();
    const currentPan = panRef.current;
    return { x: (px - r.left - currentPan.x) / currentPan.k, y: (py - r.top - currentPan.y) / currentPan.k };
  };

  // ── Drop new device from palette
  const onDrop = (e) => {
    const kind = e.dataTransfer.getData("text/x-openpt-device");
    if (!kind) return;
    const p = screenToWorld(e.clientX, e.clientY);
    onAddDevice(kind, p.x, p.y);
    e.preventDefault();
  };

  // ── Pan with middle/right drag
  const onMouseDownBg = (e) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      const start = { ...panRef.current, mx: e.clientX, my: e.clientY };
      const move = (ev) => updatePan({ x: start.x + ev.clientX - start.mx, y: start.y + ev.clientY - start.my, k: start.k });
      const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    } else if (e.button === 0 && !e.target.closest(".node") && !e.target.closest(".link-label")) {
      const start = {
        clientX: e.clientX,
        clientY: e.clientY,
        world: screenToWorld(e.clientX, e.clientY),
        additive: e.shiftKey || e.metaKey || e.ctrlKey,
        moved: false,
      };
      const move = (ev) => {
        const dx = ev.clientX - start.clientX;
        const dy = ev.clientY - start.clientY;
        if (!start.moved && Math.hypot(dx, dy) < 5) return;
        start.moved = true;
        setMarquee({ a: start.world, b: screenToWorld(ev.clientX, ev.clientY) });
      };
      const up = (ev) => {
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
        if (start.moved) {
          const end = screenToWorld(ev.clientX, ev.clientY);
          const minX = Math.min(start.world.x, end.x);
          const maxX = Math.max(start.world.x, end.x);
          const minY = Math.min(start.world.y, end.y);
          const maxY = Math.max(start.world.y, end.y);
          const ids = Object.values(devices)
            .filter((d) => d.x >= minX && d.x <= maxX && d.y >= minY && d.y <= maxY)
            .map((d) => d.id);
          onMarqueeSelect ? onMarqueeSelect(ids, start.additive) : onSelect && onSelect(null);
        } else {
          onSelect && onSelect(null);
          onSelectLink && onSelectLink(null);
          if (linkMode) { setLinkPick(null); setPortPicker(null); }
        }
        setMarquee(null);
      };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    }
  };

  // Attach wheel listener manually with passive:false so we can preventDefault on trackpad pans
  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const h = (e) => onWheel(e);
    el.addEventListener("wheel", h, { passive: false });
    return () => el.removeEventListener("wheel", h);
  });

  const onWheel = (e) => {
    e.preventDefault();
    // Pinch gestures and ctrl/cmd + scroll → zoom.
    // Plain wheel/two-finger trackpad scroll → pan.
    if (e.ctrlKey || e.metaKey) {
      const delta = -e.deltaY * 0.01;
      const currentPan = panRef.current;
      const k = Math.max(0.3, Math.min(2.5, currentPan.k * (1 + delta)));
      const r = wrapRef.current.getBoundingClientRect();
      const cx = e.clientX - r.left, cy = e.clientY - r.top;
      updatePan({
        x: cx - (cx - currentPan.x) * (k / currentPan.k),
        y: cy - (cy - currentPan.y) * (k / currentPan.k),
        k,
      });
    } else {
      // Pan with trackpad — scale down for comfortable feel
      const factor = 0.5;
      const currentPan = panRef.current;
      updatePan({ x: currentPan.x - e.deltaX * factor, y: currentPan.y - e.deltaY * factor, k: currentPan.k });
    }
  };

  // ── Node drag (supports group drag of all selected)
  const onNodeMouseDown = (e, d) => {
    if (e.button !== 0) return;
    if (linkMode) {
      setPortPicker({ devId: d.id });
      setPortSearch("");
      e.stopPropagation();
      return;
    }
    if (packetMode) {
      if (packetMode.stage === "src") {
        setPacketMode({ stage: "dst", src: d.id });
        setToast({ msg: `Selected ${d.hostname} — pick a destination`, kind: "" });
      } else if (packetMode.stage === "dst" && packetMode.src && packetMode.src !== d.id) {
        onPacketRequest && onPacketRequest(packetMode.src, d.id);
        setPacketMode(null);
      } else {
        setPacketMode({ stage: "src" });
      }
      e.stopPropagation();
      return;
    }
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    // Update selection
    onSelect && onSelect(d.id, additive);
    // Build set of nodes that will move together
    let groupIds;
    if (additive) {
      // include this node + currently selected
      groupIds = selSet.has(d.id) ? Array.from(selSet) : [...selSet, d.id];
    } else {
      groupIds = selSet.has(d.id) ? Array.from(selSet) : [d.id];
    }
    // Snapshot starting positions
    const startPositions = {};
    for (const id of groupIds) {
      const dd = devices[id];
      if (dd) startPositions[id] = { x: dd.x, y: dd.y };
    }
    const startX = e.clientX, startY = e.clientY;
    setDrag({ id: d.id, groupIds, startPositions, startX, startY, moved: false });
    props.onMoveStart && props.onMoveStart();
    e.stopPropagation();
  };
  React.useEffect(() => {
    if (!drag) return;
    const move = (e) => {
      const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
      if (!drag.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) drag.moved = true;
      // World-space delta
      const wx = dx / panRef.current.k, wy = dy / panRef.current.k;
      const deltas = drag.groupIds.map((id) => {
        const start = drag.startPositions[id];
        return { id, x: start.x + wx, y: start.y + wy };
      });
      onMoveDevices && onMoveDevices(deltas);
    };
    const up = () => {
      if (!drag.moved && props.onOpenConsole) {
        props.onOpenConsole(drag.id);
      }
      props.onMoveEnd && props.onMoveEnd(!!drag.moved);
      setDrag(null);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, [drag]);

  // ── Cancel modes on Esc
  React.useEffect(() => {
    const k = (e) => {
      if (e.key === "Escape") { setLinkMode(false); setLinkPick(null); setPortPicker(null); setPacketMode(null); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  React.useEffect(() => {
    if (!linkMode) {
      setLinkPick(null);
      setPortPicker(null);
    }
  }, [linkMode]);

  const G = window.Glyph;
  const cat = window.DeviceCatalog;
  const meta = (d) => cat.find(c => c.platform === d.platform && c.kind === d.kind) || cat.find(c => c.platform === d.platform) || cat.find(c => c.kind === d.kind) || cat[0];
  const ifaceName = window.OPT_Engine.shortIfaceName;
  const cableType = window.OPT_Engine.normalizeCableType?.(forceLinkType || "auto") || "auto";
  const cableLabel = window.OPT_Engine.cableTypeLabel?.(cableType) || "Auto cable";
  const endpointColorFor = (id) => {
    let hash = 0;
    for (const ch of String(id || "")) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
    return `oklch(0.77 0.14 ${Math.round((hash * 137.508) % 360)})`;
  };

  const isIfaceTaken = (devId, iface) => links.some(l => (l.a === devId && l.ai === iface) || (l.b === devId && l.bi === iface));

  const portStatus = (dev, iface) => {
    if (!dev || !iface) return { disabled: true, reason: "Unavailable" };
    if (isIfaceTaken(dev.id, iface)) return { disabled: true, reason: "Already connected" };
    const fit = window.OPT_Engine.cableFitsPort?.(dev, iface, cableType) || { ok: true };
    if (!fit.ok) return { disabled: true, reason: fit.reason };
    if (linkPick) {
      if (linkPick.devId === dev.id) return { disabled: true, reason: "Pick a port on another device" };
      const first = devices[linkPick.devId];
      const compat = window.OPT_Engine.cableCompatibility?.(first, linkPick.iface, dev, iface, cableType) || { ok: true };
      if (!compat.ok) return { disabled: true, reason: compat.reason };
      return { disabled: false, warning: compat.warning };
    }
    return { disabled: false };
  };

  const choosePort = (dev, iface) => {
    const status = portStatus(dev, iface);
    if (status.disabled) {
      setToast({ kind: "err", msg: status.reason || "That port cannot be used" });
      return;
    }
    const endpoint = { devId: dev.id, iface };
    if (!linkPick || linkPick.devId === dev.id) {
      setLinkPick(endpoint);
      setPortPicker(null);
      setToast({ msg: `${dev.hostname} ${ifaceName(iface)} selected - pick the other device`, kind: "" });
      return;
    }
    onLinkRequest && onLinkRequest(linkPick, endpoint);
    setLinkPick(null);
    setPortPicker(null);
  };

  const portPickerStyle = () => {
    const dev = devices[portPicker?.devId];
    const wrap = wrapRef.current;
    if (!dev || !wrap) return {};
    const cardW = 324;
    const cardH = 260;
    const left = Math.max(12, Math.min(wrap.clientWidth - cardW - 12, panRef.current.x + dev.x * panRef.current.k + 34));
    const top = Math.max(52, Math.min(wrap.clientHeight - cardH - 12, panRef.current.y + dev.y * panRef.current.k - 32));
    return { left, top };
  };

  const portGroupsFor = (dev) => {
    const groups = new Map();
    const q = portSearch.trim().toLowerCase();
    for (const iface of Object.keys(dev?.interfaces || {})) {
      const info = window.OPT_Engine.ifacePortInfo?.(dev, iface) || { group: "Other", label: iface };
      if (q && !`${iface} ${info.label || ""} ${info.group || ""}`.toLowerCase().includes(q)) continue;
      if (!groups.has(info.group)) groups.set(info.group, []);
      groups.get(info.group).push({ iface, info });
    }
    return Array.from(groups.entries());
  };
  const linkGeometries = React.useMemo(() => {
    const pairGroups = new Map();
    links.forEach((l) => {
      const key = [l.a, l.b].filter(Boolean).sort().join(":");
      if (!pairGroups.has(key)) pairGroups.set(key, []);
      pairGroups.get(key).push(l.id);
    });
    const pairSlots = {};
    for (const ids of pairGroups.values()) {
      ids.forEach((id, index) => {
        pairSlots[id] = { offset: index - (ids.length - 1) / 2, count: ids.length };
      });
    }

    const positions = {};
    links.forEach((l) => {
      const a = devices[l.a], b = devices[l.b];
      if (!a || !b) return;
      const dx = b.x - a.x, dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const tx = dx / len, ty = dy / len;
      const px = -ty, py = tx;
      const slot = pairSlots[l.id] || { offset: 0, count: 1 };
      const endShift = slot.count > 1 ? slot.offset * 9 : 0;
      const curveShift = slot.count > 1 ? slot.offset * 46 : 0;
      const labelShift = slot.count > 1 ? slot.offset * 30 : 0;
      const r = 22;
      const sx = a.x + tx * r + px * endShift;
      const sy = a.y + ty * r + py * endShift;
      const ex = b.x - tx * r + px * endShift;
      const ey = b.y - ty * r + py * endShift;
      const cx = (a.x + b.x) / 2 + px * curveShift;
      const cy = (a.y + b.y) / 2 + py * curveShift;
      const pointOnCable = (t) => {
        if (slot.count <= 1) return { x: sx + (ex - sx) * t, y: sy + (ey - sy) * t };
        const inv = 1 - t;
        return {
          x: inv * inv * sx + 2 * inv * t * cx + t * t * ex,
          y: inv * inv * sy + 2 * inv * t * cy + t * t * ey,
        };
      };
      const labelA = pointOnCable(slot.count > 1 ? 0.32 : 0.43);
      const labelB = pointOnCable(slot.count > 1 ? 0.68 : 0.57);
      let angle = Math.atan2(dy, dx) * 180 / Math.PI;
      if (angle > 90) angle -= 180;
      if (angle < -90) angle += 180;
      positions[l.id] = {
        angle,
        line: {
          sx, sy, ex, ey,
          path: slot.count > 1 ? `M ${sx} ${sy} Q ${cx} ${cy} ${ex} ${ey}` : null,
        },
        a: { x: labelA.x + px * labelShift * 0.18, y: labelA.y + py * labelShift * 0.18 },
        b: { x: labelB.x + px * labelShift * 0.18, y: labelB.y + py * labelShift * 0.18 },
      };
    });
    return positions;
  }, [devices, links]);

  const fit = () => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ds = Object.values(devices);
    if (!ds.length) { updatePan({ x: 0, y: 0, k: 1 }, { render: true }); return; }
    const minX = Math.min(...ds.map(d => d.x)) - 60;
    const minY = Math.min(...ds.map(d => d.y)) - 60;
    const maxX = Math.max(...ds.map(d => d.x)) + 60;
    const maxY = Math.max(...ds.map(d => d.y)) + 60;
    const w = wrap.clientWidth, h = wrap.clientHeight;
    const kx = w / (maxX - minX), ky = h / (maxY - minY);
    const k = Math.max(0.4, Math.min(1.3, Math.min(kx, ky)));
    updatePan({
      x: (w - (maxX - minX) * k) / 2 - minX * k,
      y: (h - (maxY - minY) * k) / 2 - minY * k,
      k,
    }, { render: true });
  };

  // Auto-fit on mount
  const didFit = React.useRef(false);
  React.useEffect(() => {
    if (didFit.current) return;
    if (!wrapRef.current) return;
    if (wrapRef.current.clientWidth > 100 && Object.keys(devices).length) {
      didFit.current = true;
      // delay one frame
      requestAnimationFrame(() => fit());
    }
  });

  return (
    <div
      ref={wrapRef}
      className="canvas-wrap"
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      onMouseDown={onMouseDownBg}
      style={{
        backgroundPosition: `${pan.x}px ${pan.y}px`,
        backgroundSize: `${24 * pan.k}px ${24 * pan.k}px`,
      }}
    >
      {/* HUD top-right */}
      <div className="canvas-hud">
        <div className="hud-btn" title="Zoom in" onClick={() => updatePan({ ...panRef.current, k: Math.min(2.5, panRef.current.k * 1.15) }, { render: true })}>{window.Icon.zoomIn()}</div>
        <div className="hud-btn" title="Zoom out" onClick={() => updatePan({ ...panRef.current, k: Math.max(0.4, panRef.current.k / 1.15) }, { render: true })}>{window.Icon.zoomOut()}</div>
        <div className="hud-btn" title="Fit to screen" onClick={fit}>{window.Icon.fit()}</div>
      </div>

      {linkMode && (
        <div className="canvas-modehint">
          <span style={{ width: 6, height: 6, borderRadius: 3, background: "var(--accent)" }}/>
          {linkPick
            ? `Cable mode — ${devices[linkPick.devId]?.hostname || "Device"} ${ifaceName(linkPick.iface)} to...`
            : `Cable mode — ${cableLabel}: click a device, then pick a port`}
          <span className="esc">Esc</span>
        </div>
      )}
      {linkMode && portPicker?.devId && devices[portPicker.devId] && (
        <div
          className="port-picker-card"
          style={portPickerStyle()}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="port-picker-head">
            <div>
              <div className="port-picker-title">Plug into {devices[portPicker.devId].hostname}</div>
              <div className="port-picker-subtitle">{devices[portPicker.devId].model || devices[portPicker.devId].kind} · {cableLabel}</div>
            </div>
            <button className="port-picker-close" onClick={() => setPortPicker(null)} title="Close port selector">×</button>
          </div>
          <div className="port-picker-shell">
            <input
              className="port-picker-search"
              value={portSearch}
              onChange={(e) => setPortSearch(e.target.value)}
              placeholder="Filter ports"
              autoFocus
            />
            {portGroupsFor(devices[portPicker.devId]).map(([group, ports]) => (
              <div key={group} className="port-picker-group">
                <div className="port-picker-group-title">{group}</div>
                <div className="port-picker-grid">
                  {ports.map(({ iface, info }) => {
                    const status = portStatus(devices[portPicker.devId], iface);
                    const isSelected = linkPick?.devId === portPicker.devId && linkPick?.iface === iface;
                    return (
                      <button
                        key={iface}
                        className={`port-button ${isSelected ? "selected" : ""} ${status.warning ? "warn" : ""} ${!status.disabled && linkPick ? "compatible" : ""}`}
                        disabled={status.disabled}
                        title={status.reason || status.warning || iface}
                        onClick={() => choosePort(devices[portPicker.devId], iface)}
                      >
                        {info.label || ifaceName(iface)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="port-picker-foot">
            {linkPick
              ? "Choose a compatible free port on this device."
              : "Choose the first port for this cable."}
          </div>
        </div>
      )}
      {packetMode && (
        <div className="canvas-modehint">
          <span style={{ width: 6, height: 6, borderRadius: 3, background: "var(--ok)" }}/>
          Packet mode — pick a {packetMode.stage === "dst" ? "destination" : "source"} device <span className="esc">Esc</span>
        </div>
      )}

      {starterScreenVisible && (
        <div className="starter-screen" aria-label="Start a project">
          <div className="starter-message">
            <button type="button" className="starter-action primary" onClick={(e) => { e.stopPropagation(); onCreateProject && onCreateProject(); }}>New Blank</button>
            <button type="button" className="starter-action" onClick={(e) => { e.stopPropagation(); onCreateStarter && onCreateStarter(); }}>Starter Lab</button>
            <button type="button" className="starter-action" onClick={(e) => { e.stopPropagation(); onImportPacketTracer && onImportPacketTracer(); }}>Import PKA File</button>
          </div>
        </div>
      )}

      {/* World transform */}
      <div
        ref={worldRef}
        style={{
          position: "absolute", inset: 0,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${pan.k})`,
          transformOrigin: "0 0",
          "--canvas-label-scale": labelScaleForZoom(pan.k),
        }}
      >
        {/* Links SVG layer */}
        <svg
          style={{
            position: "absolute", left: -2000, top: -2000,
            width: 6000, height: 6000, overflow: "visible", pointerEvents: "none",
          }}
        >
          <g transform="translate(2000, 2000)">
            {links.map(l => {
              const a = devices[l.a], b = devices[l.b];
              if (!a || !b) return null;
              const geom = linkGeometries[l.id];
              const dx = b.x - a.x, dy = b.y - a.y;
              const len = Math.hypot(dx, dy) || 1;
              const r = 22;
              const fallbackLine = {
                sx: a.x + (dx / len) * r,
                sy: a.y + (dy / len) * r,
                ex: b.x - (dx / len) * r,
                ey: b.y - (dy / len) * r,
              };
              const line = geom?.line || fallbackLine;
              const stroke = l.type === "serial" ? "var(--warn)"
                             : l.type === "fiber" ? "var(--violet)"
                             : l.type === "console" ? "var(--fg-3)"
                             : "var(--fg-1)";
              const dash = l.type === "cross" ? "5,3"
                            : (!l.up ? "4,4" : "");
              return (
                <g key={l.id}>
                  {line.path ? (
                    <path d={line.path} fill="none" stroke={stroke} strokeWidth={1.55} strokeDasharray={dash} opacity={l.up ? 0.9 : 0.42} strokeLinecap="round" />
                  ) : (
                    <line x1={line.sx} y1={line.sy} x2={line.ex} y2={line.ey} stroke={stroke} strokeWidth={1.4} strokeDasharray={dash} opacity={l.up ? 0.85 : 0.4} strokeLinecap="round" />
                  )}
                </g>
              );
            })}
          </g>
        </svg>

        {/* Link labels (HTML) */}
        {links.map(l => {
          const a = devices[l.a], b = devices[l.b];
          if (!a || !b) return null;
          const labelPosition = linkGeometries[l.id];
          const dx = b.x - a.x, dy = b.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          const tx = dx / len, ty = dy / len;
          const fallback = {
            angle: Math.atan2(dy, dx) * 180 / Math.PI,
            a: { x: (a.x + b.x) / 2 - tx * 28, y: (a.y + b.y) / 2 - ty * 28 },
            b: { x: (a.x + b.x) / 2 + tx * 28, y: (a.y + b.y) / 2 + ty * 28 },
          };
          const geom = labelPosition || fallback;
          return (
            <React.Fragment key={`lbl-${l.id}`}>
              <div
                className="link-label endpoint-a"
                data-selected={selectedLinkId === l.id ? "1" : "0"}
                style={{
                  left: geom.a.x,
                  top: geom.a.y,
                  "--link-label-angle": `${geom.angle}deg`,
                  "--link-endpoint-color": endpointColorFor(a.id),
                }}
                onClick={(e) => { e.stopPropagation(); onSelectLink && onSelectLink(l.id); }}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onLinkContextMenu && onLinkContextMenu(e, l); }}
                onDoubleClick={() => onDeleteLink && onDeleteLink(l.id)}
                title={`${a.hostname} ${l.ai}. Double-click to remove link.`}
              >
                <span title={l.ai}>{ifaceName(l.ai)}</span>
              </div>
              <div
                className="link-label endpoint-b"
                data-selected={selectedLinkId === l.id ? "1" : "0"}
                style={{
                  left: geom.b.x,
                  top: geom.b.y,
                  "--link-label-angle": `${geom.angle}deg`,
                  "--link-endpoint-color": endpointColorFor(b.id),
                }}
                onClick={(e) => { e.stopPropagation(); onSelectLink && onSelectLink(l.id); }}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onLinkContextMenu && onLinkContextMenu(e, l); }}
                onDoubleClick={() => onDeleteLink && onDeleteLink(l.id)}
                title={`${b.hostname} ${l.bi}. Double-click to remove link.`}
              >
                <span title={l.bi}>{ifaceName(l.bi)}</span>
              </div>
            </React.Fragment>
          );
        })}

        {/* Devices */}
        {Object.values(devices).map(d => {
          const m = meta(d);
          const isActiveHop = activeHopDeviceId === d.id;
          const ipIface = d.interfaces && Object.values(d.interfaces).find(i => i.ip);
          return (
            <div
              key={d.id}
              className={`node ${selSet.has(d.id) ? "selected" : ""}`}
              style={{ left: d.x, top: d.y }}
              onMouseDown={(e) => onNodeMouseDown(e, d)}
              onDoubleClick={() => onSelect && onSelect(d.id)}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); props.onContextMenu && props.onContextMenu(e, d); }}
            >
              {isActiveHop && <div className="node-pulse"/>}
              <div className={`node-body ${d.powered ? "pwr-on" : "pwr-off"}`} style={{ color: m.color }}>
                {React.createElement(G[d.kind] || G.router, { size: 44 })}
              </div>
              <div className="node-label">{d.hostname}</div>
              {ipIface && (
                <div className="node-meta">{ipIface.ip}</div>
              )}
            </div>
          );
        })}

        {/* Packets */}
        {packets.map(p => (
          <div key={p.id} className={`packet ${p.proto || ""}`} style={{ left: p.x, top: p.y }}>
            <div className="shell"/>
          </div>
        ))}
      </div>

      {marquee && (
        <div
          className="marquee"
          style={{
            left: Math.min(marquee.a.x, marquee.b.x) * panRef.current.k + panRef.current.x,
            top: Math.min(marquee.a.y, marquee.b.y) * panRef.current.k + panRef.current.y,
            width: Math.abs(marquee.b.x - marquee.a.x) * panRef.current.k,
            height: Math.abs(marquee.b.y - marquee.a.y) * panRef.current.k,
          }}
        />
      )}

      {toast && (
        <div className={`toast ${toast.kind || ""}`}>
          <span className="dot"/>{toast.msg}
        </div>
      )}
    </div>
  );
}
window.Topology = Topology;
