import { useState, useMemo, useCallback, useRef } from 'react';
import {
  type CalcType,
  type Rarity,
  type RarityTierKey,
  DEFAULT_CONFIGS,
  RARITIES,
  RARITY_LABELS,
  RARITY_COLORS,
  RARITY_TIERS,
  summonPlan,
  summonPurchasePlan,
  advanceSummonLevel,
  summonsToReach,
  expectedRarityCounts,
  oddsForLevel,
  summonProgressMax,
  minLevelForRarityChance,
  rarityMaxChance,
  fmtNumber,
  parseUnit,
} from '@/lib/calculator';
import {
  Sparkles,
  Egg,
  Puzzle,
  ArrowRight,
  TrendingUp,
  Target,
  Info,
  ChevronDown,
} from 'lucide-react';

type SummonMode = 'predict' | 'target' | 'rarityTarget';

interface TabState {
  summonLevel: number;
  summonProgress: number;
  ascension: number;
  autoAscendAtMax: boolean;
  currency: string;
  costReduction: number;
  extraSummonChance: number;
  summonMode: SummonMode;
  targetLevel: number;
  targetAscension: number;
  targetRarity: Rarity;
  targetTier: RarityTierKey;
}

const defaultTabState = (): TabState => ({
  summonLevel: 1,
  summonProgress: 0,
  ascension: 0,
  autoAscendAtMax: true,
  currency: '0',
  costReduction: 0,
  extraSummonChance: 0,
  summonMode: 'predict',
  targetLevel: 10,
  targetAscension: 0,
  targetRarity: 'Legendary',
  targetTier: 'low',
});

const TABS: { key: CalcType; label: string; icon: typeof Sparkles }[] = [
  { key: 'skills', label: '스킬', icon: Sparkles },
  { key: 'pets', label: '펫', icon: Egg },
  { key: 'mounts', label: '탈것', icon: Puzzle },
];

const MODE_OPTIONS: { key: SummonMode; label: string; icon: typeof TrendingUp }[] = [
  { key: 'predict', label: '보유 재화 투입', icon: TrendingUp },
  { key: 'target', label: '목표 레벨', icon: Target },
  { key: 'rarityTarget', label: '목표 등급', icon: Target },
];

export default function CalculatorPage() {
  const [activeTab, setActiveTab] = useState<CalcType>('skills');
  const [states, setStates] = useState<Record<CalcType, TabState>>({
    skills: defaultTabState(),
    pets: defaultTabState(),
    mounts: defaultTabState(),
  });

  const s = states[activeTab];
  const cfg = DEFAULT_CONFIGS[activeTab];
  const summonCfg = cfg.summon;
  const maxLevel = summonCfg.Levels.length;

  const update = useCallback(
    (patch: Partial<TabState>) => {
      setStates((prev) => ({ ...prev, [activeTab]: { ...prev[activeTab], ...patch } }));
    },
    [activeTab],
  );

  const result = useMemo(() => {
    const costRed = Math.min(0.25, Math.max(0, s.costReduction / 100));
    const extraChance = Math.max(0, s.extraSummonChance / 100);

    if (s.summonMode === 'predict') {
      const currencyVal = Math.max(0, Math.floor(parseUnit(s.currency, 0)));
      if (currencyVal <= 0) return null;
      const plan = summonPlan(summonCfg, currencyVal, costRed);
      const extraSummons = Math.round(plan.summons * extraChance);
      const totalSummons = plan.summons + extraSummons;
      const advance = advanceSummonLevel(
        summonCfg,
        s.summonLevel,
        s.summonProgress,
        totalSummons,
        s.ascension,
        s.autoAscendAtMax,
        cfg.maxAscension,
      );
      const expected = expectedRarityCounts(
        summonCfg,
        s.summonLevel,
        s.summonProgress,
        totalSummons,
        s.ascension,
        s.autoAscendAtMax,
        cfg.maxAscension,
      );
      return {
        mode: 'predict' as const,
        totalSummons,
        baseSummons: plan.summons,
        extraSummons,
        spent: plan.spent,
        unused: plan.unused,
        costPerBatch: plan.costPerBatch,
        minBatch: plan.minBatch,
        finalLevel: advance.level,
        finalProgress: advance.progress,
        finalAscension: advance.ascension,
        expected,
        odds: oddsForLevel(summonCfg, s.summonLevel),
      };
    }

    if (s.summonMode === 'target') {
      const reach = summonsToReach(
        summonCfg,
        s.summonLevel,
        s.summonProgress,
        s.ascension,
        s.targetLevel,
        s.targetAscension,
        cfg.maxAscension,
      );
      if (!reach.reachable) return { mode: 'target' as const, reachable: false, reason: reach.reason };
      const totalWithExtra = Math.ceil(reach.summons / (1 + extraChance));
      const purchase = summonPurchasePlan(summonCfg, totalWithExtra, costRed);
      return {
        mode: 'target' as const,
        reachable: true,
        summonsNeeded: reach.summons,
        purchaseSummons: totalWithExtra,
        totalCost: purchase.cost,
        actualPulls: purchase.pulls,
      };
    }

    // rarityTarget
    const tier = RARITY_TIERS.find((t) => t.key === s.targetTier) || RARITY_TIERS[1];
    const targetLvl = minLevelForRarityChance(summonCfg, s.targetRarity, tier.threshold, s.summonLevel);
    if (targetLvl === null) {
      const maxP = rarityMaxChance(summonCfg, s.targetRarity);
      return { mode: 'rarityTarget' as const, reachable: false, maxChance: maxP };
    }
    const reach = summonsToReach(summonCfg, s.summonLevel, s.summonProgress, s.ascension, targetLvl, s.ascension, cfg.maxAscension);
    if (!reach.reachable) return { mode: 'rarityTarget' as const, reachable: false, maxChance: 0 };
    const totalWithExtra = Math.ceil(reach.summons / (1 + extraChance));
    const purchase = summonPurchasePlan(summonCfg, totalWithExtra, costRed);
    const chance = oddsForLevel(summonCfg, targetLvl).find((o) => o.rarity === s.targetRarity)?.p || 0;
    return {
      mode: 'rarityTarget' as const,
      reachable: true,
      targetLevel: targetLvl,
      summonsNeeded: reach.summons,
      purchaseSummons: totalWithExtra,
      totalCost: purchase.cost,
      chance,
    };
  }, [s, summonCfg, cfg.maxAscension, activeTab]);

  return (
    <div className="space-y-5">
      {/* Tab selector */}
      <div className="flex bg-[#121218] rounded-xl p-1 gap-1">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
              activeTab === key
                ? 'bg-gold-500/15 text-gold-300 shadow-sm'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/[0.03]'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Input panel */}
      <div className="card space-y-5">
        <div className="flex items-center gap-2 text-gold-400 font-semibold text-sm border-b border-[#1E1E28] pb-3">
          <Info className="w-4 h-4" />
          소환 정보 입력
        </div>

        {/* Current status row */}
        <div className="grid grid-cols-3 gap-3 select-none">
          <InputGroup label="소환 레벨">
            <NumberInput
              value={s.summonLevel}
              min={1}
              max={maxLevel}
              onChange={(v) => update({ summonLevel: v, summonProgress: 0 })}
            />
          </InputGroup>
          <InputGroup label="진행도">
            <ProgressSelect
              value={s.summonProgress}
              max={summonProgressMax(summonCfg, s.summonLevel)}
              onChange={(v) => update({ summonProgress: v })}
            />
          </InputGroup>
          <InputGroup label="승천 단계">
            <AscensionPicker
              value={s.ascension}
              max={cfg.maxAscension}
              onChange={(v) => update({ ascension: v })}
            />
          </InputGroup>
        </div>

        <label className="flex items-center gap-2.5 cursor-pointer text-xs text-gray-400">
          <input
            type="checkbox"
            checked={s.autoAscendAtMax}
            onChange={(e) => update({ autoAscendAtMax: e.target.checked })}
            className="accent-gold-500 w-3.5 h-3.5"
          />
          최대 레벨 도달 시 자동 승천
        </label>

        {/* Tech nodes — per-tab */}
        {activeTab === 'skills' && (
          <InputGroup label="소환 비용 감소 (%)">
            <NumberInput
              value={s.costReduction}
              min={0}
              max={25}
              onChange={(v) => update({ costReduction: v })}
            />
          </InputGroup>
        )}
        {activeTab === 'pets' && (
          <InputGroup label="추가 알 확률 (%)">
            <NumberInput
              value={s.extraSummonChance}
              min={0}
              max={50}
              onChange={(v) => update({ extraSummonChance: v })}
            />
          </InputGroup>
        )}
        {activeTab === 'mounts' && (
          <div className="grid grid-cols-2 gap-3 select-none">
            <InputGroup label="탈것 비용 감소 (%)">
              <NumberInput
                value={s.costReduction}
                min={0}
                max={25}
                onChange={(v) => update({ costReduction: v })}
              />
            </InputGroup>
            <InputGroup label="추가 탈것 확률 (%)">
              <NumberInput
                value={s.extraSummonChance}
                min={0}
                max={50}
                onChange={(v) => update({ extraSummonChance: v })}
              />
            </InputGroup>
          </div>
        )}

        {/* Mode selector */}
        <div className="pt-2 border-t border-[#1E1E28]">
          <label className="text-xs text-gray-500 mb-2 block">계산 모드</label>
          <div className="flex bg-[#0E0E14] rounded-lg p-0.5 gap-0.5">
            {MODE_OPTIONS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => update({ summonMode: key })}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs font-medium transition-all ${
                  s.summonMode === key
                    ? 'bg-gold-500/15 text-gold-300'
                    : 'text-gray-500 hover:text-gray-400'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Mode-specific inputs */}
        {s.summonMode === 'predict' && (
          <InputGroup label={`보유 ${cfg.currencyName}`}>
            <input
              type="text"
              value={s.currency}
              onChange={(e) => {
                const v = e.target.value.replace(/^0+(?=\d)/, '');
                update({ currency: v });
              }}
              placeholder="예: 50000, 50k, 1.5m"
              className="input-field"
            />
            <p className="text-[10px] text-gray-600 mt-1">k=천, m=백만, b=십억 단위 입력 가능</p>
          </InputGroup>
        )}

        {s.summonMode === 'target' && (
          <div className="grid grid-cols-2 gap-3 select-none">
            <InputGroup label="목표 레벨">
              <NumberInput
                value={s.targetLevel}
                min={1}
                max={maxLevel}
                onChange={(v) => update({ targetLevel: v })}
              />
            </InputGroup>
            <InputGroup label="목표 승천">
              <AscensionPicker
                value={s.targetAscension}
                max={cfg.maxAscension}
                onChange={(v) => update({ targetAscension: v })}
              />
            </InputGroup>
          </div>
        )}

        {s.summonMode === 'rarityTarget' && (
          <div className="grid grid-cols-2 gap-3 select-none">
            <InputGroup label="목표 등급">
              <select
                value={s.targetRarity}
                onChange={(e) => update({ targetRarity: e.target.value as Rarity })}
                className="input-field"
              >
                {RARITIES.map((r) => (
                  <option key={r} value={r}>
                    {RARITY_LABELS[r]}
                  </option>
                ))}
              </select>
            </InputGroup>
            <InputGroup label="목표 확률 구간">
              <select
                value={s.targetTier}
                onChange={(e) => update({ targetTier: e.target.value as RarityTierKey })}
                className="input-field"
              >
                {RARITY_TIERS.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label} ({t.desc})
                  </option>
                ))}
              </select>
            </InputGroup>
          </div>
        )}
      </div>

      {/* Results */}
      {result && <ResultPanel result={result} cfg={cfg} state={s} />}
    </div>
  );
}

// ─── Result Panel ──────────────────────────────────────
function ResultPanel({
  result,
  cfg,
  state: s,
}: {
  result: Record<string, unknown>;
  cfg: (typeof DEFAULT_CONFIGS)['skills'];
  state: TabState;
}) {
  if (result.mode === 'predict') {
    const r = result as {
      totalSummons: number;
      baseSummons: number;
      extraSummons: number;
      spent: number;
      unused: number;
      costPerBatch: number;
      minBatch: number;
      finalLevel: number;
      finalProgress: number;
      finalAscension: number;
      expected: Record<Rarity, number>;
      odds: { rarity: Rarity; p: number }[];
    };
    return (
      <div className="space-y-4">
        <div className="card">
          <h3 className="text-sm font-semibold text-gold-400 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            소환 결과 예측
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Metric label="총 소환 횟수" value={fmtNumber(r.totalSummons)} />
            {r.extraSummons > 0 && (
              <Metric label="추가 소환" value={`+${fmtNumber(r.extraSummons)}`} />
            )}
            <Metric label="사용 재화" value={fmtNumber(r.spent)} />
            <Metric label="남은 재화" value={fmtNumber(r.unused)} />
            <Metric
              label="도달 레벨"
              value={`Lv.${r.finalLevel}`}
              sub={`진행도 ${r.finalProgress}`}
              highlight
            />
            <Metric label="도달 승천" value={`${r.finalAscension}단계`} highlight />
          </div>
        </div>

        <RarityExpectedCard expected={r.expected} totalSummons={r.totalSummons} />

        <OddsCard odds={r.odds} level={s.summonLevel} />
      </div>
    );
  }

  if (result.mode === 'target') {
    const r = result as {
      reachable: boolean;
      reason?: string;
      summonsNeeded?: number;
      purchaseSummons?: number;
      totalCost?: number;
      actualPulls?: number;
    };
    if (!r.reachable) {
      return (
        <div className="card text-center py-6">
          <p className="text-red-400 text-sm">
            {r.reason === 'target_below'
              ? '목표가 현재 레벨보다 낮습니다.'
              : '최대 승천 단계를 초과합니다.'}
          </p>
        </div>
      );
    }
    return (
      <div className="card">
        <h3 className="text-sm font-semibold text-gold-400 mb-3 flex items-center gap-2">
          <Target className="w-4 h-4" />
          목표 레벨 도달 비용
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Metric label="필요 소환 횟수" value={fmtNumber(r.summonsNeeded || 0)} highlight />
          <Metric label="구매 소환 횟수" value={fmtNumber(r.purchaseSummons || 0)} />
          <Metric
            label={`필요 ${cfg.currencyName}`}
            value={fmtNumber(r.totalCost || 0)}
            highlight
          />
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs text-gray-500 bg-[#0E0E14] rounded-lg px-3 py-2">
          <ArrowRight className="w-3.5 h-3.5 text-gold-500/50" />
          Lv.{s.summonLevel} ({s.ascension}승천)
          <ArrowRight className="w-3 h-3" />
          Lv.{s.targetLevel} ({s.targetAscension}승천)
        </div>
      </div>
    );
  }

  if (result.mode === 'rarityTarget') {
    const r = result as {
      reachable: boolean;
      maxChance?: number;
      targetLevel?: number;
      summonsNeeded?: number;
      purchaseSummons?: number;
      totalCost?: number;
      chance?: number;
    };
    if (!r.reachable) {
      return (
        <div className="card text-center py-6">
          <p className="text-red-400 text-sm">
            해당 등급은 이 소환에서 등장하지 않습니다.
            {r.maxChance != null && r.maxChance > 0 && (
              <span className="block text-gray-500 mt-1">
                최대 확률: {(r.maxChance * 100).toFixed(2)}%
              </span>
            )}
          </p>
        </div>
      );
    }
    return (
      <div className="card">
        <h3 className="text-sm font-semibold text-gold-400 mb-3 flex items-center gap-2">
          <Target className="w-4 h-4" />
          목표 등급 도달 비용
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Metric label="도달 레벨" value={`Lv.${r.targetLevel}`} highlight />
          <Metric label="회당 확률" value={`${((r.chance || 0) * 100).toFixed(2)}%`} />
          <Metric label="필요 소환" value={fmtNumber(r.summonsNeeded || 0)} />
          <Metric label="구매 소환" value={fmtNumber(r.purchaseSummons || 0)} />
          <Metric
            label={`필요 ${cfg.currencyName}`}
            value={fmtNumber(r.totalCost || 0)}
            highlight
          />
        </div>
        <div className="mt-3 text-xs text-gray-500 bg-[#0E0E14] rounded-lg px-3 py-2">
          {RARITY_LABELS[s.targetRarity]} 등급이{' '}
          {RARITY_TIERS.find((t) => t.key === s.targetTier)?.label || ''} 확률 이상이 되는 첫 레벨
        </div>
      </div>
    );
  }

  return null;
}

// ─── Sub-components ────────────────────────────────────
function RarityExpectedCard({
  expected,
  totalSummons,
}: {
  expected: Record<Rarity, number>;
  totalSummons: number;
}) {
  const [open, setOpen] = useState(true);
  const nonZero = RARITIES.filter((r) => expected[r] > 0.01);
  if (!nonZero.length) return null;

  return (
    <div className="card">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-sm font-semibold text-gray-300 mb-2"
      >
        기대 등급 분포
        <ChevronDown
          className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="space-y-2">
          {nonZero.map((r) => {
            const count = expected[r];
            const pct = totalSummons > 0 ? (count / totalSummons) * 100 : 0;
            return (
              <div key={r} className="flex items-center gap-3">
                <span
                  className="text-xs font-medium w-16 text-right"
                  style={{ color: RARITY_COLORS[r] }}
                >
                  {RARITY_LABELS[r]}
                </span>
                <div className="flex-1 h-5 bg-[#0E0E14] rounded-md overflow-hidden relative">
                  <div
                    className="h-full rounded-md transition-all duration-500"
                    style={{
                      width: `${Math.min(100, pct)}%`,
                      backgroundColor: RARITY_COLORS[r] + '40',
                      borderRight: `2px solid ${RARITY_COLORS[r]}`,
                    }}
                  />
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-400 font-mono">
                    {count.toFixed(1)}개 ({pct.toFixed(1)}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function OddsCard({ odds, level }: { odds: { rarity: Rarity; p: number }[]; level: number }) {
  const [open, setOpen] = useState(false);
  const nonZero = odds.filter((o) => o.p > 0);
  if (!nonZero.length) return null;

  return (
    <div className="card">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-sm font-semibold text-gray-300"
      >
        Lv.{level} 회당 확률
        <ChevronDown
          className={`w-4 h-4 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="mt-2 space-y-1.5">
          {nonZero.map(({ rarity, p }) => (
            <div key={rarity} className="flex items-center justify-between text-xs">
              <span style={{ color: RARITY_COLORS[rarity] }}>{RARITY_LABELS[rarity]}</span>
              <span className="font-mono text-gray-400">{(p * 100).toFixed(2)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  sub,
  highlight,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <div className="bg-[#0E0E14] rounded-lg px-3 py-2.5">
      <div className="text-[10px] text-gray-500 mb-1">{label}</div>
      <div className={`text-sm font-bold font-mono ${highlight ? 'text-gold-300' : 'text-gray-200'}`}>
        {value}
      </div>
      {sub && <div className="text-[10px] text-gray-600 mt-0.5">{sub}</div>}
    </div>
  );
}

function InputGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] text-gray-500 mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

function NumberInput({
  value,
  min,
  max,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const [draft, setDraft] = useState<string>(String(value));
  const prevValue = useRef(value);
  const prevMax = useRef(max);

  if (prevValue.current !== value && String(value) !== draft) {
    setDraft(String(value));
  }
  prevValue.current = value;

  if (prevMax.current !== max) {
    prevMax.current = max;
    const cur = parseInt(draft, 10);
    if (Number.isFinite(cur) && cur > max) {
      const clamped = Math.max(min, max);
      setDraft(String(clamped));
      onChange(clamped);
    }
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      value={draft}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9-]/g, '').replace(/^0+(?=\d)/, '');
        setDraft(raw);
        const v = parseInt(raw, 10);
        if (Number.isFinite(v)) {
          const clamped = Math.max(min, Math.min(max, v));
          setDraft(String(clamped));
          onChange(clamped);
        }
      }}
      onFocus={(e) => e.target.select()}
      onBlur={() => {
        const v = parseInt(draft, 10);
        const clamped = Number.isFinite(v) ? Math.max(min, Math.min(max, v)) : min;
        onChange(clamped);
        setDraft(String(clamped));
      }}
      onMouseDown={(e) => e.stopPropagation()}
      className="input-field font-mono select-text"
    />
  );
}

function ProgressSelect({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const clamped = Math.min(value, max);
  const options = useMemo(
    () => Array.from({ length: max + 1 }, (_, i) => i),
    [max],
  );

  return (
    <select
      value={clamped}
      onChange={(e) => onChange(Number(e.target.value))}
      className="input-field font-mono appearance-none cursor-pointer"
    >
      {options.map((n) => (
        <option key={n} value={n}>
          {n} / {max}
        </option>
      ))}
    </select>
  );
}

function AscensionPicker({
  value,
  max,
  onChange,
}: {
  value: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max + 1 }, (_, i) => (
        <button
          key={i}
          onClick={() => onChange(i)}
          className={`flex-1 py-1.5 rounded-md text-xs font-semibold transition-all ${
            value === i
              ? 'bg-gold-500/20 text-gold-300 ring-1 ring-gold-500/30'
              : 'bg-[#0E0E14] text-gray-500 hover:text-gray-300'
          }`}
        >
          {i}
        </button>
      ))}
    </div>
  );
}
