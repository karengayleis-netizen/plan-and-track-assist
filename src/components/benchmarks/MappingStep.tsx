import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { ColumnMapping, InternalField } from '@/types/importWizard';
import { REQUIRED_FIELDS, OPTIONAL_FIELDS } from '@/types/importWizard';
import { ArrowLeft } from 'lucide-react';

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

  const requiredMapped = REQUIRED_FIELDS.every(f => mapping[f] >= 0);

  return (
    <div className="space-y-4">
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
                <SelectTrigger className="flex-1 text-sm h-9">
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
              {currentVal >= 0 && (
                <Badge variant="secondary" className="text-[10px] shrink-0">
                  ✓
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
        <Button disabled={!requiredMapped} onClick={onConfirm}>
          Preview & Validate
        </Button>
      </div>
    </div>
  );
}
