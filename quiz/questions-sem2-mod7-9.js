// CCNA Semester 2 Module 7-9 review quiz import.
// Appended separately so each semester/module bank can be launched on its own.
(function () {
  const bank = 'ccna/sem-02/m-7-9';
  const common = {
    bank,
    course: 'CCNA',
    semester: 'Semester 2',
    exam: 'Module 7-9 Quiz',
    src: 'Sem 2 Module 7-9 Quiz',
  };
  const items = [
    {
      s: 5,
      q: 'A DHCP client has been shut down beyond its lease time and boots again. Which destination IPv4 address is used when it requests an available address?',
      o: ['192.168.1.1', '192.168.1.8', '192.168.1.255', '255.255.255.255'],
      a: [3],
    },
    {
      s: 5,
      q: 'A DHCP lease is five days, and a workstation returns after one week. Which destination Layer 2 and Layer 3 addresses are used by the first DHCP message?',
      o: [
        'the MAC and IPv4 addresses of the DHCP server',
        'the DHCP server MAC address and 255.255.255.255',
        'FF-FF-FF-FF-FF-FF and the IPv4 address of the DHCP server',
        'FF-FF-FF-FF-FF-FF and 255.255.255.255',
      ],
      a: [3],
    },
    {
      s: 6,
      q: 'A host PC is attempting to lease an address through DHCP. Which message tells the client it can use the provided IP information?',
      o: ['DHCPDISCOVER', 'DHCPOFFER', 'DHCPREQUEST', 'DHCPACK', 'DHCPNACK'],
      a: [3],
    },
    {
      s: 7,
      q: 'How does a DHCP client initially obtain a usable IP address on an Ethernet segment?',
      o: [
        'It sends a DHCPREQUEST packet to 255.255.255.255.',
        'It sends a DHCPACK packet to the default gateway.',
        'It sends a DHCPDISCOVER message to the broadcast MAC address.',
        'It chooses a static address from the DHCP server pool.',
      ],
      a: [2],
    },
    {
      s: 7,
      q: 'Which statement is true about DHCP operation?',
      o: [
        'If a client receives several DHCPOFFER messages, it sends a DHCPREQUEST for the offer it chooses.',
        'A client must wait for lease expiration before sending another DHCPREQUEST.',
        'A DHCP client broadcasts a DHCPDISCOVER message when it boots and needs a server.',
        'The DHCPDISCOVER message contains the IP address, subnet mask, DNS server, and default gateway to assign.',
      ],
      a: [2],
    },
    {
      s: 8,
      q: 'Which protocol automates IP address assignment on a network, and which UDP port is used by the server? (Choose two.)',
      o: ['DHCP', 'DNS', 'SNMP', 'UDP port 67', 'UDP port 69', 'UDP port 80'],
      a: [0, 3],
      m: true,
    },
    {
      s: 9,
      q: 'What can happen when DHCP servers are not operational on a network?',
      o: [
        'Workstations are assigned 0.0.0.0.',
        'Workstations are assigned 127.0.0.1.',
        'Workstations self-assign addresses in 169.254.0.0/16.',
        'Workstations continue using the default gateway address.',
      ],
      a: [2],
    },
    {
      s: 10,
      q: 'What is the result of issuing ip dhcp excluded-address 10.0.15.1 10.0.15.15 on a Cisco router?',
      o: [
        'The router excludes 15 IP addresses from being leased to DHCP clients.',
        'The router excludes only 10.0.15.1 and 10.0.15.15 from being leased.',
        'The router creates a DHCP pool for the 10.0.15.0 network.',
        'The router clears active DHCP bindings in that range.',
      ],
      a: [0],
    },
    {
      s: 11,
      q: 'A DHCP pool is 10.19.44.0/24, and 6 IP addresses are reserved for servers. How many addresses remain for other hosts?',
      o: ['248', '246', '238', '252', '249'],
      a: [0],
    },
    {
      s: 12,
      q: 'A DHCP pool is 172.18.93.0/25, and 10 IP addresses are reserved for web servers. How many usable addresses remain for other hosts?',
      o: ['118', '106', '116', '20', '7'],
      a: [2],
    },
    {
      s: 12,
      q: 'A DHCP pool is 192.168.184.0/26, and 18 IP addresses are reserved for access points. How many usable addresses remain for other hosts?',
      o: ['46', '37', '54', '36', '44'],
      a: [3],
    },
    {
      s: 13,
      q: 'What is an advantage of configuring a Cisco router as a DHCP relay agent?',
      o: [
        'It allows DHCPDISCOVER messages to pass without alteration.',
        'It forwards both broadcast and multicast messages on behalf of clients.',
        'It can provide relay services for multiple UDP services.',
        'It reduces the response time from a DHCP server.',
      ],
      a: [2],
    },
    {
      s: 14,
      q: 'Which two UDP ports are used to forward DHCPv4 traffic? (Choose two.)',
      o: ['53', '67', '68', '69', '80'],
      a: [1, 2],
      m: true,
    },
    {
      s: 16,
      q: 'A coffee shop uses a wireless router and DSL modem. How is the wireless router typically configured for the phone-company connection?',
      o: [
        'Set the WAN connection on the wireless router as a DHCP client.',
        'Set the DSL modem as a DHCP client to get a public IP address from the wireless router.',
        'Set the wireless-router-to-DSL-modem link as a private IP network.',
        'Set the DSL modem as a DHCP client to the phone company and a DHCP server internally.',
      ],
      a: [0],
    },
    {
      s: 16,
      q: 'Why does an ISP commonly assign a DHCP address to a wireless router in a SOHO environment?',
      o: ['better connectivity', 'better network performance', 'easy IP address management', 'easy ISP firewall configuration'],
      a: [2],
    },
    {
      s: 21,
      q: 'A company uses SLAAC for employee IPv6 addressing. Which address does a client use as its default gateway?',
      o: [
        'the link-local address of the router interface attached to the network',
        'the unique local address of the router interface attached to the network',
        'the global unicast address of the router interface attached to the network',
        'the DHCPv6 server address',
      ],
      a: [0],
    },
    {
      s: 22,
      q: 'After a host generates an IPv6 address with DHCPv6 or SLAAC, how does it verify that the address is unique?',
      o: [
        'It sends an ICMPv6 echo request to the learned address and treats no reply as unique.',
        'It sends an ICMPv6 neighbor solicitation for the learned address and treats no reply as unique.',
        'It checks the local neighbor cache and treats an uncached address as unique.',
        'It sends an ARP broadcast on the local link and treats no reply as unique.',
      ],
      a: [1],
    },
    {
      s: 24,
      q: 'A router sends RA messages with M=0 and O=1. What should a PC do when configuring its IPv6 address?',
      o: [
        'Contact a DHCPv6 server for all required information.',
        'Use only the information in the RA message.',
        'Use the RA message for addressing and contact a DHCPv6 server for additional information.',
        'Contact a DHCPv6 server for prefix, prefix length, and a unique interface ID.',
      ],
      a: [2],
    },
    {
      s: 24,
      q: 'Clients use SLAAC but are not receiving DNS server and domain-name information from a stateless DHCPv6 pool. What is the likely cause?',
      o: [
        'The GigabitEthernet interface is not activated.',
        'The router is configured for SLAAC-only operation.',
        'The DNS server address is not on the same network as the clients.',
        'Clients cannot communicate with the DHCPv6 server because active clients is 0.',
      ],
      a: [1],
    },
    {
      s: 25,
      q: 'A router is being configured for DHCPv6 and the pool includes a domain-name command. Which conclusion fits a stateful DHCPv6 configuration with an incomplete pool?',
      o: [
        'The DHCPv6 server name is ACAD_CLASS.',
        'Clients would configure interface IDs above 0010.',
        'The router is configured for stateful DHCPv6, but the DHCP pool configuration is incomplete.',
        'The router is configured for SLAAC-only addressing.',
      ],
      a: [2],
    },
    {
      s: 26,
      q: 'A show ipv6 dhcp pool command shows 0 active clients on a stateless DHCPv6 server. Why can that be normal?',
      o: [
        'The default gateway address is not provided in the pool.',
        'No clients have communicated with the DHCPv6 server yet.',
        'The IPv6 DHCP pool has no IPv6 address range specified.',
        'Client state is not maintained by the DHCPv6 server in stateless DHCPv6 operation.',
      ],
      a: [3],
    },
    {
      s: 27,
      q: 'A router LAN interface has an IPv6 address and is up, but SLAAC clients do not receive the correct prefix and prefix length. What else should be configured?',
      o: [
        'R1(config-if)# ipv6 enable',
        'R1(config)# ipv6 unicast-routing',
        'R1(config-if)# ipv6 nd other-config-flag',
        'R1(config)# ipv6 dhcp pool <pool-name>',
      ],
      a: [1],
    },
    {
      s: 28,
      q: 'What should be done on the router interface facing PC-A so PC-A can receive an IPv6 address from a DHCPv6 server on another network?',
      o: [
        'Add the ipv6 dhcp relay command to the client-facing interface.',
        'Configure ipv6 nd managed-config-flag on the server-facing interface.',
        'Change ipv6 nd managed-config-flag to ipv6 nd other-config-flag.',
        'Add the DHCPv6 server address to the DHCPv6 server interface configuration.',
      ],
      a: [0],
    },
    {
      s: 28,
      q: 'A router interface has ipv6 nd other-config-flag and ipv6 dhcp server configured. What kind of IPv6 addressing is being used?',
      o: ['SLAAC', 'stateful DHCPv6', 'stateless DHCPv6', 'static IPv6 addressing'],
      a: [2],
    },
    {
      s: 29,
      q: 'In the Packet Tracer activity, what keyword is displayed on www.netacad.com?',
      o: ['power', 'web', 'cisco', 'networking'],
      a: [2],
    },
    {
      s: 34,
      q: 'Which first-hop redundancy protocol can load-balance traffic across two gateway routers to the Internet?',
      o: ['HSRP', 'RSTP', 'GLBP', 'VRRP'],
      a: [2],
    },
    {
      s: 35,
      q: 'Which FHRP implementation is a nonproprietary IPv4-only election protocol with limited scalability?',
      o: ['GLBP for IPv6', 'HSRP', 'VRRPv2', 'IRDP'],
      a: [2],
    },
    {
      s: 35,
      q: 'Which FHRP implementation is Cisco-proprietary and supports IPv6 load balancing?',
      o: ['GLBP for IPv6', 'HSRP', 'VRRPv3', 'IRDP'],
      a: [0],
    },
    {
      s: 36,
      q: 'Which FHRP implementation is Cisco-proprietary and supports IPv4 load sharing?',
      o: ['VRRPv3', 'GLBP for IPv6', 'VRRPv2', 'GLBP'],
      a: [3],
    },
    {
      s: 36,
      q: 'Which nonproprietary protocol relies on ICMP to provide IPv4 redundancy?',
      o: ['GLBP for IPv6', 'IRDP', 'GLBP', 'VRRPv3'],
      a: [1],
    },
    {
      s: 37,
      q: 'Which FHRP implementation is Cisco-proprietary and permits only one router in a group to forward IPv6 packets?',
      o: ['HSRP', 'VRRPv2', 'HSRP for IPv6', 'VRRPv3'],
      a: [2],
    },
    {
      s: 38,
      q: 'Which FHRP implementation is a nonproprietary IPv4-only election protocol with one master router per group?',
      o: ['VRRPv2', 'HSRP for IPv6', 'VRRPv3', 'GLBP'],
      a: [0],
    },
    {
      s: 39,
      q: 'Which destination MAC address is used when frames are sent from a workstation to a redundant default gateway?',
      o: [
        'the MAC address of the forwarding router',
        'the MAC addresses of both forwarding and standby routers',
        'the MAC address of the standby router',
        'the MAC address of the virtual router',
      ],
      a: [3],
    },
    {
      s: 40,
      q: 'Which statement describes a feature associated with HSRP?',
      o: [
        'HSRP uses active and standby routers.',
        'It uses ICMP messages to assign the default gateway to hosts.',
        'It allows load balancing between redundant routers.',
        'HSRP is nonproprietary.',
      ],
      a: [0],
    },
  ].map((item, idx) => ({ ...common, si: idx + 1, page: item.s, ...item }));

  window.QUESTIONS_RAW = (window.QUESTIONS_RAW || []).concat(items);
})();
