// frontend/src/hooks/usePatternDetector.ts
import { useState, useEffect, useCallback } from 'react';

export interface Pattern {
    id: string;
    category: string;
    title: string;
    description: string;
    confidence: number;
    evidence: string[];
    actionable_insight: string;
    data_points: number;
    detected_on: string;
    details?: any;
}

interface DataQuality {
    sufficient_data: boolean;
    days_analyzed: number;
    days_until_ready: number;
    first_event_date: string | null;
}

interface PatternsResponse {
    patterns: Pattern[];
    data_quality: DataQuality;
    total_detected?: number;
    statistically_significant?: number;
    last_updated?: string;
    message?: string;
}

interface UsePatternDetectorReturn {
    patterns: Pattern[];
    dataQuality: DataQuality | null;
    isLoading: boolean;
    error: string | null;
    refresh: () => Promise<void>;
}

export function usePatternDetector(): UsePatternDetectorReturn {
    const [patterns, setPatterns] = useState<Pattern[]>([]);
    const [dataQuality, setDataQuality] = useState<DataQuality | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getAuthHeaders = useCallback(() => {
        const token = localStorage.getItem('token');
        return {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        };
    }, []);

    const refresh = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            const response = await fetch('/api/v1/analytics/patterns/all', {
                headers: getAuthHeaders(),
            });

            if (!response.ok) {
                throw new Error('Failed to fetch patterns');
            }

            const data: PatternsResponse = await response.json();
            setPatterns(data.patterns || []);
            setDataQuality(data.data_quality);
        } catch (err: any) {
            console.error('Error fetching patterns:', err);
            setError(err.message);
            setPatterns([]);
        } finally {
            setIsLoading(false);
        }
    }, [getAuthHeaders]);

    // Initial load
    useEffect(() => {
        refresh();
    }, [refresh]);

    // Refresh every 10 minutes (patterns don't change that quickly)
    useEffect(() => {
        const interval = setInterval(refresh, 10 * 60 * 1000);
        return () => clearInterval(interval);
    }, [refresh]);

    return {
        patterns,
        dataQuality,
        isLoading,
        error,
        refresh,
    };
}
