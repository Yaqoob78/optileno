declare global {
  interface Window {
    Cashfree?: any;
  }
}

export type CashfreeMode = "sandbox" | "production";

let sdkPromise: Promise<void> | null = null;

const SDK_SRC = "https://sdk.cashfree.com/js/v3/cashfree.js";

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
  cashfree.checkout({
    paymentSessionId,
    redirectTarget: "_self",
  });
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

  await cashfree.subscriptionsCheckout({
    subsSessionId: subscriptionSessionId,
    redirectTarget: "_self",
  });
}
