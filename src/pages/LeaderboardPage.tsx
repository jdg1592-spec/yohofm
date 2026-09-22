import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  ROLE_LABELS, getCurrentWeekStart, roleSortIndex,
  type Profile, type WeeklyResource, type TechTree, type ClanSettings,
} from '@/lib/types';
import { calculateAllDayScores } from '@/lib/clan_war_calculator';
import { Trophy, RefreshCw, TrendingUp, Search } from 'lucide-react';
import NicknameText from '@/components/NicknameText';

interface LeaderboardEntry {
  profile: Profile;
  resource: WeeklyResource | null;
  techTree: TechTree | null;
  warScore: number;
}

export default function LeaderboardPage() {
  const { profile } = useAuth();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const weekStart = getCurrentWeekStart();

  const fetchData = async () => {
    setLoading(true);
    const [profilesRes, resourcesRes, techTreesRes] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('weekly_resources').select('*').eq('week_start', weekStart),
      supabase.from('tech_trees').select('*'),
    ]);

    const profiles = profilesRes.data || [];
    const resources = resourcesRes.data || [];
    const techTrees = techTreesRes.data || [];

    const csRes = await supabase.from('clan_settings').select('clan_tech_nodes').limit(1).maybeSingle();
    const clanTechNodes = (csRes.data as ClanSettings | null)?.clan_tech_nodes || {};

    const leaderboard: LeaderboardEntry[] = profiles.map(p => {
      const resource = resources.find(r => r.user_id === p.id) || null;
      const techTree = techTrees.find(t => t.user_id === p.id) || null;
      const { dayResults } = calculateAllDayScores(resource, clanTechNodes, techTree);
      const warScore = [1, 2, 3, 4, 5].reduce((s, d) => s + (dayResults[d]?.finalScore || 0), 0);
      return { profile: p, resource, techTree, warScore };
    });

    leaderboard.sort((a, b) => {
      const rankDiff = roleSortIndex(a.profile.role) - roleSortIndex(b.profile.role);
      if (rankDiff !== 0) return rankDiff;
      return b.warScore - a.warScore;
    });
    setEntries(leaderboard);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [weekStart]);

  const filtered = entries.filter(e =>
    e.profile.nickname.toLowerCase().includes(search.toLowerCase())
  );

  const totalScore = entries.reduce((sum, e) => sum + e.warScore, 0);
  const submittedCount = entries.filter(e => e.resource !== null).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-gold-500/30 border-t-gold-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gold-300 flex items-center gap-3">
            <Trophy className="w-6 h-6 text-gold-400" />
            실시간 리더보드
          </h1>
          <p className="text-sm text-gray-500 mt-1">주간 시작일: {weekStart}</p>
        </div>
        <button onClick={fetchData} className="btn-outline flex items-center gap-2 text-sm">
          <RefreshCw className="w-4 h-4" />
          새로고침
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card text-center">
          <p className="text-xs text-gray-500 mb-1">총 클랜원</p>
          <p className="text-2xl font-bold text-gold-300">{entries.length}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-500 mb-1">제출 완료</p>
          <p className="text-2xl font-bold text-emerald-400">{submittedCount}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-500 mb-1">미제출</p>
          <p className="text-2xl font-bold text-red-400">{entries.length - submittedCount}</p>
        </div>
        <div className="card text-center">
          <p className="text-xs text-gray-500 mb-1">총 전쟁 점수</p>
          <p className="text-2xl font-bold text-gold-300">{totalScore.toLocaleString()}</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="닉네임으로 검색..." className="input-field pl-10" />
      </div>

      <div className="card overflow-x-auto p-0">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#2A2A30]">
              <th className="table-header text-left px-4 py-3 w-12">순위</th>
              <th className="table-header text-left px-4 py-3">닉네임</th>
              <th className="table-header text-left px-4 py-3">직급</th>
              <th className="table-header text-right px-4 py-3">전쟁 점수</th>
              <th className="table-header text-center px-4 py-3">제출</th>
              <th className="table-header text-center px-4 py-3">상태</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(entry => {
              const rank = entries.indexOf(entry) + 1;
              const isMe = entry.profile.id === profile?.id;
              return (
                <tr key={entry.profile.id} className={`border-b border-[#2A2A30]/50 transition-colors hover:bg-[#252530] ${isMe ? 'bg-gold-500/5' : ''}`}>
                  <td className="px-4 py-3">
                    {rank <= 3 ? (
                      <span className={`text-lg font-bold ${rank === 1 ? 'text-gold-300' : rank === 2 ? 'text-gray-300' : 'text-amber-700'}`}>
                        {rank === 1 ? '\u{1F947}' : rank === 2 ? '\u{1F948}' : '\u{1F949}'}
                      </span>
                    ) : (
                      <span className="text-sm text-gray-500 font-mono">{rank}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-medium ${isMe ? 'text-gold-300' : ''}`}>
                      <NicknameText nickname={entry.profile.nickname} role={entry.profile.role} />
                      {isMe && <span className="ml-2 text-xs text-gold-500">(나)</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3"><span className={`badge-${entry.profile.role}`}>{ROLE_LABELS[entry.profile.role]}</span></td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-bold font-mono text-gold-300 flex items-center justify-end gap-1">
                      <TrendingUp className="w-3.5 h-3.5 text-gold-500" />
                      {entry.warScore.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`w-2 h-2 inline-block rounded-full ${entry.resource ? 'bg-emerald-400' : 'bg-gray-600'}`} />
                  </td>
                  <td className="px-4 py-3 text-center">
                    {entry.profile.red_warning
                      ? <span className="w-3 h-3 inline-block rounded-full bg-red-500 animate-pulse" />
                      : <span className="text-xs text-gray-600">정상</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-500 text-sm">검색 결과가 없습니다</div>
        )}
      </div>
    </div>
  );
}
