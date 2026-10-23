# Integrated development review 2026-10-23

Canonical source: `mocorostudio/sticker-selector-dev`, branch `development`,
directory `integration-v1`. Quality fixes from `mocorostudio/sticker-selector`
development `7e26a13` are integrated with original source-save functionality
from this repository's `1644379`.

Entry: https://mocorostudio.github.io/sticker-selector-dev/integration-v1/workflow.html

New batches show only their current images without deleting older PNGs or votes.
Local draft confirmation verifies the current rating and comment. Uninspected
PNG export and application-set promotion are blocked, including cached exports.
The destructive local reset control is removed; existing storage keys are preserved.
The create-only original PNG saving section remains available and independent.

Current tests: 60 Node tests; eight Chromium phone selection scenarios; source
save/readback/idempotent retry -> nine crops -> draft voting -> reload; and a
two-batch history-retention and crop-editor regression. A private actual-source
test produced nine 370x320 PNGs, all with boundary warnings and no technical
approvals or user ratings. No private PNGs, source IDs or generated test output
are committed. No real Google writes were made by browser tests.

The local Chromium run uses an optional `CHROMIUM_EXECUTABLE` because the standard
browser archive download was truncated. WebKit and physical iPhone are not
verified locally. CI continues to request both standard browser engines.

Formal production readiness remains incomplete: per-character live master
mapping, full visual technical-review controls, verified `00_選抜待ち`
registration and cross-device synchronization. Local draft voting is not formal
v9 selection. Original-save completion is separate from technical approval.

## Historical implementation notes

# Crop and selection test

Source fb85ff6, 2026-10-21. Entry: workflow.html. User-approved update: audited boundary-only review; up to 20 sequential source images; IndexedDB v2 separates pixel assets from metadata; 16 cards per page; saved Drive ID/version progress and an unprocessed filter; per-image checker/black/white buttons. Existing images, IDs, review history and source files are retained.

Drive transport remains readonly. Tokens stay in memory. No billing settings or production writes. Progress is local to this browser. Standard technical failures cannot be overridden; all visual checks and candidate verification remain necessary. Metadata/PNG handoff rechecks pixels.

93 local automated tests passed. Synthetic browser migration fixture: tests/storage-browser.html (only its own test database). Physical iPhone memory limits and live Drive 20-image workflows still need confirmation.


## Numbered overview and selection drafts

The crop screen now shows numbered crop outlines and transfers the latest visible images together into selection without candidate mapping or individual approvals. Selection drafts retain technical warnings and never claim technical approval. Each selection card can return to its crop editor; corrected PNGs keep the slot number, retain previous images and votes in history, and start unrated.

Validation: 111 Node tests and syntax checks passed. The updated Chromium/WebKit regression scenario could not run in this workspace because browser executables are unavailable. Physical iPhone testing remains pending.

## 2026-10-23: original 3×3 PNG saving

Development source: `mocorostudio/sticker-selector-dev`, branch `development`, directory `integration-v1`. Published entry observed returning HTTP 200: https://mocorostudio.github.io/sticker-selector-dev/integration-v1/workflow.html . No main-branch changes.

The crop screen now has an expandable **3×3元画像PNGをDriveに保存** section. Reuses the original PNGs selected in the existing file input. Enter the character folder URL, connect the saving Google account, then explicitly save. The existing Drive reader remains read-only. Saving uses the existing OAuth client with Drive scope to inspect pre-existing character folders and create new files; tokens stay in memory. This action does not run automatically when cropping.

`source-save.mjs` validates PNG headers, limits, hashes and the unique `03_元画像・生成履歴` child. The UI additionally decodes every PNG before writing. Every original is uploaded unchanged, separately, with a content-addressed filename. Duplicate input bytes are collapsed. Existing matching originals are verified and reused. No source/history overwrite, move, delete or master edits exist in this transport. A reserved file ID is saved before upload; retries reconcile that ID, including HTTP 409. Each completion requires metadata, actual SHA-256, folder listing/count/duplicate and ID readback. Per-file verified results and immutable local reports include file ID, original filename, checksum, folder and time. Partial failures retain verified rows and mark the remainder unverified. Browser Web Locks prevent simultaneous saves on the same origin. Cross-device simultaneous writes are not distributed-locked; a duplicate detected on readback stops completion without deleting either file.

Saving is independent of cropping, technical inspection, selection and application submission. A 3×3 layout is a declared input setting, not semantic detection of the image's nine designs. Visual quality, text identity, missing limbs and style consistency still require inspection. Existing draft handoff remains available with technicalStatus `review`; it is not technical approval and is not registration in `00_選抜待ち`.

Validation: `npm test` covers existing tests plus original-save REST fault fixtures and crop/QA gate checks. `npm run test:integration` adds Chromium/WebKit mobile scenarios for byte-preserving original save, retry, nine crops, automatic QA with visual checks pending, draft selection and reload. Synthetic fixtures make no Google requests. Local Playwright browser installation failed due to a truncated download; physical iPhone, real OAuth and actual Drive saves remain unverified until separately observed. No real Drive file IDs or production PNGs were added during implementation.
