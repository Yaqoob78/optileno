import React, { useEffect, useMemo, useState } from 'react';
import { User, Mail, Zap, Edit2, Save, X } from 'lucide-react';
import { userService } from '../../services/api/user.service';
import { useUserStore } from '../../stores/useUserStore';

const ProfileSettings: React.FC = () => {
  const { profile, setProfile, isUltra } = useUserStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: profile.name || '',
    email: profile.email || '',
  });

  useEffect(() => {
    if (!isEditing) {
      setFormData({ name: profile.name || '', email: profile.email || '' });
    }
  }, [isEditing, profile.email, profile.name]);

  const planName = isUltra ? 'Ultra' : 'Explorer';
  const joinedDate = profile.stats?.joinedAt
    ? new Date(profile.stats.joinedAt).toLocaleDateString()
    : '--';

  const membershipStatus = useMemo(() => {
    const accountStatus = profile.metadata?.accountStatus;
    const subscriptionStatus = String(
      (profile.subscription as { status?: string })?.status || '',
    ).toLowerCase();

    if (accountStatus === 'suspended') return { label: 'Suspended', tone: 'negative' };
    if (subscriptionStatus === 'active') return { label: 'Active', tone: 'positive' };
    if (subscriptionStatus === 'trialing') return { label: 'Trial', tone: 'positive' };
    if (subscriptionStatus === 'past_due') return { label: 'Past due', tone: 'negative' };
    if (subscriptionStatus === 'cancelled' || subscriptionStatus === 'canceled') {
      return { label: 'Cancelled', tone: 'negative' };
    }

    return { label: planName, tone: 'neutral' };
  }, [planName, profile.metadata?.accountStatus, profile.subscription]);

  const handleSave = async () => {
    const name = formData.name.trim();
    const email = formData.email.trim();

    if (!name || !email) {
      setSaveError('Enter a name and email address before saving.');
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const response = await userService.updateProfile({ name, email });
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Unable to save profile changes.');
      }

      setProfile(response.data as any);
      setIsEditing(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Unable to save profile changes.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({ name: profile.name || '', email: profile.email || '' });
    setSaveError(null);
    setIsEditing(false);
  };

  return (
    <div className="profile-settings">
      <div className="profile-header">
        <div className="profile-identity">
          <div className="profile-avatar">
            <User size={30} />
          </div>
          <div className="profile-meta">
            <h3>Profile Information</h3>
            <p>Manage your personal details and subscription level</p>
          </div>
        </div>
        <button
          type="button"
          onClick={isEditing ? handleCancel : () => setIsEditing(true)}
          className="profile-edit-btn"
          disabled={isSaving}
        >
          {isEditing ? (
            <>
              <X size={16} />
              <span>Cancel</span>
            </>
          ) : (
            <>
              <Edit2 size={16} />
              <span>Edit Profile</span>
            </>
          )}
        </button>
      </div>

      <div className="profile-body">
        {isEditing ? (
          <div className="profile-edit-card">
            <div className="profile-form">
              <div className="profile-form-group">
                <label htmlFor="profile-name">Full Name</label>
                <input
                  id="profile-name"
                  type="text"
                  placeholder="Full Name"
                  value={formData.name}
                  onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                  disabled={isSaving}
                />
              </div>
              <div className="profile-form-group">
                <label htmlFor="profile-email">Email Address</label>
                <input
                  id="profile-email"
                  type="email"
                  placeholder="Email"
                  value={formData.email}
                  onChange={(event) => setFormData({ ...formData, email: event.target.value })}
                  disabled={isSaving}
                />
              </div>
              <button
                type="button"
                onClick={() => void handleSave()}
                className="btn-primary profile-save-btn"
                disabled={isSaving}
              >
                <Save size={18} />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
              {saveError && <p className="profile-save-error" role="alert">{saveError}</p>}
            </div>
          </div>
        ) : (
          <>
            <div className="profile-info-grid">
              <div className="profile-card">
                <p className="profile-label">Full Name</p>
                <p className="profile-value">{profile.name || '--'}</p>
              </div>

              <div className="profile-card">
                <p className="profile-label">Email Address</p>
                <div className="profile-value-row">
                  <Mail size={16} />
                  <span>{profile.email || 'Not set'}</span>
                </div>
              </div>
            </div>

            <div className="profile-membership-card">
              <div className="membership-left">
                <div className="membership-icon">
                  <Zap size={22} />
                </div>
                <div>
                  <p className="membership-label">Current Membership</p>
                  <p className="membership-title">Optileno {planName}</p>
                </div>
              </div>
              <div className="membership-right">
                <div className={`membership-badge membership-badge-${membershipStatus.tone}`}>
                  {membershipStatus.label}
                </div>
                <p className="membership-date">Joined {joinedDate}</p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ProfileSettings;
