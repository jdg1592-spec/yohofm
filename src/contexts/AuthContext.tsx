import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';
import type { Session } from '@supabase/supabase-js';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  isRecovery: boolean;
  signUp: (email: string, password: string, nickname: string) => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updatePassword: (newPassword: string) => Promise<string | null>;
  clearRecovery: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

function friendlyAuthError(error: { message: string; code?: string }): string {
  const msg = error.message.toLowerCase();
  if (msg.includes('rate limit') || msg.includes('too many') || msg.includes('for security purposes')) {
    return '요청이 너무 많습니다. 잠시 후(약 30초) 다시 시도해 주세요.';
  }
  if (msg.includes('email not confirmed') || msg.includes('not confirmed')) {
    return '계정이 아직 활성화되지 않았습니다. 잠시 후 다시 로그인해 보세요.';
  }
  if (msg.includes('invalid login') || msg.includes('invalid credentials')) {
    return '이메일 또는 비밀번호가 올바르지 않습니다.';
  }
  if (msg.includes('user already registered') || msg.includes('already been registered')) {
    return '이미 가입된 이메일입니다. 로그인을 이용해 주세요.';
  }
  if (msg.includes('password')) {
    return '비밀번호는 최소 6자 이상 입력해 주세요.';
  }
  if (msg.includes('network') || msg.includes('fetch')) {
    return '네트워크 연결에 문제가 있습니다. 인터넷 연결을 확인해 주세요.';
  }
  return error.message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecovery, setIsRecovery] = useState(false);
  const mountedRef = useRef(true);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (error) {
        console.error('Profile fetch error:', error.message);
        setProfile(null);
        return;
      }
      if (mountedRef.current) {
        setProfile(data);
      }
    } catch (err) {
      console.error('Profile fetch exception:', err);
      if (mountedRef.current) setProfile(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.user?.id) {
      await fetchProfile(session.user.id);
    }
  }, [session, fetchProfile]);

  useEffect(() => {
    mountedRef.current = true;

    const timeoutId = setTimeout(() => {
      if (mountedRef.current) {
        setLoading(false);
      }
    }, 10000);

    supabase.auth.getSession()
      .then(({ data, error }) => {
        if (error) {
          console.error('getSession error:', error.message);
        }
        const s = data?.session ?? null;
        if (!mountedRef.current) return;
        setSession(s);
        if (s?.user?.id) {
          fetchProfile(s.user.id).finally(() => {
            if (mountedRef.current) {
              setLoading(false);
              clearTimeout(timeoutId);
            }
          });
        } else {
          setLoading(false);
          clearTimeout(timeoutId);
        }
      })
      .catch((err) => {
        console.error('getSession exception:', err);
        if (mountedRef.current) {
          setSession(null);
          setProfile(null);
          setLoading(false);
          clearTimeout(timeoutId);
        }
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      if (!mountedRef.current) return;
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
      }
      if (event === 'SIGNED_OUT') {
        setProfile(null);
        setIsRecovery(false);
        return;
      }
      if (s?.user?.id) {
        fetchProfile(s.user.id).catch((err) => {
          console.error('onAuthStateChange fetchProfile error:', err);
        });
      } else {
        setProfile(null);
      }
    });

    return () => {
      mountedRef.current = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signUp = async (email: string, password: string, nickname: string): Promise<string | null> => {
    try {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return friendlyAuthError(error);
      if (!data.user) return '회원가입에 실패했습니다.';

      const { error: profileError } = await supabase
        .from('profiles')
        .insert({ id: data.user.id, nickname });
      if (profileError) {
        if (profileError.code === '23505') return '이미 사용 중인 닉네임입니다.';
        console.error('Profile insert error:', profileError.message);
        return '프로필 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.';
      }

      await fetchProfile(data.user.id);
      return null;
    } catch (err) {
      console.error('signUp exception:', err);
      return '회원가입 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
    }
  };

  const signIn = async (email: string, password: string): Promise<string | null> => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return friendlyAuthError(error);
      return null;
    } catch (err) {
      console.error('signIn exception:', err);
      return '로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('signOut error:', err);
    }
    setProfile(null);
    setSession(null);
    setIsRecovery(false);
  };

  const updatePassword = async (newPassword: string): Promise<string | null> => {
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) return friendlyAuthError(error);
      setIsRecovery(false);
      return null;
    } catch (err) {
      console.error('updatePassword exception:', err);
      return '비밀번호 변경 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.';
    }
  };

  const clearRecovery = () => setIsRecovery(false);

  return (
    <AuthContext.Provider value={{
      session, profile, loading, isRecovery,
      signUp, signIn, signOut, refreshProfile, updatePassword, clearRecovery,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
