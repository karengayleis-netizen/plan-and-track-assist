import { GraduationCap, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { GlobalSearch } from './GlobalSearch';
import { Student } from '@/types';

interface HeaderProps {
  onSelectStudent?: (student: Student) => void;
  onNavigateTab?: (tab: string) => void;
}

export function Header({ onSelectStudent, onNavigateTab }: HeaderProps) {
  const { user, signOut } = useAuth();

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-50 shadow-sm">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 shrink-0">
          <div className="bg-primary p-2 rounded-xl shadow-sm">
            <GraduationCap className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-lg font-semibold text-foreground">Plan & Track Assist</h1>
            <p className="text-xs text-muted-foreground">Data-driven student support</p>
          </div>
        </div>

        {user && (
          <div className="flex items-center gap-3 flex-1 justify-end">
            <GlobalSearch onSelectStudent={onSelectStudent} onNavigateTab={onNavigateTab} />
            <div className="hidden md:flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {user.email}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                user.role === 'admin' 
                  ? 'bg-warning/10 text-warning' 
                  : 'bg-primary/10 text-primary'
              }`}>
                {user.role}
              </span>
              {user.schoolId && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">
                  {user.schoolId}
                </span>
              )}
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={signOut}
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
