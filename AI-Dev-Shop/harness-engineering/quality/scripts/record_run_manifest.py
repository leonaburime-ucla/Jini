#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import hashlib
import sys
from pathlib import Path

MANIFEST_FIELDS = [
    "run_id",
    "eval_name",
    "run_scope",
    "execution_mode",
    "agent",
    "model_id",
    "model_label",
    "execution_status",
    "scope_confirmation",
    "scope_confirmation_notes",
    "started_at",
    "completed_at",
    "artifact_path",
    "artifact_sha256",
    "transcript_path",
    "transcript_sha256",
]
COMPLETED_STATUS = "completed"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


def relative_to_suite(suite_dir: Path, artifact_path: Path) -> str:
    try:
        return str(artifact_path.relative_to(suite_dir))
    except ValueError:
        return str(artifact_path)


def load_manifest(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle, delimiter="\t")
        if reader.fieldnames is None:
            raise ValueError(f"{path} has no header row")
        rows = []
        for raw in reader:
            row = {key: (value or "").strip() for key, value in raw.items()}
            if any(row.values()):
                rows.append(row)
        return rows


def write_manifest(path: Path, rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=MANIFEST_FIELDS, delimiter="\t")
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    parser = argparse.ArgumentParser(description="Append or update run-manifest.tsv for an eval suite.")
    parser.add_argument("suite_dir", help="Path to the eval suite root")
    parser.add_argument("--run-id", required=True)
    parser.add_argument("--eval-name", required=True)
    parser.add_argument("--run-scope", required=True, choices=("benchmark_full", "targeted_regression"))
    parser.add_argument("--execution-mode", required=True, choices=("repo_persona_subagent", "repo_persona_host", "external_peer_cli"))
    parser.add_argument("--agent", required=True)
    parser.add_argument("--model-id", required=True)
    parser.add_argument("--model-label", required=True)
    parser.add_argument("--execution-status", required=True, choices=("completed", "simulated", "aborted", "failed"))
    parser.add_argument("--scope-confirmation", required=True, choices=("confirmed", "not_required"))
    parser.add_argument("--scope-confirmation-notes", default="")
    parser.add_argument("--started-at", required=True)
    parser.add_argument("--completed-at", default="")
    parser.add_argument("--artifact-path", default="")
    parser.add_argument("--transcript-path", default="")
    args = parser.parse_args()

    suite_dir = Path(args.suite_dir).resolve()
    manifest_path = suite_dir / "run-manifest.tsv"
    artifact_sha256 = ""
    transcript_sha256 = ""

    artifact_path = Path(args.artifact_path).resolve() if args.artifact_path else None
    transcript_path = Path(args.transcript_path).resolve() if args.transcript_path else None

    if args.execution_status == COMPLETED_STATUS:
        if artifact_path is None or transcript_path is None or not args.completed_at:
            print(
                "Completed runs must provide --artifact-path, --transcript-path, and --completed-at.",
                file=sys.stderr,
            )
            return 1
        if not artifact_path.exists():
            print(f"Artifact path does not exist: {artifact_path}", file=sys.stderr)
            return 1
        if not transcript_path.exists():
            print(f"Transcript path does not exist: {transcript_path}", file=sys.stderr)
            return 1
        artifact_sha256 = sha256_file(artifact_path)
        transcript_sha256 = sha256_file(transcript_path)

    rows = load_manifest(manifest_path)
    record = {
        "run_id": args.run_id,
        "eval_name": args.eval_name,
        "run_scope": args.run_scope,
        "execution_mode": args.execution_mode,
        "agent": args.agent,
        "model_id": args.model_id,
        "model_label": args.model_label,
        "execution_status": args.execution_status,
        "scope_confirmation": args.scope_confirmation,
        "scope_confirmation_notes": args.scope_confirmation_notes,
        "started_at": args.started_at,
        "completed_at": args.completed_at,
        "artifact_path": relative_to_suite(suite_dir, artifact_path) if artifact_path else "",
        "artifact_sha256": artifact_sha256,
        "transcript_path": relative_to_suite(suite_dir, transcript_path) if transcript_path else "",
        "transcript_sha256": transcript_sha256,
    }

    updated = False
    for index, row in enumerate(rows):
        if row.get("run_id") == args.run_id and row.get("eval_name") == args.eval_name:
            rows[index] = record
            updated = True
            break
    if not updated:
        rows.append(record)

    write_manifest(manifest_path, rows)
    print(f"{'Updated' if updated else 'Appended'} manifest row in {manifest_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
