# Batch tag editor experiment

The user verified one-image tag addition and persistence after reopening on
iPhone Safari on 2026-10-28. This does not establish bulk navigation support.
The user verified image 01 navigation/readback and reaching image 02 on 2026-10-28. The trial stopped before modifying image 02 due to a requested tag unavailable on that screen. Both images must be tested
before enabling the remainder. No paid API, authentication read, external
loader, review submission or publication action is used by the bookmarklet.

This implementation accepts at most 40 unique numbered rows and retains the
existing tag union (up to nine). Each row is applied once and checked after
navigating away and back with the editor controls. That is UI readback, not an
independent query of LINE server storage. Unknown layouts, selection conflicts, mismatches and timeouts stop the job. Unsupported requested tags and additions beyond nine are omitted with a per-image reason; existing tags remain intact. There is no fallback
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

## Skip handling v2

Unavailable tags are recorded without substituting an unrequested tag. Over-limit additions are also omitted instead of deleting existing selections. Progress reports include the omitted count and full per-image list; processing all rows must not be called completion of every requested tag. Existing session records without omitted metadata remain resumable. The user's 01/40 checkpoint is retained. Twelve synthetic scenarios pass, including unknown-tag continuation, existing-nine preservation and resuming an older stopped job. Live skip behavior remains unverified.

## v3 loading and catalog capture

The user confirmed 2/40 and reported tag-list absence after advancing. Its cause is not proven from the screenshot. Settling now tolerates only transient missing/partial tag-list or number observations for a bounded polling window; URL changes, selection conflicts and other errors still stop. A synthetic delayed-empty render succeeds and a permanently empty view times out without marking completion.

The catalog button copies the current image number, observed offered tag names and checked names as JSON. It performs no tag writes or navigation, and reads no account, credential or image data. A fallback read-only textarea supports manual copy. The list is limited to the current rendered editor; it is not certified complete for every image/language. New assignments must use this actual catalog rather than a guessed external dictionary.

The explicit list-replacement button archives the old session job under a history key before allowing new rows; existing LINE selections are unaffected. Terser is pinned as a dev-only build dependency to keep the self-contained copied payload under 8000 UTF-8 bytes; the deployed bookmarklet has no loader or minifier dependency. Seventeen local synthetic browser cases pass, including capture without writes, preserved job history, bounded loading and execution of the minified payload. v3 has not been run on the user's iPhone.

## v3.1 read-only pending diagnosis

The user reported 3/40 confirmed, mismatch on image 04, then exported image 04 with zero selected tags. A later screenshot showed one manually selected ネコ. No cause is proven by those observations. The catalog control now exports a short LINE-tag-diagnostic-v1 record when a pending trial exists: current image, current checked tags, recorded pending before/expected tags and confirmed numbers. It excludes the large offered dictionary in that mode. It reads neither credentials nor account data, does not navigate or select tags, and leaves the job record intact. Users should copy this diagnosis rather than retry the pending additions.

Nineteen synthetic cases pass. An added fixture with delayed persistence cancelled by navigation reproduces the mismatch without completion; this is a possible mechanism, not a diagnosis of LINE. Another case verifies exact pending evidence extraction and unchanged tag-write count/session job. The live cause and remaining 37 images remain unresolved. No automatic retry, slower-write workaround or success promotion is introduced in this release.
