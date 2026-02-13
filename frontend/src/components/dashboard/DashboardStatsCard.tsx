// frontend/src/components/dashboard/DashboardStatsCard.tsx
import React from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  icon: React.ReactNode;
  gradient: string;
  onClick?: () => void;
}

export default function DashboardStatsCard({
  title,
  value,
  unit,
  change,
  trend,
  icon,
  gradient,
  onClick
}: StatCardProps) {
  return (
    <div
      onClick={onClick}
      className={`p-6 rounded-xl border border-white/10 bg-gradient-to-br ${gradient} backdrop-blur-sm transition-all duration-200 hover:border-white/20 hover:shadow-lg cursor-pointer group ${
        onClick ? 'hover:scale-105' : ''
      }`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="p-3 rounded-lg bg-white/10 group-hover:bg-white/20 transition-colors">
          {icon}
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-1 text-xs font-semibold ${
            trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-gray-400'
          }`}>
            {trend === 'up' && <ArrowUp size={14} />}
            {trend === 'down' && <ArrowDown size={14} />}
            {Math.abs(change)}%
          </div>
        )}
      </div>

      <div className="mb-2">
        <p className="text-sm text-gray-300 font-medium">{title}</p>
      </div>

      <div className="flex items-baseline gap-2">
        <p className="text-3xl font-bold text-white">{value}</p>
        {unit && <p className="text-gray-400 text-sm">{unit}</p>}
      </div>

      <div className="mt-4 w-full h-1 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            trend === 'up' 
              ? 'bg-gradient-to-r from-green-500 to-emerald-500' 
              : trend === 'down'
              ? 'bg-gradient-to-r from-red-500 to-orange-500'
              : 'bg-gradient-to-r from-blue-500 to-cyan-500'
          }`}
          style={{ width: `${Math.min(100, Math.abs(change || 50))}%` }}
        ></div>
      </div>
    </div>
  );
}
