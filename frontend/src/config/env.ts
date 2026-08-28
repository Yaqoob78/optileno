// Environment configuration with type safety
interface Env {
    readonly API_BASE_URL: string;
    readonly API_URL: string;
    readonly APP_VERSION: string;
    readonly IS_DEV: boolean;
    readonly IS_PROD: boolean;
    readonly SOCKET_URL: string;
    readonly GOOGLE_CLIENT_ID: string;
}

const rawGoogleClientId = (((import.meta as any).env.VITE_GOOGLE_CLIENT_ID as string) || "").trim();
const rawApiBaseUrl = (((import.meta as any).env.VITE_API_BASE_URL as string) || "").trim();
const rawApiUrl = (((import.meta as any).env.VITE_API_URL as string) || "").trim();
const rawSocketUrl = (((import.meta as any).env.VITE_SOCKET_URL as string) || "").trim();

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, "");
const stripApiSuffix = (value: string): string => stripTrailingSlash(value).replace(/\/api(?:\/v1)?$/i, "");

const runtimeProtocol = (): string | null => {
    if (typeof window === "undefined") return null;
    return window.location.protocol;
};

const runtimeOrigin = (): string => {
    if (typeof window === "undefined") return "http://localhost:8000";
    return window.location.origin;
};

const isLocalHostname = (hostname: string): boolean => {
    const normalized = hostname.toLowerCase();
    return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
};

const ensureApiV1Base = (value: string): string => {
    const cleaned = stripTrailingSlash(value);
    if (!cleaned) return "/api/v1";
    return /\/api\/v1$/i.test(cleaned) ? cleaned : `${cleaned}/api/v1`;
};

const toSocketOrigin = (value: string): string => {
    const cleaned = stripApiSuffix(value);
    if (!cleaned) return "";

    try {
        const url = new URL(cleaned, runtimeOrigin());

        if (url.protocol === "ws:") url.protocol = "http:";
        if (url.protocol === "wss:") url.protocol = "https:";

        if (
            runtimeProtocol() === "https:" &&
            url.protocol === "http:" &&
            !isLocalHostname(url.hostname)
        ) {
            url.protocol = "https:";
        }

        return url.origin;
    } catch {
        return cleaned;
    }
};

const isInsecureSocketOverride = (value: string): boolean => {
    if (!value || runtimeProtocol() !== "https:") return false;

    try {
        const url = new URL(value, runtimeOrigin());
        return ["http:", "ws:"].includes(url.protocol) && !isLocalHostname(url.hostname);
    } catch {
        return false;
    }
};

const rawBackendUrl = rawApiBaseUrl || rawApiUrl;
const apiOriginForSocket = toSocketOrigin(rawBackendUrl);
const configuredSocketOrigin = toSocketOrigin(rawSocketUrl);
const socketOrigin = (
    isInsecureSocketOverride(rawSocketUrl) && apiOriginForSocket.startsWith("https://")
        ? apiOriginForSocket
        : configuredSocketOrigin
) || apiOriginForSocket || "http://localhost:8000";

export const env: Env = {
    API_BASE_URL: stripApiSuffix(rawBackendUrl) || "http://localhost:8000",
    API_URL: ensureApiV1Base(rawBackendUrl),
    SOCKET_URL: socketOrigin,
    APP_VERSION: ((import.meta as any).env.VITE_APP_VERSION as string) || '1.0.0',
    IS_DEV: (import.meta as any).env.DEV as boolean,
    IS_PROD: (import.meta as any).env.PROD as boolean,
    GOOGLE_CLIENT_ID: rawGoogleClientId || "",
};

export default env;
