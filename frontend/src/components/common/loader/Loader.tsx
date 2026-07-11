import React from 'react';
import { Logo } from '../Logo';

interface FullScreenLoaderProps {
    text?: string;
    size?: number;
}

export function FullScreenLoader({ text, size = 80 }: FullScreenLoaderProps) {
    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgb(var(--color-bg-primary))',
            color: 'rgb(var(--color-text-primary))',
            backdropFilter: 'blur(10px)',
            zIndex: 9999
        }}>
            <Logo size={size} animated={true} glow={true} />
            {text && (
                <span style={{
                    marginTop: '1.5rem',
                    fontSize: '1.1rem',
                    fontWeight: 500,
                    color: 'rgb(var(--color-text-secondary))',
                    letterSpacing: '0.05em'
                }}>
                    {text}
                </span>
            )}
        </div>
    );
}

export function InlineLoader({ size = 40 }: { size?: number }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
            <Logo size={size} animated={true} />
        </div>
    );
}
