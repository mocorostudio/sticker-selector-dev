# Crop and selection test

Source fb85ff6, 2026-10-21. Entry: workflow.html. User-approved update: audited boundary-only review; up to 20 sequential source images; IndexedDB v2 separates pixel assets from metadata; 16 cards per page; saved Drive ID/version progress and an unprocessed filter; per-image checker/black/white buttons. Existing images, IDs, review history and source files are retained.

Drive transport remains readonly. Tokens stay in memory. No billing settings or production writes. Progress is local to this browser. Standard technical failures cannot be overridden; all visual checks and candidate verification remain necessary. Metadata/PNG handoff rechecks pixels.

93 local automated tests passed. Synthetic browser migration fixture: tests/storage-browser.html (only its own test database). Physical iPhone memory limits and live Drive 20-image workflows still need confirmation.


## Numbered overview and selection drafts

The crop screen now shows numbered crop outlines and transfers the latest visible images together into selection without candidate mapping or individual approvals. Selection drafts retain technical warnings and never claim technical approval. Each selection card can return to its crop editor; corrected PNGs keep the slot number, retain previous images and votes in history, and start unrated.

Validation: 111 Node tests and syntax checks passed. The updated Chromium/WebKit regression scenario could not run in this workspace because browser executables are unavailable. Physical iPhone testing remains pending.
