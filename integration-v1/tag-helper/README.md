# One-image tag input experiment

Original implementation; no third-party runtime or API. Run `node
integration-v1/tag-helper/build.mjs` after editing `helper.mjs` to regenerate the
self-contained installation page. The copied bookmarklet has no remote loader.
The only storage is a session-scoped pending tag verification record on LINE's
origin; it contains the editor path, image number, before/expected tags and page
load time. No cookies, credentials, image bytes or account details are read.

Selectors are provisional compatibility hints from a publicly described tag
editor, **not a current authenticated LINE DOM capture**. Unknown/ambiguous
layouts stop. No network endpoint, tag ID, automatic navigation, review request,
release operation, or confirmation-dialog handler is included.

The trial preserves existing tags, validates the image number, rejects unknown
tags, duplicate input and union counts over nine. It checks again before writes,
adds through checkbox labels, and does not click any save button: selection may persist automatically in the observed LINE UI. Exceptions can leave unsaved checkbox
changes; the tool reports this and never automatically retries or removes tags.
An outstanding trial blocks a second trial until readback is resolved. Failed
verification records are deliberately retained for investigation.

A full document reload and
second launch compares the same editor path/number and exact expected tag set.
The result is UI readback, not independent inspection of LINE's server database.
Same-document reopening cannot pass. A failed synthetic autosave does not pass. Older prepared-stage records can pass only when exact expected tags match after reload.

## Verification

2026-10-27: installation and DOM behavior tested against a **synthetic** editor
at a 390×844 Chromium viewport, with every request intercepted. This does not
establish current LINE compatibility, iOS Safari URL acceptance, real persistence
or permission for automation. Never describe this as successful live tag entry.

```
node integration-v1/tag-helper/build.mjs
CHROMIUM_PATH=/path/to/chromium node tests/tag-helper-browser.mjs
npm test
```

If Playwright is supplied by the primary runtime, the browser test uses
`CODEX_PRIMARY_RUNTIME_NODE_MODULES`; otherwise it uses the repo dependency.
Do not commit downloaded browser runtimes, private sticker content or credentials.

Next live step: register the bookmarklet in Safari and inspect one existing
editable sticker's tag editor. Prepare its single input row only after seeing
the actual image, number and offered tags. Do not withdraw a pending submission
for this experiment. Batch processing remains disabled until live save/readback
works on one image. Existing selection, ordering, Drive and submission code is
unchanged.

Official tag procedure (checked 2026-10-27):
https://help2.line.me/creators/web/categoryId/20002324/3/pc?contentid=20005124&lang=ja

Official terms checked without accepting or modifying them:
https://creator.line.me/ja/terms/

## v3 field evidence, 2026-10-28

The user confirmed that tags ネコ and ダッシュ remained after returning to the tag list and reopening image 01 on iPhone Safari, without pressing LINE's Save button. This verifies that single-image field flow as reported by the user; it does not prove bulk processing or a general server contract. v3 removes save-button interaction and retains exact reload readback. 17 synthetic Chromium scenarios pass, including failed autosave and legacy-record recovery. Physical iPhone execution of v3 remains unverified.
