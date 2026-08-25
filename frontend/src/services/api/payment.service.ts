import { api, ApiResponse } from './client';
import { LEMONSQUEEZY_CHECKOUT_URL, getLemonSqueezyCheckoutUrl } from '../../utils/lemonsqueezy';

export interface SubscriptionPlan {
    name: string;
    tier: string;
    plan_type: string;
    trial_days: number;
    monthly_price: number;  // in cents ($6.99 = 699)
    annual_price: number;   // in cents ($49.00 = 4900)
    currency: string;
    features: string[];
    limits: {
        ai_requests_per_day: number;
        goals: number;
        tasks: number;
    };
}

export interface SubscriptionStatus {
    plan: string;
    plan_details?: SubscriptionPlan;
    status: string;
    tier: string;
    is_owner: boolean;
    has_full_access: boolean;
    message?: string;
    trial_ends_at?: string;
    subscription_ends_at?: string;
    is_trial?: boolean;
    checkout_url?: string;
}

class PaymentService {
    /**
     * Get available subscription plans
     */
    async getPlans(): Promise<ApiResponse<{ plans: Record<string, SubscriptionPlan>; currency: string; checkout_url: string }>> {
        return api.get('/payments/plans');
    }

    /**
     * Get current user's subscription status
     */
    async getSubscriptionStatus(): Promise<ApiResponse<SubscriptionStatus>> {
        return api.get('/payments/subscription');
    }

    /**
     * Get the personalized Lemon Squeezy checkout link for the user
     */
    getCheckoutUrl(user?: { id?: string | number; email?: string } | null): string {
        return getLemonSqueezyCheckoutUrl(user);
    }

    /**
     * Cancel subscription
     */
    async cancelSubscription(reason?: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
        return api.post('/payments/cancel', { reason });
    }
}

export const paymentService = new PaymentService();
export { LEMONSQUEEZY_CHECKOUT_URL, getLemonSqueezyCheckoutUrl };
