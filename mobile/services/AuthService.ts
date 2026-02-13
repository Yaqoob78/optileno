// mobile/services/AuthService.ts
/**
 * Authentication Service
 * Manages login, registration, and token management
 */

import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config/api';

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterCredentials {
  email: string;
  password: string;
  full_name: string;
}

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: {
    id: number;
    email: string;
    full_name: string;
  };
}

class AuthServiceClass {
  private apiClient = axios.create({
    baseURL: API_BASE_URL,
  });

  constructor() {
    this.setupInterceptors();
  }

  /**
   * Setup axios interceptors for token management
   */
  private setupInterceptors() {
    this.apiClient.interceptors.request.use(async (config: any) => {
      const token = await AsyncStorage.getItem('@concierge_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    this.apiClient.interceptors.response.use(
      (response: any) => response,
      async (error: any) => {
        const originalRequest = error.config;

        // Handle token refresh
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const refreshToken = await AsyncStorage.getItem('@concierge_refresh_token');
            const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
              refresh_token: refreshToken,
            });

            const { access_token, refresh_token } = response.data;
            await AsyncStorage.setItem('@concierge_token', access_token);
            await AsyncStorage.setItem('@concierge_refresh_token', refresh_token);

            originalRequest.headers.Authorization = `Bearer ${access_token}`;
            return this.apiClient(originalRequest);
          } catch (refreshError) {
            // Refresh failed, redirect to login
            await this.logout();
            throw refreshError;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Login user
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await this.apiClient.post<AuthResponse>(
        '/auth/login',
        credentials
      );

      const { access_token, refresh_token } = response.data;
      await AsyncStorage.setItem('@concierge_token', access_token);
      await AsyncStorage.setItem('@concierge_refresh_token', refresh_token);
      await AsyncStorage.setItem('@concierge_user', JSON.stringify(response.data.user));

      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Register new user
   */
  async register(credentials: RegisterCredentials): Promise<AuthResponse> {
    try {
      const response = await this.apiClient.post<AuthResponse>(
        '/auth/register',
        credentials
      );

      const { access_token, refresh_token } = response.data;
      await AsyncStorage.setItem('@concierge_token', access_token);
      await AsyncStorage.setItem('@concierge_refresh_token', refresh_token);
      await AsyncStorage.setItem('@concierge_user', JSON.stringify(response.data.user));

      return response.data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      await this.apiClient.post('/auth/logout');
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      await AsyncStorage.removeItem('@concierge_token');
      await AsyncStorage.removeItem('@concierge_refresh_token');
      await AsyncStorage.removeItem('@concierge_user');
    }
  }

  /**
   * Get current user from storage
   */
  async getCurrentUser() {
    const userJson = await AsyncStorage.getItem('@concierge_user');
    return userJson ? JSON.parse(userJson) : null;
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const token = await AsyncStorage.getItem('@concierge_token');
    return !!token;
  }

  /**
   * Get stored token
   */
  async getToken(): Promise<string | null> {
    return AsyncStorage.getItem('@concierge_token');
  }
}

export const AuthService = new AuthServiceClass();
