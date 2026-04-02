

## Fix: Sort All-Students View by Homeroom First, Then Number

### Problem
When admin views all students (no homeroom filter selected), the current sort only uses the numeric suffix. This groups all #1s together, then all #2s, etc. — teachers expect to see each homeroom's students grouped together in attendance order (1AF-1 through 1AF-20, then 2AF-1 through 2AF-20, etc.).

### Fix
**File: `src/components/tabs/StudentsTab.tsx`** (~line 284)

Update the `.sort()` comparator to sort primarily by homeroom code, then by numeric suffix:

```typescript
.sort((a, b) => {
  // Primary sort: homeroom code alphabetically
  const homeA = a.homeroom || '';
  const homeB = b.homeroom || '';
  const homeCmp = homeA.localeCompare(homeB);
  if (homeCmp !== 0) return homeCmp;
  // Secondary sort: student number numerically
  const numA = parseInt(a.studentNumber?.split('-').pop() || '0', 10);
  const numB = parseInt(b.studentNumber?.split('-').pop() || '0', 10);
  return numA - numB;
});
```

Single change, one file. When a specific homeroom is selected the primary sort is a no-op (all same homeroom), so existing per-class behavior is unchanged.

