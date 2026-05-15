// palette.jsx — left sidebar device palette + link types

function Palette({ onDragStart, activeLink, onLinkPick }) {
  const cat = window.DeviceCatalog;
  const G = window.Glyph;
  return (
    <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
      <div className="palette-section">
        <div className="palette-section-title">Devices</div>
        <div className="palette-grid">
          {cat.map(d => (
            <div
              key={d.kind}
              className="palette-item"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "copy";
                e.dataTransfer.setData("text/x-openpt-device", d.kind);
                onDragStart && onDragStart(d.kind);
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

      <div className="palette-section">
        <div className="palette-section-title">Connections</div>
        <div className="palette-link-list">
          {[
            { id: "auto",     name: "Auto cable",       cls: "straight" },
            { id: "straight", name: "Copper straight",  cls: "straight" },
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
