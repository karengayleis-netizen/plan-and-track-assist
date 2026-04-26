import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { useStudents } from '@/hooks/useStudents';
import { useClasses } from '@/hooks/useClasses';
import { Search, User, GraduationCap, X } from 'lucide-react';
import { Student } from '@/types';

interface SearchResult {
  type: 'student' | 'class';
  id: string;
  title: string;
  subtitle: string;
  data: Student | { id: string; code: string; name: string };
}

interface GlobalSearchProps {
  onSelectStudent?: (student: Student) => void;
  onNavigateTab?: (tab: string) => void;
}

export function GlobalSearch({ onSelectStudent, onNavigateTab }: GlobalSearchProps) {
  const { students } = useStudents();
  const { classes } = useClasses();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];

    const matches: SearchResult[] = [];

    // Search students
    for (const s of students) {
      if (matches.length >= 8) break;
      if (s.active === false) continue;
      const fields = [s.initials, s.studentNumber, s.homeroom].filter(Boolean);

      if (fields.some(f => f!.toLowerCase().includes(q))) {
        const last3 = (s.studentNumber || '').slice(-3);
        matches.push({
          type: 'student',
          id: s.id,
          title: `${s.initials || '—'} · ${s.homeroom} · #${last3}`,
          subtitle: `Grade ${s.grade}`,
          data: s,
        });
      }
    }

    // Search classes/homerooms
    for (const c of classes) {
      if (matches.length >= 10) break;
      const fields = [c.code, c.name].filter(Boolean);
      if (fields.some(f => f.toLowerCase().includes(q))) {
        matches.push({
          type: 'class',
          id: c.id,
          title: c.code,
          subtitle: c.name || 'Homeroom',
          data: { id: c.id, code: c.code, name: c.name },
        });
      }
    }

    return matches;
  }, [query, students, classes]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (e.key === 'Escape') {
        setOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const selectResult = useCallback((result: SearchResult) => {
    if (result.type === 'student') {
      onSelectStudent?.(result.data as Student);
    } else if (result.type === 'class') {
      onNavigateTab?.('students');
    }
    setQuery('');
    setOpen(false);
  }, [onSelectStudent, onNavigateTab]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      selectResult(results[selectedIndex]);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          placeholder="Search… ⌘K"
          className="pl-8 pr-8 w-48 sm:w-64 h-9 text-sm bg-muted/50 border-border/50 focus:bg-background focus:ring-primary"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => query.trim().length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {query && (
          <button
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => { setQuery(''); setOpen(false); }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && query.trim().length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden max-h-80 overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              No results for "{query}"
            </div>
          ) : (
            <div className="py-1">
              {results.map((result, idx) => {
                const Icon = result.type === 'student' ? User : GraduationCap;
                const isSelected = idx === selectedIndex;

                return (
                  <button
                    key={`${result.type}-${result.id}`}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${
                      isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'
                    }`}
                    onClick={() => selectResult(result)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                  >
                    <div className={`shrink-0 p-1.5 rounded-md ${
                      result.type === 'student' ? 'bg-chart-1/10 text-chart-1' : 'bg-chart-2/10 text-chart-2'
                    }`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground truncate">{result.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{result.subtitle}</p>
                    </div>
                    <span className="text-xs text-muted-foreground/60 shrink-0 capitalize">{result.type}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
