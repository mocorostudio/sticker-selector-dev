# Work-efficient crop workflow

Use the existing crop-v9 batch processor for automatic cropping and pixel checks. Preserve its per-item persistence for recovery. Do not repeat full regression suites for each image batch unless code or environment changes. Keep visual inspection, candidate-master matching, and formal handoff gates separate from draft selection. Never report draft transfer as technical approval or verified Drive saving.

This document does not change runtime behavior or existing data.

## 2026-11-04 bounded investigation and implementation

Confirmed from code (not historical Work telemetry):
- crop-v9 already queues up to 20 source sheets, processes serially, checkpoints each sheet, and offers failed-only retry. Its draft transfer uses chunks of 16 inside one app action. These are internal operations, not 81 Work commands.
- Source and formal Drive writers already verify real file IDs, parent folders, size and SHA-256, with content download fallback when Drive omits checksums. Retain sequential writes, resumable journals and readback; do not replace them with per-image assistant saves.
- The automatic-inspection button previously rescanned every image and appended history. Reinspection retained checks but dropped reviewedAt, which auditedCandidateBinding requires. This could cause an avoidable formal-handoff stop; historical incidence is unknown.
- importCrops rejected more than 64 entries. Normal draft transfer chunks masked this limit, but direct 81-entry verified handoff could not work. Limit is now 130, matching the documented approximate selection capacity.

Changes: automatic button processes only missing/stale hash+candidate evidence; explicit automaticInspection retains reviewedAt only for unchanged image hash and candidate identity. Changed bytes/candidate/phrase/pose still invalidate review. No automatic visual approval was added. Formal sender still requires explicit nine-cell mapping per batch; this change does not provide an end-to-end autonomous 81-candidate formal sender.

Verification: 48 relevant Node checks passed; 11 existing order/ZIP checks passed after making preinstalled jszip available. Added tests cover reviewedAt preservation/invalidation and an 81-entry real CRC-valid synthetic PNG handoff followed by a zero-new-writes retry with votes preserved. Synthetic test PNGs are not Shimaenaga artwork or artistic inspection evidence. Browser test launch stopped before execution because Chromium is absent. Real authenticated Drive, deployed UI, iPhone and a single continuous real-artwork roundtrip remain unverified.

Work operation estimate (planning, not measured quota): one input/master preflight, one app batch start, nine sheet-level visual reviews (with actual individual-image detail only for ambiguities), one summary and one grouped save/check = about 13 orchestration stages for 81 candidates, plus anomalies. Current formal mapping/sending remains nine batch-level UI interactions plus any required individual visual-check recording; do not claim 13 browser clicks or a measured quota reduction. User choices remain desired images, main/tab and final adoption; app Google authorization may require one user sign-in if no assistant-side session exists. Do not silently fall back to 81 assistant-operated saves.

No Work execution telemetry was available. Attribution of the reported 30% to browser manipulation, repeated master reads, regressions, retries, timeout or extra development cannot be established from this investigation. No production images, votes, masters or history were changed.

## Per-image visual report import (2026-11-04 continuation)

The technical-inspection dialog now offers a detailed JSON report import. This is an operator-facing advanced path, not a new user production step. `inspection-report.mjs` accepts up to 130 separate decisions and performs preflight for every entry before a single state save. It checks exact imageId, inspectionIdentity, PNG SHA-256, explicit nine boolean checks, reviewer, reviewedAt and decision/reason. Machine QA is computed by the existing inspector. It never assigns candidates or promotes formal eligibility. Fail/review revoke existing formal eligibility as in individual inspection. Votes, comments, crop data, artwork edits and user history are untouched. Same report retry adds no history or save; save failure restores all modified fields.

Report shape: `{schema:"animal-stickers-visual-report/v1",reviewer:"reviewer identifier",entries:[{imageId,identity,sha256,reviewedAt,decision,checks,comment}]}`. identity is the exact `inspectionIdentity(item)` string; checks follow exported visualChecks order. Decisions must result from actual visual inspection of the exact PNG; neither an all-pass template nor machine QA is visual evidence. A mixed pass/review/fail report is supported. Candidate mapping must already be staged against the latest master; this import does not replace live-master checks at formal registration. No artwork report was fabricated or applied during development.

For 81 candidates, this replaces up to 81 individual inspection-save actions with one report import (plus one file selection). Visual review, nine-cell master mapping and grouped formal Drive registration remain required. Actual Work quota savings have not been measured. Test fixtures use synthetic pixel buffers; browser wiring, real artwork, authenticated Drive, deployment and iPhone are not certified by these Node tests.
