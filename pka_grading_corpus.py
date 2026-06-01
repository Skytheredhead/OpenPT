#!/usr/bin/env python3
"""Local Packet Tracer grading coverage reporter.

This helper intentionally does not require committing proprietary .pka files.
Point it at OpenPT reverse-report/activity JSON exports to summarize decoded
assessment/grading coverage, or at .pka/.pkt files to fingerprint them for a
private local corpus.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
from typing import Any, Iterable


def iter_inputs(paths: Iterable[Path]) -> Iterable[Path]:
    for path in paths:
        if path.is_dir():
            yield from sorted(
                p for p in path.rglob("*")
                if p.suffix.lower() in {".json", ".pka", ".pkt"}
            )
        elif path.suffix.lower() in {".json", ".pka", ".pkt"}:
            yield path


def sha256_hex(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def load_json(path: Path) -> Any | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def summarize_activity(path: Path, data: dict[str, Any]) -> dict[str, Any]:
    model = data.get("assessmentModel") or {}
    leaves = model.get("leaves") or data.get("assessmentItems") or []
    visible = [item for item in leaves if item.get("visible", True) is not False]
    grading = data.get("gradingRun") or {}
    progress = data.get("progress") or {}
    counts = grading.get("summary") or progress.get("counts") or {}
    unchecked = [
        item for item in data.get("assessmentItems", [])
        if item.get("unchecked") or item.get("status") == "Unchecked"
    ]
    unsupported: dict[str, int] = {}
    for item in unchecked:
        reason = ((item.get("evidence") or {}).get("unsupportedReason") or "unknown")
        unsupported[reason] = unsupported.get(reason, 0) + 1
    return {
        "path": str(path),
        "kind": "openpt-activity-json",
        "title": data.get("title") or data.get("sourceName") or path.name,
        "sourceSha256": data.get("sourceSha256"),
        "importerVersion": data.get("importerVersion"),
        "assessmentLeaves": len(leaves),
        "visibleLeaves": len(visible),
        "score": progress.get("score"),
        "counts": counts,
        "unsupported": unsupported,
        "checkerCoverage": grading.get("byChecker") or [],
    }


def summarize_pka(path: Path) -> dict[str, Any]:
    return {
        "path": str(path),
        "kind": "packet-tracer-binary",
        "name": path.name,
        "size": path.stat().st_size,
        "sha256": sha256_hex(path),
        "note": "Decode this in OpenPT and export the reverse-report JSON for grading coverage.",
    }


def summarize(path: Path) -> dict[str, Any]:
    if path.suffix.lower() in {".pka", ".pkt"}:
        return summarize_pka(path)
    data = load_json(path)
    if isinstance(data, dict) and (
        data.get("format") == "packet-tracer-activity" or
        data.get("assessmentModel") or
        data.get("assessmentItems")
    ):
        return summarize_activity(path, data)
    return {"path": str(path), "kind": "ignored-json", "note": "No OpenPT Packet Tracer activity fields found."}


def main() -> int:
    parser = argparse.ArgumentParser(description="Summarize local OpenPT .pka grading coverage.")
    parser.add_argument("paths", nargs="+", type=Path, help="Activity JSON, .pka/.pkt files, or folders.")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON output.")
    args = parser.parse_args()
    rows = [summarize(path) for path in iter_inputs(args.paths)]
    print(json.dumps({"format": "openpt-pka-grading-corpus", "version": 1, "count": len(rows), "files": rows}, indent=2 if args.pretty else None))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
