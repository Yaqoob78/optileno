import { api, ApiResponse } from './client';

export interface SubscriptionPlan {
    name: string;
    tier: string;
    plan_type: string;
    trial_days: number;
    monthly_price: number;  // in cents
    annual_price: number;   // in cents
    currency: string;
    features: string[];
    limits: {
        ai_requests_per_day: number;
        goals: number;
        tasks: number;
    };
}

export interface CreateOrderResponse {
    payment_session_id: string;
    order_id: string;
    cf_order_id?: string;
    order_status?: string;
    order_amount?: number;
    plan?: string;
    plan_details?: SubscriptionPlan;
    billing_cycle?: string;
    trial_days?: number;
    environment?: string;
}

export interface CreateSubscriptionResponse {
    subscription_session_id: string;
    subscription_id: string;
    cf_subscription_id?: string;
    subscription_status?: string;
    plan?: string;
    plan_details?: SubscriptionPlan;
    billing_cycle?: string;
    trial_days?: number;
    first_charge_at?: string;
    environment?: string;
}

export interface VerifyPaymentResponse {
    success: boolean;
    message: string;
    plan?: string;
    tier?: string;
    order_status?: string;
}

export interface VerifySubscriptionResponse {
    success: boolean;
    message: string;
    plan?: string;
    tier?: string;
    subscription_status?: string;
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
}

class PaymentService {
    /**
     * Get available subscription plans
     */
    async getPlans(): Promise<ApiResponse<{ plans: Record<string, SubscriptionPlan>; currency: string; message: string }>> {
        return api.get('/payments/plans');
    }

    /**
     * Get current user's subscription status
     */
    async getSubscriptionStatus(): Promise<ApiResponse<SubscriptionStatus>> {
        return api.get('/payments/subscription');
    }

    /**
     * Create a Cashfree order and get payment_session_id
     */
    async createOrder(plan: 'explorer' | 'ultra', billingCycle: 'monthly' | 'annual' = 'monthly'): Promise<ApiResponse<CreateOrderResponse>> {
        return api.post<CreateOrderResponse>('/payments/create-order', { plan, billing_cycle: billingCycle });
    }

    /**
     * Create recurring subscription checkout session
     */
    async createSubscription(plan: 'explorer' | 'ultra', billingCycle: 'monthly' | 'annual' = 'monthly'): Promise<ApiResponse<CreateSubscriptionResponse>> {
        return api.post<CreateSubscriptionResponse>('/payments/create-subscription', { plan, billing_cycle: billingCycle });
    }

    /**
     * Verify payment status after checkout
     */
    async verifyPayment(orderId: string): Promise<ApiResponse<VerifyPaymentResponse>> {
        return api.post<VerifyPaymentResponse>('/payments/verify', { order_id: orderId });
    }

    /**
     * Verify subscription mandate setup after checkout
     */
    async verifySubscription(subscriptionId: string): Promise<ApiResponse<VerifySubscriptionResponse>> {
        return api.post<VerifySubscriptionResponse>('/payments/verify-subscription', { subscription_id: subscriptionId });
    }

    /**
     * Cancel subscription
     */
    async cancelSubscription(reason?: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
        return api.post('/payments/cancel', { reason });
    }
}

export const paymentService = new PaymentService();
