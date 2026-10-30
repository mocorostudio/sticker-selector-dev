# Production progress dashboard

Entry: `progress.html`. The workflow page opens it in a separate named tab so
selection state and in-progress operations remain in the original page.

Read-only connection discovers exactly one native `全体管理マスター_v9`, reads
its actual tab metadata, then the bounded character table. Duplicate masters
stop discovery. No private master ID, character identity, image or live data is
embedded in the repository. Old master status is displayed as historical,
unreconciled information; it never automatically proves a completed phase.

The dashboard reads append-only JSON files named `sticker-progress_*.json` in
the management master's verified parent folder. Schema:

```json
{"schema":"animal-stickers-progress/v1","records":[{
  "characterId":"verified-character-folder-id",
  "stage":"lui",
  "next":"Confirm the current saved and inspected state",
  "updatedAt":"2026-10-30T01:00:00Z",
  "source":"Evidence or user report",
  "priority":10
}]}
```

Stages: `you`, `lui`, `hold`, `submitted`, `selling`, `unknown`. These are task
ownership/application states, never technical approvals. Lower priority sorts
first. Latest timestamp wins per character, independent of file listing order.
Only known master character folder IDs are merged. New ideas must be registered
in the master before they appear; the dashboard is not an idea creation tool.

When completing authorized work, agents should append a new progress record with
the verified character ID, evidence/source, next action and actual update time.
Keep old files. Do not copy private records into this public repository. Unknown
completion remains `lui` or `unknown`. Approval of private Drive writes must be
established before uploading. Chat messages are not automatically ingested.

Manual updates obtain write authorization only from the save button. Reserved
file ID and immutable payload remain in a separate local pending key before
upload; retries reconcile the same ID on HTTP 409. Actual bytes and parent are
read back before success, and pending records cannot change Google destinations.
Existing images, evaluation keys, originals and masters are never modified.

The latest successful listing is cached as an explicitly labelled browser-local
copy; read failure preserves that copy without reporting it as current. Local
selection counts read the existing workflow store without changing it and do
not prove Drive synchronization or technical approval. Cloud histories support
other devices after explicit reload and Google authentication. OAuth tokens stay
in memory. Physical iPhone and real browser OAuth must be verified separately.
