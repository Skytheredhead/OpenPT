// inspector.jsx — right-side device inspector

function Inspector({ device, onTogglePower, onDelete, onRename, onConsole }) {
  if (!device) {
    return (
      <div className="ins-empty">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M9 9h6v6H9z"/>
        </svg>
        <div style={{ fontSize: 13, color: "var(--fg-2)" }}>No device selected</div>
        <div style={{ fontSize: 11.5, color: "var(--fg-3)", textAlign: "center", maxWidth: 220, lineHeight: 1.5 }}>
          Click a device on the canvas to view its interfaces, routing table, and configuration.
        </div>
      </div>
    );
  }

  const m = window.DeviceCatalog.find(c => c.kind === device.kind);
  const isRouterLike = device.kind === "router" || device.kind === "l3switch";
  const isSwitchLike = device.kind === "l2switch" || device.kind === "l3switch";
  const ifaceName = window.OPT_Engine.shortIfaceName;

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
      <div className="ins-head">
        <div className="row1">
          <div style={{ color: m.color }}>
            {React.createElement(window.Glyph[device.kind] || window.Glyph.router, { size: 26 })}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              className="name"
              value={device.hostname}
              onChange={(e) => onRename(device.id, e.target.value.replace(/\s/g, ""))}
              style={{
                background: "transparent", border: 0, outline: "none",
                color: "inherit", font: "inherit", width: "100%",
                padding: 0,
              }}
            />
            <div style={{ fontSize: 11, color: "var(--fg-3)", fontFamily: "var(--font-mono)" }}>{device.id}</div>
          </div>
          <span className="kind">{m.short}</span>
        </div>
        <div className="row2">
          <button className={`pwr-btn ${device.powered ? "on" : ""}`} onClick={() => onTogglePower(device.id)}>
            ● {device.powered ? "ON" : "OFF"}
          </button>
          <button className="pwr-btn" onClick={() => onConsole(device.id)}>{"> console"}</button>
          <div style={{ flex: 1 }} />
          <button className="del-btn" onClick={() => onDelete(device.id)} title="Delete">×</button>
        </div>
      </div>

      <div style={{ overflowY: "auto", flex: 1, minHeight: 0 }}>
        <div className="ins-section">
          <h4>Interfaces</h4>
          <div className="iface-table">
            {Object.entries(device.interfaces).map(([n, ifc]) => {
              const stCls = ifc.admUp === false ? "adm" : (ifc.up ? "up" : "down");
              const stText = ifc.admUp === false ? "ADM-DOWN" : (ifc.up ? "UP" : "DOWN");
              return (
                <div key={n} className="iface-row">
                  <div>
                    <div className="nm" title={n}>{ifaceName(n)}</div>
                    <div className="ip">
                      {ifc.ip ? `${ifc.ip}/${window.OPT_Engine.maskBits(ifc.mask)}` : "unassigned"}
                      {ifc.vlan != null ? ` · VLAN ${ifc.vlan}` : ""}
                      {ifc.desc ? ` · ${ifc.desc}` : ""}
                    </div>
                  </div>
                  <span className={`st ${stCls}`}>{stText}</span>
                </div>
              );
            })}
          </div>
        </div>

        {isRouterLike && (
          <div className="ins-section">
            <h4>Routing Table</h4>
            <div className="iface-table">
              {(device.routes || []).length === 0 && <div style={{ color: "var(--fg-3)", fontSize: 11.5 }}>no routes</div>}
              {(device.routes || []).map((r, i) => (
                <div key={i} className="iface-row">
                  <div>
                    <div className="nm">
                      <span style={{ color: r.type === "C" ? "var(--ok)" : "var(--accent)" }}>{r.type}</span>
                      &nbsp;{r.dst}/{window.OPT_Engine.maskBits(r.mask)}
                    </div>
                    <div className="ip">{r.via === "directly" ? `directly connected · ${ifaceName(r.iface)}` : `via ${r.via} · ${ifaceName(r.iface)}`}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {isSwitchLike && (
          <div className="ins-section">
            <h4>VLANs</h4>
            <div className="iface-table">
              {Object.entries(device.vlans || {}).map(([id, name]) => {
                const ports = Object.entries(device.interfaces).filter(([_, i]) => String(i.vlan) === String(id)).map(([n]) => ifaceName(n));
                return (
                  <div key={id} className="iface-row">
                    <div>
                      <div className="nm">VLAN {id} <span style={{ color: "var(--fg-2)" }}>{name}</span></div>
                      <div className="ip">{ports.length ? ports.join(", ") : "(no ports)"}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {(device.kind === "pc" || device.kind === "server") && device.interfaces.eth0 && (
          <div className="ins-section">
            <h4>IPv4 Settings</h4>
            <div className="ins-row"><span className="k">address</span><span className="v">{device.interfaces.eth0.ip || "—"}</span></div>
            <div className="ins-row"><span className="k">netmask</span><span className="v">{device.interfaces.eth0.mask || "—"}</span></div>
            <div className="ins-row"><span className="k">gateway</span><span className="v">{device.interfaces.eth0.gw || "—"}</span></div>
            <div className="ins-row"><span className="k">mac</span><span className="v dim">{device.interfaces.eth0.mac}</span></div>
          </div>
        )}
      </div>
    </div>
  );
}

function deviceModel(d) {
  return {
    router: "ISR4321-like",
    l2switch: "Catalyst 2960-24",
    l3switch: "Catalyst 3650-24",
    pc: "Generic workstation",
    server: "Rack 1U server",
    ap: "AP-2500",
    cloud: "Internet cloud",
  }[d.kind] || d.kind;
}

window.Inspector = Inspector;
