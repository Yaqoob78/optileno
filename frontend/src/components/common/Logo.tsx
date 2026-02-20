import React from 'react';
import './logo.css';

interface LogoProps {
    size?: number | string;
    glow?: boolean;
    animated?: boolean;
    className?: string;
}

export function Logo({ size = 34, glow = true, animated = false, className = '' }: LogoProps) {
    return (
        <div
            className={`logo-container ${glow ? 'logo-glow' : ''} ${animated ? 'is-animated' : ''} ${className}`}
            style={{ width: size, height: size, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
            <svg width="100%" height="100%" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    <linearGradient id="optilenoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#60a5fa" />
                        <stop offset="50%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#d97706" />
                    </linearGradient>

                    <linearGradient id="optilenoGradientGlow" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#60a5fa" />
                        <stop offset="55%" stopColor="#0ea5e9" />
                        <stop offset="100%" stopColor="#fbbf24" />
                    </linearGradient>

                    <filter id="optilenoDropGlow" x="-60%" y="-60%" width="220%" height="220%">
                        <feGaussianBlur stdDeviation="8" />
                        <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.5 0" />
                    </filter>
                </defs>

                <g className="logo-group">
                    {glow && (
                        <circle
                            cx="256" cy="256" r="132"
                            stroke="url(#optilenoGradientGlow)"
                            strokeWidth="18"
                            opacity="0.45"
                            fill="none"
                            filter="url(#optilenoDropGlow)"
                            className="logo-base-glow"
                        />
                    )}

                    <circle
                        cx="256" cy="256" r="132"
                        stroke="url(#optilenoGradient)"
                        strokeWidth="12"
                        fill="none"
                        className="logo-ring"
                    />

                    <g stroke="url(#optilenoGradient)" strokeLinecap="round" strokeWidth="8" className="logo-connections">
                        <line x1="256" y1="170" x2="190" y2="236" className="logo-line line-1" />
                        <line x1="256" y1="170" x2="322" y2="236" className="logo-line line-2" />
                        <line x1="190" y1="236" x2="172" y2="310" className="logo-line line-3" />
                        <line x1="322" y1="236" x2="340" y2="310" className="logo-line line-4" />
                        <line x1="172" y1="310" x2="256" y2="350" className="logo-line line-5" />
                        <line x1="340" y1="310" x2="256" y2="350" className="logo-line line-6" />
                    </g>

                    <g className="logo-nodes">
                        <circle cx="256" cy="170" r="15" fill="url(#optilenoGradient)" className="logo-node node-1" />
                        <circle cx="190" cy="236" r="13" fill="url(#optilenoGradient)" className="logo-node node-2" />
                        <circle cx="322" cy="236" r="13" fill="url(#optilenoGradient)" className="logo-node node-3" />
                        <circle cx="172" cy="310" r="11" fill="url(#optilenoGradient)" className="logo-node node-4" />
                        <circle cx="340" cy="310" r="11" fill="url(#optilenoGradient)" className="logo-node node-5" />
                        <circle cx="256" cy="350" r="15" fill="url(#optilenoGradient)" className="logo-node node-6" />
                    </g>
                </g>
            </svg>
        </div>
    );
}
