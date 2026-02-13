// frontend/src/services/api/bigFiveTest.service.ts
import { api } from './client';

export type QuestionSource = 'ai' | 'fallback' | 'unknown';

export interface BigFiveTestStatus {
    has_completed_test: boolean;
    test_in_progress: boolean;
    current_scores: {
        openness: number;
        conscientiousness: number;
        extraversion: number;
        agreeableness: number;
        neuroticism: number;
    } | null;
    days_until_next_test: number | null;
    next_test_available: boolean;
    can_take_test: boolean;
    test_id?: number;
    test_completed_at?: string;
    current_question_index?: number;
    questions_asked?: number;
}

export interface BigFiveQuestion {
    text: string;
    options: Array<{
        value: number;
        label: string;
    }>;
    trait: string;
    source?: QuestionSource;
}

export interface StartTestResponse {
    test_id: number;
    question_index: number;
    question: BigFiveQuestion;
    total_questions: number;
    is_resumed: boolean;
    question_source?: QuestionSource;
    using_fallback?: boolean;
    error?: string;
    days_remaining?: number;
}

export interface AnswerResponse {
    test_completed: boolean;
    question_index?: number;
    question?: BigFiveQuestion;
    question_source?: QuestionSource;
    using_fallback?: boolean;
    progress?: number;
    remaining_questions?: number;
    scores?: {
        openness: number;
        conscientiousness: number;
        extraversion: number;
        agreeableness: number;
        neuroticism: number;
    };
    live_scores?: {
        openness: number;
        conscientiousness: number;
        extraversion: number;
        agreeableness: number;
        neuroticism: number;
    };
    next_test_available_in_days?: number;
    message?: string;
    error?: string;
}

export interface BigFiveProfile {
    scores: {
        openness: number;
        conscientiousness: number;
        extraversion: number;
        agreeableness: number;
        neuroticism: number;
    };
    descriptions: Record<string, string>;
    test_completed_at: string | null;
    next_test_available_at: string | null;
    questions_answered: number;
    adjustments: {
        openness: number;
        conscientiousness: number;
        extraversion: number;
        agreeableness: number;
        neuroticism: number;
    };
}

class BigFiveTestService {
    private static instance: BigFiveTestService;

    private constructor() { }

    static getInstance(): BigFiveTestService {
        if (!BigFiveTestService.instance) {
            BigFiveTestService.instance = new BigFiveTestService();
        }
        return BigFiveTestService.instance;
    }

    /**
     * Get the current test status for the user
     */
    async getTestStatus(): Promise<BigFiveTestStatus> {
        const response = await api.get<BigFiveTestStatus>('/analytics/big-five-test/status');
        if (!response.success || !response.data) {
            throw new Error(response.error?.message || 'Failed to get test status');
        }
        return response.data;
    }

    /**
     * Start a new test or resume an existing one
     */
    async startTest(forceNew = false): Promise<StartTestResponse> {
        const response = await api.post<StartTestResponse>('/analytics/big-five-test/start', {
            force_new: forceNew
        });
        if (!response.success || !response.data) {
            throw new Error(response.error?.message || 'Failed to start test');
        }
        return response.data;
    }

    /**
     * Submit an answer for the current question
     */
    async submitAnswer(testId: number, response: number): Promise<AnswerResponse> {
        const result = await api.post<AnswerResponse>('/analytics/big-five-test/answer', {
            test_id: testId,
            response: response
        });
        if (!result.success || !result.data) {
            throw new Error(result.error?.message || 'Failed to submit answer');
        }
        return result.data;
    }

    /**
     * Get the completed profile with scores and descriptions
     */
    async getProfile(): Promise<BigFiveProfile> {
        const response = await api.get<BigFiveProfile>('/analytics/big-five-test/profile');
        if (!response.success || !response.data) {
            throw new Error(response.error?.message || 'No completed test found');
        }
        return response.data;
    }

    /**
     * Apply behavioral adjustments to scores
     */
    async applyAdjustments(): Promise<{ applied: boolean; adjustments: any }> {
        const response = await api.post<{ applied: boolean; adjustments: any }>(
            '/analytics/big-five-test/adjust'
        );
        if (!response.success || !response.data) {
            throw new Error(response.error?.message || 'Failed to apply adjustments');
        }
        return response.data;
    }
}

export const bigFiveTestService = BigFiveTestService.getInstance();
