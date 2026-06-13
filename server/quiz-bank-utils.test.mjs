import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import vm from "node:vm";

function loadBankUtils() {
  const context = { window: {} };
  vm.createContext(context);
  vm.runInContext(readFileSync(resolve("quiz", "bank-utils.js"), "utf8"), context, { filename: "quiz/bank-utils.js" });
  return context.window.OpenPTQuizBanks;
}

test("quiz bank matcher keeps standard CCNA and CCNA-B all-banks separate", () => {
  const banks = loadBankUtils();
  const questions = [
    { id: 1, bank: "ccna/sem-01/m-1-3", questionKey: "ccna-1" },
    { id: 2, bank: "ccna/sem-03/m-13-14", questionKey: "ccna-2" },
    { id: 3, bank: "ccna-b/quiz-01", questionKey: "ccna-b-1" },
    { id: 4, bank: "ccna-b/quiz-03", questionKey: "ccna-b-3" },
  ];

  assert.deepEqual(banks.questionKeysForBanks(questions, ["ccna/all"]), ["ccna-1", "ccna-2"]);
  assert.deepEqual(banks.questionKeysForBanks(questions, ["ccna-b/all"]), ["ccna-b-1", "ccna-b-3"]);
  assert.deepEqual(banks.questionIdsForBank(questions, "ccna-b/quiz-01"), [3]);
});
