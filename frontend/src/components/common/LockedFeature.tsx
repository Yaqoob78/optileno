import React from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './LockedFeature.css';

interface LockedFeatureProps {
  title: string;
  description?: string;
  className?: string;
}

export const LockedFeature: React.FC<LockedFeatureProps> = ({
  title,
  description = "Upgrade to Ultra to unlock real-time autonomous execution and advanced insights.",
  className = ""
}) => {
  const navigate = useNavigate();

  const handleUnlock = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate('/settings', { state: { tab: 'billing' } });
  };

  return (
    <div className={`locked-feature-card ${className}`}>
      {/* Background Ambient Glow */}
      <div className="locked-ambient-glow" />

      {/* Lock Icon */}
      <div className="locked-icon-wrapper">
        <Lock className="locked-icon" />
      </div>

      {/* Ultra Badge */}
      <div className="locked-badge">
        <Sparkles size={11} />
        <span>Ultra Exclusive</span>
      </div>

      {/* Title & Description */}
      <h3 className="locked-title">{title}</h3>
      <p className="locked-description">{description}</p>

      {/* Action Button */}
      <button
        type="button"
        onClick={handleUnlock}
        className="locked-unlock-btn"
      >
        <Sparkles className="locked-btn-icon" />
        <span>Unlock Ultra</span>
      </button>
    </div>
  );
};
