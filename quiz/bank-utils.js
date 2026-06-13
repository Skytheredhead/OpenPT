(function () {
  function normalizeBankKeys(bankKeys) {
    const raw = Array.isArray(bankKeys) ? bankKeys : [bankKeys || "ccna/all"];
    return [...new Set(raw.map((key) => String(key || "").trim()).filter(Boolean))];
  }

  function bankMatches(bank, bankKey) {
    const value = String(bank || "");
    const key = String(bankKey || "ccna/all");
    if (key === "ccna/all") return value.startsWith("ccna/");
    if (key === "ccna-b/all") return value.startsWith("ccna-b/");
    return value === key;
  }

  function questionMatchesBanks(question, bankKeys) {
    const keys = normalizeBankKeys(bankKeys);
    return keys.some((bankKey) => bankMatches(question?.bank, bankKey));
  }

  function questionIdsForBank(questions, bankKey) {
    return (questions || []).filter((question) => bankMatches(question.bank, bankKey)).map((question) => question.id);
  }

  function questionKeysForBanks(questions, bankKeys) {
    return (questions || [])
      .filter((question) => questionMatchesBanks(question, bankKeys))
      .map((question) => question.questionKey)
      .filter(Boolean);
  }

  window.OpenPTQuizBanks = {
    bankMatches,
    normalizeBankKeys,
    questionIdsForBank,
    questionKeysForBanks,
    questionMatchesBanks,
  };
})();
