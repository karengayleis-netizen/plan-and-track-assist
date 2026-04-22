import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useImportWizard } from '@/hooks/useImportWizard';
import { WizardStep, WIZARD_STEP_LABELS } from '@/types/importWizard';
import { SourceStep } from './SourceStep';
import { UploadStep } from './UploadStep';
import { MappingStep } from './MappingStep';
import { PreviewStep } from './PreviewStep';
import { ResultsStep } from './ResultsStep';
import { SaveTemplateStep } from './SaveTemplateStep';
import { cn } from '@/lib/utils';

interface ImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export function ImportWizard({ open, onOpenChange, onComplete }: ImportWizardProps) {
  const wizard = useImportWizard(onComplete);
  const { state } = wizard;

  const handleClose = () => {
    wizard.reset();
    onOpenChange(false);
  };

  const renderStep = () => {
    switch (state.step) {
      case WizardStep.ChooseSource:
        return <SourceStep onSelect={wizard.selectSource} />;
      case WizardStep.UploadCSV:
        return (
          <UploadStep
            source={state.source!}
            onUpload={wizard.uploadFile}
            onBack={() => wizard.setStep(WizardStep.ChooseSource)}
            templates={state.templates}
            onLoadTemplates={wizard.loadTemplates}
            onApplyTemplate={wizard.applyTemplate}
          />
        );
      case WizardStep.MapColumns:
        return (
          <MappingStep
            headers={state.headers}
            mapping={state.columnMapping}
            onUpdateMapping={wizard.updateMapping}
            onConfirm={wizard.confirmMapping}
            onBack={() => wizard.setStep(WizardStep.UploadCSV)}
          />
        );
      case WizardStep.PreviewValidate:
        return (
          <PreviewStep
            rows={state.importRows}
            onImport={wizard.runImport}
            importing={state.importing}
            onBack={() => wizard.setStep(WizardStep.MapColumns)}
            studentsLoading={wizard.studentsLoading}
            classCodeMapped={state.columnMapping.classCode >= 0}
            students={wizard.students}
          />
        );
      case WizardStep.ImportResults:
        return (
          <ResultsStep
            result={state.result!}
            rows={state.importRows}
            errorSummary={wizard.errorSummary}
            onDownloadErrors={wizard.downloadErrorReport}
            onSaveTemplate={() => wizard.setStep(WizardStep.SaveTemplate)}
            onClose={handleClose}
          />
        );
      case WizardStep.SaveTemplate:
        return (
          <SaveTemplateStep
            source={state.source!}
            onSave={wizard.saveTemplate}
            onClose={handleClose}
          />
        );
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold">Import Benchmarks</DialogTitle>
        </DialogHeader>

        {/* Step Progress */}
        <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
          {WIZARD_STEP_LABELS.map((label, i) => (
            <div key={label} className="flex items-center">
              <div className={cn(
                'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors',
                i === state.step
                  ? 'bg-primary text-primary-foreground'
                  : i < state.step
                    ? 'bg-primary/20 text-primary'
                    : 'bg-muted text-muted-foreground'
              )}>
                <span className={cn(
                  'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold',
                  i === state.step
                    ? 'bg-primary-foreground text-primary'
                    : i < state.step
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted-foreground/30 text-muted-foreground'
                )}>
                  {i < state.step ? '✓' : i + 1}
                </span>
                {label}
              </div>
              {i < WIZARD_STEP_LABELS.length - 1 && (
                <div className={cn(
                  'w-4 h-px mx-0.5',
                  i < state.step ? 'bg-primary' : 'bg-border'
                )} />
              )}
            </div>
          ))}
        </div>

        {renderStep()}
      </DialogContent>
    </Dialog>
  );
}
