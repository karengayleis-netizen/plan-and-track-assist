## Why it fails

The "AI Strategy (Peel/ON)" button in `AdminTab.tsx` calls a Firebase callable named `analyzeSchoolData`, but no such function is deployed (`functions/src/index.ts` only exports user-management, roster, and import helpers). Every click hits a 404-style error which the `catch {}` swallows into a generic "Failed to analyze" toast.

You chose: **remove the card for now**.

## Changes

In `src/components/tabs/AdminTab.tsx`:

1. Delete the entire AI Strategy `<Card>` (currently lines 1168–1215) and collapse the parent `<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">` so the **Tracked Students (At-Risk)** card spans the full width.
2. Remove the now-unused `handleAnalyze` function (lines 316–351).
3. Remove unused state: `selectedProgram`, `isAnalyzing`, `aiRecommendations` (lines 73–75).
4. Drop unused imports that only the AI card used:
   - `Sparkles`, `Loader2` from `lucide-react` (verify no other usage in file before removing)
   - `httpsCallable`, `functions` (verify no other usage)
   - `AnalyzeSchoolDataResponse` type
   - The `Select`/`SelectContent`/`SelectItem`/`SelectTrigger`/`SelectValue` imports stay — they're used elsewhere in the file.

I'll grep each import for other usages in the file before removing it to avoid breaking the build.

## Out of scope

- No changes to `functions/src/index.ts` or memory entries. The "AI Strategy Analysis" memory note can stay as documentation of intent; we can revisit when you decide whether to bring this back via Lovable AI Gateway or a deployed Cloud Function.