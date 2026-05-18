function decodePointerPart(part) {
  return part.replace(/~1/g, "/").replace(/~0/g, "~");
}

function patchError(message) {
  const err = new Error(message);
  err.statusCode = 400;
  return err;
}

function pathParts(path) {
  if (path === "") return [];
  if (typeof path !== "string" || path[0] !== "/") throw patchError(`Invalid JSON pointer: ${path}`);
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
    if (target == null || typeof target !== "object" || !(part in target)) throw patchError(`Patch path not found: ${path}`);
    target = target[part];
  }
  return { target, key };
}

export function applyJsonPatch(document, patches) {
  let next = clone(document) || {};
  for (const patch of patches || []) {
    const op = patch?.op;
    if (!["add", "replace", "remove"].includes(op)) throw patchError(`Unsupported patch op: ${op}`);
    const parts = pathParts(patch.path);
    if (!parts.length) {
      if (op === "remove") throw patchError("Removing the document root is not supported.");
      if (op === "replace" && next == null) throw patchError(`Patch path not found: ${patch.path}`);
      next = clone(patch.value);
      continue;
    }
    const { target, key } = parentFor(next, patch.path);
    if (target == null || typeof target !== "object") throw patchError(`Patch path not found: ${patch.path}`);
    if (Array.isArray(target)) {
      if (key === "-" && op !== "add") throw patchError(`Invalid array patch index: ${patch.path}`);
      const index = key === "-" ? target.length : Number(key);
      if (!Number.isInteger(index) || index < 0 || index > target.length) throw patchError(`Invalid array patch index: ${patch.path}`);
      if (op !== "add" && index >= target.length) throw patchError(`Patch path not found: ${patch.path}`);
      if (op === "remove") target.splice(index, 1);
      else if (op === "add") target.splice(index, 0, clone(patch.value));
      else target[index] = clone(patch.value);
      continue;
    }
    if (op === "remove") {
      if (!Object.prototype.hasOwnProperty.call(target, key)) throw patchError(`Patch path not found: ${patch.path}`);
      delete target[key];
    } else if (op === "replace") {
      if (!Object.prototype.hasOwnProperty.call(target, key)) throw patchError(`Patch path not found: ${patch.path}`);
      target[key] = clone(patch.value);
    } else {
      target[key] = clone(patch.value);
    }
  }
  return next;
}

export function byteLength(value) {
  return Buffer.byteLength(JSON.stringify(value || {}));
}
