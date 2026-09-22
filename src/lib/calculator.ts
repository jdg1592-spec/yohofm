// Summon calculator engine — ported 1:1 from app.js formulas.
// Levels data imported from summonData.ts (extracted from game JSON configs).

export const RARITIES = ['Common', 'Rare', 'Epic', 'Legendary', 'Ultimate', 'Mythic'] as const;
export type Rarity = (typeof RARITIES)[number];

export const RARITY_LABELS: Record<Rarity, string> = {
  Common: '일반',
  Rare: '희귀',
  Epic: '서사시',
  Legendary: '전설',
  Ultimate: '궁극의',
  Mythic: '신화',
};

export const RARITY_COLORS: Record<Rarity, string> = {
  Common: '#FFFFFF',
  Rare: '#3B82F6',
  Epic: '#22C55E',
  Legendary: '#EAB308',
  Ultimate: '#EF4444',
  Mythic: '#A855F7',
};

export type { SummonLevelRow } from './types';
import type { SummonLevelRow } from './types';

export interface SummonConfig {
  Levels: SummonLevelRow[];
  SingleSummonCost: { Amount: number };
  PossibleSummonCount: number[];
}

export type CalcType = 'skills' | 'pets' | 'mounts';

export interface CalcTypeConfig {
  label: string;
  currencyName: string;
  maxAscension: number;
  summon: SummonConfig;
}

// ─── Clamp ─────────────────────────────────────────────
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// ─── summonReqAt ───────────────────────────────────────
export function summonReqAt(cfg: SummonConfig, level: number): number {
  const maxLvl = cfg.Levels.length;
  const lv = clamp(Math.floor(level), 1, maxLvl);
  return lv < maxLvl ? (Number(cfg.Levels[lv]?.SummonsRequired) || 1) : 0;
}

export function summonProgressMax(cfg: SummonConfig, level: number): number {
  return Math.max(0, summonReqAt(cfg, level) - 1);
}

// ─── Batch sizes ───────────────────────────────────────
function summonBatchSizes(cfg: SummonConfig): number[] {
  const batches = (cfg.PossibleSummonCount || [1])
    .filter((c) => c > 0)
    .sort((a, b) => a - b);
  return batches.length ? batches : [1];
}

// ─── summonPurchasePlan ────────────────────────────────
export interface PurchasePlan {
  cost: number;
  pulls: number;
}

export function summonPurchasePlan(
  cfg: SummonConfig,
  atLeast: number,
  costReduction = 0,
): PurchasePlan {
  const baseCost = cfg.SingleSummonCost.Amount;
  const perRaw = Math.max(1, baseCost * Math.max(0, 1 - costReduction));
  const batches = summonBatchSizes(cfg);
  const priceOf = (count: number) => Math.round(perRaw * count);
  const n = Math.max(0, Math.ceil(atLeast));
  if (n === 0) return { cost: 0, pulls: 0 };
  if (n <= 200000) {
    const cost = new Array(n + 1).fill(Infinity);
    const pick = new Array(n + 1).fill(0);
    cost[0] = 0;
    for (let i = 1; i <= n; i++) {
      for (const b of batches) {
        const c = cost[Math.max(0, i - b)] + priceOf(b);
        if (c < cost[i]) {
          cost[i] = c;
          pick[i] = b;
        }
      }
    }
    let pulls = 0;
    for (let i = n; i > 0; i = Math.max(0, i - pick[i])) pulls += pick[i];
    return { cost: cost[n], pulls };
  }
  let remaining = n;
  let cost = 0;
  let pulls = 0;
  for (let i = batches.length - 1; i >= 0; i--) {
    const b = batches[i];
    const buy = i === 0 ? Math.ceil(remaining / b) : Math.floor(remaining / b);
    if (buy > 0) {
      cost += buy * priceOf(b);
      pulls += buy * b;
      remaining -= buy * b;
    }
    if (remaining <= 0) break;
  }
  return { cost, pulls };
}

// ─── summonPlan ────────────────────────────────────────
export interface SummonPlanResult {
  summons: number;
  minBatch: number;
  cost: number;
  costPerBatch: number;
  baseCost: number;
  spent: number;
  unused: number;
}

export function summonPlan(
  cfg: SummonConfig,
  currency: number,
  costReduction = 0,
): SummonPlanResult {
  const baseCost = cfg.SingleSummonCost.Amount;
  const perRaw = Math.max(1, baseCost * Math.max(0, 1 - costReduction));
  const batches = summonBatchSizes(cfg);
  const minBatch = batches[0];
  const priceOf = (count: number) => Math.round(perRaw * count);
  let remaining = Math.max(0, Math.floor(currency));
  let summons = 0;
  let spent = 0;
  for (let i = batches.length - 1; i >= 0; i--) {
    const price = priceOf(batches[i]);
    if (price <= 0) continue;
    const buy = Math.floor(remaining / price);
    if (buy > 0) {
      summons += buy * batches[i];
      spent += buy * price;
      remaining -= buy * price;
    }
  }
  return { summons, minBatch, cost: perRaw, costPerBatch: priceOf(minBatch), baseCost, spent, unused: Math.max(0, currency - spent) };
}

// ─── advanceSummonLevel ────────────────────────────────
export interface AdvanceResult {
  level: number;
  progress: number;
  ascension: number;
  summonsAtFinalAscension: number;
  perAscension: Record<number, number>;
}

export function advanceSummonLevel(
  cfg: SummonConfig,
  level: number,
  progress: number,
  addSummons: number,
  ascension = 0,
  autoAscendAtMax = false,
  maxAsc = 0,
): AdvanceResult {
  let current = clamp(Math.floor(level), 1, cfg.Levels.length);
  let currentProgress = Math.max(0, Math.floor(progress));
  let remaining = Math.max(0, Math.floor(addSummons));
  let currentAscension = clamp(Math.floor(ascension), 0, maxAsc);
  let summonsAtFinalAscension = 0;
  const perAscension: Record<number, number> = {};
  const addAt = (asc: number, n: number) => {
    if (n > 0) perAscension[asc] = (perAscension[asc] || 0) + n;
  };

  while (remaining > 0) {
    if (current >= cfg.Levels.length) {
      if (!autoAscendAtMax || currentAscension >= maxAsc) {
        current = cfg.Levels.length;
        currentProgress += remaining;
        summonsAtFinalAscension += remaining;
        addAt(currentAscension, remaining);
        remaining = 0;
        break;
      }
      remaining -= 1;
      addAt(currentAscension, 1);
      currentAscension += 1;
      current = 1;
      currentProgress = 0;
      summonsAtFinalAscension = 0;
      continue;
    }
    const required = summonReqAt(cfg, current);
    const need = Math.max(0, required - currentProgress);
    if (remaining < need) {
      currentProgress += remaining;
      summonsAtFinalAscension += remaining;
      addAt(currentAscension, remaining);
      remaining = 0;
      break;
    }
    remaining -= need;
    summonsAtFinalAscension += need;
    addAt(currentAscension, need);
    current += 1;
    currentProgress = 0;
  }

  return { level: current, progress: currentProgress, ascension: currentAscension, summonsAtFinalAscension, perAscension };
}

// ─── summonsToReach ────────────────────────────────────
export interface ReachResult {
  reachable: boolean;
  summons: number;
  reason?: string;
}

export function summonsToReach(
  cfg: SummonConfig,
  fromLevel: number,
  fromProgress: number,
  fromAsc: number,
  toLevel: number,
  toAsc: number,
  maxAsc: number,
  toProgress = 0,
): ReachResult {
  const maxLvl = cfg.Levels.length;
  const start = clamp(Math.floor(fromLevel), 1, maxLvl);
  const target = clamp(Math.floor(toLevel), 1, maxLvl);
  const fA = clamp(Math.floor(fromAsc), 0, maxAsc);
  const tA = clamp(Math.floor(toAsc), 0, maxAsc);
  const targetReq = summonReqAt(cfg, target);
  const targetProgClamped = clamp(Math.floor(toProgress), 0, targetReq);
  if (tA < fA) return { reachable: false, summons: 0, reason: 'target_below' };
  if (tA === fA && target < start) return { reachable: false, summons: 0, reason: 'target_below' };
  if (tA === fA && target === start && fromProgress >= targetProgClamped) {
    return { reachable: true, summons: 0 };
  }
  let need = 0;
  let lvl = start;
  let prog = Math.max(0, Math.floor(fromProgress));
  let asc = fA;
  while (asc < tA || lvl < target) {
    if (lvl >= maxLvl) {
      if (asc >= tA) break;
      if (asc >= maxAsc) return { reachable: false, summons: 0, reason: 'ascension_max' };
      need += 1;
      asc += 1;
      lvl = 1;
      prog = 0;
      continue;
    }
    const required = summonReqAt(cfg, lvl);
    const step = Math.max(0, required - prog);
    need += step;
    lvl += 1;
    prog = 0;
  }
  if (targetProgClamped > prog) {
    need += targetProgClamped - prog;
  }
  return { reachable: true, summons: need };
}

// ─── oddsForLevel ──────────────────────────────────────
export interface RarityOdds {
  rarity: Rarity;
  p: number;
}

export function oddsForLevel(cfg: SummonConfig, level: number): RarityOdds[] {
  const row = cfg.Levels[clamp(Math.floor(level), 1, cfg.Levels.length) - 1];
  return RARITIES.map((rarity) => ({ rarity, p: Number(row?.[rarity]) || 0 }));
}

// ─── expectedRarityCounts ──────────────────────────────
export function expectedRarityCounts(
  cfg: SummonConfig,
  summonLevel: number,
  progress: number,
  summons: number,
  ascension: number,
  autoAscendAtMax: boolean,
  maxAsc: number,
): Record<Rarity, number> {
  const expected = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<Rarity, number>;
  let level = clamp(Math.floor(summonLevel), 1, cfg.Levels.length);
  let levelProgress = Math.max(0, Math.floor(progress));
  let currentAscension = ascension;

  const count = Math.min(summons, 500000);
  for (let i = 0; i < count; i++) {
    for (const { rarity, p } of oddsForLevel(cfg, level)) {
      if (p > 0) expected[rarity] += p;
    }
    const advanced = advanceSummonLevel(cfg, level, levelProgress, 1, currentAscension, autoAscendAtMax, maxAsc);
    level = advanced.level;
    levelProgress = advanced.progress;
    currentAscension = advanced.ascension;
  }
  return expected;
}

// ─── Rarity tier info ──────────────────────────────────
export const RARITY_TIERS = [
  { key: 'appear', label: '출현', desc: '2% 미만', threshold: Number.EPSILON },
  { key: 'low', label: '낮음', desc: '8% 미만', threshold: 0.02 },
  { key: 'normal', label: '보통', desc: '10% 이상', threshold: 0.1 },
] as const;

export type RarityTierKey = (typeof RARITY_TIERS)[number]['key'];

export function minLevelForRarityChance(
  cfg: SummonConfig,
  rarity: Rarity,
  threshold: number,
  fromLvl = 1,
): number | null {
  const start = clamp(Math.floor(fromLvl), 1, cfg.Levels.length);
  for (let i = start - 1; i < cfg.Levels.length; i++) {
    if ((Number(cfg.Levels[i][rarity]) || 0) >= threshold) return i + 1;
  }
  return null;
}

export function rarityMaxChance(cfg: SummonConfig, rarity: Rarity): number {
  let max = 0;
  for (const row of cfg.Levels) {
    const p = Number(row[rarity]) || 0;
    if (p > max) max = p;
  }
  return max;
}

// ─── Number formatting ─────────────────────────────────
export function fmtNumber(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 10_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString('ko-KR');
}

export function parseUnit(v: string, d = 0): number {
  const s = v.trim().replace(/,/g, '').replace(/\s+/g, '');
  if (s === '') return d;
  const m = s.match(/^(-?\d*\.?\d+)([kmbt])?$/i);
  if (!m) return d;
  const mult: Record<string, number> = { k: 1e3, m: 1e6, b: 1e9, t: 1e12 };
  const n = Number(m[1]) * (mult[(m[2] || '').toLowerCase()] || 1);
  return Number.isFinite(n) ? n : d;
}

// ─── Legacy exports for TechNodeModal ──────────────────
export type TechNodeValues = Record<string, number>;
export const STAGE_LABELS = ['1단계', '2단계', '3단계', '4단계', '5단계'];
export const MAX_POINTS_PER_STAGE = 20;
export function calcTechNodeTotal(values: TechNodeValues): number {
  return Object.values(values).reduce((sum, v) => sum + (v || 0), 0);
}

// ─── Real game summon configs (from SkillSummonConfig / EggSummonConfig / MountSummonConfig JSON) ──
import { SKILL_LEVELS, PET_LEVELS, MOUNT_LEVELS } from './summonData';

export const DEFAULT_CONFIGS: Record<CalcType, CalcTypeConfig> = {
  skills: {
    label: '스킬',
    currencyName: '스킬 소환권',
    maxAscension: 3,
    summon: {
      Levels: SKILL_LEVELS,
      SingleSummonCost: { Amount: 40 },
      PossibleSummonCount: [5, 75, 250],
    },
  },
  pets: {
    label: '펫',
    currencyName: '알껍질',
    maxAscension: 3,
    summon: {
      Levels: PET_LEVELS,
      SingleSummonCost: { Amount: 100 },
      PossibleSummonCount: [1, 15, 50],
    },
  },
  mounts: {
    label: '탈것',
    currencyName: '태엽',
    maxAscension: 3,
    summon: {
      Levels: MOUNT_LEVELS,
      SingleSummonCost: { Amount: 50 },
      PossibleSummonCount: [1, 15, 50],
    },
  },
};
