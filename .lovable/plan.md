

## Fix: Allow CSV Upload with Privacy-First Format

### Problem
The `StudentSchema` validation requires `firstName` and `lastName` to be non-empty, but the CSV upload intentionally leaves these blank (using coded IDs like "1AF-3" instead of real names). This causes every row to fail with "Failed to save student".

### Fix
**Single file change: `src/lib/validations.ts`** (lines 8-9)

Change:
```typescript
firstName: z.string().min(1, 'First name is required').max(50, ...),
lastName: z.string().min(1, 'Last name is required').max(50, ...),
```

To:
```typescript
firstName: z.string().max(50, 'First name must be 50 characters or less').default(''),
lastName: z.string().max(50, 'Last name must be 50 characters or less').default(''),
```

This is a one-line-each change. No other files are affected. The 4-column CSV format (`StudentNumber, Initials, Grade, Gender`) is already handled correctly in the upload logic.

