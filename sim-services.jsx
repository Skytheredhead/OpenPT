// sim-services.jsx - shared desktop application protocol simulation helpers.
// Loaded in-browser before CLI and app UI so both surfaces answer consistently.

(function () {
  const SERVICE_PORTS = {
    ftp: 21, ssh: 22, telnet: 23, smtp: 25, dns: 53, dhcp: 67, tftp: 69,
    http: 80, pop3: 110, ntp: 123, snmp: 161, radius: 1645, https: 443,
    syslog: 514, aaa: 1645, vpn: 500, pppoe: 8863, voice: 5060, iot: 80,
  };

  const isIpv4 = (value) => /^\d{1,3}(?:\.\d{1,3}){3}$/.test(String(value || "").trim());
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const nowStamp = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const cleanName = (value) => String(value || "").trim().replace(/\.$/, "");
  const lower = (value) => cleanName(value).toLowerCase();

  function serverConfig(device = {}) {
    const services = device.services || {};
    const saved = device.serverConfig || {};
    return {
      http: { http: services.http ?? true, https: services.https ?? true, files: [], ...(saved.http || {}) },
      dns: { service: services.dns ?? true, records: [], ...(saved.dns || {}) },
      email: { smtp: services.smtp ?? true, pop3: services.pop3 ?? true, domain: "", users: [], ...(saved.email || {}) },
      aaa: { service: services.aaa ?? true, clients: [], users: [], ...(saved.aaa || {}) },
      ftp: { service: services.ftp ?? true, users: [], files: [], ...(saved.ftp || {}) },
      tftp: { service: services.tftp ?? true, files: [], ...(saved.tftp || {}) },
      ntp: { service: services.ntp ?? true, ...(saved.ntp || {}) },
      syslog: { service: services.syslog ?? true, logs: [], ...(saved.syslog || {}) },
      iot: { service: services.iot ?? false, registrations: [], devices: [], ...(saved.iot || {}) },
      vm: { service: services.vm ?? true, vms: [], ...(saved.vm || {}) },
    };
  }

  function ensureRuntime(device, section) {
    device.appRuntime = device.appRuntime || {};
    if (section && !device.appRuntime[section]) device.appRuntime[section] = {};
    return section ? device.appRuntime[section] : device.appRuntime;
  }

  function ensureSettings(device, appKey) {
    device.appSettings = device.appSettings || {};
    device.appSettings[appKey] = device.appSettings[appKey] || {};
    return device.appSettings[appKey];
  }

  function primaryInterface(device) {
    if (!device) return ["", {}];
    for (const preferred of ["eth0", "en0", "wlan0"]) {
      if (device.interfaces?.[preferred]) return [preferred, device.interfaces[preferred]];
    }
    return Object.entries(device.interfaces || {})[0] || ["", {}];
  }

  function primaryIp(device) {
    const [, iface] = primaryInterface(device);
    if (iface?.ip) return iface.ip;
    return Object.values(device?.interfaces || {}).find((ifc) => ifc.ip)?.ip || "";
  }

  function deviceByIpOrName(devices, target) {
    const wanted = lower(target);
    if (!wanted) return null;
    return Object.values(devices || {}).find((device) => {
      if ([device.hostname, device.name, device.model].some((v) => lower(v) === wanted)) return true;
      return Object.values(device.interfaces || {}).some((ifc) => lower(ifc.ip) === wanted);
    }) || null;
  }

  function servicePort(name) {
    return SERVICE_PORTS[name] || 0;
  }

  function serviceEnabled(device, name) {
    if (!device) return false;
    if (Object.prototype.hasOwnProperty.call(device.services || {}, name)) return !!device.services[name];
    const cfg = serverConfig(device);
    if (name === "http") return cfg.http.http ?? false;
    if (name === "https") return cfg.http.https ?? false;
    if (name === "smtp") return cfg.email.smtp ?? false;
    if (name === "pop3") return cfg.email.pop3 ?? false;
    if (name === "dns") return cfg.dns.service ?? false;
    if (name === "ftp") return cfg.ftp.service ?? device.kind === "server";
    if (name === "tftp") return cfg.tftp.service ?? false;
    if (name === "ntp") return cfg.ntp.service ?? false;
    if (name === "aaa" || name === "radius") return cfg.aaa.service ?? false;
    if (name === "syslog") return cfg.syslog.service ?? false;
    if (name === "iot") return cfg.iot.service ?? false;
    if (name === "snmp") return !!(device.snmp?.communities?.length || device.services?.snmp);
    if (name === "vpn") return !!(device.services?.vpn || device.vpn?.service);
    if (name === "pppoe") return !!(device.services?.pppoe || device.pppoe?.service);
    if (name === "voice") return !!(device.services?.voice || device.services?.callManager || device.voice?.service);
    return !!device.services?.[name];
  }

  function resolveName({ devices, target }) {
    const clean = cleanName(target);
    if (!clean) return { ok: false, error: "No target specified", target: clean, ip: "" };
    if (isIpv4(clean)) return { ok: true, target: clean, ip: clean, source: "literal" };
    const device = deviceByIpOrName(devices, clean);
    if (device) return { ok: true, target: clean, ip: primaryIp(device), device, source: "device" };
    for (const server of Object.values(devices || {})) {
      const cfg = serverConfig(server);
      if (!serviceEnabled(server, "dns")) continue;
      for (const record of cfg.dns.records || []) {
        const name = lower(record.name);
        const type = lower(record.type || "A Record");
        if (name === lower(clean) && (!type || type.includes("a record") || type === "a")) {
          return { ok: true, target: clean, ip: record.detail || "", device: deviceByIpOrName(devices, record.detail), dnsServerId: server.id, source: "dns" };
        }
      }
    }
    return { ok: false, target: clean, ip: "", error: `${clean} could not be resolved` };
  }

  function firewallRules(device, family = "firewall") {
    const settings = device?.appSettings?.[family] || {};
    return Array.isArray(settings.rules) ? settings.rules : [];
  }

  function matchRuleValue(ruleValue, actual) {
    const value = lower(ruleValue || "any");
    if (!value || value === "any" || value === "*") return true;
    return value === lower(actual);
  }

  function evaluateFirewall({ device, direction = "in", srcIp, dstIp, protocol = "tcp", port, family = "firewall" }) {
    if (!device) return { ok: true, action: "allow", note: "No firewall device" };
    const settings = device.appSettings?.[family] || {};
    if (!settings.enabled) return { ok: true, action: "allow", note: "Firewall disabled" };
    const rules = firewallRules(device, family).filter((rule) => rule.enabled !== false);
    for (const rule of rules) {
      if (rule.direction && rule.direction !== "both" && rule.direction !== direction) continue;
      if (!matchRuleValue(rule.protocol, protocol)) continue;
      if (!matchRuleValue(rule.src, srcIp)) continue;
      if (!matchRuleValue(rule.dst, dstIp)) continue;
      if (!matchRuleValue(rule.port, port || "")) continue;
      const action = lower(rule.action || "allow").startsWith("deny") ? "deny" : "allow";
      const verb = action === "deny" ? "denies" : "allows";
      return { ok: action === "allow", action, rule, note: `${device.hostname} firewall ${verb} ${protocol}/${port || "*"}` };
    }
    const defaultAction = lower(settings.defaultAction || "Allow").startsWith("deny") ? "deny" : "allow";
    return { ok: defaultAction === "allow", action: defaultAction, note: `${device.hostname} firewall default ${defaultAction}` };
  }

  function checkReachability({ devices, links, sourceId, targetIp, protocol = "tcp", port, service }) {
    const source = devices?.[sourceId];
    const target = deviceByIpOrName(devices, targetIp);
    if (!source) return { ok: false, error: "Source device not found" };
    if (!targetIp) return { ok: false, error: "Target IP missing" };
    if (target?.id === sourceId) {
      if (service && !serviceEnabled(target, service)) return { ok: false, error: `${target.hostname} ${service.toUpperCase()} service is off`, target };
      return { ok: true, plan: { ok: true, hops: [{ devId: sourceId, action: "local", note: "local service" }] }, target, srcIp: primaryIp(source), dstIp: targetIp };
    }
    const plan = window.OPT_Engine?.planPath ? window.OPT_Engine.planPath(devices, links || [], sourceId, targetIp) : { ok: true, hops: [] };
    if (!plan.ok) return { ok: false, error: plan.error || "No route to host", plan };
    if (service && target && !serviceEnabled(target, service)) {
      return { ok: false, error: `${target.hostname} ${service.toUpperCase()} service is off`, plan, target };
    }
    const srcIp = primaryIp(source);
    const dstIp = targetIp;
    const sourceFirewall = evaluateFirewall({ device: source, direction: "out", srcIp, dstIp, protocol, port });
    if (!sourceFirewall.ok) return { ok: false, error: sourceFirewall.note, plan, target };
    const targetFirewall = evaluateFirewall({ device: target, direction: "in", srcIp, dstIp, protocol, port });
    if (!targetFirewall.ok) return { ok: false, error: targetFirewall.note, plan, target };
    return { ok: true, plan, target, srcIp, dstIp };
  }

  function parseUrl(url) {
    const raw = String(url || "").trim();
    const withScheme = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
    const withoutScheme = withScheme.replace(/^https?:\/\//i, "");
    const host = withoutScheme.split(/[/:]/)[0];
    const path = `/${withoutScheme.split("/").slice(1).join("/") || "index.html"}`.replace(/\/$/, "/index.html");
    const service = /^https:\/\//i.test(withScheme) ? "https" : "http";
    return { raw: withScheme, host, path, service };
  }

  function requestHttp({ devices, links, sourceId, url }) {
    const parsed = parseUrl(url);
    const resolved = resolveName({ devices, sourceId, target: parsed.host });
    if (!resolved.ok || !resolved.ip) return { ok: false, url: parsed.raw, status: 0, error: resolved.error || `Could not resolve ${parsed.host}` };
    const reach = checkReachability({ devices, links, sourceId, targetIp: resolved.ip, protocol: "tcp", port: servicePort(parsed.service), service: parsed.service });
    if (!reach.ok) return { ok: false, url: parsed.raw, status: 0, error: reach.error, plan: reach.plan };
    const target = reach.target || deviceByIpOrName(devices, resolved.ip);
    const fileName = parsed.path.replace(/^\//, "") || "index.html";
    const cfg = serverConfig(target);
    const serverFile = (cfg.http.files || []).find((file) => file.name === fileName) || (cfg.http.files || []).find((file) => file.name === "index.html");
    const flashContent = target?.files?.[`flash:${fileName}`] || target?.files?.["flash:index.html"];
    const body = flashContent || serverFile?.content || `<html><body><h1>${target?.hostname || parsed.host}</h1></body></html>`;
    return { ok: true, url: parsed.raw, status: 200, statusText: "OK", body, targetId: target?.id, plan: reach.plan, contentType: "text/html" };
  }

  function userFor(configUsers, username) {
    return (configUsers || []).find((user) => lower(user.username) === lower(username));
  }

  function emailParts(address, fallbackDomain = "") {
    const [user, domain = fallbackDomain] = String(address || "").trim().split("@");
    return { user, domain };
  }

  function mailbox(server, username) {
    const mail = ensureRuntime(server, "mail");
    mail.mailboxes = mail.mailboxes || {};
    mail.mailboxes[username] = mail.mailboxes[username] || [];
    return mail.mailboxes[username];
  }

  function sendMail({ devices, links, sourceId, account = {}, message = {} }) {
    const source = devices[sourceId];
    const serverTarget = account.smtp || account.outgoingServer || "";
    const resolved = resolveName({ devices, sourceId, target: serverTarget });
    if (!resolved.ok) return { ok: false, error: resolved.error };
    const reach = checkReachability({ devices, links, sourceId, targetIp: resolved.ip, protocol: "tcp", port: 25, service: "smtp" });
    if (!reach.ok) return { ok: false, error: reach.error, plan: reach.plan };
    const server = reach.target;
    const cfg = serverConfig(server).email;
    const sender = emailParts(account.address || message.from, cfg.domain);
    const authUser = userFor(cfg.users, sender.user);
    if (cfg.users.length && (!authUser || authUser.password !== account.password)) return { ok: false, error: "SMTP authentication failed" };
    const recipient = emailParts(message.to, cfg.domain);
    const recipientUser = userFor(cfg.users, recipient.user);
    if (cfg.users.length && !recipientUser) return { ok: false, error: `Recipient ${message.to} does not exist` };
    const stored = {
      id: `mail_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      from: account.address || message.from || `${sender.user}@${sender.domain}`,
      to: message.to,
      subject: message.subject || "(no subject)",
      body: message.body || "",
      time: nowStamp(),
      source: source?.hostname || sourceId,
    };
    mailbox(server, recipient.user).push(stored);
    const sent = ensureRuntime(source, "mail");
    sent.sent = sent.sent || [];
    sent.sent.push(stored);
    return { ok: true, message: stored, serverId: server.id, plan: reach.plan };
  }

  function fetchMail({ devices, links, sourceId, account = {} }) {
    const serverTarget = account.pop3 || account.incomingServer || "";
    const resolved = resolveName({ devices, sourceId, target: serverTarget });
    if (!resolved.ok) return { ok: false, error: resolved.error, messages: [] };
    const reach = checkReachability({ devices, links, sourceId, targetIp: resolved.ip, protocol: "tcp", port: 110, service: "pop3" });
    if (!reach.ok) return { ok: false, error: reach.error, messages: [], plan: reach.plan };
    const server = reach.target;
    const cfg = serverConfig(server).email;
    const accountUser = emailParts(account.address, cfg.domain).user;
    const authUser = userFor(cfg.users, accountUser);
    if (cfg.users.length && (!authUser || authUser.password !== account.password)) return { ok: false, error: "POP3 authentication failed", messages: [] };
    return { ok: true, messages: clone(mailbox(server, accountUser)), serverId: server.id, plan: reach.plan };
  }

  function querySnmp({ devices, links, sourceId, target, community = "public", oid = "1.3.6.1.2.1.1.1.0", bulk = false, setValue = null }) {
    const resolved = resolveName({ devices, sourceId, target });
    if (!resolved.ok) return { ok: false, error: resolved.error };
    const reach = checkReachability({ devices, links, sourceId, targetIp: resolved.ip, protocol: "udp", port: 161, service: "snmp" });
    if (!reach.ok) return { ok: false, error: reach.error, plan: reach.plan };
    const communities = reach.target?.snmp?.communities || [];
    const found = communities.find((item) => item.name === community);
    if (communities.length && !found) return { ok: false, error: "SNMP community rejected", plan: reach.plan };
    if (setValue != null && found?.access === "RO") return { ok: false, error: "SNMP community is read-only", plan: reach.plan };
    const value = oid.endsWith(".5.0") ? reach.target.hostname : oid.endsWith(".1.0") ? `${reach.target.hostname} ${reach.target.model || reach.target.kind}` : `${reach.target.hostname} value`;
    return { ok: true, oid, value: bulk ? `${oid}.1 = ${value}\n${oid}.2 = ${reach.target.osVersion || "OpenPT"}` : `${oid} = ${setValue ?? value}`, plan: reach.plan };
  }

  function authAgainstServer(server, area, username, password) {
    const cfg = serverConfig(server);
    const users = area === "email" ? cfg.email.users : area === "aaa" ? cfg.aaa.users : (server.users ? Object.entries(server.users).map(([name, data]) => ({ username: name, password: data.secret })) : []);
    if (!users.length) return true;
    const found = userFor(users, username);
    return !!found && (found.password === password || found.secret === password);
  }

  function connectSession({ devices, links, sourceId, target, username, password, kind }) {
    const service = kind === "pppoe" ? "pppoe" : "vpn";
    const resolved = resolveName({ devices, sourceId, target });
    if (!resolved.ok) return { ok: false, error: resolved.error };
    const reach = checkReachability({ devices, links, sourceId, targetIp: resolved.ip, protocol: "udp", port: servicePort(service), service });
    if (!reach.ok) return { ok: false, error: reach.error, plan: reach.plan };
    if (!authAgainstServer(reach.target, "aaa", username, password)) return { ok: false, error: `${service.toUpperCase()} authentication failed`, plan: reach.plan };
    const sessions = ensureRuntime(devices[sourceId], "sessions");
    sessions[service] = { connected: true, serverId: reach.target.id, server: target, username, connectedAt: nowStamp() };
    return { ok: true, session: sessions[service], plan: reach.plan };
  }

  function connectVpn(args) { return connectSession({ ...args, kind: "vpn" }); }
  function connectPppoe(args) { return connectSession({ ...args, kind: "pppoe" }); }

  function generateTraffic({ devices, links, sourceId, destination, protocol = "ICMP", count = 1 }) {
    const resolved = resolveName({ devices, sourceId, target: destination });
    const history = ensureRuntime(devices[sourceId], "traffic");
    history.history = history.history || [];
    if (!resolved.ok) {
      const row = { time: nowStamp(), destination, protocol, count, ok: false, result: resolved.error };
      history.history.push(row);
      return { ok: false, error: resolved.error, history: row };
    }
    const proto = String(protocol || "ICMP").toLowerCase();
    const service = proto === "http" ? "http" : null;
    const port = service ? servicePort(service) : proto === "tcp" ? 80 : proto === "udp" ? 53 : 0;
    const reach = checkReachability({ devices, links, sourceId, targetIp: resolved.ip, protocol: proto, port, service });
    const row = { time: nowStamp(), destination, protocol: protocol.toUpperCase(), count, ok: reach.ok, result: reach.ok ? "Delivered" : reach.error };
    history.history.push(row);
    return { ok: reach.ok, error: reach.error, history: row, plan: reach.plan, targetIp: resolved.ip };
  }

  function registerCommunicator({ devices, links, sourceId, server, extension, password = "" }) {
    const resolved = resolveName({ devices, sourceId, target: server });
    if (!resolved.ok) return { ok: false, error: resolved.error };
    const reach = checkReachability({ devices, links, sourceId, targetIp: resolved.ip, protocol: "udp", port: servicePort("voice"), service: "voice" });
    if (!reach.ok) return { ok: false, error: reach.error, plan: reach.plan };
    const voice = ensureRuntime(reach.target, "voice");
    voice.registrations = voice.registrations || {};
    voice.registrations[extension] = { deviceId: sourceId, extension, password, registeredAt: nowStamp() };
    const local = ensureRuntime(devices[sourceId], "voice");
    local.registration = { serverId: reach.target.id, extension, registeredAt: nowStamp() };
    return { ok: true, registration: local.registration, plan: reach.plan };
  }

  function placeCall({ devices, links, sourceId, extension }) {
    const source = devices[sourceId];
    const reg = source?.appRuntime?.voice?.registration;
    if (!reg) return { ok: false, error: "Communicator is not registered" };
    const server = devices[reg.serverId];
    const target = server?.appRuntime?.voice?.registrations?.[extension];
    if (!target) return { ok: false, error: `Extension ${extension} is not registered` };
    const targetIp = primaryIp(devices[target.deviceId]);
    const reach = checkReachability({ devices, links, sourceId, targetIp, protocol: "udp", port: servicePort("voice") });
    return reach.ok ? { ok: true, result: `Call connected to ${extension}`, plan: reach.plan } : { ok: false, error: reach.error, plan: reach.plan };
  }

  function registerIotDevice({ devices, links, sourceId, server, zone = "Lab" }) {
    const resolved = resolveName({ devices, sourceId, target: server });
    if (!resolved.ok) return { ok: false, error: resolved.error };
    const reach = checkReachability({ devices, links, sourceId, targetIp: resolved.ip, protocol: "tcp", port: 80, service: "iot" });
    if (!reach.ok) return { ok: false, error: reach.error, plan: reach.plan };
    const runtime = ensureRuntime(reach.target, "iot");
    runtime.registrations = runtime.registrations || [];
    const existing = runtime.registrations.find((item) => item.deviceId === sourceId);
    const row = { deviceId: sourceId, name: devices[sourceId]?.hostname || sourceId, zone, status: "Registered", time: nowStamp() };
    if (existing) Object.assign(existing, row); else runtime.registrations.push(row);
    const local = ensureRuntime(devices[sourceId], "iot");
    local.registration = { serverId: reach.target.id, zone, status: "Registered", time: row.time };
    return { ok: true, registration: local.registration, plan: reach.plan };
  }

  function runIotScript({ devices, sourceId, project = "main", language = "JavaScript", code = "" }) {
    const runtime = ensureRuntime(devices[sourceId], "iot");
    runtime.scripts = runtime.scripts || [];
    const result = /error|throw|fail/i.test(code) ? "Script reported an error" : `Script ran in ${language}`;
    const row = { project, language, code, result, ok: !/error|throw|fail/i.test(code), time: nowStamp() };
    runtime.scripts.push(row);
    return { ok: row.ok, result, run: row };
  }

  window.OPT_Services = {
    clone, ensureRuntime, ensureSettings, primaryInterface, primaryIp,
    deviceByIpOrName, servicePort, serviceEnabled, serverConfig,
    resolveName, evaluateFirewall, checkReachability,
    requestHttp, sendMail, fetchMail, querySnmp,
    connectVpn, connectPppoe, generateTraffic,
    registerCommunicator, placeCall, registerIotDevice, runIotScript,
  };
})();
