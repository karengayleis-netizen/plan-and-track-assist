import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { ColumnMapping, InternalField } from '@/types/importWizard';
import { REQUIRED_FIELDS, OPTIONAL_FIELDS } from '@/types/importWizard';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { validateStudentIdentifierMapping, STUDENT_IDENTIFIER_DENY_LIST, STUDENT_IDENTIFIER_ALLOW_LIST } from '@/lib/csvParser';

interface MappingStepProps {
  headers: string[];
  mapping: ColumnMapping;
  onUpdateMapping: (field: InternalField, colIndex: number) => void;
  onConfirm: () => void;
  onBack: () => void;
}

const FIELD_LABELS: Record<InternalField, string> = {
  studentIdentifier: 'Student Number',
  assessmentType: 'Assessment Type',
  score: 'Score',
  date: 'Date',
  notes: 'Notes',
  ref: 'Reference',
  strand: 'Strand / Category',
  benchmarkWindow: 'Benchmark Window / Term',
  teacher: 'Teacher',
  classCode: 'Class Code',
  rawScore: 'Raw Score',
  percent: 'Percent',
  status: 'Status / Level',
};

export function MappingStep({ headers, mapping, onUpdateMapping, onConfirm, onBack }: MappingStepProps) {
  const allFields: InternalField[] = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS];

  const idValidity = validateStudentIdentifierMapping(mapping.studentIdentifier, headers);
  const otherRequiredMapped = REQUIRED_FIELDS.filter(f => f !== 'studentIdentifier').every(f => mapping[f] >= 0);
  const canContinue = idValidity.valid && otherRequiredMapped;

  // Hint: if a "class name" / "homeroom" / "classroom" header exists but classCode is unmapped
  const classNameHeaderIdx = headers.findIndex(h => {
    const l = h.toLowerCase().trim();
    return l === 'class name' || l === 'classname' || l === 'classroom' || l === 'homeroom' || l === 'class';
  });
  const showClassNameHint = classNameHeaderIdx >= 0 && mapping.classCode < 0;

  // Detect roster-ordinal vs board-ID identifier columns in the file.
  const rosterOrdinalIdx = headers.findIndex(h => STUDENT_IDENTIFIER_DENY_LIST.has(h.toLowerCase().trim()));
  const boardIdIdx = headers.findIndex(h => STUDENT_IDENTIFIER_ALLOW_LIST.has(h.toLowerCase().trim()));
  const showBothColumnsHint = rosterOrdinalIdx >= 0 && boardIdIdx >= 0;

  let invalidIdReason = '';
  if (idValidity.valid === false) {
    const reason = idValidity.reason;
    if (reason === 'denied') {
      invalidIdReason = `"${idValidity.headerName}" is a roster-ordinal column (1, 2, 3…). It cannot be used for matching. Please select Student Number / board ID.`;
    } else if (reason === 'not-allowed') {
      invalidIdReason = `"${idValidity.headerName}" is not a recognized board ID column. Please select a Student Number / board ID column manually.`;
    } else {
      invalidIdReason = 'No valid student identifier column was found automatically. Please select Student Number / board ID manually.';
    }
  }

  return (
    <div className="space-y-4">
      {showBothColumnsHint && idValidity.valid && (
        <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-3 text-xs">
          Detected <strong>"{headers[rosterOrdinalIdx]}"</strong> (roster ordinal) and <strong>"{headers[boardIdIdx]}"</strong> (board ID).
          {' '}Using <strong>"{headers[boardIdIdx]}"</strong> as Student Number.
        </div>
      )}
      {!idValidity.valid && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-destructive mb-0.5">Student Number is required and must be a board-ID column.</p>
            <p className="text-muted-foreground">{invalidIdReason}</p>
          </div>
        </div>
      )}
      {showClassNameHint && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 text-xs">
          Detected a <strong>"{headers[classNameHeaderIdx]}"</strong> column — consider mapping it to <strong>Class Code</strong> so homeroom info is saved with each benchmark.
        </div>
      )}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Map CSV columns to internal fields. <span className="text-destructive">*</span> = required.
        </p>
        <p className="text-xs text-muted-foreground">{headers.length} columns detected</p>
      </div>

      <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
        {allFields.map(field => {
          const isRequired = REQUIRED_FIELDS.includes(field);
          const currentVal = mapping[field];
          const isIdentifier = field === 'studentIdentifier';
          const idDenied = isIdentifier && currentVal >= 0 && STUDENT_IDENTIFIER_DENY_LIST.has((headers[currentVal] || '').toLowerCase().trim());

          return (
            <div key={field} className="flex items-center gap-3">
              <div className="w-52 shrink-0 flex items-center gap-1.5">
                <span className="text-sm font-medium truncate">{FIELD_LABELS[field]}</span>
                {isRequired && <span className="text-destructive text-xs">*</span>}
              </div>
              <Select
                value={currentVal >= 0 ? String(currentVal) : 'none'}
                onValueChange={v => onUpdateMapping(field, v === 'none' ? -1 : Number(v))}
              >
                <SelectTrigger className={`flex-1 text-sm h-9 ${isIdentifier && !idValidity.valid ? 'border-destructive/50' : ''}`}>
                  <SelectValue placeholder="— not mapped —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— not mapped —</SelectItem>
                  {headers.map((h, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {currentVal >= 0 && !idDenied && (
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  ✓
                </Badge>
              )}
              {idDenied && (
                <Badge variant="destructive" className="text-[10px] shrink-0">
                  ordinal
                </Badge>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Button disabled={!canContinue} onClick={onConfirm}>
          Preview & Validate
        </Button>
      </div>
    </div>
  );
}
