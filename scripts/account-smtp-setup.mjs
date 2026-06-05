import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { chmod, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const HOST = "127.0.0.1";
const PORT = Number(process.env.PORT || 8765);
const REMOTE = process.env.OPENPT_SETUP_REMOTE || "skylarenns@shhh.skylarenns.com";
const SUDO_PASSWORD_FILE = process.env.OPENPT_SETUP_SUDO_PASSWORD_FILE || join(homedir(), "Desktop", "192.168.1.174.rtf");
const LOCAL_ENV_FILE = process.env.OPENPT_SETUP_LOCAL_ENV_FILE || "/tmp/openpt-account-smtp.env";

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function systemdQuote(value) {
  return `"${String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "")
    .replace(/\r/g, "")}"`;
}

function page({ status = "", error = "" } = {}) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>OpenPT Account Email Setup</title>
<style>
  :root { color-scheme: dark; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #101214; color: #f4f7f8; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: radial-gradient(circle at 20% 0%, #193242 0, transparent 34rem), #101214; }
  main { width: min(440px, calc(100vw - 32px)); }
  h1 { font-size: 22px; margin: 0 0 8px; letter-spacing: 0; }
  p { margin: 0 0 18px; color: #aeb9be; line-height: 1.45; }
  form { display: grid; gap: 12px; padding: 20px; border: 1px solid #344047; background: #171b1f; border-radius: 8px; box-shadow: 0 16px 44px #0008; }
  label { display: grid; gap: 6px; font-size: 13px; color: #dce5e8; }
  input { width: 100%; border: 1px solid #3b4850; background: #0f1214; color: #f4f7f8; border-radius: 6px; padding: 11px 12px; font: inherit; }
  input:focus { outline: 2px solid #65b6d9; outline-offset: 2px; }
  button { border: 0; border-radius: 6px; padding: 11px 14px; font-weight: 700; color: #071014; background: #75d0f6; cursor: pointer; }
  button:disabled { opacity: .65; cursor: wait; }
  .row { display: grid; grid-template-columns: 1fr 120px; gap: 10px; }
  .status, .error { padding: 10px 12px; border-radius: 6px; line-height: 1.4; }
  .status { background: #143526; color: #b9f3cf; border: 1px solid #23613f; }
  .error { background: #3a1717; color: #ffd0d0; border: 1px solid #7b3030; }
</style>
</head>
<body>
<main>
  <h1>OpenPT Account Email Setup</h1>
  <p>This local-only form saves a temporary SMTP env file, writes the same settings to the OpenPT server, and restarts the service.</p>
  <form method="post" action="/save" autocomplete="off">
    ${status ? `<div class="status">${escapeHtml(status)}</div>` : ""}
    ${error ? `<div class="error">${escapeHtml(error)}</div>` : ""}
    <label>Gmail address
      <input name="gmail" type="email" inputmode="email" autocomplete="off" spellcheck="false" required placeholder="name@gmail.com" />
    </label>
    <label>Gmail app password
      <input name="appPassword" type="password" autocomplete="new-password" required minlength="8" placeholder="16-character app password" />
    </label>
    <div class="row">
      <label>SMTP host
        <input name="host" value="smtp.gmail.com" required />
      </label>
      <label>Port
        <input name="port" value="465" inputmode="numeric" required />
      </label>
    </div>
    <button type="submit">Save on server</button>
  </form>
</main>
<script>
  document.querySelector("form").addEventListener("submit", () => {
    document.querySelector("button").disabled = true;
    document.querySelector("button").textContent = "Saving...";
  });
</script>
</body>
</html>`;
}

async function readSudoPassword() {
  let raw = "";
  if (SUDO_PASSWORD_FILE.endsWith(".rtf")) {
    raw = await new Promise((resolve, reject) => {
      const textutil = spawn("textutil", ["-convert", "txt", "-stdout", SUDO_PASSWORD_FILE], { stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      textutil.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      textutil.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
      textutil.on("error", reject);
      textutil.on("close", (code) => {
        if (code === 0) resolve(stdout);
        else reject(new Error(`Could not convert sudo password file.${stderr ? ` ${stderr.trim()}` : ""}`));
      });
    });
  } else {
    raw = await readFile(SUDO_PASSWORD_FILE, "utf8");
  }
  return raw.split(/\r?\n/).map((line) => line.trim()).find(Boolean) || "";
}

async function saveLocalEnv(dropIn) {
  await writeFile(LOCAL_ENV_FILE, dropIn, { mode: 0o600 });
  await chmod(LOCAL_ENV_FILE, 0o600);
}

async function applySettings(fields) {
  const gmail = String(fields.get("gmail") || "").trim();
  const appPassword = String(fields.get("appPassword") || "").trim();
  const host = String(fields.get("host") || "smtp.gmail.com").trim();
  const port = String(fields.get("port") || "465").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(gmail)) throw new Error("Enter a valid Gmail address.");
  if (!appPassword) throw new Error("Enter the Gmail app password.");
  if (!/^\d+$/.test(port)) throw new Error("SMTP port must be numeric.");

  const secure = port === "465" ? "1" : "0";
  const dropIn = [
    "[Service]",
    `Environment=OPENPT_ACCOUNT_SMTP_HOST=${systemdQuote(host)}`,
    `Environment=OPENPT_ACCOUNT_SMTP_PORT=${systemdQuote(port)}`,
    `Environment=OPENPT_ACCOUNT_SMTP_SECURE=${systemdQuote(secure)}`,
    `Environment=OPENPT_ACCOUNT_SMTP_USER=${systemdQuote(gmail)}`,
    `Environment=OPENPT_ACCOUNT_SMTP_PASS=${systemdQuote(appPassword)}`,
    `Environment=OPENPT_ACCOUNT_EMAIL_FROM=${systemdQuote(gmail)}`,
    `Environment=OPENPT_PUBLIC_URL=${systemdQuote("https://openpt.dev")}`,
    ""
  ].join("\n");
  await saveLocalEnv(dropIn);

  const sudoPassword = await readSudoPassword();
  if (!sudoPassword) throw new Error("Could not read remote sudo password file.");
  const encoded = Buffer.from(dropIn, "utf8").toString("base64");
  const remoteScript = `set -euo pipefail
sudo_pw() { printf '%s\\n' "$SUDOPW" | command sudo -S "$@"; }
base64 -d > /tmp/openpt-account-email.conf <<'EOF'
${encoded}
EOF
sudo_pw install -m 0600 /tmp/openpt-account-email.conf /etc/systemd/system/openpt.service.d/account-email.conf
rm -f /tmp/openpt-account-email.conf
sudo_pw systemctl daemon-reload
sudo_pw systemctl restart openpt.service
systemctl is-active openpt.service >/dev/null
systemctl show openpt.service -p Environment --value | tr ' ' '\\n' | grep -E '^(OPENPT_ACCOUNT_SMTP_HOST|OPENPT_ACCOUNT_SMTP_USER|OPENPT_ACCOUNT_SMTP_PORT|OPENPT_ACCOUNT_SMTP_SECURE|OPENPT_ACCOUNT_EMAIL_FROM|OPENPT_PUBLIC_URL)='
`;

  await new Promise((resolve, reject) => {
    const ssh = spawn("ssh", ["-o", "BatchMode=yes", REMOTE, "bash -s"], { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    ssh.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    ssh.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    ssh.on("error", reject);
    ssh.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Remote setup failed.${stderr ? ` ${stderr.replace(/\[sudo\].*?:/g, "").trim()}` : ""}${stdout ? ` ${stdout.trim()}` : ""}`));
    });
    ssh.stdin.end([
      "read -r SUDOPW_B64",
      Buffer.from(sudoPassword, "utf8").toString("base64"),
      'SUDOPW="$(printf \'%s\' "$SUDOPW_B64" | base64 -d)"',
      remoteScript
    ].join("\n"));
  });
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(page());
      return;
    }
    if (req.method === "POST" && req.url === "/save") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = Buffer.concat(chunks).toString("utf8");
      await applySettings(new URLSearchParams(body));
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(page({ status: "Saved SMTP settings and restarted OpenPT. You can close this page." }));
      return;
    }
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end("Not found");
  } catch (err) {
    res.writeHead(500, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(page({ error: err?.message || "Setup failed." }));
  }
});

server.listen(PORT, HOST, () => {
  console.log(`OpenPT account email setup is running at http://${HOST}:${PORT}/`);
});
