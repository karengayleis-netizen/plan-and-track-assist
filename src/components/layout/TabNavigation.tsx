import { 
  Users, 
  BarChart3, 
  BookOpen, 
  LineChart, 
  Triangle, 
  FileText, 
  Settings 
} from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { id: 'students', label: 'Students', icon: Users },
  { id: 'benchmarks', label: 'Benchmarks', icon: BarChart3 },
  { id: 'markbook', label: 'Markbook', icon: BookOpen },
  { id: 'insights', label: 'Insights', icon: LineChart },
  { id: 'triangulation', label: 'Triangulation', icon: Triangle },
  { id: 'support-plan', label: 'Support Plan', icon: FileText },
  { id: 'admin', label: 'Admin', icon: Settings },
];

interface TabNavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function TabNavigation({ activeTab, onTabChange }: TabNavigationProps) {
  return (
    <nav className="border-b border-border bg-card/30">
      <div className="container mx-auto px-4">
        <div className="flex overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap transition-all border-b-2 -mb-px",
                  isActive
                    ? "border-primary text-primary bg-primary/5"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
