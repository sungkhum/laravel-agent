#!/usr/bin/env python3
"""Laravel equivalent of `npx @next/codemod@canary agents-md`.

Actions:
- Detects Laravel version from composer.json (unless --version is provided)
- Downloads matching Laravel docs to ./.laravel-docs
- Injects a compressed docs index into AGENTS.md
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
import tempfile
import urllib.request
import zipfile
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DOCS_BASE = PROJECT_ROOT / ".laravel-docs"
COMPOSER_PATH = PROJECT_ROOT / "composer.json"


def _read_composer() -> dict:
    if not COMPOSER_PATH.exists():
        return {}
    try:
        return json.loads(COMPOSER_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise SystemExit(f"Invalid composer.json: {exc}")


def _extract_major_version(constraint: str) -> str | None:
    if not constraint:
        return None

    # Common forms: ^8.75, ~8.1, 8.*, 8.x, v8, >=8.0 <9.0, dev-8.x
    cleaned = constraint.strip().lower()
    cleaned = cleaned.replace("dev-", "")
    cleaned = cleaned.lstrip("v")

    if cleaned.endswith(".x"):
        major = cleaned.split(".", 1)[0]
        return f"{major}.x" if major.isdigit() else None

    if cleaned.endswith(".*"):
        major = cleaned.split(".", 1)[0]
        return f"{major}.x" if major.isdigit() else None

    match = re.search(r"(\d+)", cleaned)
    if not match:
        return None
    major = match.group(1)
    return f"{major}.x"


def _detect_version_from_composer() -> str | None:
    data = _read_composer()
    require = data.get("require", {})
    constraint = require.get("laravel/framework") or require.get("laravel/laravel")
    if not constraint:
        return None
    return _extract_major_version(str(constraint))


def _normalize_version(value: str) -> str:
    normalized = _extract_major_version(value)
    if not normalized:
        raise SystemExit(f"Unable to parse version: {value}")
    return normalized


def _ensure_docs_dir(version: str, force: bool) -> Path:
    docs_root = DOCS_BASE
    if docs_root.exists():
        if not force and any(docs_root.iterdir()):
            raise SystemExit(
                f"Docs already exist at {docs_root}. Use --force to overwrite."
            )
        if force:
            shutil.rmtree(docs_root)
    docs_root.mkdir(parents=True, exist_ok=True)
    return docs_root


def _download_docs(version: str, dest: Path) -> None:
    url = f"https://github.com/laravel/docs/archive/refs/heads/{version}.zip"
    with tempfile.TemporaryDirectory() as tmpdir:
        tmpdir_path = Path(tmpdir)
        zip_path = tmpdir_path / "docs.zip"

        try:
            with urllib.request.urlopen(url) as response, open(zip_path, "wb") as handle:
                shutil.copyfileobj(response, handle)
        except Exception as exc:  # noqa: BLE001
            raise SystemExit(f"Failed to download docs from {url}: {exc}")

        try:
            with zipfile.ZipFile(zip_path, "r") as zip_file:
                zip_file.extractall(tmpdir_path)
        except zipfile.BadZipFile as exc:
            raise SystemExit(f"Downloaded zip is invalid: {exc}")

        extracted_root = tmpdir_path / f"docs-{version}"
        if not extracted_root.exists():
            candidates = [p for p in tmpdir_path.iterdir() if p.is_dir()]
            raise SystemExit(
                "Unexpected zip structure. "
                f"Expected {extracted_root}, found: {', '.join(str(p) for p in candidates)}"
            )

        shutil.copytree(extracted_root, dest, dirs_exist_ok=True)


def _build_index(docs_root: Path, display_root: str) -> None:
    scripts_dir = Path(__file__).resolve().parent
    sys.path.insert(0, str(scripts_dir))
    try:
        import build_laravel_docs_index as indexer  # type: ignore
    finally:
        sys.path.pop(0)
    indexer.build_and_inject_index(docs_root, display_root=display_root)


def _agents_md(version: str, force: bool) -> None:
    docs_root = _ensure_docs_dir(version, force)
    _download_docs(version, docs_root)
    display_root = f"./{docs_root.relative_to(PROJECT_ROOT).as_posix()}"
    _build_index(docs_root, display_root)
    print(f"Docs installed to {docs_root}")
    print("AGENTS.md updated with Laravel docs index.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Laravel agents-md setup.")
    subparsers = parser.add_subparsers(dest="command", required=True)

    agents_md = subparsers.add_parser("agents-md", help="Download docs and update AGENTS.md")
    agents_md.add_argument("--version", help="Laravel docs version (e.g. 8.x, 10.x)")
    agents_md.add_argument(
        "--force",
        action="store_true",
        help="Overwrite existing docs folder.",
    )

    args = parser.parse_args()

    if args.command == "agents-md":
        version = _normalize_version(args.version) if args.version else _detect_version_from_composer()
        if not version:
            raise SystemExit(
                "Unable to detect Laravel version from composer.json. "
                "Provide --version <major>.x explicitly."
            )
        _agents_md(version, args.force)


if __name__ == "__main__":
    main()
