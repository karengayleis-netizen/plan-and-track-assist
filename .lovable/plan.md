

# Plan: Remove Duplicate School Roster from Benchmarks, Markbook, and Triangulation Tabs

## Summary

Three tabs (Benchmarks, Markbook, Triangulation) contain a duplicate "School Roster (Class-based)" section that belongs only in the Students tab. This plan removes those duplicates while keeping each tab's core functionality intact.

## What Will Be Removed

Each affected tab has an identical School Roster card that will be deleted:

| Tab | Current Content | Keeping |
|-----|-----------------|---------|
| **Benchmarks** | School Roster card + Record Data + Recent Benchmarks + CSV Actions | Record Data, Recent Benchmarks, Bulk CSV Actions |
| **Markbook** | School Roster card + New Observation + Markbook Entries | New Observation form, Markbook Entries list |
| **Triangulation** | School Roster card + Student Triangulation table | Student Triangulation table with filters |

## Implementation Steps

### Step 1: Clean BenchmarksTab.tsx
- Remove the entire "School Roster (Class-based)" Card component (lines 75-167)
- Remove unused state variables: `selectedClass`, `searchQuery`
- Remove unused imports: `Label`, `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`, `Search`, `RefreshCw`, `Upload`
- Keep: Record Data form, Recent Benchmarks list, Bulk CSV Actions

### Step 2: Clean MarkbookTab.tsx
- Remove the entire "School Roster (Class-based)" Card component (lines 74-166)
- Remove unused state variables: `selectedClass`, `searchQuery`
- Remove unused imports: `Label`, `Table`, `TableBody`, `TableCell`, `TableHead`, `TableHeader`, `TableRow`, `Search`, `RefreshCw`, `Upload`
- Keep: New Observation form, Markbook Entries list

### Step 3: Clean TriangulationTab.tsx
- Remove the entire "School Roster (Class-based)" Card component (lines 38-130)
- Remove unused state variable: `selectedClass`
- Keep: Student Triangulation table with filters, search functionality (this is unique to triangulation)

## Result After Changes

| Tab | Purpose |
|-----|---------|
| **Students** | Single source for roster management (CSV upload, add/edit/delete students) |
| **Benchmarks** | Record benchmark data for existing students, view recent entries |
| **Markbook** | Record observations/grades for existing students, view entries |
| **Triangulation** | Holistic view of all data points per student with filtering |

## Technical Details

### Files to Modify
1. `src/components/tabs/BenchmarksTab.tsx`
2. `src/components/tabs/MarkbookTab.tsx`
3. `src/components/tabs/TriangulationTab.tsx`

### Code Changes Summary

**BenchmarksTab.tsx**
- Remove lines 75-167 (School Roster Card)
- Remove line 19: `selectedClass` state
- Remove line 20: `searchQuery` state
- Remove lines 68-71: `filteredStudents` variable
- Clean up unused imports

**MarkbookTab.tsx**
- Remove lines 74-166 (School Roster Card)
- Remove line 19: `selectedClass` state
- Remove line 20: `searchQuery` state
- Clean up unused imports

**TriangulationTab.tsx**
- Remove lines 38-130 (School Roster Card)
- Remove line 18: `selectedClass` state
- Keep line 19: `searchQuery` state (used in triangulation table)
- Clean up unused imports

