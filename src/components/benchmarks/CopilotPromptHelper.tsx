import { useState } from 'react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { getCopilotPrompt } from '@/lib/copilotPrompts';
import { useToast } from '@/hooks/use-toast';
import type { ImportSource } from '@/types/importWizard';
import { ChevronDown, ChevronRight, Copy, Check, Sparkles } from 'lucide-react';

interface CopilotPromptHelperProps {
  source: ImportSource;
}

export function CopilotPromptHelper({ source }: CopilotPromptHelperProps) {
  const prompt = getCopilotPrompt(source);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  if (!prompt) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      toast({ title: 'Copied to clipboard', description: 'Paste this prompt into Microsoft Copilot in Excel.' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'Copy failed', description: 'Please select and copy the text manually.', variant: 'destructive' });
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="border-border/40 bg-muted/30">
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center gap-2 p-3 text-left text-sm hover:bg-muted/50 rounded-lg transition-colors">
            {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
            <Sparkles className="h-4 w-4 text-primary shrink-0" />
            <span className="font-medium text-foreground">Need to transform your raw export first?</span>
            <span className="text-xs text-muted-foreground ml-1">Use Copilot in Excel</span>
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 px-3 pb-3 space-y-3">
            <div className="text-xs text-muted-foreground space-y-1.5 pl-6">
              <p className="font-medium text-foreground text-sm">How to use:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Open your raw export file in Excel</li>
                <li>Open Microsoft Copilot in the sidebar</li>
                <li>Copy and paste the prompt below into Copilot</li>
                <li>Save the "Import Ready" sheet as a CSV and upload it here</li>
              </ol>
            </div>
            <div className="relative ml-6">
              <pre className="text-xs bg-background border border-border rounded-md p-3 max-h-48 overflow-auto whitespace-pre-wrap font-mono text-muted-foreground">
                {prompt}
              </pre>
              <Button
                size="sm"
                variant="secondary"
                className="absolute top-2 right-2 h-7 text-xs gap-1"
                onClick={handleCopy}
              >
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
