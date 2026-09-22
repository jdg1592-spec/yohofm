export interface SummonLevelRow {
  SummonsRequired: number;
  Common: number;
  Rare: number;
  Epic: number;
  Legendary: number;
  Ultimate: number;
  Mythic: number;
}

export type ClanRole = 'leader' | 'acting-leader' | 'commander' | 'captain' | 'military-officer' | 'civil-affairs' | 'staff' | 'member';

export interface Profile {
  id: string;
  nickname: string;
  role: ClanRole;
  red_warning: boolean;
  red_warning_locked_at: string | null;
  approved: boolean;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TechTree {
  id: string;
  user_id: string;
  skill_cost_reduction: number;
  mount_cost_reduction: number;
  extra_mount_chance: number;
  extra_egg_chance: number;
  created_at: string;
  updated_at: string;
}

export interface WeeklyResource {
  id: string;
  user_id: string;
  week_start: string;
  skill_tickets: number;
  egg_shells: number;
  pet_eggs: number;
  mount_resources: number;
  mounts: number;
  clan_elixirs: number;
  morning_push_days: number[];
  day_score_overrides: Record<string, number>;
  submitted_at: string;
  created_at: string;
  updated_at: string;
}

export interface ClanSettings {
  id: number;
  clan_name: string;
  clan_tech_nodes: Record<string, number>;
  morning_push_config: Record<string, string[]>;
  updated_at: string;
  updated_by: string | null;
}

export interface RoleRequest {
  id: string;
  requester_id: string;
  target_id: string;
  request_type: 'role_change' | 'kick';
  requested_role: ClanRole | null;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface ClanNote {
  id: string;
  author_id: string;
  content: string;
  created_at: string;
}

export const ROLE_HIERARCHY: Record<ClanRole, number> = {
  leader: 1,
  'acting-leader': 2,
  commander: 3,
  captain: 4,
  'military-officer': 5,
  'civil-affairs': 5,
  staff: 6,
  member: 7,
};

export const ROLE_LABELS: Record<ClanRole, string> = {
  leader: '리더',
  'acting-leader': '리더 대행',
  commander: '지휘관',
  captain: '대장',
  'military-officer': '군장 담당',
  'civil-affairs': '민원 담당',
  staff: '간부',
  member: '클랜원',
};

export const ROLE_SORT_ORDER: ClanRole[] = [
  'leader', 'acting-leader', 'commander', 'captain', 'military-officer', 'civil-affairs', 'staff', 'member',
];

export function roleSortIndex(role: ClanRole): number {
  return ROLE_SORT_ORDER.indexOf(role);
}

export function canManageClan(role: ClanRole): boolean {
  return ROLE_HIERARCHY[role] <= 6;
}

export function canKickMembers(role: ClanRole): boolean {
  return role === 'leader' || role === 'acting-leader' || role === 'commander';
}

export function canChangeRoles(role: ClanRole): boolean {
  return role === 'leader' || role === 'acting-leader' || role === 'commander' || role === 'captain';
}

export function canApproveMembers(role: ClanRole): boolean {
  return role === 'leader' || role === 'acting-leader';
}

export function canEditNickname(role: ClanRole): boolean {
  return role === 'leader' || role === 'acting-leader';
}

export function canEditResources(role: ClanRole): boolean {
  return role === 'leader' || role === 'acting-leader' || role === 'military-officer';
}

export function canEditClanTech(role: ClanRole): boolean {
  return role === 'leader' || role === 'acting-leader';
}

export function canExportExcel(role: ClanRole): boolean {
  return role === 'leader' || role === 'acting-leader' || role === 'military-officer';
}

export function canWriteNotes(role: ClanRole): boolean {
  return role !== 'member';
}

export function canChangeRoleTo(myRole: ClanRole, targetCurrentRole: ClanRole, newRole: ClanRole): boolean {
  if (myRole === 'leader' || myRole === 'acting-leader') return true;
  if (canChangeRoles(myRole)) {
    return ROLE_HIERARCHY[targetCurrentRole] > ROLE_HIERARCHY[myRole]
      && ROLE_HIERARCHY[newRole] > ROLE_HIERARCHY[myRole];
  }
  return false;
}

export const RESOURCE_KEYS = [
  'skill_tickets', 'egg_shells', 'pet_eggs', 'mounts', 'mount_resources', 'clan_elixirs',
] as const;

export type ResourceKey = typeof RESOURCE_KEYS[number];

export const RESOURCE_LABELS: Record<ResourceKey, string> = {
  skill_tickets: '스킬 티켓',
  egg_shells: '알 껍질',
  pet_eggs: '펫(알&합성)',
  mount_resources: '탈것(합성)',
  mounts: '탈것(태엽)',
  clan_elixirs: '초록 물약',
};

export const RESOURCE_WEIGHTS: Record<ResourceKey, number> = {
  skill_tickets: 10,
  egg_shells: 5,
  pet_eggs: 15,
  mount_resources: 8,
  mounts: 25,
  clan_elixirs: 12,
};

// ── Clan score nodes (클랜 점수) ──
// Each node: max level 10, +4% per level (max +40%).
export interface ClanScoreNodeDef {
  id: string;
  label: string;
  maxLevel: number;
  color: string;
  glowColor: string;
  resourceKey?: ResourceKey;
}

export const CLAN_SCORE_NODES: ClanScoreNodeDef[] = [
  { id: 'war_day_1', label: '클랜 전쟁 1일 차', maxLevel: 10, color: '#EF4444', glowColor: 'rgba(239,68,68,0.25)' },
  { id: 'war_day_2', label: '클랜 전쟁 2일 차', maxLevel: 10, color: '#F97316', glowColor: 'rgba(249,115,22,0.25)' },
  { id: 'war_day_3', label: '클랜 전쟁 3일 차', maxLevel: 10, color: '#F59E0B', glowColor: 'rgba(245,158,11,0.25)' },
  { id: 'war_day_4', label: '클랜 전쟁 4일 차', maxLevel: 10, color: '#22C55E', glowColor: 'rgba(34,197,94,0.25)' },
  { id: 'war_day_5', label: '클랜 전쟁 5일 차', maxLevel: 10, color: '#3B82F6', glowColor: 'rgba(59,130,246,0.25)' },
  { id: 'skill_summon', label: '스킬 소환', maxLevel: 10, color: '#8B5CF6', glowColor: 'rgba(139,92,246,0.25)', resourceKey: 'skill_tickets' },
  { id: 'skill_merge', label: '스킬 합성', maxLevel: 10, color: '#A855F7', glowColor: 'rgba(168,85,247,0.25)' },
  { id: 'egg_hatch', label: '알 부화', maxLevel: 10, color: '#EC4899', glowColor: 'rgba(236,72,153,0.25)', resourceKey: 'pet_eggs' },
  { id: 'pet_merge', label: '펫 합성', maxLevel: 10, color: '#14B8A6', glowColor: 'rgba(20,184,166,0.25)', resourceKey: 'egg_shells' },
  { id: 'mount_summon', label: '탈것 소환', maxLevel: 10, color: '#06B6D4', glowColor: 'rgba(6,182,212,0.25)', resourceKey: 'mounts' },
  { id: 'mount_merge', label: '탈것 합성', maxLevel: 10, color: '#0EA5E9', glowColor: 'rgba(14,165,233,0.25)', resourceKey: 'mount_resources' },
  { id: 'tech_tree', label: '기술 트리', maxLevel: 10, color: '#EAB308', glowColor: 'rgba(234,179,8,0.25)' },
];

export function getClanTechBonus(nodeId: string, clanTechNodes: Record<string, number>): number {
  const level = clanTechNodes[nodeId] || 0;
  return level * 0.04;
}

export function hasPermission(userRole: ClanRole, requiredLevel: number): boolean {
  return ROLE_HIERARCHY[userRole] <= requiredLevel;
}

export function isWithinWeeklyWindow(): boolean {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const day = kst.getUTCDay();
  const hour = kst.getUTCHours();

  if (day === 1 && hour >= 9) return true;
  if (day === 2 && hour < 9) return true;
  return false;
}

export function getCurrentWeekStart(): string {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const day = kst.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(kst);
  monday.setUTCDate(kst.getUTCDate() + diff);
  return monday.toISOString().split('T')[0];
}

export function getNextSubmissionWindow(): { startLabel: string; endLabel: string } {
  const now = new Date();
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const day = kst.getUTCDay();
  const hour = kst.getUTCHours();

  let daysUntilMonday: number;
  if (day === 1 && hour < 9) {
    daysUntilMonday = 0;
  } else if (day === 1 && hour >= 9) {
    daysUntilMonday = 0;
  } else if (day === 2 && hour < 9) {
    daysUntilMonday = -1;
  } else {
    daysUntilMonday = ((8 - day) % 7) || 7;
  }

  const monday = new Date(kst);
  monday.setUTCDate(kst.getUTCDate() + daysUntilMonday);
  const tuesday = new Date(monday);
  tuesday.setUTCDate(monday.getUTCDate() + 1);

  const m = monday.getUTCMonth() + 1;
  const md = monday.getUTCDate();
  const tm = tuesday.getUTCMonth() + 1;
  const td = tuesday.getUTCDate();

  return {
    startLabel: `${m}/${md}(\uc6d4) 09:00 AM`,
    endLabel: `${tm}/${td}(\ud654) 08:59 AM`,
  };
}

export function formatKstTimestamp(isoString: string): string {
  const d = new Date(isoString);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const month = kst.getUTCMonth() + 1;
  const day = kst.getUTCDate();
  const hh = String(kst.getUTCHours()).padStart(2, '0');
  const mm = String(kst.getUTCMinutes()).padStart(2, '0');
  return `${month}\uc6d4 ${day}\uc77c ${hh}:${mm}`;
}


