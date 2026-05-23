import test from "node:test";
import assert from "node:assert/strict";
import { AbuseGuard } from "./abuse-guard.mjs";
import { feedbackMailConfig, sanitizeFeedback, sendFeedbackEmail } from "./feedback.mjs";

const tinyPng = "iVBORw0KGgo=";

test("sanitizes feedback and image attachments", () => {
  const feedback = sanitizeFeedback({
    subject: "  Routing bug  ",
    email: " USER@EXAMPLE.COM ",
    content: "  It broke after reload.  ",
    attachments: [{
      filename: "screen.png",
      contentType: "image/png",
      data: tinyPng,
    }],
  });

  assert.equal(feedback.subject, "Routing bug");
  assert.equal(feedback.email, "user@example.com");
  assert.equal(feedback.content, "It broke after reload.");
  assert.equal(feedback.attachments.length, 1);
  assert.equal(feedback.attachments[0].contentType, "image/png");
  assert.ok(Buffer.isBuffer(feedback.attachments[0].content));
});

test("feedback rejects invalid email and excess attachments", () => {
  assert.throws(() => sanitizeFeedback({ email: "not-email", content: "hello" }), /valid email/);
  assert.throws(() => sanitizeFeedback({
    content: "hello",
    attachments: [0, 1, 2].map((index) => ({
      filename: `screen-${index}.png`,
      contentType: "image/png",
      data: tinyPng,
    })),
  }), /up to two images/i);
});

test("feedback rate limits support 1 per minute and 10 per hour", () => {
  const guard = new AbuseGuard({
    feedbackIpMinute: { limit: 1, windowMs: 60_000 },
    feedbackIpHour: { limit: 10, windowMs: 60 * 60_000 },
  });
  guard.check("feedbackIpMinute", "127.0.0.1");
  assert.throws(() => guard.check("feedbackIpMinute", "127.0.0.1"), (err) => {
    assert.equal(err.statusCode, 429);
    assert.ok(err.retryAfter > 0);
    return true;
  });
});

test("feedback mail config accepts SquidHQ FEEDBACK env names", () => {
  const config = feedbackMailConfig({
    FEEDBACK_SMTP_HOST: "smtp.gmail.com",
    FEEDBACK_SMTP_PORT: "465",
    FEEDBACK_SMTP_SECURE: "true",
    FEEDBACK_SMTP_USER: "support@example.com",
    FEEDBACK_SMTP_PASS: "secret",
    FEEDBACK_TO_EMAIL: "owner@example.com",
    FEEDBACK_FROM_EMAIL: "support@example.com",
  });

  assert.equal(config.host, "smtp.gmail.com");
  assert.equal(config.port, 465);
  assert.equal(config.secure, true);
  assert.equal(config.to, "owner@example.com");
});

test("sends feedback email through provided transport with attachments", async () => {
  const calls = [];
  const transport = { sendMail: async (mail) => calls.push(mail) };
  const feedback = sanitizeFeedback({
    subject: "Feature idea",
    email: "reader@example.com",
    content: "Please add VLAN templates.",
    attachments: [{ filename: "idea.png", contentType: "image/png", data: tinyPng }],
  });
  const result = await sendFeedbackEmail(feedback, {
    env: {
      OPENPT_FEEDBACK_SMTP_HOST: "smtp.example.com",
      OPENPT_FEEDBACK_SMTP_USER: "openpt@example.com",
      OPENPT_FEEDBACK_SMTP_PASS: "secret",
      OPENPT_FEEDBACK_TO: "owner@example.com",
    },
    transport,
  });

  assert.deepEqual(result, { sent: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].to, "owner@example.com");
  assert.equal(calls[0].replyTo, "reader@example.com");
  assert.match(calls[0].text, /VLAN templates/);
  assert.equal(calls[0].attachments.length, 1);
});
