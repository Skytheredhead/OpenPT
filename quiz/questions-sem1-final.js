// CCNA Semester 1 final review quiz import.
// Generated from the Sem 1 final OneNote export and cross-checked against the ITNv7 final answer key.
(function () {
  const bank = 'ccna/sem-01/final';
  const common = {
    bank,
    course: 'CCNA',
    semester: 'Semester 1',
    exam: 'Final exam',
    src: 'Sem 1 Final Review',
  };
  const items = [
    {
        "s": 1,
        "q": "Which two traffic types use the Real-Time Transport Protocol (RTP)? (Choose two.)",
        "o": [
            "video",
            "web",
            "file transfer",
            "voice",
            "peer to peer"
        ],
        "a": [
            0,
            3
        ],
        "m": true
    },
    {
        "s": 2,
        "q": "Which wireless technology has low-power and data rate requirements making it popular in home automation applications?",
        "o": [
            "ZigBee",
            "LoRaWAN",
            "5G",
            "Wi-Fi"
        ],
        "a": [
            0
        ]
    },
    {
        "s": 3,
        "q": "Which layer of the TCP/IP model provides a route to forward messages through an internetwork?",
        "o": [
            "application",
            "network access",
            "internet",
            "transport"
        ],
        "a": [
            2
        ]
    },
    {
        "s": 4,
        "q": "Which type of server relies on record types such as A, NS, AAAA, and MX in order to provide services?",
        "o": [
            "DNS",
            "email",
            "file",
            "web"
        ],
        "a": [
            0
        ]
    },
    {
        "s": 5,
        "q": "What are proprietary protocols?",
        "o": [
            "protocols developed by private organizations to operate on any vendor hardware",
            "protocols that can be freely used by any organization or vendor",
            "protocols developed by organizations who have control over their definition and operation",
            "a collection of protocols known as the TCP/IP protocol suite"
        ],
        "a": [
            2
        ]
    },
    {
        "s": 6,
        "q": "What service is provided by DNS?",
        "o": [
            "Resolves domain names, such as cisco.com, into IP addresses.",
            "A basic set of rules for exchanging text, graphic images, sound, video, and other multimedia files on the web.",
            "Allows for data transfers between a client and a file server.",
            "Uses encryption to secure the exchange of text, graphic images, sound, and video on the web."
        ],
        "a": [
            0
        ]
    },
    {
        "s": 7,
        "q": "A client packet is received by a server. The packet has a destination port number of 110. What service is the client requesting?",
        "o": [
            "DNS",
            "DHCP",
            "SMTP",
            "POP3"
        ],
        "a": [
            3
        ]
    },
    {
        "s": 8,
        "q": "What command can be used on a Windows PC to see the IP configuration of that computer?",
        "o": [
            "show ip interface brief",
            "ping",
            "show interfaces",
            "ipconfig"
        ],
        "a": [
            3
        ]
    },
    {
        "s": 9,
        "q": "A wired laser printer is attached to a home computer. That printer has been shared so that other computers on the home network can also use the printer. What networking model is in use?",
        "o": [
            "client-based",
            "master-slave",
            "point-to-point",
            "peer-to-peer (P2P)"
        ],
        "a": [
            3
        ]
    },
    {
        "s": 10,
        "q": "What characteristic describes a virus?",
        "o": [
            "a network device that filters access and traffic coming into a network",
            "the use of stolen credentials to access private data",
            "an attack that slows or crashes a device or network service",
            "malicious software or code running on an end device"
        ],
        "a": [
            3
        ]
    },
    {
        "s": 11,
        "q": "Three bank employees are using the corporate network. The first employee uses a web browser to view a company web page in order to read some announcements. The second employee accesses the corporate database to perform some financial transactions. The third employee participates in an important live audio conference with other corporate managers in branch offices. If QoS is implemented on this network, what will be the priorities from highest to lowest of the different data types?",
        "o": [
            "financial transactions, web page, audio conference",
            "audio conference, financial transactions, web page",
            "financial transactions, audio conference, web page",
            "audio conference, web page, financial transactions"
        ],
        "a": [
            1
        ]
    },
    {
        "s": 12,
        "q": "Match each IPv6 address component with its description.",
        "o": [
            "global routing prefix -> network portion of the address assigned by the provider",
            "subnet ID -> portion used by an organization to identify subnets",
            "interface ID -> portion equivalent to the host portion of an IPv4 address",
            "subnet mask -> identifies the IPv6 host portion"
        ],
        "a": [
            0,
            1,
            2
        ],
        "m": true,
        "pairs": [
            [
                "global routing prefix",
                "network portion of the address assigned by the provider"
            ],
            [
                "subnet ID",
                "portion used by an organization to identify subnets"
            ],
            [
                "interface ID",
                "portion equivalent to the host portion of an IPv4 address"
            ]
        ]
    },
    {
        "s": 13,
        "q": "Refer to the exhibit. If Host1 were to transfer a file to the server, what layers of the TCP/IP model would be used?",
        "o": [
            "only application and Internet layers",
            "only Internet and network access layers",
            "only application, Internet, and network access layers",
            "application, transport, Internet, and network access layers",
            "only application, transport, network, data link, and physical layers",
            "application, session, transport, network, data link, and physical layers"
        ],
        "a": [
            3
        ]
    },
    {
        "s": 14,
        "q": "Match each switching characteristic with the forwarding method.",
        "o": [
            "cut-through -> low latency",
            "cut-through -> may forward runt frames",
            "cut-through -> forwarding starts when the destination address is received",
            "store-and-forward -> always stores the entire frame",
            "store-and-forward -> checks the CRC before forwarding begins",
            "store-and-forward -> checks frame length before forwarding"
        ],
        "a": [
            0,
            1,
            2,
            3,
            4,
            5
        ],
        "m": true,
        "pairs": [
            [
                "cut-through",
                "low latency"
            ],
            [
                "cut-through",
                "may forward runt frames"
            ],
            [
                "cut-through",
                "forwarding starts when the destination address is received"
            ],
            [
                "store-and-forward",
                "always stores the entire frame"
            ],
            [
                "store-and-forward",
                "checks the CRC before forwarding begins"
            ],
            [
                "store-and-forward",
                "checks frame length before forwarding"
            ]
        ]
    },
    {
        "s": 15,
        "q": "Refer to the exhibit. The IP address of which device interface should be used as the default gateway setting of host H1?",
        "o": [
            "R1: S0/0/0",
            "R2: S0/0/1",
            "R1: G0/0",
            "R2: S0/0/0"
        ],
        "a": [
            2
        ]
    },
    {
        "s": 16,
        "q": "What service is provided by Internet Messenger?",
        "o": [
            "An application that allows real-time chatting among remote users.",
            "Allows remote access to network devices and servers.",
            "Resolves domain names, such as cisco.com, into IP addresses.",
            "Uses encryption to provide secure remote access to network devices and servers."
        ],
        "a": [
            0
        ]
    },
    {
        "s": 17,
        "q": "Match each VLSM network with the correct IP address and prefix.",
        "o": [
            "Network A -> 192.168.0.128/25",
            "Network B -> 192.168.0.0/26",
            "Network C -> 192.168.0.96/27",
            "Network D -> 192.168.0.80/30"
        ],
        "a": [
            0,
            1,
            2,
            3
        ],
        "m": true,
        "pairs": [
            [
                "Network A",
                "192.168.0.128/25"
            ],
            [
                "Network B",
                "192.168.0.0/26"
            ],
            [
                "Network C",
                "192.168.0.96/27"
            ],
            [
                "Network D",
                "192.168.0.80/30"
            ]
        ]
    },
    {
        "s": 18,
        "q": "Refer to the exhibit. Which protocol was responsible for building the table that is shown?",
        "o": [
            "DHCP",
            "ARP",
            "DNS",
            "ICMP"
        ],
        "a": [
            1
        ]
    },
    {
        "s": 19,
        "q": "A network administrator notices that some newly installed Ethernet cabling is carrying corrupt and distorted data signals. The new cabling was installed in the ceiling close to fluorescent lights and electrical equipment. Which two factors may interfere with the copper cabling and result in signal distortion and data corruption? (Choose two.)",
        "o": [
            "crosstalk",
            "extended length of cabling",
            "RFI",
            "EMI",
            "signal attenuation"
        ],
        "a": [
            2,
            3
        ],
        "m": true
    },
    {
        "s": 20,
        "q": "A host is trying to send a packet to a device on a remote LAN segment, but there are currently no mappings in its ARP cache. How will the device obtain a destination MAC address? (A host is trying to send a packet to a device on a remote LAN segment, but there are currently no mappings in the ARP cache. How will the device obtain a destination MAC address?)",
        "o": [
            "It will send the frame and use its own MAC address as the destination.",
            "It will send an ARP request for the MAC address of the destination device.",
            "It will send the frame with a broadcast MAC address.",
            "It will send a request to the DNS server for the destination MAC address.",
            "It will send an ARP request for the MAC address of the default gateway."
        ],
        "a": [
            4
        ]
    },
    {
        "s": 22,
        "q": "A client packet is received by a server. The packet has a destination port number of 53. What service is the client requesting?",
        "o": [
            "DNS",
            "NetBIOS (NetBT)",
            "POP3",
            "IMAP"
        ],
        "a": [
            0
        ]
    },
    {
        "s": 23,
        "q": "A network administrator is adding a new LAN to a branch office. The new LAN must support 25 connected devices. What is the smallest network mask that the network administrator can use for the new network?",
        "o": [
            "255.255.255.128",
            "255.255.255.192",
            "255.255.255.224",
            "255.255.255.240"
        ],
        "a": [
            2
        ]
    },
    {
        "s": 24,
        "q": "What characteristic describes a Trojan horse?",
        "o": [
            "malicious software or code running on an end device",
            "an attack that slows or crashes a device or network service",
            "the use of stolen credentials to access private data",
            "a network device that filters access and traffic coming into a network"
        ],
        "a": [
            0
        ]
    },
    {
        "s": 25,
        "q": "What service is provided by HTTPS?",
        "o": [
            "Uses encryption to provide secure remote access to network devices and servers.",
            "Resolves domain names, such as cisco.com, into IP addresses.",
            "Uses encryption to secure the exchange of text, graphic images, sound, and video on the web.",
            "Allows remote access to network devices and servers."
        ],
        "a": [
            2
        ]
    },
    {
        "s": 26,
        "q": "A technician with a PC is using multiple applications while connected to the Internet. How is the PC able to keep track of the data flow between multiple application sessions and have each application receive the correct packet flows?",
        "o": [
            "The data flow is being tracked based on the destination MAC address of the technician PC.",
            "The data flow is being tracked based on the source port number that is used by each application.",
            "The data flow is being tracked based on the source IP address that is used by the PC of the technician.",
            "The data flow is being tracked based on the destination IP address that is used by the PC of the technician."
        ],
        "a": [
            1
        ]
    },
    {
        "s": 27,
        "q": "A network administrator is adding a new LAN to a branch office. The new LAN must support 61 connected devices. What is the smallest network mask that the network administrator can use for the new network?",
        "o": [
            "255.255.255.240",
            "255.255.255.224",
            "255.255.255.192",
            "255.255.255.128"
        ],
        "a": [
            2
        ]
    },
    {
        "s": 28,
        "q": "Match each VLSM network with the correct IP address and prefix.",
        "o": [
            "Network A -> 192.168.0.0/25",
            "Network B -> 192.168.0.128/26",
            "Network C -> 192.168.0.192/27",
            "Network D -> 192.168.0.224/30"
        ],
        "a": [
            0,
            1,
            2,
            3
        ],
        "m": true,
        "pairs": [
            [
                "Network A",
                "192.168.0.0/25"
            ],
            [
                "Network B",
                "192.168.0.128/26"
            ],
            [
                "Network C",
                "192.168.0.192/27"
            ],
            [
                "Network D",
                "192.168.0.224/30"
            ]
        ]
    },
    {
        "s": 29,
        "q": "What characteristic describes a DoS attack?",
        "o": [
            "the use of stolen credentials to access private data",
            "a network device that filters access and traffic coming into a network",
            "software that is installed on a user device and collects information about the user",
            "an attack that slows or crashes a device or network service"
        ],
        "a": [
            3
        ]
    },
    {
        "s": 30,
        "q": "Match each application protocol with its transport protocol.",
        "o": [
            "FTP -> TCP",
            "TFTP -> UDP",
            "DHCP -> UDP",
            "HTTP -> TCP",
            "SMTP -> TCP"
        ],
        "a": [
            0,
            1,
            2,
            3,
            4
        ],
        "m": true,
        "pairs": [
            [
                "FTP",
                "TCP"
            ],
            [
                "TFTP",
                "UDP"
            ],
            [
                "DHCP",
                "UDP"
            ],
            [
                "HTTP",
                "TCP"
            ],
            [
                "SMTP",
                "TCP"
            ]
        ]
    },
    {
        "s": 31,
        "q": "What service is provided by SMTP?",
        "o": [
            "Allows clients to send email to a mail server and the servers to send email to other servers.",
            "Allows remote access to network devices and servers.",
            "Uses encryption to provide secure remote access to network devices and servers.",
            "An application that allows real-time chatting among remote users."
        ],
        "a": [
            0
        ]
    },
    {
        "s": 32,
        "q": "Which scenario describes a function provided by the transport layer?",
        "o": [
            "A student is using a classroom VoIP phone to call home. The unique identifier burned into the phone is a transport layer address used to contact another network device on the same network.",
            "A student is playing a short web-based movie with sound. The movie and sound are encoded within the transport layer header.",
            "A student has two web browser windows open in order to access two web sites. The transport layer ensures the correct web page is delivered to the correct browser window.",
            "A corporate worker is accessing a web server located on a corporate network. The transport layer formats the screen so the web page appears properly no matter what device is being used to view the web site."
        ],
        "a": [
            2
        ]
    },
    {
        "s": 33,
        "q": "Refer to the exhibit. Host B on subnet Teachers sends a packet to host D on subnet Students. Which Layer 2 and Layer 3 addresses are in the PDU sent from host B to the router?",
        "o": [
            "Layer 2 destination = 00-00-0c-94-36-ab; Layer 2 source = 00-00-0c-94-36-bb; Layer 3 destination = 172.16.20.200; Layer 3 source = 172.16.10.200",
            "Layer 2 destination = 00-00-0c-94-36-dd; Layer 2 source = 00-00-0c-94-36-bb; Layer 3 destination = 172.16.20.200; Layer 3 source = 172.16.10.200",
            "Layer 2 destination = 00-00-0c-94-36-cd; Layer 2 source = 00-00-0c-94-36-bb; Layer 3 destination = 172.16.20.99; Layer 3 source = 172.16.10.200",
            "Layer 2 destination = 00-00-0c-94-36-ab; Layer 2 source = 00-00-0c-94-36-bb; Layer 3 destination = 172.16.20.200; Layer 3 source = 172.16.100.200"
        ],
        "a": [
            0
        ]
    },
    {
        "s": 34,
        "q": "What does the term \u201cattenuation\u201d mean in data communication?",
        "o": [
            "strengthening of a signal by a networking device",
            "leakage of signals from one cable pair to another",
            "time for a signal to reach its destination",
            "loss of signal strength as distance increases"
        ],
        "a": [
            3
        ]
    },
    {
        "s": 35,
        "q": "Refer to the exhibit. An administrator is trying to configure the switch but receives the error message that is displayed in the exhibit. What is the problem?",
        "o": [
            "The entire command, configure terminal, must be used.",
            "The administrator is already in global configuration mode.",
            "The administrator must first enter privileged EXEC mode before issuing the command.",
            "The administrator must connect via the console port to access global configuration mode."
        ],
        "a": [
            2
        ]
    },
    {
        "s": 36,
        "q": "Which two protocols operate at the top layer of the TCP/IP protocol suite? (Choose two.)",
        "o": [
            "TCP",
            "IP",
            "UDP",
            "POP",
            "DNS",
            "Ethernet"
        ],
        "a": [
            3,
            4
        ],
        "m": true
    },
    {
        "s": 37,
        "q": "A company has a file server that shares a folder named Public. The network security policy specifies that the Public folder is assigned Read-Only rights to anyone who can log into the server while the Edit rights are assigned only to the network admin group. Which component is addressed in the AAA network service framework?",
        "o": [
            "automation",
            "accounting",
            "authentication",
            "authorization"
        ],
        "a": [
            3
        ]
    },
    {
        "s": 38,
        "q": "What three requirements are defined by the protocols used in network communcations to allow message transmission across a network? (Choose three.)",
        "o": [
            "message size",
            "message encoding",
            "connector specifications",
            "media selection",
            "delivery options",
            "end-device installation"
        ],
        "a": [
            0,
            1,
            4
        ],
        "m": true
    },
    {
        "s": 39,
        "q": "What are two characteristics of IP? (Choose two.)",
        "o": [
            "does not require a dedicated end-to-end connection",
            "operates independently of the network media",
            "retransmits packets if errors occur",
            "re-assembles out of order packets into the correct order at the receiver end",
            "guarantees delivery of packets"
        ],
        "a": [
            0,
            1
        ],
        "m": true
    },
    {
        "s": 40,
        "q": "An employee of a large corporation remotely logs into the company using the appropriate username and password. The employee is attending an important video conference with a customer concerning a large sale. It is important for the video quality to be excellent during the meeting. The employee is unaware that after a successful login, the connection to the company ISP failed. The secondary connection, however, activated within seconds. The disruption was not noticed by the employee or other employees. What three network characteristics are described in this scenario? (Choose three.)",
        "o": [
            "security",
            "quality of service",
            "scalability",
            "powerline networking",
            "integrity",
            "fault tolerance"
        ],
        "a": [
            0,
            1,
            5
        ],
        "m": true
    },
    {
        "s": 41,
        "q": "What are two common causes of signal degradation when using UTP cabling? (Choose two.)",
        "o": [
            "improper termination",
            "low-quality shielding in cable",
            "installing cables in conduit",
            "low-quality cable or connectors",
            "loss of light over long distances"
        ],
        "a": [
            0,
            3
        ],
        "m": true
    },
    {
        "s": 42,
        "q": "Which subnet would include the address 192.168.1.96 as a usable host address?",
        "o": [
            "192.168.1.64/26",
            "192.168.1.32/27",
            "192.168.1.32/28",
            "192.168.1.64/29"
        ],
        "a": [
            0
        ]
    },
    {
        "s": 43,
        "q": "Refer to the exhibit. On the basis of the output, which two statements about network connectivity are correct? (Choose two.)",
        "o": [
            "This host does not have a default gateway configured.",
            "There are 4 hops between this device and the device at 192.168.100.1.",
            "There is connectivity between this device and the device at 192.168.100.1.",
            "The connectivity between these two hosts allows for videoconferencing calls.",
            "The average transmission time between the two hosts is 2 milliseconds."
        ],
        "a": [
            1,
            2
        ],
        "m": true
    },
    {
        "s": 44,
        "q": "Which two statements describe how to assess traffic flow patterns and network traffic types using a protocol analyzer? (Choose two.)",
        "o": [
            "Capture traffic on the weekends when most employees are off work.",
            "Capture traffic during peak utilization times to get a good representation of the different traffic types.",
            "Only capture traffic in the areas of the network that receive most of the traffic such as the data center.",
            "Perform the capture on different network segments.",
            "Only capture WAN traffic because traffic to the web is responsible for the largest amount of traffic on a network."
        ],
        "a": [
            1,
            3
        ],
        "m": true
    },
    {
        "s": 45,
        "q": "What is the consequence of configuring a router with the ipv6 unicast-routing global configuration command?",
        "o": [
            "All router interfaces will be automatically activated.",
            "The IPv6 enabled router interfaces begin sending ICMPv6 Router Advertisement messages.",
            "Each router interface will generate an IPv6 link-local address.",
            "It statically creates a global unicast address on this router."
        ],
        "a": [
            1
        ]
    },
    {
        "s": 46,
        "q": "Which three layers of the OSI model map to the application layer of the TCP/IP model? (Choose three.)",
        "o": [
            "application",
            "network",
            "data link",
            "session",
            "presentation",
            "transport"
        ],
        "a": [
            0,
            3,
            4
        ],
        "m": true
    },
    {
        "s": 47,
        "q": "Refer to the exhibit. If PC1 is sending a packet to PC2 and routing has been configured between the two routers, what will R1 do with the Ethernet frame header attached by PC1?",
        "o": [
            "nothing, because the router has a route to the destination network",
            "open the header and use it to determine whether the data is to be sent out S0/0/0",
            "open the header and replace the destination MAC address with a new one",
            "remove the Ethernet header and configure a new Layer 2 header before sending it out S0/0/0"
        ],
        "a": [
            3
        ]
    },
    {
        "s": 48,
        "q": "What will happen if the default gateway address is incorrectly configured on a host?",
        "o": [
            "The host cannot communicate with other hosts in the local network.",
            "The host cannot communicate with hosts in other networks.",
            "A ping from the host to 127.0.0.1 would not be successful.",
            "The host will have to use ARP to determine the correct address of the default gateway.",
            "The switch will not forward packets initiated by the host."
        ],
        "a": [
            1
        ]
    },
    {
        "s": 49,
        "q": "What are two features of ARP? (Choose two.)",
        "o": [
            "When a host is encapsulating a packet into a frame, it refers to the MAC address table to determine the mapping of IP addresses to MAC addresses.",
            "An ARP request is sent to all devices on the Ethernet LAN and contains the IP address of the destination host and its multicast MAC address.",
            "If a host is ready to send a packet to a local destination device and it has the IP address but not the MAC address of the destination, it generates an ARP broadcast.",
            "If no device responds to the ARP request, then the originating node will broadcast the data packet to all devices on the network segment.",
            "If a device receiving an ARP request has the destination IPv4 address, it responds with an ARP reply."
        ],
        "a": [
            2,
            4
        ],
        "m": true
    },
    {
        "s": 50,
        "q": "A network administrator is adding a new LAN to a branch office. The new LAN must support 90 connected devices. What is the smallest network mask that the network administrator can use for the new network?",
        "o": [
            "255.255.255.128",
            "255.255.255.240",
            "255.255.255.248",
            "255.255.255.224"
        ],
        "a": [
            0
        ]
    },
    {
        "s": 51,
        "q": "What are two ICMPv6 messages that are not present in ICMP for IPv4? (Choose two.)",
        "o": [
            "Neighbor Solicitation",
            "Destination Unreachable",
            "Host Confirmation",
            "Time Exceeded",
            "Router Advertisement",
            "Route Redirection"
        ],
        "a": [
            0,
            4
        ],
        "m": true
    },
    {
        "s": 52,
        "q": "A client packet is received by a server. The packet has a destination port number of 80. What service is the client requesting?",
        "o": [
            "DHCP",
            "SMTP",
            "DNS",
            "HTTP"
        ],
        "a": [
            3
        ]
    },
    {
        "s": 53,
        "q": "What is an advantage for small organizations of adopting IMAP instead of POP?",
        "o": [
            "POP only allows the client to store messages in a centralized way, while IMAP allows distributed storage.",
            "Messages are kept in the mail servers until they are manually deleted from the email client.",
            "When the user connects to a POP server, copies of the messages are kept in the mail server for a short time, but IMAP keeps them for a long time.",
            "IMAP sends and retrieves email, but POP only retrieves email."
        ],
        "a": [
            1
        ]
    },
    {
        "s": 54,
        "q": "A technician can ping the IP address of the web server of a remote company but cannot successfully ping the URL address of the same web server. Which software utility can the technician use to diagnose the problem?",
        "o": [
            "tracert",
            "ipconfig",
            "netstat",
            "nslookup"
        ],
        "a": [
            3
        ]
    },
    {
        "s": 55,
        "q": "Which two functions are performed at the LLC sublayer of the OSI Data Link Layer to facilitate Ethernet communication? (Choose two.)",
        "o": [
            "implements CSMA/CD over legacy shared half-duplex media",
            "enables IPv4 and IPv6 to utilize the same physical medium",
            "integrates Layer 2 flows between 10 Gigabit Ethernet over fiber and 1 Gigabit Ethernet over copper",
            "implements a process to delimit fields within an Ethernet 2 frame",
            "places information in the Ethernet frame that identifies which network layer protocol is being encapsulated by the frame"
        ],
        "a": [
            1,
            4
        ],
        "m": true
    },
    {
        "s": 56,
        "q": "The global configuration command ip default-gateway 172.16.100.1 is applied to a switch. What is the effect of this command?",
        "o": [
            "The switch can communicate with other hosts on the 172.16.100.0 network.",
            "The switch can be remotely managed from a host on another network.",
            "The switch is limited to sending and receiving frames to and from the gateway 172.16.100.1.",
            "The switch will have a management interface with the address 172.16.100.1."
        ],
        "a": [
            1
        ]
    },
    {
        "s": 57,
        "q": "What happens when the transport input ssh command is entered on the switch vty lines?",
        "o": [
            "The SSH client on the switch is enabled.",
            "The switch requires a username/password combination for remote access.",
            "Communication between the switch and remote users is encrypted.",
            "The switch requires remote connections via a proprietary client software."
        ],
        "a": [
            2
        ]
    },
    {
        "s": 58,
        "q": "Match each physical threat type with the cause.",
        "o": [
            "electrical threats -> voltage spikes, brownouts, unconditioned power, and total power loss",
            "hardware threats -> physical damage to servers, routers, switches, cabling plant, and workstations",
            "environmental threats -> temperature extremes or humidity extremes",
            "maintenance threats -> poor handling of electrical components, lack of critical spares, poor cabling, and poor labeling"
        ],
        "a": [
            0,
            1,
            2,
            3
        ],
        "m": true,
        "pairs": [
            [
                "electrical threats",
                "voltage spikes, brownouts, unconditioned power, and total power loss"
            ],
            [
                "hardware threats",
                "physical damage to servers, routers, switches, cabling plant, and workstations"
            ],
            [
                "environmental threats",
                "temperature extremes or humidity extremes"
            ],
            [
                "maintenance threats",
                "poor handling of electrical components, lack of critical spares, poor cabling, and poor labeling"
            ]
        ]
    },
    {
        "s": 59,
        "q": "A disgruntled employee is using some free wireless networking tools to determine information about the enterprise wireless networks. This person is planning on using this information to hack the wireless network. What type of attack is this?",
        "o": [
            "DoS",
            "access",
            "reconnaissance",
            "Trojan horse"
        ],
        "a": [
            2
        ]
    },
    {
        "s": 60,
        "q": "What service is provided by HTTP?",
        "o": [
            "Uses encryption to secure the exchange of text, graphic images, sound, and video on the web.",
            "Allows for data transfers between a client and a file server.",
            "An application that allows real-time chatting among remote users.",
            "A basic set of rules for exchanging text, graphic images, sound, video, and other multimedia files on the web."
        ],
        "a": [
            3
        ]
    },
    {
        "s": 61,
        "q": "A client packet is received by a server. The packet has a destination port number of 67. What service is the client requesting?",
        "o": [
            "FTP",
            "DHCP",
            "Telnet",
            "SSH"
        ],
        "a": [
            1
        ]
    },
    {
        "s": 62,
        "q": "What are two problems that can be caused by a large number of ARP request and reply messages? (Choose two.)",
        "o": [
            "Switches become overloaded because they concentrate all the traffic from the attached subnets.",
            "The ARP request is sent as a broadcast, and will flood the entire subnet.",
            "The network may become overloaded because ARP reply messages have a very large payload due to the 48-bit MAC address and 32-bit IP address that they contain.",
            "A large number of ARP request and reply messages may slow down the switching process, leading the switch to make many changes in its MAC table.",
            "All ARP request messages must be processed by all nodes on the local network."
        ],
        "a": [
            1,
            4
        ],
        "m": true
    },
    {
        "s": 63,
        "q": "A group of Windows PCs in a new subnet has been added to an Ethernet network. When testing the connectivity, a technician finds that these PCs can access local network resources but not the Internet resources. To troubleshoot the problem, the technician wants to initially confirm the IP address and DNS configurations on the PCs, and also verify connectivity to the local router. Which three Windows CLI commands and utilities will provide the necessary information? (Choose three.)",
        "o": [
            "netsh interface ipv6 show neighbor",
            "arp -a",
            "tracert",
            "ping",
            "ipconfig",
            "nslookup",
            "telnet"
        ],
        "a": [
            3,
            4,
            5
        ],
        "m": true
    },
    {
        "s": 64,
        "q": "During the process of forwarding traffic, what will the router do immediately after matching the destination IP address to a network on a directly connected routing table entry?",
        "o": [
            "analyze the destination IP address",
            "switch the packet to the directly connected interface",
            "look up the next-hop address for the packet",
            "discard the traffic after consulting the route table"
        ],
        "a": [
            1
        ]
    },
    {
        "s": 65,
        "q": "What characteristic describes antispyware?",
        "o": [
            "applications that protect end devices from becoming infected with malicious software",
            "a network device that filters access and traffic coming into a network",
            "software on a router that filters traffic based on IP addresses or applications",
            "a tunneling protocol that provides remote users with secure access into the network of an organization"
        ],
        "a": [
            0
        ]
    },
    {
        "s": 66,
        "q": "A network administrator needs to keep the user ID, password, and session contents private when establishing remote CLI connectivity with a switch to manage it. Which access method should be chosen?",
        "o": [
            "Telnet",
            "AUX",
            "SSH",
            "Console"
        ],
        "a": [
            2
        ]
    },
    {
        "s": 67,
        "q": "What are the two most effective ways to defend against malware? (Choose two.)",
        "o": [
            "Implement a VPN.",
            "Implement network firewalls.",
            "Implement RAID.",
            "Implement strong passwords.",
            "Update the operating system and other application software.",
            "Install and update antivirus software."
        ],
        "a": [
            4,
            5
        ],
        "m": true
    },
    {
        "s": 68,
        "q": "Which type of security threat would be responsible if a spreadsheet add-on disables the local software firewall?",
        "o": [
            "brute-force attack",
            "Trojan horse",
            "DoS",
            "buffer overflow"
        ],
        "a": [
            1
        ]
    },
    {
        "s": 69,
        "q": "Which frame field is created by a source node and used by a destination node to ensure that a transmitted data signal has not been altered by interference, distortion, or signal loss?",
        "o": [
            "User Datagram Protocol field",
            "transport layer error check field",
            "flow control field",
            "frame check sequence field",
            "error correction process field"
        ],
        "a": [
            3
        ]
    },
    {
        "s": 70,
        "q": "A network administrator is adding a new LAN to a branch office. The new LAN must support 4 connected devices. What is the smallest network mask that the network administrator can use for the new network?",
        "o": [
            "255.255.255.248",
            "255.255.255.0",
            "255.255.255.128",
            "255.255.255.192"
        ],
        "a": [
            0
        ]
    },
    {
        "s": 71,
        "q": "What service is provided by POP3?",
        "o": [
            "Retrieves email from the server by downloading the email to the local mail application of the client.",
            "An application that allows real-time chatting among remote users.",
            "Allows remote access to network devices and servers.",
            "Uses encryption to provide secure remote access to network devices and servers."
        ],
        "a": [
            0
        ]
    },
    {
        "s": 72,
        "q": "What two security solutions are most likely to be used only in a corporate environment? (Choose two.)",
        "o": [
            "antispyware",
            "virtual private networks",
            "intrusion prevention systems",
            "strong passwords",
            "antivirus software"
        ],
        "a": [
            1,
            2
        ],
        "m": true
    },
    {
        "s": 73,
        "q": "What characteristic describes antivirus software?",
        "o": [
            "applications that protect end devices from becoming infected with malicious software",
            "a network device that filters access and traffic coming into a network",
            "a tunneling protocol that provides remote users with secure access into the network of an organization",
            "software on a router that filters traffic based on IP addresses or applications"
        ],
        "a": [
            0
        ]
    },
    {
        "s": 74,
        "q": "What mechanism is used by a router to prevent a received IPv4 packet from traveling endlessly on a network?",
        "o": [
            "It checks the value of the TTL field and if it is 0, it discards the packet and sends a Destination Unreachable message to the source host.",
            "It checks the value of the TTL field and if it is 100, it discards the packet and sends a Destination Unreachable message to the source host.",
            "It decrements the value of the TTL field by 1 and if the result is 0, it discards the packet and sends a Time Exceeded message to the source host.",
            "It increments the value of the TTL field by 1 and if the result is 100, it discards the packet and sends a Parameter Problem message to the source host."
        ],
        "a": [
            2
        ]
    },
    {
        "s": 75,
        "q": "A client packet is received by a server. The packet has a destination port number of 69. What service is the client requesting?",
        "o": [
            "DNS",
            "DHCP",
            "SMTP",
            "TFTP"
        ],
        "a": [
            3
        ]
    },
    {
        "s": 76,
        "q": "An administrator defined a local user account with a secret password on router R1 for use with SSH. Which three additional steps are required to configure R1 to accept only encrypted SSH connections? (Choose three.)",
        "o": [
            "Configure DNS on the router.",
            "Generate two-way pre-shared keys.",
            "Configure the IP domain name on the router.",
            "Generate the SSH keys.",
            "Enable inbound vty SSH sessions.",
            "Enable inbound vty Telnet sessions."
        ],
        "a": [
            2,
            3,
            4
        ],
        "m": true
    },
    {
        "s": 77,
        "q": "Which two functions are performed at the MAC sublayer of the OSI Data Link Layer to facilitate Ethernet communication? (Choose two.)",
        "o": [
            "handles communication between upper layer networking software and Ethernet NIC hardware",
            "implements trailer with frame check sequence for error detection",
            "places information in the Ethernet frame that identifies which network layer protocol is being encapsulated by the frame",
            "implements a process to delimit fields within an Ethernet 2 frame",
            "adds Ethernet control information to network protocol data"
        ],
        "a": [
            1,
            3
        ],
        "m": true
    },
    {
        "s": 78,
        "q": "An IPv6 enabled device sends a data packet with the destination address of FF02::2. What is the target of this packet?",
        "o": [
            "all IPv6 enabled devices on the local link",
            "all IPv6 DHCP servers",
            "all IPv6 enabled devices across the network",
            "all IPv6 configured routers on the local link"
        ],
        "a": [
            3
        ]
    },
    {
        "s": 79,
        "q": "What are the three parts of an IPv6 global unicast address? (Choose three.)",
        "o": [
            "subnet ID",
            "subnet mask",
            "broadcast address",
            "global routing prefix",
            "interface ID"
        ],
        "a": [
            0,
            3,
            4
        ],
        "m": true
    },
    {
        "s": 80,
        "q": "A network administrator is designing the layout of a new wireless network. Which three areas of concern should be accounted for when building a wireless network? (Choose three.)",
        "o": [
            "extensive cabling",
            "mobility options",
            "packet collision",
            "interference",
            "security",
            "coverage area"
        ],
        "a": [
            3,
            4,
            5
        ],
        "m": true
    },
    {
        "s": 81,
        "q": "A new network administrator has been asked to enter a banner message on a Cisco device. What is the fastest way a network administrator could test whether the banner is properly configured?",
        "o": [
            "Enter CTRL-Z at the privileged mode prompt.",
            "Exit global configuration mode.",
            "Power cycle the device.",
            "Reboot the device.",
            "Exit privileged EXEC mode and press Enter ."
        ],
        "a": [
            4
        ]
    },
    {
        "s": 82,
        "q": "What method is used to manage contention-based access on a wireless network?",
        "o": [
            "token passing",
            "CSMA/CA",
            "priority ordering",
            "CSMA/CD"
        ],
        "a": [
            1
        ]
    },
    {
        "s": 83,
        "q": "What is a function of the data link layer?",
        "o": [
            "provides the formatting of data",
            "provides end-to-end delivery of data between hosts",
            "provides delivery of data between two applications",
            "provides for the exchange of frames over a common local media"
        ],
        "a": [
            3
        ]
    },
    {
        "s": 84,
        "q": "What is the purpose of the TCP sliding window?",
        "o": [
            "to ensure that segments arrive in order at the destination",
            "to end communication when data transmission is complete",
            "to inform a source to retransmit data from a specific point forward",
            "to request that a source decrease the rate at which it transmits data"
        ],
        "a": [
            3
        ]
    },
    {
        "s": 85,
        "q": "What characteristic describes spyware?",
        "o": [
            "a network device that filters access and traffic coming into a network",
            "software that is installed on a user device and collects information about the user",
            "an attack that slows or crashes a device or network service",
            "the use of stolen credentials to access private data"
        ],
        "a": [
            1
        ]
    },
    {
        "s": 86,
        "q": "Which switching method drops frames that fail the FCS check?",
        "o": [
            "store-and-forward switching",
            "borderless switching",
            "ingress port buffering",
            "cut-through switching"
        ],
        "a": [
            0
        ]
    },
    {
        "s": 87,
        "q": "Which range of link-local addresses can be assigned to an IPv6-enabled interface?",
        "o": [
            "FEC0::/10",
            "FDEE::/7",
            "FE80::/10",
            "FF00::/8"
        ],
        "a": [
            2
        ]
    },
    {
        "s": 88,
        "q": "What service is provided by FTP?",
        "o": [
            "A basic set of rules for exchanging text, graphic images, sound, video, and other multimedia files on the web.",
            "An application that allows real-time chatting among remote users.",
            "Allows for data transfers between a client and a file server.",
            "Uses encryption to secure the exchange of text, graphic images, sound, and video on the web."
        ],
        "a": [
            2
        ]
    },
    {
        "s": 89,
        "q": "A user is attempting to access http://www.cisco.com/ without success. Which two configuration values must be set on the host to allow this access? (Choose two.)",
        "o": [
            "DNS server",
            "source port number",
            "HTTP server",
            "source MAC address",
            "default gateway"
        ],
        "a": [
            0,
            4
        ],
        "m": true
    },
    {
        "s": 90,
        "q": "Which two statements accurately describe an advantage or a disadvantage when deploying NAT for IPv4 in a network? (Choose two.)",
        "o": [
            "NAT adds authentication capability to IPv4.",
            "NAT introduces problems for some applications that require end-to-end connectivity.",
            "NAT will impact negatively on switch performance.",
            "NAT provides a solution to slow down the IPv4 address depletion.",
            "NAT improves packet handling.",
            "NAT causes routing tables to include more information."
        ],
        "a": [
            1,
            3
        ],
        "m": true
    },
    {
        "s": 91,
        "q": "What would be the interface ID of an IPv6 enabled interface with a MAC address of 1C-6F-65-C2-BD-F8 when the interface ID is generated by using the EUI-64 process?",
        "o": [
            "0C6F:65FF:FEC2:BDF8",
            "1E6F:65FF:FEC2:BDF8",
            "C16F:65FF:FEC2:BDF8",
            "106F:65FF:FEC2:BDF8"
        ],
        "a": [
            1
        ]
    },
    {
        "s": 92,
        "q": "Refer to the exhibit. PC1 issues an ARP request because it needs to send a packet to PC2. In this scenario, what will happen next?",
        "o": [
            "SW1 will send an ARP reply with the SW1 Fa0/1 MAC address.",
            "SW1 will send an ARP reply with the PC2 MAC address.",
            "PC2 will send an ARP reply with the PC2 MAC address.",
            "RT1 will send an ARP reply with the RT1 Fa0/0 MAC address.",
            "RT1 will send an ARP reply with the PC2 MAC address."
        ],
        "a": [
            2
        ]
    },
    {
        "s": 93,
        "q": "What service is provided by BOOTP?",
        "o": [
            "Uses encryption to secure the exchange of text, graphic images, sound, and video on the web.",
            "Allows for data transfers between a client and a file server.",
            "Legacy application that enables a diskless workstation to discover its own IP address and find a BOOTP server on the network.",
            "A basic set of rules for exchanging text, graphic images, sound, video, and other multimedia files on the web."
        ],
        "a": [
            2
        ]
    },
    {
        "s": 94,
        "q": "What characteristic describes adware?",
        "o": [
            "a network device that filters access and traffic coming into a network",
            "software that is installed on a user device and collects information about the user",
            "the use of stolen credentials to access private data",
            "an attack that slows or crashes a device or network service"
        ],
        "a": [
            1
        ]
    },
    {
        "s": 95,
        "q": "When a switch configuration includes a user-defined error threshold on a per-port basis, to which switching method will the switch revert when the error threshold is reached?",
        "o": [
            "cut-through",
            "store-and-forward",
            "fast-forward",
            "fragment-free"
        ],
        "a": [
            1
        ]
    },
    {
        "s": 96,
        "q": "Match each statement to the related network model.",
        "o": [
            "peer-to-peer network -> no dedicated server is required",
            "peer-to-peer network -> client and server roles are set on a per-request basis",
            "peer-to-peer application -> requires a specific user interface",
            "peer-to-peer application -> a background service is required"
        ],
        "a": [
            0,
            1,
            2,
            3
        ],
        "m": true,
        "pairs": [
            [
                "peer-to-peer network",
                "no dedicated server is required"
            ],
            [
                "peer-to-peer network",
                "client and server roles are set on a per-request basis"
            ],
            [
                "peer-to-peer application",
                "requires a specific user interface"
            ],
            [
                "peer-to-peer application",
                "a background service is required"
            ]
        ]
    },
    {
        "s": 97,
        "q": "What are two primary responsibilities of the Ethernet MAC sublayer? (Choose two.)",
        "o": [
            "error detection",
            "frame delimiting",
            "accessing the media",
            "data encapsulation",
            "logical addressing"
        ],
        "a": [
            2,
            3
        ],
        "m": true
    },
    {
        "s": 98,
        "q": "Refer to the exhibit. What three facts can be determined from the viewable output of the show ip interface brief command? (Choose three.)",
        "o": [
            "Two physical interfaces have been configured.",
            "The switch can be remotely managed.",
            "One device is attached to a physical interface.",
            "Passwords have been configured on the switch.",
            "Two devices are attached to the switch.",
            "The default SVI has been configured."
        ],
        "a": [
            1,
            2,
            5
        ],
        "m": true
    },
    {
        "s": 99,
        "q": "Match each frame field type to its function.",
        "o": [
            "addressing -> helps direct the frame toward its destination",
            "error detection -> checks whether the frame was damaged during transfer",
            "type -> used by LLC to identify the Layer 3 protocol",
            "frame start -> identifies the beginning of a frame"
        ],
        "a": [
            0,
            1,
            2,
            3
        ],
        "m": true,
        "pairs": [
            [
                "addressing",
                "helps direct the frame toward its destination"
            ],
            [
                "error detection",
                "checks whether the frame was damaged during transfer"
            ],
            [
                "type",
                "used by LLC to identify the Layer 3 protocol"
            ],
            [
                "frame start",
                "identifies the beginning of a frame"
            ]
        ]
    },
    {
        "s": 100,
        "q": "What is the subnet ID associated with the IPv6 address 2001:DA48:FC5:A4:3D1B::1/64?",
        "o": [
            "2001:DA48::/64",
            "2001:DA48:FC5::A4:/64",
            "2001:DA48:FC5:A4::/64",
            "2001::/64"
        ],
        "a": [
            2
        ]
    },
    {
        "s": 101,
        "q": "Match each firewall function to the type of threat protection it provides.",
        "o": [
            "application filtering -> prevents access by port number",
            "packet filtering -> prevents access based on IP or MAC address",
            "stateful packet inspection -> prevents unsolicited incoming sessions",
            "URL filtering -> prevents access to websites"
        ],
        "a": [
            0,
            1,
            2,
            3
        ],
        "m": true,
        "pairs": [
            [
                "application filtering",
                "prevents access by port number"
            ],
            [
                "packet filtering",
                "prevents access based on IP or MAC address"
            ],
            [
                "stateful packet inspection",
                "prevents unsolicited incoming sessions"
            ],
            [
                "URL filtering",
                "prevents access to websites"
            ]
        ]
    },
    {
        "s": 102,
        "q": "Users are reporting longer delays in authentication and in accessing network resources during certain time periods of the week. What kind of information should network engineers check to find out if this situation is part of a normal network behavior?",
        "o": [
            "syslog records and messages",
            "the network performance baseline",
            "debug output and packet captures",
            "network configuration files"
        ],
        "a": [
            1
        ]
    },
    {
        "s": 103,
        "q": "How does the service password-encryption command enhance password security on Cisco routers and switches?",
        "o": [
            "It requires encrypted passwords to be used when connecting remotely to a router or switch with Telnet.",
            "It encrypts passwords that are stored in router or switch configuration files.",
            "It requires that a user type encrypted passwords to gain console access to a router or switch.",
            "It encrypts passwords as they are sent across the network."
        ],
        "a": [
            1
        ]
    },
    {
        "s": 104,
        "q": "Which two statements are correct in a comparison of IPv4 and IPv6 packet headers? (Choose two.)",
        "o": [
            "The Source Address field name from IPv4 is kept in IPv6.",
            "The Version field from IPv4 is not kept in IPv6.",
            "The Destination Address field is new in IPv6.",
            "The Header Checksum field name from IPv4 is kept in IPv6.",
            "The Time-to-Live field from IPv4 has been replaced by the Hop Limit field in IPv6."
        ],
        "a": [
            0,
            4
        ],
        "m": true
    },
    {
        "s": 105,
        "q": "A network administrator wants to have the same network mask for all networks at a particular small site. The site has the following networks and number of devices: IP phones \u2013 22 addresses PCs \u2013 20 addresses needed Printers \u2013 2 addresses needed Scanners \u2013 2 addresses needed The network administrator has deemed that 192.168.10.0/24 is to be the network used at this site. Which single subnet mask would make the most efficient use of the available addresses to use for the four subnetworks?",
        "o": [
            "255.255.255.192",
            "255.255.255.252",
            "255.255.255.240",
            "255.255.255.248",
            "255.255.255.0",
            "255.255.255.224"
        ],
        "a": [
            5
        ]
    },
    {
        "s": 106,
        "q": "What characteristic describes identity theft?",
        "o": [
            "the use of stolen credentials to access private data",
            "software on a router that filters traffic based on IP addresses or applications",
            "software that identifies fast-spreading threats",
            "a tunneling protocol that provides remote users with secure access into the network of an organization"
        ],
        "a": [
            0
        ]
    },
    {
        "s": 107,
        "q": "A network administrator is adding a new LAN to a branch office. The new LAN must support 200 connected devices. What is the smallest network mask that the network administrator can use for the new network?",
        "o": [
            "255.255.255.240",
            "255.255.255.0",
            "255.255.255.248",
            "255.255.255.224"
        ],
        "a": [
            1
        ]
    },
    {
        "s": 108,
        "q": "What are three commonly followed standards for constructing and installing cabling? (Choose three.)",
        "o": [
            "cost per meter (foot)",
            "cable lengths",
            "connector color",
            "pinouts",
            "connector types",
            "tensile strength of plastic insulator"
        ],
        "a": [
            1,
            3,
            4
        ],
        "m": true
    },
    {
        "s": 109,
        "q": "Refer to the exhibit. What is wrong with the displayed termination?",
        "o": [
            "The woven copper braid should not have been removed.",
            "The wrong type of connector is being used.",
            "The untwisted length of each wire is too long.",
            "The wires are too thick for the connector that is used."
        ],
        "a": [
            2
        ]
    },
    {
        "s": 110,
        "q": "Match each characteristic to the address category.",
        "o": [
            "IP address -> contained in the Layer 3 header",
            "IP address -> separated into a network portion and a unique identifier",
            "IP address -> 32 or 128 bits",
            "MAC address -> contained in the Layer 2 header",
            "MAC address -> separated into OUI and a unique identifier",
            "MAC address -> 48 bits"
        ],
        "a": [
            0,
            1,
            2,
            3,
            4,
            5
        ],
        "m": true,
        "pairs": [
            [
                "IP address",
                "contained in the Layer 3 header"
            ],
            [
                "IP address",
                "separated into a network portion and a unique identifier"
            ],
            [
                "IP address",
                "32 or 128 bits"
            ],
            [
                "MAC address",
                "contained in the Layer 2 header"
            ],
            [
                "MAC address",
                "separated into OUI and a unique identifier"
            ],
            [
                "MAC address",
                "48 bits"
            ]
        ]
    },
    {
        "s": 111,
        "q": "A client packet is received by a server. The packet has a destination port number of 143. What service is the client requesting?",
        "o": [
            "IMAP",
            "FTP",
            "SSH",
            "Telnet"
        ],
        "a": [
            0
        ]
    },
    {
        "s": 112,
        "q": "What are two characteristics shared by TCP and UDP? (Choose two.)",
        "o": [
            "default window size",
            "connectionless communication",
            "port numbering",
            "3-way handshake",
            "ability to to carry digitized voice",
            "use of checksum"
        ],
        "a": [
            2,
            5
        ],
        "m": true
    },
    {
        "s": 113,
        "q": "Refer to the exhibit. Which two network addresses can be assigned to the network containing 10 hosts? Your answers should waste the fewest addresses, not reuse addresses that are already assigned, and stay within the 10.18.10.0/24 range of addresses. (Choose two.)",
        "o": [
            "10.18.10.200/28",
            "10.18.10.208/28",
            "10.18.10.240/27",
            "10.18.10.200/27",
            "10.18.10.224/27",
            "10.18.10.224/28"
        ],
        "a": [
            1,
            5
        ],
        "m": true
    },
    {
        "s": 114,
        "q": "A client packet is received by a server. The packet has a destination port number of 21. What service is the client requesting?",
        "o": [
            "FTP",
            "LDAP",
            "SLP",
            "SNMP"
        ],
        "a": [
            0
        ]
    },
    {
        "s": 115,
        "q": "What attribute of a NIC would place it at the data link layer of the OSI model?",
        "o": [
            "attached Ethernet cable",
            "IP address",
            "MAC address",
            "RJ-45 port",
            "TCP/IP protocol stack"
        ],
        "a": [
            2
        ]
    },
    {
        "s": 116,
        "q": "A network administrator is adding a new LAN to a branch office. The new LAN must support 10 connected devices. What is the smallest network mask that the network administrator can use for the new network?",
        "o": [
            "255.255.255.192",
            "255.255.255.248",
            "255.255.255.224",
            "255.255.255.240"
        ],
        "a": [
            3
        ]
    },
    {
        "s": 117,
        "q": "What technique is used with UTP cable to help protect against signal interference from crosstalk?",
        "o": [
            "wrapping a foil shield around the wire pairs",
            "twisting the wires together into pairs",
            "terminating the cable with special grounded connectors",
            "encasing the cables within a flexible plastic sheath"
        ],
        "a": [
            1
        ]
    },
    {
        "s": 118,
        "q": "Refer to the exhibit. The network administrator has assigned the LAN of LBMISS an address range of 192.168.10.0. This address range has been subnetted using a /29 prefix. In order to accommodate a new building, the technician has decided to use the fifth subnet for configuring the new network (subnet zero is the first subnet). By company policies, the router interface is always assigned the first usable host address and the workgroup server is given the last usable host address. Which configuration should be entered into the properties of the workgroup server to allow connectivity to the Internet?",
        "o": [
            "IP address: 192.168.10.65 subnet mask: 255.255.255.240, default gateway: 192.168.10.76",
            "IP address: 192.168.10.38 subnet mask: 255.255.255.240, default gateway: 192.168.10.33",
            "IP address: 192.168.10.38 subnet mask: 255.255.255.248, default gateway: 192.168.10.33",
            "IP address: 192.168.10.41 subnet mask: 255.255.255.248, default gateway: 192.168.10.46",
            "IP address: 192.168.10.254 subnet mask: 255.255.255.0, default gateway: 192.168.10.1"
        ],
        "a": [
            2
        ]
    },
    {
        "s": 119,
        "q": "Refer to the exhibit. The switches are in their default configuration. Host A needs to communicate with host D, but host A does not have the MAC address for its default gateway. Which network hosts will receive the ARP request sent by host A?",
        "o": [
            "only host D",
            "only router R1",
            "only hosts A, B, and C",
            "only hosts A, B, C, and D",
            "only hosts B and C",
            "only hosts B, C, and router R1"
        ],
        "a": [
            5
        ]
    },
    {
        "s": 120,
        "q": "Match each statement to the related network model.",
        "o": [
            "peer-to-peer network -> no dedicated server is required",
            "peer-to-peer network -> client and server roles are set on a per-request basis",
            "peer-to-peer application -> requires a specific user interface",
            "peer-to-peer application -> a background service is required"
        ],
        "a": [
            0,
            1,
            2,
            3
        ],
        "m": true,
        "pairs": [
            [
                "peer-to-peer network",
                "no dedicated server is required"
            ],
            [
                "peer-to-peer network",
                "client and server roles are set on a per-request basis"
            ],
            [
                "peer-to-peer application",
                "requires a specific user interface"
            ],
            [
                "peer-to-peer application",
                "a background service is required"
            ]
        ]
    },
    {
        "s": 121,
        "q": "Refer to the exhibit. A network engineer has been given the network address of 192.168.99.0 and a subnet mask of 255.255.255.192 to subnet across the four networks shown. How many total host addresses are unused across all four subnets?",
        "o": [
            "88",
            "200",
            "72",
            "224",
            "158"
        ],
        "a": [
            1
        ]
    },
    {
        "s": 122,
        "q": "Which connector is used with twisted-pair cabling in an Ethernet LAN?",
        "o": [
            "LC connector",
            "SC connector",
            "BNC",
            "RJ-11",
            "RJ-45"
        ],
        "a": [
            4
        ]
    },
    {
        "s": 123,
        "q": "A client packet is received by a server. The packet has a destination port number of 22. What service is the client requesting?",
        "o": [
            "SSH",
            "SMB/CIFS",
            "HTTPS",
            "SLP"
        ],
        "a": [
            0
        ]
    },
    {
        "s": 124,
        "q": "What characteristic describes an IPS?",
        "o": [
            "a tunneling protocol that provides remote users with secure access into the network of an organization",
            "a network device that filters access and traffic coming into a network",
            "software that identifies fast-spreading threats",
            "software on a router that filters traffic based on IP addresses or applications"
        ],
        "a": [
            2
        ]
    },
    {
        "s": 125,
        "q": "What service is provided by DHCP?",
        "o": [
            "An application that allows real-time chatting among remote users.",
            "Allows remote access to network devices and servers.",
            "Dynamically assigns IP addresses to end and intermediary devices.",
            "Uses encryption to provide secure remote access to network devices and servers."
        ],
        "a": [
            2
        ]
    },
    {
        "s": 126,
        "q": "Match each header field with the appropriate OSI model layer.",
        "o": [
            "Layer 2 -> 802.2 header",
            "Layer 2 -> FCS (frame check sequence)",
            "Layer 2 -> destination MAC address",
            "Layer 3 -> source IP address",
            "Layer 3 -> TTL",
            "Layer 4 -> destination port number",
            "Layer 4 -> acknowledgment number"
        ],
        "a": [
            0,
            1,
            2,
            3,
            4,
            5,
            6
        ],
        "m": true,
        "pairs": [
            [
                "Layer 2",
                "802.2 header"
            ],
            [
                "Layer 2",
                "FCS (frame check sequence)"
            ],
            [
                "Layer 2",
                "destination MAC address"
            ],
            [
                "Layer 3",
                "source IP address"
            ],
            [
                "Layer 3",
                "TTL"
            ],
            [
                "Layer 4",
                "destination port number"
            ],
            [
                "Layer 4",
                "acknowledgment number"
            ]
        ]
    },
    {
        "s": 127,
        "q": "Refer to the exhibit. The switches have a default configuration. Host A needs to communicate with host D, but host A does not have the MAC address for the default gateway. Which network devices will receive the ARP request sent by host A?",
        "o": [
            "only host D",
            "only hosts A, B, C, and D",
            "only hosts B and C",
            "only hosts B, C, and router R1",
            "only hosts A, B, and C",
            "only router R1"
        ],
        "a": [
            3
        ]
    },
    {
        "s": 128,
        "q": "Which wireless technology has low-power and low-data rate requirements making it popular in IoT environments?",
        "o": [
            "Bluetooth",
            "Zigbee",
            "WiMAX",
            "Wi-Fi"
        ],
        "a": [
            1
        ]
    },
    {
        "s": 129,
        "q": "What two ICMPv6 message types must be permitted through IPv6 access control lists to allow resolution of Layer 3 addresses to Layer 2 MAC addresses? (Choose two.)",
        "o": [
            "neighbor solicitations",
            "echo requests",
            "neighbor advertisements",
            "echo replies",
            "router solicitations",
            "router advertisements"
        ],
        "a": [
            0,
            2
        ],
        "m": true
    },
    {
        "s": 130,
        "q": "A client is using SLAAC to obtain an IPv6 address for its interface. After an address has been generated and applied to the interface, what must the client do before it can begin to use this IPv6 address?",
        "o": [
            "It must send a DHCPv6 INFORMATION-REQUEST message to request the address of the DNS server.",
            "It must send a DHCPv6 REQUEST message to the DHCPv6 server to request permission to use this address.",
            "It must send an ICMPv6 Router Solicitation message to determine what default gateway it should use.",
            "It must send an ICMPv6 Neighbor Solicitation message to ensure that the address is not already in use on the network."
        ],
        "a": [
            3
        ]
    },
    {
        "s": 131,
        "q": "Two pings were issued from a host on a local network. The first ping was issued to the IP address of the default gateway of the host and it failed. The second ping was issued to the IP address of a host outside the local network and it was successful. What is a possible cause for the failed ping?",
        "o": [
            "The default gateway is not operational.",
            "The default gateway device is configured with the wrong IP address.",
            "Security rules are applied to the default gateway device, preventing it from processing ping requests.",
            "The TCP/IP stack on the default gateway is not working properly."
        ],
        "a": [
            2
        ]
    },
    {
        "s": 132,
        "q": "An organization is assigned an IPv6 address block of 2001:db8:0:ca00::/56. How many subnets can be created without using bits in the interface ID space?",
        "o": [
            "256",
            "512",
            "1024",
            "4096"
        ],
        "a": [
            0
        ]
    },
    {
        "s": 133,
        "q": "What subnet mask is needed if an IPv4 network has 40 devices that need IP addresses and address space is not to be wasted?",
        "o": [
            "255.255.255.0",
            "255.255.255.240",
            "255.255.255.128",
            "255.255.255.192",
            "255.255.255.224"
        ],
        "a": [
            3
        ]
    },
    {
        "s": 134,
        "q": "Refer to the exhibit. If host A sends an IP packet to host B, what will the destination address be in the frame when it leaves host A?",
        "o": [
            "DD:DD:DD:DD:DD:DD",
            "172.168.10.99",
            "CC:CC:CC:CC:CC:CC",
            "172.168.10.65",
            "BB:BB:BB:BB:BB:BB",
            "AA:AA:AA:AA:AA:AA"
        ],
        "a": [
            4
        ]
    },
    {
        "s": 135,
        "q": "What is a benefit of using cloud computing in networking?",
        "o": [
            "Technology is integrated into every-day appliances allowing them to interconnect with other devices, making them more \u2018smart\u2019 or automated.",
            "Network capabilities are extended without requiring investment in new infrastructure, personnel, or software.",
            "End users have the freedom to use personal tools to access information and communicate across a business network.",
            "Home networking uses existing electrical wiring to connect devices to the network wherever there is an electrical outlet, saving the cost of installing data cables."
        ],
        "a": [
            1
        ]
    },
    {
        "s": 136,
        "q": "Which two statements are correct about MAC and IP addresses during data transmission if NAT is not involved? (Choose two.)",
        "o": [
            "Destination IP addresses in a packet header remain constant along the entire path to a target host.",
            "Destination MAC addresses will never change in a frame that goes across seven routers.",
            "Every time a frame is encapsulated with a new destination MAC address, a new destination IP address is needed.",
            "Destination and source MAC addresses have local significance and change every time a frame goes from one LAN to another.",
            "A packet that has crossed four routers has changed the destination IP address four times."
        ],
        "a": [
            0,
            3
        ],
        "m": true
    },
    {
        "s": 137,
        "q": "What is one main characteristic of the data link layer?",
        "o": [
            "It generates the electrical or optical signals that represent the 1 and 0 on the media.",
            "It converts a stream of data bits into a predefined code.",
            "It shields the upper layer protocol from being aware of the physical medium to be used in the communication.",
            "It accepts Layer 3 packets and decides the path by which to forward the packet to a remote network."
        ],
        "a": [
            2
        ]
    },
    {
        "s": 138,
        "q": "What are three characteristics of the CSMA/CD process? (Choose three.)",
        "o": [
            "The device with the electronic token is the only one that can transmit after a collision.",
            "A device listens and waits until the media is not busy before transmitting.",
            "After detecting a collision, hosts can attempt to resume transmission after a random time delay has expired.",
            "All of the devices on a segment see data that passes on the network medium.",
            "A jam signal indicates that the collision has cleared and the media is not busy.",
            "Devices can be configured with a higher transmission priority."
        ],
        "a": [
            1,
            2,
            3
        ],
        "m": true
    },
    {
        "s": 139,
        "q": "Which information does the show startup-config command display?",
        "o": [
            "the IOS image copied into RAM",
            "the bootstrap program in the ROM",
            "the contents of the current running configuration file in the RAM",
            "the contents of the saved configuration file in the NVRAM"
        ],
        "a": [
            3
        ]
    },
    {
        "s": 140,
        "q": "Which two commands can be used on a Windows host to display the routing table? (Choose two.)",
        "o": [
            "netstat -s",
            "route print",
            "show ip route",
            "netstat -r",
            "tracert"
        ],
        "a": [
            1,
            3
        ],
        "m": true
    },
    {
        "s": 141,
        "q": "What are two functions that are provided by the network layer? (Choose two.)",
        "o": [
            "directing data packets to destination hosts on other networks",
            "placing data on the network medium",
            "carrying data between processes that are running on source and destination hosts",
            "providing dedicated end-to-end connections",
            "providing end devices with a unique network identifier"
        ],
        "a": [
            0,
            4
        ],
        "m": true
    },
    {
        "s": 142,
        "q": "Which two statements describe features of an IPv4 routing table on a router? (Choose two.)",
        "o": [
            "Directly connected interfaces will have two route source codes in the routing table: C and S .",
            "If there are two or more possible routes to the same destination, the route associated with the higher metric value is included in the routing table.",
            "The netstat -r command can be used to display the routing table of a router.",
            "The routing table lists the MAC addresses of each active interface.",
            "It stores information about routes derived from the active router interfaces.",
            "If a default static route is configured in the router, an entry will be included in the routing table with source code S ."
        ],
        "a": [
            4,
            5
        ],
        "m": true
    },
    {
        "s": 143,
        "q": "What characteristic describes a VPN?",
        "o": [
            "software on a router that filters traffic based on IP addresses or applications",
            "software that identifies fast-spreading threats",
            "a tunneling protocol that provides remote users with secure access into the network of an organization",
            "a network device that filters access and traffic coming into a network"
        ],
        "a": [
            2
        ]
    },
    {
        "s": 144,
        "q": "Why would a Layer 2 switch need an IP address?",
        "o": [
            "to enable the switch to send broadcast frames to attached PCs",
            "to enable the switch to function as a default gateway",
            "to enable the switch to be managed remotely",
            "to enable the switch to receive frames from attached PCs"
        ],
        "a": [
            2
        ]
    },
    {
        "s": 145,
        "q": "Match each description to its corresponding term.",
        "o": [
            "message encapsulation -> placing one message format inside another message format",
            "message sizing -> breaking up a long message into individual pieces before sending it",
            "message encoding -> converting information from one format into another acceptable for transmission"
        ],
        "a": [
            0,
            1,
            2
        ],
        "m": true,
        "pairs": [
            [
                "message encapsulation",
                "placing one message format inside another message format"
            ],
            [
                "message sizing",
                "breaking up a long message into individual pieces before sending it"
            ],
            [
                "message encoding",
                "converting information from one format into another acceptable for transmission"
            ]
        ]
    },
    {
        "s": 146,
        "q": "A user sends an HTTP request to a web server on a remote network. During encapsulation for this request, what information is added to the address field of a frame to indicate the destination?",
        "o": [
            "the network domain of the destination host",
            "the IP address of the default gateway",
            "the MAC address of the destination host",
            "the MAC address of the default gateway"
        ],
        "a": [
            3
        ]
    },
    {
        "s": 147,
        "q": "What is an advantage to using a protocol that is defined by an open standard?",
        "o": [
            "A company can monopolize the market.",
            "The protocol can only be run on equipment from a specific vendor.",
            "An open standard protocol is not controlled or regulated by standards organizations.",
            "It encourages competition and promotes choices."
        ],
        "a": [
            3
        ]
    },
    {
        "s": 148,
        "q": "Data is being sent from a source PC to a destination server. Which three statements correctly describe the function of TCP or UDP in this situation? (Choose three.)",
        "o": [
            "The source port field identifies the running application or service that will handle data returning to the PC.",
            "The TCP process running on the PC randomly selects the destination port when establishing a session with the server.",
            "UDP segments are encapsulated within IP packets for transport across the network.",
            "The UDP destination port number identifies the application or service on the server which will handle the data.",
            "TCP is the preferred protocol when a function requires lower network overhead.",
            "The TCP source port number identifies the sending host on the network."
        ],
        "a": [
            0,
            2,
            3
        ],
        "m": true
    },
    {
        "s": 149,
        "q": "Match each description with the corresponding TCP mechanism.",
        "o": [
            "window size -> number of bytes a destination device can accept and process at one time",
            "sequence numbers -> used to identify missing segments of data",
            "retransmission -> method of managing segment data loss",
            "acknowledgment -> received by a sender before transmitting more segments in a session"
        ],
        "a": [
            0,
            1,
            2,
            3
        ],
        "m": true,
        "pairs": [
            [
                "window size",
                "number of bytes a destination device can accept and process at one time"
            ],
            [
                "sequence numbers",
                "used to identify missing segments of data"
            ],
            [
                "retransmission",
                "method of managing segment data loss"
            ],
            [
                "acknowledgment",
                "received by a sender before transmitting more segments in a session"
            ]
        ]
    },
    {
        "s": 150,
        "q": "Refer to the exhibit. A company uses the address block of 128.107.0.0/16 for its network. What subnet mask would provide the maximum number of equal size subnets while providing enough host addresses for each subnet in the exhibit?",
        "o": [
            "255.255.255.192",
            "255.255.255.0",
            "255.255.255.128",
            "255.255.255.240",
            "255.255.255.224"
        ],
        "a": [
            2
        ]
    },
    {
        "s": 151,
        "q": "A network administrator wants to have the same subnet mask for three subnetworks at a small site. The site has the following networks and numbers of devices: Subnetwork A: IP phones \u2013 10 addresses Subnetwork B: PCs \u2013 8 addresses Subnetwork C: Printers \u2013 2 addresses What single subnet mask would be appropriate to use for the three subnetworks?",
        "o": [
            "255.255.255.0",
            "255.255.255.240",
            "255.255.255.248",
            "255.255.255.252"
        ],
        "a": [
            1
        ]
    },
    {
        "s": 152,
        "q": "Match each item to the type of topology diagram on which it is typically identified.",
        "o": [
            "physical topology diagram -> location of a desktop PC in a classroom",
            "physical topology diagram -> path of cables that connect rooms to wiring closets",
            "logical topology diagram -> IP address of a server"
        ],
        "a": [
            0,
            1,
            2
        ],
        "m": true,
        "pairs": [
            [
                "physical topology diagram",
                "location of a desktop PC in a classroom"
            ],
            [
                "physical topology diagram",
                "path of cables that connect rooms to wiring closets"
            ],
            [
                "logical topology diagram",
                "IP address of a server"
            ]
        ]
    },
    {
        "s": 153,
        "q": "What two pieces of information are displayed in the output of the show ip interface brief command? (Choose two.)",
        "o": [
            "IP addresses",
            "interface descriptions",
            "MAC addresses",
            "next-hop addresses",
            "Layer 1 statuses",
            "speed and duplex settings"
        ],
        "a": [
            0,
            4
        ],
        "m": true
    },
    {
        "s": 154,
        "q": "A user is complaining that an external web page is taking longer than normal to load.The web page does eventually load on the user machine. Which tool should the technician use with administrator privileges in order to locate where the issue is in the network?",
        "o": [
            "ping",
            "nslookup",
            "tracert",
            "ipconfig /displaydns"
        ],
        "a": [
            2
        ]
    },
    {
        "s": 155,
        "q": "Which value, that is contained in an IPv4 header field, is decremented by each router that receives a packet?",
        "o": [
            "Header Length",
            "Differentiated Services",
            "Time-to-Live",
            "Fragment Offset"
        ],
        "a": [
            2
        ]
    },
    {
        "s": 156,
        "q": "A network technician is researching the use of fiber optic cabling in a new technology center. Which two issues should be considered before implementing fiber optic media? (Choose two.)",
        "o": [
            "Fiber optic cabling requires different termination and splicing expertise from what copper cabling requires.",
            "Fiber optic cabling requires specific grounding to be immune to EMI.",
            "Fiber optic cabling is susceptible to loss of signal due to RFI.",
            "Fiber optic cable is able to withstand rough handling.",
            "Fiber optic provides higher data capacity but is more expensive than copper cabling."
        ],
        "a": [
            0,
            4
        ],
        "m": true
    },
    {
        "s": 157,
        "q": "Match each description with an appropriate IP address.",
        "o": [
            "an experimental address -> 240.2.6.255",
            "a link-local address -> 169.254.1.5",
            "a public address -> 198.133.219.2",
            "a loopback address -> 127.0.0.1"
        ],
        "a": [
            0,
            1,
            2,
            3
        ],
        "m": true,
        "pairs": [
            [
                "an experimental address",
                "240.2.6.255"
            ],
            [
                "a link-local address",
                "169.254.1.5"
            ],
            [
                "a public address",
                "198.133.219.2"
            ],
            [
                "a loopback address",
                "127.0.0.1"
            ]
        ]
    },
    {
        "s": 158,
        "q": "A user is executing a tracert to a remote device. At what point would a router, which is in the path to the destination device, stop forwarding the packet?",
        "o": [
            "when the router receives an ICMP Time Exceeded message",
            "when the RTT value reaches zero",
            "when the host responds with an ICMP Echo Reply message",
            "when the value in the TTL field reaches zero",
            "when the values of both the Echo Request and Echo Reply messages reach zero"
        ],
        "a": [
            3
        ]
    },
    {
        "s": 159,
        "q": "Users report that the network access is slow. After questioning the employees, the network administrator learned that one employee downloaded a third-party scanning program for the printer. What type of malware might be introduced that causes slow performance of the network?",
        "o": [
            "virus",
            "worm",
            "phishing",
            "spam"
        ],
        "a": [
            1
        ]
    },
    {
        "s": 160,
        "q": "Which two functions are performed at the MAC sublayer of the OSI Data Link Layer to facilitate Ethernet communication? (Choose two.)",
        "o": [
            "places information in the Ethernet frame that identifies which network layer protocol is being encapsulated by the frame",
            "adds Ethernet control information to network protocol data",
            "responsible for internal structure of Ethernet frame",
            "enables IPv4 and IPv6 to utilize the same physical medium",
            "implements trailer with frame check sequence for error detection"
        ],
        "a": [
            2,
            4
        ],
        "m": true
    },
    {
        "s": 161,
        "q": "Which two functions are performed at the MAC sublayer of the OSI Data Link Layer to facilitate Ethernet communication? (Choose two.)",
        "o": [
            "integrates Layer 2 flows between 10 Gigabit Ethernet over fiber and 1 Gigabit Ethernet over copper",
            "enables IPv4 and IPv6 to utilize the same physical medium",
            "handles communication between upper layer networking software and Ethernet NIC hardware",
            "adds Ethernet control information to network protocol data",
            "implements CSMA/CD over legacy shared half-duplex media"
        ],
        "a": [
            0,
            4
        ],
        "m": true
    },
    {
        "s": 162,
        "q": "Which two functions are performed at the MAC sublayer of the OSI Data Link Layer to facilitate Ethernet communication? (Choose two.)",
        "o": [
            "applies delimiting of Ethernet frame fields to synchronize communication between nodes",
            "applies source and destination MAC addresses to Ethernet frame",
            "places information in the Ethernet frame that identifies which network layer protocol is being encapsulated by the frame",
            "handles communication between upper layer networking software and Ethernet NIC hardware",
            "adds Ethernet control information to network protocol data"
        ],
        "a": [
            0,
            1
        ],
        "m": true
    }
].map((item, idx) => ({ ...common, si: idx + 1, page: item.s, ...item }));

  window.QUESTIONS_RAW = (window.QUESTIONS_RAW || []).concat(items);
})();
