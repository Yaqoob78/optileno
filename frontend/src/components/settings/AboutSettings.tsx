import React from 'react';
import { Info, Shield, FileText, HelpCircle } from 'lucide-react';

const AboutSettings: React.FC = () => {
  return (
    <div className="space-y-4">
      <div className="setting-section">
        <div className="flex items-center justify-between mb-6">
          <p className="text-slate-500 text-xs">Product info & legal links</p>
          <div className="version-badge">v{import.meta.env.VITE_APP_VERSION || '1.0.0'}</div>
        </div>

        <div className="flex flex-col gap-2">
          <a href="/privacy" target="_blank" rel="noopener noreferrer" className="about-card">
            <Shield size={14} className="text-indigo-400" />
            <span className="flex-1">Privacy Policy</span>
            <HelpCircle size={14} className="opacity-30" />
          </a>

          <a href="/terms" target="_blank" rel="noopener noreferrer" className="about-card">
            <FileText size={14} className="text-emerald-400" />
            <span className="flex-1">Terms of Service</span>
            <HelpCircle size={14} className="opacity-30" />
          </a>

          <a href="mailto:optilenoai@gmail.com" className="about-card">
            <Info size={14} className="text-amber-400" />
            <span className="flex-1">Contact Support</span>
            <HelpCircle size={14} className="opacity-30" />
          </a>
        </div>

        <div className="mt-8 text-slate-600 text-[10px] uppercase tracking-wider">
          © 2026 Optileno. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default AboutSettings;