# Chat-operated handoff, user-operated final import

The standard producer does not require an authenticated browser. The operator
fetches the production rules, procedure, current character master and actual PNGs
through the connected tools, processes the PNGs in Python, and records the
individual visual decisions. The final user imports the reviewed ZIP in the
existing app. Existing native `selection-manifest_*.json` plus individual Drive
PNGs remain supported; their format and original records are unchanged.

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

In the existing workflow, connect Google and select the target character first.
In ②選抜, expand the existing import panel and choose the reviewed ZIP with
`PNG・ZIPを読み込む`. The reader fetches the character's live native master and
verifies the reference, exact text/pose, every PNG hash and pixel QA. It preserves
existing image IDs, votes, comments and history when the same ZIP is reimported.
The imported technical record is shown as inspected only while its hash and
candidate binding still match. A plain PNG ZIP has no such status.

The user's existing Google account must be able to read the native master.
Neither a Drive connector login in chat nor a completed data package implies
that the user's browser is already signed in. No browser tokens are embedded.

Selected imported PNGs can use the existing grouped Drive save and downstream
submission workflow; their verified character ID resolves the destination even
when their source is a local reviewed ZIP. Exact bytes are rechecked before
export. Candidate preferences remain independent of technical approval.

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
