import { useState, useRef, KeyboardEvent } from 'react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { STUDENT_TAGS } from '@/types';
import { X } from 'lucide-react';

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
}

export function TagInput({ value, onChange, suggestions = [...STUDENT_TAGS], placeholder = 'Add tag…' }: TagInputProps) {
  const [input, setInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput('');
    setShowSuggestions(false);
  };

  const removeTag = (tag: string) => {
    onChange(value.filter(t => t !== tag));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      addTag(input);
    }
    if (e.key === 'Backspace' && !input && value.length > 0) {
      removeTag(value[value.length - 1]);
    }
  };

  const filtered = suggestions.filter(
    s => !value.includes(s) && s.toLowerCase().includes(input.toLowerCase())
  );

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1.5 p-2 border border-input rounded-md bg-background min-h-[38px] cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {value.map(tag => (
          <Badge key={tag} variant="secondary" className="text-xs gap-1 pr-1">
            {tag}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
              className="hover:text-destructive transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <Input
          ref={inputRef}
          value={input}
          onChange={e => { setInput(e.target.value); setShowSuggestions(true); }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          placeholder={value.length === 0 ? placeholder : ''}
          className="border-0 shadow-none p-0 h-6 text-sm focus-visible:ring-0 flex-1 min-w-[80px]"
        />
      </div>

      {showSuggestions && filtered.length > 0 && (
        <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-popover border border-border rounded-md shadow-md max-h-36 overflow-y-auto">
          {filtered.map(tag => (
            <button
              key={tag}
              type="button"
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-muted/50 transition-colors"
              onMouseDown={(e) => { e.preventDefault(); addTag(tag); }}
            >
              {tag}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
