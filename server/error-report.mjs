import { createHash } from "node:crypto";
import nodemailer from "nodemailer";

const MAX_TEXT = 4000;
const MAX_ARRAY = 40;

function text(value, max = MAX_TEXT) {
  if (value == null) return "";
  return String(value).replace(/\0/g, "").slice(0, max);
}

function shallowObject(value, keys) {
  const out = {};
  if (!value || typeof value !== "object") return out;
  for (const key of keys) {
    if (value[key] == null) continue;
    out[key] = typeof value[key] === "object" ? JSON.parse(JSON.stringify(value[key])).toString?.() || value[key] : value[key];
  }
  return out;
}

function safeArray(value, mapFn) {
  return Array.isArray(value) ? value.slice(0, MAX_ARRAY).map(mapFn).filter(Boolean) : [];
}

export function sanitizeErrorReport(body = {}) {
  const activity = body.activity && typeof body.activity === "object" ? body.activity : {};
  const report = activity.reverseReport || activity.diagnostics || body.report || {};
  const decoder = report.decoder || activity.decoder || {};
  const sanitized = {
    kind: "packet-tracer-import",
    appVersion: text(body.appVersion, 80),
    page: text(body.page, 300),
    userAgent: text(body.userAgent, 500),
    message: text(body.message, 1000),
    sourceName: text(activity.sourceName || body.sourceName, 240),
    sourceSize: Number(activity.sourceSize || report.size || body.sourceSize || 0) || 0,
    sourceSha256: text(activity.sourceSha256 || report.sha256 || body.sourceSha256, 80),
    sourceHeadHex: text(activity.sourceHeadHex || report.headHex || body.sourceHeadHex, 160),
    sourceTailHex: text(report.tailHex || body.sourceTailHex, 160),
    unsupported: !!activity.unsupported,
    featureCoverage: shallowObject(activity.featureCoverage, ["semanticExtraction", "preservedButUnsupported"]),
    decoder: {
      status: text(decoder.status, 80),
      profile: text(decoder.profile || decoder.attemptedProfile, 160),
      error: text(decoder.error, 2000),
    },
    signatures: safeArray(report.signatures, (item) => ({
      label: text(item?.label, 80),
      offset: Number(item?.offset || 0) || 0,
      hex: text(item?.hex, 120),
    })),
    entropyByWindow: safeArray(report.entropyByWindow, (item) => ({
      offset: Number(item?.offset || 0) || 0,
      length: Number(item?.length || 0) || 0,
      entropy: Number(item?.entropy || 0) || 0,
    })),
    interestingStrings: safeArray(report.interestingStrings || report.strings, (item) => ({
      offset: Number(item?.offset || 0) || 0,
      length: Number(item?.length || 0) || 0,
      text: text(item?.text, 300),
    })),
  };

  // Raw file bytes and full decoded documents must never leave the browser.
  delete sanitized.rawFile;
  delete sanitized.decoded;
  return sanitized;
}

export function reportFingerprint(report) {
  const basis = [
    report.sourceSha256,
    report.sourceHeadHex,
    report.decoder?.profile,
    report.decoder?.error,
    report.message,
  ].filter(Boolean).join("|");
  return createHash("sha256").update(basis || JSON.stringify(report)).digest("hex");
}

export function hasReportSmtpConfig(env = process.env) {
  return !!(env.OPENPT_REPORT_TO && env.OPENPT_REPORT_SMTP_HOST);
}

export async function sendErrorReportEmail(report, { env = process.env, transport = null, logger = console } = {}) {
  if (!hasReportSmtpConfig(env)) {
    logger.warn?.("OpenPT error report skipped: SMTP reporting is not configured.");
    return { sent: false, reason: "not-configured" };
  }

  const smtpPort = Number(env.OPENPT_REPORT_SMTP_PORT || 587);
  const smtpSecure = env.OPENPT_REPORT_SMTP_SECURE === "1" || smtpPort === 465;
  const mailer = transport || nodemailer.createTransport({
    host: env.OPENPT_REPORT_SMTP_HOST,
    port: smtpPort,
    secure: smtpSecure,
    auth: env.OPENPT_REPORT_SMTP_USER || env.OPENPT_REPORT_SMTP_PASS ? {
      user: env.OPENPT_REPORT_SMTP_USER,
      pass: env.OPENPT_REPORT_SMTP_PASS,
    } : undefined,
  });
  const fingerprint = reportFingerprint(report);
  const subjectName = report.sourceName || report.sourceSha256?.slice(0, 12) || "Packet Tracer import";
  const body = [
    `OpenPT Packet Tracer error report`,
    `Fingerprint: ${fingerprint}`,
    `Source: ${report.sourceName || "(unknown)"}`,
    `SHA-256: ${report.sourceSha256 || "(unknown)"}`,
    `Decoder: ${report.decoder?.status || "(unknown)"} ${report.decoder?.profile || ""}`,
    `Error: ${report.decoder?.error || report.message || "(none)"}`,
    "",
    JSON.stringify(report, null, 2),
  ].join("\n");

  await mailer.sendMail({
    to: env.OPENPT_REPORT_TO,
    from: env.OPENPT_REPORT_FROM || env.OPENPT_REPORT_TO,
    subject: `[OpenPT] Import report: ${subjectName}`.slice(0, 180),
    text: body,
  });
  return { sent: true, fingerprint };
}
