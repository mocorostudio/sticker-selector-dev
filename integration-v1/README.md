# Crop and selection test

Source fb85ff6, 2026-10-21. Entry: workflow.html. User-approved update: audited boundary-only review; up to 20 sequential source images; IndexedDB v2 separates pixel assets from metadata; 16 cards per page; saved Drive ID/version progress and an unprocessed filter; per-image checker/black/white buttons. Existing images, IDs, review history and source files are retained.

Drive transport remains readonly. Tokens stay in memory. No billing settings or production writes. Progress is local to this browser. Standard technical failures cannot be overridden; all visual checks and candidate verification remain necessary. Metadata/PNG handoff rechecks pixels.

93 local automated tests passed. Synthetic browser migration fixture: tests/storage-browser.html (only its own test database). Physical iPhone memory limits and live Drive 20-image workflows still need confirmation.
