

## Fix: Redeploy Firestore Rules

### Root Cause
The live Firestore rules are from **Feb 9th** — they are stale. The current local `firestore.rules` (document-lookup based) has never been successfully deployed. Whatever rules are live may not match either the old claims-based or the new document-lookup approach.

### Steps

**No code changes needed.** This is a deployment issue.

You need to run this command from your project root (where `firebase.json` lives):

```bash
firebase deploy --only firestore:rules --project school-data-intervention-tool
```

**After running it, verify:**
1. The terminal output should say `Deploy complete!` and reference `school-data-intervention-tool`
2. In Firebase Console → Firestore → Rules, the timestamp should update to today's date
3. Log out and back into the app — the permission error should be gone

### If the deploy command fails
Share the exact terminal output so we can diagnose. Common issues:
- Not logged into Firebase CLI (`firebase login`)
- Wrong directory (must be where `firebase.json` lives)
- Project permissions issue

### Alternative: paste rules manually
If CLI deploy keeps failing, you can copy the entire contents of your local `firestore.rules` file and paste them directly into **Firebase Console → Firestore → Rules → Edit rules**, then click **Publish**.

