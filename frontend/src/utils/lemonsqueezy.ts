/**
 * Lemon Squeezy Checkout Integration for Optileno SaaS.
 */

export const LEMONSQUEEZY_MONTHLY_CHECKOUT_URL =
  'https://optileno.lemonsqueezy.com/checkout/buy/602908e3-0459-4b70-b8af-2018f06424ce';

export const LEMONSQUEEZY_ANNUAL_CHECKOUT_URL =
  'https://optileno.lemonsqueezy.com/checkout/buy/602908e3-0459-4b70-b8af-2018f06424ce';

export const LEMONSQUEEZY_CHECKOUT_URL = LEMONSQUEEZY_MONTHLY_CHECKOUT_URL;
export const LEMONSQUEEZY_50_OFF_COUPON = 'M3MDQWMQ';

export interface CheckoutUserContext {
  id?: string | number;
  email?: string;
  name?: string;
  billingCycle?: 'monthly' | 'annual';
}

/**
 * Builds the direct Lemon Squeezy checkout URL prefilling the user's details, custom user_id, and optional discount coupon code.
 */
export function getLemonSqueezyCheckoutUrl(
  user?: CheckoutUserContext | null,
  cycle: 'monthly' | 'annual' = 'monthly',
  discountCode?: string
): string {
  try {
    const selectedCycle = user?.billingCycle || cycle;
    const base = selectedCycle === 'annual' ? LEMONSQUEEZY_ANNUAL_CHECKOUT_URL : LEMONSQUEEZY_MONTHLY_CHECKOUT_URL;
    const url = new URL(base);

    if (user?.email) {
      url.searchParams.set('checkout[email]', user.email.trim());
    }
    if (user?.name) {
      url.searchParams.set('checkout[name]', user.name.trim());
    }
    if (user?.id) {
      url.searchParams.set('checkout[custom][user_id]', String(user.id));
    }
    url.searchParams.set('checkout[custom][billing_cycle]', selectedCycle);

    if (discountCode) {
      url.searchParams.set('checkout[discount_code]', discountCode.trim());
    }

    return url.toString();
  } catch {
    return LEMONSQUEEZY_CHECKOUT_URL;
  }
}

/**
 * Directly redirects the browser to the Lemon Squeezy Ultra Pro checkout page with optional discount code.
 */
export function openLemonSqueezyCheckout(
  user?: CheckoutUserContext | null,
  cycle: 'monthly' | 'annual' = 'monthly',
  discountCode?: string
): void {
  const checkoutUrl = getLemonSqueezyCheckoutUrl(user, cycle, discountCode);
  window.location.href = checkoutUrl;
}
