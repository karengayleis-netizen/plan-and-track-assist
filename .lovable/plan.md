

## Privacy-Safe OEN Matching (with Manual Entry)

This plan implements exactly what you've outlined — OEN hashing for CSV matching with manual entry support, no raw OEN ever stored or displayed.

### Changes

**1. `src/types/index.ts`** — Add `oenHash?: string` to `Student` interface

**2. `src/lib/validations.ts`** — Add `oenHash: z.string().max(128).optional()` to `StudentSchema`

**3. `src/lib/oenHash.ts`** (new) — SHA-256 hashing utility using Web Crypto API, with privacy comment

**4. `src/components/tabs/StudentsTab.tsx`**
- Add OEN input field to manual entry form (labeled "OEN (optional – used only for CSV matching)")
- On save: hash OEN, store only `oenHash`, clear input
- Duplicate check: reject if another student has the same `oenHash`
- Update CSV upload to support optional 5th column `OEN` → hash and store as `oenHash`
- Update help text noting OEN is optional, never stored or displayed
- CSV export: no OEN or oenHash in output

**5. `src/components/tabs/BenchmarksTab.tsx`**
- CSV upload format: `OEN, Type, Score, Date, Notes, Ref`
- Match by hashing incoming OEN against stored `oenHash`
- Fallback to coded `studentNumber` for backward compatibility
- CSV export: continue using coded `studentNumber` only
- Update help text

**6. `src/hooks/useStudents.ts`** — Ensure `oenHash` flows through add/update operations

### Privacy enforced
- No raw OEN in Firestore, UI, logs, or exports
- Raw OEN exists only transiently in form input and CSV processing memory
- Existing students without `oenHash` continue working via coded student number

