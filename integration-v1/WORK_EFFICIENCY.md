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
