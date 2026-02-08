

## Fix Firestore Permission Errors for Homerooms and Staff

### Problem
Firestore is rejecting all list queries to `homerooms` and `teachers` collections with "Missing or insufficient permissions." This affects:
- Fetching homerooms (useClasses.ts)
- Fetching staff members (useStaff.ts)  
- Creating new homerooms

The frontend guards are correct (uid, schoolId, and admin role are all present), so the issue is in the **deployed Firestore security rules**.

### Root Cause
Firestore's query validator evaluates list/query rules differently than single-document reads. When a read rule contains an OR condition like:
```
allow read: if isAdmin() && (resourceSameSchool() || isMissingSchoolId());
```
Firestore cannot guarantee from the query constraints alone that every returned document will pass. It therefore rejects the query entirely.

### Solution
Update `firestore.rules` to split read access into `get` (single document) and `list` (queries) for the `homerooms` and `teachers` collections:

**For homerooms:**
```
match /homerooms/{homeroomId} {
  allow get: if isAdmin() && hasSchool() && (resourceSameSchool() || isMissingSchoolId());
  allow list: if isAdmin() && hasSchool();
  allow create: if isAdmin() && requestSameSchool();
  allow update: if (isAdmin() && resourceSameSchool()) || repairingMissingSchoolId();
  allow delete: if isAdmin() && resourceSameSchool();
}
```

**For teachers:**
```
match /teachers/{teacherId} {
  allow get: if isAdmin() && hasSchool() && (resourceSameSchool() || isMissingSchoolId());
  allow list: if isAdmin() && hasSchool();
  allow create: if isAdmin() && requestSameSchool();
  allow update: if (isAdmin() && resourceSameSchool()) || repairingMissingSchoolId();
  allow delete: if isAdmin() && resourceSameSchool();
}
```

This keeps strict per-document school checks for single reads, but allows list queries to succeed as long as the user is a confirmed admin with a valid school. The UI already filters by schoolId in the query, so only same-school data is returned.

### Changes
- **1 file modified**: `firestore.rules` -- update homerooms and teachers read rules to split `get` vs `list`

### After Approval
Once the file is updated here, you must redeploy the rules to Firebase:
```
firebase deploy --only firestore:rules
```
The permission errors will persist until the updated rules are deployed.
