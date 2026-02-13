// mobile/hooks/useAppTheme.ts
/**
 * useAppTheme Hook
 * Provides consistent theme colors across the app
 */

export const useAppTheme = () => {
  const colors = {
    primary: '#6366f1',
    secondary: '#8b5cf6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    
    // Grayscale
    background: '#0f172a',
    card: '#1e293b',
    text: '#f1f5f9',
    textSecondary: '#cbd5e1',
    border: '#334155',
    
    // Utilities
    notification: '#ef4444',
    overlay: 'rgba(0, 0, 0, 0.5)',
  };

  return {
    colors,
    spacing: {
      xs: 4,
      sm: 8,
      md: 16,
      lg: 24,
      xl: 32,
    },
    borderRadius: {
      sm: 4,
      md: 8,
      lg: 16,
    },
    fonts: {
      size: {
        xs: 12,
        sm: 14,
        md: 16,
        lg: 18,
        xl: 20,
        '2xl': 24,
      },
      weight: {
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
      },
    },
  };
};
