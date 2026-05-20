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
  mac: ({ size = 30 }) => (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
      <rect x="5" y="5.5" width="20" height="15" rx="2.3" stroke="currentColor" strokeWidth="1.3" fill="rgba(255,255,255,0.04)"/>
      <path d="M10.5 23.5h9M13 20.5l-.8 3M17 20.5l.8 3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <path d="M13 10.2c.7-1.1 1.5-1.6 2.4-1.5-.1 1-.7 1.7-1.7 2.1" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.75"/>
      <path d="M12.6 11.4c-1.7.1-2.4 1.2-2.2 2.8.2 1.7 1.3 3.2 2.4 3 .7-.1 1.1-.5 1.8-.5.7 0 1.1.5 1.8.5 1.2.1 2.3-1.6 2.5-3.1.1-1.2-.5-2.2-1.7-2.6-.7-.3-1.3 0-1.8.1-.6.2-1.1.1-1.7-.1-.3-.1-.7-.2-1.1-.1z" stroke="currentColor" strokeWidth="1.05" strokeLinejoin="round" fill="rgba(255,255,255,0.03)"/>
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
  laptop: ({ size = 30 }) => (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
      <path d="M7 7.5h16v11H7z" stroke="currentColor" strokeWidth="1.3" fill="rgba(255,255,255,0.04)" strokeLinejoin="round"/>
      <rect x="9.5" y="10" width="11" height="6" fill="currentColor" opacity="0.08"/>
      <path d="M5 22l2-3.5h16l2 3.5H5z" stroke="currentColor" strokeWidth="1.3" fill="rgba(255,255,255,0.04)" strokeLinejoin="round"/>
      <path d="M12 20.5h6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.7"/>
    </svg>
  ),
  printer: ({ size = 30 }) => (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
      <path d="M9 5.5h12v6H9z" stroke="currentColor" strokeWidth="1.3" fill="rgba(255,255,255,0.04)" strokeLinejoin="round"/>
      <rect x="6" y="11" width="18" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.3" fill="rgba(255,255,255,0.04)"/>
      <path d="M9 18.5h12v6H9z" stroke="currentColor" strokeWidth="1.3" fill="rgba(255,255,255,0.04)" strokeLinejoin="round"/>
      <circle cx="21" cy="14" r="0.9" fill="currentColor"/>
      <path d="M11 21h8M11 23h6" stroke="currentColor" strokeWidth="0.9" strokeLinecap="round" opacity="0.65"/>
    </svg>
  ),
  phone: ({ size = 30 }) => (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
      <rect x="8" y="5" width="14" height="20" rx="2" stroke="currentColor" strokeWidth="1.3" fill="rgba(255,255,255,0.04)"/>
      <path d="M11 8h8v5h-8z" stroke="currentColor" strokeWidth="1.1" fill="rgba(255,255,255,0.04)" strokeLinejoin="round"/>
      <path d="M11 17h2M15 17h2M19 17h.1M11 20h2M15 20h2M19 20h.1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
      <path d="M9 7c3.5-1.8 8.5-1.8 12 0M10 24c3.2 1.2 6.8 1.2 10 0" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.65"/>
    </svg>
  ),
  ap: ({ size = 30 }) => (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
      <circle cx="15" cy="15" r="6.5" stroke="currentColor" strokeWidth="1.3" fill="rgba(255,255,255,0.04)"/>
      <circle cx="15" cy="15" r="1.4" fill="currentColor"/>
      <path d="M7.5 8.5a11 11 0 0 1 15 0M10.2 11a7.2 7.2 0 0 1 9.6 0M7.5 21.5a11 11 0 0 0 15 0M10.2 19a7.2 7.2 0 0 0 9.6 0" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.75"/>
      <path d="M15 3.5v3M15 23.5v3" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.55"/>
    </svg>
  ),
  wrt: ({ size = 30 }) => (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
      <rect x="6" y="15" width="18" height="7" rx="1.4" stroke="currentColor" strokeWidth="1.3" fill="rgba(255,255,255,0.04)"/>
      <path d="M8 15l-2-8M22 15l2-8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <circle cx="10" cy="18.5" r="0.8" fill="currentColor"/>
      <circle cx="13" cy="18.5" r="0.8" fill="currentColor"/>
      <path d="M17 18.5h4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.65"/>
      <path d="M11.5 10.5a5 5 0 0 1 7 0M13 12.8a3 3 0 0 1 4 0" stroke="currentColor" strokeWidth="1.05" strokeLinecap="round" opacity="0.7"/>
    </svg>
  ),
  asa: ({ size = 30 }) => (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
      <rect x="5" y="9" width="20" height="12" rx="1.6" stroke="currentColor" strokeWidth="1.3" fill="rgba(255,255,255,0.04)"/>
      <path d="M15 6.5l6 2.4v4.7c0 4-2.2 7.1-6 9.9-3.8-2.8-6-5.9-6-9.9V8.9z" stroke="currentColor" strokeWidth="1.15" fill="rgba(255,255,255,0.04)" strokeLinejoin="round"/>
      <path d="M12 15h6M15 12v6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" opacity="0.7"/>
      <path d="M7 12h2M21 12h2M7 18h2M21 18h2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
    </svg>
  ),
  cloud: ({ size = 30 }) => (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
      <path d="M9 21h13a4.5 4.5 0 0 0 0.4-8.97A7 7 0 0 0 8.4 11.2 5 5 0 0 0 9 21z"
        stroke="currentColor" strokeWidth="1.3" fill="rgba(255,255,255,0.04)" strokeLinejoin="round"/>
      <circle cx="12" cy="16.5" r="1" fill="currentColor" opacity="0.75"/>
      <circle cx="16" cy="14" r="1" fill="currentColor" opacity="0.75"/>
      <circle cx="20" cy="17" r="1" fill="currentColor" opacity="0.75"/>
      <path d="M13 16l2.2-1.4M16.9 14.7l2.2 1.5" stroke="currentColor" strokeWidth="0.8" opacity="0.7"/>
    </svg>
  ),
  internet: ({ size = 30 }) => (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
      <circle cx="15" cy="15" r="9" stroke="currentColor" strokeWidth="1.3" fill="rgba(255,255,255,0.04)"/>
      <path d="M6.5 15h17M15 6c2.5 2.5 3.7 5.5 3.7 9S17.5 21.5 15 24M15 6c-2.5 2.5-3.7 5.5-3.7 9S12.5 21.5 15 24M8.8 9.2c3.8 1.4 8.6 1.4 12.4 0M8.8 20.8c3.8-1.4 8.6-1.4 12.4 0" stroke="currentColor" strokeWidth="1.05" strokeLinecap="round"/>
    </svg>
  ),
  dslmodem: ({ size = 30 }) => (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
      <rect x="6" y="13" width="18" height="8" rx="1.4" stroke="currentColor" strokeWidth="1.3" fill="rgba(255,255,255,0.04)"/>
      <path d="M9 13V9.5h4.5L16 7h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="10" cy="17" r="0.8" fill="currentColor"/>
      <circle cx="13" cy="17" r="0.8" fill="currentColor"/>
      <path d="M17 17h4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.65"/>
      <path d="M8 23h14" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.45"/>
    </svg>
  ),
  cablemodem: ({ size = 30 }) => (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none">
      <rect x="6" y="12" width="18" height="9" rx="1.4" stroke="currentColor" strokeWidth="1.3" fill="rgba(255,255,255,0.04)"/>
      <path d="M15 12V8.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
      <circle cx="15" cy="7" r="2.2" stroke="currentColor" strokeWidth="1.2" fill="rgba(255,255,255,0.04)"/>
      <circle cx="10" cy="16.5" r="0.8" fill="currentColor"/>
      <circle cx="13" cy="16.5" r="0.8" fill="currentColor"/>
      <path d="M17 16.5h4M9 23.5h12" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" opacity="0.65"/>
    </svg>
  ),
};
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
  { id: "mac", kind: "mac", platform: "mac", label: "Mac", short: "Mac", ifaces: ["en0", "en1"], pwr: true, color: "var(--azure)" },
  { id: "laptop", kind: "laptop", platform: "laptop", label: "Laptop", short: "Laptop", ifaces: ["eth0", "wlan0"], pwr: true, color: "var(--ok)" },
  { id: "server-pt", kind: "server", platform: "genericServer", label: "Server-PT", short: "Server-PT", ifaces: ["eth0"], pwr: true, color: "var(--magenta)" },
  { id: "wrt300n", kind: "wrt", platform: "wrt300n", label: "WRT300N", short: "WRT300N", ifaces: ["Internet", "Ethernet1", "Ethernet2", "Ethernet3", "Ethernet4", "wlan0"], pwr: true, color: "var(--accent)" },
  { id: "asa5506x", kind: "asa", platform: "asa5506x", label: "ASA 5506-X Firewall", short: "ASA FW", ifaces: ["GigabitEthernet1/1","GigabitEthernet1/2","GigabitEthernet1/3","GigabitEthernet1/4","GigabitEthernet1/5","GigabitEthernet1/6","GigabitEthernet1/7","GigabitEthernet1/8"], pwr: true, color: "var(--warn)" },
  { id: "printer", kind: "printer", platform: "printer", label: "Printer", short: "Printer", ifaces: ["eth0"], pwr: true, color: "var(--ok)" },
  { id: "ipphone", kind: "phone", platform: "ipphone", label: "IP Phone", short: "IP Phone", ifaces: ["eth0", "pc"], pwr: true, color: "var(--accent)" },
  { id: "ap", kind: "ap", label: "Wireless AP", short: "AP",  ifaces: ["eth0","wlan0"], pwr: true, color: "var(--accent)" },
  { id: "cloudpt", kind: "cloud", platform: "cloudpt", label: "Cloud-PT", short: "Cloud-PT", ifaces: ["eth0", "serial0", "dsl", "coax"], pwr: false, color: "var(--fg-2)" },
  { id: "internet", kind: "internet", platform: "internet", short: "Internet", label: "Internet", ifaces: ["wan"], pwr: true, color: "var(--accent)" },
  { id: "dslmodem", kind: "dslmodem", platform: "dslmodem", label: "DSL Modem", short: "DSL", ifaces: ["Ethernet0", "DSL0"], pwr: true, color: "var(--violet)" },
  { id: "cablemodem", kind: "cablemodem", platform: "cablemodem", label: "Cable Modem", short: "Cable", ifaces: ["Ethernet0", "Coax0"], pwr: true, color: "var(--magenta)" },
];
