## Plan: Describe the tool in detail to Claude

### Goal
Produce a comprehensive, copy-paste-ready description of the **Plan & Track Assist** app so you can share it with Claude (or another AI) with full context.

### What I know from the codebase

**Project identity**
- Name: **Plan & Track Assist**
- Built for Ontario’s Growing Success framework.
- Landing page frames it as a student-intervention planning SaaS: track progress, record benchmarks, triangulate evidence, and generate AI support plans.
- Tech stack: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui + Firebase (Firestore, Auth, 1st Gen Cloud Functions).

**Users & roles**
- Two roles: `teacher` and `admin`.
- Role and `schoolId` live in `user_roles/{uid}` and are synced to Firebase Auth custom claims.
- Teachers can be restricted to assigned homerooms.
- Admins can manage staff, classes, and whole-school analytics.

**Data model (flat, school-isolated Firestore collections)**
- `students` — identity keyed by board `studentNumber`; privacy-friendly display: `initials · homeroom · #last3`.
- `benchmarks` — assessment scores, Acadience-aware fields (`scoreLabel`, `rawScore`, `benchmarkWindow`, `assessmentFamily`, etc.).
- `markbook` / `evidence` — observations, conversations, products.
- `classes` — homerooms with allowed grade lists.
- `staff` — staff directory and role assignment.
- `user_roles` — role and school.
- `supportPlans` — type only; the Support Plan tab is currently an embedded iframe.

**Tabs / features**
1. **Students** — roster management, add/edit, replace roster from board CSV, tags, focus/high-need flags, gender.
2. **Benchmarks** — manual entry + 6-step Import Wizard for CSVs (Acadience, DIBELS, Knowledgehook, generic). Includes saved column mapping templates.
3. **Markbook** — observation/assessment entry by subject/strand.
4. **Insights** — filtered KPIs, risk distribution, class growth trends, deep-dive per student.
5. **Triangulation** — quick evidence entry (observation/conversation/product) for Growing Success evidence.
6. **Missing Data** — data-health view: stale data, missing benchmarks, missing triangulation.
7. **Support Plan** — embedded iframe to Lovable magic API for IEP-style support plans.
8. **Admin** — principal/leadership dashboard: filters by grade/homeroom/gender/measure/window/status band; teacher analytics; class management; staff directory; export.

**Privacy & security**
- No student names stored; board `studentNumber` is internal, coded `studentNumber` is UI.
- Firestore rules enforce school-level isolation and role checks.
- Full student numbers only appear in admin import/export/debug views.

**Current state / caveats**
- Benchmarks tab is functional but still being refined; the user asked to hide it from view until ready.
- Support Plan is an iframe, not a native data collection.
- AI Strategy card was removed from Admin because the backend function was not deployed.
- Recent fixes: roster replace Cloud Function, undefined-field bug in benchmark import, kindergarten grade normalization, Acadience status classification.

### Plan

1. **Confirm the format** with one question (see below) so the description is immediately useful.
2. **Draft a comprehensive description** in markdown containing:
   - Executive summary
   - User roles and permissions
   - Data model and privacy design
   - Feature-by-feature breakdown
   - Technical architecture
   - Current status & known limitations
   - What Claude can help with next (optional section)
3. **Deliver as copy-pasteable text** in the chat, ready for Claude.

### One clarifying question

To make the description as useful as possible, please tell me which **audience** this is for:
- **Option A** — A developer or technical AI who will continue building features (heavy on code, data model, architecture, known bugs).
- **Option B** — A school leader or prospective pilot user (heavy on value, features, privacy, workflow).
- **Option C** — A general-purpose Claude context that needs both technical and product detail (balanced, the default).

Reply with A, B, or C, or tell me the specific scenario. If you don’t reply, I’ll default to Option C and produce the description in the next step.
