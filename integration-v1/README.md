# 切り出し＋選抜 統合テスト v1

Source: mocorostudio/sticker-selector integration commit 06079d4 (local integration branch), 2026-10-21.

Entry: workflow.html. Existing root preview files are unchanged.

This entry only stores images and selections on the device. Google authentication and Drive writes are disabled, even with drive/test query parameters. Uploaded artwork stays in the browser and is not included in this repository.

The bundled 116 candidates come from the user-approved attached v3 master; production character-master verification remains pending. Technical scope is local-test. Selection confirmation is separate from technical approval and final adoption.

Local tests: 68 passed. Real Canvas/IndexedDB browser workflow and physical iPhone Safari checks remain pending at publication. No browser success is inferred from contract tests.

Preserve the URL for resumable device storage. Export the crop backup and selection JSON before clearing browser data. Selection JSON contains metadata/history, not PNG bytes.
