import nodemailer from "nodemailer";

const MAX_SUBJECT = 200;
const MAX_EMAIL = 320;
const MAX_CONTENT = 4000;
const MAX_ATTACHMENTS = 2;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const allowedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function text(value, max) {
  return String(value || "").replace(/\0/g, "").trim().slice(0, max);
}

function envValue(env, names) {
  for (const name of names) {
    const value = env[name];
    if (value != null && String(value).trim()) return String(value).trim();
  }
  return "";
}

function parseBool(value, fallback = false) {
  if (value == null || value === "") return fallback;
  return /^(1|true|yes)$/i.test(String(value));
}

function parseImageAttachment(item, index) {
  if (!item || typeof item !== "object") return null;
  const filename = text(item.filename || `feedback-image-${index + 1}`, 160) || `feedback-image-${index + 1}`;
  const contentType = text(item.contentType, 80).toLowerCase();
  const data = String(item.data || "");
  if (!allowedImageTypes.has(contentType)) {
    const err = new Error("Only JPEG, PNG, WebP, or GIF images can be attached.");
    err.statusCode = 400;
    throw err;
  }
  if (!/^[A-Za-z0-9+/=\s]+$/.test(data)) {
    const err = new Error("Attachment data is invalid.");
    err.statusCode = 400;
    throw err;
  }
  const content = Buffer.from(data.replace(/\s/g, ""), "base64");
  if (!content.byteLength || content.byteLength > MAX_IMAGE_BYTES) {
    const err = new Error("Feedback images must be 5MB or smaller.");
    err.statusCode = 400;
    throw err;
  }
  return { filename, contentType, content };
}

export function sanitizeFeedback(body = {}) {
  const subject = text(body.subject, MAX_SUBJECT);
  const email = text(body.email, MAX_EMAIL).toLowerCase();
  const content = text(body.content, MAX_CONTENT);
  if (!content) {
    const err = new Error("Feedback content is required.");
    err.statusCode = 400;
    throw err;
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const err = new Error("Enter a valid email address.");
    err.statusCode = 400;
    throw err;
  }
  const attachments = Array.isArray(body.attachments)
    ? body.attachments.slice(0, MAX_ATTACHMENTS).map(parseImageAttachment).filter(Boolean)
    : [];
  if (Array.isArray(body.attachments) && body.attachments.length > MAX_ATTACHMENTS) {
    const err = new Error("Attach up to two images.");
    err.statusCode = 400;
    throw err;
  }
  return { subject, email, content, attachments };
}

export function feedbackMailConfig(env = process.env) {
  const host = envValue(env, ["OPENPT_FEEDBACK_SMTP_HOST", "FEEDBACK_SMTP_HOST", "OPENPT_REPORT_SMTP_HOST"]);
  const user = envValue(env, ["OPENPT_FEEDBACK_SMTP_USER", "FEEDBACK_SMTP_USER", "OPENPT_REPORT_SMTP_USER"]);
  const pass = envValue(env, ["OPENPT_FEEDBACK_SMTP_PASS", "FEEDBACK_SMTP_PASS", "OPENPT_REPORT_SMTP_PASS"]);
  const port = Number(envValue(env, ["OPENPT_FEEDBACK_SMTP_PORT", "FEEDBACK_SMTP_PORT", "OPENPT_REPORT_SMTP_PORT"]) || 587);
  const secureValue = envValue(env, ["OPENPT_FEEDBACK_SMTP_SECURE", "FEEDBACK_SMTP_SECURE", "OPENPT_REPORT_SMTP_SECURE"]);
  const to = envValue(env, ["OPENPT_FEEDBACK_TO", "FEEDBACK_TO_EMAIL", "OPENPT_REPORT_TO"]) || user;
  const from = envValue(env, ["OPENPT_FEEDBACK_FROM", "FEEDBACK_FROM_EMAIL", "OPENPT_REPORT_FROM"]) || user || to;
  return {
    host,
    port,
    secure: secureValue ? parseBool(secureValue, port === 465) : port === 465,
    user,
    pass,
    to,
    from,
  };
}

export function hasFeedbackMailConfig(env = process.env) {
  const config = feedbackMailConfig(env);
  return !!(config.host && config.to && (!config.user || config.pass));
}

export async function sendFeedbackEmail(feedback, { env = process.env, transport = null } = {}) {
  const config = feedbackMailConfig(env);
  if (!hasFeedbackMailConfig(env)) {
    const err = new Error("Feedback email is not configured.");
    err.statusCode = 503;
    throw err;
  }

  const mailer = transport || nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user || config.pass ? {
      user: config.user,
      pass: config.pass,
    } : undefined,
  });
  const subject = feedback.subject || "(no subject)";
  const lines = [
    "OpenPT feedback",
    "",
    `Subject: ${subject}`,
    `Email: ${feedback.email || "(not provided)"}`,
    "",
    "Content:",
    feedback.content,
  ];

  await mailer.sendMail({
    to: config.to,
    from: `"OpenPT feedback" <${config.from}>`,
    replyTo: feedback.email || undefined,
    subject: `[OpenPT Feedback] ${subject}`.slice(0, 180),
    text: lines.join("\n"),
    attachments: feedback.attachments.map((attachment) => ({
      filename: attachment.filename,
      contentType: attachment.contentType,
      content: attachment.content,
    })),
  });
  return { sent: true };
}
