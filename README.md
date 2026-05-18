## Open-Source Packet Tracer

Tired of packet tracer's trash ui and terrible mac support? Voila! OpenPT

Features:
- pt file importer
- `.otp` project export/import with readable JSON packages
- switches
- routers
- commands

## OTP package format

OpenPT `.otp` files are non-obfuscated JSON packages. They store the normalized
project document, Packet Tracer assignment content when present, generated
running/startup configs and flash files per device, session logs, and provenance
metadata. The format is meant to carry the practical contents a `.pka` activity
needs while keeping everything inspectable and diff-friendly.

## Self-hosted sync MVP

Before deployment or environment work, agents should read `ENVIRONMENT.md`.

OpenPT now includes an optional self-hosted sync server. The simulator still runs
locally in the browser, but signed-in users can save private projects to the
server, autosave patch batches, create share links, and roll back recent project
versions.

```sh
npm install
npm run dev
```

The server listens on `http://127.0.0.1:5173` by default and stores data under
`.openpt-data/`.

Current sync behavior:

- Email/password accounts.
- Private cloud projects.
- Read-only and editable share links for non-users.
- One active edit lease per project so another browser shows read-only until it
  takes over.
- Autosave after 20 meaningful project changes or 1 minute from the first dirty
  change, whichever comes first.
- No autosave traffic when a project is clean.
- Server-side minimum autosave interval of 10 seconds.
- Patch/diff save payloads with local IndexedDB offline queueing.
- Rollback targets for 1m, 5m, 10m, 30m, and 1h.
- 5GB per-user storage limit and 500MB max project size.

SpacetimeDB 2.x is kept as the realtime PT-side sync boundary in
`spacetime/openpt-sync`. The Fastify gateway owns auth, quota checks, object
storage, and HTTP share links; large project blobs remain in object storage
rather than hot SpacetimeDB tables.

## Future classroom roadmap

Teacher/classroom features come after personal sync. Planned flow:

- Teachers build assignment projects from normal OpenPT projects.
- Students open a teacher assignment magic link.
- Students enter their name without creating a permanent account.
- OpenPT creates a temporary assignment workspace under the teacher account.
- Students submit from the browser.
- Teachers review submissions and rollback/replay state.
