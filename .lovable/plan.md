

## Add temporary AUTH UID diagnostic log to useAuth

### Change

**File: `src/hooks/useAuth.tsx`**

Add a `useEffect` inside the `AuthProvider` component that logs the authenticated user's UID as soon as it's available:

```typescript
useEffect(() => {
  if (user?.uid) {
    console.log("AUTH UID FROM APP:", user.uid);
  }
}, [user?.uid]);
```

`useEffect` is already imported in this file, so no import changes are needed.

This goes inside the `AuthProvider` function, after the existing `useEffect` block (around line 90), before the `signIn` function.

### Summary
- 1 file modified: `src/hooks/useAuth.tsx`
- 1 small addition (~5 lines)
- No dependencies or other files affected

