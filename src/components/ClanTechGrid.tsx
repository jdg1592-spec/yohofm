import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { CLAN_SCORE_NODES } from '@/lib/types';
import {
  Minus, Plus, Save, Pencil,
} from 'lucide-react';

interface Props {
  isLeader: boolean;
  onLevelsChange?: (levels: Record<string, number>) => void;
}

const CLAN_TECH_ICON_INDICES: Record<string, number> = {
  war_day_1: 11,
  war_day_2: 12,
  war_day_3: 13,
  war_day_4: 14,
  war_day_5: 15,
  skill_summon: 2,
  skill_merge: 3,
  egg_hatch: 7,
  pet_merge: 8,
  mount_summon: 9,
  mount_merge: 10,
  tech_tree: 4,
};

const ICON_SHEET = '/assets/icons/ClanTechTreeIcons.png';
const ICON_CELL_SIZE = 44;
const ICON_COLUMNS = 8;

export default function ClanTechGrid({ isLeader, onLevelsChange }: Props) {
  const [levels, setLevels] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('clan_settings')
        .select('clan_tech_nodes')
        .limit(1)
        .maybeSingle();
      if (data?.clan_tech_nodes) {
        setLevels(data.clan_tech_nodes);
        onLevelsChange?.(data.clan_tech_nodes);
      }
      setLoading(false);
    })();
  }, []);

  const setLevel = (nodeId: string, value: number) => {
    const node = CLAN_SCORE_NODES.find(n => n.id === nodeId);
    if (!node) return;
    const clamped = Math.max(0, Math.min(node.maxLevel, value));
    const next = { ...levels, [nodeId]: clamped };
    setLevels(next);
    setDirty(true);
    onLevelsChange?.(next);
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('clan_settings')
      .update({ clan_tech_nodes: levels, updated_at: new Date().toISOString() })
      .eq('id', 1);
    if (!error) setDirty(false);
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-2 border-gold-500/30 border-t-gold-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {isLeader && dirty && (
        <button onClick={handleSave} disabled={saving} className="btn-gold flex items-center gap-2 text-sm">
          {saving ? (
            <div className="w-4 h-4 border-2 border-[#0B0C10]/30 border-t-[#0B0C10] rounded-full animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? '저장 중...' : '변경사항 저장'}
        </button>
      )}

      {isLeader && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Pencil className="w-3.5 h-3.5 text-gold-400" />
          <span>노드를 클릭하면 레벨을 조정할 수 있습니다</span>
        </div>
      )}

      {/* Node grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {CLAN_SCORE_NODES.map(node => {
          const level = levels[node.id] || 0;
          const isActive = level > 0;
          const isMax = level >= node.maxLevel;
          const isSelected = selectedNode === node.id;
          const pct = (level / node.maxLevel) * 100;
          const bonus = level * 4;

          return (
            <div
              key={node.id}
              className={`relative rounded-xl p-4 transition-all duration-300 ${isLeader ? 'cursor-pointer' : ''} group ${
                isSelected ? 'ring-2 ring-gold-500/50' : ''
              }`}
              style={{
                backgroundColor: isActive ? '#1A1A1F' : '#131316',
                border: `1px solid ${isActive ? node.color + '30' : '#2A2A30'}`,
                boxShadow: isActive ? `0 0 20px ${node.glowColor}` : 'none',
              }}
              onClick={() => isLeader && setSelectedNode(isSelected ? null : node.id)}
            >
              {/* Icon + label */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-11 h-11 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300"
                  style={{
                    backgroundColor: '#050505',
                    border: `2px solid ${isActive ? 'rgba(245, 158, 11, 0.72)' : '#2A2A30'}`,
                    boxShadow: isActive ? '0 0 14px rgba(245, 158, 11, 0.18)' : 'none',
                  }}
                >
                  <span
                    aria-hidden="true"
                    className="block w-11 h-11 transition-all duration-300"
                    style={{
                      backgroundImage: `url(${ICON_SHEET})`,
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: `${ICON_COLUMNS * ICON_CELL_SIZE}px auto`,
                      backgroundPosition: (() => {
                        const index = CLAN_TECH_ICON_INDICES[node.id] - 1;
                        const column = index % ICON_COLUMNS;
                        const row = Math.floor(index / ICON_COLUMNS);
                        return `-${column * ICON_CELL_SIZE}px -${row * ICON_CELL_SIZE}px`;
                      })(),
                      filter: isActive ? 'drop-shadow(0 0 3px rgba(255, 215, 0, 0.42))' : 'grayscale(0.35)',
                      opacity: isActive ? 1 : 0.58,
                    }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate transition-colors ${isActive ? 'text-gray-200' : 'text-gray-500'}`}>
                    {node.label}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className={`text-xs font-mono ${isMax ? 'text-gold-400 font-bold' : isActive ? 'text-gray-400' : 'text-gray-600'}`}>
                      {isMax ? 'MAX' : `Lv. ${level}`}
                    </p>
                    {isActive && (
                      <span className="text-[10px] font-mono" style={{ color: node.color }}>+{bonus}%</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#0B0C10' }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: isMax ? '#EAB308' : node.color,
                    opacity: isActive ? 1 : 0,
                  }}
                />
              </div>

              {/* Level controls */}
              {isLeader && isSelected && (
                <div
                  className="mt-3 pt-3 flex items-center justify-between animate-fade-in"
                  style={{ borderTop: '1px solid #2A2A30' }}
                >
                  <button
                    onClick={e => { e.stopPropagation(); setLevel(node.id, level - 1); }}
                    disabled={level <= 0}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#252530] disabled:opacity-30 transition-all"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={0}
                      max={node.maxLevel}
                      value={level}
                      onChange={e => setLevel(node.id, parseInt(e.target.value, 10) || 0)}
                      onClick={e => e.stopPropagation()}
                      className="w-12 text-center bg-[#0B0C10] border border-[#2A2A30] rounded-lg text-sm font-mono font-bold text-gold-300 py-1 focus:outline-none focus:border-gold-500/40"
                    />
                    <span className="text-xs text-gray-600">/ {node.maxLevel}</span>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); setLevel(node.id, level + 1); }}
                    disabled={level >= node.maxLevel}
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-[#252530] disabled:opacity-30 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* MAX badge */}
              {isMax && (
                <div className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-gold-500 text-[#0B0C10]">
                  MAX
                </div>
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}
