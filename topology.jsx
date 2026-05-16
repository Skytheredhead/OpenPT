// topology.jsx — interactive 2D canvas with devices, links, packet animation

function Topology(props) {
  const {
    devices, links, selectedIds, onSelect,
    onMoveDevices, onAddDevice, onDeleteLink,
    linkMode, setLinkMode, packetMode, setPacketMode,
    onLinkRequest, onPacketRequest, simRunning, packets, activeHopDeviceId,
    viewState, onViewStateChange,
  } = props;
  const selSet = React.useMemo(() => new Set(selectedIds || []), [selectedIds]);

  const wrapRef = React.useRef(null);
  const [pan, setPan] = React.useState(viewState?.pan || { x: 0, y: 0, k: 1 });
  const [drag, setDrag] = React.useState(null);   // { id, ox, oy }
  const [linkPick, setLinkPick] = React.useState(null);  // { devId, iface? }
  const [hover, setHover] = React.useState({ x: 0, y: 0 });
  const [toast, setToast] = React.useState(null);

  React.useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(t);
  }, [toast]);

  React.useEffect(() => {
    if (viewState?.pan) setPan(viewState.pan);
  }, [viewState?.pan?.x, viewState?.pan?.y, viewState?.pan?.k]);

  React.useEffect(() => {
    onViewStateChange && onViewStateChange({ pan });
  }, [pan.x, pan.y, pan.k]);

  const screenToWorld = (px, py) => {
    const r = wrapRef.current.getBoundingClientRect();
    return { x: (px - r.left - pan.x) / pan.k, y: (py - r.top - pan.y) / pan.k };
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
      const start = { ...pan, mx: e.clientX, my: e.clientY };
      const move = (ev) => setPan({ x: start.x + ev.clientX - start.mx, y: start.y + ev.clientY - start.my, k: start.k });
      const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    } else if (e.button === 0 && !e.target.closest(".node") && !e.target.closest(".link-label")) {
      onSelect && onSelect(null);
      if (linkMode) setLinkPick(null);
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
      const k = Math.max(0.3, Math.min(2.5, pan.k * (1 + delta)));
      const r = wrapRef.current.getBoundingClientRect();
      const cx = e.clientX - r.left, cy = e.clientY - r.top;
      setPan({
        x: cx - (cx - pan.x) * (k / pan.k),
        y: cy - (cy - pan.y) * (k / pan.k),
        k,
      });
    } else {
      // Pan with trackpad — scale down for comfortable feel
      const factor = 0.5;
      setPan((p) => ({ x: p.x - e.deltaX * factor, y: p.y - e.deltaY * factor, k: p.k }));
    }
  };

  // ── Node drag (supports group drag of all selected)
  const onNodeMouseDown = (e, d) => {
    if (e.button !== 0) return;
    if (linkMode) {
      if (!linkPick) {
        setLinkPick({ devId: d.id });
        setToast({ msg: `Selected ${d.hostname} — pick another device to connect`, kind: "" });
      } else if (linkPick.devId !== d.id) {
        onLinkRequest && onLinkRequest(linkPick.devId, d.id);
        setLinkPick(null);
      } else {
        setLinkPick(null);
      }
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
    e.stopPropagation();
  };
  React.useEffect(() => {
    if (!drag) return;
    const move = (e) => {
      const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
      if (!drag.moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) drag.moved = true;
      // World-space delta
      const wx = dx / pan.k, wy = dy / pan.k;
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
      setDrag(null);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, [drag]);

  // ── Cancel modes on Esc
  React.useEffect(() => {
    const k = (e) => {
      if (e.key === "Escape") { setLinkMode(false); setLinkPick(null); setPacketMode(null); }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const G = window.Glyph;
  const cat = window.DeviceCatalog;
  const meta = (d) => cat.find(c => c.platform === d.platform && c.kind === d.kind) || cat.find(c => c.platform === d.platform) || cat.find(c => c.kind === d.kind) || cat[0];
  const ifaceName = window.OPT_Engine.shortIfaceName;

  const fit = () => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ds = Object.values(devices);
    if (!ds.length) { setPan({ x: 0, y: 0, k: 1 }); return; }
    const minX = Math.min(...ds.map(d => d.x)) - 60;
    const minY = Math.min(...ds.map(d => d.y)) - 60;
    const maxX = Math.max(...ds.map(d => d.x)) + 60;
    const maxY = Math.max(...ds.map(d => d.y)) + 60;
    const w = wrap.clientWidth, h = wrap.clientHeight;
    const kx = w / (maxX - minX), ky = h / (maxY - minY);
    const k = Math.max(0.4, Math.min(1.3, Math.min(kx, ky)));
    setPan({
      x: (w - (maxX - minX) * k) / 2 - minX * k,
      y: (h - (maxY - minY) * k) / 2 - minY * k,
      k,
    });
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
      onWheel={onWheel}
      onMouseMove={(e) => setHover(screenToWorld(e.clientX, e.clientY))}
      style={{
        backgroundPosition: `${pan.x}px ${pan.y}px`,
        backgroundSize: `${24 * pan.k}px ${24 * pan.k}px`,
      }}
    >
      {/* HUD top-right */}
      <div className="canvas-hud">
        <div className="hud-btn" title="Zoom in" onClick={() => setPan({ ...pan, k: Math.min(2.5, pan.k * 1.15) })}>{window.Icon.zoomIn()}</div>
        <div className="hud-btn" title="Zoom out" onClick={() => setPan({ ...pan, k: Math.max(0.4, pan.k / 1.15) })}>{window.Icon.zoomOut()}</div>
        <div className="hud-btn" title="Fit to screen" onClick={fit}>{window.Icon.fit()}</div>
      </div>

      {linkMode && (
        <div className="canvas-modehint">
          <span style={{ width: 6, height: 6, borderRadius: 3, background: "var(--accent)" }}/>
          Cable mode — click two devices to connect <span className="esc">Esc</span>
        </div>
      )}
      {packetMode && (
        <div className="canvas-modehint">
          <span style={{ width: 6, height: 6, borderRadius: 3, background: "var(--ok)" }}/>
          Packet mode — pick a {packetMode.stage === "dst" ? "destination" : "source"} device <span className="esc">Esc</span>
        </div>
      )}

      {/* World transform */}
      <div
        style={{
          position: "absolute", inset: 0,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${pan.k})`,
          transformOrigin: "0 0",
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
              const dx = b.x - a.x, dy = b.y - a.y;
              const len = Math.hypot(dx, dy) || 1;
              // shrink ends so cable doesn't enter the icon body
              const r = 22;
              const sx = a.x + (dx / len) * r, sy = a.y + (dy / len) * r;
              const ex = b.x - (dx / len) * r, ey = b.y - (dy / len) * r;
              const stroke = l.type === "serial" ? "var(--warn)"
                             : l.type === "fiber" ? "var(--violet)"
                             : l.type === "console" ? "var(--fg-3)"
                             : "var(--fg-1)";
              const dash = l.type === "cross" ? "5,3"
                            : (!l.up ? "4,4" : "");
              return (
                <g key={l.id}>
                  <line x1={sx} y1={sy} x2={ex} y2={ey} stroke={stroke} strokeWidth={1.4} strokeDasharray={dash} opacity={l.up ? 0.85 : 0.4} />
                </g>
              );
            })}
          </g>
        </svg>

        {/* Link labels (HTML) */}
        {links.map(l => {
          const a = devices[l.a], b = devices[l.b];
          if (!a || !b) return null;
          const dx = b.x - a.x, dy = b.y - a.y;
          const len = Math.hypot(dx, dy) || 1;
          // Offset perpendicular to the cable so the label isn't dead-center
          const ox = -dy / len * 10;
          const oy = dx / len * 10;
          const mx = (a.x + b.x) / 2 + ox;
          const my = (a.y + b.y) / 2 + oy;
          return (
            <div
              key={`lbl-${l.id}`}
              className="link-label"
              style={{ left: mx, top: my }}
              onDoubleClick={() => onDeleteLink && onDeleteLink(l.id)}
              title="Double-click to remove"
            >
              <span title={l.ai}>{ifaceName(l.ai)}</span> ↔ <span title={l.bi}>{ifaceName(l.bi)}</span>
            </div>
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

      {toast && (
        <div className={`toast ${toast.kind || ""}`}>
          <span className="dot"/>{toast.msg}
        </div>
      )}
    </div>
  );
}
window.Topology = Topology;
