// device-glyphs.jsx — original geometric icons for network device types
// (NOT Cisco's pixel icons — flat 2D schematic glyphs)

const G_STROKE = "#e8d7b8"; // overridden via currentColor
const G_FILL = "rgba(255,255,255,0.04)";

const Glyph = {
  router: ({ size = 30 }) => (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
      <circle cx="15" cy="15" r="10" stroke="currentColor" strokeWidth="1.3" fill="rgba(255,255,255,0.04)"/>
      {/* four directional arrows */}
      <path d="M15 6l-2 2.5h1.4v3.5h1.2V8.5H17z" fill="currentColor"/>
      <path d="M15 24l2-2.5h-1.4v-3.5h-1.2V21.5H13z" fill="currentColor"/>
      <path d="M6 15l2.5-2v1.4h3.5v1.2H8.5V17z" fill="currentColor"/>
      <path d="M24 15l-2.5 2v-1.4h-3.5v-1.2h3.5V13z" fill="currentColor"/>
    </svg>
  ),
  l2switch: ({ size = 30 }) => (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
      <rect x="4" y="10" width="22" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" fill="rgba(255,255,255,0.04)"/>
      {/* ports */}
      <rect x="6" y="13" width="2" height="4" fill="currentColor" opacity="0.7"/>
      <rect x="9" y="13" width="2" height="4" fill="currentColor" opacity="0.7"/>
      <rect x="12" y="13" width="2" height="4" fill="currentColor" opacity="0.7"/>
      <rect x="15" y="13" width="2" height="4" fill="currentColor" opacity="0.7"/>
      <rect x="18" y="13" width="2" height="4" fill="currentColor" opacity="0.7"/>
      <rect x="21" y="13" width="2" height="4" fill="currentColor" opacity="0.7"/>
    </svg>
  ),
  l3switch: ({ size = 30 }) => (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
      <rect x="4" y="10" width="22" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" fill="rgba(255,255,255,0.04)"/>
      {/* ports */}
      <rect x="6" y="13" width="2" height="4" fill="currentColor" opacity="0.55"/>
      <rect x="9" y="13" width="2" height="4" fill="currentColor" opacity="0.55"/>
      <rect x="12" y="13" width="2" height="4" fill="currentColor" opacity="0.55"/>
      <rect x="18" y="13" width="2" height="4" fill="currentColor" opacity="0.55"/>
      <rect x="21" y="13" width="2" height="4" fill="currentColor" opacity="0.55"/>
      {/* L3 indicator — small arrows on top */}
      <path d="M14 5l-1.5 2h1v2h1V7h1z" fill="currentColor"/>
      <path d="M16.5 7l1.5-2 1.5 2h-1v2h-1V7z" fill="currentColor"/>
    </svg>
  ),
  pc: ({ size = 30 }) => (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
      <rect x="4" y="6" width="22" height="14" rx="1.2" stroke="currentColor" strokeWidth="1.3" fill="rgba(255,255,255,0.04)"/>
      <path d="M11 20l-1 4M19 20l1 4M9 24h12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <rect x="7" y="9" width="16" height="8" fill="currentColor" opacity="0.08"/>
    </svg>
  ),
  server: ({ size = 30 }) => (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
      <rect x="6" y="5" width="18" height="6" rx="1" stroke="currentColor" strokeWidth="1.3" fill="rgba(255,255,255,0.04)"/>
      <rect x="6" y="12.5" width="18" height="6" rx="1" stroke="currentColor" strokeWidth="1.3" fill="rgba(255,255,255,0.04)"/>
      <rect x="6" y="20" width="18" height="6" rx="1" stroke="currentColor" strokeWidth="1.3" fill="rgba(255,255,255,0.04)"/>
      <circle cx="10" cy="8" r="0.9" fill="currentColor"/>
      <circle cx="10" cy="15.5" r="0.9" fill="currentColor"/>
      <circle cx="10" cy="23" r="0.9" fill="currentColor"/>
      <path d="M14 8h7M14 15.5h7M14 23h7" stroke="currentColor" strokeWidth="0.8" opacity="0.55"/>
    </svg>
  ),
  ap: ({ size = 30 }) => (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
      <rect x="6" y="16" width="18" height="6" rx="1" stroke="currentColor" strokeWidth="1.3" fill="rgba(255,255,255,0.04)"/>
      <circle cx="15" cy="19" r="0.9" fill="currentColor"/>
      <path d="M9 11a8 8 0 0 1 12 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <path d="M11.5 13a5 5 0 0 1 7 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="15" cy="6" r="1.2" fill="currentColor"/>
    </svg>
  ),
  cloud: ({ size = 30 }) => (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
      <path d="M9 21h13a4.5 4.5 0 0 0 0.4-8.97A7 7 0 0 0 8.4 11.2 5 5 0 0 0 9 21z"
        stroke="currentColor" strokeWidth="1.3" fill="rgba(255,255,255,0.04)" strokeLinejoin="round"/>
    </svg>
  ),
};
window.Glyph = Glyph;

window.DeviceCatalog = [
  { kind: "router",   label: "ISR4321 Router", short: "ISR", ifaces: ["GigabitEthernet0/0/0","GigabitEthernet0/0/1","Serial0/1/0","Serial0/1/1"], pwr: true, color: "var(--accent)" },
  { kind: "l3switch", label: "Catalyst 9200L L3", short: "C9200L", ifaces: [...Array.from({ length: 24 }, (_, i) => `GigabitEthernet1/0/${i + 1}`), ...Array.from({ length: 4 }, (_, i) => `GigabitEthernet1/1/${i + 1}`)], pwr: true, color: "var(--violet)" },
  { kind: "l2switch", label: "Catalyst 9200L", short: "C9200L", ifaces: [...Array.from({ length: 24 }, (_, i) => `GigabitEthernet1/0/${i + 1}`), ...Array.from({ length: 4 }, (_, i) => `GigabitEthernet1/1/${i + 1}`)], pwr: true, color: "var(--fg-1)" },
  { kind: "pc",       label: "PC",         short: "PC",  ifaces: ["eth0"], pwr: true, color: "var(--ok)" },
  { kind: "server",   label: "Server",     short: "SRV", ifaces: ["eth0"], pwr: true, color: "var(--magenta)" },
  { kind: "ap",       label: "Wireless AP",short: "AP",  ifaces: ["eth0","wlan0"], pwr: true, color: "var(--accent)" },
  { kind: "cloud",    label: "Cloud",      short: "NET", ifaces: ["wan"], pwr: false, color: "var(--fg-2)" },
];
