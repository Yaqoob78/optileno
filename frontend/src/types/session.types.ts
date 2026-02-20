
export interface DeepWorkSession {
    id: string;
    startTime?: string;
    started_at?: string;
    paused_at?: string;
    completed_at?: string;
    ended_at?: string;
    scheduled_start_at?: string;
    accumulated_pause_seconds?: number;
    duration?: number;
    planned_duration_minutes?: number;
    status: 'scheduled' | 'active' | 'completed' | 'interrupted' | 'cancelled' | 'paused' | 'missed';
    focusArea?: string;
    focus_goal?: string;
    goal_id?: string | number | null;
}
