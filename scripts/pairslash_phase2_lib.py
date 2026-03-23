#!/usr/bin/env python3
"""PairSlash Phase 2 validation helpers."""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import yaml


MUTABLE_KINDS = {
    "decision",
    "command",
    "glossary",
    "constraint",
    "ownership",
    "incident-lesson",
    "pattern",
}

SYSTEM_KINDS = {"charter", "stack-profile"}
SYSTEM_RECORD_REQUIRED_FIELDS = {
    "charter": (
        "phase",
        "identity",
        "runtimes",
        "canonical_entrypoint",
        "core_principles",
        "phase_2_goal",
        "provenance",
    ),
    "stack-profile": (
        "runtimes",
        "project_language",
        "memory_format",
        "build_tooling",
        "provenance",
    ),
}
SCOPES = {"whole-project", "subsystem", "path-prefix"}
ACTIONS = {"append", "supersede", "reject-candidate-if-conflict"}
CONFIDENCE = {"low", "medium", "high"}
PACK_SURFACE_STATUSES = {"supported", "experimental", "unverified", "blocked"}
PACK_REGISTRY_STATUSES = {"active", "deprecated", "draft"}
PACK_MEMORY_AUTHORITIES = {"read-only", "write-authority"}
PACK_MEMORY_PERMISSIONS = {"none", "read", "write"}
PACK_SESSION_PERMISSIONS = {"none", "read", "implicit-read"}
PACK_AUDIT_PERMISSIONS = {"none", "write"}
SUPPORTED_PACK_RUNTIMES = {"codex_cli", "copilot_cli"}


@dataclass
class ValidationError:
    path: str
    message: str


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def yaml_load_all(path: Path) -> List[Dict[str, Any]]:
    raw = path.read_text(encoding="utf-8")
    docs = list(yaml.safe_load_all(raw))
    out: List[Dict[str, Any]] = []
    for doc in docs:
        if doc is None:
            continue
        if not isinstance(doc, dict):
            raise ValueError(f"{path}: YAML document must be mapping/object")
        out.append(doc)
    return out


def yaml_dump(data: Any) -> str:
    return yaml.safe_dump(data, sort_keys=False, allow_unicode=False).strip() + "\n"


def slugify_title(title: str, max_len: int = 60) -> str:
    slug = title.lower()
    slug = re.sub(r"[^a-z0-9\s-]", "", slug)
    slug = re.sub(r"\s+", "-", slug).strip("-")
    slug = re.sub(r"-{2,}", "-", slug)
    return slug[:max_len].rstrip("-") or "record"


def route_target_file(kind: str, title: str) -> str:
    slug = slugify_title(title)
    if kind == "decision":
        return f".pairslash/project-memory/60-architecture-decisions/{slug}.yaml"
    if kind == "pattern":
        return f".pairslash/project-memory/70-known-good-patterns/{slug}.yaml"
    if kind == "incident-lesson":
        return f".pairslash/project-memory/80-incidents-and-lessons/{slug}.yaml"
    if kind == "command":
        return ".pairslash/project-memory/20-commands.yaml"
    if kind == "glossary":
        return ".pairslash/project-memory/30-glossary.yaml"
    if kind == "ownership":
        return ".pairslash/project-memory/40-ownership.yaml"
    if kind == "constraint":
        return ".pairslash/project-memory/50-constraints.yaml"
    raise ValueError(f"Unsupported kind for routing: {kind}")


def validate_scope(scope: str, scope_detail: Optional[str]) -> Tuple[bool, Optional[str]]:
    if scope not in SCOPES:
        return False, f"invalid scope '{scope}'"
    if scope in {"subsystem", "path-prefix"} and not scope_detail:
        return False, "scope_detail is required for subsystem/path-prefix scope"
    return True, None


def detect_duplicate(existing: Iterable[Dict[str, Any]], kind: str, title: str) -> bool:
    for record in existing:
        if record.get("kind") == kind and record.get("title") == title:
            return True
    return False


def detect_missing_supersedes(existing: Iterable[Dict[str, Any]], supersedes: str) -> bool:
    try:
        kind, title = supersedes.split("/", 1)
    except ValueError:
        return True
    for record in existing:
        if record.get("kind") == kind and record.get("title") == title:
            return False
    return True


def detect_scope_shadow(
    existing: Iterable[Dict[str, Any]],
    kind: str,
    scope: str,
    scope_detail: Optional[str],
) -> bool:
    if scope == "whole-project":
        return False
    for record in existing:
        if record.get("kind") != kind:
            continue
        if record.get("scope") == "whole-project":
            return True
        if scope == "path-prefix" and record.get("scope") == "path-prefix":
            detail = str(record.get("scope_detail", ""))
            if scope_detail and (detail.startswith(scope_detail) or scope_detail.startswith(detail)):
                return True
    return False


def generate_preview_patch(record: Dict[str, Any], target_file: str) -> str:
    content = yaml_dump(record).rstrip()
    return (
        "--- preview patch ---\n"
        f"target_file: {target_file}\n"
        f"action: {record.get('action')}\n"
        "content:\n"
        + _indent(content, "  ")
        + "\n--- end preview ---\n"
    )


def build_index_entry(record: Dict[str, Any], target_file: str, status: str = "active") -> Dict[str, Any]:
    relative = target_file.replace(".pairslash/project-memory/", "")
    entry: Dict[str, Any] = {
        "file": relative,
        "kind": record["kind"],
        "title": record["title"],
        "scope": record["scope"],
        "status": status,
        "record_family": "mutable",
    }
    if record.get("scope_detail"):
        entry["scope_detail"] = record["scope_detail"]
    return entry


def build_audit_entry(
    record: Dict[str, Any],
    target_file: str,
    result: str,
    notes: str = "",
    timestamp: Optional[str] = None,
) -> Dict[str, Any]:
    return {
        "timestamp": timestamp or record.get("timestamp") or now_iso(),
        "action": record["action"],
        "kind": record["kind"],
        "title": record["title"],
        "target_file": target_file,
        "updated_by": record["updated_by"],
        "confidence": record["confidence"],
        "result": result,
        "notes": notes,
    }


def validate_mutable_record(record: Dict[str, Any]) -> List[str]:
    errors: List[str] = []
    required = [
        "kind",
        "title",
        "statement",
        "evidence",
        "scope",
        "confidence",
        "action",
        "tags",
        "source_refs",
        "updated_by",
        "timestamp",
    ]
    for field in required:
        if field not in record:
            errors.append(f"missing field: {field}")
    kind = record.get("kind")
    if kind not in MUTABLE_KINDS:
        errors.append(f"invalid mutable kind: {kind}")
    scope = record.get("scope")
    valid_scope, msg = validate_scope(str(scope), record.get("scope_detail"))
    if not valid_scope:
        errors.append(msg or "invalid scope")
    confidence = record.get("confidence")
    if confidence not in CONFIDENCE:
        errors.append(f"invalid confidence: {confidence}")
    action = record.get("action")
    if action not in ACTIONS:
        errors.append(f"invalid action: {action}")
    if action == "supersede" and not record.get("supersedes"):
        errors.append("missing field: supersedes (required for supersede action)")
    if not isinstance(record.get("tags", []), list):
        errors.append("tags must be a list")
    if not isinstance(record.get("source_refs", []), list):
        errors.append("source_refs must be a list")
    return errors


def validate_system_record(record: Dict[str, Any]) -> List[str]:
    errors: List[str] = []
    for field in ("kind", "title", "version"):
        if field not in record:
            errors.append(f"missing field: {field}")
    kind = record.get("kind")
    if kind not in SYSTEM_KINDS:
        errors.append(f"invalid system kind: {kind}")
        return errors

    for field in SYSTEM_RECORD_REQUIRED_FIELDS.get(kind, ()):
        if field not in record:
            errors.append(f"missing field: {field}")

    for field in ("runtimes", "provenance"):
        if field in record and not isinstance(record[field], dict):
            errors.append(f"{field} must be an object")

    if kind == "charter":
        if "identity" in record and not isinstance(record["identity"], dict):
            errors.append("identity must be an object")
        if "core_principles" in record and not isinstance(record["core_principles"], list):
            errors.append("core_principles must be a list")
        if "phase" in record and not isinstance(record["phase"], int):
            errors.append("phase must be an integer")
    elif kind == "stack-profile":
        if "build_tooling" in record and not isinstance(record["build_tooling"], list):
            errors.append("build_tooling must be a list")
    return errors


def validate_pack_metadata(record: Dict[str, Any]) -> List[str]:
    errors: List[str] = []
    required = [
        "kind",
        "id",
        "version",
        "phase",
        "status",
        "category",
        "workflow_class",
        "codex",
        "memory_access",
        "required_inputs",
        "output_contract",
        "failure_contract",
        "runtime_targets",
        "compatibility_notes",
        "source_of_truth",
    ]
    for field in required:
        if field not in record:
            errors.append(f"missing field: {field}")

    if record.get("kind") != "pack-metadata":
        errors.append(f"invalid pack metadata kind: {record.get('kind')}")
    if not isinstance(record.get("id"), str) or not record.get("id"):
        errors.append("id must be a non-empty string")
    if not isinstance(record.get("version"), str) or not record.get("version"):
        errors.append("version must be a non-empty string")
    if not isinstance(record.get("phase"), int):
        errors.append("phase must be an integer")
    if record.get("status") not in PACK_REGISTRY_STATUSES:
        errors.append(f"invalid status: {record.get('status')}")
    if not isinstance(record.get("category"), str) or not record.get("category"):
        errors.append("category must be a non-empty string")
    if not isinstance(record.get("workflow_class"), str) or not record.get("workflow_class"):
        errors.append("workflow_class must be a non-empty string")

    codex = record.get("codex")
    if not isinstance(codex, dict):
        errors.append("codex must be an object")
    else:
        for field in ("plan_on_model", "plan_off_model"):
            value = codex.get(field)
            if not isinstance(value, str) or not value.strip():
                errors.append(f"codex missing model pin: {field}")

    memory = record.get("memory_access")
    if not isinstance(memory, dict):
        errors.append("memory_access must be an object")
    else:
        authority = memory.get("authority")
        if authority not in PACK_MEMORY_AUTHORITIES:
            errors.append(f"invalid memory authority: {authority}")
        gpm = memory.get("global_project_memory")
        if gpm not in PACK_MEMORY_PERMISSIONS:
            errors.append(f"invalid global_project_memory permission: {gpm}")
        task_memory = memory.get("task_memory")
        if task_memory not in PACK_MEMORY_PERMISSIONS:
            errors.append(f"invalid task_memory permission: {task_memory}")
        session_context = memory.get("session_context")
        if session_context not in PACK_SESSION_PERMISSIONS:
            errors.append(f"invalid session_context permission: {session_context}")
        audit_log = memory.get("audit_log")
        if audit_log not in PACK_AUDIT_PERMISSIONS:
            errors.append(f"invalid audit_log permission: {audit_log}")
        invariant = memory.get("invariant")
        if not isinstance(invariant, str) or not invariant.strip():
            errors.append("memory_access missing field: invariant")

        if authority == "read-only" and gpm == "write":
            errors.append("read-only packs must not declare global_project_memory=write")
        if authority == "write-authority" and gpm != "write":
            errors.append("write-authority packs must declare global_project_memory=write")
        if gpm == "write" and record.get("workflow_class") != "write-authority":
            errors.append(
                "packs may only write Global Project Memory when workflow_class=write-authority"
            )
        if gpm == "write" and audit_log != "write":
            errors.append("packs writing Global Project Memory must also write the audit log")

    inputs = record.get("required_inputs")
    if not isinstance(inputs, list) or not inputs:
        errors.append("required_inputs must be a non-empty list")
    else:
        seen_inputs = set()
        for item in inputs:
            if not isinstance(item, dict):
                errors.append("required_inputs entries must be objects")
                continue
            name = item.get("name")
            if not isinstance(name, str) or not name.strip():
                errors.append("required_inputs entries must declare a non-empty name")
            elif name in seen_inputs:
                errors.append(f"duplicate required_inputs entry: {name}")
            else:
                seen_inputs.add(name)
            if not isinstance(item.get("required"), bool):
                errors.append(f"required_inputs.{name or '<unknown>'}.required must be boolean")
            description = item.get("description")
            if not isinstance(description, str) or not description.strip():
                errors.append(
                    f"required_inputs.{name or '<unknown>'}.description must be a non-empty string"
                )

    output_contract = record.get("output_contract")
    if not isinstance(output_contract, dict):
        errors.append("output_contract must be an object")
    else:
        for mode_name in ("plan_mode", "default_mode"):
            mode = output_contract.get(mode_name)
            if not isinstance(mode, dict):
                errors.append(f"output_contract missing mode: {mode_name}")
                continue
            fmt = mode.get("format")
            if not isinstance(fmt, str) or not fmt.strip():
                errors.append(f"output_contract.{mode_name}.format must be a non-empty string")
            sections = mode.get("sections")
            if not isinstance(sections, list) or not sections:
                errors.append(f"output_contract.{mode_name}.sections must be a non-empty list")
            elif not all(isinstance(section, str) and section.strip() for section in sections):
                errors.append(f"output_contract.{mode_name}.sections must contain non-empty strings")

    failure_contract = record.get("failure_contract")
    if not isinstance(failure_contract, dict):
        errors.append("failure_contract must be an object")
    else:
        for mode_name in ("plan_mode", "default_mode"):
            mode = failure_contract.get(mode_name)
            if not isinstance(mode, dict):
                errors.append(f"failure_contract missing mode: {mode_name}")
                continue
            blockers = mode.get("blockers")
            if not isinstance(blockers, list) or not blockers:
                errors.append(f"failure_contract.{mode_name}.blockers must be a non-empty list")
            elif not all(isinstance(blocker, str) and blocker.strip() for blocker in blockers):
                errors.append(
                    f"failure_contract.{mode_name}.blockers must contain non-empty strings"
                )

    runtime_targets = record.get("runtime_targets")
    if not isinstance(runtime_targets, list) or not runtime_targets:
        errors.append("runtime_targets must be a non-empty list")
    else:
        seen_runtimes = set()
        for target in runtime_targets:
            if not isinstance(target, dict):
                errors.append("runtime_targets entries must be objects")
                continue
            runtime = target.get("runtime")
            if runtime not in SUPPORTED_PACK_RUNTIMES:
                errors.append(f"unsupported runtime target: {runtime}")
            elif runtime in seen_runtimes:
                errors.append(f"duplicate runtime target: {runtime}")
            else:
                seen_runtimes.add(runtime)
            if target.get("canonical_entrypoint") != "/skills":
                errors.append(
                    f"runtime target {runtime or '<unknown>'} must use canonical_entrypoint=/skills"
                )
            direct_invocation = target.get("direct_invocation")
            if not isinstance(direct_invocation, str) or not direct_invocation.strip():
                errors.append(
                    f"runtime target {runtime or '<unknown>'} must declare direct_invocation"
                )
            surfaces = target.get("surfaces")
            if not isinstance(surfaces, list) or not surfaces:
                errors.append(f"runtime target {runtime or '<unknown>'} must declare surfaces")
                continue
            seen_surface_ids = set()
            for surface in surfaces:
                if not isinstance(surface, dict):
                    errors.append(
                        f"runtime target {runtime or '<unknown>'} surfaces must be objects"
                    )
                    continue
                surface_id = surface.get("id")
                if not isinstance(surface_id, str) or not surface_id.strip():
                    errors.append(
                        f"runtime target {runtime or '<unknown>'} surface missing id"
                    )
                elif surface_id in seen_surface_ids:
                    errors.append(
                        f"duplicate runtime surface: {runtime or '<unknown>'}/{surface_id}"
                    )
                else:
                    seen_surface_ids.add(surface_id)
                invocation = surface.get("invocation")
                if not isinstance(invocation, str) or not invocation.strip():
                    errors.append(
                        f"runtime target {runtime or '<unknown>'} surface {surface_id or '<unknown>'} "
                        "missing invocation"
                    )
                status = surface.get("status")
                if status not in PACK_SURFACE_STATUSES:
                    errors.append(
                        f"invalid runtime surface status: {runtime or '<unknown>'}/{surface_id or '<unknown>'}"
                    )
                evidence_refs = surface.get("evidence_refs")
                if not isinstance(evidence_refs, list) or not evidence_refs:
                    errors.append(
                        f"runtime target {runtime or '<unknown>'} surface {surface_id or '<unknown>'} "
                        "must declare evidence_refs"
                    )
                elif not all(isinstance(ref, str) and ref.strip() for ref in evidence_refs):
                    errors.append(
                        f"runtime target {runtime or '<unknown>'} surface {surface_id or '<unknown>'} "
                        "evidence_refs must contain non-empty strings"
                    )

    notes = record.get("compatibility_notes")
    if not isinstance(notes, list) or not notes:
        errors.append("compatibility_notes must be a non-empty list")
    elif not all(isinstance(note, str) and note.strip() for note in notes):
        errors.append("compatibility_notes must contain non-empty strings")

    source = record.get("source_of_truth")
    if not isinstance(source, dict):
        errors.append("source_of_truth must be an object")
    else:
        for field in ("pack_dir", "skill", "contract", "spec", "validation_checklist"):
            if not source.get(field):
                errors.append(f"source_of_truth missing field: {field}")
    return errors


def validate_pack_registry(record: Dict[str, Any]) -> List[str]:
    errors: List[str] = []
    required = ["version", "model", "last_updated", "packs"]
    for field in required:
        if field not in record:
            errors.append(f"missing field: {field}")
    packs = record.get("packs")
    if not isinstance(packs, list) or not packs:
        errors.append("packs must be a non-empty list")
        return errors

    seen_names = set()
    for entry in packs:
        if not isinstance(entry, dict):
            errors.append("registry entries must be objects")
            continue
        for field in (
            "id",
            "version",
            "phase",
            "status",
            "category",
            "metadata_file",
            "skill_file",
            "contract_file",
            "spec_file",
            "compatibility_matrix",
            "validation_checklist",
        ):
            if field not in entry:
                errors.append(f"registry entry missing field: {field}")
        if not isinstance(entry.get("id"), str) or not entry.get("id"):
            errors.append("registry entry id must be a non-empty string")
        if not isinstance(entry.get("version"), str) or not entry.get("version"):
            errors.append(f"registry entry {entry.get('id') or '<unknown>'} missing version")
        if not isinstance(entry.get("phase"), int):
            errors.append(f"registry entry {entry.get('id') or '<unknown>'} phase must be integer")
        if entry.get("status") not in PACK_REGISTRY_STATUSES:
            errors.append(f"invalid registry status for {entry.get('id')}: {entry.get('status')}")
        if not isinstance(entry.get("category"), str) or not entry.get("category"):
            errors.append(f"registry entry {entry.get('id') or '<unknown>'} missing category")
        if entry.get("id") in seen_names:
            errors.append(f"duplicate registry entry: {entry.get('id')}")
        seen_names.add(entry.get("id"))
    return errors


def detect_orphan_supersedes(records: Iterable[Dict[str, Any]]) -> List[str]:
    keyset = {(r.get("kind"), r.get("title")) for r in records}
    orphans: List[str] = []
    for r in records:
        supersedes = r.get("supersedes")
        if not supersedes:
            continue
        try:
            kind, title = supersedes.split("/", 1)
        except ValueError:
            orphans.append(f"{r.get('kind')}/{r.get('title')}: malformed supersedes")
            continue
        if (kind, title) not in keyset:
            orphans.append(f"{r.get('kind')}/{r.get('title')} -> missing {supersedes}")
    return orphans


def detect_stale_records(records: Iterable[Dict[str, Any]]) -> List[str]:
    stale: List[str] = []
    for r in records:
        if r.get("action") == "append" and r.get("supersedes"):
            stale.append(f"{r.get('kind')}/{r.get('title')}: append record should not carry supersedes")
    return stale


def classify_weak_evidence(evidence: str, source_refs: Optional[List[str]] = None) -> bool:
    source_refs = source_refs or []
    text = (evidence or "").strip().lower()
    if len(text) < 20:
        return True
    generic_markers = {"best practice", "i think", "seems", "maybe", "general"}
    if any(m in text for m in generic_markers):
        return True
    if len(source_refs) == 0:
        return True
    return False


def _indent(text: str, prefix: str) -> str:
    return "\n".join(prefix + line for line in text.splitlines())
