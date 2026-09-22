import { useState } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import AuthPage from '@/pages/AuthPage';
import Layout, { type Page } from '@/components/Layout';
import TechTreePage from '@/pages/TechTreePage';
import ResourcesPage from '@/pages/ResourcesPage';

import ClanOverviewPage from '@/pages/ClanOverviewPage';
import ClanManagementPage from '@/pages/ClanManagementPage';

import CalculatorPage from '@/pages/CalculatorPage';
import NotesPage from '@/pages/NotesPage';
import { hasPermission } from '@/lib/types';
import { Clock } from 'lucide-react';

function AppContent() {
  const { session, profile, loading, isRecovery, signOut } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('resources');

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0C10] flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-gold-500/30 border-t-gold-400 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500">로딩 중...</p>
        </div>
      </div>
    );
  }

  if (!session || !profile || isRecovery) {
    return <AuthPage />;
  }

  if (!profile.approved) {
    return (
      <div className="min-h-screen bg-[#0B0C10] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-2xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center mx-auto mb-6">
            <Clock className="w-8 h-8 text-gold-400" />
          </div>
          <h2 className="text-xl font-bold text-gold-300 mb-3">가입 승인 대기 중</h2>
          <p className="text-sm text-gray-400 leading-relaxed mb-2">
            가입 승인 대기 중입니다. 리더의 승인 후 이용할 수 있습니다.
          </p>
          <p className="text-xs text-gray-600 mb-6">
            가입 신청일: {new Date(profile.created_at).toLocaleDateString('ko-KR')}
          </p>
          <button onClick={() => signOut()} className="btn-outline text-sm">
            로그아웃
          </button>
        </div>
      </div>
    );
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'tech-tree':
        return <TechTreePage />;
      case 'resources':
        return <ResourcesPage />;
      case 'calculator':
        return <CalculatorPage />;
      case 'notes':
        return <NotesPage />;

      case 'clan-overview':
        return <ClanOverviewPage />;
      case 'clan-management':
        return hasPermission(profile.role, 2) ? <ClanManagementPage /> : <ResourcesPage />;

      default:
        return <ResourcesPage />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0C10]">
      <Layout currentPage={currentPage} onNavigate={setCurrentPage} />
      <div className="lg:ml-64 pt-14 lg:pt-0 min-h-screen">
        <div className="p-4 lg:p-8 max-w-7xl mx-auto">
          {renderPage()}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
