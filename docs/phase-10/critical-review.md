# Phase 10 Critical Review

## Executive Verdict

Verdict hiện tại là `No-Go` cho public Phase 10 claim.

Repo đã có nền thật cho trust receipts, trust delta, release-trust bundle, rollback journal, lint/doctor integration, và deterministic/live evidence language. Nhưng kế hoạch vẫn có các phase-blocking holes ở 5 chỗ: release gate chưa thật sự bao gồm release integrity, trust tier vẫn còn tự-attest ở pack level, support-claim source of truth đang tách đôi, evidence presence quá yếu, và checksum artifact hiện chưa được verify trong lane quyết định.

Coding chỉ nên bắt đầu trên một slice hẹp nếu bị khóa bởi guard rõ ràng: không claim signed releases publicly, không claim enterprise-grade OSS hardening, không claim verified external ecosystem rộng, và không promote support từ deterministic evidence sang live evidence.

## Architectural Holes

### A1. Release-readiness chưa gate release trust thật

- Evidence class: `repo-grounded`
- Severity: `Critical`
- Likelihood: `High`
- Affected subsystem: `scripts/run-release-readiness.mjs`, `scripts/run-compat-lab-release-readiness.mjs`, release pipeline
- Likely trigger: Maintainer cut release sau khi `npm run test:release` xanh, nhưng bundle trust bị thiếu, stale, hoặc invalid.
- User-visible symptom: Release docs nói sẵn sàng phát hành trong khi signed bundle không tồn tại hoặc verify không chạy trong release lane.
- How it would damage trust: Release integrity trở thành optional ceremony thay vì release gate. Một khi user thấy claim nhưng gate không chặn được regression, Phase 10 mất credibility rất nhanh.
- Mitigation: Biến build + verify release trust thành gate bắt buộc trong release-readiness, không chỉ là script rời. Nếu signed-release lane được bật thì keyring active cũng phải là gate.
- Test that should exist: `test:release` fail khi thiếu `release-manifest.sig.json`, key không có trong keyring, hoặc bundle verify thất bại.
- Disposition: `phase-blocking`

### A2. `core-maintained` đang là self-claim ở pack descriptor

- Evidence class: `repo-grounded`
- Severity: `Critical`
- Likelihood: `High`
- Affected subsystem: `packs/*/pack.trust.yaml`, `packages/core/spec-core/src/release-trust.js`, `packages/tools/lint-bridge/src/index.js`
- Likely trigger: Một pack PairSlash mới tự khai `tier_claim: core-maintained`, được ký trong release, và đi kèm capability mạnh hoặc memory write.
- User-visible symptom: Pack mới được install như core pack dù chưa có central review boundary tách biệt với first-party khác.
- How it would damage trust: Core trust bị kéo xuống mức pack-local self-attestation. Đây là kiểu hole phá trust model từ bên trong, không phải từ external ecosystem.
- Mitigation: Dời authority cho `core-maintained` khỏi pack-local descriptor sang một machine-readable central registry hoặc allowlist release-time. Memory write phải phụ thuộc registry đó, không chỉ phụ thuộc self-claim.
- Test that should exist: Pack PairSlash không nằm trong central core registry nhưng tự claim `core-maintained` phải bị lint/install/release gate block.
- Disposition: `phase-blocking`

### A3. Support claim đang có hai source of truth

- Evidence class: `repo-grounded`
- Severity: `Critical`
- Likelihood: `High`
- Affected subsystem: `packages/tools/doctor/src/support-lane.js`, `packages/tools/compat-lab/src/matrix.js`, `docs/compatibility/*`
- Likely trigger: Compat matrix được regenerate hoặc docs thay đổi, nhưng logic hardcoded của `doctor` không đổi theo.
- User-visible symptom: `doctor` nói lane `prep` hoặc `supported`, còn public matrix nói khác; remediation text và claim ladder lệch nhau.
- How it would damage trust: Support claim overreach hoặc underclaim không còn là problem của docs nữa, mà thành contradiction trong product surface.
- Mitigation: Một machine-readable support registry duy nhất phải feed cả `doctor` lẫn compat docs. Không giữ hardcoded lane truth ở `doctor` khi public matrix được generate ở subsystem khác.
- Test that should exist: Snapshot parity test giữa doctor lane verdicts và generated compatibility matrix cho mọi runtime/target/OS lane.
- Disposition: `phase-blocking`

### A4. SBOM/provenance rất dễ thành ceremony file-drop

- Evidence class: `plan-grounded`
- Severity: `High`
- Likelihood: `High`
- Affected subsystem: future release pipeline, `installer`, `doctor`, `lint`, `spec-core` schemas
- Likely trigger: Thêm SBOM/provenance outputs vào CI nhưng không có reader path và không đổi quyết định nào trong install/update/doctor/lint.
- User-visible symptom: Nhiều artifact hơn trong release, nhưng operator không biết command nào verify, fail khi nào, và remediation là gì.
- How it would damage trust: Phase 10 trông “enterprise” hơn trên giấy nhưng không tăng decision quality. Đây là đúng failure mode ceremony quá sớm.
- Mitigation: Không thêm artifact class nào nếu chưa có 3 thứ cùng lúc: source of truth schema, verify path trong command surface, và release gate bắt buộc.
- Test that should exist: Release gate phải fail nếu artifact được claim là mandatory nhưng reader path hoặc schema validation chưa tồn tại.
- Disposition: `defer-with-guard`

## Trust Model Holes

### T1. `evidence_ref` hiện quá yếu để được coi là evidence

- Evidence class: `repo-grounded`
- Severity: `Critical`
- Likelihood: `High`
- Affected subsystem: `packages/core/spec-core/src/release-trust.js`
- Likely trigger: External pack trỏ `evidence_ref` tới URL bất kỳ hoặc một file placeholder tồn tại trên disk.
- User-visible symptom: Runtime support claim được xem như “có evidence” chỉ vì string đó tồn tại hoặc là URL.
- How it would damage trust: Fake evidence bị nhầm thành real evidence. Claim ladder sụp vì “evidence present” không còn mang nghĩa quality.
- Mitigation: Chỉ cho local schema-backed evidence records hoặc trusted registry entries được tính là evidentiary. Remote URL chỉ là reference, không phải proof.
- Test that should exist: Descriptor với `evidence_ref: https://example.com` hoặc file placeholder trống không được nâng `evidence_present` thành true cho support claim.
- Disposition: `phase-blocking`

### T2. Capability gating mới chặn memory write, chưa chặn các capability mạnh khác

- Evidence class: `repo-grounded`
- Severity: `Critical`
- Likelihood: `High`
- Affected subsystem: `packages/core/spec-core/src/release-trust.js`, `packages/tools/lint-bridge/src/index.js`, pack trust model
- Likely trigger: Pack external hoặc first-party non-core khai `repo_write`, `shell_exec`, `test_exec`, hoặc capability mạnh tương đương.
- User-visible symptom: Pack có power đáng kể vẫn đi qua trust flow chủ yếu bằng `ask`, dù trust tier thấp hơn core.
- How it would damage trust: Third-party ecosystem có thể tiến gần quyền của core product mà không có capability wall rõ ràng.
- Mitigation: Chốt capability matrix theo trust tier. Ít nhất `repo_write`, `shell_exec`, `mcp_client`, và mọi write-path mạnh phải có policy khác với read-only packs.
- Test that should exist: `verified-external` hoặc `first-party-official` pack yêu cầu capability high-risk phải bị hard-block hoặc require explicit elevated review path, không chỉ warning chung.
- Disposition: `phase-blocking`

### T3. Local trust và product trust có thể bị nhìn như cùng một loại trust

- Evidence class: `repo-grounded`
- Severity: `High`
- Likelihood: `Medium`
- Affected subsystem: `trust/trust-policy.yaml`, `doctor`, `installer`, future install/update UX
- Likely trigger: User hoặc org thêm publisher external vào local trust policy rồi thấy pack hiện lên như `verified-external`.
- User-visible symptom: Operator đọc `verified-external` như PairSlash endorsement thay vì local policy approval.
- How it would damage trust: Core product trust bị kéo xuống thấp vì external ecosystem metadata dùng chung ngôn ngữ với product trust.
- Mitigation: Surface rõ `local policy trusted` khác với `PairSlash maintained` hoặc `PairSlash official`. Không dùng cùng badge, cùng color, hoặc cùng summary text.
- Test that should exist: Snapshot install/doctor cho locally trusted external publisher phải chứa wording kiểu “trusted by local policy” chứ không được giống core/official.
- Disposition: `defer-with-guard`

### T4. Vendored external pack sẽ xuất hiện như `local-dev`

- Evidence class: `repo-grounded`
- Severity: `High`
- Likelihood: `Medium`
- Affected subsystem: `packages/core/spec-core/src/release-trust.js`, install/lint/doctor UX
- Likely trigger: User copy một external pack vào repo hiện tại để thử nghiệm.
- User-visible symptom: Pack đi qua lane `local-source` / `local-dev`, có thể bị hiểu nhầm là “được PairSlash chấp nhận tạm”.
- How it would damage trust: Local experimentation bị nhầm với bounded third-party trust. Ecosystem boundary bị mờ.
- Mitigation: Giữ local experimentation, nhưng wording phải khẳng định đây là local source only, không publisher verified, không publicly supported.
- Test that should exist: Install/update/doctor/lint snapshots cho vendored external pack phải hiển thị `local-dev` risk text nhất quán.
- Disposition: `defer-with-guard`

## Evidence and Claim Risks

### E1. Keyring first-party đang rỗng, nên signed-release readiness chưa chứng minh được

- Evidence class: `repo-grounded`
- Severity: `High`
- Likelihood: `High`
- Affected subsystem: `trust/first-party-keys.json`, release ops
- Likely trigger: Maintainer bắt đầu nói về signed releases hoặc public verification path.
- User-visible symptom: Clean repo không có active production key để verify public PairSlash releases.
- How it would damage trust: Claim “signed releases” tồn tại trước operational proof. Một public trust feature không có shipped trust root là overreach trực tiếp.
- Mitigation: Không claim signed-release publicly cho đến khi active key, revocation state, và rotation procedure tồn tại trong shipped repo.
- Test that should exist: Release-readiness fail nếu signed release được yêu cầu nhưng keyring không có active key hợp lệ.
- Disposition: `phase-blocking`

### E2. Docs đang ám chỉ release gate mạnh hơn code thực tế

- Evidence class: `repo-grounded`
- Severity: `Critical`
- Likelihood: `High`
- Affected subsystem: `docs/compatibility/compatibility-matrix.md`, `packages/tools/compat-lab/src/matrix.js`, release scripts
- Likely trigger: Maintainer dùng public matrix như evidence cho release hardening.
- User-visible symptom: Docs nói release-readiness là gate release promotion, nhưng gate đó chưa bao gồm release-trust verification.
- How it would damage trust: Docs/policy mismatch với code là kiểu credibility bug nặng nhất trong Phase 10, vì Phase này chính là phase của release trust.
- Mitigation: Hoặc hạ wording của docs xuống theo reality, hoặc nâng code gate lên ngay. Không để docs nói trước code ở trust phase.
- Test that should exist: Docs-surface test fail nếu generated gate narrative không khớp script thực thi thật.
- Disposition: `phase-blocking`

### E3. Signed/verified rất dễ bị hiểu nhầm là live-supported

- Evidence class: `drift-risk`
- Severity: `Critical`
- Likelihood: `Medium`
- Affected subsystem: install/update/doctor formatting, trust receipts, release docs
- Likely trigger: UI chỉ nổi bật `verified` hoặc `signed` mà không đồng thời hiển thị support lane và evidence class.
- User-visible symptom: User thấy “verified” và suy ra runtime support đã được live-backed.
- How it would damage trust: Phase 10 biến signed artifact thành false sense of security, đúng anti-goal mà phase framing đã cấm.
- Mitigation: Luôn tách riêng ít nhất 3 trường trong UX: release verification, runtime support status, evidence class.
- Test that should exist: Snapshot CLI cho signed pack trên `prep` lane phải vẫn nói rõ install support chưa có live evidence.
- Disposition: `phase-blocking`

### E4. `publisher-verified` có nguy cơ bị hiểu như product support

- Evidence class: `repo-grounded`
- Severity: `High`
- Likelihood: `Medium`
- Affected subsystem: `packages/core/spec-core/src/release-trust.js`, doctor/install/update formatting
- Likely trigger: External pack đạt `verified-external` nhưng runtime evidence chỉ partial hoặc unverified.
- User-visible symptom: Pack hiện `publisher-verified` và operator hiểu đó là “PairSlash thấy ổn”.
- How it would damage trust: Claim support vượt evidence. PairSlash vô tình đứng tên cho mức support mà thực ra chỉ là publisher-side claim + local trust.
- Mitigation: Đổi wording hoặc formatting để `publisher-verified` luôn đi kèm “not PairSlash supported” và runtime evidence class hiện tại.
- Test that should exist: Snapshot doctor/install cho `verified-external` + partial evidence phải không thể bị đọc như `core-supported` hay `official-preview`.
- Disposition: `defer-with-guard`

## UX and Operator Risks

### U1. Remediation text chưa đủ sắc để operator biết phải làm gì

- Evidence class: `repo-grounded`
- Severity: `High`
- Likelihood: `High`
- Affected subsystem: `installer`, `doctor`, `lint`, CLI formatting
- Likely trigger: Signature invalid, descriptor thiếu, runtime evidence thiếu, trust policy deny, hoặc legacy state.
- User-visible symptom: Operator thấy `ask`, `warn`, hoặc summary code-like nhưng không rõ command kế tiếp là gì.
- How it would damage trust: Khi verify fail mà remediation mơ hồ, user không phân biệt được “không an toàn” với “thiếu metadata” với “local dev only”.
- Mitigation: Canonical remediation text cho từng trust verdict class, không chỉ generic “review json”.
- Test that should exist: CLI text snapshots cho missing descriptor, invalid signature, runtime evidence missing, legacy receipt, local-dev install.
- Disposition: `defer-with-guard`

### U2. Ask-heavy model có thể tạo review fatigue

- Evidence class: `repo-grounded`
- Severity: `Medium`
- Likelihood: `High`
- Affected subsystem: `resolveBasePolicyAction`, install/update UX
- Likely trigger: Repo cài nhiều pack `first-party-official`, `verified-external`, hoặc `local-dev`.
- User-visible symptom: Preview và apply liên tục chứa trust review messages nhưng không có batching hay sticky approval model.
- How it would damage trust: Operator mệt vì review, bắt đầu bỏ qua warnings hàng loạt, làm trust UX phản tác dụng.
- Mitigation: Batch trust review trong preview, hỗ trợ explicit approval receipt theo pack/version/release, và chỉ nhắc lại khi trust delta đổi.
- Test that should exist: Multi-pack install/update preview snapshot với cả official và external packs phải vẫn đọc được trong một lần review.
- Disposition: `defer-with-guard`

### U3. Legacy install state chưa có migration story đủ rõ

- Evidence class: `repo-grounded`
- Severity: `High`
- Likelihood: `High`
- Affected subsystem: `doctor`, `installer`, install-state compatibility
- Likely trigger: User nâng cấp từ state cũ không có trust receipt.
- User-visible symptom: `doctor` cảnh báo `legacy install state without trust receipt`, nhưng không nói rõ cần reinstall, reverify, hay update là đủ.
- How it would damage trust: Backward compatibility trở nên mù mờ. Operator không biết state hiện tại có đủ tin cậy để update tiếp hay không.
- Mitigation: Một legacy migration lane rõ ràng với doctor verdict riêng và remediation path cụ thể.
- Test that should exist: Legacy install state fixture phải có expected doctor output, update behavior, và post-migration trust receipt state.
- Disposition: `phase-blocking`

## Integration Risks

### I1. `checksums.json` được sinh ra nhưng chưa được verify ở đường quyết định

- Evidence class: `repo-grounded`
- Severity: `Critical`
- Likelihood: `High`
- Affected subsystem: `packages/core/spec-core/src/release-trust.js`, release verification flow
- Likely trigger: Artifact bị tamper hoặc checksum set stale, nhưng signatures vẫn verify trên manifest/metadata.
- User-visible symptom: `verifyReleaseTrustBundle` vẫn pass dù checksum set không được đọc hoặc enforced.
- How it would damage trust: User tưởng Phase 10 có checksum integrity, nhưng checksum thực ra chỉ là file đi kèm không tham gia verdict.
- Mitigation: Verify checksum set completeness và digest match cho mọi file trong trust bundle; fail trên file thiếu, file dư, hoặc digest mismatch.
- Test that should exist: Sửa nội dung file trong trust bundle hoặc thêm file bất ngờ phải làm verify fail.
- Disposition: `phase-blocking`

### I2. Update gate chưa coi support-evidence regression là blocking trust event

- Evidence class: `repo-grounded`
- Severity: `High`
- Likelihood: `Medium`
- Affected subsystem: `buildTrustDelta`, update safety lane
- Likely trigger: Pack update làm runtime support từ `supported` xuống `partial` hoặc `unverified`, nhưng không đổi capability hoặc trust tier.
- User-visible symptom: Update vẫn apply được dù support claim yếu đi materially.
- How it would damage trust: Upgrade safety bảo vệ capability escalation nhưng chưa bảo vệ claim regression quan trọng cho operator.
- Mitigation: Chia rõ support regression nào là hard gate, support regression nào là hard-ask, và show trong preview như trust delta thật sự.
- Test that should exist: Update fixture bỏ `evidence_ref` hoặc hạ runtime status phải produce blocking hoặc explicit re-review gate.
- Disposition: `defer-with-guard`

### I3. Rollback hiện khôi phục filesystem tốt hơn là khôi phục operator trust understanding

- Evidence class: `repo-grounded`
- Severity: `Medium`
- Likelihood: `Medium`
- Affected subsystem: rollback journal, install/update UX, doctor follow-up
- Likely trigger: Update fail giữa chừng, rollback thành công, nhưng trust bundle hoặc metadata kỳ vọng của user đã đổi.
- User-visible symptom: Files quay lại trạng thái cũ, nhưng operator không biết trust state có còn hợp lệ hay cần re-run doctor.
- How it would damage trust: Rollback “thành công” về mặt kỹ thuật nhưng mơ hồ về mặt operational trust, dễ làm support tickets khó triage.
- Mitigation: Sau rollback phải in rõ trust follow-up bắt buộc, hoặc doctor auto-rerun trong failure path.
- Test that should exist: Failed update with rollback must emit post-rollback trust guidance and preserve prior trust receipt state deterministically.
- Disposition: `defer-with-guard`

### I4. Nếu SBOM/provenance không đi vào lint/doctor/install/update thì chúng chỉ là release theater

- Evidence class: `plan-grounded`
- Severity: `High`
- Likelihood: `High`
- Affected subsystem: release pipeline, `doctor`, `lint`, `installer`
- Likely trigger: CI sinh `sbom.json` và provenance files nhưng không command nào đọc chúng.
- User-visible symptom: Artifact set phình ra nhưng verify fail không bao giờ chặn install/update hoặc doctor.
- How it would damage trust: False sense of maturity. Maintainer gánh release ceremony nhưng operator không nhận thêm trust signal thật.
- Mitigation: Mỗi artifact class mới phải map được vào ít nhất một verdict path và một remediation path.
- Test that should exist: Doctor/lint phải degrade rõ ràng khi metadata bắt buộc bị thiếu hoặc invalid.
- Disposition: `defer-with-guard`

## Ecosystem Abuse Scenarios

### X1. Local trust policy có thể bị dùng như hidden marketplace allowlist

- Evidence class: `drift-risk`
- Severity: `High`
- Likelihood: `Medium`
- Affected subsystem: local trust policy, install/update/doctor UX, pack ecosystem governance
- Likely trigger: Team chia sẻ `.pairslash/trust/trust-policy.yaml` với external publishers và xem đó là “official enough”.
- User-visible symptom: Nhiều pack external cùng hiện lên như trusted trong môi trường nội bộ mà không có product-level review boundary.
- How it would damage trust: PairSlash bị kéo thành plugin bazaar bằng local allowlists ngầm, đúng điều Phase 10 framing cấm.
- Mitigation: Hiển thị trust source là local policy; không có registry UX hay badge nào khiến local allowlist trông như public PairSlash endorsement.
- Test that should exist: Doctor/support bundle phải chỉ ra pack nào được trust bởi local policy override thay vì shipped policy.
- Disposition: `defer-with-guard`

### X2. External pack có thể “wash” compatibility claim bằng metadata tồn tại chứ không phải evidence mạnh

- Evidence class: `repo-grounded`
- Severity: `High`
- Likelihood: `High`
- Affected subsystem: trust descriptor semantics, runtime support claim evaluation
- Likely trigger: Publisher external thêm evidence ref sống trên disk hoặc URL, rồi tự claim `supported`/`partial`.
- User-visible symptom: Lint/install không block đủ mạnh, pack xuất hiện có vẻ compatibility-backed.
- How it would damage trust: Pack ecosystem abuse phá claim ladder từ rất sớm, khiến `verified external` biến thành “metadata-rich external”.
- Mitigation: Không cho trust descriptor tự đủ sức nâng claim nếu chưa có verified evidence substrate riêng.
- Test that should exist: External pack với evidence placeholder phải giữ `resolved_status` thấp và UX phải nói claim not substantiated.
- Disposition: `phase-blocking`

### X3. Initial install của non-core high-risk pack vẫn còn cửa đi qua bằng review chung

- Evidence class: `repo-grounded`
- Severity: `High`
- Likelihood: `Medium`
- Affected subsystem: install preview/apply, trust tier capability enforcement
- Likely trigger: Non-core pack có `repo_write` hoặc `shell_exec` được đưa vào ecosystem sớm.
- User-visible symptom: Preview cho thấy pack “reviewable” thay vì “out of policy”.
- How it would damage trust: External ecosystem dần có quyền ngang core chỉ vì operator đã quen bấm qua review.
- Mitigation: High-risk capability phải là policy boundary, không chỉ là trust-review boundary.
- Test that should exist: Initial install của non-core pack với capability high-risk phải hit deterministic policy verdict khác read-only packs.
- Disposition: `phase-blocking`

## Regression Risks

### R1. Runtime parity mismatch có thể nặng hơn khi trust verifier ship không đồng đều

- Evidence class: `drift-risk`
- Severity: `High`
- Likelihood: `Medium`
- Affected subsystem: `installer`, `doctor`, compat matrix, runtime-specific UX
- Likely trigger: Một runtime lane được siết verifier hoặc metadata requirement trước lane còn lại.
- User-visible symptom: Codex và Copilot nhận verdict khác nhau cho cùng trust posture vì implementation drift, không phải vì evidence drift.
- How it would damage trust: User nhìn thấy “two-runtime discipline” bị phá bởi Phase 10 chứ không phải do runtime vendor.
- Mitigation: Cross-runtime trust UX snapshots và parity tests phải đi cùng mỗi verifier change.
- Test that should exist: Same pack, same trust tier, same missing metadata phải cho semantics tương đương trên cả Codex và Copilot nếu khác biệt không được evidence justify.
- Disposition: `defer-with-guard`

### R2. Nếu trust artifacts bị đẩy vào install roots, ownership-safe uninstall/update sẽ hỏng

- Evidence class: `drift-risk`
- Severity: `Critical`
- Likelihood: `Medium`
- Affected subsystem: installer ownership model, uninstall/update safety
- Likely trigger: Phase 10 cố đưa signature/SBOM/provenance files vào runtime install directories thay vì giữ ở release bundle hoặc `.pairslash`.
- User-visible symptom: Uninstall/update bắt đầu chạm vào footprint ngoài PairSlash-managed files hoặc gây orphan/conflict mới.
- How it would damage trust: Phase 10 phá đúng invariant mạnh nhất của PairSlash Phase 4-9: preview-first, ownership-safe mutation.
- Mitigation: Giữ mọi trust metadata ngoài runtime install roots trừ khi ownership contract được mở rộng rất rõ và có rollback test tương ứng.
- Test that should exist: Install/update/uninstall with trust metadata must preserve PairSlash-owned-only semantics and local override safety.
- Disposition: `phase-blocking`

### R3. Verification everywhere có thể làm chậm product mà không tăng credibility thật

- Evidence class: `drift-risk`
- Severity: `Medium`
- Likelihood: `High`
- Affected subsystem: `/skills`, `install`, `doctor`, `lint`, `preview`
- Likely trigger: Mọi command đồng bộ verify artifact sets lớn hoặc remote-looking metadata trước khi trả verdict.
- User-visible symptom: `install`, `doctor`, `lint`, hoặc preview chậm hơn đáng kể, trong khi output trust vẫn mơ hồ.
- How it would damage trust: Phase 10 rơi đúng failure mode “làm chậm product mà không tăng credibility thật”.
- Mitigation: Verify chỉ trên selected packs, cache digest results theo bundle, và không thêm remote dependency vào default lane.
- Test that should exist: Performance smoke cho install/doctor/lint với nhiều packs trước và sau verifier changes.
- Disposition: `defer-with-guard`

## Must Fix Before Coding

| Issue | Why this must be fixed first | Required closure |
| --- | --- | --- |
| `A1` | Không có release gate thật thì release integrity chỉ là narrative | Add mandatory release-trust build+verify lane vào release-readiness |
| `A2` | `core-maintained` self-attestation phá core trust boundary | Move core tier authority sang central registry hoặc equivalent release-controlled source |
| `A3` | Support truth split sẽ sinh claim drift ngay khi bắt đầu hardening | Unify doctor + compat matrix on one machine-readable support source |
| `T1` | Evidence giả có thể được tính là evidence thật | Tighten evidence semantics; URL/file existence alone must not satisfy support proof |
| `T2` | Non-core packs vẫn có đường lấy high-risk capability | Define and enforce capability matrix by trust tier |
| `E2` | Docs đang nói mạnh hơn code trong chính phase release trust | Align docs to real gate or implement the gate first |
| `E3` | Signed/verified dễ bị hiểu nhầm là live-supported | Separate release verification from support evidence in all default UX |
| `U3` | Legacy installs sẽ thành vùng mù backward compatibility | Define explicit migration path and doctor verdict for legacy trust state |
| `I1` | Checksum artifact chưa tham gia verdict | Enforce checksum verification and completeness |
| `X2` | Ecosystem claim laundering sẽ làm hỏng claim ladder từ đầu | Require stronger evidence substrate before external support claims can rise |
| `X3` | Initial install của high-risk non-core pack còn quá mềm | Make high-risk capability a policy boundary, not only a review boundary |
| `R2` | Ownership-safe lifecycle là invariant cốt lõi không được phá | Keep trust artifacts out of install roots unless ownership contract is explicitly extended and tested |

## Can Proceed With Guards

| Issue | Guard required while coding | Failure if guard is ignored |
| --- | --- | --- |
| `A4` | Không generate artifact class mới nếu chưa có reader path + gate | Ceremony tăng, operator trust không tăng |
| `T3` | Always label local trust as local policy only | External trust bị nhầm thành product trust |
| `T4` | Keep `local-dev` wording sharp and non-promotional | Vendored packs bị đọc như ecosystem-supported |
| `E1` | No public signed-release claim until keyring and ops are real | Public trust root không tồn tại |
| `E4` | `publisher-verified` must never read like PairSlash support | Support-claim overreach |
| `U1` | Canonical remediation text per verdict class | Verify fail gây operator confusion |
| `U2` | Batch approvals / sticky review receipts | Review fatigue làm trust UX vô hiệu |
| `I2` | Support regressions must at least hard-warn in preview | Upgrade safety chỉ bảo vệ capability, không bảo vệ trust posture |
| `I3` | Post-rollback trust recheck guidance must be mandatory | Rollback xong nhưng operator không biết trust state |
| `I4` | SBOM/provenance only after command integration exists | Artifact theater |
| `X1` | Surface local allowlists explicitly in doctor/support bundle | Hidden marketplace drift |
| `R1` | Add cross-runtime parity tests for trust UX | Runtime parity mismatch do implementation drift |
| `R3` | Add performance smoke before broad verifier rollout | Product chậm hơn mà credibility không tăng |

## Do Not Build In Phase 10

| Do not build | Why it should stay out | What it would break |
| --- | --- | --- |
| Default-on remote trust verification | Trái local-first và explicit-first | Operator clarity, offline behavior, trust legibility |
| Hidden telemetry or background scanning | Phase framing đã cấm rõ | Core product trust and security process honesty |
| Trust score / reputation feed for packs | Đây là bazaar/governance drift | Bounded trust model |
| Third runtime support | Phase 10 không phải scope expansion | Two-runtime discipline |
| SBOM/provenance artifact sprawl without verifier path | Chỉ tăng ceremony | Credibility and usability |
| External packs with core-equivalent capability defaults | Kéo core trust xuống thấp | Pack ecosystem boundary |
| Silent trust promotion from local-dev to official-like states | Phá explicit-first | User mental model and auditability |
| Install-root mutation for trust metadata without ownership contract | Phá uninstall/update invariants | Ownership-safe lifecycle |

## Final Go / No-Go Conditions

`No-Go` nếu còn bất kỳ điều nào sau đây:

- Release-readiness chưa gate release trust thật.
- `core-maintained` vẫn là pack-local self-claim.
- Support truth còn tách đôi giữa `doctor` và compat docs.
- Evidence presence vẫn có thể được satisfy bằng URL hoặc file tồn tại đơn thuần.
- Checksum verification chưa tham gia verdict.
- Legacy install state chưa có migration/remediation path rõ.
- Signed/verified wording vẫn có thể bị đọc như live support claim.
- High-risk non-core capability chưa có policy boundary rõ.

`Conditional Go` chỉ khi:

- Tất cả phase-blocking items ở trên đã được đóng bằng code + tests.
- Public claim tạm thời vẫn bị giới hạn ở “implemented” hoặc “deterministic-lab backed” nơi evidence chưa live-backed.
- Phase 10 artifacts mới không làm nặng `/skills`, `install`, `doctor`, `lint`, `preview`, hoặc `trace`.
- Third-party trust vẫn thấp hơn core trust cả trong policy lẫn UX.

`Go` chỉ khi:

- Release integrity, pack trust, upgrade safety, và security process đều có machine-readable gates thật.
- Claim ladder được enforce thống nhất qua docs, CLI, tests, và support process.
- Degraded mode luôn có remediation text rõ, không mơ hồ.
- PairSlash vẫn giữ nguyên thesis cốt lõi: trust layer cho terminal-native AI workflows, hai runtime, `/skills`-first, explicit-write-only, không hidden write, không silent fallback.
