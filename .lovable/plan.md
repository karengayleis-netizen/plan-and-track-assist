

## Fix: CSV Upload Failing Due to Validation Mismatch

### Problem
The `StudentSchema` in `src/lib/validations.ts` requires `firstName` and `lastName` to be non-empty (`min(1)`), but the CSV upload deliberately passes empty strings for privacy (students are identified by coded IDs like "1AF-3", not real names). This causes every row to fail validation.

### Fix
**File: `src/lib/validations.ts`** (lines 8-9)
- Change `firstName` from `z.string().min(1, ...)` to `z.string().max(50).default('')`
- Change `lastName` from `z.string().min(1, ...)` to `z.string().max(50).default('')`

This matches the app's privacy-first design where names are optional. No other files need changes.

