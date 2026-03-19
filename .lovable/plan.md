

## Diagnosis Confirmed

Your analysis is correct. Here is the situation:

### What the code already does right
- `useClasses.ts` queries `homerooms` collection — correct
- `useStaff.ts` queries `teachers` collection — correct
- `addClass` includes `schoolId` in the payload — correct
- `firestore.rules` in this repo uses claims-based `isAdmin()` with `request.auth.token.role` — correct
- `syncClaimsFromUserRoles` Cloud Function reads `schoolId` from `user_roles/{uid}` and sets it as a token claim — correct

### The actual problem
The `user_roles/{uid}` document for your admin account almost certainly does **not** contain `schoolId`. The Cloud Function syncs `schoolId` from that document into the token claim. If it is missing, the token claim `schoolId` will be an empty string, causing:

- `getUserSchool()` returns `""` 
- `newResourceMatchesUserSchool()` fails (empty string != `"folkstone_ps"`)
- Homeroom `get` rules fail (schoolId comparison fails)
- Homeroom `create` fails
- Teacher `get` rules fail

Meanwhile, the frontend shows `schoolId: 'folkstone_ps'` because `useAuth.tsx` falls back to reading it from the `users/{uid}` doc (line 55). So the UI looks fine but the **token** the Firestore SDK sends has no schoolId.

### What needs to happen

**No code changes needed.** The codebase is correct. You need two manual steps in Firebase Console:

1. **Add `schoolId` to your `user_roles` document**
   - Open Firebase Console > Firestore > `user_roles` > `3Zg3r5UF6zgmP94zp9NKRMclhZg1`
   - Add field: `schoolId` = `folkstone_ps` (string)
   - This will trigger `syncClaimsFromUserRoles`, which will set the token claim

2. **Deploy the rules from this repo** (if not already done)
   - Create `firebase.json` and `.firebaserc` in project root (the plan from before)
   - Run `firebase deploy --only firestore:rules`
   - Verify in Firebase Console > Firestore > Rules that `isAdmin()` reads `request.auth.token.role`

3. **Log out and log back in** to refresh the token with the new claims

### Files to create (same as previous approved plan)

**`firebase.json`**
```json
{
  "firestore": { "rules": "firestore.rules" },
  "functions": { "source": "functions" }
}
```

**`.firebaserc`**
```json
{
  "projects": { "default": "school-data-intervention-tool" }
}
```

### Summary
The root cause is a missing `schoolId` field in the `user_roles` Firestore document. The Cloud Function correctly syncs it to the token, the rules correctly read it from the token, and the frontend code correctly queries the right collections. The only gap is the data in that one document.

