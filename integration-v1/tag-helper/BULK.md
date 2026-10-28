# Batch tag editor experiment

The user verified one-image tag addition and persistence after reopening on
iPhone Safari on 2026-10-28. This does not establish bulk navigation support.
Bulk navigation selectors are provisional and must be tested on two images
before enabling the remainder. No paid API, authentication read, external
loader, review submission or publication action is used by the bookmarklet.

This implementation accepts at most 40 unique numbered rows and retains the
existing tag union (up to nine). Each row is applied once and checked after
navigating away and back with the editor controls. That is UI readback, not an
independent query of LINE server storage. Unknown layouts, unsupported tags,
selection conflicts, mismatches and timeouts stop the job. There is no fallback
to automatic retries or deletion of existing tags. Failure may leave a partial
autosaved selection, which is recorded as pending and checked before resuming.

The first run processes at most two rows. The rest require another explicit
button press. Session storage keeps the editor path, rows, completed numbers
and pending expected set. It is not cross-tab or cross-device persistence. A
different editor path or modified row list is rejected. Background iOS timer
throttling and current LINE navigation remain unverified.

Build with `node integration-v1/tag-helper/build-bulk.mjs`. Test with
`node tests/tag-bulk-browser.mjs`; it uses primary-runtime Playwright and the
Chromium executable at `CHROMIUM_PATH` (or the local temporary test default).
The synthetic fixture intercepts all requests, models checkbox autosave and
rebuilds tags from its stored model on navigation. Timers are shortened only
in the fixture. Passing this fixture cannot be reported as live bulk success.

No private image/tag assignment data is committed. A real list must be prepared
only after identifying the exact product and matching its numbered actual images.
