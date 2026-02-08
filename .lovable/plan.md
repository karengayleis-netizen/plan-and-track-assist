

## Update `useStaff.ts` to include `schoolId` in update path

**What**: Add the `schoolId` field to the `updateDoc` call inside `saveStaffMember`, so that existing staff documents also get their `schoolId` set/refreshed on update.

**Change**: In `src/hooks/useStaff.ts`, within the `saveStaffMember` function's `updateDoc` block (~line 155), add `schoolId: schoolId` to the update object.

**Technical detail**:
- File: `src/hooks/useStaff.ts`
- Location: The `if (existingDoc.exists())` branch inside `saveStaffMember`
- Current code updates `email`, `emailLower`, `role`, `canWrite`, `assignedHomerooms`, `displayName`, `updatedAt`
- Will add `schoolId: schoolId` to that same object

