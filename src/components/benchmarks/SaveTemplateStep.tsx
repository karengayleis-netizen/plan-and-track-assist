import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ImportSource } from '@/types/importWizard';
import { getPreset } from '@/lib/importPresets';
import { Save, Check } from 'lucide-react';
import { toast } from 'sonner';

interface SaveTemplateStepProps {
  source: ImportSource;
  onSave: (name: string) => Promise<void>;
  onClose: () => void;
}

export function SaveTemplateStep({ source, onSave, onClose }: SaveTemplateStepProps) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const preset = getPreset(source);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Please enter a template name');
      return;
    }
    setSaving(true);
    try {
      await onSave(name.trim());
      setSaved(true);
      toast.success('Template saved');
    } catch {
      toast.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div className="text-center space-y-4 py-6">
        <Check className="h-12 w-12 text-green-500 mx-auto" />
        <p className="font-semibold">Template saved!</p>
        <p className="text-sm text-muted-foreground">
          You can reuse "{name}" next time you import from {preset.label}.
        </p>
        <Button onClick={onClose}>Done</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Save this column mapping for future {preset.label} imports.
      </p>
      <div className="space-y-2">
        <Label htmlFor="templateName">Template Name</Label>
        <Input
          id="templateName"
          placeholder={`e.g. ${preset.label} Winter`}
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={100}
        />
      </div>
      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onClose}>Skip</Button>
        <Button onClick={handleSave} disabled={saving || !name.trim()}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save Template'}
        </Button>
      </div>
    </div>
  );
}
