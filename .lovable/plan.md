## Fix: "No function matches the filter: default:backfillExternalStudentNumbers"

### What this error actually means

The Firebase CLI compiled your `functions/` folder, looked at the resulting JavaScript, and didn't find an exported function named `backfillExternalStudentNumbers`. So when you asked it to deploy *just* that one function, it had nothing to deploy and bailed out.

This is **not** a Firebase permissions issue, not a quota issue, and not a code bug in the function itself. It's a build/sync issue between Lovable's copy of the code and your local Windows copy.

### Root cause

The `functions/` folder in this Lovable project is incomplete — it only contains `src/index.ts`. It is missing:

- `functions/package.json` (declares dependencies + the `main` entry point + the `build` script)
- `functions/tsconfig.json` (tells TypeScript how to compile to `lib/`)
- `functions/.gitignore` (so `lib/` and `node_modules/` aren't committed)

Without these, two things happen:

1. On Lovable's side, the new `backfillExternalStudentNumbers` and `diagnoseImportStudentIds` functions were added to `src/index.ts` but there was never a working build pipeline to verify them.
2. On your local Windows machine, when you pulled the latest code and ran `firebase deploy`, the CLI either (a) skipped the TypeScript build because there's no `package.json` with a `build` script, or (b) used a stale `lib/index.js` from a previous deploy that doesn't contain the new function. Either way, the function name doesn't exist in the compiled output.

### The fix

Add the three missing config files to `functions/` so the build pipeline is complete and reproducible. Then you re-deploy from your Windows machine using the standard 3-command sequence.

### Files to create

**`functions/package.json`** — Standard Firebase Functions config: Node 18, dependencies (`firebase-admin`, `firebase-functions`), devDependencies (`typescript`), `main: "lib/index.js"`, and a `build` script (`tsc`) plus a `deploy` helper. This is the file the CLI reads to know how to compile and what the entry point is.

**`functions/tsconfig.json`** — TypeScript config targeting Node 18, `outDir: "lib"`, `rootDir: "src"`, strict mode on, module: `commonjs` (required for Cloud Functions Gen 1).

**`functions/.gitignore`** — Excludes `lib/` and `node_modules/` from version control.

No changes to `src/index.ts` — the function code itself is correct.

### What you do after the files are created

From your Windows terminal, in the project root:

```text
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions:backfillExternalStudentNumbers
```

The `npm run build` step is the critical one — it compiles `src/index.ts` to `lib/index.js`, which is what `firebase deploy` actually uploads. If `lib/index.js` contains the export, the CLI will find it.

### How to verify it worked before deploying

After `npm run build`, run:

```text
type lib\index.js | findstr backfillExternalStudentNumbers
```

(Windows equivalent of `grep`.) You should see at least one match. If you do, the deploy will succeed. If you don't, the build silently failed — check the `npm run build` output for TypeScript errors.

### Also worth deploying at the same time

The same `src/index.ts` also contains a second new function, `diagnoseImportStudentIds`, that was never deployed either. Once the build pipeline is in place, deploy both:

```text
firebase deploy --only functions:backfillExternalStudentNumbers,functions:diagnoseImportStudentIds
```

### What this plan does NOT do

- Does not change `src/index.ts`.
- Does not change Firestore rules.
- Does not touch the frontend (`ServerBackfillPanel`, `StudentsTab`).
- Does not require any Firebase Console changes.
