import React, { useMemo } from 'react';
import { Sparkles, Lock, Check } from 'lucide-react';
import { Modal } from '../common/Modal';
import {
  AchievementStatus,
  sortForDisplay,
  nextToUnlock,
} from './achievements';

interface AchievementsModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  achievements: AchievementStatus[];
  /** Ids earned since the user last opened this modal — get a "NEW" shine. */
  unseenIds: Set<string>;
}

const TIER_LABEL: Record<AchievementStatus['tier'], string> = {
  bronze: 'Bronze',
  silver: 'Silver',
  gold: 'Gold',
};

export default function AchievementsModal({
  isOpen,
  onOpenChange,
  achievements,
  unseenIds,
}: AchievementsModalProps) {
  const sorted = useMemo(() => sortForDisplay(achievements), [achievements]);
  const earnedCount = achievements.filter((a) => a.earned).length;
  const totalCount = achievements.length;
  const overallPercent = totalCount === 0 ? 0 : Math.round((earnedCount / totalCount) * 100);
  const nextUp = useMemo(() => nextToUnlock(achievements), [achievements]);

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      title="Achievements"
      description="Every badge is earned from your real activity — no participation trophies."
      maxWidth="2xl"
    >
      <div className="ach-summary" role="status">
        <div className="ach-summary-text">
          <span className="ach-summary-count">{earnedCount} of {totalCount} unlocked</span>
          <span className="ach-summary-percent">{overallPercent}%</span>
        </div>
        <div className="ach-summary-track" aria-hidden="true">
          <div className="ach-summary-fill" style={{ width: `${overallPercent}%` }} />
        </div>
      </div>

      {nextUp && (
        <div className="ach-next-up">
          <Sparkles size={14} aria-hidden="true" />
          <span>
            Next up: <strong>{nextUp.title}</strong> — {nextUp.current}/{nextUp.target} {nextUp.unit}
          </span>
        </div>
      )}

      <div className="ach-grid">
        {sorted.map((a) => {
          const Icon = a.icon;
          const isNew = a.earned && unseenIds.has(a.id);
          return (
            <div
              key={a.id}
              className={[
                'ach-card',
                a.earned ? `ach-earned ach-tier-${a.tier}` : 'ach-locked',
                isNew ? 'ach-new' : '',
              ].filter(Boolean).join(' ')}
            >
              {isNew && <span className="ach-new-chip">NEW</span>}
              <div className="ach-icon-ring" aria-hidden="true">
                <Icon size={20} />
              </div>
              <div className="ach-card-body">
                <div className="ach-card-title">{a.title}</div>
                <div className="ach-card-desc">{a.description}</div>
                {a.earned ? (
                  <div className="ach-card-status">
                    <Check size={12} aria-hidden="true" />
                    <span>Unlocked · {TIER_LABEL[a.tier]}</span>
                  </div>
                ) : (
                  <div className="ach-card-progress">
                    <div
                      className="ach-progress-track"
                      role="progressbar"
                      aria-valuenow={a.current}
                      aria-valuemin={0}
                      aria-valuemax={a.target}
                      aria-label={`${a.title} progress`}
                    >
                      <div className="ach-progress-fill" style={{ width: `${a.percent}%` }} />
                    </div>
                    <span className="ach-progress-label">
                      <Lock size={10} aria-hidden="true" />
                      {a.current}/{a.target} {a.unit}
                    </span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
