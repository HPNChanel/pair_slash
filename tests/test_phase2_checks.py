import unittest
from pathlib import Path

import yaml

from scripts.pairslash_phase2_lib import validate_pack_metadata
from scripts.phase2_checks import (
    PROJECT_MEMORY,
    _validate_index_records,
    run_doctor,
    run_fixtures,
    run_golden,
    run_lint,
    run_schema,
)


class Phase2ChecksTests(unittest.TestCase):
    def _load_phase2_workflow(self) -> dict:
        return yaml.load(
            Path(".github/workflows/phase2-checks.yml").read_text(encoding="utf-8"),
            Loader=yaml.BaseLoader,
        )

    def test_doctor_passes(self) -> None:
        self.assertEqual(run_doctor(), [])

    def test_lint_passes(self) -> None:
        self.assertEqual(run_lint(), [])

    def test_schema_passes(self) -> None:
        self.assertEqual(run_schema(), [])

    def test_fixtures_pass(self) -> None:
        self.assertEqual(run_fixtures(), [])

    def test_golden_passes(self) -> None:
        self.assertEqual(run_golden(), [])

    def test_validate_index_records_requires_system_coverage(self) -> None:
        system = [
            (
                PROJECT_MEMORY / "00-project-charter.yaml",
                {"kind": "charter", "title": "PairSlash Project Charter"},
            )
        ]
        errors = _validate_index_records([], [], system)
        self.assertIn(
            "index missing coverage for 00-project-charter.yaml :: charter/PairSlash Project Charter",
            errors,
        )

    def test_validate_index_records_requires_legacy_schema_version_for_system_entries(self) -> None:
        system = [
            (
                PROJECT_MEMORY / "00-project-charter.yaml",
                {"kind": "charter", "title": "PairSlash Project Charter"},
            )
        ]
        records = [
            {
                "file": "00-project-charter.yaml",
                "kind": "charter",
                "title": "PairSlash Project Charter",
                "scope": "whole-project",
                "status": "active",
                "record_family": "system",
            }
        ]
        errors = _validate_index_records(records, [], system)
        self.assertIn(
            ".pairslash/project-memory/90-memory-index.yaml :: charter entry must declare schema_version=pre-0.1.0",
            errors,
        )

    def test_readme_routes_to_active_docs(self) -> None:
        readme = Path("README.md").read_text(encoding="utf-8")
        for rel in (
            "docs/workflows/install-guide.md",
            "docs/workflows/phase-2-operations.md",
            "docs/compatibility/compatibility-matrix.md",
            "docs/compatibility/runtime-verification.md",
        ):
            self.assertIn(rel, readme)

    def test_archived_phase0_docs_point_to_active_phase2_docs(self) -> None:
        overview = Path("docs/architecture/phase-0-overview.md").read_text(encoding="utf-8")
        acceptance = Path("docs/compatibility/phase-0-acceptance.md").read_text(encoding="utf-8")
        self.assertIn("docs/workflows/install-guide.md", overview)
        self.assertIn("docs/workflows/phase-2-operations.md", overview)
        self.assertIn("docs/compatibility/runtime-verification.md", overview)
        self.assertIn("docs/workflows/phase-2-operations.md", acceptance)
        self.assertIn("docs/compatibility/runtime-verification.md", acceptance)

    def test_install_guide_routes_to_operations_and_runtime_verification(self) -> None:
        install_guide = Path("docs/workflows/install-guide.md").read_text(encoding="utf-8")
        self.assertIn("docs/workflows/phase-2-operations.md", install_guide)
        self.assertIn("docs/compatibility/runtime-verification.md", install_guide)

    def test_phase2_workflow_uses_least_privilege_and_cancels_superseded_runs(self) -> None:
        workflow = self._load_phase2_workflow()
        self.assertEqual(workflow["permissions"], {"contents": "read"})
        self.assertEqual(workflow["concurrency"]["group"], "phase2-checks-${{ github.ref }}")
        self.assertEqual(workflow["concurrency"]["cancel-in-progress"], "true")

    def test_phase2_workflow_uses_documented_validation_commands(self) -> None:
        workflow_text = Path(".github/workflows/phase2-checks.yml").read_text(encoding="utf-8")
        readme = Path("README.md").read_text(encoding="utf-8")
        operations = Path("docs/workflows/phase-2-operations.md").read_text(encoding="utf-8")
        for command in (
            "python scripts/phase2_checks.py --all",
            'python -m unittest discover -s tests -p "test_*.py"',
        ):
            self.assertIn(command, workflow_text)
            self.assertIn(command, readme)
            self.assertIn(command, operations)

    def test_phase3_release_notes_bound_formalized_pack_claims(self) -> None:
        readme = Path("README.md").read_text(encoding="utf-8")
        release_notes = Path("docs/releases/phase-3-team-pack-update.md").read_text(encoding="utf-8")
        registry = yaml.safe_load(
            Path("packages/spec-core/registry/packs.yaml").read_text(encoding="utf-8")
        )
        pack_ids = {entry["id"] for entry in registry["packs"]}

        self.assertIn("- Version: `0.2.0`", readme)
        self.assertEqual(registry["version"], "0.2.0")
        self.assertEqual(
            pack_ids,
            {
                "pairslash-plan",
                "pairslash-backend",
                "pairslash-frontend",
                "pairslash-devops",
                "pairslash-release",
            },
        )
        self.assertIn("pairslash-backend", release_notes)
        self.assertIn("pairslash-release", release_notes)
        self.assertIn("registry membership is authoritative", release_notes.lower())

    def test_release_preparation_artifacts_stay_aligned(self) -> None:
        changelog = Path("docs/releases/changelog-0.2.0.md").read_text(encoding="utf-8")
        upgrade_notes = Path("docs/releases/upgrade-notes-0.2.0.md").read_text(encoding="utf-8")
        checklist = Path("docs/releases/release-checklist-0.2.0.md").read_text(encoding="utf-8")
        compatibility = Path("docs/compatibility/compatibility-matrix.md").read_text(
            encoding="utf-8"
        )

        self.assertIn("`pairslash-plan` pack version `0.2.0`", changelog)
        self.assertIn("`pairslash-backend` pack version `0.2.0`", changelog)
        self.assertIn("No Global Project Memory migration is required", upgrade_notes)
        self.assertIn("registry membership as the authority", upgrade_notes)
        self.assertIn("`pairslash-release`", upgrade_notes)
        self.assertIn("python scripts/phase2_checks.py --all", checklist)
        self.assertIn('python -m unittest discover -s tests -p "test_*.py"', checklist)
        self.assertIn("new team-pack runtime surfaces are still described as `unverified`", checklist)
        self.assertIn("Phase 3 pack compatibility summary", checklist)
        self.assertIn("Release checklist: `docs/releases/release-checklist-0.2.0.md`", compatibility)
        self.assertIn("pairslash-devops", compatibility)

    def test_phase3_compatibility_matrix_keeps_team_packs_evidence_bound(self) -> None:
        compatibility = Path("docs/compatibility/compatibility-matrix.md").read_text(
            encoding="utf-8"
        )

        self.assertIn("## Phase 3 pack compatibility summary", compatibility)
        self.assertIn(
            "| Pack name | Version | Codex support | Copilot support | Required capabilities | Known limitations | Migration notes | Validation status | Open risks |",
            compatibility,
        )
        self.assertIn("| pairslash-backend | `0.2.0` | not yet validated | not yet validated |", compatibility)
        self.assertIn("| pairslash-frontend | `0.2.0` | not yet validated | not yet validated |", compatibility)
        self.assertIn("| pairslash-devops | `0.2.0` | not yet validated | not yet validated |", compatibility)
        self.assertIn("| pairslash-release | `0.2.0` | not yet validated | not yet validated |", compatibility)
        self.assertIn("`supported with caveat`", compatibility)
        self.assertIn("Relevant feature surfaces for the Phase 3 packs are:", compatibility)

    def test_pack_metadata_requires_explicit_model_pins(self) -> None:
        record = yaml.safe_load(Path("packs/core/pairslash-backend/pack.yaml").read_text(encoding="utf-8"))
        del record["codex"]["plan_off_model"]

        errors = validate_pack_metadata(record)

        self.assertIn("codex missing model pin: plan_off_model", errors)

    def test_pack_metadata_rejects_unauthorized_global_memory_write(self) -> None:
        record = yaml.safe_load(Path("packs/core/pairslash-backend/pack.yaml").read_text(encoding="utf-8"))
        record["memory_access"]["global_project_memory"] = "write"

        errors = validate_pack_metadata(record)

        self.assertIn("read-only packs must not declare global_project_memory=write", errors)
        self.assertIn(
            "packs may only write Global Project Memory when workflow_class=write-authority",
            errors,
        )


if __name__ == "__main__":
    unittest.main()
