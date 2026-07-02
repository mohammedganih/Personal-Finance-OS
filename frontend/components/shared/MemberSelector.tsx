'use client';

import { useState } from 'react';
import { useFamilyMembers } from '@/hooks/useFamilyMembers';
import { cn } from '@/lib/utils';
import { FamilyMember } from '@/types';

// ── Simple selector (single owner) ───────────────────────────────────────────
interface MemberSelectorProps {
  value: string | null | undefined;
  onChange: (memberId: string | null) => void;
  label?: string;
  allowJoint?: boolean;
  compact?: boolean;
}

export function MemberSelector({ value, onChange, label = 'Who?', allowJoint = false, compact = false }: MemberSelectorProps) {
  const { data: members } = useFamilyMembers();
  if (!members?.length) return null;

  return (
    <div className="space-y-1.5">
      {!compact && <p className="text-xs font-medium text-text-secondary">{label}</p>}
      <div className="flex items-center gap-1.5 flex-wrap">
        {members.map((m) => (
          <MemberChip key={m.id} member={m} selected={value === m.id} onClick={() => onChange(value === m.id ? null : m.id)} />
        ))}
        {allowJoint && (
          <button type="button" onClick={() => onChange(null)}
            className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-colors',
              !value ? 'bg-bg-elevated border-border-strong text-text-primary' : 'border-border text-text-muted hover:text-text-primary')}>
            🤝 Joint
          </button>
        )}
      </div>
    </div>
  );
}

// ── Split-aware selector ──────────────────────────────────────────────────────
interface SplitSelectorProps {
  memberId: string | null | undefined;
  splitMemberId: string | null | undefined;
  splitRatio: number | null | undefined;
  onChange: (memberId: string | null, splitMemberId: string | null, splitRatio: number) => void;
  label?: string;
}

export function SplitMemberSelector({ memberId, splitMemberId, splitRatio, onChange, label = 'Who paid / owns this?' }: SplitSelectorProps) {
  const { data: members } = useFamilyMembers();
  const [splitMode, setSplitMode] = useState(!!splitMemberId);

  if (!members?.length) return null;

  const ratio       = splitRatio ?? 50;
  const secondRatio = 100 - ratio;
  const primaryMember   = members.find((m) => m.id === memberId);
  const secondaryMember = members.find((m) => m.id === splitMemberId);

  const enterSplit = () => {
    const other = members.find((m) => m.id !== memberId) ?? members[1];
    const primary = memberId ?? members[0]?.id ?? null;
    onChange(primary, other?.id ?? null, 50);
    setSplitMode(true);
  };

  const exitSplit = () => {
    onChange(memberId ?? null, null, 100);
    setSplitMode(false);
  };

  const swap = () => onChange(splitMemberId ?? null, memberId ?? null, secondRatio);

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-text-secondary">{label}</p>

      {!splitMode ? (
        <div className="flex items-center gap-1.5 flex-wrap">
          {members.map((m) => (
            <MemberChip key={m.id} member={m} selected={memberId === m.id}
              onClick={() => onChange(memberId === m.id ? null : m.id, null, 100)} />
          ))}
          <button type="button" onClick={enterSplit}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-dashed border-border text-xs font-medium text-text-muted hover:text-text-primary hover:border-border-strong transition-colors">
            ✂️ Split
          </button>
        </div>
      ) : (
        <div className="space-y-2.5 p-3 rounded-xl bg-bg-elevated border border-border">
          {/* Members row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {primaryMember && (
                <div className="flex items-center gap-1.5">
                  <span className="text-base">{primaryMember.emoji}</span>
                  <span className="text-xs font-medium text-text-primary">{primaryMember.name}</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: primaryMember.color ?? '#7C3AED' }}>{ratio}%</span>
                </div>
              )}
              <button type="button" onClick={swap} className="text-base text-text-muted hover:text-text-primary transition-colors" title="Swap">⇄</button>
              {secondaryMember && (
                <div className="flex items-center gap-1.5">
                  <span className="text-base">{secondaryMember.emoji}</span>
                  <span className="text-xs font-medium text-text-primary">{secondaryMember.name}</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full text-white" style={{ background: secondaryMember.color ?? '#EC4899' }}>{secondRatio}%</span>
                </div>
              )}
            </div>
          </div>

          {/* Slider */}
          <div className="space-y-1">
            <input type="range" min={0} max={100} step={5} value={ratio}
              onChange={(e) => onChange(memberId ?? null, splitMemberId ?? null, Number(e.target.value))}
              className="w-full h-2 rounded-full cursor-pointer accent-violet-500" />
          </div>

          {/* Quick presets */}
          <div className="flex gap-1.5 flex-wrap items-center">
            {[[50, 50], [60, 40], [70, 30], [100, 0]].map(([a, b]) => (
              <button key={a} type="button"
                onClick={() => onChange(memberId ?? null, splitMemberId ?? null, a)}
                className={cn('text-xs px-2 py-1 rounded-lg border transition-colors',
                  ratio === a ? 'bg-accent-violet/20 text-accent-violet-light border-accent-violet/30' : 'bg-bg-surface border-border text-text-muted hover:text-text-primary')}>
                {a === 100 ? `${primaryMember?.name ?? 'Primary'} only` : `${a}/${b}`}
              </button>
            ))}
            <button type="button" onClick={exitSplit} className="ml-auto text-xs px-2 py-1 rounded-lg border border-danger/30 text-danger hover:bg-danger/10 transition-colors">
              ✕ Remove split
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared chip ───────────────────────────────────────────────────────────────
function MemberChip({ member, selected, onClick }: { member: FamilyMember; selected: boolean; onClick: () => void }) {
  const color = member.color ?? '#7C3AED';
  return (
    <button type="button" onClick={onClick}
      className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all',
        selected ? 'text-white border-transparent shadow-sm' : 'bg-transparent border-border text-text-muted hover:text-text-primary hover:border-border-strong')}
      style={selected ? { background: color, borderColor: color } : {}}>
      <span>{member.emoji ?? '👤'}</span>
      {member.name}
    </button>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────
export function MemberBadge({ member, splitMember, splitRatio }: {
  member: Pick<FamilyMember, 'name' | 'color' | 'emoji'> | null;
  splitMember?: Pick<FamilyMember, 'name' | 'color' | 'emoji'> | null;
  splitRatio?: number | null;
}) {
  if (!member) return null;
  const ratio = splitRatio ?? 50;

  if (splitMember) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium">
        <span className="px-1.5 py-0.5 rounded-full text-white" style={{ background: member.color ?? '#7C3AED' }}>
          {member.emoji} {member.name} {ratio}%
        </span>
        <span className="px-1.5 py-0.5 rounded-full text-white" style={{ background: splitMember.color ?? '#EC4899' }}>
          {splitMember.emoji} {splitMember.name} {100 - ratio}%
        </span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full text-white"
      style={{ background: member.color ?? '#7C3AED' }}>
      {member.emoji ?? '👤'} {member.name}
    </span>
  );
}
