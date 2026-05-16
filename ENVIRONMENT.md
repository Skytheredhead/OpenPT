# OpenPT Environment Notes For Agents

Check this file before deployment, server work, or Vercel verification.

## Versioning

- The visible frontend version is defined in `app.jsx` as `OPENPT_VERSION`.
- Bump that value before deployment tests that need to prove Vercel is serving the newest push.
- Current expected version: `0.2.1-sync.20260516`.
- Vercel redeploys automatically after pushes to `main`.
- When testing Vercel, verify the visible title-bar version before testing behavior.
- Vercel currently serves the static frontend only. Sync API routes are provided
  by the systemd server URL, not by Vercel, unless a future HTTPS proxy/rewrite is
  added.

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
- The LAN service currently uses HTTP, so do not set `OPENPT_SECURE_COOKIES=1`
  unless the service is behind HTTPS.

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
