import { api, ApiResponse } from './client';

export interface CheckoutSessionResponse {
    url: string;
}

class PaymentService {
    /**
     * Create a checkout session and redirect the user
     */
    async createCheckoutSession(): Promise<ApiResponse<CheckoutSessionResponse>> {
        return api.post<CheckoutSessionResponse>('/payments/create-checkout-session');
    }

    /**
     * Create a customer portal session for billing management
     */
    async createPortalSession(): Promise<ApiResponse<{ url: string }>> {
        return api.post<{ url: string }>('/payments/create-portal-session');
    }
}

export const paymentService = new PaymentService();
