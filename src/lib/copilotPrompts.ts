import type { ImportSource } from '@/types/importWizard';

const acadiencePrompt = `Take this Acadience Reading export spreadsheet and reshape it from wide format to long format. Create a new sheet called "Import Ready" with these exact columns in this order:

Student Number, Measure, Score, Date, Window, Status, Class Name

TRANSFORMATION RULES:

For EACH student row, create a SEPARATE row for each of these measures (only if the Score column is not blank):

1. FSF → Measure: "FSF", Score: FSF Score, Date: FSF Date, Status: FSF Status
2. LNF → Measure: "LNF", Score: LNF Score, Date: LNF Date, Status: (leave blank, no status column)
3. PSF → Measure: "PSF", Score: PSF Score, Date: PSF Date, Status: PSF Status
4. NWF CLS → Measure: "NWF-CLS", Score: NWF CLS Score, Date: NWF Date, Status: NWF CLS Status
5. NWF WWR → Measure: "NWF-WWR", Score: NWF WWR Score, Date: NWF Date, Status: NWF WWR Status
6. ORF Words Correct → Measure: "ORF-WC", Score: ORF WC Score, Date: ORF Date, Status: ORF WC Status
7. ORF Accuracy → Measure: "ORF-Accuracy", Score: ORF Accuracy Score, Date: ORF Date, Status: ORF Accuracy Status
8. Retell → Measure: "Retell", Score: Retell Score, Date: ORF Date, Status: Retell Status
9. Maze → Measure: "Maze", Score: Maze Adjusted Score, Date: Maze Date, Status: Maze Status
10. Reading Composite → Measure: "Reading Composite", Score: Reading Composite Score, Date: Reading Composite Date, Status: Reading Composite Status

COLUMN MAPPING:
- "Student Number" → copy from the Student Number column
- "Window" → copy from the Benchmark Period column (e.g., "Beginning", "Middle", "End")
- "Class Name" → copy from the Class Name column

IMPORTANT:
- Skip any measure row where the Score is blank or empty
- Do NOT include assessor columns (Assessor Primary ID, Assessor Last Name, etc.)
- Do NOT include student names — only Student Number
- Do NOT include demographic columns
- Save/export the "Import Ready" sheet as a CSV file`;

const dibelsPrompt = `Take this DIBELS 8th Edition export spreadsheet and reshape it from wide format to long format. Create a new sheet called "Import Ready" with these exact columns in this order:

Student Number, Measure, Score, Date, Window, Status, Class Name

TRANSFORMATION RULES:

For EACH student row, create a SEPARATE row for each of these measures (only if the Score column is not blank):

1. FSF → Measure: "FSF", Score: FSF Score, Date: FSF Date, Status: FSF Status
2. LNF → Measure: "LNF", Score: LNF Score, Date: LNF Date, Status: LNF Status
3. PSF → Measure: "PSF", Score: PSF Score, Date: PSF Date, Status: PSF Status
4. NWF CLS → Measure: "NWF-CLS", Score: NWF CLS Score, Date: NWF Date, Status: NWF CLS Status
5. NWF WRC → Measure: "NWF-WRC", Score: NWF WRC Score, Date: NWF Date, Status: NWF WRC Status
6. ORF Correct → Measure: "ORF-Correct", Score: ORF Correct Score, Date: ORF Date, Status: ORF Correct Status
7. ORF Accuracy → Measure: "ORF-Accuracy", Score: ORF Accuracy Score, Date: ORF Date, Status: ORF Accuracy Status
8. Retell → Measure: "Retell", Score: Retell Score, Date: ORF Date, Status: Retell Status
9. Maze → Measure: "Maze", Score: Maze Adjusted Score, Date: Maze Date, Status: Maze Status
10. Composite → Measure: "Composite", Score: Composite Score, Date: Composite Date, Status: Composite Status

COLUMN MAPPING:
- "Student Number" → copy from the Student Number or Student ID column
- "Window" → copy from the Benchmark Period or Assessment Period column
- "Class Name" → copy from the Class Name, Classroom, or Teacher column

IMPORTANT:
- Skip any measure row where the Score is blank or empty
- Do NOT include assessor columns
- Do NOT include student names — only Student Number
- Do NOT include demographic columns
- Save/export the "Import Ready" sheet as a CSV file`;

const knowledgehookPrompt = `Take this Knowledgehook export spreadsheet and reshape it for import. Create a new sheet called "Import Ready" with these exact columns in this order:

Student Number, Measure, Score, Date, Window, Status, Class Name

TRANSFORMATION RULES:
- "Student Number" → copy from the Student ID or Student Number column
- "Measure" → use the Assessment Name, Skill, or Strand column value
- "Score" → copy from the Score or Percentage column
- "Date" → copy from the Date or Assessment Date column
- "Window" → copy from the Term or Period column (if available, otherwise leave blank)
- "Status" → leave blank (Knowledgehook doesn't use benchmark status labels)
- "Class Name" → copy from the Class, Section, or Teacher column

IMPORTANT:
- Keep one row per student per assessment/skill
- Do NOT include student names — only Student Number
- Save/export the "Import Ready" sheet as a CSV file`;

const prompts: Record<string, string> = {
  acadience: acadiencePrompt,
  dibels: dibelsPrompt,
  knowledgehook: knowledgehookPrompt,
};

export function getCopilotPrompt(source: ImportSource): string | null {
  return prompts[source] || null;
}
