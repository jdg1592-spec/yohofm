import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { TechTree } from '@/lib/types';
import { TreePine, Save, RotateCcw, Info } from 'lucide-react';

interface TechField {
  key: 'skill_cost_reduction' | 'mount_cost_reduction' | 'extra_mount_chance' | 'extra_egg_chance';
  label: string;
  unit: string;
  sliderMin: number;
  sliderMax: number;
  step: number;
  description: string;
  isReduction: boolean;
}

const TECH_FIELDS: TechField[] = [
  { key: 'skill_cost_reduction', label: '스킬 비용 감소', unit: '%', sliderMin: 0, sliderMax: 25, step: 1, description: '스킬 사용 비용을 줄여줍니다 (최대 -25%)', isReduction: true },
  { key: 'mount_cost_reduction', label: '탈것 비용 감소', unit: '%', sliderMin: 0, sliderMax: 25, step: 1, description: '탈것 관련 비용을 줄여줍니다 (최대 -25%)', isReduction: true },
  { key: 'extra_mount_chance', label: '추가 탈것 확률', unit: '%', sliderMin: 0, sliderMax: 50, step: 1, description: '탈것 추가 획득 확률 (최대 +50%)', isReduction: false },
  { key: 'extra_egg_chance', label: '추가 알 확률', unit: '%', sliderMin: 0, sliderMax: 50, step: 1, description: '펫 알 추가 획득 확률 (최대 +50%)', isReduction: false },
];

function toSliderValue(field: TechField, stored: number): number {
  return field.isReduction ? Math.abs(stored) : stored;
}

function toStoredValue(field: TechField, slider: number): number {
  return field.isReduction ? -Math.abs(slider) : slider;
}

function formatDisplay(field: TechField, stored: number): string {
  if (stored === 0) return `0${field.unit}`;
  if (field.isReduction) return `${stored}${field.unit}`;
  return `+${stored}${field.unit}`;
}

export default function TechTreePage() {
  const { profile } = useAuth();
  const [techTree, setTechTree] = useState<TechTree | null>(null);
  const [form, setForm] = useState({
    skill_cost_reduction: 0,
    mount_cost_reduction: 0,
    extra_mount_chance: 0,
    extra_egg_chance: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data } = await supabase
        .from('tech_trees')
        .select('*')
        .eq('user_id', profile.id)
        .maybeSingle();
      if (data) {
        setTechTree(data);
        setForm({
          skill_cost_reduction: data.skill_cost_reduction,
          mount_cost_reduction: data.mount_cost_reduction,
          extra_mount_chance: data.extra_mount_chance,
          extra_egg_chance: data.extra_egg_chance,
        });
      }
      setLoading(false);
    })();
  }, [profile]);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    setSaved(false);

    if (techTree) {
      const { error } = await supabase
        .from('tech_trees')
        .update({ ...form, updated_at: new Date().toISOString() })
        .eq('id', techTree.id);
      if (!error) {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } else {
      const { data, error } = await supabase
        .from('tech_trees')
        .insert({ user_id: profile.id, ...form })
        .select()
        .maybeSingle();
      if (!error && data) {
        setTechTree(data);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    }
    setSaving(false);
  };

  const handleReset = () => {
    setForm({
      skill_cost_reduction: 0,
      mount_cost_reduction: 0,
      extra_mount_chance: 0,
      extra_egg_chance: 0,
    });
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gold-300 flex items-center gap-3">
            <TreePine className="w-6 h-6 text-gold-400" />
            개인 기술
          </h1>
          <p className="text-sm text-gray-500 mt-1">나의 기술 트리 버프 수치를 입력하세요</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {TECH_FIELDS.map(field => {
          const storedValue = form[field.key];
          const sliderValue = toSliderValue(field, storedValue);
          const fillPercent = ((sliderValue - field.sliderMin) / (field.sliderMax - field.sliderMin)) * 100;

          return (
            <div key={field.key} className="card-hover animate-slide-up">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <label className="text-sm font-semibold text-gray-200">{field.label}</label>
                  <p className="text-xs text-gray-500 mt-0.5">{field.description}</p>
                </div>
                <span className="text-xs text-gray-600 bg-[#121212] px-2 py-1 rounded">
                  {field.isReduction ? `0~-${field.sliderMax}` : `0~+${field.sliderMax}`}{field.unit}
                </span>
              </div>

              {/* Slider with left/right labels */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-gray-600 w-8 text-right shrink-0">0%</span>
                <input
                  type="range"
                  min={field.sliderMin}
                  max={field.sliderMax}
                  step={field.step}
                  value={sliderValue}
                  onChange={e => {
                    const sv = Number(e.target.value);
                    setForm(prev => ({ ...prev, [field.key]: toStoredValue(field, sv) }));
                  }}
                  className="flex-1 h-2 bg-[#121212] rounded-full appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-gold-400
                    [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-gold-500/30
                    [&::-webkit-slider-thumb]:cursor-pointer"
                />
                <span className="text-xs text-gray-600 w-10 shrink-0">
                  {field.isReduction ? `-${field.sliderMax}%` : `+${field.sliderMax}%`}
                </span>
              </div>

              {/* Number input showing stored value */}
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1" />
                <div className="w-24">
                  <input
                    type="number"
                    min={field.isReduction ? -field.sliderMax : field.sliderMin}
                    max={field.isReduction ? 0 : field.sliderMax}
                    step={field.step}
                    value={storedValue}
                    onChange={e => {
                      const raw = Number(e.target.value);
                      const lo = field.isReduction ? -field.sliderMax : field.sliderMin;
                      const hi = field.isReduction ? 0 : field.sliderMax;
                      const clamped = Math.min(hi, Math.max(lo, raw));
                      setForm(prev => ({ ...prev, [field.key]: clamped }));
                    }}
                    className="input-field text-center text-sm font-mono"
                  />
                </div>
                <span className="text-sm text-gray-500 w-6">{field.unit}</span>
              </div>

              {/* Progress bar */}
              <div className="mt-3 h-1.5 bg-[#121212] rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-gold-600 to-gold-400 rounded-full transition-all duration-300"
                  style={{ width: `${fillPercent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary card */}
      <div className="card border-gold-500/20">
        <div className="flex items-center gap-2 mb-4">
          <Info className="w-4 h-4 text-gold-400" />
          <h3 className="text-sm font-semibold text-gold-300">기술 트리 요약</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {TECH_FIELDS.map(field => (
            <div key={field.key} className="bg-[#121212] rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">{field.label}</p>
              <p className={`text-lg font-bold font-mono ${
                form[field.key] !== 0 ? 'text-gold-300' : 'text-gray-600'
              }`}>
                {formatDisplay(field, form[field.key])}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving} className="btn-gold flex items-center gap-2">
          {saving ? (
            <div className="w-4 h-4 border-2 border-[#0B0C10]/30 border-t-[#0B0C10] rounded-full animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          {saving ? '저장 중...' : '저장하기'}
        </button>
        <button onClick={handleReset} className="btn-outline flex items-center gap-2">
          <RotateCcw className="w-4 h-4" />
          초기화
        </button>
        {saved && (
          <span className="text-sm text-emerald-400 animate-fade-in">저장되었습니다!</span>
        )}
      </div>
    </div>
  );
}
