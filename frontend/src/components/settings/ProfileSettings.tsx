import React, { useState, useEffect } from 'react';
import { User, Mail, Zap, Edit2, Save, X } from 'lucide-react';
import { useUserStore } from '../../stores/useUserStore';

const ProfileSettings: React.FC = () => {
  const { profile, updateProfile } = useUserStore();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: profile.name || '',
    email: profile.email || '',
  });

  const planName = profile.planType === 'ULTRA' ? 'Ultra' : 'Explorer';
  const joinedDate = profile?.stats?.joinedAt
    ? new Date(profile.stats.joinedAt).toLocaleDateString()
    : '—';

  const handleSave = () => {
    updateProfile({
      name: formData.name,
      email: formData.email,
    });
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
          onClick={() => setIsEditing(!isEditing)}
          className="profile-edit-btn"
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
                <label>Full Name</label>
                <input
                  type="text"
                  placeholder="Full Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="profile-form-group">
                <label>Email Address</label>
                <input
                  type="email"
                  placeholder="Email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <button
                onClick={handleSave}
                className="btn-primary profile-save-btn"
              >
                <Save size={18} />
                Save Changes
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="profile-info-grid">
              <div className="profile-card">
                <p className="profile-label">Full Name</p>
                <p className="profile-value">{profile.name || '—'}</p>
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
                <div className="membership-badge">Active</div>
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
