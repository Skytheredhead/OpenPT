import { schema, table, t } from "spacetimedb/server";

export const ProjectHead = table("project_head", {
  project_id: t.string(),
  version: t.u64(),
  object_key: t.string(),
  updated_at_ms: t.u64(),
}, {
  primaryKey: "project_id",
});

export const ProjectLease = table("project_lease", {
  project_id: t.string(),
  lease_id: t.string(),
  client_id: t.string(),
  client_label: t.string(),
  expires_at_ms: t.u64(),
}, {
  primaryKey: "project_id",
});

export const PatchBatch = table("patch_batch", {
  id: t.string(),
  project_id: t.string(),
  version: t.u64(),
  patch_key: t.string(),
  created_at_ms: t.u64(),
}, {
  primaryKey: "id",
});

export const ClientPresence = table("client_presence", {
  project_id: t.string(),
  client_id: t.string(),
  client_label: t.string(),
  last_seen_at_ms: t.u64(),
}, {
  primaryKey: ["project_id", "client_id"],
});

spacetimedb.reducer("publish_head", {
  project_id: t.string(),
  version: t.u64(),
  object_key: t.string(),
  updated_at_ms: t.u64(),
}, (ctx, row) => {
  ctx.db.project_head.project_id.delete(row.project_id);
  ctx.db.project_head.insert(row);
});

spacetimedb.reducer("publish_patch_batch", {
  id: t.string(),
  project_id: t.string(),
  version: t.u64(),
  patch_key: t.string(),
  created_at_ms: t.u64(),
}, (ctx, row) => {
  ctx.db.patch_batch.insert(row);
});

spacetimedb.reducer("upsert_lease", {
  project_id: t.string(),
  lease_id: t.string(),
  client_id: t.string(),
  client_label: t.string(),
  expires_at_ms: t.u64(),
}, (ctx, row) => {
  ctx.db.project_lease.project_id.delete(row.project_id);
  ctx.db.project_lease.insert(row);
});

spacetimedb.reducer("release_lease", {
  project_id: t.string(),
  lease_id: t.string(),
}, (ctx, { project_id, lease_id }) => {
  const existing = ctx.db.project_lease.project_id.find(project_id);
  if (existing && existing.lease_id === lease_id) {
    ctx.db.project_lease.project_id.delete(project_id);
  }
});

spacetimedb.reducer("heartbeat", {
  project_id: t.string(),
  client_id: t.string(),
  client_label: t.string(),
  last_seen_at_ms: t.u64(),
}, (ctx, row) => {
  ctx.db.client_presence.project_id_client_id.delete(row.project_id, row.client_id);
  ctx.db.client_presence.insert(row);
});

export default schema({
  tables: [ProjectHead, ProjectLease, PatchBatch, ClientPresence],
});
