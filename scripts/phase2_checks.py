#!/usr/bin/env python3
"""PairSlash Phase 2 doctor/lint/schema/fixture/golden checks."""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path
from typing import Any, Dict, Iterable, List, Tuple

import yaml

if __package__:
    from .pairslash_phase2_lib import (
        MUTABLE_KINDS,
        SYSTEM_KINDS,
        build_audit_entry,
        build_index_entry,
        classify_weak_evidence,
        detect_duplicate,
        detect_missing_supersedes,
        detect_orphan_supersedes,
        detect_scope_shadow,
        detect_stale_records,
        generate_preview_patch,
        route_target_file,
        validate_pack_metadata,
        validate_pack_registry,
        validate_mutable_record,
        validate_scope,
        validate_system_record,
        yaml_load_all,
    )
else:  # pragma: no cover - script execution path
    from pairslash_phase2_lib import (
        MUTABLE_KINDS,
        SYSTEM_KINDS,
        build_audit_entry,
        build_index_entry,
        classify_weak_evidence,
        detect_duplicate,
        detect_missing_supersedes,
        detect_orphan_supersedes,
        detect_scope_shadow,
        detect_stale_records,
        generate_preview_patch,
        route_target_file,
        validate_pack_metadata,
        validate_pack_registry,
        validate_mutable_record,
        validate_scope,
        validate_system_record,
        yaml_load_all,
    )


ROOT = Path(__file__).resolve().parents[1]
PROJECT_MEMORY = ROOT / ".pairslash" / "project-memory"
SCHEMAS = ROOT / "packages" / "spec-core" / "schemas"
SPECS = ROOT / "packages" / "spec-core" / "specs"
REGISTRY = ROOT / "packages" / "spec-core" / "registry"
PACKS = ROOT / "packs" / "core"
RUNTIME_MATRIX = ROOT / "docs" / "compatibility" / "runtime-surface-matrix.yaml"

CORE_WORKFLOWS = [
    "pairslash-plan",
    "pairslash-review",
    "pairslash-onboard-repo",
    "pairslash-command-suggest",
    "pairslash-memory-candidate",
    "pairslash-memory-write-global",
    "pairslash-memory-audit",
]

READ_WORKFLOWS = [
    "pairslash-plan",
    "pairslash-review",
    "pairslash-onboard-repo",
    "pairslash-command-suggest",
    "pairslash-memory-candidate",
    "pairslash-memory-audit",
]

MEMORY_RELATED = [
    "pairslash-memory-candidate",
    "pairslash-memory-write-global",
    "pairslash-memory-audit",
]

REQUIRED_MEMORY_FILES = [
    "00-project-charter.yaml",
    "10-stack-profile.yaml",
    "20-commands.yaml",
    "30-glossary.yaml",
    "40-ownership.yaml",
    "50-constraints.yaml",
    "60-architecture-decisions",
    "70-known-good-patterns",
    "80-incidents-and-lessons",
    "90-memory-index.yaml",
]


class CheckFailure(Exception):
    pass


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def run_doctor() -> List[str]:
    errors: List[str] = []
    required_dirs = [
        ROOT / ".pairslash" / "project-memory",
        ROOT / ".pairslash" / "task-memory",
        ROOT / ".pairslash" / "sessions",
        ROOT / ".pairslash" / "audit-log",
        ROOT / ".pairslash" / "staging",
    ]
    for d in required_dirs:
        if not d.exists() or not d.is_dir():
            errors.append(f"missing required directory: {d.relative_to(ROOT)}")
    for rel in REQUIRED_MEMORY_FILES:
        p = PROJECT_MEMORY / rel
        if not p.exists():
            errors.append(f"missing canonical memory path: .pairslash/project-memory/{rel}")
    for wf in CORE_WORKFLOWS:
        wf_dir = PACKS / wf
        if not wf_dir.exists():
            errors.append(f"missing workflow pack: packs/core/{wf}")
    for entry in _load_registry_entries(errors):
        pack_id = entry.get("id")
        if not pack_id:
            continue
        wf_dir = PACKS / str(pack_id)
        if not wf_dir.exists():
            errors.append(f"missing registry-backed pack: {wf_dir.relative_to(ROOT)}")
    return errors


def parse_frontmatter_name(skill_path: Path) -> str:
    text = read_text(skill_path)
    if not text.startswith("---"):
        return ""
    parts = text.split("---", 2)
    if len(parts) < 3:
        return ""
    fm = parts[1]
    m = re.search(r"^name:\s*([a-z0-9-]+)\s*$", fm, flags=re.MULTILINE)
    return m.group(1).strip() if m else ""


def parse_contract_header(path: Path) -> Dict[str, str]:
    text = read_text(path)
    fields = {
        "version": r"\*\*Version:\*\*\s*([^\r\n]+)",
        "phase": r"\*\*Phase:\*\*\s*([^\r\n]+)",
        "class": r"\*\*Class:\*\*\s*([^\r\n]+)",
        "status": r"\*\*Status:\*\*\s*([^\r\n]+)",
    }
    parsed: Dict[str, str] = {}
    for key, pattern in fields.items():
        match = re.search(pattern, text)
        parsed[key] = match.group(1).strip() if match else ""
    return parsed


def load_single_yaml(path: Path) -> Dict[str, Any]:
    docs = yaml_load_all(path)
    if len(docs) != 1:
        raise ValueError(f"{path.relative_to(ROOT)} must contain exactly one YAML document")
    return docs[0]


def _path_from_ref(ref: str) -> Path:
    raw = ref.split("#", 1)[0].strip()
    return ROOT / Path(raw)


def _load_registry_entries(errors: List[str]) -> List[Dict[str, Any]]:
    registry_path = REGISTRY / "packs.yaml"
    if not registry_path.exists():
        errors.append(f"missing pack registry: {registry_path.relative_to(ROOT)}")
        return []
    try:
        registry = load_single_yaml(registry_path)
    except Exception as exc:
        errors.append(f"failed to parse pack registry: {registry_path.relative_to(ROOT)} :: {exc}")
        return []
    for err in validate_pack_registry(registry):
        errors.append(f"{registry_path.relative_to(ROOT)} :: {err}")
    packs = registry.get("packs", [])
    return [entry for entry in packs if isinstance(entry, dict)]


def _extract_spec_input_names(spec: Dict[str, Any]) -> List[str]:
    names: List[str] = []
    input_contract = spec.get("contracts", {}).get("input", {})
    for field_set in ("required", "optional"):
        items = input_contract.get(field_set, [])
        if not isinstance(items, list):
            continue
        for item in items:
            if isinstance(item, dict) and item.get("name"):
                names.append(str(item.get("name")))
    return names


def _extract_spec_output_sections(spec: Dict[str, Any], mode_name: str) -> List[str]:
    output = spec.get("contracts", {}).get("output", {})
    if not isinstance(output, dict):
        return []
    modes = output.get("modes")
    if isinstance(modes, dict):
        mode = modes.get(mode_name, {})
        sections = mode.get("sections", []) if isinstance(mode, dict) else []
    else:
        sections = output.get("sections", [])
    names: List[str] = []
    if not isinstance(sections, list):
        return names
    for item in sections:
        if isinstance(item, dict) and item.get("name"):
            names.append(str(item.get("name")))
        elif isinstance(item, str) and item.strip():
            names.append(item)
    return names


def validate_formalized_pack(entry: Dict[str, Any], errors: List[str]) -> None:
    pack_id = str(entry.get("id", ""))
    metadata_path = PACKS / pack_id / "pack.yaml"
    if not metadata_path.exists():
        errors.append(f"missing formalized pack metadata: {metadata_path.relative_to(ROOT)}")
        return

    matrix_path = RUNTIME_MATRIX
    if not matrix_path.exists():
        errors.append(f"missing runtime matrix: {matrix_path.relative_to(ROOT)}")
        return

    metadata = load_single_yaml(metadata_path)
    for err in validate_pack_metadata(metadata):
        errors.append(f"{metadata_path.relative_to(ROOT)} :: {err}")

    matrix = load_single_yaml(matrix_path)
    registry_path = REGISTRY / "packs.yaml"

    expected_paths = {
        "metadata_file": metadata_path.relative_to(ROOT).as_posix(),
        "skill_file": (PACKS / pack_id / "SKILL.md").relative_to(ROOT).as_posix(),
        "contract_file": (PACKS / pack_id / "contract.md").relative_to(ROOT).as_posix(),
        "spec_file": (SPECS / f"{pack_id}.spec.yaml").relative_to(ROOT).as_posix(),
        "compatibility_matrix": matrix_path.relative_to(ROOT).as_posix(),
        "validation_checklist": (PACKS / pack_id / "validation-checklist.md").relative_to(ROOT).as_posix(),
    }
    if metadata.get("id") != pack_id:
        errors.append(
            f"{metadata_path.relative_to(ROOT)} :: pack id mismatch with registry entry"
        )
    if metadata.get("version") != entry.get("version"):
        errors.append(
            f"{registry_path.relative_to(ROOT)} :: {pack_id} version mismatch with pack metadata"
        )
    if metadata.get("phase") != entry.get("phase"):
        errors.append(
            f"{registry_path.relative_to(ROOT)} :: {pack_id} phase mismatch with pack metadata"
        )
    if metadata.get("status") != entry.get("status"):
        errors.append(
            f"{registry_path.relative_to(ROOT)} :: {pack_id} status mismatch with pack metadata"
        )
    if metadata.get("category") != entry.get("category"):
        errors.append(
            f"{registry_path.relative_to(ROOT)} :: {pack_id} category mismatch with pack metadata"
        )
    for key, expected in expected_paths.items():
        if entry.get(key) != expected:
            errors.append(
                f"{registry_path.relative_to(ROOT)} :: {pack_id} {key} mismatch "
                f"(expected {expected}, got {entry.get(key)})"
            )
        elif not (ROOT / Path(expected)).exists():
            errors.append(f"{registry_path.relative_to(ROOT)} :: referenced path missing: {expected}")

    source = metadata.get("source_of_truth", {})
    expected_source = {
        "pack_dir": (PACKS / pack_id).relative_to(ROOT).as_posix(),
        "skill": expected_paths["skill_file"],
        "contract": expected_paths["contract_file"],
        "spec": expected_paths["spec_file"],
        "validation_checklist": expected_paths["validation_checklist"],
    }
    if isinstance(source, dict):
        for key, expected in expected_source.items():
            if source.get(key) != expected:
                errors.append(
                    f"{metadata_path.relative_to(ROOT)} :: source_of_truth.{key} mismatch "
                    f"(expected {expected}, got {source.get(key)})"
                )

    spec_path = SPECS / f"{pack_id}.spec.yaml"
    if not spec_path.exists():
        errors.append(f"missing workflow spec: {spec_path.relative_to(ROOT)}")
        return
    spec = load_single_yaml(spec_path)
    workflow = spec.get("workflow", {})
    if workflow.get("name") != metadata.get("id"):
        errors.append(
            f"{spec_path.relative_to(ROOT)} :: workflow name mismatch with pack metadata"
        )
    if workflow.get("version") != metadata.get("version"):
        errors.append(
            f"{spec_path.relative_to(ROOT)} :: workflow version mismatch with pack metadata"
        )
    if workflow.get("phase") != metadata.get("phase"):
        errors.append(
            f"{spec_path.relative_to(ROOT)} :: workflow phase mismatch with pack metadata"
        )
    if workflow.get("class") != metadata.get("workflow_class"):
        errors.append(
            f"{spec_path.relative_to(ROOT)} :: workflow class mismatch with pack metadata"
        )

    contract_path = PACKS / pack_id / "contract.md"
    if not contract_path.exists():
        errors.append(f"missing contract file: {contract_path.relative_to(ROOT)}")
        return
    contract_meta = parse_contract_header(contract_path)
    if contract_meta.get("version") != metadata.get("version"):
        errors.append(
            f"{contract_path.relative_to(ROOT)} :: contract version mismatch with pack metadata"
        )
    if str(contract_meta.get("phase")) != str(metadata.get("phase")):
        errors.append(
            f"{contract_path.relative_to(ROOT)} :: contract phase mismatch with pack metadata"
        )
    if contract_meta.get("class") != metadata.get("workflow_class"):
        errors.append(
            f"{contract_path.relative_to(ROOT)} :: contract class mismatch with pack metadata"
        )
    if contract_meta.get("status") != metadata.get("status"):
        errors.append(
            f"{contract_path.relative_to(ROOT)} :: contract status mismatch with pack metadata"
        )

    skill_path = PACKS / pack_id / "SKILL.md"
    if parse_frontmatter_name(skill_path) != metadata.get("id"):
        errors.append(
            f"{skill_path.relative_to(ROOT)} :: skill frontmatter name mismatch with pack metadata"
        )

    input_fields = {
        item.get("name")
        for item in metadata.get("required_inputs", [])
        if isinstance(item, dict) and item.get("name")
    }
    expected_inputs = set(_extract_spec_input_names(spec))
    if input_fields != expected_inputs:
        errors.append(
            f"{metadata_path.relative_to(ROOT)} :: required_inputs must match workflow spec inputs"
        )

    output_contract = metadata.get("output_contract", {})
    for mode_name in ("plan_mode", "default_mode"):
        output_mode = output_contract.get(mode_name, {}) if isinstance(output_contract, dict) else {}
        output_sections = output_mode.get("sections", []) if isinstance(output_mode, dict) else []
        spec_sections = _extract_spec_output_sections(spec, mode_name)
        if output_sections != spec_sections:
            errors.append(
                f"{metadata_path.relative_to(ROOT)} :: output_contract.{mode_name}.sections "
                "must match workflow spec sections"
            )

    matrix_surfaces = {}
    for item in matrix.get("pack_surfaces", []):
        if item.get("pack") == pack_id:
            matrix_surfaces[(item.get("runtime"), item.get("surface_id"))] = item

    for target in metadata.get("runtime_targets", []):
        if not isinstance(target, dict):
            continue
        runtime = target.get("runtime")
        for surface in target.get("surfaces", []):
            if not isinstance(surface, dict):
                continue
            surface_id = surface.get("id")
            key = (runtime, surface_id)
            matrix_item = matrix_surfaces.get(key)
            if not matrix_item:
                errors.append(
                    f"{matrix_path.relative_to(ROOT)} :: missing pack_surfaces entry for {pack_id} "
                    f"{runtime}/{surface_id}"
                )
                continue
            if matrix_item.get("status") != surface.get("status"):
                errors.append(
                    f"{matrix_path.relative_to(ROOT)} :: status mismatch for {pack_id} "
                    f"{runtime}/{surface_id}"
                )
            if matrix_item.get("invocation") != surface.get("invocation"):
                errors.append(
                    f"{matrix_path.relative_to(ROOT)} :: invocation mismatch for {pack_id} "
                    f"{runtime}/{surface_id}"
                )
            for ref in surface.get("evidence_refs", []):
                path = _path_from_ref(ref)
                if not path.exists():
                    errors.append(
                        f"{metadata_path.relative_to(ROOT)} :: evidence ref does not exist: {ref}"
                    )
            if not isinstance(matrix_item.get("evidence_refs"), list) or not matrix_item.get("evidence_refs"):
                errors.append(
                    f"{matrix_path.relative_to(ROOT)} :: {pack_id} {runtime}/{surface_id} missing evidence refs"
                )

def lint_read_workflow_skill(path: Path) -> bool:
    text = read_text(path).lower()
    return "must not write" in text or "never write" in text


def run_lint() -> List[str]:
    errors: List[str] = []
    forbidden_runtime_tokens = [
        "claude code",
        "cursor runtime",
        "gemini cli",
        "openai api agents sdk runtime",
    ]
    for wf in CORE_WORKFLOWS:
        wf_dir = PACKS / wf
        required = [
            wf_dir / "SKILL.md",
            wf_dir / "contract.md",
            wf_dir / "example-invocation.md",
            wf_dir / "example-output.md",
            wf_dir / "validation-checklist.md",
        ]
        if (wf_dir / "pack.yaml").exists():
            required.append(wf_dir / "pack.yaml")
        for p in required:
            if not p.exists():
                errors.append(f"missing pack artifact: {p.relative_to(ROOT)}")
        skill_path = wf_dir / "SKILL.md"
        if skill_path.exists():
            declared = parse_frontmatter_name(skill_path)
            if declared != wf:
                errors.append(
                    f"skill frontmatter name mismatch: {skill_path.relative_to(ROOT)} "
                    f"(expected {wf}, got {declared or '<none>'})"
                )
            if wf in READ_WORKFLOWS and not lint_read_workflow_skill(skill_path):
                errors.append(
                    f"read workflow missing explicit no-write language: {skill_path.relative_to(ROOT)}"
                )
        spec_path = SPECS / f"{wf}.spec.yaml"
        if not spec_path.exists():
            errors.append(f"missing workflow spec: {spec_path.relative_to(ROOT)}")
        else:
            spec_text = read_text(spec_path)
            if "side_effect:" not in spec_text:
                errors.append(f"spec missing side_effect contract: {spec_path.relative_to(ROOT)}")
    # Memory-related contracts must explicitly mention side-effect contract.
    for wf in MEMORY_RELATED:
        contract = PACKS / wf / "contract.md"
        if contract.exists() and "Side-effect contract" not in read_text(contract):
            errors.append(f"contract missing side-effect section: {contract.relative_to(ROOT)}")
    # Scope containment: no third runtime mentions in core packs/specs.
    scan_paths: List[Path] = []
    for wf in CORE_WORKFLOWS:
        wf_dir = PACKS / wf
        scan_paths.extend([wf_dir / "SKILL.md", wf_dir / "contract.md"])
    scan_paths.extend(list((SPECS).glob("*.yaml")))
    for p in scan_paths:
        if not p.exists():
            continue
        lower = read_text(p).lower()
        for token in forbidden_runtime_tokens:
            if token in lower:
                errors.append(f"forbidden third-runtime token '{token}' in {p.relative_to(ROOT)}")
    for entry in _load_registry_entries(errors):
        pack_id = entry.get("id")
        if not pack_id:
            continue
        pack_dir = PACKS / str(pack_id)
        required_registry_artifacts = [
            pack_dir / "SKILL.md",
            pack_dir / "contract.md",
            pack_dir / "example-invocation.md",
            pack_dir / "example-output.md",
            pack_dir / "validation-checklist.md",
            pack_dir / "pack.yaml",
            SPECS / f"{pack_id}.spec.yaml",
        ]
        for path in required_registry_artifacts:
            if not path.exists():
                errors.append(f"missing formalized pack artifact: {path.relative_to(ROOT)}")
    return errors


def _collect_records() -> Tuple[List[Tuple[Path, Dict[str, Any]]], List[Tuple[Path, Dict[str, Any]]], List[str]]:
    mutable: List[Tuple[Path, Dict[str, Any]]] = []
    system: List[Tuple[Path, Dict[str, Any]]] = []
    errors: List[str] = []

    system_files = [
        PROJECT_MEMORY / "00-project-charter.yaml",
        PROJECT_MEMORY / "10-stack-profile.yaml",
    ]
    for p in system_files:
        try:
            docs = yaml_load_all(p)
        except Exception as exc:  # pragma: no cover - defensive
            errors.append(f"failed to parse YAML: {p.relative_to(ROOT)} :: {exc}")
            continue
        for d in docs:
            system.append((p, d))

    mutable_files = [
        PROJECT_MEMORY / "20-commands.yaml",
        PROJECT_MEMORY / "30-glossary.yaml",
        PROJECT_MEMORY / "40-ownership.yaml",
        PROJECT_MEMORY / "50-constraints.yaml",
    ]
    mutable_files.extend((PROJECT_MEMORY / "60-architecture-decisions").glob("*.yaml"))
    mutable_files.extend((PROJECT_MEMORY / "70-known-good-patterns").glob("*.yaml"))
    mutable_files.extend((PROJECT_MEMORY / "80-incidents-and-lessons").glob("*.yaml"))

    for p in mutable_files:
        if not p.exists():
            continue
        try:
            docs = yaml_load_all(p)
        except Exception as exc:  # pragma: no cover - defensive
            errors.append(f"failed to parse YAML: {p.relative_to(ROOT)} :: {exc}")
            continue
        for d in docs:
            if "kind" not in d:
                continue
            mutable.append((p, d))
    return mutable, system, errors


def _relative_memory_path(path: Path) -> str:
    return str(path.relative_to(PROJECT_MEMORY)).replace("\\", "/")


def _validate_index_records(
    index_records: List[Dict[str, Any]],
    mutable: List[Tuple[Path, Dict[str, Any]]],
    system: List[Tuple[Path, Dict[str, Any]]],
) -> List[str]:
    errors: List[str] = []
    index_rel = (PROJECT_MEMORY / "90-memory-index.yaml").relative_to(ROOT).as_posix()
    index_lookup = set()
    for item in index_records:
        if not isinstance(item, dict):
            errors.append(f"{index_rel} :: record entry must be object")
            continue
        for field in ("file", "kind", "title", "scope", "status", "record_family"):
            if field not in item:
                errors.append(
                    f"{index_rel} :: index entry missing field {field}"
                )
        kind = item.get("kind")
        family = item.get("record_family")
        if kind in SYSTEM_KINDS:
            if family != "system":
                errors.append(
                    f"{index_rel} :: {kind} entry must have record_family=system"
                )
            if item.get("scope") != "whole-project":
                errors.append(
                    f"{index_rel} :: {kind} entry must have scope=whole-project"
                )
            if item.get("schema_version") != "pre-0.1.0":
                errors.append(
                    f"{index_rel} :: {kind} entry must declare schema_version=pre-0.1.0"
                )
        if kind in MUTABLE_KINDS and family != "mutable":
            errors.append(
                f"{index_rel} :: {kind} entry must have record_family=mutable"
            )
        index_lookup.add((item.get("file"), kind, item.get("title")))

    for path, rec in system:
        key = (_relative_memory_path(path), rec.get("kind"), rec.get("title"))
        if key not in index_lookup:
            errors.append(
                f"index missing coverage for {key[0]} :: {rec.get('kind')}/{rec.get('title')}"
            )

    for path, rec in mutable:
        if rec.get("kind") not in MUTABLE_KINDS:
            continue
        key = (_relative_memory_path(path), rec.get("kind"), rec.get("title"))
        if key not in index_lookup:
            errors.append(
                f"index missing coverage for {key[0]} :: {rec.get('kind')}/{rec.get('title')}"
            )

    return errors


def run_schema() -> List[str]:
    errors: List[str] = []
    schema_files = [
        SCHEMAS / "memory-record.schema.yaml",
        SCHEMAS / "system-record.schema.yaml",
        SCHEMAS / "memory-index.schema.yaml",
        SCHEMAS / "audit-log-entry.schema.yaml",
        SCHEMAS / "candidate-report.schema.yaml",
        SCHEMAS / "pack-metadata.schema.yaml",
        SCHEMAS / "pack-registry.schema.yaml",
    ]
    for p in schema_files:
        if not p.exists():
            errors.append(f"missing schema file: {p.relative_to(ROOT)}")
            continue
        try:
            yaml_load_all(p)
        except Exception as exc:  # pragma: no cover
            errors.append(f"schema parse failed: {p.relative_to(ROOT)} :: {exc}")

    mutable, system, collect_errors = _collect_records()
    errors.extend(collect_errors)

    for p, rec in system:
        rec_errors = validate_system_record(rec)
        for err in rec_errors:
            errors.append(f"{p.relative_to(ROOT)} :: {err}")

    mutable_records_only: List[Dict[str, Any]] = []
    for p, rec in mutable:
        if rec.get("kind") not in MUTABLE_KINDS:
            errors.append(f"{p.relative_to(ROOT)} :: invalid mutable kind {rec.get('kind')}")
            continue
        rec_errors = validate_mutable_record(rec)
        for err in rec_errors:
            errors.append(f"{p.relative_to(ROOT)} :: {err}")
        mutable_records_only.append(rec)

    # Validate index shape, record families, and system-record coverage.
    index_path = PROJECT_MEMORY / "90-memory-index.yaml"
    if index_path.exists():
        docs = yaml_load_all(index_path)
        if len(docs) != 1:
            errors.append(f"{index_path.relative_to(ROOT)} :: expected exactly one YAML document")
        else:
            idx = docs[0]
            for top in ("version", "last_updated", "updated_by", "records"):
                if top not in idx:
                    errors.append(f"{index_path.relative_to(ROOT)} :: missing top-level field {top}")
            records = idx.get("records", [])
            if not isinstance(records, list):
                errors.append(f"{index_path.relative_to(ROOT)} :: records must be list")
                records = []
            errors.extend(_validate_index_records(records, mutable, system))
    else:
        errors.append("missing memory index: .pairslash/project-memory/90-memory-index.yaml")

    # Audit logs minimally validate shape.
    audit_dir = ROOT / ".pairslash" / "audit-log"
    for p in audit_dir.glob("*.yaml"):
        docs = yaml_load_all(p)
        for doc in docs:
            if "timestamp" not in doc:
                errors.append(f"{p.relative_to(ROOT)} :: missing timestamp")
            if "result" not in doc:
                errors.append(f"{p.relative_to(ROOT)} :: missing result")

    # Semantic stale/orphan checks.
    errors.extend([f"orphan supersedes: {x}" for x in detect_orphan_supersedes(mutable_records_only)])
    errors.extend([f"stale record: {x}" for x in detect_stale_records(mutable_records_only)])

    for entry in _load_registry_entries(errors):
        try:
            validate_formalized_pack(entry, errors)
        except Exception as exc:  # pragma: no cover - defensive
            errors.append(
                f"formalized pack validation failed for {entry.get('id') or '<unknown>'}: {exc}"
            )
    return errors


def run_fixtures() -> List[str]:
    errors: List[str] = []
    fixture_dir = ROOT / "tests" / "fixtures"
    if not fixture_dir.exists():
        return ["missing fixtures directory: tests/fixtures"]
    for p in fixture_dir.glob("*.yaml"):
        doc = yaml.safe_load(p.read_text(encoding="utf-8"))
        scenario = doc.get("scenario")
        if scenario == "duplicate":
            ok = detect_duplicate(doc.get("existing", []), doc["proposed"]["kind"], doc["proposed"]["title"])
            if ok != doc["expected"]["duplicate"]:
                errors.append(f"{p.relative_to(ROOT)} :: duplicate expectation mismatch")
        elif scenario == "supersede":
            missing = detect_missing_supersedes(doc.get("existing", []), doc["proposed"]["supersedes"])
            if (not missing) != doc["expected"]["supersede_target_exists"]:
                errors.append(f"{p.relative_to(ROOT)} :: supersede target expectation mismatch")
        elif scenario == "stale-record":
            stale = detect_stale_records(doc.get("records", []))
            if bool(stale) != doc["expected"]["stale_detected"]:
                errors.append(f"{p.relative_to(ROOT)} :: stale expectation mismatch")
        elif scenario == "orphan-ref":
            orphan = detect_orphan_supersedes(doc.get("records", []))
            if bool(orphan) != doc["expected"]["orphan_detected"]:
                errors.append(f"{p.relative_to(ROOT)} :: orphan expectation mismatch")
        elif scenario == "weak-evidence-reject":
            weak = classify_weak_evidence(
                doc["candidate"]["evidence"], doc["candidate"].get("source_refs", [])
            )
            if weak != doc["expected"]["weak"]:
                errors.append(f"{p.relative_to(ROOT)} :: weak evidence expectation mismatch")
        elif scenario == "invalid-scope":
            valid, _ = validate_scope(
                doc["record"]["scope"], doc["record"].get("scope_detail")
            )
            if valid != doc["expected"]["scope_valid"]:
                errors.append(f"{p.relative_to(ROOT)} :: scope validation expectation mismatch")
        elif scenario == "scope-shadow":
            shadow = detect_scope_shadow(
                doc.get("existing", []),
                doc["proposed"]["kind"],
                doc["proposed"]["scope"],
                doc["proposed"].get("scope_detail"),
            )
            if shadow != doc["expected"]["shadow_detected"]:
                errors.append(f"{p.relative_to(ROOT)} :: scope shadow expectation mismatch")
        else:
            errors.append(f"{p.relative_to(ROOT)} :: unknown scenario {scenario}")
    return errors


def run_golden() -> List[str]:
    errors: List[str] = []
    base = ROOT / "tests" / "golden"
    sample_path = base / "sample-record.yaml"
    if not sample_path.exists():
        return ["missing golden sample: tests/golden/sample-record.yaml"]
    record = yaml.safe_load(sample_path.read_text(encoding="utf-8"))
    target_file = route_target_file(record["kind"], record["title"])
    preview = _normalize_text(generate_preview_patch(record, target_file))
    preview_expected = _normalize_text((base / "preview-patch.txt").read_text(encoding="utf-8"))
    if preview != preview_expected:
        errors.append("golden mismatch: preview-patch.txt")
    idx = _normalize_text(yaml.safe_dump(build_index_entry(record, target_file), sort_keys=False))
    idx_expected = _normalize_text((base / "index-entry.yaml").read_text(encoding="utf-8"))
    if idx != idx_expected:
        errors.append("golden mismatch: index-entry.yaml")
    audit = _normalize_text(
        yaml.safe_dump(build_audit_entry(record, target_file, "success"), sort_keys=False)
    )
    audit_expected = _normalize_text((base / "audit-entry.yaml").read_text(encoding="utf-8"))
    if audit != audit_expected:
        errors.append("golden mismatch: audit-entry.yaml")
    return errors


def _normalize_text(text: str) -> str:
    return text.replace("\r\n", "\n").rstrip() + "\n"


def mark_acceptance_gate_status(passed: bool) -> None:
    gates_path = ROOT / "docs" / "compatibility" / "acceptance-gates.yaml"
    if not gates_path.exists():
        return
    data = yaml.safe_load(gates_path.read_text(encoding="utf-8"))
    status = "pass" if passed else "fail"
    for section in ("must_gates", "will_not_gates"):
        gates = data.get(section, {}).get("gates", [])
        for gate in gates:
            gate["status"] = status
    gates_path.write_text(yaml.safe_dump(data, sort_keys=False), encoding="utf-8")


def run_selected(args: argparse.Namespace) -> int:
    checks: List[Tuple[str, List[str]]] = []
    if args.all or args.doctor:
        checks.append(("doctor", run_doctor()))
    if args.all or args.lint:
        checks.append(("lint", run_lint()))
    if args.all or args.schema:
        checks.append(("schema", run_schema()))
    if args.all or args.fixtures:
        checks.append(("fixtures", run_fixtures()))
    if args.all or args.golden:
        checks.append(("golden", run_golden()))

    if not checks:
        raise CheckFailure("No checks selected. Use --all or at least one check flag.")

    failed = False
    for name, errs in checks:
        if errs:
            failed = True
            print(f"[FAIL] {name} ({len(errs)} issues)")
            for e in errs:
                print(f"  - {e}")
        else:
            print(f"[PASS] {name}")

    if args.update_gates:
        mark_acceptance_gate_status(not failed)
    return 1 if failed else 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="PairSlash Phase 2 checks")
    p.add_argument("--all", action="store_true", help="Run all checks")
    p.add_argument("--doctor", action="store_true", help="Run doctor checks")
    p.add_argument("--lint", action="store_true", help="Run lint checks")
    p.add_argument("--schema", action="store_true", help="Run schema checks")
    p.add_argument("--fixtures", action="store_true", help="Run fixture checks")
    p.add_argument("--golden", action="store_true", help="Run golden checks")
    p.add_argument(
        "--update-gates",
        action="store_true",
        help="Update docs/compatibility/acceptance-gates.yaml status fields from run result",
    )
    return p


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    try:
        return run_selected(args)
    except CheckFailure as exc:
        print(f"[FAIL] {exc}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
