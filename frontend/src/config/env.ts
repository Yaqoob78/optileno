// Environment configuration with type safety
interface Env {
    readonly API_BASE_URL: string;
    readonly API_URL: string;
    readonly APP_VERSION: string;
    readonly IS_DEV: boolean;
    readonly IS_PROD: boolean;
    readonly SOCKET_URL: string;
}

const rawApiBaseUrl = (((import.meta as any).env.VITE_API_BASE_URL as string) || "").trim();
const rawApiUrl = (((import.meta as any).env.VITE_API_URL as string) || "").trim();
const rawSocketUrl = (((import.meta as any).env.VITE_SOCKET_URL as string) || "").trim();

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const ensureApiV1Base = (value: string): string => {
    const cleaned = stripTrailingSlash(value);
    if (!cleaned) return "/api/v1";
    return /\/api\/v1$/i.test(cleaned) ? cleaned : `${cleaned}/api/v1`;
};

export const env: Env = {
    API_BASE_URL: stripTrailingSlash(rawApiBaseUrl || rawApiUrl).replace(/\/api\/v1$/i, "") || "http://localhost:8000",
    API_URL: ensureApiV1Base(rawApiBaseUrl || rawApiUrl),
    SOCKET_URL: rawSocketUrl ||
        stripTrailingSlash(rawApiBaseUrl || rawApiUrl).replace(/\/api\/v1$/i, "") ||
        "http://localhost:8000",
    APP_VERSION: ((import.meta as any).env.VITE_APP_VERSION as string) || '1.0.0',
    IS_DEV: (import.meta as any).env.DEV as boolean,
    IS_PROD: (import.meta as any).env.PROD as boolean,
};

export default env;
