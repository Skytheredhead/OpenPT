// palette.jsx — left sidebar device palette + link types

function Palette({ onDragStart, activeLink, onLinkPick }) {
  const cat = window.DeviceCatalog;
  const G = window.Glyph;
  const groups = [
    { title: "Routers", kinds: ["router"] },
    { title: "Switches", kinds: ["l2switch", "l3switch"] },
    { title: "End Devices", kinds: ["pc", "mac", "laptop", "server", "printer", "phone", "ap"] },
  ].map((group) => ({
    ...group,
    devices: cat.filter((d) => group.kinds.includes(d.kind)),
  })).filter((group) => group.devices.length);
  const groupedIds = new Set(groups.flatMap((group) => group.devices.map((d) => d.id || d.kind)));
  const other = cat.filter((d) => !groupedIds.has(d.id || d.kind));
  if (other.length) groups.push({ title: "Other", devices: other });
  return (
    <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
      {groups.map((group) => (
      <div className="palette-section" key={group.title}>
        <div className="palette-section-title">{group.title}</div>
        <div className="palette-grid">
          {group.devices.map(d => (
            <div
              key={d.id || d.kind}
              className="palette-item"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "copy";
                e.dataTransfer.setData("text/x-openpt-device", d.id || d.kind);
                onDragStart && onDragStart(d.id || d.kind);
              }}
              title={`Drag ${d.label} to canvas`}
            >
              <div style={{ color: d.color }}>
                {React.createElement(G[d.kind] || G.router, { size: 30 })}
              </div>
              <div className="label">{d.short}</div>
            </div>
          ))}
        </div>
      </div>
      ))}

      <div className="palette-section">
        <div className="palette-section-title">Connections</div>
        <div className="palette-link-list">
          {[
            { id: "auto",     name: "Auto cable",       cls: "straight" },
            { id: "copper",   name: "Copper straight",  cls: "straight" },
            { id: "cross",    name: "Copper crossover", cls: "cross" },
            { id: "serial",   name: "Serial DCE",       cls: "serial" },
            { id: "fiber",    name: "Fiber",            cls: "fiber" },
            { id: "console",  name: "Console",          cls: "console" },
          ].map(l => (
            <div
              key={l.id}
              className={`palette-link ${l.cls} ${activeLink === l.id ? "active" : ""}`}
              onClick={() => onLinkPick && onLinkPick(l.id)}
            >
              <span className="swatch" />
              <span>{l.name}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="palette-section">
        <div className="palette-section-title">Hint</div>
        <div style={{ padding: "0 6px", fontSize: 11.5, color: "var(--fg-2)", lineHeight: 1.55 }}>
          Drag a device onto the canvas. Click the <span style={{ color: "var(--accent)" }}>cable</span> tool above the canvas to wire two devices together.
        </div>
      </div>
    </div>
  );
}
window.Palette = Palette;
