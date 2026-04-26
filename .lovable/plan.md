## What this means
`replaceSchoolRoster` exists in the current source code, but Firebase is not seeing it in the codebase you are deploying from.

## Evidence from the codebase
- `functions/src/index.ts` does export `replaceSchoolRoster`.
- In the current project, `functions/package.json` is set to:
  - `"main": "lib/index.js"`
  - `"engines": { "node": "22" }`
  - `firebase-functions: ^5.1.0`

Your deploy output says:
- Runtime is Node.js 20
- `firebase-functions` is outdated

That mismatch strongly suggests the folder you are deploying locally is not the same code state as the one that contains `replaceSchoolRoster`.

## Plan
1. Verify the local source file really contains the export:
   - Open `functions/src/index.ts`
   - Confirm it contains `export const replaceSchoolRoster = functions.https.onCall(`

2. Verify the local package matches the current project state:
   - Open `functions/package.json`
   - Confirm it shows Node `22` and `firebase-functions` `^5.1.0`
   - If it still shows Node 20 or older dependencies, your local repo is behind/out of sync

3. Verify the compiled output after build:
   - Run the build in `functions`
   - Open `functions/lib/index.js`
   - Confirm `replaceSchoolRoster` appears there
   - If it does not, the local TypeScript source being compiled is not the updated file

4. Deploy only after those three files line up:
   - `functions/src/index.ts` contains the export
   - `functions/lib/index.js` contains the compiled export
   - `functions/package.json` matches the updated config

5. If the export is present but filtered deploy still fails:
   - Deploy all functions once with `firebase deploy --only functions`
   - Check whether Firebase lists `replaceSchoolRoster` among detected functions
   - If not, the local CLI is still analyzing stale code

## Most likely fix
Bring your local `functions` folder fully in sync with the updated project files, then rebuild and redeploy.

## Technical detail
Firebase deploy discovers functions from the compiled entrypoint defined by:

```text
functions/package.json -> main: lib/index.js
```

So for filtered deploys to work, all of this must be true:

```text
functions/src/index.ts
  exports replaceSchoolRoster
        ↓ build
functions/lib/index.js
  exports replaceSchoolRoster
        ↓ deploy analysis
Firebase CLI detects default:replaceSchoolRoster
```

If any one of those three is missing or stale, you get:

```text
Error: No function matches the filter: default:replaceSchoolRoster
```

## What to send me next
Please paste the contents of these two local files:
- `functions/package.json`
- the part of `functions/src/index.ts` that includes `replaceSchoolRoster`

That will confirm exactly where the mismatch is.