## Goal

Give you a single, self-contained file containing the full Student Support Plan Generator source so you can hand it to Claude in one paste/upload.

## What I'll produce

A downloadable Markdown bundle (`support-plan-generator.md`) written to your documents area, containing:

1. **Context header** — what the tool is (Ontario K–5 asset-based support plan generator), where it lives (the separate "Remix of Key Result Generator" project, published as `magic-api-spark.lovable.app`), and how Plan & Track Assist embeds it via an iframe in `SupportPlanTab.tsx`.
2. **Stack notes** — Vite + React + TypeScript + shadcn/ui + Tailwind, Supabase Edge Function, Lovable AI Gateway with `google/gemini-2.5-pro`, SSE streaming.
3. **Full source, file by file, each in a fenced code block with its path:**
   - `src/types/supportPlan.ts`
   - `src/pages/Index.tsx`
   - `src/components/support-plan/StudentProfile.tsx`
   - `src/components/support-plan/ObservedStruggles.tsx`
   - `src/components/support-plan/StudentPortrait.tsx`
   - `src/components/support-plan/GeneratedPlan.tsx`
   - `src/hooks/useSupportPlanGenerator.ts`
   - `supabase/functions/generate-support-plan/index.ts` (including the complete SYSTEM_PROMPT and resource bank)
   - `src/components/tabs/SupportPlanTab.tsx` (the iframe wrapper in this project)
4. **A short "how it flows" section** — form state → validation → POST to edge function → Gemini streaming → markdown render → print/PDF.

## Notes

- No environment values or keys are included — only the variable names (`LOVABLE_API_KEY`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`).
- No changes are made to your app's code; this only creates a document you can download.
- If you'd rather have a `.zip` of the actual files, or a plain `.txt`, say so and I'll switch the format.
