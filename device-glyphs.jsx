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
Glyph.laptop = Glyph.pc;
Glyph.printer = Glyph.pc;
Glyph.phone = Glyph.pc;
Glyph.wrt = Glyph.ap;
Glyph.asa = Glyph.router;
Glyph.internet = Glyph.cloud;
Glyph.dslmodem = Glyph.cloud;
Glyph.cablemodem = Glyph.cloud;
window.Glyph = Glyph;

window.DeviceCatalog = [
  { id: "2960-24tt", kind: "l2switch", platform: "2960-24tt", label: "2960-24TT", short: "2960", ifaces: [...Array.from({ length: 24 }, (_, i) => `FastEthernet0/${i + 1}`), "GigabitEthernet0/1", "GigabitEthernet0/2"], pwr: true, color: "var(--fg-1)" },
  { id: "3560-24ps", kind: "l3switch", platform: "3560-24ps", label: "3560-24PS", short: "3560", ifaces: [...Array.from({ length: 24 }, (_, i) => `FastEthernet0/${i + 1}`), "GigabitEthernet0/1", "GigabitEthernet0/2"], pwr: true, color: "var(--violet)" },
  { id: "2911", kind: "router", platform: "2911", label: "2911", short: "2911", ifaces: ["GigabitEthernet0/0","GigabitEthernet0/1","GigabitEthernet0/2","Serial0/0/0","Serial0/0/1","Serial0/1/0","Serial0/1/1"], pwr: true, color: "var(--accent)" },
  { id: "1941", kind: "router", platform: "1941", label: "1941", short: "1941", ifaces: ["GigabitEthernet0/0","GigabitEthernet0/1","Serial0/0/0","Serial0/0/1"], pwr: true, color: "var(--accent)" },
  { id: "isr4321", kind: "router", platform: "isr4321", label: "ISR4321", short: "4321", ifaces: ["GigabitEthernet0/0/0","GigabitEthernet0/0/1","Serial0/1/0","Serial0/1/1"], pwr: true, color: "var(--accent)" },
  { id: "isr4331", kind: "router", platform: "isr4331", label: "ISR4331", short: "4331", ifaces: ["GigabitEthernet0/0/0","GigabitEthernet0/0/1","GigabitEthernet0/0/2","Serial0/1/0","Serial0/1/1"], pwr: true, color: "var(--accent)" },
  { id: "c9200l", kind: "l2switch", platform: "c9200l", label: "Catalyst 9200L", short: "C9200L", ifaces: [...Array.from({ length: 24 }, (_, i) => `GigabitEthernet1/0/${i + 1}`), ...Array.from({ length: 4 }, (_, i) => `GigabitEthernet1/1/${i + 1}`)], pwr: true, color: "var(--fg-1)" },
  { id: "c9200l-l3", kind: "l3switch", platform: "c9200l", label: "Catalyst 9200L L3", short: "C9200L L3", ifaces: [...Array.from({ length: 24 }, (_, i) => `GigabitEthernet1/0/${i + 1}`), ...Array.from({ length: 4 }, (_, i) => `GigabitEthernet1/1/${i + 1}`)], pwr: true, color: "var(--violet)" },
  { id: "pc", kind: "pc", platform: "genericPc", label: "PC", short: "PC",  ifaces: ["eth0"], pwr: true, color: "var(--ok)" },
  { id: "laptop", kind: "laptop", platform: "laptop", label: "Laptop", short: "Laptop", ifaces: ["eth0", "wlan0"], pwr: true, color: "var(--ok)" },
  { id: "server-pt", kind: "server", platform: "genericServer", label: "Server-PT", short: "Server-PT", ifaces: ["eth0"], pwr: true, color: "var(--magenta)" },
  { id: "wrt300n", kind: "wrt", platform: "wrt300n", label: "WRT300N", short: "WRT300N", ifaces: ["Internet", "Ethernet1", "Ethernet2", "Ethernet3", "Ethernet4", "wlan0"], pwr: true, color: "var(--accent)" },
  { id: "asa5506x", kind: "asa", platform: "asa5506x", label: "ASA 5506-X", short: "5506-X", ifaces: ["GigabitEthernet1/1","GigabitEthernet1/2","GigabitEthernet1/3","GigabitEthernet1/4","GigabitEthernet1/5","GigabitEthernet1/6","GigabitEthernet1/7","GigabitEthernet1/8"], pwr: true, color: "var(--warn)" },
  { id: "printer", kind: "printer", platform: "printer", label: "Printer", short: "Printer", ifaces: ["eth0"], pwr: true, color: "var(--ok)" },
  { id: "ipphone", kind: "phone", platform: "ipphone", label: "IP Phone", short: "IP Phone", ifaces: ["eth0", "pc"], pwr: true, color: "var(--accent)" },
  { id: "ap", kind: "ap", label: "Wireless AP", short: "AP",  ifaces: ["eth0","wlan0"], pwr: true, color: "var(--accent)" },
  { id: "cloudpt", kind: "cloud", platform: "cloudpt", label: "Cloud-PT", short: "Cloud-PT", ifaces: ["eth0", "serial0", "dsl", "coax"], pwr: false, color: "var(--fg-2)" },
  { id: "internet", kind: "internet", platform: "internet", short: "Internet", label: "Internet", ifaces: ["wan"], pwr: true, color: "var(--fg-2)" },
  { id: "dslmodem", kind: "dslmodem", platform: "dslmodem", label: "DSL Modem", short: "DSL", ifaces: ["Ethernet0", "DSL0"], pwr: true, color: "var(--fg-2)" },
  { id: "cablemodem", kind: "cablemodem", platform: "cablemodem", label: "Cable Modem", short: "Cable", ifaces: ["Ethernet0", "Coax0"], pwr: true, color: "var(--fg-2)" },
];
