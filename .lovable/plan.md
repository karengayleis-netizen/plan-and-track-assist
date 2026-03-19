

## Fix: Create Firebase CLI config so rules actually deploy

### Root cause
There is no `firebase.json` or `.firebaserc` in the project. Without these, `firebase deploy --only firestore:rules` cannot locate the rules file or know which Firebase project to target. The rules currently live in Firebase are old/different from what's in this codebase.

### Changes

**File 1: `firebase.json`** (new)
Create in project root with:
```json
{
  "firestore": {
    "rules": "firestore.rules"
  },
  "functions": {
    "source": "functions"
  }
}
```

**File 2: `.firebaserc`** (new)
Create in project root with:
```json
{
  "projects": {
    "default": "school-data-intervention-tool"
  }
}
```

### After implementation

1. In your terminal, navigate to the project root (the folder containing `firestore.rules`)
2. Run: `firebase deploy --only firestore:rules`
3. Verify in **Firebase Console > Firestore > Rules** that the rules now match — you should see the claims-based `isAdmin()` function using `request.auth.token.role == 'admin'`
4. Log out and log back in to refresh your token

### Technical details
- The `firebase.json` file tells the CLI which local file contains Firestore rules and where Cloud Functions live
- The `.firebaserc` file tells the CLI which Firebase project to deploy to (`school-data-intervention-tool`)
- Without these files, the CLI either errors out or deploys from a different working directory, leaving old rules in place

