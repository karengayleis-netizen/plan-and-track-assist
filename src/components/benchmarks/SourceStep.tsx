import { Card, CardContent } from '@/components/ui/card';
import { getAllPresets } from '@/lib/importPresets';
import type { ImportSource } from '@/types/importWizard';
import { BookOpen, Calculator, FileSpreadsheet, BarChart3 } from 'lucide-react';

const sourceIcons: Record<ImportSource, React.ReactNode> = {
  acadience: <BookOpen className="h-6 w-6" />,
  dibels: <BarChart3 className="h-6 w-6" />,
  knowledgehook: <Calculator className="h-6 w-6" />,
  generic_csv: <FileSpreadsheet className="h-6 w-6" />,
};

interface SourceStepProps {
  onSelect: (source: ImportSource) => void;
}

export function SourceStep({ onSelect }: SourceStepProps) {
  const presets = getAllPresets();

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Choose the source of your CSV file to auto-detect column mappings.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {presets.map(preset => (
          <Card
            key={preset.source}
            className="cursor-pointer border-border/50 hover:border-primary/50 hover:bg-muted/30 transition-all"
            onClick={() => onSelect(preset.source)}
          >
            <CardContent className="p-4 flex flex-col items-center text-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                {sourceIcons[preset.source]}
              </div>
              <h3 className="font-semibold text-sm">{preset.label}</h3>
              <p className="text-xs text-muted-foreground leading-snug">
                {preset.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
