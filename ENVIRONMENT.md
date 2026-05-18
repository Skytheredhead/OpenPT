# OpenPT Environment Notes For Agents

Check this file before deployment, server work, or Vercel verification.

## Versioning

- The visible frontend version is defined in `app.jsx` as `OPENPT_VERSION`.
- Bump that value before deployment tests that need to prove Vercel is serving the newest push.
- Current expected version: `0.2.4-sync.20260518`.
- Vercel redeploys automatically after pushes to `main`.
- When testing Vercel, verify the visible title-bar version before testing behavior.
- Vercel serves the static frontend. It uses `https://openptapi.skylarenns.com`
  as the outward-facing sync API.

## GitHub

- Repository: `https://github.com/Skytheredhead/OpenPT.git`
- Production branch for this project: `main`
- User currently expects direct pushes to `main` for this MVP.

## Remote Server

- SSH target: `skylarenns@192.168.1.174`
- Password location on this Mac: `~/Desktop/192.168.1.174.rtf`
- Do not commit, paste, print, or summarize the password.
- Requested remote project parent: `/Documents/GitHub/`
- Actual server path in use: `/home/skylarenns/Documents/GitHub/OpenPT`

## Remote Service

- Service name: `openpt.service`
- App command: `npm run dev`
- Default local port on the remote server: `5173`
- Data directory default: `<repo>/.openpt-data`
- Public API hostname: `openptapi.skylarenns.com`
- Cloudflare tunnel ingress maps `openptapi.skylarenns.com` to
  `http://127.0.0.1:5173`.
- The public tunnel uses HTTPS, so the remote service should set
  `OPENPT_SECURE_COOKIES=1`.
- Spam proofing is handled in-process by `server/abuse-guard.mjs`: Cloudflare-aware
  IP detection, auth/project/share/save throttles, retry-after responses, and a
  hidden signup honeypot field. Restarting the service resets in-memory counters.

## Local Verification

```sh
npm install
npm test
node --check server/index.mjs
```

Start locally:

```sh
npm run dev
```
