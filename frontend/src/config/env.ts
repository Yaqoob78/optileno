// Environment configuration with type safety
interface Env {
    readonly API_URL: string;
    readonly APP_VERSION: string;
    readonly IS_DEV: boolean;
    readonly IS_PROD: boolean;
    readonly SOCKET_URL: string;
}

export const env: Env = {
    API_URL: ((import.meta as any).env.VITE_API_URL as string) || '/api/v1',
    SOCKET_URL: ((import.meta as any).env.VITE_SOCKET_URL as string) ||
        ((import.meta as any).env.VITE_API_URL as string)?.replace(/\/api\/v1\/?$/, '') ||
        'http://localhost:8000',
    APP_VERSION: ((import.meta as any).env.VITE_APP_VERSION as string) || '1.0.0',
    IS_DEV: (import.meta as any).env.DEV as boolean,
    IS_PROD: (import.meta as any).env.PROD as boolean,
};

export default env;
