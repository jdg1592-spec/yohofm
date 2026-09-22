import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  ROLE_LABELS, RESOURCE_KEYS, RESOURCE_LABELS,
  getCurrentWeekStart, getClanTechBonus, CLAN_SCORE_NODES,
  canEditResources, canEditClanTech, canExportExcel, roleSortIndex,
  type Profile, type WeeklyResource, type TechTree, type ResourceKey, type ClanSettings, type ClanRole,
} from '@/lib/types';
import {
  calculateAllDayScores,
  getTechBuffRate,
  buildClanTechState,
  SCORE_SOURCE_KEYS,
  SCORE_SOURCE_LABELS,
  type DayScoreResult, type ScoreSourceKey,
} from '@/lib/clan_war_calculator';
import { BarChart3, RefreshCw, Download, Sun, Pencil, Trophy, RotateCcw } from 'lucide-react';
import ClanTechGrid from '@/components/ClanTechGrid';
import NicknameText from '@/components/NicknameText';
import * as XLSX from 'xlsx';

const SCORE_DAYS = [1, 2, 3, 4, 5] as const;
const MORNING_PUSH_DAYS = [1, 2, 3, 4, 5] as const;
const DAY_LABELS: Record<number, string> = {
  1: '1일차', 2: '2일차', 3: '3일차', 4: '4일차', 5: '5일차',
};
const DAY_CATEGORIES: Record<number, string | null> = {
  1: 'skill_summon', 2: 'mount_summon', 3: 'skill_summon', 4: 'mount_summon', 5: 'pet_merge',
};
const DAY_SCORE_SOURCES: Record<number, ScoreSourceKey[]> = {
  1: ['skill_summon', 'skill_merge'],
  2: ['mount_owned_merge', 'mount_summon', 'mount_summoned_merge'],
  3: ['skill_summon', 'skill_merge', 'pet_owned_merge', 'pet_summoned_merge'],
  4: ['mount_owned_merge', 'mount_summon', 'mount_summoned_merge'],
  5: ['pet_owned_merge', 'pet_summoned_merge'],
};
const DAY_BONUS_NODES: Record<number, string[]> = {
  1: ['war_day_1', 'skill_summon', 'skill_merge'],
  2: ['war_day_2', 'mount_summon', 'mount_merge'],
  3: ['war_day_3', 'skill_summon', 'skill_merge', 'pet_merge'],
  4: ['war_day_4', 'mount_summon', 'mount_merge'],
  5: ['war_day_5', 'pet_merge'],
};

type ViewTab = 'daily-scores' | 'category-scores' | 'resources' | 'clan-score';
type EditingCell = { memberId: string; field: ResourceKey } | null;

export default function ClanOverviewPage() {
  const { profile: myProfile } = useAuth();
  const canExport = myProfile ? canExportExcel(myProfile.role) : false;
  const canEditRes = myProfile ? canEditResources(myProfile.role) : false;
  const canEditTech = myProfile ? canEditClanTech(myProfile.role) : false;
  const isLeader = myProfile?.role === 'leader' || myProfile?.role === 'acting-leader';
  const [resetting, setResetting] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [resources, setResources] = useState<WeeklyResource[]>([]);
  const [techTrees, setTechTrees] = useState<TechTree[]>([]);
  const [clanTechNodes, setClanTechNodes] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [viewTab, setViewTab] = useState<ViewTab>('daily-scores');
  const [morningPushFilter, setMorningPushFilter] = useState<number | null>(null);
  const [editingCell, setEditingCell] = useState<EditingCell>(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const weekStart = getCurrentWeekStart();

  const fetchAll = async () => {
    setLoading(true);
    const [pRes, rRes, tRes, csRes] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('weekly_resources').select('*').eq('week_start', weekStart),
      supabase.from('tech_trees').select('*'),
      supabase.from('clan_settings').select('clan_tech_nodes').limit(1).maybeSingle(),
    ]);
    setProfiles(pRes.data || []);
    setResources(rRes.data || []);
    setTechTrees(tRes.data || []);
    setClanTechNodes((csRes.data as ClanSettings | null)?.clan_tech_nodes || {});
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [weekStart]);

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  const handleTechLevelsChange = useCallback((levels: Record<string, number>) => {
    setClanTechNodes(levels);
  }, []);

  const memberData = useMemo(() => {
    return profiles.map(p => {
      const res = resources.find(r => r.user_id === p.id) || null;
      const tech = techTrees.find(t => t.user_id === p.id) || null;
      const { dayResults, dayBreakdowns } = calculateAllDayScores(res, clanTechNodes, tech);

      const dayScores: Record<number, DayScoreResult> = {};
      for (const d of SCORE_DAYS) {
        const override = res?.day_score_overrides?.[String(d)];
        if (override !== undefined && override !== null) {
          dayScores[d] = { baseScore: override, buffRate: 0, finalScore: override };
        } else {
          dayScores[d] = dayResults[d] || { baseScore: 0, buffRate: 0, finalScore: 0 };
        }
      }

      const categoryScores = Object.fromEntries(SCORE_SOURCE_KEYS.map(key => [
        key,
        SCORE_DAYS.reduce((sum, day) => sum + dayBreakdowns[day][key], 0),
      ])) as Record<ScoreSourceKey, number>;
      const total = SCORE_DAYS.reduce((sum, day) => sum + dayScores[day].finalScore, 0);

      return { profile: p, resource: res, techTree: tech, dayScores, dayBreakdowns, categoryScores, total };
    }).sort((a, b) => {
      const rankDiff = roleSortIndex(a.profile.role) - roleSortIndex(b.profile.role);
      if (rankDiff !== 0) return rankDiff;
      return a.profile.nickname.localeCompare(b.profile.nickname);
    });
  }, [profiles, resources, techTrees, clanTechNodes]);

  const clanTechState = useMemo(() => buildClanTechState(clanTechNodes), [clanTechNodes]);

  const dayBuffRates = useMemo(() => {
    const rates: Record<number, number> = {};
    for (const d of SCORE_DAYS) {
      rates[d] = getTechBuffRate(d, DAY_CATEGORIES[d], clanTechState);
    }
    return rates;
  }, [clanTechState]);

  const dayTotals = useMemo(() => {
    const totals: Record<number, number> = {};
    for (const d of SCORE_DAYS) {
      totals[d] = memberData.reduce((s, m) => s + m.dayScores[d].finalScore, 0);
    }
    return totals;
  }, [memberData]);

  const morningPushByDay = useMemo(() => {
    const result: Record<number, { count: number }> = {};
    for (const d of MORNING_PUSH_DAYS) {
      const doers = memberData.filter(m => m.resource?.morning_push_days?.includes(d));
      result[d] = { count: doers.length };
    }
    return result;
  }, [memberData]);

  const visibleBonusNodes = useMemo(() => {
    const allowed = morningPushFilter === null ? null : DAY_BONUS_NODES[morningPushFilter];
    return CLAN_SCORE_NODES.filter(node =>
      (clanTechNodes[node.id] || 0) > 0 && (allowed === null || allowed.includes(node.id))
    );
  }, [clanTechNodes, morningPushFilter]);

  const visibleScoreSources = morningPushFilter === null
    ? SCORE_SOURCE_KEYS
    : DAY_SCORE_SOURCES[morningPushFilter];

  const startEditResource = (memberId: string, field: ResourceKey, currentValue: number) => {
    if (!canEditRes) return;
    setEditingCell({ memberId, field });
    setEditValue(String(currentValue));
  };

  const cancelEdit = () => {
    setEditingCell(null);
    setEditValue('');
  };

  const saveResourceEdit = async (memberId: string, field: ResourceKey) => {
    const numValue = parseInt(editValue, 10);
    if (isNaN(numValue) || numValue < 0) { cancelEdit(); return; }

    setSaving(true);
    const existingRes = resources.find(r => r.user_id === memberId);

    if (existingRes) {
      const { error } = await supabase
        .from('weekly_resources')
        .update({ [field]: numValue, updated_at: new Date().toISOString() })
        .eq('id', existingRes.id);
      if (!error) {
        setResources(prev => prev.map(r =>
          r.id === existingRes.id ? { ...r, [field]: numValue } : r
        ));
      }
    } else {
      const newRow = {
        user_id: memberId,
        week_start: weekStart,
        [field]: numValue,
      };
      const { data, error } = await supabase.from('weekly_resources').insert(newRow).select().maybeSingle();
      if (!error && data) {
        setResources(prev => [...prev, data as WeeklyResource]);
      }
    }

    setSaving(false);
    cancelEdit();
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, memberId: string, field: ResourceKey) => {
    if (e.key === 'Enter') {
      saveResourceEdit(memberId, field);
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  const exportXlsx = () => {
    const resHeaders = [
      '닉네임', '직급', ...RESOURCE_KEYS.map(k => RESOURCE_LABELS[k]),
      '스킬 비용 감소', '탈것 비용 감소', '추가 탈것 확률', '추가 알 확률',
    ];
    const resRows = memberData.map(m => ([
      m.profile.nickname,
      ROLE_LABELS[m.profile.role],
      ...RESOURCE_KEYS.map(k => m.resource ? m.resource[k] : 0),
      m.techTree?.skill_cost_reduction ?? 0,
      m.techTree?.mount_cost_reduction ?? 0,
      m.techTree?.extra_mount_chance ?? 0,
      m.techTree?.extra_egg_chance ?? 0,
    ]));

    const wb = XLSX.utils.book_new();

    const ws = XLSX.utils.aoa_to_sheet([resHeaders, ...resRows]);
    ws['!cols'] = resHeaders.map((h) => ({ wch: Math.max(h.length * 2, 10) }));
    XLSX.utils.book_append_sheet(wb, ws, '클랜원별 재화');

    XLSX.writeFile(wb, `clan_overview_${weekStart}.xlsx`);
  };

  const handleManualReset = async () => {
    setShowResetModal(false);
    setResetting(true);
    const { error } = await supabase.rpc('manual_reset_weekly_resources');
    if (error) {
      alert('리셋 중 오류가 발생했습니다: ' + error.message);
    } else {
      await fetchAll();
    }
    setResetting(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-gold-500/30 border-t-gold-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gold-300 flex items-center gap-3">
            <BarChart3 className="w-6 h-6 text-gold-400" />
            클랜 현황
          </h1>
          <p className="text-sm text-gray-500 mt-1">주간: {weekStart}</p>
        </div>
        <div className="flex items-center gap-2">
          {canExport && (
            <button onClick={exportXlsx} className="btn-outline flex items-center gap-2 text-sm">
              <Download className="w-4 h-4" />
              내려받기
            </button>
          )}
          {isLeader && (
            <button
              onClick={() => setShowResetModal(true)}
              disabled={resetting}
              className="btn-danger flex items-center gap-2 text-sm"
            >
              <RotateCcw className="w-4 h-4" />
              {resetting ? '리셋 중...' : '군장 리셋'}
            </button>
          )}
          <button onClick={fetchAll} className="btn-outline flex items-center gap-2 text-sm">
            <RefreshCw className="w-4 h-4" />
            새로고침
          </button>
        </div>
      </div>

      {/* Day score cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {SCORE_DAYS.map(d => {
          const buffPct = Math.round(dayBuffRates[d] * 100);
          return (
            <div key={d} className="card text-center">
              <p className="text-xs text-gray-500 mb-1">{DAY_LABELS[d]}</p>
              <p className="text-xl font-bold text-gold-300 font-mono">{dayTotals[d].toLocaleString()}</p>
              {buffPct > 0 && (
                <p className="text-[10px] text-emerald-400 font-mono mt-0.5">+{buffPct}% 보너스</p>
              )}
              <div className="mt-2 flex items-center justify-center gap-1">
                <Sun className="w-3 h-3 text-amber-400" />
                <span className="text-xs text-amber-400">{morningPushByDay[d].count}명</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tab toggle */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setViewTab('daily-scores')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewTab === 'daily-scores' ? 'bg-gold-500/15 text-gold-300 border border-gold-500/20' : 'text-gray-400 border border-[#2A2A30] hover:text-gray-200'}`}
          >
            클랜원별 점수 (날짜별)
          </button>
          <button
            onClick={() => setViewTab('category-scores')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewTab === 'category-scores' ? 'bg-gold-500/15 text-gold-300 border border-gold-500/20' : 'text-gray-400 border border-[#2A2A30] hover:text-gray-200'}`}
          >
            클랜원별 점수 (종류별)
          </button>
          <button
            onClick={() => setViewTab('resources')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewTab === 'resources' ? 'bg-gold-500/15 text-gold-300 border border-gold-500/20' : 'text-gray-400 border border-[#2A2A30] hover:text-gray-200'}`}
          >
            클랜원별 재화
          </button>
          <button
            onClick={() => setViewTab('clan-score')}
            className={`ml-auto px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${viewTab === 'clan-score' ? 'bg-gold-500/15 text-gold-300 border border-gold-500/20' : 'text-gray-400 border border-[#2A2A30] hover:text-gray-200'}`}
          >
            <Trophy className="w-3.5 h-3.5" />
            클랜 기술
          </button>
        </div>
        {viewTab !== 'clan-score' && (
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="아침조 필터">
            <span className="text-xs text-gray-500 mr-1">아침조 필터</span>
            <button
              type="button"
              aria-pressed={morningPushFilter === null}
              onClick={() => setMorningPushFilter(null)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${morningPushFilter === null ? 'bg-gold-500/15 text-gold-300 border border-gold-500/20' : 'text-gray-400 border border-[#2A2A30] hover:text-gray-200'}`}
            >
              전체
            </button>
            {MORNING_PUSH_DAYS.map(d => (
              <button
                key={d}
                type="button"
                aria-pressed={morningPushFilter === d}
                onClick={() => setMorningPushFilter(d)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${morningPushFilter === d ? 'bg-gold-500/15 text-gold-300 border border-gold-500/20' : 'text-gray-400 border border-[#2A2A30] hover:text-gray-200'}`}
              >
                {DAY_LABELS[d]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Active buff summary */}
      {(viewTab === 'daily-scores' || viewTab === 'category-scores' || viewTab === 'resources') && visibleBonusNodes.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {visibleBonusNodes.map(n => {
            const bonus = getClanTechBonus(n.id, clanTechNodes);
            return (
              <span key={n.id} className="px-2 py-1 rounded-md text-[11px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {n.label} +{Math.round(bonus * 100)}%
              </span>
            );
          })}
        </div>
      )}

      {/* Daily scores table */}
      {viewTab === 'daily-scores' && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2A2A30]">
                <th className="table-header text-left px-4 py-3 sticky left-0" style={{ backgroundColor: '#1A1A1F' }}>클랜원</th>
                {SCORE_DAYS.map(d => (
                  <th key={d} className="table-header text-right px-3 py-3">{DAY_LABELS[d]}</th>
                ))}
                <th className="table-header text-center px-3 py-3 whitespace-nowrap">아침조</th>
                <th className="table-header text-center px-3 py-3">군장 검사</th>
              </tr>
            </thead>
            <tbody>
              {memberData.filter(m => morningPushFilter === null || m.resource?.morning_push_days?.includes(morningPushFilter)).map(m => (
                <tr key={m.profile.id} className="border-b border-[#2A2A30]/50 hover:bg-[#252530] transition-colors">
                  <td className="px-4 py-2.5 sticky left-0" style={{ backgroundColor: '#1A1A1F' }}>
                    <div className="flex items-center gap-2">
                      <NicknameText nickname={m.profile.nickname} role={m.profile.role} />
                      <span className={`badge-${m.profile.role} text-[10px] px-1.5 py-0`}>{ROLE_LABELS[m.profile.role]}</span>
                    </div>
                  </td>
                  {SCORE_DAYS.map(d => (
                    <td key={d} className="text-right px-3 py-2.5 font-mono text-gray-300">
                      {m.dayScores[d].finalScore.toLocaleString()}
                    </td>
                  ))}
                  <td className="text-center px-3 py-2.5 whitespace-nowrap">
                    {m.resource?.morning_push_days?.length ? (
                      <span className="text-xs text-amber-400">
                        {m.resource.morning_push_days.map(d => `${d}일`).join(', ')}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-600">-</span>
                    )}
                  </td>
                  <td className="text-center px-3 py-2.5">
                    {m.resource ? (
                      <span className="text-[11px] text-emerald-400 font-semibold">통과</span>
                    ) : (
                      <span className="text-[11px] text-red-400 font-semibold">떼잉</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewTab === 'category-scores' && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2A2A30]">
                <th className="table-header text-left px-4 py-3 sticky left-0" style={{ backgroundColor: '#1A1A1F' }}>클랜원</th>
                {visibleScoreSources.map(key => (
                  <th key={key} className="table-header text-right px-3 py-3 whitespace-nowrap">{SCORE_SOURCE_LABELS[key]}</th>
                ))}
                {visibleScoreSources.length > 0 && <th className="table-header text-right px-3 py-3 whitespace-nowrap">총점</th>}
              </tr>
            </thead>
            <tbody>
              {memberData.filter(m => morningPushFilter === null || m.resource?.morning_push_days?.includes(morningPushFilter)).map(m => (
                <tr key={m.profile.id} className="border-b border-[#2A2A30]/50 hover:bg-[#252530] transition-colors">
                  <td className="px-4 py-2.5 sticky left-0" style={{ backgroundColor: '#1A1A1F' }}>
                    <div className="flex items-center gap-2">
                      <NicknameText nickname={m.profile.nickname} role={m.profile.role} />
                      <span className={`badge-${m.profile.role} text-[10px] px-1.5 py-0`}>{ROLE_LABELS[m.profile.role]}</span>
                    </div>
                  </td>
                  {visibleScoreSources.map(key => (
                    <td key={key} className="text-right px-3 py-2.5 font-mono text-gray-300">
                      {(morningPushFilter === null ? m.categoryScores[key] : m.dayBreakdowns[morningPushFilter]?.[key] || 0).toLocaleString()}
                    </td>
                  ))}
                  {visibleScoreSources.length > 0 && (
                    <td className="text-right px-3 py-2.5 font-mono font-bold text-gold-300">
                      {(morningPushFilter === null ? m.total : m.dayScores[morningPushFilter]?.finalScore || 0).toLocaleString()}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Resources table */}
      {viewTab === 'resources' && (
        <div className="card overflow-x-auto p-0">
          {canEditRes && (
            <div className="px-4 py-2.5 border-b border-[#2A2A30] flex items-center gap-2">
              <Pencil className="w-3.5 h-3.5 text-gold-400" />
              <span className="text-xs text-gray-400">셀을 클릭하면 직접 수정할 수 있습니다</span>
            </div>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2A2A30]">
                <th className="table-header text-left px-4 py-3 sticky left-0" style={{ backgroundColor: '#1A1A1F' }}>클랜원</th>
                {RESOURCE_KEYS.map(k => (
                  <th key={k} className="table-header text-right px-3 py-3">{RESOURCE_LABELS[k]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {memberData.filter(m => morningPushFilter === null || m.resource?.morning_push_days?.includes(morningPushFilter)).map(m => (
                <tr key={m.profile.id} className="border-b border-[#2A2A30]/50 hover:bg-[#252530] transition-colors">
                  <td className="px-4 py-2.5 sticky left-0" style={{ backgroundColor: '#1A1A1F' }}>
                    <div className="flex items-center gap-2">
                      <NicknameText nickname={m.profile.nickname} role={m.profile.role} />
                      <span className={`badge-${m.profile.role} text-[10px] px-1.5 py-0`}>{ROLE_LABELS[m.profile.role]}</span>
                    </div>
                  </td>
                  {RESOURCE_KEYS.map(k => {
                    const isEditing = editingCell?.memberId === m.profile.id && editingCell?.field === k;
                    const value = m.resource ? m.resource[k] : 0;
                    return (
                      <td
                        key={k}
                        className={`text-right px-3 py-2.5 font-mono text-gray-300 ${canEditRes && !isEditing ? 'cursor-pointer hover:bg-gold-500/5 transition-colors' : ''}`}
                        onClick={() => !isEditing && canEditRes && startEditResource(m.profile.id, k, value)}
                      >
                        {isEditing ? (
                          <div className="flex items-center gap-1 justify-end">
                            <input
                              ref={inputRef}
                              type="number"
                              min={0}
                              value={editValue}
                              onChange={e => setEditValue(e.target.value)}
                              onKeyDown={e => handleEditKeyDown(e, m.profile.id, k)}
                              onBlur={() => saveResourceEdit(m.profile.id, k)}
                              disabled={saving}
                              className="w-20 bg-[#1A1A1F] border border-gold-500/30 rounded px-2 py-0.5 text-right text-gold-300 text-sm font-mono focus:outline-none focus:border-gold-400"
                            />
                          </div>
                        ) : (
                          m.resource ? value.toLocaleString() : <span className="text-gray-600">-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Clan score node grid */}
      {viewTab === 'clan-score' && (
        <ClanTechGrid isLeader={canEditTech} onLevelsChange={handleTechLevelsChange} />
      )}

      {/* Reset confirmation modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowResetModal(false)}>
          <div className="card w-full max-w-sm animate-slide-up" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-red-400 mb-2">군장 리셋</h3>
            <p className="text-sm text-gray-400 mb-4">
              정말로 모든 클랜원의 군장 데이터를 초기화하시겠습니까?
            </p>
            <p className="text-xs text-gray-500 mb-4">
              모든 클랜원의 재화, 아침조, 점수 데이터가 0으로 초기화됩니다. (클랜 기술은 제외)
            </p>
            <p className="text-xs text-red-400/70 mb-4">이 작업은 되돌릴 수 없습니다.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowResetModal(false)} className="btn-outline flex-1">취소</button>
              <button onClick={handleManualReset} disabled={resetting} className="btn-danger flex-1">
                {resetting ? '처리 중...' : '확인'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
