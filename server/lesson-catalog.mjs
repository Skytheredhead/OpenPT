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

export function loadLessonCatalog() {
  if (!cachedCatalog) {
    cachedCatalog = JSON.parse(readFileSync(catalogPath, "utf8"));
  }
  return clone(cachedCatalog);
}

export function validateLessonCatalog(catalog = loadLessonCatalog()) {
  const errors = [];
  const lessons = Array.isArray(catalog.lessons) ? catalog.lessons : [];
  const ids = new Set();
  const moduleBanks = new Set(catalog.moduleBanks || catalog.modules?.map((module) => module.id) || []);
  const factories = new Set(catalog.labFactories || []);

  if (lessons.length !== 13) errors.push(`Expected exactly 13 Semester 1 lessons, found ${lessons.length}.`);

  for (const lesson of lessons) {
    if (!lesson?.id) errors.push("Lesson is missing id.");
    if (lesson?.id && ids.has(lesson.id)) errors.push(`Duplicate lesson id: ${lesson.id}.`);
    if (lesson?.id) ids.add(lesson.id);
    if (lesson?.semester !== "sem-01") errors.push(`${lesson?.id || "lesson"} must be in sem-01.`);
    if (!moduleBanks.has(lesson?.moduleBank)) errors.push(`${lesson?.id || "lesson"} has invalid moduleBank ${lesson?.moduleBank}.`);
    if (!factories.has(lesson?.labFactory)) errors.push(`${lesson?.id || "lesson"} has invalid labFactory ${lesson?.labFactory}.`);
    if (!Array.isArray(lesson?.steps) || !lesson.steps.length) errors.push(`${lesson?.id || "lesson"} must have steps.`);
    if (!Number.isFinite(Number(lesson?.xp)) || Number(lesson.xp) <= 0) errors.push(`${lesson?.id || "lesson"} must have positive xp.`);

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
      stepCount: (lesson.steps || []).length
    }))
  };
}
