

## Fix: Don't query Firestore until auth is fully resolved

### Root cause
`useAuth` sets a placeholder user with `role: 'teacher'` and no `schoolId` the instant Firebase Auth fires, then asynchronously fetches the real role and `schoolId`. Hooks like `useStudents` listen on `user?.schoolId` and fire immediately against the placeholder — producing a guaranteed `Missing or insufficient permissions` error on every login before the real values arrive and a second (successful) query runs.

The data eventually loads (252 students confirmed), but every sign-in throws a scary console error and wastes a Firestore round-trip.

### What changes

**1. `src/hooks/useAuth.tsx` — Stop publishing the placeholder user**
Remove the immediate `setUser({ ...placeholder, role: 'teacher' })` call inside `onAuthStateChanged`. Keep `loading: true` until the async block finishes resolving role + `schoolId`, then publish the fully-hydrated user in a single `setUser` call. This guarantees consumers never see a half-built user object.

**2. `src/hooks/useStudents.ts` — Guard against missing `schoolId`**
Defensive belt-and-suspenders: in `fetchStudents`, early-return (without setting an error) if `!user?.schoolId`. Also update the `useEffect` dependency to `[user?.schoolId, user?.role]` and skip the fetch entirely when `schoolId` is falsy. This prevents any future code path from triggering the same race.

**3. Apply the same guard to `useClasses`, `useBenchmarks`, `useMarkbook`, `useStaff`** (quick audit — most already gate on `schoolId`, but confirm and patch any that don't).

### Why not just suppress the error?
The placeholder user is the actual bug — it briefly tells the entire app "you are a teacher with no school," which could trigger wrong UI flashes (e.g., teacher-only views, empty states) beyond just the Firestore error. Removing it fixes the root cause.

### Technical details

- `useAuth.tsx`: delete lines that call `setUser({ uid, email, displayName, role: 'teacher' })` before the `setTimeout`. Keep `loading` true throughout the async resolve. The existing `<Loader2>` spinner in `Dashboard.tsx` already covers this loading window, so users see a brief spinner instead of a flash of empty state.
- `useStudents.ts`: add `if (!user?.schoolId) { setLoading(false); return; }` at the top of `fetchStudents`. Change the effect to `useEffect(() => { if (user?.schoolId) fetchStudents(); }, [user?.schoolId])`.
- No security rule changes needed — rules are correct; the client was just sending bad queries.
- No changes to the CSV import flow or the Acadience-ready file you uploaded — that's a separate workstream.

### Expected result
- Clean console on login (no permission errors).
- One Firestore query per collection per login instead of two.
- No UI flash of teacher-mode views for admin users.

