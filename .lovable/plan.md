## Plan: fix the decommissioned Node 18 runtime error

Your deploy is failing because Firebase is still reading this setting from `functions/package.json`:

```json
"engines": {
  "node": "18"
}
```

So `upgrade your runtime version` is not something you type into Command Prompt. It means the project file must be changed.

## What will be changed

1. Update the Firebase Functions runtime
   - Change `functions/package.json` from Node `18` to Node `20`.

2. Align your local Windows Node version
   - Your machine is currently using Node `v24.15.0`.
   - That is why `npm install` showed `EBADENGINE`.
   - Switch your local Node to **20 LTS** so it matches the Functions runtime and avoids engine warnings.

3. Reinstall and rebuild functions
   - Re-run install and build inside `C:\Projects\plan-and-track-assist\functions`.

4. Redeploy the backend functions
   - Run `firebase deploy --only functions` again from the project root.

## Exact steps you will run on Windows after the file change

```text
node --version
cd C:\Projects\plan-and-track-assist\functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

## Important local setup note

Because your local Node is currently `v24.15.0`, I recommend installing or switching to **Node 20 LTS** first, then reopening Command Prompt and checking:

```text
node --version
```

You want it to show something like:

```text
v20.x.x
```

## Expected result

- Firebase will stop blocking deploys for using Node 18.
- The `EBADENGINE` warning should go away once your local Node is 20.
- No frontend publish/update step is needed; this is a backend Functions fix.

## Technical details

- Confirmed current setting:
  - `functions/package.json` → `"engines": { "node": "18" }`
- Current function stack:
  - `firebase-functions`: `^4.9.0`
  - `firebase-admin`: `^12.1.0`
- The code uses 1st gen Firebase functions via `firebase-functions/v1`, so this is a runtime version bump, not a function rewrite.

## If deploy still fails after this

The next checks would be:
- update the Firebase CLI on Windows
- delete `functions/node_modules` and reinstall cleanly
- confirm `node --version` is actually `v20.x` in the same terminal where you deploy

Once approved, I’ll update the project runtime setting from Node 18 to Node 20.