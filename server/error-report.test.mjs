import test from "node:test";
import assert from "node:assert/strict";
import { AbuseGuard } from "./abuse-guard.mjs";
import { reportFingerprint, sanitizeErrorReport, sendErrorReportEmail } from "./error-report.mjs";

test("sanitizes error reports without raw Packet Tracer bytes", () => {
  const report = sanitizeErrorReport({
    appVersion: "0.2.4",
    activity: {
      sourceName: "lab.pka",
      sourceSha256: "a".repeat(64),
      rawFile: { bytes: new Uint8Array([1, 2, 3]) },
      decoded: { xml: "<huge />" },
      reverseReport: {
        decoder: { status: "failed", attemptedProfile: "ptsave", error: "bad auth tag" },
        interestingStrings: [{ offset: 1, length: 4, text: "test" }],
      },
    },
  });
  assert.equal(report.sourceName, "lab.pka");
  assert.equal(report.decoder.error, "bad auth tag");
  assert.equal(report.rawFile, undefined);
  assert.equal(report.decoded, undefined);
  assert.equal(report.interestingStrings.length, 1);
});

test("fingerprints duplicate reports consistently", () => {
  const a = sanitizeErrorReport({ message: "decode failed", sourceSha256: "abc" });
  const b = sanitizeErrorReport({ message: "decode failed", sourceSha256: "abc" });
  assert.equal(reportFingerprint(a), reportFingerprint(b));
});

test("error report rate limits support retry-after", () => {
  const guard = new AbuseGuard({ errorReportFingerprint: { limit: 1, windowMs: 60_000 } });
  guard.check("errorReportFingerprint", "same");
  assert.throws(() => guard.check("errorReportFingerprint", "same"), (err) => {
    assert.equal(err.statusCode, 429);
    assert.ok(err.retryAfter > 0);
    return true;
  });
});

test("skips email when SMTP is not configured", async () => {
  const result = await sendErrorReportEmail({ message: "x" }, { env: {}, logger: { warn() {} } });
  assert.deepEqual(result, { sent: false, reason: "not-configured" });
});

test("sends email through provided transport", async () => {
  const calls = [];
  const transport = { sendMail: async (mail) => calls.push(mail) };
  const result = await sendErrorReportEmail(
    sanitizeErrorReport({ message: "decode failed", sourceSha256: "abc" }),
    {
      env: {
        OPENPT_REPORT_TO: "owner@example.com",
        OPENPT_REPORT_FROM: "openpt@example.com",
        OPENPT_REPORT_SMTP_HOST: "smtp.example.com",
      },
      transport,
    }
  );
  assert.equal(result.sent, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].to, "owner@example.com");
  assert.match(calls[0].text, /decode failed/);
});
