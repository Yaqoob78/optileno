
export interface DeepWorkSession {
    id: string;
    startTime: string;
    duration: number;
    status: 'active' | 'completed' | 'interrupted';
    focusArea?: string;
}
