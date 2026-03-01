import React, { useEffect, useState } from 'react';
import {
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';

import {
  AccessGrant,
  AccessGrantUpsertRequest,
  userService,
} from '../../services/api/user.service';

const DEFAULT_FORM: AccessGrantUpsertRequest = {
  email: '',
  tier: 'explorer',
  days: 7,
  reason: '',
};

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return 'Never';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const getGrantStatusLabel = (grant: AccessGrant) => {
  if (!grant.active) {
    return 'Revoked';
  }
  if (!grant.isCurrentlyActive) {
    return 'Expired';
  }
  return 'Active';
};

export default function AdminAccessSettings() {
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [form, setForm] = useState<AccessGrantUpsertRequest>(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [revokingEmail, setRevokingEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadGrants = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await userService.listAccessGrants();
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to load access grants.');
      }

      setGrants(response.data.grants || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load access grants.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadGrants();
  }, []);

  const handleGrantAccess = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: AccessGrantUpsertRequest = {
        email: form.email.trim(),
        tier: form.tier,
        reason: form.reason?.trim() || undefined,
      };

      if (form.days) {
        payload.days = Number(form.days);
      }

      const response = await userService.grantAccess(payload);
      if (!response.success || !response.data) {
        throw new Error(response.error?.message || 'Failed to grant access.');
      }

      setSuccess(`Access granted for ${response.data.email}.`);
      setForm(DEFAULT_FORM);
      await loadGrants();
    } catch (err: any) {
      setError(err?.message || 'Failed to grant access.');
    } finally {
      setSaving(false);
    }
  };

  const handleRevoke = async (email: string) => {
    if (!window.confirm(`Revoke access for ${email}?`)) {
      return;
    }

    setRevokingEmail(email);
    setError(null);
    setSuccess(null);

    try {
      const response = await userService.revokeAccessGrant(email);
      if (!response.success) {
        throw new Error(response.error?.message || 'Failed to revoke access.');
      }

      setSuccess(`Access revoked for ${email}.`);
      await loadGrants();
    } catch (err: any) {
      setError(err?.message || 'Failed to revoke access.');
    } finally {
      setRevokingEmail(null);
    }
  };

  return (
    <div className="admin-access-settings">
      <div className="admin-access-panel admin-access-hero">
        <div className="admin-access-hero-icon">
          <ShieldCheck size={20} />
        </div>
        <div>
          <h3>Access Grants</h3>
          <p>
            Manage invite-only Explorer and Ultra access from the app. These grants are
            stored in the production database after the migration is applied.
          </p>
        </div>
      </div>

      {(error || success) && (
        <div className={`admin-access-message ${error ? 'is-error' : 'is-success'}`}>
          {error ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
          <span>{error || success}</span>
        </div>
      )}

      <div className="admin-access-grid">
        <form className="admin-access-panel admin-access-form" onSubmit={handleGrantAccess}>
          <div className="admin-access-panel-header">
            <div>
              <h3>Grant Access</h3>
              <p>Create or renew a time-boxed invite for any email.</p>
            </div>
            <div className="admin-access-panel-icon">
              <KeyRound size={18} />
            </div>
          </div>

          <div className="admin-access-form-group">
            <label htmlFor="grant-email">Email</label>
            <input
              id="grant-email"
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="user@example.com"
              required
            />
          </div>

          <div className="admin-access-form-row">
            <div className="admin-access-form-group">
              <label htmlFor="grant-tier">Tier</label>
              <select
                id="grant-tier"
                value={form.tier}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    tier: event.target.value as AccessGrantUpsertRequest['tier'],
                  }))
                }
              >
                <option value="explorer">Explorer</option>
                <option value="ultra">Ultra</option>
              </select>
            </div>

            <div className="admin-access-form-group">
              <label htmlFor="grant-days">Days</label>
              <input
                id="grant-days"
                type="number"
                min={1}
                max={3650}
                value={form.days ?? ''}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    days: event.target.value ? Number(event.target.value) : undefined,
                  }))
                }
                placeholder="7"
              />
            </div>
          </div>

          <div className="admin-access-form-group">
            <label htmlFor="grant-reason">Reason</label>
            <input
              id="grant-reason"
              type="text"
              value={form.reason ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, reason: event.target.value }))}
              placeholder="Manual invite, support recovery, VIP access"
            />
          </div>

          <button className="billing-primary-btn" type="submit" disabled={saving}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
            <span>{saving ? 'Granting...' : 'Grant Access'}</span>
          </button>
        </form>

        <div className="admin-access-panel admin-access-list">
          <div className="admin-access-panel-header">
            <div>
              <h3>Current Grants</h3>
              <p>Review active, expired, and revoked invite records.</p>
            </div>
            <button
              type="button"
              className="admin-access-refresh"
              onClick={() => void loadGrants()}
              disabled={loading}
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>

          {loading ? (
            <div className="admin-access-empty">
              <Loader2 size={18} className="animate-spin" />
              <span>Loading access grants...</span>
            </div>
          ) : grants.length === 0 ? (
            <div className="admin-access-empty">
              <ShieldCheck size={18} />
              <span>No access grants found.</span>
            </div>
          ) : (
            <div className="admin-access-items">
              {grants.map((grant) => (
                <div key={`${grant.email}-${grant.updatedAt || grant.grantedAt || grant.storage}`} className="admin-access-item">
                  <div className="admin-access-item-main">
                    <div className="admin-access-item-top">
                      <div>
                        <h4>{grant.email}</h4>
                        <p>
                          Granted {formatDateTime(grant.grantedAt)} • Updated {formatDateTime(grant.updatedAt)}
                        </p>
                      </div>
                      <div className="admin-access-badges">
                        <span className={`admin-access-pill tier-${grant.tier}`}>{grant.tier}</span>
                        <span className={`admin-access-pill status-${getGrantStatusLabel(grant).toLowerCase()}`}>
                          {getGrantStatusLabel(grant)}
                        </span>
                      </div>
                    </div>

                    <div className="admin-access-meta">
                      <span>Expires: {formatDateTime(grant.expiresAt)}</span>
                      <span>Store: {grant.storage === 'database' ? 'Database' : 'Legacy file'}</span>
                      {grant.reason ? <span>Reason: {grant.reason}</span> : null}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="admin-access-danger"
                    onClick={() => void handleRevoke(grant.email)}
                    disabled={revokingEmail === grant.email || !grant.active}
                  >
                    {revokingEmail === grant.email ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Trash2 size={14} />
                    )}
                    <span>{grant.active ? 'Revoke' : 'Revoked'}</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
