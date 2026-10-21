# Crop and selection test

Source commit 4b77ca7, 2026-10-21. Entry: workflow.html.

Drive source selection now uses readonly OAuth and GET-only downloads. Selected images stay in the browser; no Drive writes, image uploads, or billing configuration. Existing root preview files are unchanged. Tokens remain in memory only. Browser storage is used for resume; no Photos/Files export is required for source import.

77 local tests passed with mocked HTTP/OAuth. Real Google consent, Drive reads and iPhone Safari popup behavior remain to be verified. No production-master approval or final adoption is inferred.
