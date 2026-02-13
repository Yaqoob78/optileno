// types/settings.types.ts

export interface NotificationPreferences {
    email: {
        enabled: boolean;
        frequency: 'instant' | 'daily' | 'weekly';
        types: {
            reminders: boolean;
            summaries: boolean;
            insights: boolean;
            updates: boolean;
        };
    };
    push: {
        enabled: boolean;
        quietHours: {
            enabled: boolean;
            start: string; // "22:00"
            end: string;   // "08:00"
        };
        types: {
            messages: boolean;
            tasks: boolean;
            goals: boolean;
            system: boolean;
        };
    };
    sound: {
        enabled: boolean;
        volume: number; // 0-100
        types: {
            message: boolean;
            completion: boolean;
            alert: boolean;
        };
    };
}

export interface AIBehaviorSettings {
    mode: 'balanced' | 'creative' | 'concise' | 'detailed';
    personality: 'professional' | 'friendly' | 'enthusiastic' | 'analytical';
    responseStyle: {
        length: 'short' | 'medium' | 'long';
        temperature: number; // 0.1 - 1.0
        maxTokens: number;
    };
    context: {
        useMemory: boolean;
        memorySize: number; // Number of previous messages to remember
        includeMetadata: boolean;
    };
}

export interface FocusSettings {
    enabled: boolean;
    duration: number; // minutes
    breaks: {
        enabled: boolean;
        duration: number; // minutes
        frequency: number; // minutes between breaks
    };
    distractions: {
        blockNotifications: boolean;
        hideSidebar: boolean;
        muteSounds: boolean;
    };
}

export interface PrivacySettings {
    dataCollection: {
        analytics: boolean;
        usagePatterns: boolean;
        performanceMetrics: boolean;
    };
    retention: {
        chatHistory: '1day' | '7days' | '30days' | 'forever';
        analyticsData: '7days' | '30days' | '90days' | 'forever';
        exportOnDelete: boolean;
    };
    visibility: {
        profile: 'private' | 'public';
        achievements: 'private' | 'public';
        activity: 'private' | 'friends' | 'public';
    };
}

export interface AccessibilitySettings {
    theme: 'light' | 'dark' | 'auto';
    fontSize: 'small' | 'medium' | 'large';
    contrast: 'normal' | 'high';
    animations: {
        enabled: boolean;
        intensity: 'subtle' | 'normal' | 'enhanced';
    };
    keyboard: {
        shortcuts: boolean;
        navigation: boolean;
    };
}

export type SettingsState = {
    updateSettings(payload: Record<string, any>): unknown;
    theme: 'light' | 'dark' | 'auto';
    language: string;
    timezone: string;
    notifications: NotificationPreferences;
    aiBehavior: AIBehaviorSettings;
    focus: FocusSettings;
    privacy: PrivacySettings;
    accessibility: AccessibilitySettings;
    flags: {
        autoSave: boolean;
        spellCheck: boolean;
        grammarCheck: boolean;
        autoFormat: boolean;
        offlineMode: boolean;
        betaFeatures: boolean;
    };
    setTheme: (theme: SettingsState['theme']) => void;
    setLanguage: (language: string) => void;
    setTimezone: (timezone: string) => void;
    setNotificationPreferences: (preferences: Partial<NotificationPreferences>) => void;
    toggleNotificationType: (category: keyof NotificationPreferences, type: string) => void;
    setQuietHours: (enabled: boolean, start?: string, end?: string) => void;
    setAIMode: (mode: AIBehaviorSettings['mode']) => void;
    setPersonality: (personality: AIBehaviorSettings['personality']) => void;
    updateResponseStyle: (style: Partial<AIBehaviorSettings['responseStyle']>) => void;
    toggleContextMemory: (enabled: boolean) => void;
    toggleFocusMode: (enabled: boolean) => void;
    updateFocusSettings: (settings: Partial<FocusSettings>) => void;
    setBreakSettings: (duration: number, frequency: number) => void;
    updatePrivacySettings: (settings: Partial<PrivacySettings>) => void;
    setDataCollection: (enabled: boolean) => void;
    setRetentionPolicy: (policy: Partial<PrivacySettings['retention']>) => void;
    updateAccessibility: (settings: Partial<AccessibilitySettings>) => void;
    setFontSize: (size: AccessibilitySettings['fontSize']) => void;
    toggleAnimations: (enabled: boolean) => void;
    toggleFlag: (flag: keyof SettingsState['flags']) => void;
    setFlag: (flag: keyof SettingsState['flags'], value: boolean) => void;
    resetToDefaults: () => void;
    resetSection: (section: keyof Omit<SettingsState, 'flags'>) => void;
    exportSettings: () => SettingsState;
    importSettings: (settings: Partial<SettingsState>) => void;
    isDarkMode: boolean;
    hasNotificationsEnabled: boolean;
    focusModeActive: boolean;
};

// Default values
export const defaultNotifications: NotificationPreferences = {
    email: {
        enabled: true,
        frequency: 'daily',
        types: {
            reminders: true,
            summaries: true,
            insights: true,
            updates: false,
        },
    },
    push: {
        enabled: true,
        quietHours: {
            enabled: true,
            start: '22:00',
            end: '08:00',
        },
        types: {
            messages: true,
            tasks: true,
            goals: false,
            system: true,
        },
    },
    sound: {
        enabled: false,
        volume: 50,
        types: {
            message: true,
            completion: true,
            alert: false,
        },
    },
};

export const defaultAIBehavior: AIBehaviorSettings = {
    mode: 'balanced',
    personality: 'professional',
    responseStyle: {
        length: 'medium',
        temperature: 0.7,
        maxTokens: 1000,
    },
    context: {
        useMemory: true,
        memorySize: 10,
        includeMetadata: false,
    },
};

export const defaultFocus: FocusSettings = {
    enabled: false,
    duration: 50,
    breaks: {
        enabled: true,
        duration: 10,
        frequency: 50,
    },
    distractions: {
        blockNotifications: true,
        hideSidebar: false,
        muteSounds: true,
    },
};

export const defaultPrivacy: PrivacySettings = {
    dataCollection: {
        analytics: true,
        usagePatterns: true,
        performanceMetrics: true,
    },
    retention: {
        chatHistory: '30days',
        analyticsData: '90days',
        exportOnDelete: true,
    },
    visibility: {
        profile: 'private',
        achievements: 'private',
        activity: 'friends',
    },
};

export const defaultAccessibility: AccessibilitySettings = {
    theme: 'dark',
    fontSize: 'medium',
    contrast: 'normal',
    animations: {
        enabled: true,
        intensity: 'normal',
    },
    keyboard: {
        shortcuts: true,
        navigation: true,
    },
};

export const defaultFlags = {
    autoSave: true,
    spellCheck: true,
    grammarCheck: true,
    autoFormat: false,
    offlineMode: false,
    betaFeatures: false,
};
