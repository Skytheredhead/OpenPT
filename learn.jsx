(function () {
  const CATALOG_URL = "/public/data/ccna-lessons.json";
  let catalogPromise = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function generatedStepXp(totalXp, capstone = false) {
    const weights = capstone ? [0.2, 0.25, 0.25, 0.3] : [0.18, 0.24, 0.24, 0.34];
    const raw = weights.map((weight) => Math.max(1, Math.floor(totalXp * weight)));
    let remaining = Math.max(0, totalXp - raw.reduce((sum, value) => sum + value, 0));
    for (let index = raw.length - 1; remaining > 0; index = (index - 1 + raw.length) % raw.length) {
      raw[index] += 1;
      remaining -= 1;
    }
    return raw;
  }

  function cleanBankLabel(bank) {
    return String(bank || "")
      .replace(/^ccna\//, "CCNA ")
      .replace(/^ccna-b\//, "CCNA-B ")
      .replace(/sem-0?(\d)/, "Sem $1")
      .replace(/m-(\d+)-(\d+)/, "Mod $1-$2")
      .replace(/final-review/, "Final Review")
      .replace(/quiz-0?(\d)/, "Quiz $1")
      .replace(/\/final$/, " Final")
      .replace(/\//g, " / ");
  }

  function defaultFocusTags(lesson) {
    const text = `${lesson.title || ""} ${lesson.moduleBank || ""}`.toLowerCase();
    const tags = [];
    const add = (label, pattern) => {
      if (pattern.test(text)) tags.push(label);
    };
    add("OSI", /protocol|model|encapsulation|m-1-3/);
    add("Ethernet", /ethernet|mac|arp|cabling|m-4-7/);
    add("IPv4", /ipv4|router|gateway|route|m-8-10|m-11-13/);
    add("services", /dhcp|dns|http|service|m-14-15/);
    add("security", /security|ssh|hardening|m-16-17/);
    add("capstone", /capstone|final/);
    return tags.length ? tags : ["CCNA"];
  }

  function defaultLabIdea(lesson) {
    const banks = lesson.questionBanks || [lesson.moduleBank].filter(Boolean);
    return {
      title: `${lesson.title || "Guided mission"} lab`,
      goal: "Turn the lesson idea into a quick explain-build-prove loop.",
      topology: "Use the loaded OpenPT topology for this mission.",
      proof: banks.length
        ? `Finish the checkpoint and drill ${banks.map(cleanBankLabel).join(", ")}.`
        : "Finish the checkpoint and explain the expected result.",
    };
  }

  function normalizeLessonMetadata(lesson) {
    const questionBanks = Array.isArray(lesson.questionBanks) && lesson.questionBanks.length
      ? lesson.questionBanks
      : [lesson.moduleBank].filter(Boolean);
    const focusTags = Array.isArray(lesson.focusTags) && lesson.focusTags.length
      ? lesson.focusTags
      : defaultFocusTags({ ...lesson, questionBanks });
    const ccnaBWeight = lesson.ccnaBWeight || (questionBanks.some((bank) => String(bank).startsWith("ccna-b/")) ? "high" : "none");
    return {
      ...lesson,
      focusTags,
      questionBanks,
      ccnaBWeight,
      labIdea: lesson.labIdea || defaultLabIdea({ ...lesson, questionBanks, focusTags }),
    };
  }

  function lessonFromBlueprint(blueprint) {
    const xp = Math.max(1, Number(blueprint.xp || 100));
    const banks = Array.isArray(blueprint.questionBanks) ? blueprint.questionBanks : [];
    const focus = Array.isArray(blueprint.focusTags) ? blueprint.focusTags : [];
    const lab = blueprint.labIdea || defaultLabIdea({ ...blueprint, questionBanks: banks, focusTags: focus });
    const [predictXp, buildXp, drillXp, proveXp] = generatedStepXp(xp, Number(blueprint.estimatedMinutes || 0) >= 20);
    const drillText = banks.length ? banks.map(cleanBankLabel).join(", ") : cleanBankLabel(blueprint.moduleBank);

    return normalizeLessonMetadata({
      ...blueprint,
      steps: [
        {
          id: "predict",
          kind: "predict",
          prompt: `Before touching the lab, predict the key rule for ${blueprint.title}.`,
          checks: [{ type: "manual" }],
          hints: [
            `Focus on ${focus.slice(0, 3).join(", ") || "the topic"} before memorizing commands.`,
            "Say what should happen first, then prove or correct it.",
          ],
          commandCoach: "No command yet. Make the rule explicit in one sentence before the build step.",
          explanation: `This primes retrieval: ${blueprint.title} should start as a rule you can explain without answer choices.`,
          xp: predictXp,
        },
        {
          id: "lab-idea",
          kind: "build",
          prompt: `${lab.title}: ${lab.goal}`,
          checks: [{ type: "manual" }],
          hints: [
            `Topology idea: ${lab.topology}`,
            "Use the simulator canvas as a memory hook even when the exact feature is a concept review.",
          ],
          commandCoach: `Lab idea\nTopology: ${lab.topology}\nProof target: ${lab.proof}`,
          explanation: "A small topology story makes the quiz wording easier to decode under time pressure.",
          xp: buildXp,
        },
        {
          id: "drill-linked-banks",
          kind: "drill",
          prompt: `Run a focused drill from ${drillText} and explain every miss.`,
          checks: [{ type: "manual" }],
          hints: [
            "Misses become useful only when you name the trap: command, concept, wording, or subnet math.",
            "For CCNA-B, re-read code and exhibit prompts before choosing the answer.",
          ],
          commandCoach: `Quiz banks: ${banks.join(", ") || blueprint.moduleBank}\nGoal: fast correct answers, not slow recognition.`,
          explanation: "The drill step connects simulator memory to the exact question style used in the imported banks.",
          xp: drillXp,
        },
        {
          id: "prove",
          kind: "prove",
          prompt: `Prove mastery: ${lab.proof}`,
          checks: [{ type: "manual" }],
          hints: [
            "If you cannot explain why the wrong answers are wrong, repeat a smaller drill.",
            "End with one sentence you could write from memory tomorrow.",
          ],
          commandCoach: "Write the proof in your own words, then mark this checkpoint complete.",
          explanation: "The final proof creates the memory trace that survives a cram session.",
          xp: proveXp,
        },
      ],
    });
  }

  function expandLessonCatalog(rawCatalog) {
    const catalog = clone(rawCatalog || {});
    const modules = Array.isArray(catalog.modules) ? catalog.modules : [];
    const moduleOrder = new Map(modules.map((module, index) => [module.id, index]));
    const authored = (catalog.lessons || []).map((lesson, index) => ({
      ...normalizeLessonMetadata(lesson),
      __order: index,
    }));
    const generated = (catalog.lessonBlueprints || []).map((blueprint, index) => ({
      ...lessonFromBlueprint(blueprint),
      __order: authored.length + index,
    }));
    catalog.lessons = [...authored, ...generated]
      .sort((a, b) => (
        (moduleOrder.get(a.moduleBank) ?? 9999) - (moduleOrder.get(b.moduleBank) ?? 9999) ||
        a.__order - b.__order
      ))
      .map(({ __order, ...lesson }) => lesson);
    return catalog;
  }

  function labSourceLabel(lab) {
    const bank = cleanBankLabel(lab?.quizBank || "ccna-b");
    return [bank, lab?.questionSlide ? `Question ${lab.questionSlide}` : ""].filter(Boolean).join(" / ");
  }

  function labSummary(lab) {
    if (!lab) return null;
    return {
      id: lab.id,
      key: lab.id,
      title: lab.title,
      quizBank: lab.quizBank,
      questionSlide: lab.questionSlide,
      estimatedMinutes: lab.estimatedMinutes,
      sourceLabel: labSourceLabel(lab),
    };
  }

  function labsForLesson(lesson) {
    if (!lesson) return [];
    const refs = Array.isArray(lesson.labRefs) ? lesson.labRefs : [];
    const labs = refs.length
      ? window.OpenPTLabs?.labsForRefs?.(refs) || refs.map((id) => window.OpenPTLabs?.metadata?.(id)).filter(Boolean)
      : window.OpenPTLabs?.labsForBanks?.(lesson.questionBanks || []) || [];
    return labs.map(labSummary).filter(Boolean);
  }

  function labCompletionStepId(lesson, completedStepIds = []) {
    const completed = new Set(completedStepIds || []);
    const steps = lesson?.steps || [];
    const buildSteps = steps.filter((step) => step.kind === "build");
    return (
      buildSteps.find((step) => !completed.has(step.id))?.id ||
      buildSteps[0]?.id ||
      steps.find((step) => !completed.has(step.id))?.id ||
      steps[0]?.id ||
      null
    );
  }

  function iface(seed = {}) {
    return { ip: "", mask: "", gw: "", up: true, admUp: true, desc: "", ...seed };
  }

  function connect(a, ai, b, bi, type = "copper") {
    a.interfaces[ai] = { ...(a.interfaces[ai] || iface()), up: true, admUp: true };
    b.interfaces[bi] = { ...(b.interfaces[bi] || iface()), up: true, admUp: true };
    return { id: window.OPT_Engine.uid("l"), a: a.id, ai, b: b.id, bi, type, up: true };
  }

  function deviceByName(devices, name) {
    const wanted = String(name || "").toLowerCase();
    return Object.values(devices || {}).find((device) => String(device.hostname || device.name || "").toLowerCase() === wanted) || null;
  }

  function assessmentChecks(lesson) {
    return (lesson.steps || []).flatMap((step) => (
      (step.checks || [])
        .filter((check) => check.type === "assessment")
        .map((check, index) => ({
          id: check.id || `${lesson.id}-${step.id}-${index}`,
          points: check.points || 1,
          rootName: lesson.title,
          components: check.components || step.kind || "Lesson",
          name: check.name || check.value || step.prompt,
          value: check.value || "",
          target: {
            deviceName: check.device || "",
            interfaceName: check.iface || "",
          },
          pathParts: [check.device, check.iface, check.name || check.value || step.id].filter(Boolean),
          parentPath: [lesson.title, check.device, check.iface].filter(Boolean).join(" / "),
          path: [lesson.title, check.device, check.iface, check.name || check.value || step.id].filter(Boolean).join(" / "),
          lessonStepId: step.id,
          lessonCheckId: check.id || `${lesson.id}-${step.id}-${index}`,
        }))
    ));
  }

  function answerCommandsFromLesson(lesson) {
    const byDevice = {};
    for (const step of lesson.steps || []) {
      for (const check of step.checks || []) {
        if (check.type !== "assessment" || !check.device || !check.value) continue;
        byDevice[check.device] = byDevice[check.device] || [];
        if (check.iface) byDevice[check.device].push(`interface ${check.iface}`);
        byDevice[check.device].push(check.value);
      }
    }
    return byDevice;
  }

  function activityForLesson(lesson) {
    const items = assessmentChecks(lesson);
    const labIdea = lesson.labIdea
      ? `<p><strong>Lab idea:</strong> ${lesson.labIdea.goal}</p><p><strong>Proof:</strong> ${lesson.labIdea.proof}</p>`
      : "";
    return {
      title: lesson.title,
      sourceName: `${lesson.id}.opt`,
      labKey: lesson.id,
      lessonId: lesson.id,
      instructionsHtml: `<h2>${lesson.title}</h2><p>Follow the coach sidebar. Every checkpoint is tied to simulator state or a deliberate study proof.</p>${labIdea}`,
      hints: (lesson.steps || []).flatMap((step) => step.hints || []).slice(0, 12),
      answerCommands: answerCommandsFromLesson(lesson),
      assessmentItems: items,
      decoded: {
        visibleAssessmentComponents: [...new Set(items.map((item) => item.components).filter(Boolean))],
      },
      gradingProfile: {
        mode: "ccna-guided-lesson",
      },
    };
  }

  function lanTwoHosts() {
    const E = window.OPT_Engine;
    const PC1 = E.makeDevice("pc", "PC1", 140, 230, { eth0: iface({ ip: "192.168.10.11", mask: "255.255.255.0" }) });
    const PC2 = E.makeDevice("pc", "PC2", 140, 410, { eth0: iface({ ip: "192.168.10.12", mask: "255.255.255.0" }) });
    const SRV1 = E.makeDevice("server", "SRV1", 620, 320, { eth0: iface({ ip: "192.168.10.10", mask: "255.255.255.0" }) });
    const SW1 = E.makeDevice("l2switch", "SW1", 380, 320);
    return { devices: { [PC1.id]: PC1, [PC2.id]: PC2, [SRV1.id]: SRV1, [SW1.id]: SW1 }, links: [] };
  }

  function iosSwitch() {
    const E = window.OPT_Engine;
    const SW1 = E.makeDevice("l2switch", "SW1", 360, 280);
    SW1.interfaces.Vlan1 = iface({ up: false, admUp: false });
    const PC1 = E.makeDevice("pc", "PC1", 130, 280, { eth0: iface({ ip: "192.168.10.11", mask: "255.255.255.0", gw: "192.168.10.2" }) });
    const links = [connect(PC1, "eth0", SW1, "FastEthernet0/1")];
    return { devices: { [SW1.id]: SW1, [PC1.id]: PC1 }, links };
  }

  function cablingLinkState() {
    const E = window.OPT_Engine;
    const R1 = E.makeDevice("router", "R1", 180, 280, { "GigabitEthernet0/0/0": iface({ up: false, admUp: false }) });
    const SW1 = E.makeDevice("l2switch", "SW1", 500, 280);
    return { devices: { [R1.id]: R1, [SW1.id]: SW1 }, links: [] };
  }

  function switchMacArp() {
    const E = window.OPT_Engine;
    const PC1 = E.makeDevice("pc", "PC1", 140, 230, { eth0: iface({ ip: "192.168.10.11", mask: "255.255.255.0" }) });
    const PC2 = E.makeDevice("pc", "PC2", 140, 410, { eth0: iface({ ip: "192.168.10.12", mask: "255.255.255.0" }) });
    const SW1 = E.makeDevice("l2switch", "SW1", 420, 320);
    const links = [connect(PC1, "eth0", SW1, "FastEthernet0/1"), connect(PC2, "eth0", SW1, "FastEthernet0/2")];
    return { devices: { [PC1.id]: PC1, [PC2.id]: PC2, [SW1.id]: SW1 }, links };
  }

  function ipv4TwoLans() {
    const E = window.OPT_Engine;
    const R1 = E.makeDevice("router", "R1", 430, 300, {
      "GigabitEthernet0/0/0": iface({ up: false, admUp: false }),
      "GigabitEthernet0/0/1": iface({ up: false, admUp: false }),
    });
    const SW1 = E.makeDevice("l2switch", "SW1", 250, 210);
    const SW2 = E.makeDevice("l2switch", "SW2", 610, 390);
    const PC1 = E.makeDevice("pc", "PC1", 80, 210, { eth0: iface({ ip: "192.168.10.11", mask: "255.255.255.0", gw: "192.168.10.1" }) });
    const PC2 = E.makeDevice("pc", "PC2", 780, 390, { eth0: iface({ ip: "192.168.20.12", mask: "255.255.255.0", gw: "192.168.20.1" }) });
    const links = [
      connect(PC1, "eth0", SW1, "FastEthernet0/1"),
      connect(SW1, "FastEthernet0/24", R1, "GigabitEthernet0/0/0"),
      connect(R1, "GigabitEthernet0/0/1", SW2, "FastEthernet0/24"),
      connect(SW2, "FastEthernet0/1", PC2, "eth0"),
    ];
    return { devices: { [R1.id]: R1, [SW1.id]: SW1, [SW2.id]: SW2, [PC1.id]: PC1, [PC2.id]: PC2 }, links };
  }

  function staticRouteTwoRouters(withRoutes = false) {
    const E = window.OPT_Engine;
    const R1 = E.makeDevice("router", "R1", 280, 260, {
      "GigabitEthernet0/0/0": iface({ ip: "192.168.10.1", mask: "255.255.255.0" }),
      "GigabitEthernet0/0/1": iface({ ip: "10.0.0.1", mask: "255.255.255.252" }),
    });
    const R2 = E.makeDevice("router", "R2", 640, 260, {
      "GigabitEthernet0/0/0": iface({ ip: "192.168.20.1", mask: "255.255.255.0" }),
      "GigabitEthernet0/0/1": iface({ ip: "10.0.0.2", mask: "255.255.255.252" }),
    });
    if (withRoutes) {
      R1.routes.push({ dst: "192.168.20.0", mask: "255.255.255.0", via: "10.0.0.2", type: "S" });
      R2.routes.push({ dst: "192.168.10.0", mask: "255.255.255.0", via: "10.0.0.1", type: "S" });
    }
    const SW1 = E.makeDevice("l2switch", "SW1", 160, 430);
    const SW2 = E.makeDevice("l2switch", "SW2", 760, 430);
    const PC1 = E.makeDevice("pc", "PC1", 60, 560, { eth0: iface({ ip: "192.168.10.11", mask: "255.255.255.0", gw: "192.168.10.1" }) });
    const PC2 = E.makeDevice("pc", "PC2", 860, 560, { eth0: iface({ ip: "192.168.20.12", mask: "255.255.255.0", gw: "192.168.20.1" }) });
    const links = [
      connect(PC1, "eth0", SW1, "FastEthernet0/1"),
      connect(SW1, "FastEthernet0/24", R1, "GigabitEthernet0/0/0"),
      connect(R1, "GigabitEthernet0/0/1", R2, "GigabitEthernet0/0/1"),
      connect(R2, "GigabitEthernet0/0/0", SW2, "FastEthernet0/24"),
      connect(SW2, "FastEthernet0/1", PC2, "eth0"),
    ];
    return { devices: { [R1.id]: R1, [R2.id]: R2, [SW1.id]: SW1, [SW2.id]: SW2, [PC1.id]: PC1, [PC2.id]: PC2 }, links };
  }

  function dhcpRouter() {
    const E = window.OPT_Engine;
    const R1 = E.makeDevice("router", "R1", 420, 240, { "GigabitEthernet0/0/0": iface({ ip: "192.168.30.1", mask: "255.255.255.0" }) });
    const SW1 = E.makeDevice("l2switch", "SW1", 420, 420);
    const PC1 = E.makeDevice("pc", "PC1", 180, 540, { eth0: iface({ ip: "", mask: "", gw: "", dhcp: true }) });
    const SRV1 = E.makeDevice("server", "SRV1", 660, 540, { eth0: iface({ ip: "192.168.30.10", mask: "255.255.255.0", gw: "192.168.30.1" }) });
    const links = [
      connect(R1, "GigabitEthernet0/0/0", SW1, "FastEthernet0/24"),
      connect(PC1, "eth0", SW1, "FastEthernet0/1"),
      connect(SRV1, "eth0", SW1, "FastEthernet0/3"),
    ];
    return { devices: { [R1.id]: R1, [SW1.id]: SW1, [PC1.id]: PC1, [SRV1.id]: SRV1 }, links };
  }

  function servicesDnsHttp() {
    const lab = dhcpRouter();
    for (const device of Object.values(lab.devices)) {
      if (device.hostname === "PC1") device.interfaces.eth0 = iface({ ip: "192.168.30.11", mask: "255.255.255.0", gw: "192.168.30.1" });
      if (device.hostname === "SRV1") device.interfaces.eth0 = iface({ ip: "", mask: "", gw: "" });
    }
    return lab;
  }

  function sshHardening() {
    const E = window.OPT_Engine;
    const SW1 = E.makeDevice("l2switch", "SW1", 430, 300);
    const PC1 = E.makeDevice("pc", "PC1", 140, 300, { eth0: iface({ ip: "192.168.10.11", mask: "255.255.255.0" }) });
    const links = [connect(PC1, "eth0", SW1, "FastEthernet0/1")];
    return { devices: { [SW1.id]: SW1, [PC1.id]: PC1 }, links };
  }

  function smallOffice() {
    const E = window.OPT_Engine;
    const R1 = E.makeDevice("router", "R1", 620, 250, { "GigabitEthernet0/0/0": iface({ up: false, admUp: false }) });
    const SW1 = E.makeDevice("l2switch", "SW1", 430, 360);
    const PC1 = E.makeDevice("pc", "PC1", 160, 250, { eth0: iface({ ip: "192.168.50.11", mask: "255.255.255.0", gw: "192.168.50.1" }) });
    const PC2 = E.makeDevice("pc", "PC2", 160, 470, { eth0: iface({ ip: "192.168.50.12", mask: "255.255.255.0", gw: "192.168.50.1" }) });
    const SRV1 = E.makeDevice("server", "SRV1", 720, 500, { eth0: iface({ ip: "", mask: "", gw: "" }) });
    return { devices: { [R1.id]: R1, [SW1.id]: SW1, [PC1.id]: PC1, [PC2.id]: PC2, [SRV1.id]: SRV1 }, links: [] };
  }

  const factories = {
    "lan-two-hosts": () => lanTwoHosts(),
    "ios-switch": () => iosSwitch(),
    "cabling-link-state": () => cablingLinkState(),
    "switch-mac-arp": () => switchMacArp(),
    "ipv4-two-lans": () => ipv4TwoLans(),
    "static-route-two-routers": (lesson) => staticRouteTwoRouters(lesson.id === "sem1-m11-13-icmp-troubleshoot"),
    "dhcp-router": () => dhcpRouter(),
    "services-dns-http": () => servicesDnsHttp(),
    "ssh-hardening": () => sshHardening(),
    "small-office-capstone": () => smallOffice(),
  };

  async function loadLessonCatalog() {
    if (!catalogPromise) {
      catalogPromise = fetch(CATALOG_URL).then((res) => {
        if (!res.ok) throw new Error("Could not load CCNA lesson catalog.");
        return res.json();
      }).then(expandLessonCatalog);
    }
    return clone(await catalogPromise);
  }

  function buildLessonLab(lesson, options = {}) {
    const labId = typeof options === "string" ? options : options?.labId;
    if (labId) {
      const built = window.OpenPTLabs?.build?.(labId);
      if (!built) throw new Error(`Unknown lesson lab: ${labId}`);
      const meta = labSummary(window.OpenPTLabs?.metadata?.(labId)) || labsForLesson(lesson).find((lab) => lab.id === labId);
      return {
        title: built.title || meta?.title || lesson.title,
        fileName: `${labId}.opt`,
        devices: built.devices,
        links: built.links,
        activity: {
          ...(built.activity || {}),
          labKey: labId,
          lessonId: lesson.id,
          sourceLessonId: lesson.id,
          sourceName: built.activity?.sourceName || `${labId}.opt`,
          gradingProfile: {
            ...(built.activity?.gradingProfile || {}),
            mode: "ccna-guided-lab",
          },
        },
        lab: meta || null,
      };
    }
    const factory = factories[lesson.labFactory];
    if (!factory) throw new Error(`Unknown lesson lab factory: ${lesson.labFactory}`);
    const lab = factory(lesson);
    return {
      title: lesson.title,
      fileName: `${lesson.id}.opt`,
      devices: lab.devices,
      links: lab.links,
      activity: activityForLesson(lesson),
    };
  }

  function assessmentCheckMet(check, activity) {
    if (!activity?.assessmentItems?.length) return false;
    return activity.assessmentItems.some((item) => {
      const sameId = check.id && (item.id === check.id || item.lessonCheckId === check.id);
      const sameShape = item.target?.deviceName === check.device && (item.target?.interfaceName || "") === (check.iface || "") && item.name === check.name;
      return (sameId || sameShape) && item.correct === true;
    });
  }

  function topologyCheckMet(check, devices, links) {
    const [leftName, rightName] = check.linkBetween || [];
    const [leftIface, rightIface] = check.interfaces || [];
    const left = deviceByName(devices, leftName);
    const right = deviceByName(devices, rightName);
    if (!left || !right) return false;
    return (links || []).some((link) => {
      const direct = link.a === left.id && link.b === right.id && (!leftIface || link.ai === leftIface) && (!rightIface || link.bi === rightIface);
      const reverse = link.a === right.id && link.b === left.id && (!leftIface || link.bi === leftIface) && (!rightIface || link.ai === rightIface);
      return direct || reverse;
    });
  }

  function pingKey(source, target) {
    return `${source || ""}->${target || ""}`;
  }

  function actionKey(device, commandKind) {
    return `${device || ""}:${commandKind || ""}`;
  }

  function checkMet(check, context = {}) {
    if (!check) return false;
    if (check.type === "manual") return (context.lessonSession?.completedStepIds || []).includes(context.stepId);
    if (check.type === "assessment") return assessmentCheckMet(check, context.activity);
    if (check.type === "topology") return topologyCheckMet(check, context.devices, context.links);
    if (check.type === "ping") return !!context.lessonSession?.proofs?.pings?.[pingKey(check.source, check.target)];
    if (check.type === "action") return !!context.lessonSession?.proofs?.actions?.[actionKey(check.device, check.commandKind)];
    return false;
  }

  function stepChecksMet(step, context = {}) {
    const checks = step?.checks || [];
    if (!checks.length) return false;
    return checks.every((check) => checkMet(check, { ...context, stepId: step.id }));
  }

  function checkLabel(check) {
    if (check.type === "manual") return "Thinking checkpoint";
    if (check.type === "assessment") return [check.device, check.iface, check.name || check.value].filter(Boolean).join(" / ");
    if (check.type === "topology") {
      const [left, right] = check.linkBetween || [];
      const [leftIface, rightIface] = check.interfaces || [];
      return `Required cable: ${left || "device"} ${leftIface || "port"} -> ${right || "device"} ${rightIface || "port"}`;
    }
    if (check.type === "ping") return `Required proof: ping ${check.source} -> ${check.target}`;
    if (check.type === "action") return `${check.device} ${check.commandKind}`;
    return check.type || "Checkpoint";
  }

  function checkStateLabel(check, met, context = {}) {
    if (met) return "met";
    if (check.type === "manual") return "action required";
    if (check.type === "topology") return "pending cable";
    if (check.type === "ping") {
      const latest = context.lessonSession?.proofs?.lastPing;
      if (latest && latest.source === check.source && String(latest.target) === String(check.target) && latest.ok === false) return "failed";
      return "pending proof";
    }
    return "pending";
  }

  function latestCheckDetail(check, context = {}) {
    if (check.type !== "ping") return "";
    const latest = context.lessonSession?.proofs?.lastPing;
    if (!latest || latest.source !== check.source || String(latest.target) !== String(check.target)) return "";
    if (latest.ok) return "latest attempt succeeded";
    return latest.reason ? `latest failed: ${latest.reason}` : "latest attempt failed";
  }

  function completedLessonIds(dashboard) {
    return new Set((dashboard?.lessons || []).filter((lesson) => lesson.status === "completed").map((lesson) => lesson.id));
  }

  function quizBankHref(bank, mode = "practice") {
    return `/quiz/?bank=${encodeURIComponent(bank)}&mode=${encodeURIComponent(mode)}`;
  }

  function QuestionBankLinks({ banks = [], compact = false }) {
    const visibleBanks = [...new Set(banks)].filter(Boolean);
    if (!visibleBanks.length) return null;
    return (
      <div className={compact ? "learn-bank-links compact" : "learn-bank-links"}>
        {visibleBanks.map((bank) => (
          <a key={bank} href={quizBankHref(bank)} target="_blank" rel="noreferrer" title="Open quiz practice in a new tab">
            Quiz practice: {cleanBankLabel(bank)}
          </a>
        ))}
      </div>
    );
  }

  function FocusTags({ tags = [], ccnaBWeight = "none" }) {
    const visibleTags = [...new Set(tags)].filter(Boolean).slice(0, 5);
    if (ccnaBWeight !== "none") visibleTags.push(ccnaBWeight === "high" ? "CCNA-B high" : "CCNA-B light");
    if (!visibleTags.length) return null;
    return (
      <div className="learn-focus-tags">
        {visibleTags.map((tag) => <span key={tag}>{tag}</span>)}
      </div>
    );
  }

  function LessonLabCards({ lesson, user, compact = false, activeLab = null, labProgress = null, onOpenLab }) {
    const labs = labsForLesson(lesson);
    if (!labs.length) return null;
    const visibleLabs = compact ? labs.slice(0, 3) : labs;
    const extraCount = Math.max(0, labs.length - visibleLabs.length);
    return (
      <div className={compact ? "learn-linked-labs compact" : "learn-linked-labs"}>
        <div className="learn-linked-labs-head">
          <span>Labs</span>
          <strong>{labs.length}</strong>
        </div>
        <div className="learn-linked-lab-list">
          {visibleLabs.map((lab) => {
            const isActive = activeLab?.labId === lab.id;
            const progress = isActive ? labProgress : null;
            return (
              <button
                type="button"
                key={lab.id}
                className={`learn-linked-lab ${isActive ? "active" : ""}`}
                disabled={!user}
                onClick={() => onOpenLab?.(lab.id)}
              >
                <span>{lab.sourceLabel}</span>
                <strong>{lab.title}</strong>
                <em>{progress?.score || `${lab.estimatedMinutes || 8} min`}</em>
              </button>
            );
          })}
          {extraCount > 0 && <div className="learn-linked-lab-more">+{extraCount} more</div>}
        </div>
      </div>
    );
  }

  function lessonState(lesson, dashboard, user) {
    const dashboardLesson = (dashboard?.lessons || []).find((item) => item.id === lesson.id);
    const missingPrerequisites = dashboardLesson?.softGate?.missingPrerequisites || lesson.prerequisites || [];
    const status = dashboardLesson?.status || "not_started";
    const progress = dashboardLesson?.progress || null;
    const unlocked = !!user && (status === "completed" || missingPrerequisites.length === 0);
    return { dashboardLesson, missingPrerequisites, status, progress, unlocked };
  }

  function lessonPercent(lesson, state) {
    if (state?.status === "completed") return 100;
    if (state?.progress?.bestPercent != null) return Math.round(Number(state.progress.bestPercent) || 0);
    const completed = state?.progress?.completedSteps || [];
    return Math.round((completed.length / Math.max(1, lesson?.steps?.length || 1)) * 100);
  }

  function lessonNumber(index) {
    return String(index + 1).padStart(2, "0");
  }

  function semesterLabel(catalog, semesterId) {
    return (catalog?.semesters || []).find((semester) => semester.id === semesterId)?.title || semesterId || "Course";
  }

  function moduleLabel(catalog, moduleId) {
    const title = (catalog?.modules || []).find((module) => module.id === moduleId)?.title || cleanBankLabel(moduleId);
    return title.replace(/^Modules?\s*/i, "Mod ");
  }

  function LessonPathView({ catalog, dashboard, user, loading, onOpenLesson, onSignIn, onBackToLab }) {
    const lessons = catalog?.lessons || [];
    const completed = completedLessonIds(dashboard);
    const firstUnlocked = lessons.find((lesson) => lessonState(lesson, dashboard, user).unlocked && !completed.has(lesson.id));
    const recommendedId = dashboard?.recommendedLessonId || firstUnlocked?.id || lessons.find((lesson) => !completed.has(lesson.id))?.id;
    const progressByLesson = Object.fromEntries((dashboard?.lessons || []).map((lesson) => [lesson.id, lesson]));
    const coursePercent = Math.round(((dashboard?.completedLessons || 0) / Math.max(1, dashboard?.totalLessons || lessons.length || 1)) * 100);
    const startedLessons = (dashboard?.lessons || [])
      .filter((lesson) => lesson.progress && lesson.status !== "completed")
      .sort((a, b) => new Date(b.progress?.updatedAt || b.progress?.startedAt || 0) - new Date(a.progress?.updatedAt || a.progress?.startedAt || 0));
    const hasStartedLessons = startedLessons.length > 0;
    const targetLessonId = startedLessons[0]?.id || recommendedId || lessons.find((lesson) => !completed.has(lesson.id))?.id || lessons[0]?.id || null;
    const targetLesson = lessons.find((lesson) => lesson.id === targetLessonId);
    const startButtonLabel = targetLesson
      ? `${hasStartedLessons ? "Continue mission" : "Start first mission"}: ${targetLesson.title}`
      : "Start first mission";
    const summarizeTags = (predicate) => {
      const counts = new Map();
      for (const lesson of lessons) {
        const state = progressByLesson[lesson.id];
        if (!predicate(lesson, state)) continue;
        for (const tag of lesson.focusTags || []) counts.set(tag, (counts.get(tag) || 0) + 1);
      }
      return [...counts.entries()]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 5)
        .map(([tag]) => tag);
    };
    const goodAt = summarizeTags(
      (lesson, state) => state?.status === "completed" || (state?.progress?.bestPercent || 0) >= 70
    );
    const strugglingWith = summarizeTags(
      (lesson, state) => state?.status !== "completed" && state?.progress && (state.progress.bestPercent || 0) < 70
    );

    return (
      <div className="learn-page">
        <div className="learn-topbar">
          <button type="button" className="tb-btn" onClick={onBackToLab}>Back to lab</button>
          <div className="learn-brand">OpenPT Learn</div>
          <button type="button" className="tb-btn" onClick={onSignIn}>{user ? user.email.split("@")[0] : "Login / Sign up"}</button>
        </div>
        <main className="learn-shell">
          {!user && (
            <section className="learn-login-gate">
              <div>
                <h2>Sign in to start guided CCNA missions.</h2>
              </div>
              <button type="button" className="tb-btn primary" onClick={onSignIn}>Sign in to learn</button>
            </section>
          )}

          {loading && <div className="learn-empty">Loading lesson path...</div>}

          {user && (
            <section className="learn-summary" aria-label="Learning progress">
              <div className="learn-summary-progress">
                <div>
                  <span>Progress</span>
                  <strong>{coursePercent}%</strong>
                </div>
                <div className="learn-progress-line">
                  <span style={{ width: `${coursePercent}%` }} />
                </div>
                <p>{dashboard?.completedLessons || 0} of {dashboard?.totalLessons || lessons.length || 0} lessons complete</p>
              </div>

              <div className="learn-summary-lists">
                <div>
                  <h2>Things you're good at</h2>
                  {goodAt.length ? <FocusTags tags={goodAt} /> : <p>No strengths yet.</p>}
                </div>
                <div>
                  <h2>Topics to review</h2>
                  {strugglingWith.length ? <FocusTags tags={strugglingWith} /> : <p>No review topics yet.</p>}
                </div>
              </div>

              <button
                type="button"
                className="tb-btn primary learn-start-button"
                disabled={!targetLessonId}
                onClick={() => targetLessonId && onOpenLesson(targetLessonId)}
              >
                {startButtonLabel}
              </button>
            </section>
          )}

          <section className="learn-roadmap" aria-label="Course roadmap">
            <div className="learn-roadmap-decor decor-a">ping 192.168.10.1</div>
            <div className="learn-roadmap-decor decor-b">Fa0/1 up/up</div>
            <div className="learn-roadmap-head">
              <div>
                <span>Roadmap</span>
                <h1>Follow the path. Build the network.</h1>
              </div>
              <div className="learn-roadmap-key">
                <span><i className="done" />Done</span>
                <span><i className="next" />Next</span>
                <span><i />Locked</span>
              </div>
            </div>
            {["sem-01", "sem-02", "sem-03"].map((semesterId) => {
              const semesterLessons = lessons
                .map((lesson, index) => ({ lesson, index }))
                .filter(({ lesson }) => lesson.semester === semesterId);
              if (!semesterLessons.length) return null;
              return (
                <div className="learn-roadmap-semester" key={semesterId}>
                  <div className="learn-roadmap-semester-title">
                    <span>{semesterLabel(catalog, semesterId)}</span>
                    <strong>{semesterLessons.filter(({ lesson }) => completed.has(lesson.id)).length}/{semesterLessons.length}</strong>
                  </div>
                  <div className="learn-roadmap-track">
                    {semesterLessons.map(({ lesson, index }) => {
                      const state = lessonState(lesson, dashboard, user);
                      const isCompleted = state.status === "completed";
                      const isNext = lesson.id === recommendedId && !isCompleted;
                      const isLocked = user && !state.unlocked;
                      const pct = lessonPercent(lesson, state);
                      return (
                        <button
                          type="button"
                          key={lesson.id}
                          className={[
                            "learn-roadmap-node",
                            isCompleted ? "completed" : "",
                            isNext ? "next" : "",
                            isLocked ? "locked" : "",
                            !user ? "preview" : "",
                          ].filter(Boolean).join(" ")}
                          disabled={!!user && isLocked}
                          onClick={() => user ? onOpenLesson?.(lesson.id) : onSignIn?.()}
                        >
                          <span className="learn-node-number">{isCompleted ? "ok" : isLocked ? "lock" : lessonNumber(index)}</span>
                          <span className="learn-node-copy">
                            <strong>{lesson.title}</strong>
                            <em>{moduleLabel(catalog, lesson.moduleBank)}</em>
                          </span>
                          <span className="learn-node-meter"><i style={{ width: `${pct}%` }} /></span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
        </main>
      </div>
    );
  }

  function LessonPage({
    catalog,
    dashboard,
    user,
    loading,
    lessonId,
    lessonSession,
    activity,
    devices,
    links,
    labProgress,
    workbench,
    onBack,
    onBackToLab,
    onSignIn,
    onStart,
    onHint,
    onManualComplete,
    onStepSelect,
    onFinish,
    onOpenLab,
  }) {
    const lesson = (catalog?.lessons || []).find((item) => item.id === lessonId);
    const state = lesson ? lessonState(lesson, dashboard, user) : null;
    const completed = new Set(lessonSession?.lessonId === lessonId ? lessonSession.completedStepIds || [] : state?.progress?.completedSteps || []);
    const currentStepId = lessonSession?.lessonId === lessonId ? lessonSession.stepId : state?.progress?.currentStepId;
    const activeStep = (lesson?.steps || []).find((step) => step.id === currentStepId) || lesson?.steps?.find((step) => !completed.has(step.id)) || lesson?.steps?.[0];
    const allComplete = !!lesson?.steps?.length && lesson.steps.every((step) => completed.has(step.id));
    const pct = lesson ? lessonPercent(lesson, state) : 0;

    return (
      <div className="learn-page lesson-page">
        <div className="learn-topbar">
          <button type="button" className="tb-btn" onClick={onBack}>Back to roadmap</button>
          <div className="learn-brand">OpenPT Learn</div>
          <button type="button" className="tb-btn" onClick={user ? onBackToLab : onSignIn}>{user ? user.email.split("@")[0] : "Login / Sign up"}</button>
        </div>
        <main className="learn-lesson-shell">
          {loading && <div className="learn-empty">Loading lesson...</div>}
          {!loading && !lesson && <div className="learn-empty">Lesson not found.</div>}
          {lesson && (
            <>
              <section className="learn-lesson-intro">
                <div>
                  <span>{moduleLabel(catalog, lesson.moduleBank)}</span>
                  <h1>{lesson.title}</h1>
                  <p>{lesson.labIdea?.goal || "Work through the concept, then prove it in the OpenPT lab."}</p>
                </div>
                <div className="learn-lesson-status">
                  <strong>{state?.status === "completed" ? "Complete" : state?.unlocked ? "Unlocked" : "Locked"}</strong>
                  <div className="learn-progress-line"><span style={{ width: `${pct}%` }} /></div>
                  <p>{completed.size}/{lesson.steps.length} checkpoints</p>
                </div>
              </section>

              {!user && (
                <section className="learn-login-gate">
                  <div>
                    <h2>Sign in to save progress and unlock the lab path.</h2>
                    <p>The roadmap uses your completed lessons to light up the next mission.</p>
                  </div>
                  <button type="button" className="tb-btn primary" onClick={onSignIn}>Sign in to learn</button>
                </section>
              )}

              {user && !state?.unlocked && (
                <section className="learn-locked-panel">
                  <strong>This lesson is locked.</strong>
                  <p>Complete {state.missingPrerequisites.map((id) => (catalog.lessons || []).find((item) => item.id === id)?.title || id).join(", ")} first.</p>
                </section>
              )}

              {user && state?.unlocked && !lessonSession && (
                <section className="learn-login-gate">
                  <div>
                    <h2>Ready when you are.</h2>
                    <p>Start this lesson to load its topology lab below.</p>
                  </div>
                  <button type="button" className="tb-btn primary" onClick={() => onStart?.(lesson.id)}>Start lesson</button>
                </section>
              )}

              <section className="learn-lesson-body">
                {lesson.labIdea && (
                  <div className="learn-teach-block">
                    <span>Mission brief</span>
                    <h2>{lesson.labIdea.title}</h2>
                    <p>{lesson.labIdea.topology}</p>
                    <p>{lesson.labIdea.proof}</p>
                  </div>
                )}
                <div className="learn-teach-grid">
                  {(lesson.steps || []).map((step, index) => {
                    const isActive = activeStep?.id === step.id;
                    const isDone = completed.has(step.id);
                    const hintsShown = lessonSession?.hintsShown?.[step.id] || 0;
                    const checks = step.checks || [];
                    return (
                      <article className={`learn-teach-step ${isActive ? "active" : ""} ${isDone ? "done" : ""}`} key={step.id}>
                        <div className="learn-step-meta">
                          <span>{index + 1}. {step.kind}</span>
                          <span>{step.xp} XP</span>
                        </div>
                        <h2>{step.prompt}</h2>
                        <div className="learn-checks">
                          {checks.map((check, checkIndex) => {
                            const met = checkMet(check, { activity, devices, links, lessonSession, stepId: step.id });
                            const state = checkStateLabel(check, met || isDone, { lessonSession });
                            const detail = latestCheckDetail(check, { lessonSession });
                            return (
                              <div className={met || isDone ? "met" : ""} key={`${step.id}-${checkIndex}`}>
                                <span>{state}</span>
                                <strong>{checkLabel(check)}</strong>
                                {detail && <em>{detail}</em>}
                              </div>
                            );
                          })}
                        </div>
                        <div className="learn-command-coach">
                          <span>Coach</span>
                          <pre>{step.commandCoach}</pre>
                        </div>
                        {hintsShown > 0 && (
                          <div className="learn-hints">
                            {step.hints.slice(0, hintsShown).map((hint, hintIndex) => <p key={hintIndex}>{hint}</p>)}
                          </div>
                        )}
                        <div className="learn-step-actions">
                          <button type="button" className="tb-btn" onClick={() => onStepSelect?.(step.id)}>Use checkpoint</button>
                          {lessonSession && hintsShown < step.hints.length && <button type="button" className="tb-btn" onClick={() => onHint?.(step.id)}>Hint {hintsShown + 1}</button>}
                          {lessonSession && checks.some((check) => check.type === "manual") && !isDone && (
                            <button type="button" className="tb-btn primary" onClick={() => onManualComplete?.(step.id)}>Lock in answer</button>
                          )}
                        </div>
                        {isDone && (
                          <div className="learn-explanation">
                            <span>What just happened</span>
                            <p>{step.explanation}</p>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
                <QuestionBankLinks banks={lesson.questionBanks} />
              </section>

              <section className="learn-lab-section" aria-label="Topology lab">
                <div className="learn-lab-section-head">
                  <div>
                    <span>Topology Lab</span>
                    <h2>Build and prove it in OpenPT</h2>
                  </div>
                  {labProgress && <strong>{labProgress.score || `${labProgress.percent}%`}</strong>}
                </div>
                <LessonLabCards
                  lesson={lesson}
                  user={user}
                  activeLab={lessonSession?.activeLab}
                  labProgress={labProgress}
                  onOpenLab={onOpenLab}
                />
                <div className="learn-lab-embed">
                  {workbench || <div className="learn-empty">Start the lesson to load the embedded lab.</div>}
                </div>
                {allComplete && (
                  <div className="learn-finish-box">
                    <strong>Lesson ready to complete</strong>
                    <p>All checkpoints are complete. Claim mastery and return to the roadmap.</p>
                    <button type="button" className="tb-btn primary" onClick={onFinish}>Complete lesson</button>
                  </div>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    );
  }

  function LessonCoachSidebar({ catalog, lessonSession, activity, devices, links, activeLab, labProgress, onClose, onHint, onManualComplete, onStepSelect, onFinish, onReturnToPath, onOpenLab }) {
    const lesson = (catalog?.lessons || []).find((item) => item.id === lessonSession?.lessonId);
    if (!lesson) return null;
    const completed = new Set(lessonSession.completedStepIds || []);
    const stepIndex = Math.max(0, (lesson.steps || []).findIndex((step) => step.id === lessonSession.stepId));
    const step = lesson.steps[stepIndex] || lesson.steps[0];
    const hintsShown = lessonSession.hintsShown?.[step.id] || 0;
    const allComplete = (lesson.steps || []).every((item) => completed.has(item.id));
    const checks = step?.checks || [];

    return (
      <aside className="learn-coach" aria-label="CCNA lesson coach">
        <div className="learn-coach-head">
          <div>
            <span>Guided mission</span>
            <strong>{lesson.title}</strong>
          </div>
          <button type="button" className="server-module-close" onClick={onClose} title="Hide coach">x</button>
        </div>
        <div className="learn-coach-context">
          <FocusTags tags={lesson.focusTags} ccnaBWeight={lesson.ccnaBWeight} />
          {lesson.labIdea && (
            <div className="learn-lab-idea">
              <strong>{lesson.labIdea.title}</strong>
              <span>{lesson.labIdea.topology}</span>
            </div>
          )}
          <QuestionBankLinks banks={lesson.questionBanks} compact />
          <LessonLabCards
            lesson={lesson}
            user
            activeLab={activeLab}
            labProgress={labProgress}
            onOpenLab={onOpenLab}
          />
        </div>
        <div className="learn-coach-progress">
          <div><span>{completed.size}/{lesson.steps.length} checkpoints</span><strong>{lessonSession.earnedXp || 0} XP earned here</strong></div>
          <div className="learn-progress-line"><span style={{ width: `${Math.round((completed.size / Math.max(1, lesson.steps.length)) * 100)}%` }} /></div>
        </div>
        <div className="learn-step-list">
          {lesson.steps.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={`${item.id === step.id ? "active" : ""} ${completed.has(item.id) ? "done" : ""}`}
              onClick={() => onStepSelect(item.id)}
            >
              <span>{completed.has(item.id) ? "ok" : index + 1}</span>
              {item.kind}
            </button>
          ))}
        </div>
        <div className="learn-step-card">
          <div className="learn-step-meta">
            <span>{step.kind}</span>
            <span>{step.xp} XP</span>
          </div>
          <h2>{step.prompt}</h2>
          <div className="learn-checks">
            {checks.map((check, index) => {
              const met = checkMet(check, { activity, devices, links, lessonSession, stepId: step.id });
              const state = checkStateLabel(check, met, { lessonSession });
              const detail = latestCheckDetail(check, { lessonSession });
              return (
                <div className={met ? "met" : ""} key={`${step.id}-${index}`}>
                  <span>{state}</span>
                  <strong>{checkLabel(check)}</strong>
                  {detail && <em>{detail}</em>}
                </div>
              );
            })}
          </div>
          <div className="learn-command-coach">
            <span>Coach</span>
            <pre>{step.commandCoach}</pre>
          </div>
          {hintsShown > 0 && (
            <div className="learn-hints">
              {step.hints.slice(0, hintsShown).map((hint, index) => <p key={index}>{hint}</p>)}
            </div>
          )}
          <div className="learn-step-actions">
            {hintsShown < step.hints.length && <button type="button" className="tb-btn" onClick={() => onHint(step.id)}>Hint {hintsShown + 1}</button>}
            {checks.some((check) => check.type === "manual") && !completed.has(step.id) && (
              <button type="button" className="tb-btn primary" onClick={() => onManualComplete(step.id)}>Lock in answer</button>
            )}
            {completed.has(step.id) && <button type="button" className="tb-btn" onClick={() => onStepSelect(lesson.steps[Math.min(stepIndex + 1, lesson.steps.length - 1)].id)}>Next</button>}
          </div>
          {completed.has(step.id) && (
            <div className="learn-explanation">
              <span>What just happened</span>
              <p>{step.explanation}</p>
            </div>
          )}
        </div>
        {allComplete ? (
          <div className="learn-finish-box">
            <strong>Mission ready to finish</strong>
            <p>All simulator checkpoints are complete.</p>
            <button type="button" className="tb-btn primary" onClick={onFinish}>Claim mastery XP</button>
          </div>
        ) : (
          <button type="button" className="tb-btn learn-path-return" onClick={onReturnToPath}>Back to roadmap</button>
        )}
      </aside>
    );
  }

  window.OpenPTLearn = {
    loadLessonCatalog,
    buildLessonLab,
    labsForLesson,
    labCompletionStepId,
    stepChecksMet,
    checkMet,
    checkLabel,
    pingKey,
    actionKey,
    LessonPathView,
    LessonPage,
    LessonCoachSidebar,
  };
})();
