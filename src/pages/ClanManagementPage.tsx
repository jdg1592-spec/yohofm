import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import {
  ROLE_LABELS, ROLE_HIERARCHY, ROLE_SORT_ORDER, roleSortIndex,
  canKickMembers, canChangeRoles, canApproveMembers, canEditNickname,
  canChangeRoleTo, type Profile, type ClanRole, type RoleRequest,
} from '@/lib/types';
import {
  Users, Shield, AlertTriangle, CheckCircle2, XCircle,
  UserMinus, Clock, ChevronDown, UserCheck, UserX, Pencil, Check,
} from 'lucide-react';
import NicknameText from '@/components/NicknameText';

export default function ClanManagementPage() {
  const { profile, refreshProfile } = useAuth();
  const [members, setMembers] = useState<Profile[]>([]);
  const [requests, setRequests] = useState<RoleRequest[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMember, setActionMember] = useState<Profile | null>(null);
  const [selectedRole, setSelectedRole] = useState<ClanRole>('member');
  const [kickTarget, setKickTarget] = useState<Profile | null>(null);
  const [kickReason, setKickReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [editingNicknameId, setEditingNicknameId] = useState<string | null>(null);
  const [nicknameValue, setNicknameValue] = useState('');

  const fetchData = async () => {
    const [mRes, rRes] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('role_requests').select('*').eq('status', 'pending').order('created_at'),
    ]);
    const allMembers = mRes.data || [];
    allMembers.sort((a, b) => roleSortIndex(a.role) - roleSortIndex(b.role));
    setMembers(allMembers);
    setPendingApprovals(allMembers.filter(m => !m.approved));
    setRequests(rRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const showFeedback = (type: 'success' | 'error', msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => setFeedback(null), 3000);
  };

  const handleApprove = async (target: Profile) => {
    setSaving(true);
    const { error } = await supabase.rpc('approve_member', { p_target: target.id });
    if (error) {
      showFeedback('error', '승인 중 오류가 발생했습니다.');
    } else {
      showFeedback('success', `${target.nickname}의 가입이 승인되었습니다.`);
      fetchData();
    }
    setSaving(false);
  };

  const handleReject = async (target: Profile) => {
    setSaving(true);
    const { error } = await supabase.rpc('reject_member', { p_target: target.id });
    if (error) {
      showFeedback('error', '거절 중 오류가 발생했습니다.');
    } else {
      showFeedback('success', `${target.nickname}의 가입이 거절되었습니다.`);
      fetchData();
    }
    setSaving(false);
  };

  const handleSetRole = async (target: Profile, role: ClanRole) => {
    if (!profile) return;
    setSaving(true);
    const { error } = await supabase.rpc('set_member_role', { p_target: target.id, p_role: role });
    if (error) {
      showFeedback('error', '권한이 없거나 오류가 발생했습니다.');
    } else {
      showFeedback('success', `${target.nickname}의 직책이 ${ROLE_LABELS[role]}(으)로 변경되었습니다.`);
      fetchData();
      if (target.id === profile.id) refreshProfile();
    }
    setSaving(false);
    setActionMember(null);
  };

  const handleClearWarning = async (target: Profile) => {
    setSaving(true);
    const { error } = await supabase.rpc('clear_red_warning', { p_target: target.id });
    if (error) {
      showFeedback('error', '리더만 빨간불을 해제할 수 있습니다.');
    } else {
      showFeedback('success', `${target.nickname}의 빨간불이 해제되었습니다.`);
      fetchData();
    }
    setSaving(false);
  };

  const handleSetWarning = async (target: Profile) => {
    setSaving(true);
    const { error } = await supabase.rpc('set_red_warning', { p_target: target.id });
    if (error) showFeedback('error', '권한이 없습니다.');
    else {
      showFeedback('success', `${target.nickname}에게 빨간불이 부여되었습니다.`);
      fetchData();
    }
    setSaving(false);
  };

  const handleKick = async () => {
    if (!kickTarget) return;
    setSaving(true);
    const { error } = await supabase.rpc('kick_member', { p_target: kickTarget.id });
    if (error) showFeedback('error', '추방 권한이 없거나 오류가 발생했습니다.');
    else {
      showFeedback('success', `${kickTarget.nickname}이(가) 추방되었습니다.`);
      fetchData();
    }
    setSaving(false);
    setKickTarget(null);
    setKickReason('');
  };

  const handleSaveNickname = async (target: Profile) => {
    if (!profile) return;
    const trimmed = nicknameValue.trim();
    if (!trimmed) {
      showFeedback('error', '닉네임은 비어 있을 수 없습니다.');
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc('update_nickname', { p_target: target.id, p_nickname: trimmed });
    if (error) {
      showFeedback('error', error.message || '닉네임 수정 중 오류가 발생했습니다.');
    } else {
      showFeedback('success', `${target.nickname}의 닉네임이 ${trimmed}(으)로 변경되었습니다.`);
      fetchData();
      if (target.id === profile.id) refreshProfile();
    }
    setSaving(false);
    setEditingNicknameId(null);
    setNicknameValue('');
  };

  const startEditNickname = (member: Profile) => {
    setEditingNicknameId(member.id);
    setNicknameValue(member.nickname);
  };

  const handleReviewRequest = async (reqId: string, approved: boolean) => {
    const { error } = await supabase.rpc('review_role_request', { p_request_id: reqId, p_approved: approved });
    if (error) showFeedback('error', '요청 처리 중 오류가 발생했습니다.');
    else {
      showFeedback('success', approved ? '승인되었습니다.' : '거절되었습니다.');
      setRequests(prev => prev.filter(r => r.id !== reqId));
    }
  };

  if (!profile) return null;

  const canApprove = canApproveMembers(profile.role);
  const canKick = canKickMembers(profile.role);
  const canChange = canChangeRoles(profile.role);
  const canNick = canEditNickname(profile.role);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-gold-500/30 border-t-gold-400 rounded-full animate-spin" />
      </div>
    );
  }

  const getMemberName = (id: string) => members.find(m => m.id === id)?.nickname || '알 수 없음';

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-gold-300 flex items-center gap-3">
          <Users className="w-6 h-6 text-gold-400" />
          클랜 관리
        </h1>
        <p className="text-sm text-gray-500 mt-1">총 {members.length}명 (승인 대기 {pendingApprovals.length}명)</p>
      </div>

      {feedback && (
        <div className={`card flex items-center gap-3 animate-slide-up ${
          feedback.type === 'success' ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'
        }`}>
          {feedback.type === 'success'
            ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            : <XCircle className="w-5 h-5 text-red-400 shrink-0" />}
          <span className={`text-sm ${feedback.type === 'success' ? 'text-emerald-400' : 'text-red-400'}`}>{feedback.msg}</span>
        </div>
      )}

      {/* Pending join approvals — leader/acting-leader only */}
      {canApprove && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gold-300 flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-gold-400" />
            가입 신청 / 대기 중인 요청
            {pendingApprovals.length > 0 && (
              <span className="badge bg-amber-500/20 text-amber-400 border border-amber-500/30">{pendingApprovals.length}</span>
            )}
          </h3>
          {pendingApprovals.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">처리할 가입 신청이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {pendingApprovals.map(m => (
                <div key={m.id} className="flex items-center justify-between rounded-lg px-4 py-3" style={{ backgroundColor: '#121212', border: '1px solid #2A2A30' }}>
                  <div className="min-w-0 flex items-center gap-3">
                    <div className="w-7 h-7 rounded-md flex items-center justify-center text-gold-400 text-xs font-bold" style={{ backgroundColor: '#1A1A1F', border: '1px solid #2A2A30' }}>
                      {m.nickname.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium"><NicknameText nickname={m.nickname} role={m.role} /></p>
                      <p className="text-xs text-gray-500">신청일: {new Date(m.created_at).toLocaleDateString('ko-KR')}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0 ml-3">
                    <button
                      onClick={() => handleApprove(m)}
                      disabled={saving}
                      className="text-xs text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      수락
                    </button>
                    <button
                      onClick={() => handleReject(m)}
                      disabled={saving}
                      className="text-xs text-red-400 border border-red-500/30 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1"
                    >
                      <UserX className="w-3.5 h-3.5" />
                      거절
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pending role/kick requests */}
      {canApprove && requests.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-gold-300 flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-gold-400" />
            직책 변경 / 추방 요청
            <span className="badge bg-amber-500/20 text-amber-400 border border-amber-500/30">{requests.length}</span>
          </h3>
          <div className="space-y-2">
            {requests.map(req => (
              <div key={req.id} className="flex items-center justify-between rounded-lg px-4 py-3" style={{ backgroundColor: '#121212', border: '1px solid #2A2A30' }}>
                <div className="min-w-0">
                  <p className="text-sm text-gray-200">
                    <span className="font-medium text-gold-400">{getMemberName(req.requester_id)}</span>
                    {req.request_type === 'role_change' ? (
                      <> &rarr; {getMemberName(req.target_id)} 직책 변경: <span className="text-gold-300">{req.requested_role ? ROLE_LABELS[req.requested_role] : '-'}</span></>
                    ) : (
                      <> &rarr; {getMemberName(req.target_id)} 추방 요청</>
                    )}
                  </p>
                  {req.reason && <p className="text-xs text-gray-500 mt-0.5">사유: {req.reason}</p>}
                </div>
                <div className="flex gap-2 shrink-0 ml-3">
                  <button onClick={() => handleReviewRequest(req.id, true)} className="text-xs text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/10 px-3 py-1.5 rounded-lg transition-all">승인</button>
                  <button onClick={() => handleReviewRequest(req.id, false)} className="text-xs text-red-400 border border-red-500/30 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-all">거절</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Red warning section */}
      {members.some(m => m.red_warning) && (
        <div className="card border-red-500/20">
          <h3 className="text-sm font-semibold text-red-400 flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4" />
            빨간불 관리
          </h3>
          <div className="space-y-2">
            {members.filter(m => m.red_warning).map(m => (
              <div key={m.id} className="flex items-center justify-between bg-red-500/5 border border-red-500/20 rounded-lg px-4 py-2">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-sm"><NicknameText nickname={m.nickname} role={m.role} /></span>
                  <span className={`badge-${m.role}`}>{ROLE_LABELS[m.role]}</span>
                </div>
                {canApprove && (
                  <button onClick={() => handleClearWarning(m)} disabled={saving} className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors">
                    해제하기
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Member list table */}
      <div className="card overflow-x-auto p-0">
        <div className="px-4 py-3 border-b border-[#2A2A30] flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gold-300">클랜원 목록 & 권한 제어</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2A2A30]">
              <th className="table-header text-left px-4 py-3">닉네임</th>
              <th className="table-header text-left px-3 py-3">직책</th>
              <th className="table-header text-left px-3 py-3">가입일</th>
              <th className="table-header text-left px-3 py-3">최근 접속</th>
              <th className="table-header text-right px-4 py-3">처리</th>
            </tr>
          </thead>
          <tbody>
            {members.map(member => {
              const isMe = member.id === profile.id;
              const isPending = !member.approved;
              const canChangeMyRole = canChangeRoleTo(profile.role, member.role, member.role);
              const canShowRoleDropdown = !isMe && canChange && canChangeRoleTo(profile.role, member.role, member.role);
              const canShowKick = !isMe && canKick && ROLE_HIERARCHY[member.role] > ROLE_HIERARCHY[profile.role];
              return (
                <tr key={member.id} className={`border-b border-[#2A2A30]/50 hover:bg-[#252530] transition-colors ${isPending ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-md flex items-center justify-center text-gold-400 text-xs font-bold" style={{ backgroundColor: '#121212', border: '1px solid #2A2A30' }}>
                        {member.nickname.charAt(0).toUpperCase()}
                      </div>
                      {editingNicknameId === member.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={nicknameValue}
                            onChange={e => setNicknameValue(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') handleSaveNickname(member);
                              if (e.key === 'Escape') { setEditingNicknameId(null); setNicknameValue(''); }
                            }}
                            autoFocus
                            className="w-24 bg-[#1A1A1F] border border-gold-500/30 rounded px-2 py-0.5 text-sm text-gold-300 focus:outline-none focus:border-gold-400"
                          />
                          <button
                            onClick={() => handleSaveNickname(member)}
                            disabled={saving}
                            className="text-emerald-400 hover:text-emerald-300 transition-colors"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <NicknameText nickname={member.nickname} role={member.role} />
                          {canNick && (
                            <button
                              onClick={() => startEditNickname(member)}
                              className="text-gray-500 hover:text-gold-400 transition-colors"
                              title="닉네임 수정"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                      {isMe && <span className="text-[10px] text-gold-500">(나)</span>}
                      {isPending && <span className="text-[10px] text-amber-400 border border-amber-500/30 rounded px-1 py-0.5">대기</span>}
                      {member.red_warning && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    {canShowRoleDropdown ? (
                      <RoleDropdown
                        currentRole={member.role}
                        myRole={profile.role}
                        disabled={saving}
                        onChange={(role) => handleSetRole(member, role)}
                      />
                    ) : (
                      <span className={`badge-${member.role}`}>{ROLE_LABELS[member.role]}</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500">
                    {new Date(member.created_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-3 py-3 text-xs text-gray-500">
                    {new Date(member.updated_at).toLocaleDateString('ko-KR')}
                  </td>
                  <td className="px-4 py-3">
                    {!isMe && (canShowKick || (canChange && ROLE_HIERARCHY[member.role] > ROLE_HIERARCHY[profile.role])) && (
                      <div className="flex items-center justify-end gap-2">
                        {!member.red_warning && (
                          <button
                            onClick={() => handleSetWarning(member)}
                            disabled={saving}
                            className="text-[11px] text-amber-400 border border-amber-500/30 hover:bg-amber-500/10 px-2.5 py-1 rounded-md transition-all"
                          >
                            빨간불
                          </button>
                        )}
                        {canShowKick && (
                          <button
                            onClick={() => setKickTarget(member)}
                            className="text-[11px] text-red-400 border border-red-500/30 hover:bg-red-500/10 px-2.5 py-1 rounded-md transition-all flex items-center gap-1"
                          >
                            <UserMinus className="w-3 h-3" />
                            내보내기
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Kick modal */}
      {kickTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => { setKickTarget(null); setKickReason(''); }}>
          <div className="card w-full max-w-sm animate-slide-up" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-red-400 mb-2">클랜원 내보내기</h3>
            <p className="text-sm text-gray-400 mb-4">
              <span className="font-medium"><NicknameText nickname={kickTarget.nickname} role={kickTarget.role} /></span>을(를) 추방하시겠습니까?
            </p>
            <div className="mb-4">
              <label className="label-text">추방 사유 (선택)</label>
              <input
                type="text"
                value={kickReason}
                onChange={e => setKickReason(e.target.value)}
                className="input-field"
                placeholder="사유를 입력하세요..."
              />
            </div>
            <p className="text-xs text-red-400/70 mb-4">이 작업은 되돌릴 수 없습니다.</p>
            <div className="flex gap-3">
              <button onClick={() => { setKickTarget(null); setKickReason(''); }} className="btn-outline flex-1">취소</button>
              <button onClick={handleKick} disabled={saving} className="btn-danger flex-1">
                {saving ? '처리 중...' : '내보내기'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RoleDropdown({
  currentRole,
  myRole,
  disabled,
  onChange,
}: {
  currentRole: ClanRole;
  myRole: ClanRole;
  disabled: boolean;
  onChange: (role: ClanRole) => void;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});

  const updatePosition = useCallback(() => {
    if (!btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    const menuW = 144;
    const menuH = 320;
    let top = rect.top - menuH - 4;
    let left = rect.left;
    if (top < 8) top = rect.bottom + 4;
    if (left + menuW > window.innerWidth - 8) left = window.innerWidth - menuW - 8;
    if (left < 8) left = 8;
    setMenuStyle({ position: 'fixed', top, left, width: menuW, zIndex: 9999 });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [open, updatePosition]);

  const canSelect = (role: ClanRole): boolean => {
    return canChangeRoleTo(myRole, currentRole, role);
  };

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all border ${
          open ? 'border-gold-500/40 bg-gold-500/10' : 'border-[#2A2A30] hover:border-gray-500'
        }`}
      >
        <span className={`badge-${currentRole}`}>{ROLE_LABELS[currentRole]}</span>
        <ChevronDown className={`w-3 h-3 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={() => setOpen(false)} />
          <div
            className="rounded-lg overflow-hidden animate-slide-up"
            style={{
              ...menuStyle,
              backgroundColor: '#1A1A1F',
              border: '1px solid #2A2A30',
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            }}
          >
            {ROLE_SORT_ORDER.map(role => {
              const can = canSelect(role);
              return (
                <button
                  key={role}
                  onClick={() => {
                    if (can && role !== currentRole) {
                      onChange(role);
                      setOpen(false);
                    }
                  }}
                  disabled={!can || role === currentRole}
                  className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between ${
                    !can
                      ? 'text-gray-600 cursor-not-allowed'
                      : role === currentRole
                      ? 'text-gold-400 bg-gold-500/5 cursor-default'
                      : 'text-gray-300 hover:bg-[#252530]'
                  }`}
                >
                  {ROLE_LABELS[role]}
                  {!can && <span className="text-[10px] text-gray-600">권한 없음</span>}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
