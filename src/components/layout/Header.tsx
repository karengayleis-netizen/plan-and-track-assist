import { GraduationCap, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

export function Header() {
  const { user, signOut } = useAuth();

  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-xl">
            <GraduationCap className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground">School Intervention Tool</h1>
            <p className="text-xs text-muted-foreground">Data-driven student support</p>
          </div>
        </div>
        
        {user && (
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {user.email}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                user.role === 'admin' 
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' 
                  : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
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
              className="text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
