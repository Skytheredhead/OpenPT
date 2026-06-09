(function () {
  const CATALOG_URL = "/public/data/ccna-lessons.json";
  let catalogPromise = null;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
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
    return {
      title: lesson.title,
      sourceName: `${lesson.id}.opt`,
      labKey: lesson.id,
      lessonId: lesson.id,
      instructionsHtml: `<h2>${lesson.title}</h2><p>Follow the coach sidebar. Every checkpoint is tied to simulator state.</p>`,
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
      });
    }
    return clone(await catalogPromise);
  }

  function buildLessonLab(lesson) {
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
    if (check.type === "topology") return `Cable ${check.linkBetween?.join(" to ")}`;
    if (check.type === "ping") return `Ping ${check.source} to ${check.target}`;
    if (check.type === "action") return `${check.device} ${check.commandKind}`;
    return check.type || "Checkpoint";
  }

  function completedLessonIds(dashboard) {
    return new Set((dashboard?.lessons || []).filter((lesson) => lesson.status === "completed").map((lesson) => lesson.id));
  }

  function LessonPathView({ catalog, dashboard, user, loading, onStartLesson, onSignIn, onBackToLab }) {
    const lessons = catalog?.lessons || [];
    const modules = catalog?.modules || [];
    const completed = completedLessonIds(dashboard);
    const recommendedId = dashboard?.recommendedLessonId || lessons.find((lesson) => !completed.has(lesson.id))?.id;
    const progressByLesson = Object.fromEntries((dashboard?.lessons || []).map((lesson) => [lesson.id, lesson]));

    return (
      <div className="learn-page">
        <div className="learn-topbar">
          <button type="button" className="tb-btn" onClick={onBackToLab}>Back to lab</button>
          <div className="learn-brand">OpenPT Learn</div>
          <button type="button" className="tb-btn" onClick={onSignIn}>{user ? user.email.split("@")[0] : "Login / Sign up"}</button>
        </div>
        <main className="learn-shell">
          <section className="learn-hero">
            <div>
              <div className="learn-kicker">CCNA Guided Lesson Mode</div>
              <h1>Build the network, then explain why it works.</h1>
              <p>Semester 1 missions use the simulator as the lesson. Prediction, hints, commands, and explanations unlock as you prove real checkpoints.</p>
            </div>
            <div className="learn-score-strip">
              <div><span>XP</span><strong>{dashboard?.earnedXp || 0}/{dashboard?.totalXp || 0}</strong></div>
              <div><span>Streak</span><strong>{dashboard?.currentStreak || 0} day{dashboard?.currentStreak === 1 ? "" : "s"}</strong></div>
              <div><span>Badges</span><strong>{(dashboard?.badges || []).filter((badge) => badge.earned).length}/{dashboard?.badges?.length || modules.length}</strong></div>
            </div>
          </section>

          {!user && (
            <section className="learn-login-gate">
              <div>
                <h2>Sign in to start guided CCNA missions.</h2>
                <p>Progress, XP, streaks, and badges are saved to your OpenPT account.</p>
              </div>
              <button type="button" className="tb-btn primary" onClick={onSignIn}>Sign in to learn</button>
            </section>
          )}

          {loading && <div className="learn-empty">Loading lesson path...</div>}

          <section className="learn-path">
            {modules.map((module) => {
              const moduleLessons = lessons.filter((lesson) => lesson.moduleBank === module.id);
              const badge = (dashboard?.badges || []).find((item) => item.id === module.id);
              return (
                <div className="learn-module" key={module.id}>
                  <div className="learn-module-head">
                    <div>
                      <span>{module.semester === "sem-01" ? "Semester 1" : "Planned"}</span>
                      <h2>{module.title}</h2>
                    </div>
                    {badge?.earned && <strong className="learn-badge">Badge earned</strong>}
                  </div>
                  <div className="learn-mission-grid">
                    {moduleLessons.map((lesson) => {
                      const state = progressByLesson[lesson.id];
                      const missing = state?.softGate?.missingPrerequisites || lesson.prerequisites?.filter((id) => !completed.has(id)) || [];
                      const status = state?.status || "not_started";
                      const progress = state?.progress;
                      const isRecommended = lesson.id === recommendedId;
                      return (
                        <article className={`learn-mission ${status} ${isRecommended ? "recommended" : ""}`} key={lesson.id}>
                          <div className="learn-mission-meta">
                            <span>{lesson.estimatedMinutes} min</span>
                            <span>{lesson.xp} XP</span>
                          </div>
                          <h3>{lesson.title}</h3>
                          <p>{missing.length ? `Soft gate: ${missing.length} earlier mission${missing.length === 1 ? "" : "s"} recommended first.` : "Ready when you are."}</p>
                          <div className="learn-progress-line">
                            <span style={{ width: `${progress?.bestPercent || 0}%` }} />
                          </div>
                          <button
                            type="button"
                            className={`tb-btn ${isRecommended ? "primary" : ""}`}
                            disabled={!user}
                            onClick={() => onStartLesson(lesson.id)}
                          >
                            {status === "completed" ? "Replay mission" : progress ? "Continue mission" : missing.length ? "Start anyway" : "Start mission"}
                          </button>
                        </article>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>

          <section className="learn-coming-soon">
            {(catalog?.semesters || []).filter((semester) => semester.status !== "available").map((semester) => (
              <div key={semester.id}>
                <span>{semester.status}</span>
                <strong>{semester.title}</strong>
                <p>{semester.description}</p>
              </div>
            ))}
          </section>
        </main>
      </div>
    );
  }

  function LessonCoachSidebar({ catalog, lessonSession, activity, devices, links, onClose, onHint, onManualComplete, onStepSelect, onFinish, onReturnToPath }) {
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
              return (
                <div className={met ? "met" : ""} key={`${step.id}-${index}`}>
                  <span>{met ? "ok" : ""}</span>
                  {checkLabel(check)}
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
          <button type="button" className="tb-btn learn-path-return" onClick={onReturnToPath}>View path</button>
        )}
      </aside>
    );
  }

  window.OpenPTLearn = {
    loadLessonCatalog,
    buildLessonLab,
    stepChecksMet,
    checkMet,
    pingKey,
    actionKey,
    LessonPathView,
    LessonCoachSidebar,
  };
})();
