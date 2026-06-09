// ccnacasino.jsx - static CCNA Casino concept page

const {
  useCallback: useCallbackCasino,
  useEffect: useEffectCasino,
  useMemo: useMemoCasino,
  useRef: useRefCasino,
  useState: useStateCasino,
} = React;

const CASINO_SAVE_TITLE = "CCNA Casino Save";
const GUEST_PROFILE_KEY = "openpt.ccnaCasino.guest.v1";
const PROFILE_KEY_PREFIX = "openpt.ccnaCasino.profile.";
const AUTOSAVE_DELAY_MS = 11500;

const CASINO_GAMES = [
  {
    id: "blackjack",
    name: "Blackjack",
    short: "BJ",
    topic: "Subnet math",
    help: "Original: get close to 21 without busting.",
    ideas: [
      {
        title: "Subnet Blackjack",
        topic: "Subnetting",
        turnInto: "Cards are prefix lengths and host bits; build the closest valid subnet without exceeding the host requirement.",
        prompt: "A branch needs 58 hosts. Hit until your hand reaches the smallest usable subnet that fits it.",
      },
      {
        title: "Wildcard Blackjack",
        topic: "ACLs",
        turnInto: "Cards add wildcard octets; stop when the wildcard matches exactly the intended ACL range.",
        prompt: "Permit 192.168.12.32 through 192.168.12.63 without including the next block.",
      },
      {
        title: "Metric 21",
        topic: "Routing",
        turnInto: "Cards are administrative distance and metric clues; choose whether to hit or stand on the best route.",
        prompt: "Compare connected, static, OSPF, and RIP entries to pick the route that wins the table.",
      },
      {
        title: "TCP Hand Total",
        topic: "Transport",
        turnInto: "Cards are TCP flags and ports; make a legal session sequence without busting the handshake.",
        prompt: "Build SYN, SYN-ACK, ACK, data, FIN in order while avoiding reset and duplicate flags.",
      },
      {
        title: "STP Safe Hand",
        topic: "Switching",
        turnInto: "Cards are bridge priorities, path costs, and port roles; stop when the root and blocked ports are correct.",
        prompt: "Identify the root bridge and avoid adding a loop-causing forwarding card.",
      },
    ],
  },
  {
    id: "roulette",
    name: "Roulette",
    short: "RL",
    topic: "Routing choices",
    help: "Original: bet on color, range, or number before the wheel lands.",
    ideas: [
      {
        title: "Route Table Roulette",
        topic: "Routing",
        turnInto: "Wheel pockets are candidate routes; win by placing chips on longest prefix, best AD, or best metric.",
        prompt: "A packet is headed for 10.14.8.44. Predict which route entry the router will spin into.",
      },
      {
        title: "ACL Verdict Wheel",
        topic: "ACLs",
        turnInto: "Each spin is a packet; bet on permit, deny, implicit deny, or first matching ACE.",
        prompt: "Host 172.16.5.12 tries TCP 443 to a server. Find the first ACE before the wheel stops.",
      },
      {
        title: "VLAN Landing",
        topic: "Switching",
        turnInto: "Wheel colors are VLANs; predict where a tagged, untagged, or native VLAN frame lands.",
        prompt: "A trunk receives an untagged frame on native VLAN 99. Pick the forwarding domain.",
      },
      {
        title: "NAT Pocket",
        topic: "Services",
        turnInto: "Pockets are inside local/global and outside local/global addresses; bet on the translated identity.",
        prompt: "A LAN client browses the web through PAT. Name the inside global after translation.",
      },
      {
        title: "Trouble Ticket Spin",
        topic: "Troubleshooting",
        turnInto: "The wheel reveals a symptom; choose which layer or command family you should inspect first.",
        prompt: "Users can ping gateway but not DNS names. Bet on DNS, routing, ACL, or switchport.",
      },
    ],
  },
  {
    id: "slots",
    name: "Slots",
    short: "SL",
    topic: "Command matching",
    help: "Original: spin reels and line up symbols for a payout.",
    ideas: [
      {
        title: "Command Slots",
        topic: "CLI",
        turnInto: "Reels hold command fragments; line up the correct mode, command, and parameter.",
        prompt: "Match config mode, interface, and IP address syntax for a router interface.",
      },
      {
        title: "Subnet Symbols",
        topic: "Subnetting",
        turnInto: "Reels show IP, mask, network, broadcast, and usable range; payouts require a consistent set.",
        prompt: "Spin until 192.168.4.71, /26, network, broadcast, and host range all agree.",
      },
      {
        title: "OSPF Triple",
        topic: "Routing",
        turnInto: "Line up router ID, network statement, wildcard, and area to activate the correct interfaces.",
        prompt: "Make an OSPF row that advertises 10.1.1.0/24 in area 0 without overmatching.",
      },
      {
        title: "Security Combo",
        topic: "Security",
        turnInto: "Symbols are switch hardening controls; win on valid port security, BPDU Guard, and unused port shutdown sets.",
        prompt: "Build a secure access port configuration without accidentally trunking it.",
      },
      {
        title: "IPv6 Reel",
        topic: "IPv6",
        turnInto: "Reels combine global unicast, link-local, prefix length, and default gateway behavior.",
        prompt: "Identify which IPv6 values belong on host, router, and neighbor discovery.",
      },
    ],
  },
  {
    id: "holdem",
    name: "Hold Em",
    short: "HE",
    topic: "Troubleshooting hands",
    help: "Original: make the best five-card hand from private cards and board cards.",
    ideas: [
      {
        title: "Troubleshooting Hold Em",
        topic: "Troubleshooting",
        turnInto: "Private cards are symptoms; board cards are show-command outputs; best hand is the root cause.",
        prompt: "Your cards say intermittent access and one VLAN affected. The board shows trunk pruning.",
      },
      {
        title: "ACL Poker",
        topic: "ACLs",
        turnInto: "Build the strongest ordered ACL hand by combining source, destination, protocol, and port cards.",
        prompt: "Make the smallest ACE set that blocks guest SSH but allows guest HTTPS.",
      },
      {
        title: "Route Showdown",
        topic: "Routing",
        turnInto: "Players reveal route sources; the winner is determined by longest match, AD, then metric.",
        prompt: "Choose whether OSPF, static, floating static, or connected wins for the destination.",
      },
      {
        title: "Wireless Table",
        topic: "Wireless",
        turnInto: "Cards are SSID, authentication, encryption, channel, and signal facts; best hand fixes the client.",
        prompt: "A client sees the SSID but cannot join. Pair the right auth and key mismatch evidence.",
      },
      {
        title: "EtherChannel Draw",
        topic: "Switching",
        turnInto: "Hole cards are local mode; board cards are neighbor mode; best hand forms or breaks the bundle.",
        prompt: "Active/passive, desirable/auto, and on/on combinations fight for the pot.",
      },
    ],
  },
  {
    id: "dice",
    name: "Dice",
    short: "DC",
    topic: "Thresholds",
    help: "Original: roll over or under a target.",
    ideas: [
      {
        title: "Usable Host Dice",
        topic: "Subnetting",
        turnInto: "Set a target host count, then roll prefixes to decide if the subnet is over or under capacity.",
        prompt: "Does /27 roll over the host requirement for 29 devices?",
      },
      {
        title: "Administrative Distance Dice",
        topic: "Routing",
        turnInto: "Lower rolls win; compare route sources by AD and catch floating static routes.",
        prompt: "Roll connected, static, OSPF, and EIGRP values to pick the installed route.",
      },
      {
        title: "MTU Dice",
        topic: "Troubleshooting",
        turnInto: "Roll packet sizes against MTU thresholds and decide whether fragmentation or drops occur.",
        prompt: "A 1518-byte frame meets a 1500 MTU path with DF set. Call the result.",
      },
      {
        title: "Latency Dice",
        topic: "WAN",
        turnInto: "Set acceptable latency and jitter thresholds, then diagnose whether the path passes QoS targets.",
        prompt: "Voice traffic rolls 142 ms latency and 34 ms jitter. Decide if it is healthy.",
      },
      {
        title: "Mask Dice",
        topic: "Subnetting",
        turnInto: "Roll dotted masks and decide if they are valid, contiguous, and aligned with the prefix.",
        prompt: "Roll 255.255.255.192 and identify prefix, block size, and usable hosts.",
      },
    ],
  },
  {
    id: "keno",
    name: "Keno",
    short: "KN",
    topic: "Pick sets",
    help: "Original: pick numbers and match the draw.",
    ideas: [
      {
        title: "Host Range Keno",
        topic: "Subnetting",
        turnInto: "Pick usable host numbers from a subnet board; hits are valid hosts, misses are network or broadcast.",
        prompt: "For 192.168.50.64/27, pick ten valid host addresses.",
      },
      {
        title: "OSPF Network Keno",
        topic: "Routing",
        turnInto: "Pick interfaces that a network statement will activate.",
        prompt: "Given 10.10.4.0 0.0.3.255 area 0, mark every matching interface.",
      },
      {
        title: "ACL Line Keno",
        topic: "ACLs",
        turnInto: "Pick the ACE numbers that match a packet before the draw reaches implicit deny.",
        prompt: "A packet moves through lines 10, 20, 30, and 40. Pick where it stops.",
      },
      {
        title: "Trunk Allowed Keno",
        topic: "Switching",
        turnInto: "Pick VLAN IDs allowed across a trunk and reveal which ones actually pass.",
        prompt: "Allowed list 10,20,30-35 meets traffic for VLANs 1,10,32,40,99.",
      },
      {
        title: "DHCP Pool Keno",
        topic: "Services",
        turnInto: "Pick addresses a DHCP server can lease after exclusions and reservations.",
        prompt: "A /24 excludes .1-.20 and reserves .50. Pick legal leases.",
      },
    ],
  },
  {
    id: "mines",
    name: "Mines",
    short: "MN",
    topic: "Risk spotting",
    help: "Original: reveal safe tiles and avoid hidden mines.",
    ideas: [
      {
        title: "Misconfig Mines",
        topic: "Troubleshooting",
        turnInto: "Tiles are config lines; safe tiles are correct, mines are subtle outage-causing mistakes.",
        prompt: "Reveal interface commands while avoiding wrong masks, shutdown state, or bad gateways.",
      },
      {
        title: "Implicit Deny Mines",
        topic: "ACLs",
        turnInto: "Reveal traffic flows; mines are flows blocked by missing final permits.",
        prompt: "Find the permitted flows in a standard ACL without stepping on implicit deny.",
      },
      {
        title: "Overlap Mines",
        topic: "Subnetting",
        turnInto: "Tiles are subnets in a plan; mines are overlapping or misaligned networks.",
        prompt: "Build a branch addressing plan and avoid two networks sharing addresses.",
      },
      {
        title: "Native VLAN Mines",
        topic: "Switching",
        turnInto: "Reveal trunk facts; mines are native VLAN mismatches and accidental access links.",
        prompt: "Find safe trunk pairs before a native VLAN mismatch creates trouble.",
      },
      {
        title: "Rogue DHCP Mines",
        topic: "Security",
        turnInto: "Tiles are access ports; mines are rogue DHCP, ARP spoofing, or untrusted uplinks.",
        prompt: "Enable DHCP snooping trust only where it belongs.",
      },
    ],
  },
  {
    id: "chicken",
    name: "Chicken",
    short: "CK",
    topic: "Step-by-step labs",
    help: "Original: take one more step or cash out before busting.",
    ideas: [
      {
        title: "CLI Chicken",
        topic: "CLI",
        turnInto: "Each step is another config command; cash out when the feature works before a risky command breaks it.",
        prompt: "Configure SSH: hostname, domain, user, keys, vty transport, login local.",
      },
      {
        title: "Routing Hop Chicken",
        topic: "Routing",
        turnInto: "Walk hop by hop through a path; each step reveals a next-hop decision.",
        prompt: "Trace traffic from PC-A to Server-B and stop before the missing return route.",
      },
      {
        title: "OSPF Neighbor Chicken",
        topic: "Routing",
        turnInto: "Each step checks a neighbor requirement; one wrong network type or area busts the run.",
        prompt: "Verify area, timers, authentication, network type, and MTU.",
      },
      {
        title: "NAT Translation Chicken",
        topic: "Services",
        turnInto: "Step through inside local, ACL match, pool/PAT, and return translation.",
        prompt: "Follow one web request through NAT and cash out when the table is valid.",
      },
      {
        title: "Switch Hardening Chicken",
        topic: "Security",
        turnInto: "Add hardening controls one by one without locking out legitimate access.",
        prompt: "Port security, storm control, BPDU Guard, unused ports, and management ACLs.",
      },
    ],
  },
  {
    id: "path",
    name: "Path",
    short: "PT",
    topic: "Decision trees",
    help: "Original: choose the safe branch each round.",
    ideas: [
      {
        title: "Packet Path",
        topic: "Routing",
        turnInto: "Choose the next device or interface at each hop until the packet reaches the destination.",
        prompt: "A packet leaves VLAN 20 for a remote server. Pick each routed hop.",
      },
      {
        title: "ACL Decision Path",
        topic: "ACLs",
        turnInto: "Branch through ACE order, protocol, source, destination, and port until the verdict is clear.",
        prompt: "Decide whether TCP 22 from guest to admin server is permitted.",
      },
      {
        title: "Borrow Bits Path",
        topic: "Subnetting",
        turnInto: "Choose how many host bits to borrow for each requirement without wasting the address block.",
        prompt: "Split 10.8.0.0/24 into LANs needing 100, 50, 25, and 10 hosts.",
      },
      {
        title: "EtherChannel Path",
        topic: "Switching",
        turnInto: "Choose mode pairs and consistency checks that lead to a bundled port-channel.",
        prompt: "Pick compatible LACP/PAgP/static choices and avoid suspended links.",
      },
      {
        title: "IPv6 Path",
        topic: "IPv6",
        turnInto: "Follow SLAAC, DHCPv6, link-local gateways, and neighbor discovery decisions.",
        prompt: "A host has a GUA but no default route. Pick the missing step.",
      },
    ],
  },
  {
    id: "gridslots",
    name: "5x5 Slots",
    short: "GS",
    topic: "Pattern grids",
    help: "Original: spin a 5x5 grid and chase clustered wins.",
    ideas: [
      {
        title: "Topology Grid Slots",
        topic: "Troubleshooting",
        turnInto: "Rows are layers; clusters reveal whether the fault is physical, VLAN, IP, route, or service.",
        prompt: "Spin show-command clues and score clusters that point to one layer.",
      },
      {
        title: "Subnet Grid",
        topic: "Subnetting",
        turnInto: "Grid cells are network, first host, last host, broadcast, and mask values.",
        prompt: "Align an entire row for 172.16.12.128/26.",
      },
      {
        title: "OSI Grid",
        topic: "Fundamentals",
        turnInto: "Match protocols, devices, PDUs, addresses, and troubleshooting commands by OSI layer.",
        prompt: "Cluster Ethernet, MAC, switch, frame, and show mac address-table.",
      },
      {
        title: "Port-Channel Grid",
        topic: "Switching",
        turnInto: "Cells include speed, duplex, trunking, native VLAN, and mode consistency.",
        prompt: "Score a bundle only when all five columns agree.",
      },
      {
        title: "Wireless Grid",
        topic: "Wireless",
        turnInto: "Match SSID, band, channel, security, and roaming clue sets.",
        prompt: "Identify why one client roams badly while another stays stable.",
      },
    ],
  },
  {
    id: "plinko",
    name: "Plinko",
    short: "PL",
    topic: "Packet flow",
    help: "Original: drop a ball through pegs into a multiplier slot.",
    ideas: [
      {
        title: "Packet Plinko",
        topic: "Routing",
        turnInto: "A packet drops through L2, ARP, routing, ACL, NAT, and return-path pegs.",
        prompt: "Watch where the packet bounces when ARP is missing or the default gateway is wrong.",
      },
      {
        title: "PAT Plinko",
        topic: "Services",
        turnInto: "Pegs are NAT rules; landing slots are inside global ports.",
        prompt: "Follow two clients using PAT and predict their translated source ports.",
      },
      {
        title: "Route Selection Plinko",
        topic: "Routing",
        turnInto: "Each peg is prefix length, AD, or metric; the ball lands on the installed route.",
        prompt: "Drop the destination IP and explain why it landed on a /27 over a /24.",
      },
      {
        title: "QoS Queue Plinko",
        topic: "WAN",
        turnInto: "Pegs classify traffic into voice, video, best effort, or scavenger queues.",
        prompt: "Drop DSCP-marked packets and predict queue treatment.",
      },
      {
        title: "DNS Trace Plinko",
        topic: "Services",
        turnInto: "The ball passes cache, recursive resolver, root, TLD, and authoritative answers.",
        prompt: "Find where DNS fails when ping by IP works but names do not.",
      },
    ],
  },
  {
    id: "crash",
    name: "Crash",
    short: "CR",
    topic: "Timing failures",
    help: "Original: cash out before the multiplier crashes.",
    ideas: [
      {
        title: "Convergence Crash",
        topic: "Routing",
        turnInto: "The multiplier rises while the topology converges; cash out before a bad timer or route flap.",
        prompt: "Watch OSPF adjacency states and identify the failing timer before the graph crashes.",
      },
      {
        title: "STP Crash",
        topic: "Switching",
        turnInto: "The graph climbs during STP convergence; a loop, wrong root, or BPDU filter causes the crash.",
        prompt: "Pick when to intervene as blocked ports move through listening and learning.",
      },
      {
        title: "DHCP Lease Crash",
        topic: "Services",
        turnInto: "Leases tick down; renew before clients lose addressing.",
        prompt: "Identify whether the lease, helper address, or pool exhaustion is about to fail.",
      },
      {
        title: "Congestion Crash",
        topic: "WAN",
        turnInto: "Traffic load climbs; cash out when QoS or bandwidth planning still keeps apps healthy.",
        prompt: "Predict when voice quality fails as best-effort traffic ramps up.",
      },
      {
        title: "Security Incident Crash",
        topic: "Security",
        turnInto: "Suspicious events stack up; stop the run by choosing the best containment action.",
        prompt: "Port scans, login failures, and rogue DHCP appear. Decide what to shut down first.",
      },
    ],
  },
  {
    id: "limbo",
    name: "Limbo",
    short: "LM",
    topic: "Target difficulty",
    help: "Original: set a target multiplier and hope the roll beats it.",
    ideas: [
      {
        title: "Summarization Limbo",
        topic: "Routing",
        turnInto: "Set the smallest summary target you dare; win only if it covers required routes without extras.",
        prompt: "Summarize four /24 networks while avoiding a neighboring department.",
      },
      {
        title: "Wildcard Limbo",
        topic: "ACLs",
        turnInto: "Set an aggressive wildcard target and test whether it matches only the intended hosts.",
        prompt: "Can one wildcard match 10.10.8.0 through 10.10.15.255?",
      },
      {
        title: "Prefix Limbo",
        topic: "Subnetting",
        turnInto: "Choose the tightest prefix that clears host requirements with minimum waste.",
        prompt: "Pick a prefix for 120 hosts without dropping below the bar.",
      },
      {
        title: "Ping Sweep Limbo",
        topic: "Troubleshooting",
        turnInto: "Set the fewest tests needed to prove gateway, DNS, route, and remote service health.",
        prompt: "Beat the target by diagnosing reachability in under five commands.",
      },
      {
        title: "Risk Limbo",
        topic: "Security",
        turnInto: "Set a hardening target; score higher for fewer commands that still close the exposure.",
        prompt: "Secure a management plane without blocking legitimate admin access.",
      },
    ],
  },
];

const BADGE_DEFS = [
  { id: "subnet", label: "Subnet Scout", match: /subnet|prefix|wildcard|host/i },
  { id: "routing", label: "Route Reader", match: /route|routing|ospf|eigrp|convergence/i },
  { id: "acl", label: "ACL Auditor", match: /acl|ace|permit|deny/i },
  { id: "switching", label: "Switch Surgeon", match: /vlan|stp|trunk|etherchannel|switch/i },
  { id: "services", label: "Services Sleuth", match: /dhcp|dns|nat|pat|services/i },
  { id: "trouble", label: "Ticket Closer", match: /troubleshooting|fault|symptom|diagnos/i },
];

function safeJsonParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch (err) {
    return fallback;
  }
}

function safeStorageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (err) {
    return null;
  }
}

function safeStorageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    return false;
  }
}

function storageKeyForUser(user) {
  return user?.id ? `${PROFILE_KEY_PREFIX}${user.id}.v1` : GUEST_PROFILE_KEY;
}

function nowIsoCasino() {
  return new Date().toISOString();
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(Math.max(0, Math.round(Number(value || 0))));
}

function formatSessionTime(value) {
  const date = new Date(value || 0);
  if (Number.isNaN(date.getTime())) return "unknown";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function makeDefaultProfile(user = null) {
  const label = user?.email ? user.email.split("@")[0] : "Guest learner";
  return {
    kind: "ccna-casino-profile",
    version: 1,
    displayName: label,
    balance: 1000,
    xp: 0,
    rounds: 0,
    wins: 0,
    streak: 0,
    bestStreak: 0,
    selectedGameId: "blackjack",
    selectedIdeaIndex: 0,
    ideaCompletions: {},
    history: [],
    createdAt: nowIsoCasino(),
    updatedAt: nowIsoCasino(),
  };
}

function normalizeProfile(profile, user = null) {
  const base = makeDefaultProfile(user);
  const next = profile && typeof profile === "object" ? { ...base, ...profile } : base;
  next.kind = "ccna-casino-profile";
  next.version = 1;
  next.displayName = String(next.displayName || base.displayName).slice(0, 40);
  next.balance = Math.max(0, Math.round(Number(next.balance || 0)));
  next.xp = Math.max(0, Math.round(Number(next.xp || 0)));
  next.rounds = Math.max(0, Math.round(Number(next.rounds || 0)));
  next.wins = Math.max(0, Math.round(Number(next.wins || 0)));
  next.streak = Math.max(0, Math.round(Number(next.streak || 0)));
  next.bestStreak = Math.max(next.streak, Math.round(Number(next.bestStreak || 0)));
  next.ideaCompletions = next.ideaCompletions && typeof next.ideaCompletions === "object" ? next.ideaCompletions : {};
  next.history = Array.isArray(next.history) ? next.history.slice(0, 18) : [];
  next.updatedAt = next.updatedAt || nowIsoCasino();
  return next;
}

function loadLocalProfile(user = null) {
  return normalizeProfile(safeJsonParse(safeStorageGet(storageKeyForUser(user)), null), user);
}

function persistLocalProfile(profile, user = null) {
  safeStorageSet(storageKeyForUser(user), JSON.stringify(normalizeProfile(profile, user)));
}

function levelForXp(xp) {
  return Math.floor(Number(xp || 0) / 250) + 1;
}

function winRate(profile) {
  if (!profile.rounds) return 0;
  return Math.round((profile.wins / profile.rounds) * 100);
}

function completionKey(gameId, ideaIndex) {
  return `${gameId}:${ideaIndex}`;
}

function makeCasinoDocument(profile) {
  return {
    schemaVersion: 1,
    title: CASINO_SAVE_TITLE,
    devices: {},
    links: [],
    uiState: {},
    metadata: {
      kind: "ccna-casino-save",
      ccnaCasino: normalizeProfile(profile),
    },
  };
}

function topicMastery(profile) {
  const text = (profile.history || []).map((entry) => `${entry.topic} ${entry.title}`).join(" ");
  return BADGE_DEFS.map((badge) => ({ ...badge, active: badge.match.test(text) }));
}

function chooseOutcome(profile, idea, stake) {
  const experience = Math.min(20, Math.floor(Number(profile.xp || 0) / 180));
  const baseScore = 58 + Math.floor(Math.random() * 36) + Math.floor(stake / 60) + Math.floor(experience / 2);
  const score = Math.max(42, Math.min(100, baseScore));
  const won = score >= 72;
  const reward = won ? Math.round(stake * (1.1 + score / 140)) : Math.max(8, Math.round(stake * 0.18));
  const xp = won ? 38 + Math.floor(score / 6) : 16 + Math.floor(score / 12);
  return {
    won,
    score,
    reward,
    xp,
    feedback: won
      ? `Clean run. You converted ${idea.topic.toLowerCase()} into a playable study loop and banked the drill.`
      : `Needs one more pass. The idea is good, but this round exposed a weak spot in ${idea.topic.toLowerCase()}.`,
  };
}

function CasinoIcon({ name }) {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      {name === "sync" ? (
        <path d="M20 6v5h-5M4 18v-5h5M6.5 8.5A6.7 6.7 0 0 1 18.3 7L20 11M17.5 15.5A6.7 6.7 0 0 1 5.7 17L4 13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      ) : name === "user" ? (
        <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm7 8a7 7 0 0 0-14 0" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      ) : name === "close" ? (
        <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      ) : (
        <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

function AccountDialog({
  syncClient,
  user,
  initial,
  cloudStatus,
  onClose,
  onSignedIn,
  onSignedOut,
  onAccountDeleted,
  onToast,
}) {
  const [mode, setMode] = useStateCasino(initial?.mode || (user ? "account" : "login"));
  const [token, setToken] = useStateCasino(initial?.token || "");
  const [email, setEmail] = useStateCasino(user?.email || "");
  const [password, setPassword] = useStateCasino("");
  const [newPassword, setNewPassword] = useStateCasino("");
  const [deletePassword, setDeletePassword] = useStateCasino("");
  const [company, setCompany] = useStateCasino("");
  const [startedAt] = useStateCasino(Date.now());
  const [error, setError] = useStateCasino("");
  const [status, setStatus] = useStateCasino("");
  const [debugLink, setDebugLink] = useStateCasino("");
  const [sessions, setSessions] = useStateCasino([]);
  const [submitting, setSubmitting] = useStateCasino(false);

  useEffectCasino(() => {
    setMode(initial?.mode || (user ? "account" : "login"));
    setToken(initial?.token || "");
    if (user?.email) setEmail(user.email);
  }, [initial?.mode, initial?.token, user?.email]);

  const clearMessages = () => {
    setError("");
    setStatus("");
    setDebugLink("");
  };

  const captureDebugLink = (data) => {
    const link = data?.verification?.link || data?.reset?.link || "";
    if (link) setDebugLink(link);
  };

  const loadSessions = useCallbackCasino(async () => {
    if (!syncClient || !user) return;
    const data = await syncClient.listSessions();
    setSessions(data.sessions || []);
  }, [syncClient, user]);

  useEffectCasino(() => {
    if (mode === "account" && user) loadSessions().catch(() => {});
  }, [mode, user, loadSessions]);

  const submit = async (event) => {
    event.preventDefault();
    if (!syncClient || submitting) return;
    clearMessages();
    setSubmitting(true);
    try {
      if (mode === "login") {
        const data = await syncClient.login(email, password);
        onSignedIn(data.user);
        onToast("Signed in. Loading your CCNA Casino save.");
      } else if (mode === "register") {
        const data = await syncClient.register(email, password, { company, startedAt });
        captureDebugLink(data);
        setStatus(`Verification sent to ${data.email || email}.`);
        setMode("verify-sent");
      } else if (mode === "verify") {
        await syncClient.verifyEmail(token);
        setStatus("Email verified. You can sign in now.");
        setMode("login");
      } else if (mode === "forgot") {
        const data = await syncClient.forgotPassword(email);
        captureDebugLink(data);
        setStatus("If that email exists, a reset link was sent.");
        setMode("reset-sent");
      } else if (mode === "reset") {
        await syncClient.resetPassword(token, newPassword);
        setStatus("Password reset. You can sign in now.");
        setMode("login");
      } else if (mode === "restore") {
        const data = await syncClient.cancelAccountDeletion(email, password);
        onSignedIn(data.user);
      }
    } catch (err) {
      if (err.data?.code === "EMAIL_NOT_VERIFIED") {
        setEmail(err.data.email || email);
        setMode("verify-sent");
        setError("Verify your email before signing in.");
      } else if (err.data?.code === "ACCOUNT_DELETION_PENDING") {
        setEmail(err.data.email || email);
        setMode("restore");
        setError(`This account is scheduled for deletion on ${formatSessionTime(err.data.deletionScheduledAt)}.`);
      } else {
        setError(err.message || "Account request failed.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resendVerification = async () => {
    clearMessages();
    setSubmitting(true);
    try {
      const data = await syncClient.resendVerification(email);
      captureDebugLink(data);
      setStatus("Verification email sent.");
    } catch (err) {
      setError(err.message || "Could not resend verification.");
    } finally {
      setSubmitting(false);
    }
  };

  const revokeSession = async (session) => {
    setSubmitting(true);
    try {
      const result = await syncClient.revokeSession(session.id);
      if (result.currentRevoked) {
        await onSignedOut();
      } else {
        await loadSessions();
      }
    } catch (err) {
      setError(err.message || "Could not revoke session.");
    } finally {
      setSubmitting(false);
    }
  };

  const revokeOthers = async () => {
    setSubmitting(true);
    try {
      await syncClient.revokeOtherSessions();
      await loadSessions();
      setStatus("Other sessions signed out.");
    } catch (err) {
      setError(err.message || "Could not revoke sessions.");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteAccount = async (event) => {
    event.preventDefault();
    clearMessages();
    setSubmitting(true);
    try {
      const deletion = await syncClient.deleteAccount(deletePassword);
      onAccountDeleted(deletion);
    } catch (err) {
      setError(err.message || "Could not schedule deletion.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="casino-account-title">
      <div className="account-modal">
        <div className="modal-head">
          <h2 id="casino-account-title">OpenPT account</h2>
          <button className="casino-icon-button" type="button" onClick={onClose} aria-label="Close account dialog">
            <CasinoIcon name="close" />
          </button>
        </div>
        <div className="modal-body">
          {!user && !["verify", "reset", "restore"].includes(mode) ? (
            <div className="segmented">
              <button type="button" disabled={submitting} className={mode === "login" ? "active" : ""} onClick={() => { clearMessages(); setMode("login"); }}>Sign in</button>
              <button type="button" disabled={submitting} className={mode === "register" ? "active" : ""} onClick={() => { clearMessages(); setMode("register"); }}>Create account</button>
            </div>
          ) : null}

          {user && mode === "account" ? (
            <>
              <div className="account-summary">
                <span className="metric-label">Signed in</span>
                <strong>{user.email}</strong>
                <p className="mini-copy">{cloudStatus}</p>
              </div>
              <div className="round-actions">
                <button className="casino-button" type="button" disabled={submitting} onClick={onSignedOut}>Logout</button>
                <button className="casino-button" type="button" disabled={submitting} onClick={() => { setEmail(user.email); setMode("forgot"); }}>Reset password</button>
                <button className="casino-button" type="button" disabled={submitting} onClick={revokeOthers}>Sign out other sessions</button>
                <button className="casino-button" type="button" disabled={submitting} onClick={() => loadSessions().catch(() => {})}>Refresh sessions</button>
              </div>
              <div className="session-list">
                {!sessions.length ? <div className="message">No active sessions.</div> : null}
                {sessions.map((session) => (
                  <div key={session.id} className={`session-row ${session.current ? "current" : ""}`}>
                    <div>
                      <strong>{session.clientLabel}{session.current ? " (current)" : ""}</strong>
                      <small>{formatSessionTime(session.lastSeenAt)}; expires {formatSessionTime(session.expiresAt)}</small>
                    </div>
                    <button className="casino-button" type="button" disabled={submitting} onClick={() => revokeSession(session)}>Revoke</button>
                  </div>
                ))}
              </div>
              <form className="danger-zone" onSubmit={deleteAccount}>
                <div>
                  <strong>Delete account</strong>
                  <p className="mini-copy">Deletion is scheduled for 14 days and can be canceled by signing in during the grace period.</p>
                </div>
                <div className="field">
                  <label>Password</label>
                  <input value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} type="password" required disabled={submitting} />
                </div>
                <button className="casino-button warning" type="submit" disabled={submitting || !deletePassword}>Schedule deletion</button>
              </form>
            </>
          ) : (
            <form className="account-form" onSubmit={submit}>
              {(mode === "login" || mode === "register" || mode === "forgot" || mode === "restore") ? (
                <div className="field">
                  <label>Email</label>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required disabled={submitting} />
                </div>
              ) : null}
              {(mode === "login" || mode === "register" || mode === "restore") ? (
                <div className="field">
                  <label>Password</label>
                  <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" minLength="8" required disabled={submitting} />
                </div>
              ) : null}
              {mode === "register" ? (
                <label className="hp-field">Company<input value={company} onChange={(e) => setCompany(e.target.value)} tabIndex="-1" autoComplete="off" /></label>
              ) : null}
              {(mode === "verify" || mode === "reset") ? (
                <div className="field">
                  <label>Token</label>
                  <input value={token} onChange={(e) => setToken(e.target.value)} required disabled={submitting} />
                </div>
              ) : null}
              {mode === "reset" ? (
                <div className="field">
                  <label>New password</label>
                  <input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} type="password" minLength="8" required disabled={submitting} />
                </div>
              ) : null}
              {mode === "verify-sent" ? <div className="message">Check your inbox for the verification link.</div> : null}
              {mode === "reset-sent" ? <div className="message">Check your inbox for the password reset link.</div> : null}
              {error ? <div className="message bad">{error}</div> : null}
              {status ? <div className="message good">{status}</div> : null}
              {debugLink ? <div className="debug-link"><a href={debugLink}>{debugLink}</a></div> : null}
              <div className="round-actions">
                {mode === "verify-sent" ? (
                  <>
                    <button className="casino-button primary" type="button" disabled={submitting || !email} onClick={resendVerification}>{submitting ? "Working..." : "Resend verification"}</button>
                    <button className="casino-button" type="button" onClick={() => { clearMessages(); setMode("login"); }}>Back to sign in</button>
                  </>
                ) : mode === "reset-sent" ? (
                  <>
                    <button className="casino-button primary" type="button" onClick={() => { clearMessages(); setMode("reset"); }}>Enter reset token</button>
                    <button className="casino-button" type="button" onClick={() => { clearMessages(); setMode("login"); }}>Back to sign in</button>
                  </>
                ) : (
                  <button className="casino-button primary" type="submit" disabled={submitting}>
                    {submitting ? "Working..." : mode === "register" ? "Create account" : mode === "forgot" ? "Send reset link" : mode === "verify" ? "Verify email" : mode === "reset" ? "Reset password" : mode === "restore" ? "Cancel deletion" : "Sign in"}
                  </button>
                )}
                {mode === "login" ? <button className="casino-button" type="button" onClick={() => { clearMessages(); setMode("forgot"); }}>Forgot password</button> : null}
                {mode === "forgot" ? <button className="casino-button" type="button" onClick={() => { clearMessages(); setMode("login"); }}>Back to sign in</button> : null}
                {mode === "verify-sent" ? <button className="casino-button" type="button" onClick={() => { clearMessages(); setMode("verify"); }}>Enter token</button> : null}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function ToastStack({ toasts }) {
  return (
    <div className="toast-stack" aria-live="polite">
      {toasts.map((toast) => <div className="toast" key={toast.id}>{toast.message}</div>)}
    </div>
  );
}

function CCNACasinoPage() {
  const syncClientRef = useRefCasino(null);
  const cloudRef = useRefCasino({ projectId: "", version: 0, ready: false });
  const autosaveRef = useRefCasino(null);
  const [user, setUser] = useStateCasino(null);
  const [profile, setProfile] = useStateCasino(() => loadLocalProfile(null));
  const [accountOpen, setAccountOpen] = useStateCasino(false);
  const [accountInitial, setAccountInitial] = useStateCasino(null);
  const [cloudStatus, setCloudStatus] = useStateCasino("Guest progress saves in this browser.");
  const [selectedGameId, setSelectedGameId] = useStateCasino(profile.selectedGameId || "blackjack");
  const [selectedIdeaIndex, setSelectedIdeaIndex] = useStateCasino(profile.selectedIdeaIndex || 0);
  const [stake, setStake] = useStateCasino(50);
  const [lastResult, setLastResult] = useStateCasino(null);
  const [toasts, setToasts] = useStateCasino([]);

  const selectedGame = useMemoCasino(() => CASINO_GAMES.find((game) => game.id === selectedGameId) || CASINO_GAMES[0], [selectedGameId]);
  const selectedIdea = selectedGame.ideas[selectedIdeaIndex] || selectedGame.ideas[0];
  const badges = useMemoCasino(() => topicMastery(profile), [profile]);
  const completedIdeas = Object.keys(profile.ideaCompletions || {}).length;
  const syncClient = syncClientRef.current;

  const showToast = useCallbackCasino((message) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    setToasts((items) => [...items.slice(-2), { id, message }]);
    setTimeout(() => {
      setToasts((items) => items.filter((item) => item.id !== id));
    }, 3200);
  }, []);

  const saveCloudProfile = useCallbackCasino(async (profileToSave, options = {}) => {
    if (!syncClientRef.current || !user) return;
    const meta = cloudRef.current;
    if (!meta.projectId) return;
    setCloudStatus(options.manual ? "Syncing CCNA Casino save..." : "Autosaving CCNA Casino progress...");
    try {
      const leaseData = await syncClientRef.current.acquireLease(meta.projectId, true);
      const leaseId = leaseData?.lease?.id;
      const result = await syncClientRef.current.savePatch(meta.projectId, {
        baseVersion: meta.version,
        leaseId,
        patches: [
          { op: "replace", path: "/metadata/ccnaCasino", value: normalizeProfile(profileToSave, user) },
        ],
      });
      cloudRef.current = { projectId: meta.projectId, version: result.project.version, ready: true };
      setCloudStatus(`Cloud save updated ${formatSessionTime(result.project.updatedAt)}.`);
      if (leaseId) syncClientRef.current.releaseLease(meta.projectId, leaseId).catch(() => {});
    } catch (err) {
      const waiting = err.status === 429 ? "Cloud save is rate-limited; it will retry after the next round." : (err.message || "Cloud save failed.");
      setCloudStatus(waiting);
      if (options.manual) showToast(waiting);
    }
  }, [showToast, user]);

  const scheduleCloudSave = useCallbackCasino((profileToSave) => {
    if (!user || !cloudRef.current.projectId) return;
    if (autosaveRef.current) clearTimeout(autosaveRef.current);
    setCloudStatus("Cloud save pending...");
    autosaveRef.current = setTimeout(() => {
      saveCloudProfile(profileToSave).catch(() => {});
    }, AUTOSAVE_DELAY_MS);
  }, [saveCloudProfile, user]);

  const updateProfile = useCallbackCasino((updater, options = {}) => {
    setProfile((current) => {
      const nextRaw = typeof updater === "function" ? updater(current) : updater;
      const next = normalizeProfile({ ...nextRaw, updatedAt: nowIsoCasino() }, user);
      persistLocalProfile(next, user);
      if (options.cloud !== false) scheduleCloudSave(next);
      return next;
    });
  }, [scheduleCloudSave, user]);

  const ensureCloudSave = useCallbackCasino(async (activeUser, currentProfile) => {
    if (!syncClientRef.current || !activeUser) return;
    const localProfile = normalizeProfile(loadLocalProfile(activeUser), activeUser);
    setCloudStatus("Looking for CCNA Casino cloud save...");
    try {
      const list = await syncClientRef.current.listProjects();
      const existing = (list.projects || []).find((project) => project.title === CASINO_SAVE_TITLE);
      if (existing) {
        const loaded = await syncClientRef.current.loadProject(existing.id);
        const cloudProfile = normalizeProfile(loaded.document?.metadata?.ccnaCasino, activeUser);
        const cloudTime = Date.parse(cloudProfile.updatedAt || "");
        const localTime = Date.parse(localProfile.updatedAt || currentProfile.updatedAt || "");
        const chosen = Number.isFinite(cloudTime) && cloudTime >= localTime ? cloudProfile : localProfile;
        cloudRef.current = { projectId: loaded.project.id, version: loaded.project.version, ready: true };
        setProfile(chosen);
        persistLocalProfile(chosen, activeUser);
        setSelectedGameId(chosen.selectedGameId || "blackjack");
        setSelectedIdeaIndex(chosen.selectedIdeaIndex || 0);
        setCloudStatus(`Cloud save loaded ${formatSessionTime(loaded.project.updatedAt)}.`);
        if (chosen === localProfile) scheduleCloudSave(chosen);
        return;
      }
      const created = await syncClientRef.current.createProject(CASINO_SAVE_TITLE, makeCasinoDocument(currentProfile || localProfile));
      const createdProfile = normalizeProfile(created.document?.metadata?.ccnaCasino || currentProfile || localProfile, activeUser);
      cloudRef.current = { projectId: created.project.id, version: created.project.version, ready: true };
      setProfile(createdProfile);
      persistLocalProfile(createdProfile, activeUser);
      setCloudStatus("Cloud save created for this account.");
    } catch (err) {
      setCloudStatus(err.message || "Cloud save unavailable; using local copy.");
    }
  }, [scheduleCloudSave]);

  useEffectCasino(() => {
    syncClientRef.current = window.OpenPTSync ? new window.OpenPTSync.OpenPTSyncClient() : null;
    const params = new URLSearchParams(window.location.search);
    if (params.has("verifyEmail")) {
      setAccountInitial({ mode: "verify", token: params.get("verifyEmail") || "" });
      setAccountOpen(true);
    } else if (params.has("resetPassword")) {
      setAccountInitial({ mode: "reset", token: params.get("resetPassword") || "" });
      setAccountOpen(true);
    }
    if (!syncClientRef.current) {
      setCloudStatus("Account client unavailable; guest progress saves locally.");
      return;
    }
    syncClientRef.current.me()
      .then((data) => {
        if (data.user) {
          setUser(data.user);
          const localProfile = loadLocalProfile(data.user);
          setProfile(localProfile);
          ensureCloudSave(data.user, localProfile).catch(() => {});
        }
      })
      .catch(() => {
        setCloudStatus("Sign in to sync CCNA Casino progress.");
      });
  }, [ensureCloudSave]);

  useEffectCasino(() => {
    updateProfile((current) => ({
      ...current,
      selectedGameId,
      selectedIdeaIndex,
    }), { cloud: false });
  }, [selectedGameId, selectedIdeaIndex]);

  const signOut = async () => {
    if (syncClientRef.current) {
      await syncClientRef.current.logout().catch(() => {});
    }
    if (autosaveRef.current) clearTimeout(autosaveRef.current);
    setUser(null);
    cloudRef.current = { projectId: "", version: 0, ready: false };
    const guest = loadLocalProfile(null);
    setProfile(guest);
    setSelectedGameId(guest.selectedGameId || "blackjack");
    setSelectedIdeaIndex(guest.selectedIdeaIndex || 0);
    setCloudStatus("Signed out. Guest progress saves in this browser.");
    setAccountOpen(false);
    showToast("Signed out.");
  };

  const signIn = (nextUser) => {
    setUser(nextUser);
    const localProfile = loadLocalProfile(nextUser);
    setProfile(localProfile);
    setSelectedGameId(localProfile.selectedGameId || "blackjack");
    setSelectedIdeaIndex(localProfile.selectedIdeaIndex || 0);
    ensureCloudSave(nextUser, localProfile).catch(() => {});
    setAccountOpen(false);
  };

  const handleAccountDeleted = (deletion) => {
    setUser(null);
    cloudRef.current = { projectId: "", version: 0, ready: false };
    setCloudStatus(`Account deletion scheduled for ${formatSessionTime(deletion.deletionScheduledAt)}.`);
    setAccountOpen(false);
    showToast("Account deletion scheduled.");
  };

  const playRound = () => {
    const safeStake = Math.max(10, Math.min(250, Math.round(Number(stake || 0))));
    if (profile.balance < safeStake) {
      showToast("Not enough study chips for that drill. Lower the stake or reset guest chips.");
      return;
    }
    const outcome = chooseOutcome(profile, selectedIdea, safeStake);
    const key = completionKey(selectedGame.id, selectedIdeaIndex);
    const historyEntry = {
      id: `${Date.now()}-${selectedGame.id}`,
      gameId: selectedGame.id,
      gameName: selectedGame.name,
      title: selectedIdea.title,
      topic: selectedIdea.topic,
      won: outcome.won,
      score: outcome.score,
      reward: outcome.reward,
      xp: outcome.xp,
      playedAt: nowIsoCasino(),
    };
    updateProfile((current) => {
      const balance = Math.max(0, current.balance - safeStake + outcome.reward);
      const streak = outcome.won ? current.streak + 1 : 0;
      return {
        ...current,
        balance,
        xp: current.xp + outcome.xp,
        rounds: current.rounds + 1,
        wins: current.wins + (outcome.won ? 1 : 0),
        streak,
        bestStreak: Math.max(current.bestStreak || 0, streak),
        ideaCompletions: {
          ...(current.ideaCompletions || {}),
          [key]: ((current.ideaCompletions || {})[key] || 0) + 1,
        },
        history: [historyEntry, ...(current.history || [])].slice(0, 18),
      };
    });
    setLastResult({ ...outcome, entry: historyEntry });
  };

  const resetGuestChips = () => {
    updateProfile((current) => ({
      ...current,
      balance: Math.max(current.balance, 1000),
      updatedAt: nowIsoCasino(),
    }));
    showToast("Study chips topped back up.");
  };

  const manualSync = () => {
    if (!user) {
      setAccountInitial({ mode: "login" });
      setAccountOpen(true);
      return;
    }
    if (autosaveRef.current) clearTimeout(autosaveRef.current);
    saveCloudProfile(profile, { manual: true }).catch(() => {});
  };

  return (
    <main className="ccna-casino">
      <header className="casino-topbar">
        <div className="casino-topbar-inner">
          <a className="casino-brand" href="/">
            <span className="casino-mark">CCNA</span>
            <span className="casino-brand-text">
              <strong>OpenPT CCNA Casino</strong>
            </span>
          </a>
          <nav className="casino-top-actions" aria-label="CCNA Casino actions">
            <a className="casino-link" href="/">OpenPT</a>
            <button className="casino-button" type="button" onClick={manualSync}>
              <CasinoIcon name="sync" />
              {user ? "Sync" : "Sign in to sync"}
            </button>
            <button className="casino-button primary" type="button" onClick={() => { setAccountInitial({ mode: user ? "account" : "login" }); setAccountOpen(true); }}>
              <CasinoIcon name="user" />
              {user ? user.email.split("@")[0] : "Account"}
            </button>
          </nav>
        </div>
      </header>

      <div className="casino-shell">
        <section className="casino-hero">
          <div className="casino-hero-main">
            <div className="casino-hero-content">
              <h1>CCNA Casino</h1>
              <div className="casino-hero-actions">
                <a className="casino-button primary" href="#games">Pick a game</a>
                <button className="casino-button" type="button" onClick={resetGuestChips}>Top up study chips</button>
              </div>
            </div>
          </div>

          <aside className="casino-profile-panel casino-panel" aria-label="CCNA Casino account profile">
            <div className="profile-head">
              <div className="profile-avatar">{profile.displayName.slice(0, 2).toUpperCase()}</div>
              <div>
                <h2>{profile.displayName}</h2>
              </div>
            </div>
            <div className="profile-balance">
              <div>
                <span>Study chips</span>
                <strong>{formatNumber(profile.balance)}</strong>
              </div>
              <code>LVL {levelForXp(profile.xp)}</code>
            </div>
            <div className="profile-grid">
              <div className="profile-metric"><span className="metric-label">XP</span><strong>{formatNumber(profile.xp)}</strong></div>
              <div className="profile-metric"><span className="metric-label">Win rate</span><strong>{winRate(profile)}%</strong></div>
              <div className="profile-metric"><span className="metric-label">Streak</span><strong>{profile.streak}</strong></div>
            </div>
            <div className="sync-status">
              <span>{user ? "Cloud save" : "Local save"}</span>
            </div>
          </aside>
        </section>

        <section className="casino-section" id="games">
          <div className="section-head">
            <div>
              <h2>Game Lobby</h2>
            </div>
            <span className="badge active">{completedIdeas} ideas played</span>
          </div>
          <div className="game-grid">
            {CASINO_GAMES.map((game, index) => (
              <button
                key={game.id}
                type="button"
                className={`game-card ${game.id === selectedGame.id ? "active" : ""}`}
                onClick={() => {
                  setSelectedGameId(game.id);
                  setSelectedIdeaIndex(0);
                  document.getElementById("selected-game")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                <div className="game-card-top">
                  <span className="game-icon">{game.short}</span>
                  <span className="game-key">{String(index + 1).padStart(2, "0")}</span>
                </div>
                <h3>{game.name}</h3>
              </button>
            ))}
          </div>
        </section>

        <section className="casino-section detail-grid" id="selected-game">
          <div className="casino-panel">
            <div className="selected-game-head">
              <div className="selected-game-title">
                <span className="game-icon">{selectedGame.short}</span>
                <div>
                  <h2>{selectedGame.name}</h2>
                </div>
              </div>
              <span className="badge active">{selectedGame.topic}</span>
            </div>
            <div className="idea-list">
              {selectedGame.ideas.map((idea, index) => (
                <button
                  key={idea.title}
                  type="button"
                  className={`idea-row ${index === selectedIdeaIndex ? "active" : ""}`}
                  onClick={() => setSelectedIdeaIndex(index)}
                >
                  <span className="idea-number">{index + 1}</span>
                  <span>
                    <h3>{idea.title}</h3>
                  </span>
                  <span className="idea-topic">{idea.topic}</span>
                </button>
              ))}
            </div>
          </div>

          <aside className="round-card" aria-label="Selected CCNA Casino practice round">
            <div>
              <h2>Round</h2>
            </div>
            <div>
              <h3>{selectedIdea.title}</h3>
              <div className="round-prompt">{selectedIdea.turnInto}</div>
            </div>
            <div className="field">
              <label>Study stake</label>
              <select value={stake} onChange={(event) => setStake(Number(event.target.value))}>
                <option value="25">25 chips - warm-up</option>
                <option value="50">50 chips - normal</option>
                <option value="100">100 chips - exam pace</option>
                <option value="150">150 chips - timed lab</option>
              </select>
            </div>
            <button className="casino-button primary" type="button" onClick={playRound}>Run round</button>
            {lastResult ? (
              <div className={`round-result ${lastResult.won ? "" : "miss"}`}>
                <strong>{lastResult.won ? "Cleared" : "Review"} - score {lastResult.score}</strong>
                <span>+{formatNumber(lastResult.reward)} chips, +{formatNumber(lastResult.xp)} XP</span>
              </div>
            ) : null}
            <div>
              <h3>Recent rounds</h3>
              <div className="history-list">
                {!profile.history.length ? <div className="message">No rounds yet.</div> : null}
                {profile.history.slice(0, 4).map((entry) => (
                  <div className="history-item" key={entry.id}>
                    <div>
                      <strong>{entry.title}</strong>
                      <span>{entry.gameName} - {entry.topic} - score {entry.score}</span>
                    </div>
                    <code>{entry.won ? "+" : ""}{formatNumber(entry.reward)}</code>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>
      </div>

      {accountOpen ? (
        <AccountDialog
          syncClient={syncClientRef.current}
          user={user}
          initial={accountInitial}
          cloudStatus={cloudStatus}
          onClose={() => setAccountOpen(false)}
          onSignedIn={signIn}
          onSignedOut={signOut}
          onAccountDeleted={handleAccountDeleted}
          onToast={showToast}
        />
      ) : null}
      <ToastStack toasts={toasts} />
    </main>
  );
}

window.CCNACasinoPage = CCNACasinoPage;
