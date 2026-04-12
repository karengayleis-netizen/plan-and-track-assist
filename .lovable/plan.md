

## Copilot Prompt Generator for CSV Transformation

### What this does

Adds a "Need to transform your export first?" helper to the Import Wizard's Upload step. For each assessment source (Acadience, DIBELS, Knowledgehook), it provides a ready-to-copy prompt that teachers paste into Microsoft Copilot along with their raw export file. Copilot then reshapes the wide-format data into the long-format CSV the import wizard expects.

### How it works

1. **New file: `src/lib/copilotPrompts.ts`** — Contains per-source Copilot prompt templates. Each prompt is a detailed, tested instruction string that tells Copilot exactly how to reshape that source's export (e.g., Acadience wide-to-long with the correct measure mappings: FSF, LNF, PSF, NWF CLS, NWF WWR, ORF WC, Retell, Maze, Reading Composite). Includes the target columns (`Student Number, Measure, Score, Date, Window, Status, Class Name`) and rules like "skip blank scores" and "exclude assessor columns."

2. **New component: `src/components/benchmarks/CopilotPromptHelper.tsx`** — A collapsible card shown on the Upload step. When expanded, it displays the source-specific Copilot prompt in a styled text block with a "Copy to Clipboard" button. Includes a brief 3-step instruction: (1) Open your raw export in Excel, (2) Open Copilot, (3) Paste this prompt, (4) Save the result as CSV and upload here.

3. **Modified: `src/components/benchmarks/UploadStep.tsx`** — Adds the `CopilotPromptHelper` component between the source badge and the file upload area. Only shown for sources that have a transformation prompt (not for `generic_csv`).

### Technical details

- **`copilotPrompts.ts`** exports a `getCopilotPrompt(source: ImportSource): string | null` function. Returns `null` for `generic_csv`.
- The Acadience prompt handles the wide-format with ~90 columns, mapping each measure group (FSF, LNF, PSF, NWF CLS, NWF WWR, ORF WC, ORF Accuracy, Retell, Maze, Reading Composite) into separate rows.
- DIBELS prompt follows the same pattern with DIBELS-specific column names.
- Knowledgehook prompt is simpler since exports are closer to long format already.
- Uses the existing `Collapsible` UI component and a `navigator.clipboard.writeText()` call with a toast confirmation on copy.
- No external dependencies needed.

