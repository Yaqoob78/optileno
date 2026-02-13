// utils/formatters.ts

/**
 * Date and Time Formatters
 */
export const formatDate = {
  /**
   * Format date as "MMM DD, YYYY" (e.g., "Jan 15, 2024")
   */
  short: (date: Date | string): string => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  },

  /**
   * Format date as "Monday, January 15, 2024"
   */
  long: (date: Date | string): string => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  },

  /**
   * Format date as "2024-01-15" (ISO-like)
   */
  iso: (date: Date | string): string => {
    const d = new Date(date);
    return d.toISOString().split('T')[0];
  },

  /**
   * Format date as "Jan 15" (without year)
   */
  monthDay: (date: Date | string): string => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  },

  /**
   * Format time as "2:30 PM"
   */
  time: (date: Date | string): string => {
    const d = new Date(date);
    return d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  },

  /**
   * Format datetime as "Jan 15, 2:30 PM"
   */
  dateTime: (date: Date | string): string => {
    const d = new Date(date);
    return `${formatDate.monthDay(d)}, ${formatDate.time(d)}`;
  },

  /**
   * Format relative time (e.g., "2 hours ago", "yesterday")
   */
  relative: (date: Date | string): string => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffDay === 0) {
      if (diffHour === 0) {
        if (diffMin === 0) return 'just now';
        if (diffMin === 1) return '1 minute ago';
        return `${diffMin} minutes ago`;
      }
      if (diffHour === 1) return '1 hour ago';
      return `${diffHour} hours ago`;
    }

    if (diffDay === 1) return 'yesterday';
    if (diffDay < 7) return `${diffDay} days ago`;
    if (diffDay < 30) return `${Math.floor(diffDay / 7)} weeks ago`;
    if (diffDay < 365) return `${Math.floor(diffDay / 30)} months ago`;
    return `${Math.floor(diffDay / 365)} years ago`;
  },

  /**
   * Format duration between two dates
   */
  duration: (start: Date | string, end: Date | string): string => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    const diffMs = endDate.getTime() - startDate.getTime();
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours === 0) return `${minutes}m`;
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  },
};

/**
 * Number Formatters
 */
export const formatNumber = {
  /**
   * Format number with commas (e.g., 1,000)
   */
  withCommas: (num: number): string => {
    return num.toLocaleString('en-US');
  },

  /**
   * Format number as compact (e.g., 1K, 1M)
   */
  compact: (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  },

  /**
   * Format number as percentage
   */
  percent: (num: number, decimals: number = 1): string => {
    return `${(num * 100).toFixed(decimals)}%`;
  },

  /**
   * Format number as currency
   */
  currency: (num: number, currency: string = 'USD'): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(num);
  },
};

/**
 * Score and Rating Formatters
 */
export const formatScore = {
  /**
   * Format score out of 100 (e.g., "85/100")
   */
  outOf100: (score: number): string => {
    return `${Math.round(score)}/100`;
  },

  /**
   * Format score as letter grade
   */
  letterGrade: (score: number): string => {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  },

  /**
   * Format score with emoji indicator
   */
  withEmoji: (score: number): string => {
    if (score >= 90) return '🎯 Excellent';
    if (score >= 80) return '👍 Good';
    if (score >= 70) return '🤔 Fair';
    if (score >= 60) return '⚠️ Needs Improvement';
    return '🚨 Poor';
  },

  /**
   * Format score as progress bar text
   */
  progress: (score: number, total: number = 100): string => {
    const percentage = Math.round((score / total) * 100);
    return `${percentage}%`;
  },
};

/**
 * Duration Formatters
 */
export const formatDuration = {
  /**
   * Format minutes as "2h 30m"
   */
  fromMinutes: (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours === 0) return `${mins}m`;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  },

  /**
   * Format milliseconds as "2:30:45"
   */
  fromMilliseconds: (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  },

  /**
   * Format seconds as "2h 30m 45s"
   */
  fromSeconds: (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    const parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
    
    return parts.join(' ');
  },

  /**
   * Format duration for display (smart formatting)
   */
  smart: (durationMs: number): string => {
    const seconds = Math.floor(durationMs / 1000);
    
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return formatDuration.fromMinutes(Math.floor(seconds / 60));
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  },
};

/**
 * Text Formatters
 */
export const formatText = {
  /**
   * Truncate text with ellipsis
   */
  truncate: (text: string, maxLength: number): string => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength - 3) + '...';
  },

  /**
   * Capitalize first letter
   */
  capitalize: (text: string): string => {
    return text.charAt(0).toUpperCase() + text.slice(1);
  },

  /**
   * Format snake_case to Title Case
   */
  snakeToTitle: (text: string): string => {
    return text
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  },

  /**
   * Format camelCase to Title Case
   */
  camelToTitle: (text: string): string => {
    return text
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  },
};

/**
 * File Size Formatters
 */
export const formatFileSize = {
  /**
   * Format bytes as human readable (e.g., "1.5 MB")
   */
  bytes: (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  },
};

/**
 * AI Response Formatters
 */
export const formatAI = {
  /**
   * Format AI model name for display
   */
  modelName: (modelId: string): string => {
    const modelMap: Record<string, string> = {
      'gpt-4': 'GPT-4',
      'gpt-4-turbo': 'GPT-4 Turbo',
      'gpt-3.5-turbo': 'GPT-3.5 Turbo',
      'claude-3': 'Claude 3',
      'claude-2': 'Claude 2',
      'gemini-pro': 'Gemini Pro',
    };
    
    return modelMap[modelId] || modelId;
  },

  /**
   * Format AI mode for display
   */
  modeName: (mode: string): string => {
    const modeMap: Record<string, string> = {
      'coach': 'Productivity Coach',
      'strategist': 'Strategic Advisor',
      'analyst': 'Data Analyst',
      'therapist': 'Wellness Assistant',
      'creative': 'Creative Partner',
      'mentor': 'Learning Mentor',
      'general': 'General Assistant',
    };
    
    return modeMap[mode] || formatText.capitalize(mode);
  },

  /**
   * Format AI temperature for display
   */
  temperature: (temp: number): string => {
    if (temp <= 0.3) return 'Precise';
    if (temp <= 0.7) return 'Balanced';
    return 'Creative';
  },
};

/**
 * Color Formatters (for scores/ratings)
 */
export const formatColor = {
  /**
   * Get color for score (0-100)
   */
  score: (score: number): string => {
    if (score >= 90) return '#10B981'; // Green
    if (score >= 80) return '#3B82F6'; // Blue
    if (score >= 70) return '#F59E0B'; // Amber
    if (score >= 60) return '#EF4444'; // Red
    return '#6B7280'; // Gray
  },

  /**
   * Get color for priority
   */
  priority: (priority: string): string => {
    const priorityColors: Record<string, string> = {
      'urgent': '#DC2626', // Red
      'high': '#F59E0B',   // Amber
      'medium': '#3B82F6', // Blue
      'low': '#10B981',    // Green
    };
    
    return priorityColors[priority] || '#6B7280';
  },

  /**
   * Get color for status
   */
  status: (status: string): string => {
    const statusColors: Record<string, string> = {
      'completed': '#10B981',    // Green
      'in-progress': '#3B82F6',  // Blue
      'pending': '#F59E0B',      // Amber
      'blocked': '#EF4444',      // Red
      'active': '#10B981',       // Green
      'paused': '#6B7280',       // Gray
      'archived': '#6B7280',     // Gray
    };
    
    return statusColors[status] || '#6B7280';
  },
};

/**
 * URL Formatters
 */
export const formatURL = {
  /**
   * Extract domain from URL
   */
  domain: (url: string): string => {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return url;
    }
  },

  /**
   * Make URL safe for display
   */
  safe: (url: string): string => {
    return url.replace(/https?:\/\//, '').replace(/\/$/, '');
  },
};

/**
 * Validation Formatters
 */
export const formatValidation = {
  /**
   * Format validation error for display
   */
  error: (errors: string | string[]): string => {
    if (Array.isArray(errors)) {
      return errors.join(', ');
    }
    return errors;
  },
};