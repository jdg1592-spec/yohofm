import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { canWriteNotes, type ClanNote, type Profile } from '@/lib/types';
import { MessageSquare, Plus, Trash2, Pencil, Save, X, Lock } from 'lucide-react';
import NicknameText from '@/components/NicknameText';

function getKstDate(iso: string): string {
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const day = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getKstTime(iso: string): string {
  const d = new Date(iso);
  const kst = new Date(d.getTime() + 9 * 60 * 60 * 1000);
  const hh = String(kst.getUTCHours()).padStart(2, '0');
  const mm = String(kst.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export default function NotesPage() {
  const { profile } = useAuth();
  const [notes, setNotes] = useState<ClanNote[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newContent, setNewContent] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const canWrite = profile ? canWriteNotes(profile.role) : false;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [nRes, pRes] = await Promise.all([
      supabase.from('clan_notes').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, nickname, role'),
    ]);
    const profileMap: Record<string, Profile> = {};
    for (const p of (pRes.data || []) as Profile[]) {
      profileMap[p.id] = p;
    }
    setProfiles(profileMap);
    setNotes((nRes.data || []) as ClanNote[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const groupedByDate = useMemo(() => {
    const groups: Record<string, ClanNote[]> = {};
    for (const note of notes) {
      const date = getKstDate(note.created_at);
      if (!groups[date]) groups[date] = [];
      groups[date].push(note);
    }
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [notes]);

  const handleAdd = async () => {
    const content = newContent.trim();
    if (!content || !profile || !canWrite) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('clan_notes')
      .insert({ content })
      .select()
      .maybeSingle();
    if (!error && data) {
      setNotes(prev => [data as ClanNote, ...prev]);
      setNewContent('');
    }
    setSaving(false);
  };

  const startEdit = (note: ClanNote) => {
    setEditingId(note.id);
    setEditContent(note.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent('');
  };

  const handleSaveEdit = async (noteId: string) => {
    const content = editContent.trim();
    if (!content || !profile || !canWrite) { cancelEdit(); return; }
    setSaving(true);
    const { data, error } = await supabase
      .from('clan_notes')
      .update({ content })
      .eq('id', noteId)
      .select()
      .maybeSingle();
    if (!error && data) {
      setNotes(prev => prev.map(n => n.id === noteId ? data as ClanNote : n));
    }
    cancelEdit();
    setSaving(false);
  };

  const handleDelete = async (noteId: string) => {
    if (!profile || !canWrite) return;
    setSaving(true);
    const { error } = await supabase.from('clan_notes').delete().eq('id', noteId);
    if (!error) {
      setNotes(prev => prev.filter(n => n.id !== noteId));
    }
    setSaving(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent, action: 'add' | 'save') => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      if (action === 'add') handleAdd();
      else if (editingId) handleSaveEdit(editingId);
    }
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
      <div>
        <h1 className="text-2xl font-bold text-gold-300 flex items-center gap-3">
          <MessageSquare className="w-6 h-6 text-gold-400" />
          민원 센터
        </h1>
        <p className="text-sm text-gray-500 mt-1">간부급이 작성하는 클랜 메모</p>
      </div>

      {!canWrite && (
        <div className="card border-amber-500/30 bg-amber-500/5 flex items-center gap-3">
          <Lock className="w-5 h-5 text-amber-400 shrink-0" />
          <p className="text-sm text-amber-400/80">
            조회만 가능합니다. 메모 작성은 간부급 이상만 가능합니다.
          </p>
        </div>
      )}

      {canWrite && (
        <div className="card">
          <div className="flex flex-col gap-3">
            <textarea
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              onKeyDown={e => handleKeyDown(e, 'add')}
              placeholder="예: 닉네임 / 망치 40,000개 사용"
              rows={3}
              className="input-field resize-none"
              disabled={saving}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-600">Ctrl+Enter로 빠르게 추가할 수 있습니다</p>
              <button
                onClick={handleAdd}
                disabled={!newContent.trim() || saving}
                className="btn-gold flex items-center gap-2 text-sm"
              >
                {saving ? (
                  <div className="w-4 h-4 border-2 border-[#0B0C10]/30 border-t-[#0B0C10] rounded-full animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                추가하기
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {groupedByDate.length === 0 && (
          <div className="text-center py-12 text-gray-600 text-sm">
            작성된 메모가 없습니다
          </div>
        )}

        {groupedByDate.map(([date, dateNotes]) => (
          <div key={date}>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-1 h-px bg-[#2A2A30]" />
              <span className="text-xs font-mono font-semibold text-gold-500/80 px-2">
                {date}
              </span>
              <div className="flex-1 h-px bg-[#2A2A30]" />
            </div>

            <div className="space-y-2">
              {dateNotes.map(note => {
                const author = profiles[note.author_id];
                const isEditing = editingId === note.id;
                const isAuthor = profile?.id === note.author_id;

                return (
                  <div key={note.id} className="card p-3 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-bold text-gold-400"
                      style={{ backgroundColor: '#1A1A1F', border: '1px solid #2A2A30' }}>
                      {(author?.nickname || '?').charAt(0).toUpperCase()}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium">
                          {author ? <NicknameText nickname={author.nickname} role={author.role} /> : '알 수 없음'}
                        </span>
                        <span className="text-[10px] text-gray-600 font-mono">
                          {getKstTime(note.created_at)}
                        </span>
                      </div>

                      {isEditing ? (
                        <div className="flex flex-col gap-2">
                          <textarea
                            value={editContent}
                            onChange={e => setEditContent(e.target.value)}
                            onKeyDown={e => handleKeyDown(e, 'save')}
                            rows={2}
                            className="input-field resize-none text-sm"
                            autoFocus
                          />
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleSaveEdit(note.id)}
                              disabled={saving}
                              className="btn-gold flex items-center gap-1 text-xs px-3 py-1.5"
                            >
                              <Save className="w-3 h-3" />
                              저장
                            </button>
                            <button
                              onClick={cancelEdit}
                              className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 px-2 py-1.5"
                            >
                              <X className="w-3 h-3" />
                              취소
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-300 break-words whitespace-pre-wrap">
                          {note.content}
                        </p>
                      )}
                    </div>

                    {canWrite && isAuthor && !isEditing && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => startEdit(note)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:text-gold-400 hover:bg-[#252530] transition-all"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(note.id)}
                          disabled={saving}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
