# v9 development status

All implementation changes belong to `development`. `main`, live PNGs, animal masters and production Drive are unchanged. No Pages deployment workflow is added.

## One supported entry point

`index.html` uses `app.mjs`, `app.css`, `selection-core.mjs` and `sync-engine.mjs`. The previous thirteen experimental pages now redirect here; their original implementations remain in Git history (baseline `89410de`). This removes stacked event-handler replacements and multiple independent write workflows.

The primary phone actions are **未選抜を読み込む** and **選抜確定・Drive同期**. File import, backgrounds, bulk rating and JSON/CSV export are under an expandable panel. Existing localStorage/IndexedDB keys and existing image identities remain in place. Newly imported local images use a content hash; identical legacy blobs reuse their original ID. Local imports do not receive candidate/attempt IDs or technical approval by inference.

## Safe development transport

The ordinary entry point has **no enabled real Drive write transport**. The isolated `?drive=test` entry is described below. The default UI explains that real Drive integration is unavailable; local PNG/ZIP selection works. For a functional mock preview:

```sh
npm ci
npm run dev
# Open the printed localhost URL with /?mock=1
```

The mock HTTP server binds to localhost, stores only synthetic records in process memory and resets on restart. The engine treats that remote state independently from browser storage, so browser reload tests exercise resumable synchronization. Tests block all external requests except a fulfilled, local JSZip script fixture; no Google login/token/production IDs are used.

## Identity and synchronization contract

Records require `imageId`, `candidate`, `attemptId`, `driveFileId`, `filename`, `technicalPassed`, `folder`, rating, comment and confirmation. Candidate IDs can repeat across attempts; image IDs and Drive IDs cannot. A defective record fails individually. An explicit confirmation is required before adapter IO that writes.

The shared engine verifies the file, writes and reads back an independent journal event, moves only when required, reads back the file, saves and reads back the rating, then completes and verifies the journal. Stable operation IDs include a user-edit revision, preserving o → h → o histories while preventing retries from adding duplicate events. Lost responses after any write are retried using the same operation ID. Previously confirmed ratings alone do not prove that a completion history exists.

Production v9 policy: o → adopt; h → hold; x retains its current PNG folder and saves history only. `testReject` routes x to reject **only on a mock adapter**. There is no PNG delete or upload endpoint.

## Validation

```sh
npm test
npx playwright install --with-deps chromium webkit
npm run test:browser
```

CI runs on pushes to development and on PRs. Playwright uses a 390×844 touch viewport in Chromium and WebKit, tests actual decoded PNGs, ratings/comments/background retention, reload, confirmation gating, partial failures, history idempotency, corrupt PNG isolation and 130-image ZIP import/reimport/export. This is browser emulation, not proof of behavior on a physical iPhone.

## Remaining integration work

- Validate the new isolated real Drive adapter against Google after preview hosting and OAuth origin setup. Production adapters, mutable master updates and distributed conditional writes remain out of scope.
- Map the live v9 animal master schema and technical-pass evidence before connecting real PNGs. The supplied v3 workbook was inspected read-only: it contains 116 candidates and history templates, but it does not establish live v9 image/Drive IDs, attempt mappings or technical approvals. No personal workbook contents are committed.
- Test real Google authorization, access limits and readback using isolated test folders before production activation. Production testing requires separately authorized scope.
- Add cross-device conflict handling before enabling a real adapter. Current UI prevents overlap in the same page; the mock journal is not a production distributed lock.
- Check physical iPhone Safari and storage eviction behavior. Export JSON regularly; browser storage is not a durable backup.
- ZIP parsing depends on pinned JSZip 3.10.1 from a CDN in the UI. CI supplies identical local bytes; offline ZIP import and ZIP expansion limits remain to be improved.

## 2026-10-20: isolated real Drive connection

`/?drive=test` now enables `GoogleTestDriveAdapter` and Google Identity Services. The ordinary URL still has no real Drive transport. The scope is `drive` because these pre-existing test files must be read and moved; the app itself enforces a fixed three-PNG allowlist, a fixed test root, and three verified test subfolders. No arbitrary file/folder configuration is accepted. OAuth client ID is public; access tokens remain in closure memory and are never stored or exported. The disconnect control clears the in-memory token.

The three fixtures already have legacy evaluations. This screen deliberately permits their re-evaluation as synthetic test data, and labels the action **テスト画像を読み込む**. It does not mark test PNGs as production technical passes. The technical gate permits only an explicit isolated-test fixture flag on this test adapter; ordinary uninspected PNGs still fail.

Legacy test master A:J and its previous evaluation history are read-only in this adapter. New evaluations are independent JSON records in the existing test root. Every operation has immutable `prepared`, `result`, and `complete` files. Pre-generated Drive file IDs and the exact pending request payload are saved locally before upload. A lost response retries the reserved file ID and verifies its bytes; HTTP 409 is reconciled by reading that ID. No JSON or PNG is deleted or replaced. The `result` files provide the separate test evaluation state; connecting production master updates remains out of scope.

Browser Web Locks prevent two tabs in the same origin from synchronizing simultaneously. This does **not** provide a distributed lock across devices: use a single device for the real test. Concurrent real users and production conflict resolution remain unsupported. Lost browser storage plus delayed Drive search may still require manual reconciliation; do not discard browser data during an unfinished upload.

Additional automated coverage uses a REST-shaped Google fixture with the same endpoints, metadata/ancestry checks, multipart uploads, reserved IDs, HTTP 409 recovery, independent journals and legacy master preservation. Browser tests stub Google's consent callback and intercept Google API calls, so these tests cannot be reported as real Google authorization or real API writes.

### iPhone test entry and hosting prerequisite

1. Serve the development tree on a dedicated development URL. `main` and the existing production Pages deployment must remain unchanged.
2. The development URL's HTTPS origin must be listed in this OAuth client's authorized JavaScript origins. Same-origin module loading and the Google Identity script must be allowed. An arbitrary shared raw-file viewer is not a suitable OAuth host.
3. Open `index.html?drive=test` in Safari. Read the scope, authorize Google, load the three synthetic images, choose ratings, and explicitly confirm sync. Verify the displayed counts and the independent test journal, then retry to confirm no duplicates.

A separate preview host and its OAuth origin configuration are not created by this commit. The existing production Pages origin cannot expose this development branch without changing its deployment. Actual login, browser-to-Google communication and physical iPhone behavior remain unverified until the isolated preview is available.

## 2026-10-20: shared-origin storage correction

The isolated preview is now served from the separate `sticker-selector-dev` repository. Real-device testing exposed that GitHub Pages projects share an origin: the preview loaded 39 pre-existing records, displayed seven unrelated images and rejected `v9_test_03.png` with an existing-ID mismatch.

Real Drive test mode now uses dedicated localStorage, visible-ID and IndexedDB namespaces scoped to its path. Original keys are read-only and remain intact. Only drafts already matching all registered image/candidate/attempt/Drive IDs and the filename are copied; ambiguous old items are preserved at their source and the registered test PNG is loaded afresh. Ordinary local-import mode retains the original keys.

Synchronization now reports per-image progress. Within one confirmed run, immutable journal bytes are reused only after actual readback; verified static folder/master reads are also reused. Every run starts fresh and releases the cache afterward. PNG metadata and actual upload readbacks remain checked, and retry/fault tests remain required. This reduces repeated Google reads without treating unverified work as complete.

Browser regression tests seed 39 legacy records, including the exact conflicting image ID, and verify that old ratings remain byte-for-byte unchanged, unrelated images stay out of the test view, valid drafts are recovered, and PNGs decode successfully. Physical-device confirmation of the revised screen remains a separate check after deployment.
