# Chat-operated review and existing Drive handoff

Work and chat now use the same crop/transparency command described in
[CROP_WORK_CHAT.md](CROP_WORK_CHAT.md). Run that command before individual visual
review; it does not grant technical approval. The default delivery route is the
existing direct Drive loader described in procedure 21, including all-candidate
review display with separate technical reasons. Users do not download/unzip a
handoff ZIP. The reviewed-ZIP command below remains a compatibility tool for
already inspected pass PNGs; it is not the crop/transparency implementation.

## Produce a reviewed ZIP

Use `scripts/prepare-chat-handoff.mjs INPUT.json NEW_OUTPUT_DIR` with Node,
the repository's existing jszip dependency and Python/Pillow. No paid API is
used. Set `CODEX_PRIMARY_RUNTIME_PYTHON` if the system Python lacks Pillow.

The input schema is `animal-stickers-chat-handoff/v1`. Required root fields:
`characterId`, `masterReference` (native Sheet URL), `masterSheet`,
`masterModifiedTime`, `master` (the fetched normalized candidateId/phrase/pose
rows) and `entries` (one per candidate, including every blocked candidate).
Each entry supplies `record`, the actual inspected `sha256`, and a relative PNG
`path` under the input directory. An excluded entry needs an explicit `reason`.

The record uses the existing crop/Drive contract: unique `imageId`,
`candidateId`, `filename`, exact `phrase` and `pose`, `sourceId`, `attemptId`,
`decision`, `crossing`, `review`, `qa`, and `inspection`. A claimed pass must
already contain all actual individual visual checks, an actual-source scope,
inspection time and method/evidence description. Do not generate all-pass
templates from numerical checks. A report recording only that further visual
inspection is required is not pass evidence. The tool cannot perform artistic
inspection or establish that a locally supplied master is current; the operator
must actually fetch and inspect those sources.

The producer rejects duplicate/missing mapping, incorrect text/pose, incomplete
claimed passes, changed PNG bytes and failed pixel checks. It uses Pillow to
decode actual single-frame 370x320 RGBA PNGs and the app's existing JS inspector.
It emits only accepted PNGs plus `technical-review.json`, reopens the completed
ZIP with CRC checking, and runs the existing ZIP reader against it. Every
excluded candidate remains in `handoff-result.json` with its status and reason.
The summary explicitly says cloud saving and user readback are unverified.
Output directories must be new: old attempts are never overwritten.

Save the reviewed ZIP and full decision record in the character's existing
`03_元画像・生成履歴` via connected Drive tools, then verify actual saved bytes,
IDs, parents and duplicate state. A failure of that save remains a save failure;
do not disguise or repeat an approval-review rejection via another transport.
Return an available reviewed ZIP even when cloud save cannot finish, with that
limitation clearly stated. Never put private PNGs in this public repository.

## Final user import

In the existing workflow, use **Driveから読み込む** → Google connection → character.
All-candidate display uses `selection-review_*.json` and the unchanged archived
PNGs, preserving pass/hold/fail reasons separately from user preferences. Only
actually reviewed pass PNGs may use formal `selection-manifest_*.json` registration.
Local PNG/ZIP import is a closed auxiliary-menu fallback, not the standard route.
The producer must verify the live master, exact text/pose, hashes and appropriate
reader contract before calling the handoff ready. Existing choices and edits must
not be replaced automatically.

The user's existing Google account must be able to read the native master.
Neither a Drive connector login in chat nor a completed data package implies
that the user's browser is already signed in. No browser tokens are embedded.

Selected imported PNGs can use the existing grouped Drive save and downstream
submission workflow; their verified character ID resolves the destination even
when their source is a local reviewed ZIP. Exact bytes are rechecked before
export. The normal user-side Drive save registers the reviewed candidates in
00 and writes the native selection manifest before saving the user's selected
01/02 copies. This reuses the existing resumable upload/readback transport, so
later Drive loading does not depend on the original chat browser. A newer
explicit review/failure revokes eligibility; an old ZIP cannot erase it.
Candidate preferences remain independent of technical approval.

## Completion labels

- `引き渡しデータ準備完了・実機読込待ち`: local reader/QA and specified cloud
  save checks passed, but the user has not imported yet.
- Cloud save failure is reported separately; a local ZIP alone is not a saved
  native `00` registration.
- `ユーザー読込確認済み`: only after the actual user/browser result is observed.
- A handoff ZIP is never a 40-image LINE submission ZIP.

Code/environment defects require scoped regression checks. Normal image jobs
reuse the verified producer and reader instead of repeating development and
full regression suites. Image review, actual master matching and saving checks
still apply to every new or changed image.
