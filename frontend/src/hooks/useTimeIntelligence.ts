import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api/client';

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
            const response = await api.get<TimeIntelligenceData>('/analytics/time-intelligence');
            if (!response.success || !response.data) {
                throw new Error(response.error?.message || 'Failed to fetch time intelligence data');
            }
            setData(response.data);
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
