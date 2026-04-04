

## Add OEN to Edit Student Dialog

The edit dialog currently supports Gender, Focus Student, and High Need toggles but has no OEN input. This change adds an OEN field that hashes the value on save and clears it immediately.

### Changes — Single File

**`src/components/tabs/StudentsTab.tsx`**

1. Add `editOen` state (string, default empty) alongside existing `editGender`, `editFocus`, `editHighNeed`
2. Reset `editOen` to `''` in `openEditDialog` (never pre-populate — raw OEN is not stored)
3. In the edit dialog UI, add an OEN input field between the Gender select and the checkbox row:
   - Label: "OEN (optional — used only for CSV matching)"
   - Helper text: "Will be hashed for privacy. Raw OEN is never stored."
   - If `editingStudent.oenHash` already exists, show a small note: "OEN hash already on file"
4. In `handleSaveEdit`:
   - If `editOen` is non-empty, hash it with `hashOEN()`, check for duplicates against other students' `oenHash`, then include `oenHash` in the update payload
   - Clear `editOen` after save
5. Import `hashOEN` from `@/lib/oenHash`

No other files need changes — the `updateStudent` hook and `Student` type already support `oenHash`.

