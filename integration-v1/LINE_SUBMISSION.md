# LINE submission preparation: partial implementation

Validated against the official public guidelines on 2026-10-26 (Japan).

## Implemented

After `saveArchives` succeeds for an application kit, the application displays a
read-only Work request. It includes the verified ZIP file ID, destination folder,
SHA-256, exact numbered order, artwork hashes and existing technical statuses.
The handoff is derived from the save snapshot, never from later edits. It does
not change selection, artwork, order, votes, Drive files or authentication.
Failure to build the handoff does not change a successful save into a failed save.

The user can paste the request into Work with “このスタンプを申請準備して”.
This is a handoff, not an automatic Work launch or a LINE API integration.
No credentials, cookies or private images belong in this repository.

## Live experiment

The LINE Creators Market public page and login form opened in the Work browser.
After the secure authentication handoff, LINE returned `400 Bad Request`.
No positive signed-in signal was observed. No further login attempt was made.
No item was created, no title/category/tag was entered, and no image was uploaded.
Review-request and publication operations were not performed.

## Remaining work

1. Establish a working authorized session through supported browser authentication.
2. Read the chosen character master and its latest confirmed selection. Avoid
   creating duplicate registrations for already submitted products.
3. Fetch the exact saved ZIP, verify hashes/order and inspect all actual PNGs.
   Existing kit records have `technicalApproval:false`; saving is not approval.
4. Generate Japanese/English listing copy and proposed categories from the actual
   set. Observe current category options in the signed-in form before selecting.
5. Choose tags from LINE's offered list per image (maximum nine), and truthfully
   set AI use. No tag IDs or category IDs have been guessed or hardcoded.
6. Exercise entry, ZIP upload, main/tab display, save/readback and final review.
   Stop before review request, release, publication or accepting new legal terms.

The live save-to-handoff UI path and LINE upload are not yet verified.

## Official sources

- https://creator.line.me/ja/guideline/sticker/
- https://creator.line.me/ja/review_guideline/
- https://creator.line.me/ja/terms/
- https://help2.line.me/creators/web/categoryId/20002324/3/pc?contentid=20005124&lang=ja
- https://help2.line.me/creators/web/categoryId/20002312/3/pc?contentId=200001335&lang=ja

Public documentation review does not establish blanket permission for automation.
Use supported visible UI operations only and stop on access/security restrictions.
