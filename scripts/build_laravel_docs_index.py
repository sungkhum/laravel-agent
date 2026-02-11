#!/usr/bin/env python3
"""Builds a compressed Laravel docs index and injects it into AGENTS.md."""

from __future__ import annotations

import argparse
import os
import shutil
from pathlib import Path

DOCS_ROOT = Path(".laravel-docs")
EXTRA_DOCS_ROOT = Path(".laravel-docs-extra")
AGENTS_PATH = Path("AGENTS.md")
START_MARKER = "<!-- LARAVEL_DOCS_INDEX_START -->"
END_MARKER = "<!-- LARAVEL_DOCS_INDEX_END -->"


def _iter_docs(root: Path) -> dict[str, list[str]]:
    entries: dict[str, list[str]] = {}
    for current_root, dirnames, filenames in os.walk(root):
        # Skip typical non-doc folders
        dirnames[:] = [d for d in dirnames if d not in {".git", "node_modules", ".idea", ".vscode"}]
        rel_dir = Path(current_root).relative_to(root)
        doc_files = sorted(
            f
            for f in filenames
            if f.lower().endswith((".md", ".mdx"))
        )
        if not doc_files:
            continue
        key = "." if rel_dir == Path(".") else rel_dir.as_posix()
        entries[key] = doc_files
    return dict(sorted(entries.items(), key=lambda item: item[0]))


def _merge_extra_docs(docs_root: Path) -> bool:
    if not EXTRA_DOCS_ROOT.exists():
        return False
    for entry in EXTRA_DOCS_ROOT.iterdir():
        destination = docs_root / entry.name
        if destination.exists():
            if destination.is_dir():
                shutil.rmtree(destination)
            else:
                destination.unlink()
        if entry.is_dir():
            shutil.copytree(entry, destination, dirs_exist_ok=True)
        else:
            shutil.copy2(entry, destination)
    return True


def _build_index(entries: dict[str, list[str]], root_display: str) -> str:
    parts = [
        "[Laravel Docs Index]",
        f"root: {root_display}",
        "IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning for any Laravel tasks.",
    ]
    lines = ["|".join(parts)]
    for path, files in entries.items():
        files_list = ",".join(files)
        lines.append(f"|{path}:{{{files_list}}}")
    return "\n".join(lines)


def _inject_index(agents_text: str, index_text: str) -> str:
    if START_MARKER not in agents_text or END_MARKER not in agents_text:
        raise SystemExit("AGENTS.md is missing index markers.")
    before, rest = agents_text.split(START_MARKER, 1)
    _, after = rest.split(END_MARKER, 1)
    return f"{before}{START_MARKER}\n{index_text}\n{END_MARKER}{after}"


def _resolve_root(version: str | None, root: str | None) -> Path:
    if version and root:
        raise SystemExit("Use either --version or --root, not both.")
    if version:
        return DOCS_ROOT / version
    if root:
        return Path(root)
    return DOCS_ROOT


def _list_versions(base: Path) -> list[str]:
    if not base.exists():
        return []
    versions = [
        p.name
        for p in base.iterdir()
        if p.is_dir() and not p.name.startswith(".")
    ]
    return sorted(versions)


def _display_root(docs_root: Path) -> str:
    root_display = docs_root.as_posix()
    if not root_display.startswith("./") and not root_display.startswith("/"):
        root_display = f"./{root_display}"
    return root_display


def build_and_inject_index(docs_root: Path, display_root: str | None = None) -> None:
    _merge_extra_docs(docs_root)
    entries = _iter_docs(docs_root)
    if not entries:
        raise SystemExit(f"No .md or .mdx docs found under {docs_root}.")

    index_text = _build_index(entries, display_root or _display_root(docs_root))
    agents_text = AGENTS_PATH.read_text(encoding="utf-8")
    updated = _inject_index(agents_text, index_text)
    AGENTS_PATH.write_text(updated, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Build and inject a compressed Laravel docs index into AGENTS.md."
    )
    parser.add_argument("--version", help="Laravel docs version folder under .laravel-docs/")
    parser.add_argument("--root", help="Absolute or relative path to docs root.")
    parser.add_argument(
        "--list-versions",
        action="store_true",
        help="List available versions under .laravel-docs.",
    )
    args = parser.parse_args()

    if args.list_versions:
        versions = _list_versions(DOCS_ROOT)
        if not versions:
            print("No versions found under .laravel-docs.")
            return
        print("Available versions:")
        for version in versions:
            print(f"- {version}")
        return

    docs_root = _resolve_root(args.version, args.root)
    if not docs_root.exists():
        raise SystemExit(f"Docs root not found: {docs_root}")

    build_and_inject_index(docs_root)

    print(f"Updated AGENTS.md with Laravel docs index for {docs_root}.")


if __name__ == "__main__":
    main()
