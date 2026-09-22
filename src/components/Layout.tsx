import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  TreePine, ClipboardCheck, LogOut,
  Menu, X, ChevronRight, AlertTriangle, Users, BarChart3, Calculator, MessageSquare
} from 'lucide-react';
import { ROLE_LABELS, ROLE_HIERARCHY, canManageClan, type ClanRole } from '@/lib/types';
import type { Profile } from '@/lib/types';
import type { LucideIcon } from 'lucide-react';
import NicknameText from '@/components/NicknameText';

export type Page = 'tech-tree' | 'resources' | 'calculator' | 'clan-overview' | 'clan-management' | 'notes';

interface Props {
  currentPage: Page;
  onNavigate: (page: Page) => void;
}

const NAV_ITEMS: { page: Page; label: string; icon: LucideIcon; minLevel: number; dividerBefore?: boolean }[] = [
  { page: 'resources', label: '군장 검사', icon: ClipboardCheck, minLevel: 5 },
  { page: 'tech-tree', label: '개인 기술', icon: TreePine, minLevel: 5 },
  { page: 'clan-overview', label: '클랜 현황', icon: BarChart3, minLevel: 5, dividerBefore: true },
  { page: 'calculator', label: '계산기', icon: Calculator, minLevel: 5 },
  { page: 'notes', label: '민원 센터', icon: MessageSquare, minLevel: 5 },
  { page: 'clan-management', label: '클랜 관리', icon: Users, minLevel: 6, dividerBefore: true },
];

const BOTTOM_NAV: { page: Page; label: string; icon: LucideIcon; minLevel: number; dividerBefore?: boolean }[] = [];

function RoleBadge({ role }: { role: ClanRole }) {
  return <span className={`badge-${role}`}>{ROLE_LABELS[role]}</span>;
}

export default function Layout({ currentPage, onNavigate }: Props) {
  const { profile, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!profile) return null;

  const visibleItems = NAV_ITEMS.filter(item => ROLE_HIERARCHY[profile.role] <= item.minLevel);
  const visibleBottomItems = BOTTOM_NAV.filter(item => ROLE_HIERARCHY[profile.role] <= item.minLevel);

  return (
    <>
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 border-b" style={{ backgroundColor: 'rgba(18,18,18,0.95)', borderColor: '#2A2A30' }}>
        <div className="flex items-center justify-between px-4 h-14">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-400 hover:text-gold-400 transition-colors">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <img src="/assets/icons/amb.png" alt="FeverTime[YOHO] 로고" className="h-5 w-auto object-contain" />
            <span className="text-sm font-bold text-gold-300">FeverTime<span className="text-gold-500">[YOHO]</span></span>
          </div>
          <div className="w-5" />
        </div>
      </header>

      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/60" onClick={() => setSidebarOpen(false)}>
          <div className="w-72 h-full" onClick={e => e.stopPropagation()}>
            <SidebarContent
              profile={profile}
              currentPage={currentPage}
              visibleItems={visibleItems}
              bottomItems={visibleBottomItems}
              onNavigate={p => { onNavigate(p); setSidebarOpen(false); }}
              onSignOut={signOut}
              onClose={() => setSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      <aside className="hidden lg:block fixed left-0 top-0 bottom-0 w-64 z-30">
        <SidebarContent
          profile={profile}
          currentPage={currentPage}
          visibleItems={visibleItems}
          bottomItems={visibleBottomItems}
          onNavigate={onNavigate}
          onSignOut={signOut}
        />
      </aside>
    </>
  );
}

function SidebarContent({
  profile,
  currentPage,
  visibleItems,
  bottomItems,
  onNavigate,
  onSignOut,
  onClose,
}: {
  profile: Profile;
  currentPage: Page;
  visibleItems: typeof NAV_ITEMS;
  bottomItems: typeof BOTTOM_NAV;
  onNavigate: (page: Page) => void;
  onSignOut: () => void;
  onClose?: () => void;
}) {
  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: '#121212', borderRight: '1px solid #2A2A30' }}>
      <div className="p-5" style={{ borderBottom: '1px solid #2A2A30' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden">
              <img src="/assets/icons/amb.png" alt="FeverTime[YOHO] 로고" className="w-full h-full object-contain" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gold-300">FeverTime</h2>
              <p className="text-xs text-gold-600">[YOHO]</p>
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="lg:hidden text-gray-500 hover:text-gray-300">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="p-4" style={{ borderBottom: '1px solid #2A2A30' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-gold-400 text-sm font-bold" style={{ backgroundColor: '#1A1A1F', border: '1px solid #2A2A30' }}>
            {profile.nickname.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate"><NicknameText nickname={profile.nickname} role={profile.role} /></p>
            <RoleBadge role={profile.role} />
          </div>
          {profile.red_warning && (
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" title="빨간불 경고" />
          )}
        </div>
        {profile.red_warning && (
          <div className="mt-3 flex items-center gap-2 text-xs text-red-400 bg-red-500/10 rounded-lg px-3 py-2 border border-red-500/20">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>주간 대시보드 미기입 - 리더 확인 필요</span>
          </div>
        )}
      </div>

      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {visibleItems.map(item => {
          const Icon = item.icon;
          const active = currentPage === item.page;
          return (
            <div key={item.page}>
              {item.dividerBefore && (
                <div className="my-2 mx-1 border-t border-[#2A2A30]" />
              )}
              <button
                onClick={() => onNavigate(item.page)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${
                  active
                    ? 'bg-gold-500/15 text-gold-300 border border-gold-500/20'
                    : 'text-gray-400 hover:text-gray-200 border border-transparent'
                }`}
                onMouseEnter={e => { if (!active) e.currentTarget.style.backgroundColor = '#252530'; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.backgroundColor = ''; }}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-gold-400' : 'text-gray-500 group-hover:text-gray-400'}`} />
                <span className="flex-1 text-left">{item.label}</span>
                {active && <ChevronRight className="w-3.5 h-3.5 text-gold-500" />}
              </button>
            </div>
          );
        })}
      </nav>

      <div className="p-3" style={{ borderTop: '1px solid #2A2A30' }}>
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-500 hover:bg-red-500/10 hover:text-red-400 transition-all duration-200"
        >
          <LogOut className="w-4 h-4" />
          로그아웃
        </button>
      </div>
    </div>
  );
}
