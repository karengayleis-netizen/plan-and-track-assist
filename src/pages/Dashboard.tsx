import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { LoginForm } from '@/components/auth/LoginForm';
import { MainLayout } from '@/components/layout/MainLayout';
import { StudentsTab } from '@/components/tabs/StudentsTab';
import { BenchmarksTab } from '@/components/tabs/BenchmarksTab';
import { MarkbookTab } from '@/components/tabs/MarkbookTab';
import { InsightsTab } from '@/components/tabs/InsightsTab';
import { TriangulationTab } from '@/components/tabs/TriangulationTab';
import { MissingDataTab } from '@/components/tabs/MissingDataTab';
import { SupportPlanTab } from '@/components/tabs/SupportPlanTab';
import { AdminTab } from '@/components/tabs/AdminTab';
import { Loader2 } from 'lucide-react';

export default function Dashboard() {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState('students');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'students': return <StudentsTab />;
      case 'benchmarks': return <BenchmarksTab />;
      case 'markbook': return <MarkbookTab />;
      case 'insights': return <InsightsTab />;
      case 'triangulation': return <TriangulationTab />;
      case 'missing-data': return <MissingDataTab />;
      case 'support-plan': return <SupportPlanTab />;
      case 'admin': return <AdminTab />;
      default: return <StudentsTab />;
    }
  };

  return (
    <MainLayout activeTab={activeTab} onTabChange={setActiveTab}>
      {renderTab()}
    </MainLayout>
  );
}
