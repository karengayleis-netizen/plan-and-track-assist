

## Fix: Manually publish updated Firestore rules

### Root Cause
The Lovable codebase has the correct `firestore.rules`, but the user's local Windows project folder has the old version. Firebase CLI sees no change in the local file, so it skips the upload.

### No code changes needed

### Manual Steps

1. **Open Firebase Console → Firestore → Rules**
2. **Select all** existing rules and **delete** them
3. **Copy the entire content below** and paste it into the editor:

```
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    function signedIn() { return request.auth != null; }
    function uid() { return request.auth.uid; }

    function roleDoc() {
      return get(/databases/$(database)/documents/user_roles/$(uid()));
    }

    function mySchoolId() {
      return roleDoc().data.schoolId;
    }

    function hasSchool() {
      return signedIn()
        && roleDoc().exists()
        && mySchoolId() != null
        && mySchoolId() != "";
    }

    function isAdmin() {
      return signedIn()
        && roleDoc().exists()
        && roleDoc().data.role == "admin";
    }

    function resourceSameSchool() {
      return hasSchool()
        && ('schoolId' in resource.data)
        && resource.data.schoolId == mySchoolId();
    }

    function requestSameSchool() {
      return hasSchool()
        && ('schoolId' in request.resource.data)
        && request.resource.data.schoolId == mySchoolId();
    }

    function isMissingSchoolId() {
      return !('schoolId' in resource.data) || resource.data.schoolId == null || resource.data.schoolId == "";
    }

    function repairingMissingSchoolId() {
      return isAdmin()
        && hasSchool()
        && isMissingSchoolId()
        && ('schoolId' in request.resource.data)
        && request.resource.data.schoolId == mySchoolId();
    }

    match /artifacts/{artifactId}/users/{userId} {
      allow read, write: if signedIn() && uid() == userId;
      match /{document=**} {
        allow read, write: if signedIn() && uid() == userId;
      }
    }

    match /users/{userId} {
      allow read, write: if signedIn() && uid() == userId;
    }

    match /user_roles/{userId} {
      allow read: if signedIn() && uid() == userId;
      allow write: if isAdmin();
    }

    match /homerooms/{homeroomId} {
      allow list: if isAdmin() && hasSchool();
      allow get: if isAdmin() && hasSchool() && (resourceSameSchool() || isMissingSchoolId());
      allow create: if isAdmin() && requestSameSchool();
      allow update: if (isAdmin() && resourceSameSchool()) || repairingMissingSchoolId();
      allow delete: if isAdmin() && resourceSameSchool();
    }

    match /teachers/{teacherUid} {
      allow list: if isAdmin() && hasSchool();
      allow get: if isAdmin() && hasSchool() && (resourceSameSchool() || isMissingSchoolId());
      allow create: if isAdmin() && requestSameSchool();
      allow update: if (isAdmin() && resourceSameSchool()) || repairingMissingSchoolId();
      allow delete: if isAdmin() && resourceSameSchool();
    }

    match /students/{id} {
      allow read: if resourceSameSchool();
      allow create: if requestSameSchool();
      allow update: if resourceSameSchool() && requestSameSchool();
      allow delete: if resourceSameSchool();
    }

    match /benchmarks/{id} {
      allow read: if resourceSameSchool();
      allow create: if requestSameSchool();
      allow update: if resourceSameSchool() && requestSameSchool();
      allow delete: if resourceSameSchool();
    }

    match /markbook/{id} {
      allow read: if resourceSameSchool();
      allow create: if requestSameSchool();
      allow update: if resourceSameSchool() && requestSameSchool();
      allow delete: if resourceSameSchool();
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

4. Click **Publish**
5. Confirm the timestamp updates to today
6. Log out and back into the app — the permission errors should be resolved

### Key differences from the live (Feb 9th) rules
- `hasSchool()` now also checks `mySchoolId() != ""` (prevents empty string bypass)
- `homerooms` and `teachers` get rules include `|| isMissingSchoolId()` (allows reading legacy docs)
- `homerooms` and `teachers` update rules include `repairingMissingSchoolId()` (allows fixing legacy docs)
- `homerooms` has a delete rule
- `users/{userId}` match now allows read/write for own profile

