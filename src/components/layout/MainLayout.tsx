import { ReactNode } from 'react';
import { Header } from './Header';
import { TabNavigation } from './TabNavigation';

interface MainLayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function MainLayout({ children, activeTab, onTabChange }: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <TabNavigation activeTab={activeTab} onTabChange={onTabChange} />
      <main className="container mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
