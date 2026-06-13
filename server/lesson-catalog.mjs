import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const catalogPath = join(root, "public", "data", "ccna-lessons.json");

let cachedCatalog = null;

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
      : "Finish the checkpoint and explain the expected result."
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
    labIdea: lesson.labIdea || defaultLabIdea({ ...lesson, questionBanks, focusTags })
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
          "Say what should happen first, then prove or correct it."
        ],
        commandCoach: "No command yet. Make the rule explicit in one sentence before the build step.",
        explanation: `This primes retrieval: ${blueprint.title} should start as a rule you can explain without answer choices.`,
        xp: predictXp
      },
      {
        id: "lab-idea",
        kind: "build",
        prompt: `${lab.title}: ${lab.goal}`,
        checks: [{ type: "manual" }],
        hints: [
          `Topology idea: ${lab.topology}`,
          "Use the simulator canvas as a memory hook even when the exact feature is a concept review."
        ],
        commandCoach: `Lab idea\nTopology: ${lab.topology}\nProof target: ${lab.proof}`,
        explanation: "A small topology story makes the quiz wording easier to decode under time pressure.",
        xp: buildXp
      },
      {
        id: "drill-linked-banks",
        kind: "drill",
        prompt: `Run a focused drill from ${drillText} and explain every miss.`,
        checks: [{ type: "manual" }],
        hints: [
          "Misses become useful only when you name the trap: command, concept, wording, or subnet math.",
          "For CCNA-B, re-read code and exhibit prompts before choosing the answer."
        ],
        commandCoach: `Quiz banks: ${banks.join(", ") || blueprint.moduleBank}\nGoal: fast correct answers, not slow recognition.`,
        explanation: "The drill step connects simulator memory to the exact question style used in the imported banks.",
        xp: drillXp
      },
      {
        id: "prove",
        kind: "prove",
        prompt: `Prove mastery: ${lab.proof}`,
        checks: [{ type: "manual" }],
        hints: [
          "If you cannot explain why the wrong answers are wrong, repeat a smaller drill.",
          "End with one sentence you could write from memory tomorrow."
        ],
        commandCoach: "Write the proof in your own words, then mark this checkpoint complete.",
        explanation: "The final proof creates the memory trace that survives a cram session.",
        xp: proveXp
      }
    ]
  });
}

function expandLessonCatalog(rawCatalog) {
  const catalog = clone(rawCatalog || {});
  const modules = Array.isArray(catalog.modules) ? catalog.modules : [];
  const moduleOrder = new Map(modules.map((module, index) => [module.id, index]));
  const authored = (catalog.lessons || []).map((lesson, index) => ({
    ...normalizeLessonMetadata(lesson),
    __order: index
  }));
  const generated = (catalog.lessonBlueprints || []).map((blueprint, index) => ({
    ...lessonFromBlueprint(blueprint),
    __order: authored.length + index
  }));
  catalog.lessons = [...authored, ...generated]
    .sort((a, b) => (
      (moduleOrder.get(a.moduleBank) ?? 9999) - (moduleOrder.get(b.moduleBank) ?? 9999) ||
      a.__order - b.__order
    ))
    .map(({ __order, ...lesson }) => lesson);
  return catalog;
}

export function loadLessonCatalog() {
  if (!cachedCatalog) {
    cachedCatalog = expandLessonCatalog(JSON.parse(readFileSync(catalogPath, "utf8")));
  }
  return clone(cachedCatalog);
}

export function validateLessonCatalog(catalog = loadLessonCatalog()) {
  const errors = [];
  const lessons = Array.isArray(catalog.lessons) ? catalog.lessons : [];
  const ids = new Set();
  const moduleBanks = new Set(catalog.moduleBanks || catalog.modules?.map((module) => module.id) || []);
  const factories = new Set(catalog.labFactories || []);

  const expectedLessonCount = Number(catalog.expectedLessonCount || 0);
  if (expectedLessonCount && lessons.length !== expectedLessonCount) {
    errors.push(`Expected exactly ${expectedLessonCount} lessons, found ${lessons.length}.`);
  }

  for (const lesson of lessons) {
    if (!lesson?.id) errors.push("Lesson is missing id.");
    if (lesson?.id && ids.has(lesson.id)) errors.push(`Duplicate lesson id: ${lesson.id}.`);
    if (lesson?.id) ids.add(lesson.id);
    if (!catalog.semesters?.some((semester) => semester.id === lesson?.semester)) errors.push(`${lesson?.id || "lesson"} has invalid semester ${lesson?.semester}.`);
    if (!moduleBanks.has(lesson?.moduleBank)) errors.push(`${lesson?.id || "lesson"} has invalid moduleBank ${lesson?.moduleBank}.`);
    if (!factories.has(lesson?.labFactory)) errors.push(`${lesson?.id || "lesson"} has invalid labFactory ${lesson?.labFactory}.`);
    if (!Array.isArray(lesson?.steps) || !lesson.steps.length) errors.push(`${lesson?.id || "lesson"} must have steps.`);
    if (!Number.isFinite(Number(lesson?.xp)) || Number(lesson.xp) <= 0) errors.push(`${lesson?.id || "lesson"} must have positive xp.`);
    if (!Array.isArray(lesson?.focusTags) || !lesson.focusTags.length) errors.push(`${lesson?.id || "lesson"} needs focusTags.`);
    if (!Array.isArray(lesson?.questionBanks) || !lesson.questionBanks.length) errors.push(`${lesson?.id || "lesson"} needs questionBanks.`);
    if (!["none", "light", "high"].includes(lesson?.ccnaBWeight)) errors.push(`${lesson?.id || "lesson"} has invalid ccnaBWeight.`);
    if (!lesson?.labIdea?.title || !lesson.labIdea?.goal || !lesson.labIdea?.topology || !lesson.labIdea?.proof) {
      errors.push(`${lesson?.id || "lesson"} needs complete labIdea metadata.`);
    }

    for (const prerequisite of lesson?.prerequisites || []) {
      if (!ids.has(prerequisite) && !lessons.some((candidate) => candidate.id === prerequisite)) {
        errors.push(`${lesson.id} has unknown prerequisite ${prerequisite}.`);
      }
    }

    const stepIds = new Set();
    for (const step of lesson?.steps || []) {
      if (!step?.id) errors.push(`${lesson.id} has a step missing id.`);
      if (step?.id && stepIds.has(step.id)) errors.push(`${lesson.id} has duplicate step id ${step.id}.`);
      if (step?.id) stepIds.add(step.id);
      if (!String(step?.prompt || "").trim()) errors.push(`${lesson.id}/${step?.id || "step"} needs a prompt.`);
      if (!Array.isArray(step?.hints) || !step.hints.some((hint) => String(hint || "").trim())) {
        errors.push(`${lesson.id}/${step?.id || "step"} needs at least one hint.`);
      }
      if (!Array.isArray(step?.checks) || !step.checks.length) {
        errors.push(`${lesson.id}/${step?.id || "step"} needs at least one check.`);
      }
      if (!String(step?.commandCoach || "").trim()) errors.push(`${lesson.id}/${step?.id || "step"} needs commandCoach.`);
      if (!String(step?.explanation || "").trim()) errors.push(`${lesson.id}/${step?.id || "step"} needs explanation.`);
      if (!Number.isFinite(Number(step?.xp)) || Number(step.xp) <= 0) errors.push(`${lesson.id}/${step?.id || "step"} must have positive xp.`);
    }
  }

  return errors;
}

export function ccnaLessons() {
  return loadLessonCatalog().lessons || [];
}

export function findLesson(lessonId) {
  const id = String(lessonId || "").trim();
  return ccnaLessons().find((lesson) => lesson.id === id) || null;
}

export function requireLesson(lessonId) {
  const lesson = findLesson(lessonId);
  if (!lesson) {
    const err = new Error("Lesson not found.");
    err.statusCode = 404;
    throw err;
  }
  return lesson;
}

export function lessonStepIds(lesson) {
  return (lesson?.steps || []).map((step) => step.id);
}

export function lessonTotalXp(lesson) {
  return Math.max(0, Number(lesson?.xp) || 0);
}

export function lessonStepXp(lesson, stepId) {
  const step = (lesson?.steps || []).find((item) => item.id === stepId);
  if (!step) return 0;
  return Math.max(0, Math.min(Number(step.xp) || 0, lessonTotalXp(lesson)));
}

export function lessonCatalogStats() {
  const catalog = loadLessonCatalog();
  const lessons = catalog.lessons || [];
  return {
    courseId: catalog.courseId || "ccna",
    version: catalog.version || 1,
    title: catalog.title || "CCNA Guided Lesson Mode",
    totalLessons: lessons.length,
    totalXp: lessons.reduce((sum, lesson) => sum + lessonTotalXp(lesson), 0),
    semesters: catalog.semesters || [],
    modules: catalog.modules || [],
    lessons: lessons.map((lesson) => ({
      id: lesson.id,
      semester: lesson.semester,
      moduleBank: lesson.moduleBank,
      title: lesson.title,
      estimatedMinutes: lesson.estimatedMinutes,
      prerequisites: lesson.prerequisites || [],
      xp: lessonTotalXp(lesson),
      labFactory: lesson.labFactory,
      focusTags: lesson.focusTags || [],
      questionBanks: lesson.questionBanks || [],
      ccnaBWeight: lesson.ccnaBWeight || "none",
      labIdea: lesson.labIdea || null,
      stepCount: (lesson.steps || []).length
    }))
  };
}
