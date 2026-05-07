This folder mirrors the intended development upload structure for user media, identity files, and
dev-only signup record exports.

Because this project currently runs as a browser-only demo, uploaded files are persisted in localStorage
through `src/services/devUploadService.js` and assigned mirrored paths under `/dev-uploads/...`.

Signup account records are also mirrored into localStorage through
`src/services/devSignupRecordService.js` with JSON-style paths under
`/dev-uploads/account-records/...`.

Subfolders are kept here so the project has a clear destination structure ready for a future backend or
local file-writing development service.
