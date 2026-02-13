import React from 'react';
import { Lock, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface LockedFeatureProps {
    title: string;
    description?: string;
    className?: string;
}

export const LockedFeature: React.FC<LockedFeatureProps> = ({
    title,
    description = "Upgrade to Ultra to unlock this feature.",
    className = ""
}) => {
    const navigate = useNavigate();

    return (
        <div className={`relative overflow-hidden rounded-xl border border-white/10 bg-gray-900/40 p-6 backdrop-blur-md group ${className}`}>

            {/* Animated Premium Gradient Background */}
            <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 via-purple-500/5 to-pink-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

            <div className="absolute inset-0 flex flex-col items-center justify-center z-10 p-4 text-center">
                <div className="relative mb-4">
                    <div className="absolute inset-0 bg-blue-500/20 blur-xl rounded-full" />
                    <div className="relative rounded-full bg-white/5 p-4 backdrop-blur-md border border-white/10 shadow-xl group-hover:scale-110 transition-transform duration-300">
                        <Lock className="w-6 h-6 text-blue-400" />
                    </div>
                </div>

                <h3 className="text-lg font-bold text-white mb-2 tracking-tight">
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-200 to-purple-200">
                        {title}
                    </span>
                    <span className="ml-2 text-white/50 text-sm font-normal uppercase tracking-wider">Locked</span>
                </h3>

                <p className="text-gray-400 text-sm max-w-[240px] mb-6 leading-relaxed">
                    {description}
                </p>

                <button
                    onClick={() => navigate('/settings/billing')}
                    className="group/btn relative flex items-center gap-2 bg-gradient-to-r from-blue-600/90 to-purple-600/90 px-5 py-2 rounded-full text-sm font-semibold text-white shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 transition-all hover:scale-105 active:scale-95"
                >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Unlock Ultra</span>
                    <div className="absolute inset-0 rounded-full bg-white/20 opacity-0 group-hover/btn:opacity-100 transition-opacity" />
                </button>
            </div>

            {/* Subtle Grid Pattern Overlay */}
            <div
                className="absolute inset-0 opacity-[0.03]"
                style={{
                    backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
                    backgroundSize: '24px 24px'
                }}
            />
        </div>
    );
};
