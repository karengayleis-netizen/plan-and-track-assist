import { ReactNode } from 'react';
import { Header } from './Header';
import { TabNavigation } from './TabNavigation';
import { Student } from '@/types';

interface MainLayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSelectStudent?: (student: Student) => void;
}

export function MainLayout({ children, activeTab, onTabChange, onSelectStudent }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Header onSelectStudent={onSelectStudent} onNavigateTab={onTabChange} />
      <TabNavigation activeTab={activeTab} onTabChange={onTabChange} />
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
