import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

function loadRegistry() {
  let nextId = 0;
  const context = {
    console,
    window: {
      OPT_Engine: {
        uid(prefix = "id") {
          nextId += 1;
          return `${prefix}-${nextId}`;
        },
        makeDevice(kind, hostname, x, y, interfaces = {}, extra = {}) {
          return {
            id: `d-${++nextId}`,
            kind,
            hostname,
            name: hostname,
            x,
            y,
            interfaces,
            ...extra,
          };
        },
      },
    },
  };
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("openpt-labs.js", "utf8"), context, { filename: "openpt-labs.js" });
  return context.window.OpenPTLabs;
}

function loadFullHarness() {
  const context = { console, window: {} };
  context.globalThis = context;
  context.window.window = context.window;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync("engine.jsx", "utf8"), context, { filename: "engine.jsx" });
  vm.runInContext(fs.readFileSync("openpt-labs.js", "utf8"), context, { filename: "openpt-labs.js" });
  context.OPT_Engine = context.window.OPT_Engine;
  const appSource = fs.readFileSync("app.jsx", "utf8");
  const start = appSource.indexOf("function packetTracerAssessmentText");
  const end = appSource.indexOf("function sanitizePacketTracerHtml");
  assert.ok(start >= 0 && end > start, "grading helpers are locatable in app.jsx");
  vm.runInContext(
    `
function packetTracerAssessmentPathParts(item) {
  if (Array.isArray(item?.pathParts) && item.pathParts.length) return item.pathParts;
  return String(item?.path || item?.name || "Assessment Item").split(/\\s*\\/\\s*/).filter(Boolean);
}
${appSource.slice(start, end)}
globalThis.gradePacketTracerActivity = gradePacketTracerActivity;
`,
    context,
    { filename: "app-grading-slice.js" }
  );
  return { labs: context.window.OpenPTLabs, grade: context.gradePacketTracerActivity };
}

function assertValidIpv4(value, label) {
  const octets = String(value).split(".").map(Number);
  assert.equal(octets.length, 4, `${label} is an IPv4 address`);
  assert.equal(
    octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255),
    true,
    `${label} has valid octets`
  );
}

function ipv4LikeValues(text) {
  return String(text || "").match(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g) || [];
}

test("CCNA-B authored lab registry covers quiz A, B, and C lab items", () => {
  const labs = loadRegistry();
  const expected = [
    ["ccna-b/quiz-01", 48],
    ["ccna-b/quiz-01", 49],
    ["ccna-b/quiz-01", 50],
    ["ccna-b/quiz-01", 51],
    ["ccna-b/quiz-02", 53],
    ["ccna-b/quiz-02", 54],
    ["ccna-b/quiz-02", 55],
    ["ccna-b/quiz-02", 56],
    ["ccna-b/quiz-03", 47],
    ["ccna-b/quiz-03", 48],
    ["ccna-b/quiz-03", 49],
    ["ccna-b/quiz-03", 50],
  ];

  assert.ok(labs.all.length >= expected.length);
  for (const [bank, slide] of expected) {
    const meta = labs.metadataForQuestion(bank, slide);
    assert.ok(meta, `${bank} question ${slide} has lab metadata`);
    assert.equal(meta.quizBank, bank);
    assert.equal(meta.questionSlide, slide);
    assert.equal(typeof meta.title, "string");
    assert.ok(meta.title.length > 3);
  }
});

test("authored labs can be matched to Learn lesson question banks", () => {
  const labs = loadRegistry();
  const quizOne = labs.labsForBanks(["ccna-b/quiz-01"]);
  assert.deepEqual(
    Array.from(quizOne, (lab) => lab.questionSlide),
    [48, 49, 50, 51]
  );
  assert.equal(
    quizOne.every((lab) => lab.quizBank === "ccna-b/quiz-01"),
    true
  );

  const bossRush = labs.labsForBanks(["ccna-b/all"]);
  assert.equal(bossRush.length, 12);
  assert.equal(bossRush[0].id, "ccna-b-q1-48-etherchannel-vlan");
  assert.equal(bossRush.at(-1).id, "ccna-b-q3-50-dhcp-relay");

  const explicit = labs.labsForRefs(["ccna-b-q2-54-nat-pat", "missing", "ccna-b-q1-49-dhcp-routerb"]);
  assert.deepEqual(
    Array.from(explicit, (lab) => lab.id),
    ["ccna-b-q1-49-dhcp-routerb", "ccna-b-q2-54-nat-pat"]
  );
});

test("OpenPT core catalog is website-scale, categorized, and reported", () => {
  const labs = loadRegistry();
  const ids = labs.all.map((lab) => lab.id);
  assert.ok(labs.all.length >= 50, "catalog exposes at least 50 authored labs");
  assert.equal(new Set(ids).size, ids.length, "lab ids are unique");

  const generated = labs.labsForBanks(["openpt/core"]);
  assert.ok(generated.length >= 40, "generated core bank is substantial");
  const categories = new Set(generated.map((lab) => lab.category));
  for (const category of ["Switching", "Routing", "Routing Protocols", "Services", "Security", "Switch Security", "Management"]) {
    assert.ok(categories.has(category), `catalog includes ${category} labs`);
  }

  const report = labs.catalogReport();
  assert.equal(report.labCount, labs.all.length);
  assert.equal(report.generatedCount, generated.length);
  assert.ok(report.assessmentItemCount > report.labCount * 4, "report counts real assessment items");
  assert.equal(report.byQuizBank["openpt/core"], generated.length);
  assert.ok(report.byCategory.Switching >= 1);
  assert.ok(report.byCategory.Management >= 1);
});

test("every authored lab factory returns simulator-ready state and checks", () => {
  const labs = loadRegistry();
  let totalAssessmentItems = 0;
  for (const meta of labs.all) {
    const built = labs.build(meta.id);
    assert.ok(built, `${meta.id} builds`);
    assert.equal(built.id, meta.id);
    assert.ok(Object.keys(built.devices).length > 0, `${meta.id} has devices`);
    assert.ok(Array.isArray(built.links), `${meta.id} has links`);
    assert.ok(built.activity.instructionsHtml.includes("<h1>Tasks</h1>"), `${meta.id} has instructions`);
    assert.ok(Object.keys(built.activity.answerCommands).length > 0, `${meta.id} has answer commands`);
    assert.ok(built.activity.assessmentItems.length > 0, `${meta.id} has assessment items`);
    assert.equal(built.activity.labKey, meta.id);
    assert.equal(built.activity.autograder.mode, "answer-command-checks");
    assert.equal(built.activity.autograder.itemCount, built.activity.assessmentItems.length);
    assert.equal(built.activity.autograder.deterministic, true);
    const devicesByHostname = new Map(Object.values(built.devices).map((device) => [device.hostname, device]));
    assert.equal(devicesByHostname.size, Object.keys(built.devices).length, `${meta.id} device hostnames are unique`);
    for (const deviceName of Object.keys(built.activity.answerCommands)) {
      assert.ok(devicesByHostname.has(deviceName), `${meta.id} answer commands target existing device ${deviceName}`);
    }
    for (const link of built.links) {
      const left = built.devices[link.a];
      const right = built.devices[link.b];
      assert.ok(left, `${meta.id} link ${link.id} has left endpoint`);
      assert.ok(right, `${meta.id} link ${link.id} has right endpoint`);
      assert.ok(left.interfaces?.[link.ai], `${meta.id} link ${link.id} has left interface ${link.ai}`);
      assert.ok(right.interfaces?.[link.bi], `${meta.id} link ${link.id} has right interface ${link.bi}`);
    }
    for (const device of Object.values(built.devices)) {
      for (const [ifaceName, iface] of Object.entries(device.interfaces || {})) {
        for (const field of ["ip", "mask", "gw"]) {
          if (iface[field]) assertValidIpv4(iface[field], `${meta.id} ${device.hostname} ${ifaceName} ${field}`);
        }
      }
    }
    for (const [deviceName, commands] of Object.entries(built.activity.answerCommands)) {
      for (const command of commands) {
        for (const ip of ipv4LikeValues(command)) assertValidIpv4(ip, `${meta.id} ${deviceName} command ${command}`);
      }
    }
    totalAssessmentItems += built.activity.assessmentItems.length;
  }
  assert.equal(totalAssessmentItems, labs.catalogReport().assessmentItemCount);
});

test("every authored lab autogrades with no unsupported starting-state rows", () => {
  const { labs, grade } = loadFullHarness();
  let totalAssessmentItems = 0;
  for (const meta of labs.all) {
    const built = labs.build(meta.id);
    const graded = grade(built.activity, built.devices, built.links);
    const rows = graded.assessmentItems || [];
    totalAssessmentItems += rows.length;
    const unchecked = rows.filter((item) => item.unchecked || item.status === "Unchecked");
    assert.equal(
      unchecked.length,
      0,
      `${meta.id} has unchecked autograder rows: ${unchecked.map((item) => `${item.name} [${item.checkerId}]`).join(", ")}`
    );
  }
  assert.equal(totalAssessmentItems, labs.catalogReport().assessmentItemCount);
  assert.ok(totalAssessmentItems >= 700);
});
