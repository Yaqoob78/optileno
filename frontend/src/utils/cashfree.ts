declare global {
  interface Window {
    Cashfree?: any;
  }
}

export type CashfreeMode = "sandbox" | "production";
type CashfreeRedirectTarget = "_self" | "_blank" | "_modal";

let sdkPromise: Promise<void> | null = null;

const SDK_SRC = "https://sdk.cashfree.com/js/v3/cashfree.js";

const MOBILE_USER_AGENT_REGEX =
  /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i;

function isMobileContext(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return false;
  }

  const userAgent = navigator.userAgent || "";
  const isMobileUserAgent = MOBILE_USER_AGENT_REGEX.test(userAgent);
  const isNarrowViewport =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(max-width: 768px)").matches;

  return isMobileUserAgent || isNarrowViewport;
}

function resolveRedirectTarget(flow: "order" | "subscription"): CashfreeRedirectTarget {
  if (isMobileContext()) {
    return "_self";
  }

  return flow === "order" ? "_modal" : "_blank";
}

export async function loadCashfreeSdk(timeoutMs = 12000): Promise<void> {
  if (typeof window === "undefined") {
    throw new Error("Cashfree SDK can only be loaded in browser context.");
  }

  if (window.Cashfree) {
    return;
  }

  if (!sdkPromise) {
    sdkPromise = new Promise<void>((resolve, reject) => {
      const existingScript = document.querySelector(`script[src="${SDK_SRC}"]`) as HTMLScriptElement | null;
      const script = existingScript || document.createElement("script");
      const startedAt = Date.now();

      const cleanup = (intervalId?: number) => {
        if (intervalId) {
          window.clearInterval(intervalId);
        }
        script.onload = null;
        script.onerror = null;
      };

      const finishIfReady = (intervalId?: number) => {
        if (window.Cashfree) {
          cleanup(intervalId);
          resolve();
          return true;
        }
        return false;
      };

      const intervalId = window.setInterval(() => {
        if (finishIfReady(intervalId)) {
          return;
        }
        if (Date.now() - startedAt > timeoutMs) {
          cleanup(intervalId);
          sdkPromise = null;
          reject(new Error("Cashfree SDK load timed out."));
        }
      }, 150);

      script.onload = () => {
        if (!finishIfReady(intervalId)) {
          cleanup(intervalId);
          sdkPromise = null;
          reject(new Error("Cashfree SDK loaded but was not initialized."));
        }
      };

      script.onerror = () => {
        cleanup(intervalId);
        sdkPromise = null;
        reject(new Error("Failed to load Cashfree SDK script."));
      };

      if (!existingScript) {
        script.src = SDK_SRC;
        script.async = true;
        document.head.appendChild(script);
      }
    });
  }

  return sdkPromise;
}

export async function openCashfreeCheckout(
  paymentSessionId: string,
  mode: CashfreeMode = "sandbox"
): Promise<void> {
  if (!paymentSessionId) {
    throw new Error("Missing payment session ID.");
  }

  await loadCashfreeSdk();

  if (!window.Cashfree) {
    throw new Error("Cashfree SDK unavailable after load.");
  }

  const cashfree = new window.Cashfree({ mode });
  const redirectTarget = resolveRedirectTarget("order");

  try {
    cashfree.checkout({
      paymentSessionId,
      redirectTarget,
    });
  } catch (error) {
    if (redirectTarget !== "_self") {
      cashfree.checkout({
        paymentSessionId,
        redirectTarget: "_self",
      });
      return;
    }
    throw error;
  }
}

export async function openCashfreeSubscriptionCheckout(
  subscriptionSessionId: string,
  mode: CashfreeMode = "sandbox"
): Promise<void> {
  if (!subscriptionSessionId) {
    throw new Error("Missing subscription session ID.");
  }

  await loadCashfreeSdk();

  if (!window.Cashfree) {
    throw new Error("Cashfree SDK unavailable after load.");
  }

  const cashfree = new window.Cashfree({ mode });
  if (typeof cashfree.subscriptionsCheckout !== "function") {
    throw new Error("Cashfree subscription checkout is unavailable in the loaded SDK.");
  }

  const redirectTarget = resolveRedirectTarget("subscription");
  const payload = {
    subsSessionId: subscriptionSessionId,
    redirectTarget,
  };

  try {
    await cashfree.subscriptionsCheckout(payload);
  } catch (error) {
    if (redirectTarget !== "_self") {
      await cashfree.subscriptionsCheckout({
        ...payload,
        redirectTarget: "_self",
      });
      return;
    }
    throw error;
  }

}
