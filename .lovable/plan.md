## Plan

Unblock the Cloud Functions deploy by fixing the deploy environment first, then clearing any stale deployment state on the two affected functions.

### What to do

1. Confirm the local Firebase CLI version and upgrade it to the latest release.
2. Retry the deploy after the CLI upgrade.
3. If the same error still appears for only `lookupUserByEmail` and `syncClaimsFromUserRoles`, delete those two deployed functions in Firebase and redeploy them cleanly.
4. After deploy is green, do a small follow-up runtime update from Node 20 to Node 22 to avoid the deprecation window.

### Commands to run locally

```cmd
cd C:\Projects\plan-and-track-assist
firebase --version
npm install -g firebase-tools@latest
firebase --version
firebase deploy --only functions
```

If the same CPU error still appears, run:

```cmd
firebase functions:delete lookupUserByEmail --region us-central1 --force
firebase functions:delete syncClaimsFromUserRoles --region us-central1 --force
firebase deploy --only functions
```

If it still fails after that, run one final capture step:

```cmd
firebase deploy --only functions --debug
```

and share the section around `lookupUserByEmail` / `syncClaimsFromUserRoles`.

## Technical details

- The repo is already configured for 1st Gen functions:
  - `functions/src/index.ts` imports `firebase-functions/v1`
  - the exported functions are created with the v1 API
  - `firebase.json` does not define CPU settings
- `functions/package.json` already contains `"firebase-functions": "^5.1.0"`, which satisfies the earlier Extensions requirement.
- The current warning about `firebase-functions` being “outdated” is likely a generic “not latest” warning, not the root cause of this specific failure.
- The real blocker is the deploy layer trying to apply a CPU setting to 1st Gen functions. Because the error names only two functions, the most likely cause is stale CLI behavior or stale deployed metadata on those existing functions.
- Deleting and redeploying only the affected functions is the safest reset if the CLI upgrade alone does not clear it.

## Expected outcome

- Best case: updating `firebase-tools` makes the deploy succeed immediately.
- Next most likely: deleting the two affected functions and redeploying clears the bad state.
- Separate follow-up: update Functions runtime from Node 20 to Node 22 after deploy is unblocked.