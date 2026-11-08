# Issue 9 — PNG density and ZIP readback

Scope: `development`, `integration-v1`. No production votes, source PNGs, candidate IDs, old ZIPs or `main` are rewritten.

## Sources read on 2026-11-08

- Connected Drive: 制作ルール v10, full text (10,576 characters), modified `2026-11-08T00:44:31.437Z`, including section 12.
- Connected Drive: 制作手順書 v3, full text (15,669 characters), modified `2026-11-08T00:44:32.094Z`, including section 15.
- Connected Drive: ダジャレたぬき_Master_v1_243案＋予備31案, spreadsheet text, modified `2026-11-08T03:18:55.735Z`; the saved G1 workspace was also read to bind the actual 40 images by SHA-256, rather than assuming master order.
- LINE official static sticker requirements: https://creator.line.me/ja/guideline/sticker/ checked 2026-11-08. PNG, RGB, transparent background, at least 72 dpi, each image <=1 MB, ZIP <=60 MB; main 240×240, tab 96×74, stickers <=370×320. This project's output remains exactly 370×320 and 8-bit RGBA. Indexed/interlaced/other bit-depth files fail closed instead of being silently redrawn.

## Changes and save paths

- `submission-validation.mjs`: shared metadata normalization and independent byte-level validation. Checks PNG signature, chunks and CRC, actual IHDR dimensions/color/bit depth, pHYs 2835×2835 pixels/meter (72.009 dpi), inflated scanline filters and actual visible/zero-alpha pixels, byte limits, ZIP CRC/headers, exact names/counts and ordered identity hashes.
- `submission-zip.mjs`: every normal export, with or without main/tab, now normalizes all PNGs; validates entries before packaging and reopens the ZIP afterward. Existing technical-review gates and transparency finishing remain in force.
- `drive-export.mjs`: validates before writes; always downloads and unpacks the saved ZIP, even when Drive supplies a checksum. Verifies folder/ID/listing/duplicates and records per-image hashes and latest artwork identity in the returned save evidence. Same-operation concurrent saves coalesce; deterministic ZIP lookup recovers uploads with a lost response or a fresh local journal. Failures cannot return save success.
- `reorder-finished.html`: uses the same PNG/ZIP validation, checks all image capacities, revalidates downloaded/reused ZIPs, rejects duplicate names and ambiguous targets, keeps a local verification record keyed by the resulting Drive file ID. Original order/undo/archive storage keys remain unchanged.
- Updated import versions prevent stale cached export modules after a reload. No automatic reload or reset of a currently open user session is performed.

## Actual Drive verification

New ZIP (the deliverable for this change):
https://drive.google.com/file/d/1j0jOsH4p2wuoBqX1AhJ39q8YSkjAyCwL/view?usp=drivesdk

- Name: `DJT21_P01_40_main_tab_72dpi_issue9.zip`
- Parent: `21_ダジャレたぬき/04_申請用`, folder ID `1pbw0eQX749d73kA0enmrhKSjF5rq_pIP`
- Bytes: 3,631,712
- ZIP SHA-256: `eccd2549a6db2f59e312da66f043a1e579e5968053b58384418ec4ab454a2802`
- Exactly `01.png`–`40.png`, `main.png`, `tab.png`; all 42 pass dimensions/RGBA/actual alpha/72 dpi/capacity checks.
- Downloaded again using the connected Drive tool; independently decoded with Pillow. All 42 RGBA pixel arrays exactly equal the source. Only density metadata and ZIP packaging changed. Source image order was retained; the first 40 source hashes were uniquely bound to saved workspace image/candidate IDs.
- Main matches standalone source file `1SSdMbCXoAzyqDVtqKVNRoSwyLXtut45i`; tab matches `1rB0lvH9kNIJcop4p6zY-Xk8ndq-3IqaZ` (decoded pixel equality).
- Same-name duplicate count 0; duplicate sticker image hash count 0. Original preview ZIP `1xAIgLhd4Z7fXFQlQso42cavscx3-lwAj` remains. Another `72dpi_20261108.zip` appeared during this task; it was not changed or deleted.
- Actual transport used the connected Drive tool, not an authenticated app browser session. The two app save routes are tested with isolated mock Drive; this distinction is intentional.

Detailed 42-image evidence, identity mapping, source/output hashes and real readback:
https://drive.google.com/file/d/1cFZAWsp6-a_xx7RbzePGMAkc6C6Niue7/view?usp=drivesdk
Saved under `03_元画像・生成履歴`, verified by file metadata readback.

## Tests and remaining verification

- Local `npm test`: 316/316 passed before integrating the concurrent upstream review-variant change. After integrating upstream `dc1cf6e`, all 329/329 tests passed (28.86 seconds). After upstream group-two support, GitHub Actions passed all 332/332 tests and the existing browser suite.
- Focused tests cover normal vs reorder normalization, all 42 images, absent/present density, damaged PNG/ZIP CRC, wrong dimensions, opaque/empty alpha, capacity limits, identity mismatch, actual readback despite server checksum, wrong folder, upload/readback failure, duplicate listing, lost response, repeat/concurrent save and fresh-journal resume. Existing votes/order/artwork/history preservation assertions remain.
- New `tests/submission-bytes-browser.mjs` runs the real reorder phone UI with isolated mock Drive in Chromium and WebKit. `submission-bytes-browser.mjs` also runs the actual normal export/Drive-save pipeline on both engines, including 42 real PNGs, identity/order, latest artwork, readback, duplicate prevention and draft preservation. The complete normal screen is tested on Chromium. An attempted broader WebKit preference-screen test encountered temporary blob-URL access errors before the ZIP stage; it is not claimed as passed.
- Local Chromium could not start: the execution environment denies its process-singleton socket. No local browser result is claimed. GitHub Actions results are reported separately.
- Physical iPhone Safari and authenticated app OAuth/Drive writes were not tested. The user need not redo selections or manually test to preserve the work.
- No manual hosting configuration was changed. The standard GitHub Pages deployment for the development commit completed successfully; direct public-page inspection was unavailable in this environment.
