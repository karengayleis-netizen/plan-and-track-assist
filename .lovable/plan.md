
# Add Debug Logging to Diagnose Admin Role Issue

## Overview
Since you've already updated the Firebase rules (Step 1), we'll now add temporary debug logging to identify exactly why the admin role isn't being detected. This will help us see whether:
- The Firestore read is succeeding or failing
- The document exists at the expected path
- The role field contains the expected value

## What Will Change

### File: `src/hooks/useAuth.tsx`

Add console logging to both the `fetchUserRole` function and the auth state change handler to trace the entire flow.

**Changes to `fetchUserRole` function (lines 22-37):**
```typescript
async function fetchUserRole(uid: string): Promise<'teacher' | 'admin'> {
  try {
    console.log('[Auth Debug] Fetching role for UID:', uid);
    const roleDoc = await getDoc(doc(db, 'user_roles', uid));
    console.log('[Auth Debug] Role doc exists:', roleDoc.exists());
    
    if (roleDoc.exists()) {
      const data = roleDoc.data();
      console.log('[Auth Debug] Role document data:', data);
      const role = data?.role;
      if (role === 'admin' || role === 'teacher') {
        console.log('[Auth Debug] Returning role:', role);
        return role;
      }
    }
    console.log('[Auth Debug] No valid role found, defaulting to teacher');
    return 'teacher';
  } catch (error) {
    console.error('[Auth Debug] Error fetching role:', error);
    return 'teacher';
  }
}
```

**Changes to `fetchUserSchoolId` function (lines 39-50):**
```typescript
async function fetchUserSchoolId(uid: string): Promise<string | undefined> {
  try {
    console.log('[Auth Debug] Fetching schoolId for UID:', uid);
    const userDoc = await getDoc(doc(db, 'users', uid));
    console.log('[Auth Debug] User doc exists:', userDoc.exists());
    
    if (userDoc.exists()) {
      const schoolId = userDoc.data()?.schoolId;
      console.log('[Auth Debug] SchoolId found:', schoolId);
      return schoolId;
    }
    return undefined;
  } catch (error) {
    console.error('[Auth Debug] Error fetching schoolId:', error);
    return undefined;
  }
}
```

**Add logging after role fetch completes (inside setTimeout, around line 74):**
```typescript
console.log('[Auth Debug] Final user state:', { uid: firebaseUser.uid, role, schoolId });
```

## How to Test

After implementation:
1. Open the browser Developer Tools (F12 or Cmd+Option+I)
2. Go to the Console tab
3. Log out and log back in
4. Look for `[Auth Debug]` messages

## Expected Console Output

**If working correctly:**
```
[Auth Debug] Fetching role for UID: 3Zg3r5UF6zgmP94zp9NKRMclhZg1
[Auth Debug] Role doc exists: true
[Auth Debug] Role document data: {role: "admin"}
[Auth Debug] Returning role: admin
[Auth Debug] Final user state: {uid: "...", role: "admin", schoolId: "..."}
```

**If document doesn't exist:**
```
[Auth Debug] Role doc exists: false
[Auth Debug] No valid role found, defaulting to teacher
```

**If permission error:**
```
[Auth Debug] Error fetching role: FirebaseError: Missing or insufficient permissions
```

## Verification Checklist for Firebase Console

While testing, also verify in Firebase Console:

| Check | Expected Value |
|-------|----------------|
| Collection path | `user_roles` (not `users` or `userRoles`) |
| Document ID | Exact UID: `3Zg3r5UF6zgmP94zp9NKRMclhZg1` |
| Field name | `role` (lowercase, string type) |
| Field value | `admin` (lowercase, no quotes visible in UI) |

## Next Steps

Once we see the debug output, we'll know exactly what's failing and can fix it. Common issues include:
- Document ID mismatch (copy-paste error with UID)
- Field named differently (e.g., `Role` vs `role`)
- Value stored as different type (e.g., array instead of string)
- Rules still not deployed properly
