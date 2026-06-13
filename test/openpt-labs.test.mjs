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

  assert.equal(labs.all.length, expected.length);
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
  assert.deepEqual(Array.from(quizOne, (lab) => lab.questionSlide), [48, 49, 50, 51]);
  assert.equal(quizOne.every((lab) => lab.quizBank === "ccna-b/quiz-01"), true);

  const bossRush = labs.labsForBanks(["ccna-b/all"]);
  assert.equal(bossRush.length, labs.all.length);
  assert.equal(bossRush[0].id, "ccna-b-q1-48-etherchannel-vlan");
  assert.equal(bossRush.at(-1).id, "ccna-b-q3-50-dhcp-relay");

  const explicit = labs.labsForRefs(["ccna-b-q2-54-nat-pat", "missing", "ccna-b-q1-49-dhcp-routerb"]);
  assert.deepEqual(Array.from(explicit, (lab) => lab.id), ["ccna-b-q1-49-dhcp-routerb", "ccna-b-q2-54-nat-pat"]);
});

test("every authored lab factory returns simulator-ready state and checks", () => {
  const labs = loadRegistry();
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
  }
});
