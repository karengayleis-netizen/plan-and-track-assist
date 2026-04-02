

## Fix: Sort Students by Number in Roster Table

### Problem
Firestore returns documents in arbitrary order. Students appear as 3, 11, 19, 9... instead of 1, 2, 3... which breaks the attendance-order expectation teachers rely on.

### Fix
**File: `src/components/tabs/StudentsTab.tsx`**

After filtering students by homeroom and search query (~line 196), sort `filteredStudents` by extracting the numeric suffix from the coded student number (e.g., "1AF-3" → 3) and sorting numerically:

```typescript
const filteredStudents = classStudents
  .filter(s => 
    s.studentNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.initials?.toLowerCase().includes(searchQuery.toLowerCase())
  )
  .sort((a, b) => {
    const numA = parseInt(a.studentNumber?.split('-').pop() || '0', 10);
    const numB = parseInt(b.studentNumber?.split('-').pop() || '0', 10);
    return numA - numB;
  });
```

This is a single change in one file. Students will display in attendance order (1, 2, 3, ..., 20) as teachers expect.

