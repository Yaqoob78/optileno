import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Database, Download, AlertOctagon, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { userService } from '../../services/api/user.service';
import { useUserStore } from '../../stores/useUserStore';
import { usePlannerStore } from '../../stores/planner.store';
import '../../styles/pages/settings.css';

const DataSettings: React.FC = () => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isWiping, setIsWiping] = useState(false);
  const navigate = useNavigate();
  const logoutUser = useUserStore((state) => state.logout);
  const resetPlanner = usePlannerStore((state) => state.resetPlanner);

  const handleExport = () => {
    console.log('Exporting data...');
    // Export logic here
  };

  const clearClientData = () => {
    // Reset in-memory stores.
    resetPlanner();
    logoutUser();

    // Wipe local persisted state/cache keys.
    localStorage.clear();
    sessionStorage.clear();
  };

  const handleClear = async () => {
    if (isWiping) return;
    setIsWiping(true);

    try {
      const response = await userService.deleteAccount('DELETE');
      if (!response.success) {
        window.alert(response.error?.message || 'Failed to wipe account data. Please try again.');
        return;
      }

      // Best-effort server logout to clear cookies on backend side too.
      try {
        await userService.logout();
      } catch (error) {
        // Continue local wipe even if logout request fails.
      }
      clearClientData();
      setShowConfirm(false);
      navigate('/login', { replace: true });
    } catch (error) {
      window.alert('Failed to wipe account data. Please try again.');
    } finally {
      setIsWiping(false);
    }
  };

  return (
    <div className="data-settings">
      <div className="setting-section">
        <div className="data-header">
          <div className="data-title">
            <Database size={18} />
            <h3>System Data Control</h3>
          </div>
          <span className="data-status">Secure</span>
        </div>

        <div className="data-privacy-card">
          <div className="data-privacy-icon">
            <ShieldCheck size={22} />
          </div>
          <div>
            <h4>Privacy Guarantee</h4>
            <p>
              Your data is stored securely and used only to provide core features like planning, analytics, and AI insights.
              We do not sell or share your personal data with third parties for marketing.
            </p>
          </div>
        </div>

        <button
          className="data-danger-card"
          onClick={() => setShowConfirm(true)}
        >
          <div className="data-danger-left">
            <div className="data-danger-icon">
              <AlertOctagon size={22} strokeWidth={2.2} />
            </div>
            <div>
              <div className="data-danger-title">Wipe System Data</div>
              <div className="data-danger-subtitle">Purge all local intelligence and records</div>
            </div>
          </div>
          <span className="data-danger-badge">Danger Area</span>
        </button>
      </div>

      <div className="data-footer">
        <div className="data-protection">
          <span className="data-dot" />
          <span>Data stored securely. Not sold for marketing.</span>
        </div>
      </div>

      {showConfirm && (
        <div className="data-modal">
          <div className="data-modal-card">
            <div className="data-modal-header">
              <div className="data-modal-icon">
                <AlertCircle size={36} />
              </div>
              <h3>Confirm Purge</h3>
              <p>
                This will delete everything.
                <span>No recovery possible.</span>
              </p>
            </div>
            <div className="data-modal-actions">
              <button className="data-modal-danger" onClick={handleClear} disabled={isWiping}>
                {isWiping ? 'Deleting...' : 'Delete Now'}
              </button>
              <button className="data-modal-cancel" onClick={() => setShowConfirm(false)} disabled={isWiping}>
                Cancel Action
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DataSettings;
