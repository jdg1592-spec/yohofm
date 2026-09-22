import type { ClanRole } from '@/lib/types';

interface Props {
  nickname: string;
  role: ClanRole;
  className?: string;
}

export default function NicknameText({ nickname, role, className = '' }: Props) {
  return (
    <span className={`nick-${role} ${className}`}>
      {nickname}
    </span>
  );
}
