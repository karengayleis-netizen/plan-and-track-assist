

## Add Gender Field to Student Data

### What Changes
A `gender` field gets added to the Student type and flows through CSV upload, manual entry, display, and the Insights tab for gender-based analytics.

### Impact Assessment
This is a **low-risk, additive change** — no existing fields or logic are modified, just extended.

### Files to Change

**1. Student type** (`src/types/index.ts`)
- Add `gender?: string` to the `Student` interface (optional so existing data isn't broken)

**2. Validation schema** (`src/lib/validations.ts`)
- Add optional `gender` field to `StudentSchema`

**3. CSV upload** (`src/components/tabs/StudentsTab.tsx`)
- Change expected format from 3 columns to 4: `StudentNumber, Initials, Grade, Gender`
- Keep backward-compatible: if only 3 columns, gender defaults to empty
- Pass `gender` into `addStudent()`

**4. Manual entry form** (`src/components/tabs/StudentsTab.tsx`)
- Add a Gender dropdown (M / F / X / blank) in the manual add form

**5. Student table display** (`src/components/tabs/StudentsTab.tsx`)
- Add Gender column to the roster table

**6. Insights tab** (`src/components/tabs/InsightsTab.tsx`)
- Add a gender breakdown stat card or chart (e.g., bar chart showing at-risk counts by gender, or a simple distribution pie)

### CSV Format Change
Your CSV columns become: `StudentNumber, Initials, Grade, Gender`
- Gender column is optional — rows with only 3 columns still work
- Your existing Excel file already has the Gender column, so you just need to include it when saving to CSV

### Technical Details
- `gender` is stored as an optional string field in Firestore — no migration needed for existing students (they'll just have `undefined`)
- All existing queries and hooks remain unchanged since it's just an additional field on the document

