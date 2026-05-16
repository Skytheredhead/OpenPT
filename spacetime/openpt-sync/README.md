# OpenPT SpacetimeDB Sync Module

This directory is the SpacetimeDB 2.x boundary for OpenPT project sync.

The current MVP routes browser traffic through the Fastify gateway in `server/`.
The gateway owns email/password auth, quota checks, object storage, and HTTP
share links. SpacetimeDB is reserved for realtime PT-side state: head-version
notifications, edit leases, presence, and patch-batch indexes.

Publish this module after installing the SpacetimeDB CLI:

```sh
spacetime publish openpt-sync spacetime/openpt-sync
```

The gateway can then mirror accepted patch saves and lease changes into this
module. Large project snapshots and patch blobs should remain in object storage,
not SpacetimeDB hot tables.

