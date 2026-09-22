export interface DayScoreResult {
  baseScore: number;
  buffRate: number;
  finalScore: number;
}

export const SCORE_SOURCE_KEYS = [
  'skill_summon', 'skill_merge', 'pet_owned_merge', 'pet_summoned_merge',
  'mount_owned_merge', 'mount_summon', 'mount_summoned_merge',
] as const;

export type ScoreSourceKey = typeof SCORE_SOURCE_KEYS[number];

export const SCORE_SOURCE_LABELS: Record<ScoreSourceKey, string> = {
  skill_summon: '스킬 소환',
  skill_merge: '스킬 합성',
  pet_owned_merge: '보유 알·펫 합성',
  pet_summoned_merge: '알껍데기 유래 알 합성',
  mount_owned_merge: '보유 탈것 합성',
  mount_summon: '태엽 소환',
  mount_summoned_merge: '소환 탈것 합성',
};

export type DayScoreBreakdown = Record<ScoreSourceKey, number>;

export interface ClanTechEntry { level: number; ratePerLevel: number; }
export interface ClanTechState {
  dayTechs: Record<number, ClanTechEntry>;
  categoryTechs: Record<string, ClanTechEntry>;
}

export interface PersonalTechInput {
  skill_cost_reduction?: number;
  mount_cost_reduction?: number;
  extra_mount_chance?: number;
  extra_egg_chance?: number;
}

const SKILL_SUMMON_UNIT = 125;
const SKILL_MERGE_UNIT = 125;
const MOUNT_SUMMON_UNIT = 600;
const MOUNT_MERGE_UNIT = 600;
const PET_MERGE_UNIT = 1250;
const RATE_PER_LEVEL = 0.04;

function nodeBuff(nodes: Record<string, number>, nodeId: string): number {
  return (nodes[nodeId] || 0) * RATE_PER_LEVEL;
}

function applyBuff(base: number, buff: number): number {
  return Math.floor(base * (1 + buff));
}

function emptyBreakdown(): DayScoreBreakdown {
  return Object.fromEntries(SCORE_SOURCE_KEYS.map(key => [key, 0])) as DayScoreBreakdown;
}

function discountedCost(baseCost: number, storedReduction: number | undefined): number {
  const reduction = Math.min(100, Math.max(0, Math.abs(storedReduction || 0))) / 100;
  return Math.max(1, Math.ceil(baseCost * (1 - reduction)));
}

function guaranteedExtra99(attempts: number, chance: number): number {
  const n = Math.floor(attempts);
  const p = Math.max(0, Math.min(1, chance));
  if (n <= 0 || p <= 0) return 0;
  if (p >= 1) return n;

  const logAdd = (a: number, b: number) => {
    const max = Math.max(a, b);
    return max + Math.log(Math.exp(a - max) + Math.exp(b - max));
  };
  const target = Math.log(0.01);
  const logQ = Math.log1p(-p);
  const logPQ = Math.log(p) - logQ;
  let logProbability = n * logQ;
  let logCumulative = logProbability;
  if (logCumulative >= target) return 0;

  for (let k = 1; k <= n; k++) {
    logProbability += Math.log(n - k + 1) - Math.log(k) + logPQ;
    logCumulative = logAdd(logCumulative, logProbability);
    if (logCumulative >= target) return k;
  }
  return n;
}

function getSkillMergeCount(skillSummons: number): number {
  return skillSummons <= 126 ? 0 : Math.ceil((skillSummons - 126) / 8);
}

function scoreDay(
  day: number,
  resource: { skill_tickets?: number; egg_shells?: number; pet_eggs?: number; mount_resources?: number; mounts?: number } | null,
  nodes: Record<string, number>,
  personalTech: PersonalTechInput | null,
): DayScoreBreakdown {
  const scores = emptyBreakdown();
  const dayBuff = nodeBuff(nodes, `war_day_${day}`);
  const skillTickets = resource?.skill_tickets || 0;
  const eggShells = resource?.egg_shells || 0;
  const ownedPets = resource?.pet_eggs || 0;
  const mountClockwinders = resource?.mounts || 0;
  const ownedMounts = resource?.mount_resources || 0;

  if (day === 1 || day === 3) {
    const skillCost = discountedCost(200, personalTech?.skill_cost_reduction);
    const skillSummons = Math.floor(skillTickets / skillCost) * 5;
    const skillMergeCount = getSkillMergeCount(skillSummons);
    scores.skill_summon = applyBuff(skillSummons * SKILL_SUMMON_UNIT, dayBuff + nodeBuff(nodes, 'skill_summon'));
    scores.skill_merge = applyBuff(skillMergeCount * SKILL_MERGE_UNIT, dayBuff + nodeBuff(nodes, 'skill_merge'));
  }

  if (day === 3 || day === 5) {
    const eggBase = Math.floor(eggShells / 100);
    const extraEggs = guaranteedExtra99(eggBase, Math.max(0, personalTech?.extra_egg_chance || 0) / 100);
    const petBuff = dayBuff + nodeBuff(nodes, 'pet_merge');
    scores.pet_owned_merge = applyBuff(ownedPets * PET_MERGE_UNIT, petBuff);
    scores.pet_summoned_merge = applyBuff((eggBase + extraEggs) * PET_MERGE_UNIT, petBuff);
  }

  if (day === 2 || day === 4) {
    const mountCost = discountedCost(50, personalTech?.mount_cost_reduction);
    const mountBase = Math.floor(mountClockwinders / mountCost);
    const extraMounts = guaranteedExtra99(mountBase, Math.max(0, personalTech?.extra_mount_chance || 0) / 100);
    const summonedMounts = mountBase + extraMounts;
    scores.mount_owned_merge = applyBuff(ownedMounts * MOUNT_MERGE_UNIT, dayBuff + nodeBuff(nodes, 'mount_merge'));
    scores.mount_summon = applyBuff(summonedMounts * MOUNT_SUMMON_UNIT, dayBuff + nodeBuff(nodes, 'mount_summon'));
    scores.mount_summoned_merge = applyBuff(summonedMounts * MOUNT_MERGE_UNIT, dayBuff + nodeBuff(nodes, 'mount_merge'));
  }

  return scores;
}

export function getTechBuffRate(day: number, category: string | null, state: ClanTechState | null): number {
  if (!state) return 0;
  const dayRate = state.dayTechs[day]?.level * (state.dayTechs[day]?.ratePerLevel || 0);
  const categoryRate = category ? state.categoryTechs[category]?.level * (state.categoryTechs[category]?.ratePerLevel || 0) : 0;
  return (dayRate || 0) + (categoryRate || 0);
}

export function buildClanTechState(nodes: Record<string, number>): ClanTechState {
  return {
    dayTechs: Object.fromEntries([1, 2, 3, 4, 5].map(day => [day, { level: nodes[`war_day_${day}`] || 0, ratePerLevel: RATE_PER_LEVEL }])) as Record<number, ClanTechEntry>,
    categoryTechs: {
      skill_summon: { level: nodes.skill_summon || 0, ratePerLevel: RATE_PER_LEVEL },
      skill_merge: { level: nodes.skill_merge || 0, ratePerLevel: RATE_PER_LEVEL },
      mount_summon: { level: nodes.mount_summon || 0, ratePerLevel: RATE_PER_LEVEL },
      mount_merge: { level: nodes.mount_merge || 0, ratePerLevel: RATE_PER_LEVEL },
      egg_hatch: { level: nodes.egg_hatch || 0, ratePerLevel: RATE_PER_LEVEL },
      pet_merge: { level: nodes.pet_merge || 0, ratePerLevel: RATE_PER_LEVEL },
    },
  };
}

export function calculateAllDayScores(
  resource: { skill_tickets?: number; egg_shells?: number; pet_eggs?: number; mount_resources?: number; mounts?: number } | null,
  clanTechNodes: Record<string, number>,
  personalTech: PersonalTechInput | null = null,
): { dayResults: Record<number, DayScoreResult>; dayBreakdowns: Record<number, DayScoreBreakdown>; totalBase: number } {
  const dayResults: Record<number, DayScoreResult> = {};
  const dayBreakdowns: Record<number, DayScoreBreakdown> = {};
  let totalFinal = 0;

  for (let day = 1; day <= 5; day++) {
    const breakdown = scoreDay(day, resource, clanTechNodes, personalTech);
    const finalScore = SCORE_SOURCE_KEYS.reduce((sum, key) => sum + breakdown[key], 0);
    dayBreakdowns[day] = breakdown;
    dayResults[day] = { baseScore: finalScore, buffRate: 0, finalScore };
    totalFinal += finalScore;
  }

  return { dayResults, dayBreakdowns, totalBase: totalFinal };
}
