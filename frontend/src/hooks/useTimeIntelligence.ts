import { useState, useEffect, useCallback } from 'react';

export interface ChronotypeData {
    type: string;
    peak_hours: number[];
    low_energy_hours: number[];
    hourly_activity: Record<string, number>;
    distribution: Record<string, number>;
    description?: string;
    error?: string;
}

export interface EstimationCategory {
    name: string;
    accuracy: number;
    count: number;
}

export interface EstimationData {
    overall_accuracy: number;
    insight: string;
    categories: EstimationCategory[];
    error?: string;
}

export interface OptimalWindow {
    start: string;
    end: string;
    day: string;
    confidence: number;
    reason: string;
}

export interface EfficiencyData {
    context_switching_loss_hours?: number;
    planning_overhead_minutes?: number;
    recovery_needed_minutes?: number;
}

export interface TimeIntelligenceData {
    chronotype: ChronotypeData;
    estimation: EstimationData;
    optimal_windows: OptimalWindow[];
    efficiency: EfficiencyData;
}

export function useTimeIntelligence() {
    const [data, setData] = useState<TimeIntelligenceData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/v1/analytics/time-intelligence', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            // Check if response is actually JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('API unavailable - server returned non-JSON response');
            }

            if (!response.ok) {
                throw new Error('Failed to fetch time intelligence data');
            }

            const jsonData = await response.json();
            setData(jsonData);
            setError(null);
        } catch (err: any) {
            console.error('Time Intelligence fetch error:', err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { data, isLoading, error, refresh: fetchData };
}
