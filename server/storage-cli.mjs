import { join, resolve } from "node:path";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ObjectStore } from "./object-store.mjs";
import { OpenPTStore } from "./storage.mjs";
import { cleanupObjects, createBackup, restoreBackup, RESTORE_CONFIRMATION } from "./storage-admin.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

try {
  process.loadEnvFile?.(join(root, ".env"));
} catch (err) {
  if (err?.code !== "ENOENT") throw err;
}

function argValue(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] || null;
}

function dataDir() {
  return resolve(process.env.OPENPT_DATA_DIR || join(root, ".openpt-data"));
}

function openStore(dir) {
  return new OpenPTStore({
    dbPath: join(dir, "openpt.sqlite"),
    objectStore: new ObjectStore(join(dir, "objects"))
  });
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

async function main() {
  const command = process.argv[2];
  const dir = dataDir();

  if (command === "backup") {
    const store = openStore(dir);
    try {
      const result = await createBackup({ dataDir: dir, store, reason: "cli" });
      print({ backup: { id: result.id, path: result.path, manifest: result.manifest } });
    } finally {
      store.db.close();
    }
    return;
  }

  if (command === "cleanup" || command === "cleanup:dry-run") {
    const store = openStore(dir);
    try {
      const olderThanDays = argValue("--older-than-days");
      const result = await cleanupObjects({
        store,
        objectStore: store.objects,
        dryRun: command === "cleanup:dry-run" || process.argv.includes("--dry-run"),
        olderThanDays: olderThanDays == null ? undefined : Number(olderThanDays)
      });
      print(result);
    } finally {
      store.db.close();
    }
    return;
  }

  if (command === "restore") {
    const backupId = argValue("--backup");
    if (!backupId) throw new Error("Usage: npm run storage:restore -- --backup <id>");
    const result = await restoreBackup({ dataDir: dir, backupId });
    print({ restore: result, confirmation: RESTORE_CONFIRMATION });
    return;
  }

  throw new Error("Usage: node server/storage-cli.mjs <backup|cleanup|cleanup:dry-run|restore>");
}

main().catch((err) => {
  process.stderr.write(`${err.stack || err.message}\n`);
  process.exitCode = 1;
});
