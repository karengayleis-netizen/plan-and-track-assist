import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { getPreset } from '@/lib/importPresets';
import type { ImportSource, ImportTemplate } from '@/types/importWizard';
import { Upload, ArrowLeft, FileText } from 'lucide-react';

interface UploadStepProps {
  source: ImportSource;
  onUpload: (file: File) => void;
  onBack: () => void;
  templates: ImportTemplate[];
  onLoadTemplates: () => void;
  onApplyTemplate: (t: ImportTemplate) => void;
}

export function UploadStep({ source, onUpload, onBack, templates, onLoadTemplates, onApplyTemplate }: UploadStepProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const preset = getPreset(source);

  useEffect(() => {
    onLoadTemplates();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className="px-2 py-0.5 rounded bg-primary/10 text-primary font-medium text-xs">
          {preset.label}
        </span>
        <span>— {preset.assessmentFamily} assessment</span>
      </div>

      <Card className="border-dashed border-2 border-border/50">
        <CardContent className="p-6 flex flex-col items-center gap-3">
          <Upload className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Select a CSV file to upload</p>
          <Input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="max-w-xs"
          />
          {selectedFile && (
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
              <FileText className="h-3.5 w-3.5" />
              {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
            </div>
          )}
        </CardContent>
      </Card>

      {templates.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Saved Templates</p>
          <div className="flex flex-wrap gap-2">
            {templates.map(t => (
              <Button
                key={t.id}
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={() => onApplyTemplate(t)}
              >
                {t.templateName}
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <Button
          disabled={!selectedFile}
          onClick={() => selectedFile && onUpload(selectedFile)}
        >
          Parse File
        </Button>
      </div>
    </div>
  );
}
