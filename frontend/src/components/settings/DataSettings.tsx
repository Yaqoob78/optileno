import React, { useState } from 'react';
import { Database, Download, AlertOctagon, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react';
import '../../styles/pages/settings.css';

const DataSettings: React.FC = () => {
  const [showConfirm, setShowConfirm] = useState(false);

  const handleExport = () => {
    console.log('Exporting data...');
    // Export logic here
  };

  const handleClear = () => {
    console.log('Clearing data...');
    setShowConfirm(false);
    // Clear logic here
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
              Your productivity data is processed with end-to-end encryption.
              Intelligence patterns stay local and private. External sharing is strictly disabled.
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
          <span>Zero-Knowledge Protection Active</span>
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
              <button className="data-modal-danger" onClick={handleClear}>
                Delete Now
              </button>
              <button className="data-modal-cancel" onClick={() => setShowConfirm(false)}>
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
