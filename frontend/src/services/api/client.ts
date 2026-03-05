// services/api/client.ts
import axios, {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
  AxiosError
} from 'axios';
import { useUserStore } from "../../stores/useUserStore";
import { env } from '../../config/env';

const getCookie = (name: string): string | null => {
  const match = document.cookie.match(new RegExp(`(^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[2]) : null;
};

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId: string;
    pagination?: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
}

class APIClient {
  private axiosInstance: AxiosInstance;
  private refreshPromise: Promise<any> | null = null;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: env.API_URL,
      timeout: 30000, // 30 seconds
      withCredentials: true, // Crucial for HttpOnly cookies
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor
    this.axiosInstance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        // Tokens are handled by HttpOnly cookies automatically by the browser

        config.headers['X-Request-ID'] = this.generateRequestId();
        config.headers['X-Client-Version'] = env.APP_VERSION;
        config.headers['X-Client-Platform'] = 'web';
        // Security: Mitigate CSRF on simple requests
        config.headers['X-Requested-With'] = 'XMLHttpRequest';

        const method = (config.method || 'GET').toUpperCase();
        if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
          const csrfToken = getCookie('csrf_token');
          if (csrfToken) {
            config.headers['X-CSRF-Token'] = csrfToken;
          }
        }

        return config;
      },
      (error: AxiosError) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.axiosInstance.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = (error.config || {}) as InternalAxiosRequestConfig & { _retry?: boolean };
        const requestUrl = (originalRequest.url || '').toLowerCase();
        const isAuthEndpoint =
          requestUrl.includes('/auth/login') ||
          requestUrl.includes('/auth/register') ||
          requestUrl.includes('/auth/access/register') ||
          requestUrl.includes('/auth/validate') ||
          requestUrl.includes('/auth/refresh') ||
          requestUrl.includes('/auth/logout') ||
          requestUrl.includes('/auth/forgot-password') ||
          requestUrl.includes('/auth/reset-password');

        // Handle 401 Unauthorized - try to refresh session.
        // Skip auth endpoints to avoid refresh loops/races during bootstrap.
        if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint) {
          originalRequest._retry = true;

          try {
            await this.refreshAccessToken();
            // Cookies are updated by browser, just retry the request
            return this.axiosInstance(originalRequest);
          } catch (refreshError) {
            this.handleAuthFailure();
            return Promise.reject(error);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private async refreshAccessToken(): Promise<any> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = new Promise(async (resolve, reject) => {
      try {
        const response = await axios.post<ApiResponse<any>>(
          `${env.API_URL}/auth/refresh`,
          {},
          {
            withCredentials: true,
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.status === 200) {
          resolve("refreshed");
        } else {
          reject(new Error('Token refresh failed'));
        }
      } catch (error) {
        reject(error);
      } finally {
        this.refreshPromise = null;
      }
    });

    return this.refreshPromise;
  }

  private handleAuthFailure(): void {
    const store = useUserStore.getState();
    store.logout();
    window.dispatchEvent(new CustomEvent('auth:logout'));
  }

  private generateRequestId(): string {
    return `req_${crypto.randomUUID()}`;
  }

  private normalizeError(error: AxiosError): ApiResponse {
    if (error.response) {
      const response = error.response.data as any;
      const fastApiDetail = response?.detail;
      const detailMessage = Array.isArray(fastApiDetail)
        ? fastApiDetail.map((item: any) => item?.msg || JSON.stringify(item)).join('; ')
        : typeof fastApiDetail === 'string'
          ? fastApiDetail
          : undefined;

      return {
        success: false,
        error: {
          code: response?.error?.code || `HTTP_${error.response.status}`,
          message: response?.error?.message || detailMessage || response?.message || error.response.statusText,
          details: response?.error?.details ?? fastApiDetail,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: error.config?.headers?.['X-Request-ID'] as string || 'unknown',
        },
      };
    } else if (error.request) {
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'No response received from server',
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: error.config?.headers?.['X-Request-ID'] as string || 'unknown',
        },
      };
    } else {
      return {
        success: false,
        error: {
          code: 'CLIENT_ERROR',
          message: error.message,
        },
        meta: {
          timestamp: new Date().toISOString(),
          requestId: 'unknown',
        },
      };
    }
  }

  private passthroughApiError<T = any>(error: unknown): ApiResponse<T> | null {
    if (
      error &&
      typeof error === 'object' &&
      'success' in (error as Record<string, unknown>) &&
      (error as Record<string, unknown>).success === false
    ) {
      return error as ApiResponse<T>;
    }

    return null;
  }

  private unknownErrorResponse<T = any>(error: unknown): ApiResponse<T> {
    return {
      success: false,
      error: {
        code: 'CLIENT_ERROR',
        message: error instanceof Error ? error.message : 'Unexpected client error',
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId: 'unknown',
      },
    };
  }

  // Public API methods
  public get = async <T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    try {
      const response = await this.axiosInstance.get<any>(url, config);

      // Handle backend's direct response format
      if (response.data && typeof response.data === 'object') {
        if ('success' in response.data) {
          return response.data as ApiResponse<T>;
        }

        return {
          success: true,
          data: response.data as T,
          meta: {
            timestamp: new Date().toISOString(),
            requestId: response.config?.headers?.['X-Request-ID'] as string || 'unknown',
          },
        };
      }

      return response.data;
    } catch (error) {
      const passthrough = this.passthroughApiError<T>(error);
      if (passthrough) {
        return passthrough;
      }
      if (axios.isAxiosError(error)) {
        return this.normalizeError(error);
      }
      return this.unknownErrorResponse<T>(error);
    }
  }

  public post = async <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    try {
      const response = await this.axiosInstance.post<any>(url, data, config);

      // Handle backend's direct response format (e.g., {status: "success", user: {...}})
      if (response.data && typeof response.data === 'object') {
        // If response has 'success' field, it's already in ApiResponse format
        if ('success' in response.data) {
          return response.data as ApiResponse<T>;
        }

        // Otherwise, wrap the response
        return {
          success: true,
          data: response.data as T,
          meta: {
            timestamp: new Date().toISOString(),
            requestId: response.config?.headers?.['X-Request-ID'] as string || 'unknown',
          },
        };
      }

      return response.data;
    } catch (error) {
      const passthrough = this.passthroughApiError<T>(error);
      if (passthrough) {
        return passthrough;
      }
      if (axios.isAxiosError(error)) {
        return this.normalizeError(error);
      }
      return this.unknownErrorResponse<T>(error);
    }
  }

  public put = async <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    try {
      const response = await this.axiosInstance.put<ApiResponse<T>>(url, data, config);
      return response.data;
    } catch (error) {
      const passthrough = this.passthroughApiError<T>(error);
      if (passthrough) {
        return passthrough;
      }
      if (axios.isAxiosError(error)) {
        return this.normalizeError(error);
      }
      return this.unknownErrorResponse<T>(error);
    }
  }

  public patch = async <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    try {
      const response = await this.axiosInstance.patch<any>(url, data, config);

      // Handle backend's direct response format (e.g., {status: "success", user: {...}})
      if (response.data && typeof response.data === 'object') {
        // If response has 'success' field, it's already in ApiResponse format
        if ('success' in response.data) {
          return response.data as ApiResponse<T>;
        }

        // Otherwise, wrap the response
        return {
          success: true,
          data: response.data as T,
          meta: {
            timestamp: new Date().toISOString(),
            requestId: response.config?.headers?.['X-Request-ID'] as string || 'unknown',
          },
        };
      }

      return response.data;
    } catch (error) {
      const passthrough = this.passthroughApiError<T>(error);
      if (passthrough) {
        return passthrough;
      }
      if (axios.isAxiosError(error)) {
        return this.normalizeError(error);
      }
      return this.unknownErrorResponse<T>(error);
    }
  }

  public delete = async <T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
    try {
      const response = await this.axiosInstance.delete<ApiResponse<T>>(url, config);
      // Handle 204 No Content responses (successful delete with no body)
      if (response.status === 204) {
        return {
          success: true,
          data: undefined as any,
        };
      }
      // Normalize backend direct response payloads to ApiResponse shape
      if (response.data && typeof response.data === 'object') {
        if ('success' in response.data) {
          return response.data as ApiResponse<T>;
        }

        return {
          success: true,
          data: response.data as T,
          meta: {
            timestamp: new Date().toISOString(),
            requestId: response.config?.headers?.['X-Request-ID'] as string || 'unknown',
          },
        };
      }

      return {
        success: true,
        data: (response.data as T) ?? (undefined as any),
      };
    } catch (error) {
      const passthrough = this.passthroughApiError<T>(error);
      if (passthrough) {
        return passthrough;
      }
      if (axios.isAxiosError(error)) {
        return this.normalizeError(error);
      }
      return this.unknownErrorResponse<T>(error);
    }
  }

  public upload = async <T = any>(url: string, file: File, fieldName = 'file'): Promise<ApiResponse<T>> => {
    const formData = new FormData();
    formData.append(fieldName, file);

    try {
      const response = await this.axiosInstance.post<ApiResponse<T>>(url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data;
    } catch (error) {
      const passthrough = this.passthroughApiError<T>(error);
      if (passthrough) {
        return passthrough;
      }
      if (axios.isAxiosError(error)) {
        return this.normalizeError(error);
      }
      return this.unknownErrorResponse<T>(error);
    }
  }

  public setAuthTokens(): void {
    // Handled by browser cookies
  }

  public clearAuthTokens(): void {
    // Handled by logout endpoint / browser cookies
  }

  public isAuthenticated(): boolean {
    const store = useUserStore.getState();
    return store.isAuthenticated;
  }
}

export const apiClient = new APIClient();

export const api = {
  get: apiClient.get,
  post: apiClient.post,
  put: apiClient.put,
  patch: apiClient.patch,
  delete: apiClient.delete,
  upload: apiClient.upload,
  setAuthTokens: apiClient.setAuthTokens,
  clearAuthTokens: apiClient.clearAuthTokens,
  isAuthenticated: apiClient.isAuthenticated,
};

export default api;
