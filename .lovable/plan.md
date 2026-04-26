## Plan: fix the "Cannot set CPU on Gen 1 functions" deploy error

The Node 18 problem is solved. New error:

```text
Error: Cannot set CPU on the functions lookupUserByEmail,syncClaimsFromUserRoles
because they are GCF gen 1
```

### Why this happens

Your functions are intentionally Gen 1 (`import * as functions from "firebase-functions/v1";`). This was a deliberate choice in this project to bypass Eventarc issues. Newer versions of the Firebase CLI try to apply a `cpu` setting on deploy, which only exists on Gen 2, so the deploy aborts.

### What will be changed

Upgrade the `firebase-functions` SDK in `functions/package.json` from `^4.9.0` to `^5.1.0`. Version 5.x of the SDK still fully supports Gen 1 via the `firebase-functions/v1` import (which your code already uses), and it correctly tells the CLI not to apply the Gen 2 `cpu` field to Gen 1 functions. No source code changes needed — your existing `functions.https.onCall` and `functions.firestore.document(...).onWrite` calls keep working.

This also clears the two CLI warnings:
- "outdated version of firebase-functions"
- "version 4.9.0 does not have support for newest Extensions features"

### What stays the same

- Functions stay Gen 1 (per the project's `cloud-functions-generation` memory).
- Node runtime stays at 20.
- `firebase.json` stays minimal — no `runtime` / `region` block added there. Adding one would push toward Gen 2 defaults, which is the opposite of what we want.

### Steps you will run on Windows after the file change

```cmd
cd C:\Projects\plan-and-track-assist
git pull
cd functions
rmdir /S /Q node_modules
del package-lock.json
npm install
npm run build
cd ..
firebase deploy --only functions
```

The `rmdir` + `del package-lock.json` step is important — it forces a clean install on the new SDK version and prevents the old `4.9.0` resolution from sticking.

### If the deploy still complains about CPU after the SDK upgrade

Run this once, then redeploy:

```cmd
firebase --version
npm install -g firebase-tools@latest
firebase deploy --only functions
```

An old Firebase CLI on your Windows machine can also push the Gen 2 `cpu` default onto Gen 1 functions.

### Technical details

- `functions/src/index.ts` uses `firebase-functions/v1` for every export — this is the Gen 1 API surface and stays valid in firebase-functions `^5`.
- Exports affected: `lookupUserByEmail`, `diagnoseImportStudentIds`, `backfillExternalStudentNumbers`, `syncClaimsFromUserRoles`.
- We are NOT migrating to Gen 2 because the project memory `technical/cloud-functions-generation` records that Gen 1 is intentional to avoid Eventarc/Cloud Run setup.
- We are NOT adding `"runtime": "nodejs20"` or `"region"` to `firebase.json` — that block is associated with Gen 2 codebases and would re-trigger the same CPU error.

### Expected result

- Deploy succeeds.
- Both warnings about the outdated SDK go away.
- Functions remain Gen 1 on Node 20.