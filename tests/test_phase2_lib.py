import unittest
from pathlib import Path

import yaml

from scripts.pairslash_phase2_lib import (
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
    slugify_title,
    validate_pack_metadata,
    validate_pack_registry,
    validate_scope,
    validate_system_record,
)


class Phase2LibTests(unittest.TestCase):
    def setUp(self) -> None:
        self.sample = yaml.safe_load(
            Path("tests/golden/sample-record.yaml").read_text(encoding="utf-8")
        )
        self.charter = yaml.safe_load(
            Path(".pairslash/project-memory/00-project-charter.yaml").read_text(encoding="utf-8")
        )
        self.stack_profile = yaml.safe_load(
            Path(".pairslash/project-memory/10-stack-profile.yaml").read_text(encoding="utf-8")
        )

    def test_slugify_title(self) -> None:
        self.assertEqual(slugify_title("Hello, World!"), "hello-world")

    def test_route_target_file_pattern(self) -> None:
        target = route_target_file("pattern", self.sample["title"])
        self.assertIn("70-known-good-patterns", target)

    def test_validate_scope_requires_scope_detail(self) -> None:
        ok, _ = validate_scope("subsystem", None)
        self.assertFalse(ok)

    def test_detect_duplicate(self) -> None:
        existing = [{"kind": "pattern", "title": self.sample["title"]}]
        self.assertTrue(detect_duplicate(existing, "pattern", self.sample["title"]))

    def test_detect_missing_supersedes(self) -> None:
        existing = [{"kind": "pattern", "title": "x"}]
        self.assertTrue(detect_missing_supersedes(existing, "pattern/missing"))
        self.assertFalse(detect_missing_supersedes(existing, "pattern/x"))

    def test_detect_scope_shadow(self) -> None:
        existing = [{"kind": "constraint", "scope": "whole-project", "title": "base"}]
        self.assertTrue(detect_scope_shadow(existing, "constraint", "subsystem", "memory"))

    def test_preview_patch_contains_markers(self) -> None:
        target = route_target_file(self.sample["kind"], self.sample["title"])
        preview = generate_preview_patch(self.sample, target)
        self.assertIn("--- preview patch ---", preview)
        self.assertIn("--- end preview ---", preview)

    def test_build_index_and_audit(self) -> None:
        target = route_target_file(self.sample["kind"], self.sample["title"])
        idx = build_index_entry(self.sample, target)
        self.assertEqual(idx["record_family"], "mutable")
        audit = build_audit_entry(self.sample, target, "success")
        self.assertEqual(audit["result"], "success")

    def test_orphan_and_stale_detectors(self) -> None:
        orphan = detect_orphan_supersedes(
            [{"kind": "pattern", "title": "a", "supersedes": "pattern/missing"}]
        )
        self.assertTrue(orphan)
        stale = detect_stale_records(
            [{"kind": "decision", "title": "a", "action": "append", "supersedes": "decision/b"}]
        )
        self.assertTrue(stale)

    def test_weak_evidence_classifier(self) -> None:
        self.assertTrue(classify_weak_evidence("General best practice.", []))
        self.assertFalse(
            classify_weak_evidence(
                "Evidence from test suite and incident write-up confirms behavior.",
                ["docs/x.md", "logs/y.txt"],
            )
        )

    def test_pack_metadata_validates(self) -> None:
        metadata = yaml.safe_load(
            Path("packs/core/pairslash-plan/pack.yaml").read_text(encoding="utf-8")
        )
        self.assertEqual(validate_pack_metadata(metadata), [])

    def test_pack_registry_validates(self) -> None:
        registry = yaml.safe_load(
            Path("packages/spec-core/registry/packs.yaml").read_text(encoding="utf-8")
        )
        self.assertEqual(validate_pack_registry(registry), [])

    def test_validate_system_record_accepts_charter_and_stack_profile(self) -> None:
        self.assertEqual(validate_system_record(self.charter), [])
        self.assertEqual(validate_system_record(self.stack_profile), [])

    def test_validate_system_record_requires_kind_specific_fields(self) -> None:
        broken = dict(self.charter)
        broken.pop("core_principles")
        self.assertIn("missing field: core_principles", validate_system_record(broken))


if __name__ == "__main__":
    unittest.main()
