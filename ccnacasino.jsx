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

const WAGER_OPTIONS = [10, 25, 50, 100];
const CCNA_SYMBOLS = ["SUBNET", "ACL", "OSPF", "VLAN", "NAT", "DHCP", "STP", "DNS"];
const CARD_DECK = [
  { label: "/30", value: 2 },
  { label: "/29", value: 3 },
  { label: "/28", value: 4 },
  { label: "/27", value: 5 },
  { label: "/26", value: 6 },
  { label: "/25", value: 7 },
  { label: "AD 90", value: 8 },
  { label: "AD 110", value: 9 },
  { label: "ACE", value: 10 },
  { label: "NAT", value: 10 },
  { label: "OSPF", value: 11 },
];

function randomCasinoItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomCard() {
  return randomCasinoItem(CARD_DECK);
}

function handTotal(cards) {
  return (cards || []).reduce((sum, card) => sum + Number(card.value || 0), 0);
}

function quickScore(won, payout, wager) {
  if (!won) return 48 + Math.floor(Math.random() * 18);
  return Math.min(100, 70 + Math.floor((payout / Math.max(1, wager)) * 9) + Math.floor(Math.random() * 12));
}

function resultPayload({ game, idea, ideaIndex, wager, payout, label, detail }) {
  const won = payout > wager;
  return {
    game,
    idea,
    ideaIndex,
    wager,
    payout,
    won,
    xp: won ? 42 + Math.floor(payout / 12) : 18,
    score: quickScore(won, payout, wager),
    label,
    detail,
  };
}

function GameCardStrip({ cards }) {
  return (
    <div className="quickplay-cards">
      {cards.map((card, index) => (
        <div className="quickplay-card" key={`${card.label}-${index}`}>
          <span>{card.label}</span>
          <strong>{card.value}</strong>
        </div>
      ))}
    </div>
  );
}

function QuickplayView({ game, profile, onBack, onRoundComplete, showToast }) {
  const [wager, setWager] = useStateCasino(25);
  const [ideaIndex, setIdeaIndex] = useStateCasino(0);
  const [round, setRound] = useStateCasino({ phase: "idle" });
  const [choice, setChoice] = useStateCasino(game.topic);
  const [target, setTarget] = useStateCasino(50);
  const idea = game.ideas[ideaIndex] || game.ideas[0];
  const balance = Number(profile.balance || 0);
  const canPlay = balance >= wager;

  useEffectCasino(() => {
    setRound({ phase: "idle" });
    setIdeaIndex(0);
    setChoice(game.topic);
  }, [game.id]);

  function settle(payout, label, detail = "") {
    const payload = resultPayload({ game, idea, ideaIndex, wager, payout, label, detail });
    setRound((current) => ({ ...current, phase: "done", result: payload }));
    onRoundComplete(payload);
  }

  function requireChips() {
    if (canPlay) return true;
    showToast("Not enough chips.");
    return false;
  }

  function startBlackjack() {
    if (!requireChips()) return;
    setRound({ phase: "playing", type: "blackjack", hand: [randomCard(), randomCard()], dealer: 16 + Math.floor(Math.random() * 7) });
  }

  function hitBlackjack() {
    const hand = [...(round.hand || []), randomCard()];
    if (handTotal(hand) > 21) {
      const payload = resultPayload({ game, idea, ideaIndex, wager, payout: 0, label: "Busted", detail: "Subnet total exceeded 21." });
      setRound({ ...round, hand, phase: "done", result: payload });
      onRoundComplete(payload);
      return;
    }
    setRound({ ...round, hand });
  }

  function standBlackjack() {
    const total = handTotal(round.hand || []);
    const dealer = Number(round.dealer || 18);
    const won = total <= 21 && (dealer > 21 || total >= dealer);
    settle(won ? Math.round(wager * (total === 21 ? 2.5 : 1.75)) : 0, won ? `Held ${total} vs ${dealer}` : `Dealer ${dealer}`);
  }

  function spinRoulette() {
    if (!requireChips()) return;
    const pockets = [
      { label: "Longest prefix", topic: "Routing choices" },
      { label: "Permit", topic: "ACLs" },
      { label: "Native VLAN", topic: "Switching" },
      { label: "Inside global", topic: "Services" },
      { label: "Broadcast", topic: "Subnet math" },
      { label: "Root bridge", topic: "Switching" },
    ];
    const pocket = randomCasinoItem(pockets);
    const won = pocket.topic === choice;
    setRound({ phase: "done", type: "roulette", pocket, result: { won } });
    settle(won ? wager * 3 : 0, pocket.label, `Bet: ${choice}`);
  }

  function spinSlots(grid = false) {
    if (!requireChips()) return;
    const count = grid ? 9 : 3;
    const symbols = Array.from({ length: count }, () => randomCasinoItem(CCNA_SYMBOLS));
    const counts = symbols.reduce((acc, symbol) => ({ ...acc, [symbol]: (acc[symbol] || 0) + 1 }), {});
    const best = Math.max(...Object.values(counts));
    const payout = best >= (grid ? 4 : 3) ? wager * (grid ? 5 : 4) : best >= (grid ? 3 : 2) ? Math.round(wager * 1.6) : 0;
    setRound({ phase: "done", type: grid ? "grid" : "slots", symbols });
    settle(payout, payout ? `${best} matching ${Object.keys(counts).find((symbol) => counts[symbol] === best)}` : "No match");
  }

  function rollDice() {
    if (!requireChips()) return;
    const roll = Math.floor(Math.random() * 100) + 1;
    const won = roll >= target;
    setRound({ phase: "done", type: "dice", roll });
    settle(won ? Math.round(wager * (100 / Math.max(2, 101 - target))) : 0, `Rolled ${roll}`, `Target ${target}+`);
  }

  function startMines() {
    if (!requireChips()) return;
    const mineCount = 4;
    const mines = new Set();
    while (mines.size < mineCount) mines.add(Math.floor(Math.random() * 25));
    setRound({ phase: "playing", type: "mines", mines: [...mines], revealed: [] });
  }

  function revealMine(index) {
    if (round.mines.includes(index)) {
      const payload = resultPayload({ game, idea, ideaIndex, wager, payout: 0, label: "Misconfig hit", detail: "You revealed the bad config." });
      setRound({ ...round, phase: "done", revealed: [...round.revealed, index], result: payload });
      onRoundComplete(payload);
      return;
    }
    const revealed = [...round.revealed, index];
    setRound({ ...round, revealed });
    if (revealed.length >= 5) settle(Math.round(wager * 2.4), `${revealed.length} safe configs`);
  }

  function startKeno() {
    if (!requireChips()) return;
    setRound({ phase: "picking", type: "keno", picks: [], drawn: [] });
  }

  function toggleKeno(number) {
    const picks = round.picks || [];
    if (round.phase !== "picking") return;
    const next = picks.includes(number) ? picks.filter((item) => item !== number) : picks.length < 6 ? [...picks, number] : picks;
    setRound({ ...round, picks: next });
  }

  function drawKeno() {
    const drawn = [];
    while (drawn.length < 8) {
      const value = Math.floor(Math.random() * 24) + 1;
      if (!drawn.includes(value)) drawn.push(value);
    }
    const hits = (round.picks || []).filter((pick) => drawn.includes(pick)).length;
    setRound({ ...round, phase: "done", drawn });
    settle(hits >= 3 ? wager * (hits + 1) : 0, `${hits} hits`);
  }

  function stepGame() {
    if (!requireChips()) return;
    const steps = Math.floor(Math.random() * 8) + 1;
    const won = steps >= 5;
    setRound({ phase: "done", type: "steps", steps });
    settle(won ? Math.round(wager * (1.2 + steps / 5)) : 0, won ? `${steps} clean hops` : `${steps} hops then failed`);
  }

  function crashRun() {
    if (!requireChips()) return;
    const crashAt = Number((1 + Math.random() * 4.5).toFixed(2));
    const cashoutAt = Number((1.2 + Math.random() * 3.3).toFixed(2));
    const won = cashoutAt < crashAt;
    setRound({ phase: "done", type: "crash", crashAt, cashoutAt });
    settle(won ? Math.round(wager * cashoutAt) : 0, won ? `${cashoutAt}x cashout` : `crashed at ${crashAt}x`);
  }

  const isCardGame = ["blackjack", "holdem"].includes(game.id);
  const isRoulette = game.id === "roulette";
  const isSlots = ["slots", "gridslots"].includes(game.id);
  const isDice = ["dice", "limbo"].includes(game.id);
  const isMines = game.id === "mines";
  const isKeno = game.id === "keno";
  const isCrash = game.id === "crash";
  const isStepGame = ["chicken", "path", "plinko"].includes(game.id);

  return (
    <section className="quickplay-screen">
      <div className="quickplay-head">
        <button className="casino-button" type="button" onClick={onBack}>Back to lobby</button>
        <div>
          <h1>{game.name}</h1>
          <p>{idea.title}</p>
        </div>
        <div className="quickplay-balance">
          <span>chips</span>
          <strong>{formatNumber(profile.balance)}</strong>
        </div>
      </div>

      <div className="quickplay-layout">
        <aside className="quickplay-side casino-panel">
          <div className="field">
            <label>Wager</label>
            <div className="wager-grid">
              {WAGER_OPTIONS.map((value) => (
                <button key={value} type="button" className={`casino-button ${wager === value ? "primary" : ""}`} onClick={() => setWager(value)}>
                  {value}
                </button>
              ))}
            </div>
          </div>
          <div className="field">
            <label>CCNA twist</label>
            <select value={ideaIndex} onChange={(event) => setIdeaIndex(Number(event.target.value))}>
              {game.ideas.map((item, index) => <option key={item.title} value={index}>{item.title}</option>)}
            </select>
          </div>
          <div className="quickplay-note">{idea.turnInto}</div>
        </aside>

        <div className="quickplay-table casino-panel">
          {isCardGame ? (
            <>
              <div className="quickplay-table-top">
                <h2>{game.id === "holdem" ? "Troubleshooting hand" : "Subnet hand"}</h2>
                <span>{round.phase === "playing" ? `Dealer ${round.dealer}` : "Target 21"}</span>
              </div>
              <GameCardStrip cards={round.hand || []} />
              <div className="quickplay-total">{handTotal(round.hand || []) || "--"}</div>
              <div className="quickplay-actions">
                {round.phase === "playing" ? (
                  <>
                    <button className="casino-button primary" type="button" onClick={hitBlackjack}>Hit</button>
                    <button className="casino-button" type="button" onClick={standBlackjack}>Stand</button>
                  </>
                ) : (
                  <button className="casino-button primary" type="button" onClick={startBlackjack}>Join hand</button>
                )}
              </div>
            </>
          ) : null}

          {isRoulette ? (
            <>
              <div className="quickplay-wheel">{round.pocket?.label || "SPIN"}</div>
              <div className="field">
                <label>Bet</label>
                <select value={choice} onChange={(event) => setChoice(event.target.value)}>
                  {[...new Set(CASINO_GAMES.map((item) => item.topic))].map((topic) => <option key={topic}>{topic}</option>)}
                </select>
              </div>
              <button className="casino-button primary" type="button" onClick={spinRoulette}>Spin</button>
            </>
          ) : null}

          {isSlots ? (
            <>
              <div className={game.id === "gridslots" ? "slot-grid grid-mode" : "slot-grid"}>
                {(round.symbols || ["?", "?", "?", ...(game.id === "gridslots" ? ["?", "?", "?", "?", "?", "?"] : [])]).map((symbol, index) => (
                  <div className="slot-cell" key={`${symbol}-${index}`}>{symbol}</div>
                ))}
              </div>
              <button className="casino-button primary" type="button" onClick={() => spinSlots(game.id === "gridslots")}>Spin</button>
            </>
          ) : null}

          {isDice ? (
            <>
              <div className="quickplay-meter">
                <span style={{ width: `${target}%` }} />
              </div>
              <div className="field">
                <label>Target {target}+</label>
                <input type="range" min="5" max="95" value={target} onChange={(event) => setTarget(Number(event.target.value))} />
              </div>
              <button className="casino-button primary" type="button" onClick={rollDice}>Roll</button>
            </>
          ) : null}

          {isMines ? (
            <>
              <div className="tile-grid">
                {Array.from({ length: 25 }, (_, index) => {
                  const revealed = round.revealed?.includes(index);
                  const bad = revealed && round.mines?.includes(index);
                  return (
                    <button
                      key={index}
                      type="button"
                      disabled={round.phase !== "playing" || revealed}
                      className={`tile-cell ${revealed ? bad ? "bad" : "good" : ""}`}
                      onClick={() => revealMine(index)}
                    >
                      {revealed ? bad ? "!" : "OK" : ""}
                    </button>
                  );
                })}
              </div>
              <button className="casino-button primary" type="button" onClick={startMines}>Start grid</button>
            </>
          ) : null}

          {isKeno ? (
            <>
              <div className="keno-grid">
                {Array.from({ length: 24 }, (_, index) => {
                  const number = index + 1;
                  const picked = round.picks?.includes(number);
                  const drawn = round.drawn?.includes(number);
                  return (
                    <button key={number} type="button" className={`keno-cell ${picked ? "picked" : ""} ${drawn ? "drawn" : ""}`} onClick={() => toggleKeno(number)}>
                      {number}
                    </button>
                  );
                })}
              </div>
              <div className="quickplay-actions">
                <button className="casino-button" type="button" onClick={startKeno}>Pick</button>
                <button className="casino-button primary" type="button" disabled={round.phase !== "picking" || !(round.picks || []).length} onClick={drawKeno}>Draw</button>
              </div>
            </>
          ) : null}

          {isStepGame ? (
            <>
              <div className="step-lanes">
                {Array.from({ length: 8 }, (_, index) => <span key={index} className={round.steps > index ? "active" : ""}>{index + 1}</span>)}
              </div>
              <button className="casino-button primary" type="button" onClick={stepGame}>Start run</button>
            </>
          ) : null}

          {isCrash ? (
            <>
              <div className="crash-chart">
                <span style={{ width: `${Math.min(100, (round.cashoutAt || 1) * 20)}%` }} />
                <strong>{round.cashoutAt ? `${round.cashoutAt}x` : "1.00x"}</strong>
              </div>
              <button className="casino-button primary" type="button" onClick={crashRun}>Launch</button>
            </>
          ) : null}

          {round.result ? (
            <div className={`round-result ${round.result.won ? "" : "miss"}`}>
              <strong>{round.result.won ? "Win" : "Loss"} - {round.result.label}</strong>
              <span>{round.result.payout ? `+${formatNumber(round.result.payout)} chips` : "0 chips"}</span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
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
  const [activeGameId, setActiveGameId] = useStateCasino(() => {
    const match = /^#\/quickplay\/([^/]+)/.exec(window.location.hash || "");
    return match ? match[1] : "";
  });
  const [toasts, setToasts] = useStateCasino([]);

  const selectedGame = useMemoCasino(() => CASINO_GAMES.find((game) => game.id === selectedGameId) || CASINO_GAMES[0], [selectedGameId]);
  const activeGame = useMemoCasino(() => CASINO_GAMES.find((game) => game.id === activeGameId) || null, [activeGameId]);
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
    }), { cloud: false });
  }, [selectedGameId]);

  useEffectCasino(() => {
    const syncHash = () => {
      const match = /^#\/quickplay\/([^/]+)/.exec(window.location.hash || "");
      const nextGameId = match ? match[1] : "";
      if (nextGameId && CASINO_GAMES.some((game) => game.id === nextGameId)) {
        setSelectedGameId(nextGameId);
        setActiveGameId(nextGameId);
        return;
      }
      setActiveGameId("");
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

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
    setCloudStatus("Signed out. Guest progress saves in this browser.");
    setAccountOpen(false);
    showToast("Signed out.");
  };

  const signIn = (nextUser) => {
    setUser(nextUser);
    const localProfile = loadLocalProfile(nextUser);
    setProfile(localProfile);
    setSelectedGameId(localProfile.selectedGameId || "blackjack");
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

  const handleRoundComplete = useCallbackCasino((result) => {
    const game = result.game;
    const idea = result.idea;
    const ideaIndex = result.ideaIndex || 0;
    const key = completionKey(game.id, ideaIndex);
    const wager = Number(result.wager || 0);
    const payout = Number(result.payout || 0);
    const xp = Number(result.xp || 0);
    const historyEntry = {
      id: `${Date.now()}-${game.id}`,
      gameId: game.id,
      gameName: game.name,
      title: idea?.title || game.name,
      topic: idea?.topic || game.topic,
      won: !!result.won,
      score: result.score || 0,
      reward: payout,
      xp,
      playedAt: nowIsoCasino(),
    };
    updateProfile((current) => {
      const streak = result.won ? current.streak + 1 : 0;
      return {
        ...current,
        balance: Math.max(0, current.balance - wager + payout),
        xp: current.xp + xp,
        rounds: current.rounds + 1,
        wins: current.wins + (result.won ? 1 : 0),
        streak,
        bestStreak: Math.max(current.bestStreak || 0, streak),
        selectedGameId: game.id,
        ideaCompletions: {
          ...(current.ideaCompletions || {}),
          [key]: ((current.ideaCompletions || {})[key] || 0) + 1,
        },
        history: [historyEntry, ...(current.history || [])].slice(0, 18),
      };
    });
  }, [updateProfile]);

  const openGame = (gameId) => {
    setSelectedGameId(gameId);
    setActiveGameId(gameId);
    window.location.hash = `/quickplay/${gameId}`;
  };

  const backToLobby = () => {
    setActiveGameId("");
    window.history.pushState("", document.title, `${window.location.pathname}${window.location.search}`);
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

      {activeGame ? (
        <div className="casino-shell game-shell">
          <QuickplayView
            game={activeGame}
            profile={profile}
            onBack={backToLobby}
            onRoundComplete={handleRoundComplete}
            showToast={showToast}
          />
        </div>
      ) : (
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
                  onClick={() => openGame(game.id)}
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
        </div>
      )}

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
