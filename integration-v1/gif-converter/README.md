# GIF to LINE APNG
Standalone browser-only tool. Open index.html through an HTTP server. No upload service, API key, paid API or CDN is used. gifuct-js 2.1.2 (MIT) decodes GIF; fflate 0.8.2 (MIT) compresses RGBA frames and ZIP. Licenses are included. Vendor bundle was built with esbuild 0.25.12 from exports parseGIF/decompressFrames and zlibSync/zipSync/strToU8.

Original GIFs are retained in IndexedDB. Order, archived IDs, first-frame choice and global settings persist in localStorage. Reload recomputes output and requires fresh visual confirmation; source files remain available. Removing from the list archives without deleting original bytes. Capacity/private-browsing restrictions are reported. GIF decoder supports disposal methods 0–3; full composited frames are sampled by original timing. APNG frames are full-canvas RGBA, SOURCE blending, no disposal, finite play count, exact rational delays, CRC-checked.

Exports are individually re-parsed for dimensions, CRC, frame count, sequences, duration, loops and size. ZIP export requires 8/16/24 outputs, per-item visual acknowledgement and explicit main/tab selection and crop confirmation. Main is animated 240×240; tab is static 96×74. Output is fitted with 8px padding, preserving the complete source canvas. Background removal, content/rights review and LINE submission are not performed. Oversize output is blocked rather than silently quantized. The 1MB and 60MB limits are enforced conservatively as decimal bytes.

Source of specification, checked 2026-11-16:
- https://creator.line.me/ja/guideline/animationsticker/
- https://creator.line.me/ja/guideline/animationsticker/detail/

Run: node --test integration-v1/gif-converter/codec.test.mjs
Browser QA: 3 synthetic transparent GIFs using disposal 1/2/3; batch conversion; downloaded APNG independently read with Pillow; source restoration on reload; 8-file ZIP path. No production images or Drive records modified. iPhone hardware and LINE upload remain separate checks.
