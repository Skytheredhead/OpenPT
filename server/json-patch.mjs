function decodePointerPart(part) {
  return part.replace(/~1/g, "/").replace(/~0/g, "~");
}

function pathParts(path) {
  if (path === "") return [];
  if (!path || path[0] !== "/") throw new Error(`Invalid JSON pointer: ${path}`);
  return path.slice(1).split("/").map(decodePointerPart);
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function parentFor(doc, path) {
  const parts = pathParts(path);
  const key = parts.pop();
  let target = doc;
  for (const part of parts) {
    if (target == null || !(part in target)) throw new Error(`Patch path not found: ${path}`);
    target = target[part];
  }
  return { target, key };
}

export function applyJsonPatch(document, patches) {
  const next = clone(document) || {};
  for (const patch of patches || []) {
    const op = patch?.op;
    if (!["add", "replace", "remove"].includes(op)) throw new Error(`Unsupported patch op: ${op}`);
    const { target, key } = parentFor(next, patch.path);
    if (Array.isArray(target)) {
      const index = key === "-" ? target.length : Number(key);
      if (!Number.isInteger(index) || index < 0 || index > target.length) throw new Error(`Invalid array patch index: ${patch.path}`);
      if (op === "remove") target.splice(index, 1);
      else if (op === "add") target.splice(index, 0, clone(patch.value));
      else {
        if (index >= target.length) throw new Error(`Patch path not found: ${patch.path}`);
        target[index] = clone(patch.value);
      }
      continue;
    }
    if (op === "remove") {
      delete target[key];
    } else {
      target[key] = clone(patch.value);
    }
  }
  return next;
}

export function byteLength(value) {
  return Buffer.byteLength(JSON.stringify(value || {}));
}
