import React from 'react';
import { Sparkles } from 'lucide-react';
import '../../styles/components/dashboard/ReassuranceBlock.css';

export default function ReassuranceBlock() {
  return (
    <div className="reassurance-block">
      <div className="reassurance-content">
        <div className="reassurance-icon">
          <Sparkles size={24} />
        </div>
        <div>
          <h3 className="reassurance-title">Your app is learning with you</h3>
          <p className="reassurance-text">
            Leno is constantly evolving to become more personalized and intuitive. 
            The more you plan, the better it understands your unique workflow and preferences. 
            No action needed — just keep being your productive self.
          </p>
        </div>
      </div>
    </div>
  );
}