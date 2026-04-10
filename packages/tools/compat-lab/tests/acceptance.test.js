import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_ACCEPTANCE_LANES,
  formatCompatAcceptanceText,
  runCompatAcceptance,
} from "@pairslash/compat-lab";

import { repoRoot } from "../../../../tests/compat-lab-helpers.js";

const serial = { concurrency: false };

test("compat-lab acceptance registers macos linux and windows-prep lanes", () => {
  assert.deepEqual(
    DEFAULT_ACCEPTANCE_LANES.map((lane) => lane.key),
    ["macos", "linux", "windows-prep"],
  );
});

test("compat-lab acceptance macos lane reaches first workflow and keeps uninstall safe", serial, () => {
  const report = runCompatAcceptance({
    repoRoot,
    lane: "macos",
  });
  assert.equal(report.kind, "compat-lab-acceptance-report");
  assert.equal(report.lane_id, "macos.codex.repo");
  assert.equal(report.status, "pass");
  assert.equal(report.acceptance_mode, "deterministic_fake_shim_acceptance");
  assert.equal(report.evidence_partition.deterministic.evidence_class, "deterministic_test");
  assert.equal(report.evidence_partition.fake.evidence_class, "fake_acceptance");
  assert.equal(report.evidence_partition.shim.evidence_class, "shim_acceptance");
  assert.equal(report.evidence_partition.live.evidence_class, "live_verification");
  assert.equal(report.support_claim_boundary.public_support_promotion_allowed, false);
  assert.equal(report.install_success, true);
  assert.equal(report.doctor_success, true);
  assert.ok(report.time_to_first_success_ms > 0);
  assert.deepEqual(
    report.scenarios.map((scenario) => scenario.id),
    [
      "fresh-install.macos.codex.repo",
      "read-authority.macos.codex.repo",
      "update-preserve-override.macos.codex.repo",
      "uninstall-owned-only.macos.codex.repo",
      "semantic-parity.reconcile-unmanaged.macos.codex.repo",
      "semantic-parity.install-root-shape.macos.codex.repo",
      "semantic-parity.stale-state.macos.codex.repo",
      "semantic-parity.managed-reinstall.macos.codex.repo",
      "semantic-parity.managed-reinstall-remediation.macos.codex.repo",
      "doctor-broken-setup.macos.codex.repo",
    ],
  );
  assert.equal(report.scenarios[0].support_verdict, "warn");
  assert.equal(
    report.scenarios.find((scenario) => scenario.id === "read-authority.macos.codex.repo")?.status,
    "pass",
  );
  assert.equal(
    report.scenarios.find((scenario) => scenario.id === "update-preserve-override.macos.codex.repo")?.update_success,
    true,
  );
  assert.equal(
    report.scenarios.find((scenario) => scenario.id === "uninstall-owned-only.macos.codex.repo")?.uninstall_success,
    true,
  );
  assert.equal(
    report.scenarios.find((scenario) => scenario.id === "doctor-broken-setup.macos.codex.repo")?.doctor_success,
    true,
  );
});

test("compat-lab acceptance linux lane stays usable despite copilot tested-range warning", serial, () => {
  const report = runCompatAcceptance({
    repoRoot,
    lane: "linux",
  });
  assert.equal(report.kind, "compat-lab-acceptance-report");
  assert.equal(report.lane_id, "linux.copilot.user");
  assert.equal(report.status, "pass");
  assert.equal(report.acceptance_mode, "deterministic_fake_shim_acceptance");
  assert.equal(report.support_claim_boundary.public_support_promotion_allowed, false);
  assert.equal(report.install_success, true);
  assert.equal(report.doctor_success, true);
  assert.ok(report.time_to_first_success_ms > 0);
  const freshInstall = report.scenarios.find((scenario) => scenario.id === "fresh-install.linux.copilot.user");
  assert.ok(freshInstall);
  assert.equal(freshInstall.support_verdict, "degraded");
  assert.equal(
    report.scenarios.find((scenario) => scenario.id === "read-authority.linux.copilot.user")?.status,
    "pass",
  );
  assert.ok(report.issue_codes.length > 0);
});

test("compat-lab acceptance windows prep lane stays non-mutating and catches broken setup", serial, () => {
  const report = runCompatAcceptance({
    repoRoot,
    lane: "windows-prep",
  });
  assert.equal(report.kind, "compat-lab-acceptance-report");
  assert.equal(report.lane_id, "windows.prep");
  assert.equal(report.status, "pass");
  assert.equal(report.acceptance_mode, "deterministic_fake_shim_acceptance");
  assert.equal(report.support_claim_boundary.public_support_promotion_allowed, false);
  assert.equal(report.install_success, null);
  assert.equal(report.doctor_success, true);
  assert.equal(report.time_to_first_success_ms, null);
  assert.deepEqual(
    report.scenarios.map((scenario) => scenario.id),
    [
      "prep-preview.codex.repo",
      "prep-preview.copilot.user",
      "prep-doctor-conflict.copilot.repo",
    ],
  );
  assert.equal(report.scenarios[2].doctor_success, true);
  assert.ok(report.commands.some((command) => command.includes("preview install")));
});

test("compat-lab acceptance suite aggregates lane reports and formats text", serial, () => {
  const report = runCompatAcceptance({
    repoRoot,
  });
  assert.equal(report.kind, "compat-lab-acceptance-suite");
  assert.equal(report.status, "pass");
  assert.equal(report.acceptance_mode, "deterministic_fake_shim_acceptance");
  assert.equal(report.support_claim_boundary.public_support_promotion_allowed, false);
  assert.equal(report.summary.total_lanes, 3);
  assert.equal(report.summary.failed_lanes, 0);
  const text = formatCompatAcceptanceText(report);
  assert.match(text, /Compat lab acceptance suite/);
  assert.match(text, /Acceptance mode: deterministic_fake_shim_acceptance/);
  assert.match(text, /Support claim promotion allowed: false/);
  assert.match(text, /macos\.codex\.repo/);
  assert.match(text, /linux\.copilot\.user/);
  assert.match(text, /windows\.prep/);
});
