import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, setRememberMe } from '@/lib/supabase';
import { Shield, UserPlus, LogIn, KeyRound, ArrowLeft, Mail, Check } from 'lucide-react';

type View = 'auth' | 'forgot' | 'resetSent';

export default function AuthPage() {
  const { signIn, signUp, isRecovery, updatePassword, clearRecovery } = useAuth();
  const [view, setView] = useState<View>('auth');
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [rememberMe, setRemember] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (isRecovery) {
    return <ResetPasswordView onUpdate={updatePassword} onCancel={clearRecovery} />;
  }

  if (view === 'forgot') {
    return (
      <ForgotPasswordView
        onBack={() => { setView('auth'); setError(''); }}
        onSent={() => setView('resetSent')}
      />
    );
  }

  if (view === 'resetSent') {
    return (
      <Shell>
        <div className="text-center py-4">
          <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
            <Mail className="w-6 h-6 text-emerald-400" />
          </div>
          <h2 className="text-lg font-bold text-gray-200 mb-2">이메일을 확인해 주세요</h2>
          <p className="text-sm text-gray-400 leading-relaxed mb-6">
            비밀번호 재설정 링크가 발송되었습니다.<br />
            이메일의 링크를 클릭하면 새 비밀번호를 설정할 수 있습니다.
          </p>
          <button onClick={() => setView('auth')} className="btn-outline text-sm">
            로그인으로 돌아가기
          </button>
        </div>
      </Shell>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    if (isSignUp && nickname.trim().length < 1) {
      setError('닉네임을 입력해 주세요.');
      setSubmitting(false);
      return;
    }

    if (password.length < 4) {
      setError('비밀번호는 4자리 이상 입력해 주세요.');
      setSubmitting(false);
      return;
    }

    setRememberMe(rememberMe);

    try {
      const result = isSignUp
        ? await signUp(email, password, nickname.trim())
        : await signIn(email, password);
      if (result) setError(result);
    } catch (err) {
      console.error('Auth submit error:', err);
      setError('요청 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Shell>
      <div className="flex mb-6 bg-[#121212] rounded-lg p-1">
        <button
          type="button"
          onClick={() => { setIsSignUp(false); setError(''); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
            !isSignUp ? 'bg-gold-500/20 text-gold-300' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <LogIn className="w-4 h-4" />
          로그인
        </button>
        <button
          type="button"
          onClick={() => { setIsSignUp(true); setError(''); }}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${
            isSignUp ? 'bg-gold-500/20 text-gold-300' : 'text-gray-500 hover:text-gray-300'
          }`}
        >
          <UserPlus className="w-4 h-4" />
          회원가입
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {isSignUp && (
          <div className="animate-slide-up">
            <label className="label-text">닉네임 (인게임 이름)</label>
            <input
              type="text"
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              className="input-field"
              placeholder="게임 내 닉네임을 입력하세요"
              autoComplete="username"
            />
          </div>
        )}

        <div>
          <label className="label-text">이메일</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="input-field"
            placeholder="example@email.com"
            required
            autoComplete="email"
          />
        </div>

        <div>
          <label className="label-text">비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="input-field"
            placeholder="4자리 이상"
            required
            autoComplete={isSignUp ? 'new-password' : 'current-password'}
          />
          {isSignUp && (
            <p className="text-xs text-gray-500 mt-1">숫자, 문자 조합 없이 6자리 이상이면 충분합니다</p>
          )}
        </div>

        {!isSignUp && (
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2.5 cursor-pointer group">
              <div
                className={`w-[18px] h-[18px] rounded border flex items-center justify-center transition-all ${
                  rememberMe
                    ? 'bg-gold-500/20 border-gold-500/50'
                    : 'border-[#2A2A30] group-hover:border-gray-500'
                }`}
                onClick={() => setRemember(!rememberMe)}
              >
                {rememberMe && <Check className="w-3 h-3 text-gold-400" />}
              </div>
              <span className="text-xs text-gray-400 select-none" onClick={() => setRemember(!rememberMe)}>
                현재 기기에서 로그인 상태 유지
              </span>
            </label>
            <button
              type="button"
              onClick={() => { setView('forgot'); setError(''); }}
              className="text-xs text-gold-500/70 hover:text-gold-400 transition-colors"
            >
              비밀번호 찾기
            </button>
          </div>
        )}

        {error && <ErrorBanner message={error} />}

        <button
          type="submit"
          disabled={submitting}
          className="btn-gold w-full flex items-center justify-center gap-2"
        >
          {submitting ? (
            <div className="w-5 h-5 border-2 border-[#0B0C10]/30 border-t-[#0B0C10] rounded-full animate-spin" />
          ) : isSignUp ? (
            <>
              <UserPlus className="w-4 h-4" />
              가입하기
            </>
          ) : (
            <>
              <LogIn className="w-4 h-4" />
              로그인
            </>
          )}
        </button>
      </form>
    </Shell>
  );
}

function ForgotPasswordView({ onBack, onSent }: { onBack: () => void; onSent: () => void }) {
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !nickname.trim()) {
      setError('이메일과 닉네임을 모두 입력해 주세요.');
      return;
    }

    setSubmitting(true);

    try {
      const { data: match, error: rpcErr } = await supabase
        .rpc('verify_email_nickname', { p_email: email.trim(), p_nickname: nickname.trim() });

      if (rpcErr) {
        setError('확인 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
        return;
      }

      if (!match) {
        setError('입력하신 이메일과 닉네임이 일치하는 계정을 찾을 수 없습니다.');
        return;
      }

      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });

      if (resetErr) {
        if (resetErr.message.toLowerCase().includes('rate limit')) {
          setError('요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.');
        } else {
          setError('비밀번호 재설정 이메일 발송에 실패했습니다.');
        }
        return;
      }

      onSent();
    } catch (err) {
      console.error('Password reset error:', err);
      setError('요청 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Shell>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors mb-5"
      >
        <ArrowLeft className="w-4 h-4" />
        로그인으로 돌아가기
      </button>

      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center">
          <KeyRound className="w-5 h-5 text-gold-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-200">비밀번호 찾기</h2>
          <p className="text-xs text-gray-500">가입 시 등록한 이메일과 닉네임을 입력하세요</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label-text">이메일</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="input-field"
            placeholder="가입 시 사용한 이메일"
            required
            autoComplete="email"
          />
        </div>

        <div>
          <label className="label-text">닉네임 (인게임 이름)</label>
          <input
            type="text"
            value={nickname}
            onChange={e => setNickname(e.target.value)}
            className="input-field"
            placeholder="가입 시 등록한 닉네임"
            required
          />
        </div>

        {error && <ErrorBanner message={error} />}

        <button type="submit" disabled={submitting} className="btn-gold w-full flex items-center justify-center gap-2">
          {submitting ? (
            <div className="w-5 h-5 border-2 border-[#0B0C10]/30 border-t-[#0B0C10] rounded-full animate-spin" />
          ) : (
            <>
              <Mail className="w-4 h-4" />
              인증 메일 발송
            </>
          )}
        </button>
      </form>
    </Shell>
  );
}

function ResetPasswordView({
  onUpdate,
  onCancel,
}: {
  onUpdate: (password: string) => Promise<string | null>;
  onCancel: () => void;
}) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 4) {
      setError('비밀번호는 4자리 이상 입력해 주세요.');
      return;
    }
    if (password !== confirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }

    setSubmitting(true);
    const result = await onUpdate(password);
    if (result) {
      setError(result);
    } else {
      setDone(true);
    }
    setSubmitting(false);
  };

  if (done) {
    return (
      <Shell>
        <div className="text-center py-4">
          <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4">
            <Check className="w-6 h-6 text-emerald-400" />
          </div>
          <h2 className="text-lg font-bold text-gray-200 mb-2">비밀번호 변경 완료</h2>
          <p className="text-sm text-gray-400 mb-6">새로운 비밀번호로 변경되었습니다.</p>
          <button onClick={onCancel} className="btn-gold">계속하기</button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-gold-500/10 border border-gold-500/20 flex items-center justify-center">
          <KeyRound className="w-5 h-5 text-gold-400" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-gray-200">새 비밀번호 설정</h2>
          <p className="text-xs text-gray-500">새로 사용할 비밀번호를 입력하세요</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label-text">새 비밀번호</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="input-field"
            placeholder="4자리 이상"
            required
            autoComplete="new-password"
          />
          <p className="text-xs text-gray-500 mt-1">숫자, 문자 조합 없이 4자리 이상이면 충분합니다</p>
        </div>

        <div>
          <label className="label-text">비밀번호 확인</label>
          <input
            type="password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            className="input-field"
            placeholder="비밀번호를 다시 입력하세요"
            required
            autoComplete="new-password"
          />
        </div>

        {error && <ErrorBanner message={error} />}

        <button type="submit" disabled={submitting} className="btn-gold w-full flex items-center justify-center gap-2">
          {submitting ? (
            <div className="w-5 h-5 border-2 border-[#0B0C10]/30 border-t-[#0B0C10] rounded-full animate-spin" />
          ) : (
            <>
              <KeyRound className="w-4 h-4" />
              비밀번호 변경
            </>
          )}
        </button>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#0B0C10] flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-24 h-16 mb-4">
            <img src="/assets/icons/amb.png" alt="FeverTime[YOHO] 로고" className="w-full h-full object-contain" />
          </div>
          <h1 className="text-3xl font-bold text-gold-300 tracking-tight">
            FeverTime
            <span className="text-gold-500">[YOHO]</span>
          </h1>
        </div>

        <div className="card">{children}</div>

      </div>
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm text-red-400 animate-slide-up">
      <div className="flex items-center gap-2">
        <Shield className="w-4 h-4 shrink-0" />
        {message}
      </div>
    </div>
  );
}
