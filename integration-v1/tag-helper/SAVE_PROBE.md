# One-tag save observation

The user supplied image 04: pending.before=[], pending.expected=[ネコ,到着,連絡,今], selected=[ネコ], confirmed=[1,2,3]. This does not establish why scripted additions failed. No automated retry of that bulk pending record is performed.

This separate explicit test adds only 到着 on image 04 when ネコ is already checked, 到着 exists and is unchecked, and fewer than nine tags are selected. It waits ten seconds on that image, observes only initiation/completion status for fetch/XHR calls, restores the original wrappers, and requests a full reload and re-launch for independent UI readback. It never reads or records request URLs, headers, bodies, responses, cookies, credentials, or account data. It does not modify the bulk job. The session record is scoped to the same editor path and query. A second invocation cannot repeat the addition while a record exists.

Observed requests may include unrelated page traffic. Absence of observations is not proof of no save: cached fetch references, beacon, WebSocket, other contexts, or calls outside the window are not observed. Status 2xx alone is not proof of saved tags. Same-document selected state is not persistence. Reloaded expected-set equality is recorded separately. Requests unfinished at ten seconds can remain unknown in the stored trace. User interrupts/reloads before completion leave a prepared record and never trigger an automatic retry.

Seven synthetic Chromium cases validate read-only initial capture, one-tag fetch, reloaded persistence, rejected save/readback mismatch, no-write preconditions, XHR status/restoration, and an unobserved cached-fetch save. Timers are shortened only in the fixture. A previous synthetic bulk delayed-save fixture reproduced mismatch after navigating before persistence, but that is not a proven LINE mechanism. Live execution remains unverified.

Build after npm ci: node integration-v1/tag-helper/build-save-probe.mjs. The bookmarklet is self-contained and has no external loader. Private tags/images are not in this repository beyond generic test labels.
