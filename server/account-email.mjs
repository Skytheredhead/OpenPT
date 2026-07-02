import nodemailer from "nodemailer";

function text(value, max = 500) {
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

function cleanBaseUrl(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

export function accountMailConfig(env = process.env) {
  const host = envValue(env, ["OPENPT_ACCOUNT_SMTP_HOST", "OPENPT_FEEDBACK_SMTP_HOST", "OPENPT_REPORT_SMTP_HOST"]);
  const user = envValue(env, ["OPENPT_ACCOUNT_SMTP_USER", "OPENPT_FEEDBACK_SMTP_USER", "OPENPT_REPORT_SMTP_USER"]);
  const pass = envValue(env, ["OPENPT_ACCOUNT_SMTP_PASS", "OPENPT_FEEDBACK_SMTP_PASS", "OPENPT_REPORT_SMTP_PASS"]);
  const port = Number(envValue(env, ["OPENPT_ACCOUNT_SMTP_PORT", "OPENPT_FEEDBACK_SMTP_PORT", "OPENPT_REPORT_SMTP_PORT"]) || 587);
  const secureValue = envValue(env, ["OPENPT_ACCOUNT_SMTP_SECURE", "OPENPT_FEEDBACK_SMTP_SECURE", "OPENPT_REPORT_SMTP_SECURE"]);
  const from = envValue(env, ["OPENPT_ACCOUNT_EMAIL_FROM", "OPENPT_FEEDBACK_FROM", "OPENPT_REPORT_FROM"]) || user;
  const debug = parseBool(env.OPENPT_ACCOUNT_EMAIL_DEBUG, false);
  return {
    host,
    port,
    secure: secureValue ? parseBool(secureValue, port === 465) : port === 465,
    user,
    pass,
    from,
    debug
  };
}

export function hasAccountMailConfig(env = process.env) {
  const config = accountMailConfig(env);
  return !!(config.host && config.from && (!config.user || config.pass));
}

export function publicBaseUrl(req, env = process.env, allowedOrigins = []) {
  if (env.OPENPT_PUBLIC_URL) return cleanBaseUrl(env.OPENPT_PUBLIC_URL);
  const origin = cleanBaseUrl(req.headers.origin || "");
  if (origin && allowedOrigins.includes(origin)) return origin;
  const proto = req.headers["x-forwarded-proto"] || "http";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "127.0.0.1:5173";
  return cleanBaseUrl(`${String(proto).split(",")[0]}://${String(host).split(",")[0]}`);
}

async function sendAccountEmail({ to, subject, body, env = process.env, transport = null }) {
  const config = accountMailConfig(env);
  if (config.debug) return { sent: false, reason: "debug" };
  if (!hasAccountMailConfig(env)) return { sent: false, reason: "not-configured" };
	  const mailer = transport || nodemailer.createTransport({
	    host: config.host,
	    port: config.port,
	    secure: config.secure,
	    auth: config.user || config.pass ? { user: config.user, pass: config.pass } : undefined,
	    disableFileAccess: true,
	    disableUrlAccess: true
	  });
  await mailer.sendMail({
    to,
    from: `"OpenPT accounts" <${config.from}>`,
    subject: subject.slice(0, 180),
    text: body
  });
  return { sent: true };
}

export async function sendVerificationEmail(email, token, { baseUrl, env = process.env, transport = null } = {}) {
  const safeEmail = text(email, 320).toLowerCase();
  const link = `${baseUrl}/?verifyEmail=${encodeURIComponent(token)}`;
  const result = await sendAccountEmail({
    to: safeEmail,
    subject: "Verify your OpenPT account",
    body: [
      "Verify your OpenPT account",
      "",
      `Open this link to verify ${safeEmail}:`,
      link,
      "",
      "This link expires in 24 hours."
    ].join("\n"),
    env,
    transport
  });
  const debug = accountMailConfig(env).debug;
  return { ...result, link: debug || result.sent ? link : undefined, token: debug ? token : undefined };
}

export async function sendPasswordResetEmail(email, token, { baseUrl, env = process.env, transport = null } = {}) {
  const safeEmail = text(email, 320).toLowerCase();
  const link = `${baseUrl}/?resetPassword=${encodeURIComponent(token)}`;
  const result = await sendAccountEmail({
    to: safeEmail,
    subject: "Reset your OpenPT password",
    body: [
      "Reset your OpenPT password",
      "",
      `Open this link to choose a new password for ${safeEmail}:`,
      link,
      "",
      "This link expires in 1 hour. If you did not request it, you can ignore this email."
    ].join("\n"),
    env,
    transport
  });
  const debug = accountMailConfig(env).debug;
  return { ...result, link: debug || result.sent ? link : undefined, token: debug ? token : undefined };
}
