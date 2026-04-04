

## Why Ruchi Sees All Students

The problem has two layers:

1. **Firestore `students` rules** allow **any** user with matching `schoolId` to read all students — there's no teacher-level filtering.
2. **`useStudents` hook** queries all students by `schoolId` with no homeroom restriction for teachers.
3. There is **no teacher-to-homeroom assignment** in the data model yet — the `Homeroom` type has no `teacherId` field, so there's nothing to filter on.

The previous change (opening homerooms list to teachers) was correct in intent — teachers do need to see their classes. But the student data itself was never restricted by homeroom assignment.

## Proposed Fix

### 1. Add teacher assignment to homerooms

**Firestore data**: Add a `teacherIds: string[]` field to each homeroom document (array to support co-teaching). Admins assign teachers to homerooms via the Admin tab.

**Type update (`src/types/homeroom.ts`)**: Add `teacherIds?: string[]` to the `Homeroom` interface.

### 2. Restrict `useStudents` for teachers

**File: `src/hooks/useStudents.ts`**

- Accept an optional `allowedHomerooms` parameter (or derive from auth context)
- For teachers: after fetching students, filter client-side to only include students whose `homeroom` field matches one of the teacher's assigned homerooms
- For admins: no filtering (see all)

### 3. Restrict `useClasses` for teachers

**File: `src/hooks/useClasses.ts`**

- After fetching all homerooms for the school, filter client-side for teachers: only return homerooms where `teacherIds` includes `user.uid`
- Admins continue to see all homerooms

### 4. Update Firestore rules

**File: `firestore.rules`**

Revert `homerooms` list rule to admin-only. Add a `get` rule allowing teachers to read homerooms where they're assigned:

```
match /homerooms/{homeroomId} {
  allow list: if isAdmin() && hasSchool();
  allow get: if hasSchool() && (resourceSameSchool() || resource.data.teacherIds.hasAny([request.auth.uid]));
  // create/update/delete remain admin-only
}
```

For `students`, add teacher restriction:
```
match /students/{id} {
  allow read: if isAdmin() && resourceSameSchool();
  // Teachers: handled by querying only their homerooms' students client-side,
  // but rules should also enforce it — requires knowing teacher's homerooms
}
```

**Note**: Firestore rules can't easily do a join (look up which homerooms a teacher belongs to, then check the student's homeroom). The practical approach is:
- Store the teacher's assigned homeroom codes on the `user_roles` document (e.g., `assignedHomerooms: ["2AF", "45E"]`)
- Then the student read rule becomes: `resource.data.homeroom in roleDoc().data.assignedHomerooms`

### 5. Add teacher-homeroom assignment UI in Admin tab

**File: `src/components/tabs/AdminTab.tsx`**

Add a section where admins can assign teachers to homerooms (multi-select). This writes `teacherIds` to the homeroom doc and `assignedHomerooms` to the teacher's `user_roles` doc (keeping both in sync).

### 6. Immediate short-term fix (while building the above)

Until teacher assignments exist, filter students client-side by requiring teachers to select a homeroom before seeing any students — don't show "All" to non-admin users.

**File: `src/components/tabs/StudentsTab.tsx`**: Hide the "All Students" option from the class dropdown for teachers. Teachers must pick a specific class.

## Summary of files to change

| File | Change |
|------|--------|
| `src/types/homeroom.ts` | Add `teacherIds` field |
| `src/hooks/useAuth.tsx` | Fetch `assignedHomerooms` from `user_roles` doc |
| `src/hooks/useStudents.ts` | Filter by assigned homerooms for teachers |
| `src/hooks/useClasses.ts` | Filter homerooms by teacher assignment |
| `src/components/tabs/StudentsTab.tsx` | Hide "All" option for teachers |
| `src/components/tabs/AdminTab.tsx` | Add teacher-homeroom assignment UI |
| `firestore.rules` | Restrict student reads by homeroom assignment |

