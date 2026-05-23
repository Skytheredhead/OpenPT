// CCNA Semester 3 Module 13-14 review quiz import.
// Source: /Users/skylarenns/Downloads/sem3 mod 13-14.pdf
(function () {
  const bank = 'ccna/sem-03/m-13-14';
  const common = {
    bank,
    course: 'CCNA',
    semester: 'Semester 3',
    exam: 'Module 13-14 Quiz',
    src: 'Sem 3 Module 13-14 Quiz',
  };
  const items = [
    { s: 3, q: 'Which two benefits are gained when an organization adopts cloud computing and virtualization? (Choose two.)', o: ['pay-as-you-go computing and storage expenses', 'rapid response to increasing data volume requirements', 'elimination of vulnerability to cyber attacks', 'distributed processing of terabyte-size data sets', 'increased dependence on onsite IT resources'], a: [0, 1], m: true },
    { s: 3, q: 'Which technology allows users to access data anywhere and at any time?', o: ['data analytics', 'cloud computing', 'virtualization', 'micromarketing'], a: [1] },
    { s: 4, q: 'Which cloud computing model provides the use of network hardware such as routers and switches for a company?', o: ['browser as a service (BaaS)', 'infrastructure as a service (IaaS)', 'software as a service (SaaS)', 'wireless as a service (WaaS)'], a: [1] },
    { s: 4, q: 'Which cloud model provides services for a specific organization or entity?', o: ['hybrid cloud', 'community cloud', 'public cloud', 'private cloud'], a: [3] },
    { s: 6, q: 'Which two functions are performed by hypervisors? (Choose two.)', o: ['partition the hard drive to run virtual machines', 'protect the host from malware infection from virtual machines', 'manage virtual machines', 'allocate physical system resources to virtual machines', 'share antivirus software across virtual machines'], a: [2, 3], m: true },
    { s: 7, q: 'A small company is moving many data center functions to the cloud. Which three advantages can this provide? (Choose three.)', o: ['The company pays only for processing and storage capacity it uses.', 'Cloud services are billed at a fixed fee regardless of use.', 'Cloud services let the company own and administer its own servers.', 'The company can increase and decrease capacity as needed.', 'Single-tenant data centers easily grow to accommodate storage requirements.', 'The company does not need to handle increasing storage and processing demands with in-house data center equipment.'], a: [0, 3, 5], m: true },
    { s: 7, q: 'How does virtualization help with disaster recovery in a data center?', o: ['guarantee of power', 'support of live migration', 'supply of consistent air flow', 'improvement of business practices'], a: [1] },
    { s: 8, q: 'Which type of hypervisor is used when a laptop running macOS installs a Windows virtual OS instance?', o: ['virtual machine', 'bare metal', 'type 1', 'type 2'], a: [3] },
    { s: 8, q: 'Which statement describes a difference between cloud computing and virtualization?', o: ['Cloud computing uses data center technology whereas virtualization is not used in data centers.', 'Cloud computing requires hypervisors whereas virtualization is only fault tolerance.', 'Cloud computing separates the application from hardware whereas virtualization separates the OS from hardware.', 'Cloud computing provides virtualized internet connections inside data centers.'], a: [2] },
    { s: 9, q: 'Which type of hypervisor is most likely used in a data center?', o: ['type 1', 'type 2', 'Nexus', 'Hadoop'], a: [0] },
    { s: 10, q: 'Which statement is a characteristic of a type 1 hypervisor?', o: ['It does not require management console software.', 'It is installed directly on a server.', 'It is installed on an existing operating system.', 'It is used only for desktop virtualization.'], a: [1] },
    { s: 11, q: 'A company wants to use idle system resources, consolidate servers, and run multiple operating systems on one hardware platform. Which technology supports this?', o: ['virtualization', 'Cisco ACI', 'software-defined networking', 'dedicated servers'], a: [0] },
    { s: 12, q: 'Which two OSI layers are associated with SDN control-plane functions that make forwarding decisions? (Choose two.)', o: ['Layer 1', 'Layer 2', 'Layer 3', 'Layer 4', 'Layer 5'], a: [1, 2], m: true },
    { s: 12, q: 'What is a function of the data plane of a network device?', o: ['resolving MAC addresses', 'building the routing table', 'forwarding traffic flows', 'sending information to the CPU for processing'], a: [2] },
    { s: 13, q: 'What pre-populates the FIB on Cisco devices that use CEF to process packets?', o: ['the routing table', 'the ARP table', 'the DSP', 'the adjacency table'], a: [0] },
    { s: 13, q: 'Which technology virtualizes the network control plane and moves it to a centralized controller?', o: ['SDN', 'Cisco ACI', 'Hadoop', 'Nexus'], a: [0] },
    { s: 15, q: 'Which component is considered the brains of Cisco ACI architecture and translates application policies?', o: ['Nexus 9000 switch', 'Application Policy Infrastructure Controller', 'Application Network Profile endpoints', 'hypervisor'], a: [1] },
    { s: 15, q: 'A company has overloaded onsite systems after a multicontinent advertising campaign and has no room to expand. Which service or technology supports this requirement?', o: ['cloud services', 'data center', 'virtualization', 'dedicated servers'], a: [0] },
    { s: 16, q: 'A company plans to buy more servers because of enormous web traffic growth. Which service or technology supports this requirement?', o: ['dedicated servers', 'APIC-EM', 'Cisco ACI', 'software-defined networking'], a: [0] },
    { s: 16, q: 'Programmers need Windows, Linux, and macOS on their computers to control and test automation products. Which technology supports this requirement?', o: ['virtualization', 'software-defined networking', 'Cisco ACI', 'dedicated servers'], a: [0] },
    { s: 17, q: 'A network administrator needs a backup site for all company server data as part of disaster recovery. Which service or technology supports this?', o: ['dedicated servers', 'software-defined networking', 'data center', 'virtualization'], a: [2] },
    { s: 20, q: 'Which data format is shown by braces, key-value pairs, and quoted fields such as `"message": "success"`?', o: ['XML', 'YAML', 'JSON', 'HTML'], a: [2] },
    { s: 21, q: 'What is YAML?', o: ['a web application', 'a scripting language', 'a data format and superset of JSON', 'a compiled programming language'], a: [2] },
    { s: 21, q: 'How is YAML data structure different from JSON?', o: ['It uses indentation instead of brackets and commas.', 'It requires semicolons after every value.', 'It stores data only in binary format.', 'It cannot represent nested data.'], a: [0] },
    { s: 22, q: 'What is a difference between XML and HTML data formats?', o: ['XML formats data in binary whereas HTML uses plain text.', 'XML does not use predefined tags whereas HTML does.', 'XML does not require indentation but HTML does.', 'XML cannot contain nested elements whereas HTML can.'], a: [1] },
    { s: 23, q: 'Which scenario describes a public API?', o: ['It can be used with no restrictions.', 'It is used only within an organization.', 'It requires a license.', 'It is available only to contracted partners.'], a: [0] },
    { s: 24, q: 'In which situation would a partner API be appropriate?', o: ['A vacation site interacts with hotel databases to display availability.', 'Company sales staff access internal sales data from mobile devices.', 'A search engine allows developers to integrate search into their own apps.', 'A user creates an external account using social media credentials.'], a: [0] },
    { s: 24, q: 'What is the most widely used API type for web services?', o: ['REST', 'SOAP', 'JSON-RPC', 'XML-RPC'], a: [0] },
    { s: 25, q: 'What is REST?', o: ['an architectural style for web service APIs', 'a structured data storage and interchange format', 'a human-readable data structure used by applications', 'a protocol for managing nodes on an IP network'], a: [0] },
    { s: 26, q: 'What is the function of the key contained in most RESTful API requests?', o: ['It authenticates or identifies the requesting source.', 'It is the top-level object of the API query.', 'It represents the main query component in the API request.', 'It encrypts the message body for an API request.'], a: [0] },
    { s: 27, q: 'Which RESTful operation corresponds to the HTTP GET method?', o: ['read', 'update', 'patch', 'post'], a: [0] },
    { s: 28, q: 'Which two configuration management tools are developed using Ruby? (Choose two.)', o: ['Chef', 'Ansible', 'Puppet', 'SaltStack', 'RESTCONF'], a: [0, 2], m: true },
    { s: 29, q: 'Which term describes a set of instructions for execution by Puppet?', o: ['Pillar', 'Manifest', 'Playbook', 'Cookbook'], a: [1] },
    { s: 30, q: 'Which term describes a set of instructions for execution by SaltStack?', o: ['Pillar', 'Manifest', 'Playbook', 'Cookbook'], a: [0] },
  ].map((item, idx) => ({ ...common, si: idx + 1, page: item.s, ...item }));

  window.QUESTIONS_RAW = (window.QUESTIONS_RAW || []).concat(items);
})();
