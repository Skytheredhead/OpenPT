import test from "node:test";
import assert from "node:assert/strict";
import { publicBaseUrl, sendPasswordResetEmail } from "./account-email.mjs";

function req(headers = {}) {
  return { headers };
}

test("account links only trust configured public URL or allowed origins", () => {
  assert.equal(
    publicBaseUrl(
      req({ origin: "https://evil.example", host: "openptapi.example", "x-forwarded-proto": "https" }),
      {},
      ["https://openpt.example"]
    ),
    "https://openptapi.example"
  );
  assert.equal(
    publicBaseUrl(req({ origin: "https://openpt.example", host: "openptapi.example" }), {}, ["https://openpt.example"]),
    "https://openpt.example"
  );
  assert.equal(
    publicBaseUrl(req({ origin: "https://evil.example" }), { OPENPT_PUBLIC_URL: "https://openpt.example/" }, []),
    "https://openpt.example"
  );
});

test("password reset tokens are only returned in explicit account email debug mode", async () => {
  const normal = await sendPasswordResetEmail("user@example.com", "secret-token", {
    baseUrl: "https://openpt.example",
    env: { OPENPT_ACCOUNT_EMAIL_DEBUG: "0" }
  });
  assert.equal(normal.sent, false);
  assert.equal(normal.token, undefined);
  assert.equal(normal.link, undefined);

  const debug = await sendPasswordResetEmail("user@example.com", "secret-token", {
    baseUrl: "https://openpt.example",
    env: { OPENPT_ACCOUNT_EMAIL_DEBUG: "1" }
  });
  assert.equal(debug.sent, false);
  assert.equal(debug.token, "secret-token");
  assert.equal(debug.link, "https://openpt.example/?resetPassword=secret-token");
});
