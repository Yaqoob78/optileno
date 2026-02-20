
export interface DeepWorkSession {
    id: string;
    startTime?: string;
    started_at?: string;
    duration?: number;
    planned_duration_minutes?: number;
    status: 'scheduled' | 'active' | 'completed' | 'interrupted' | 'cancelled';
    focusArea?: string;
    focus_goal?: string;
    goal_id?: string | number | null;
}
