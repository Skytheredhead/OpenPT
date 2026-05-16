#!/usr/bin/env python3
"""Packet Tracer PKA/PKT inventory and reverse-engineering helper.

This is not a universal Packet Tracer decryptor. It mirrors the browser
importer's safe static analysis so we can fingerprint activities locally,
find obvious embedded payload signatures, and generate data for extractor
profiles that the website can match by SHA-256.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
from typing import Iterable


SIGNATURES: tuple[tuple[str, bytes], ...] = (
    ("PDF", b"%PDF-"),
    ("ZIP local file", b"PK\x03\x04"),
    ("ZIP end record", b"PK\x05\x06"),
    ("GZIP", b"\x1f\x8b\x08"),
    ("PNG", b"\x89PNG\r\n\x1a\n"),
    ("JPEG", b"\xff\xd8\xff"),
    ("RTF", b"{\\rtf"),
    ("HTML", b"<html"),
    ("SQLite", b"SQLite format 3\x00"),
)

INTERESTING_WORDS = (
    "packet",
    "tracer",
    "cisco",
    "html",
    "pdf",
    "rtf",
    "assessment",
    "rubric",
    "score",
    "device",
    "router",
    "switch",
    "interface",
    "config",
    "activity",
    "instruction",
)


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def hex_bytes(data: bytes) -> str:
    return " ".join(f"{b:02x}" for b in data)


def entropy(data: bytes) -> float:
    if not data:
        return 0.0
    counts = [0] * 256
    for byte in data:
        counts[byte] += 1
    total = len(data)
    value = 0.0
    for count in counts:
        if count:
            p = count / total
            value -= p * math.log2(p)
    return round(value, 4)


def entropy_windows(data: bytes, window_size: int = 4096, limit: int = 16) -> list[dict]:
    rows = []
    for offset in range(0, len(data), window_size):
        if len(rows) >= limit:
            break
        chunk = data[offset : offset + window_size]
        rows.append({"offset": offset, "length": len(chunk), "entropy": entropy(chunk)})
    return rows


def find_signatures(data: bytes) -> list[dict]:
    hits = []
    for label, needle in SIGNATURES:
        start = 0
        while True:
            offset = data.find(needle, start)
            if offset == -1:
                break
            hits.append({"label": label, "offset": offset, "hex": needle.hex()})
            start = offset + 1
            if len(hits) >= 200:
                return sorted(hits, key=lambda row: row["offset"])
    return sorted(hits, key=lambda row: row["offset"])


def ascii_strings(data: bytes, min_length: int = 8, limit: int = 120) -> list[dict]:
    rows = []
    start: int | None = None
    chars: list[str] = []

    def flush() -> None:
        nonlocal start, chars
        if start is not None and len(chars) >= min_length:
            rows.append({"offset": start, "length": len(chars), "text": "".join(chars)})
        start = None
        chars = []

    for idx, byte in enumerate(data):
        if 32 <= byte <= 126:
            if start is None:
                start = idx
            chars.append(chr(byte))
        else:
            flush()
        if len(rows) >= limit:
            break
    flush()
    return rows[:limit]


def analyze_file(path: Path) -> dict:
    data = path.read_bytes()
    strings = ascii_strings(data)
    interesting = [
        row
        for row in strings
        if any(word in row["text"].lower() for word in INTERESTING_WORDS)
    ][:40]
    return {
        "path": str(path),
        "name": path.name,
        "size": len(data),
        "sha256": sha256_hex(data),
        "headHex": hex_bytes(data[:16]),
        "tailHex": hex_bytes(data[-16:]),
        "entropy": entropy(data),
        "entropyByWindow": entropy_windows(data),
        "signatures": find_signatures(data),
        "strings": strings,
        "interestingStrings": interesting,
    }


def iter_packet_tracer_files(paths: Iterable[Path]) -> Iterable[Path]:
    for path in paths:
        if path.is_dir():
            yield from sorted(p for p in path.rglob("*") if p.suffix.lower() in {".pka", ".pkt"})
        elif path.suffix.lower() in {".pka", ".pkt"}:
            yield path


def main() -> int:
    parser = argparse.ArgumentParser(description="Inventory Packet Tracer .pka/.pkt files.")
    parser.add_argument("paths", nargs="*", type=Path, help="Files or folders to scan.")
    parser.add_argument("--output", "-o", type=Path, help="Write JSON report to this path.")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON.")
    args = parser.parse_args()

    roots = args.paths or [Path.home() / "Downloads"]
    files = list(iter_packet_tracer_files(roots))
    report = {
        "format": "openpt-pka-inventory",
        "version": 1,
        "count": len(files),
        "files": [analyze_file(path) for path in files],
    }
    text = json.dumps(report, indent=2 if args.pretty else None)
    if args.output:
        args.output.write_text(text + "\n", encoding="utf-8")
    else:
        print(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
