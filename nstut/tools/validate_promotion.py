#!/usr/bin/env python3
"""Validate that a PR into nstut/stable is a real immutable release promotion."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
RELEASE = ROOT / "nstut/release.json"


def fail(message: str) -> None:
    raise SystemExit(f"promotion rejected: {message}")


def git(*args: str) -> str:
    return subprocess.check_output(["git", "-C", str(ROOT), *args], text=True).strip()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-branch", required=True)
    parser.add_argument("--head-sha", required=True)
    args = parser.parse_args()

    release = json.loads(RELEASE.read_text(encoding="utf-8-sig"))
    base_ref = release.get("baseRef", "")
    declared_branch = release.get("branch", "")
    source_ref = release.get("sourceRef", "")

    expected_branch = f"nstut/{base_ref}"
    if args.source_branch != expected_branch:
        fail(
            f"stable accepts promotions only from {expected_branch}; "
            f"PR source is {args.source_branch}"
        )
    if declared_branch != expected_branch:
        fail(f"release.json declares {declared_branch!r}, expected {expected_branch!r}")
    if args.source_branch == "nstut/stable" or not re.fullmatch(r"nstut/[^/]+", args.source_branch):
        fail(f"invalid release-construction branch {args.source_branch!r}")
    if not re.fullmatch(r"nstut-[A-Za-z0-9._-]+", source_ref):
        fail(f"invalid immutable sourceRef {source_ref!r}")

    tag_ref = f"refs/tags/{source_ref}"
    try:
        tag_commit = git("rev-parse", f"{tag_ref}^{{commit}}")
        head_commit = git("rev-parse", f"{args.head_sha}^{{commit}}")
    except subprocess.CalledProcessError:
        fail(f"immutable tag {source_ref} is missing")

    if tag_commit != head_commit:
        fail(
            f"immutable tag {source_ref} points to {tag_commit[:12]}, "
            f"but PR head is {head_commit[:12]}; tag the exact release head before promotion"
        )

    try:
        stable = git("rev-parse", "origin/nstut/stable^{commit}")
        subprocess.run(
            ["git", "-C", str(ROOT), "merge-base", "--is-ancestor", stable, head_commit],
            check=True,
        )
    except subprocess.CalledProcessError:
        fail("release branch does not descend from the current nstut/stable pointer")

    print(
        f"promotion gate passed: {args.source_branch} @ {head_commit[:12]} "
        f"via immutable tag {source_ref}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
