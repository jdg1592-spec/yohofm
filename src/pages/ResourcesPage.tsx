import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  isWithinWeeklyWindow,
  getCurrentWeekStart,
  getNextSubmissionWindow,
  formatKstTimestamp,
  type WeeklyResource,
} from '@/lib/types';
import {
  ClipboardCheck,
  Save,
  Clock,
  Lock,
  CheckCircle2,
  AlertTriangle,
  Stamp,
} from 'lucide-react';

const RESOURCE_FIELDS = [
  { key: 'skill_tickets' as const, label: '스킬 티켓', placeholder: '0' },
  { key: 'egg_shells' as const, label: '알 껍데기', placeholder: '0' },
  { key: 'pet_eggs' as const, label: '펫 알', placeholder: '0' },
  { key: 'mount_resources' as const, label: '탈것', placeholder: '0' },
  { key: 'mounts' as const, label: '태엽', placeholder: '0' },
  { key: 'clan_elixirs' as const, label: '초록 물약', placeholder: '0' },
];

const MORNING_DAYS = [
  { value: 1, label: '1일차' },
  { value: 2, label: '2일차' },
  { value: 3, label: '3일차' },
  { value: 4, label: '4일차' },
  { value: 5, label: '5일차' },
];

type ResourceForm = {
  skill_tickets: string;
  egg_shells: string;
  pet_eggs: string;
  mount_resources: string;
  mounts: string;
  clan_elixirs: string;
  morning_push_days: number[];
};

function toSavedNumber(value: string): number {
  const normalized = value.trim().toLowerCase().replace(/,/g, '');
  if (!normalized) return 0;
  const match = normalized.match(/^(\d+(?:\.\d+)?)k$/);
  const parsed = match ? Number(match[1]) * 1000 : Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0;
}

export default function ResourcesPage() {
  const { profile } = useAuth();
  const [resource, setResource] = useState<WeeklyResource | null>(null);
  const [form, setForm] = useState<ResourceForm>({
    skill_tickets: '0',
    egg_shells: '0',
    pet_eggs: '0',
    mount_resources: '0',
    mounts: '0',
    clan_elixirs: '0',
    morning_push_days: [] as number[],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const weekStart = getCurrentWeekStart();
  const windowOpen = isWithinWeeklyWindow();
  const isLocked = profile?.red_warning === true;
  const hasSubmitted = resource !== null;
  const nextWindow = getNextSubmissionWindow();

  useEffect(() => {
    if (!profile) return;
    (async () => {
      const { data } = await supabase
        .from('weekly_resources')
        .select('*')
        .eq('user_id', profile.id)
        .eq('week_start', weekStart)
        .maybeSingle();
      if (data) {
        setResource(data);
        setForm({
          skill_tickets: String(data.skill_tickets),
          egg_shells: String(data.egg_shells),
          pet_eggs: String(data.pet_eggs),
          mount_resources: String(data.mount_resources),
          mounts: String(data.mounts),
          clan_elixirs: String(data.clan_elixirs),
          morning_push_days: data.morning_push_days || [],
        });
      }
      setLoading(false);
    })();
  }, [profile, weekStart]);

  const toggleDay = (day: number) => {
    setForm(prev => ({
      ...prev,
      morning_push_days: prev.morning_push_days.includes(day)
        ? prev.morning_push_days.filter(d => d !== day)
        : [...prev.morning_push_days, day].sort((a, b) => a - b),
    }));
  };

  const handleSave = async () => {
    if (!profile || (!windowOpen && profile.role !== 'leader' && profile.role !== 'acting-leader') || isLocked) return;
    setSaving(true);
    setSaved(false);

    const now = new Date().toISOString();
    const payload = {
      skill_tickets: toSavedNumber(form.skill_tickets),
      egg_shells: toSavedNumber(form.egg_shells),
      pet_eggs: toSavedNumber(form.pet_eggs),
      mount_resources: toSavedNumber(form.mount_resources),
      mounts: toSavedNumber(form.mounts),
      clan_elixirs: toSavedNumber(form.clan_elixirs),
      morning_push_days: form.morning_push_days,
      week_start: weekStart,
      submitted_at: now,
      updated_at: now,
    };

    if (resource) {
      const { error, data } = await supabase
        .from('weekly_resources')
        .update(payload)
        .eq('id', resource.id)
        .select()
        .maybeSingle();
      if (!error && data) {
        setResource(data);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } else {
      const { data, error } = await supabase
        .from('weekly_resources')
        .insert({ user_id: profile.id, ...payload })
        .select()
        .maybeSingle();
      if (!error && data) {
        setResource(data);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-gold-500/30 border-t-gold-400 rounded-full animate-spin" />
      </div>
    );
  }

  const isLeader = profile?.role === 'leader' || profile?.role === 'acting-leader';
  const canSubmit = (windowOpen || isLeader) && !isLocked;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gold-300 flex items-center gap-3">
          <ClipboardCheck className="w-6 h-6 text-gold-400" />
          군장 검사
        </h1>
        <p className="text-sm text-gray-500 mt-1">이번 주 재화 보유량을 입력하세요</p>
      </div>

      {/* Status banners */}
      <div className="space-y-3">
        {isLocked && (
          <div className="card red-warning-glow flex items-center gap-3">
            <Lock className="w-5 h-5 text-red-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-400">빨간불 경고 - 입력 잠김</p>
              <p className="text-xs text-red-400/70 mt-0.5">리더가 상태를 확인하고 해제해야 입력할 수 있습니다.</p>
            </div>
          </div>
        )}

        {/* Submission status: red warning or green stamp */}
        {!isLocked && !hasSubmitted && (
          <div className="card border-red-500/30 bg-red-500/5 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-sm font-bold text-red-400">빠딱빠딱 적으라요 떼잉</p>
          </div>
        )}

        {!isLocked && hasSubmitted && (
          <div className="card border-emerald-500/30 bg-emerald-500/5 flex items-center gap-3 relative overflow-hidden">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/15 border-2 border-emerald-500/40 flex items-center justify-center shrink-0 rotate-[-6deg]">
                <Stamp className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-bold text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  제출 완료
                </p>
                <p className="text-xs text-emerald-400/70 mt-0.5">
                  완료 시간: {formatKstTimestamp(resource.submitted_at || resource.updated_at)}
                </p>
              </div>
            </div>
            <div className="absolute -right-2 -top-2 w-20 h-20 rounded-full bg-emerald-500/5" />
          </div>
        )}

        {/* Deadline window info */}
        <div className={`card flex items-center gap-3 ${
          windowOpen ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-amber-500/30 bg-amber-500/5'
        }`}>
          {windowOpen ? (
            <>
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-400">입력 가능 시간</p>
                <p className="text-xs text-emerald-400/70 mt-0.5">
                  현재 제출 가능: KST {nextWindow.startLabel} ~ {nextWindow.endLabel}
                </p>
              </div>
            </>
          ) : (
            <>
              <Clock className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-400">입력 시간 마감</p>
                <p className="text-xs text-amber-400/70 mt-0.5">
                  다음 입력: KST {nextWindow.startLabel} ~ {nextWindow.endLabel}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Week indicator */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-500">주간 시작일:</span>
        <span className="text-gold-400 font-mono font-semibold">{weekStart}</span>
      </div>

      {/* Resource inputs - always enabled */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {RESOURCE_FIELDS.map(field => (
          <div key={field.key} className="card-hover">
            <label className="label-text">{field.label}</label>
            <input
              type="text"
              inputMode="decimal"
              value={form[field.key]}
              onChange={e =>
                setForm(prev => ({
                  ...prev,
                  [field.key]: e.target.value,
                }))
              }
              className="input-field font-mono text-lg"
              placeholder={`${field.placeholder} 또는 1.67k`}
            />
          </div>
        ))}
      </div>

      {/* Morning push schedule - always enabled */}
      <div className="card">
        <h3 className="text-sm font-semibold text-gray-200 mb-3">아침조 스케줄</h3>
        <p className="text-xs text-gray-500 mb-4">아침 푸시를 수행하는 날을 선택하세요</p>
        <div className="flex flex-wrap gap-2">
          {MORNING_DAYS.map(day => {
            const selected = form.morning_push_days.includes(day.value);
            return (
              <button
                key={day.value}
                type="button"
                onClick={() => toggleDay(day.value)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  selected
                    ? 'bg-gold-500/20 text-gold-300 border border-gold-500/40'
                    : 'bg-[#121212] text-gray-500 border border-[#2A2A30] hover:border-gray-500'
                }`}
              >
                {day.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Save / submit */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={!canSubmit || saving}
            className="btn-gold flex items-center gap-2"
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-[#0B0C10]/30 border-t-[#0B0C10] rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? '저장 중...' : '제출'}
          </button>
          {saved && (
            <span className="text-sm text-emerald-400 animate-fade-in">저장되었습니다!</span>
          )}
        </div>
      </div>
    </div>
  );
}
