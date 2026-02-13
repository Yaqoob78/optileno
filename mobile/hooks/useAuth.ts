// mobile/hooks/useAuth.ts
/**
 * useAuth Hook
 * Manages authentication state
 */

import { useEffect, useReducer } from 'react';
import { AuthService } from '../services/AuthService';

interface AuthState {
  isLoading: boolean;
  isSignedIn: boolean;
  user: any | null;
  error: string | null;
}

type AuthAction =
  | { type: 'RESTORE_TOKEN'; payload: { user: any; token: string } }
  | { type: 'SIGN_IN'; payload: { user: any } }
  | { type: 'SIGN_UP'; payload: { user: any } }
  | { type: 'SIGN_OUT' }
  | { type: 'ERROR'; payload: string };

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'RESTORE_TOKEN':
      return {
        ...state,
        isLoading: false,
        isSignedIn: true,
        user: action.payload.user,
      };
    case 'SIGN_IN':
      return {
        ...state,
        isSignedIn: true,
        user: action.payload.user,
      };
    case 'SIGN_UP':
      return {
        ...state,
        isSignedIn: true,
        user: action.payload.user,
      };
    case 'SIGN_OUT':
      return {
        isLoading: false,
        isSignedIn: false,
        user: null,
        error: null,
      };
    case 'ERROR':
      return {
        ...state,
        error: action.payload,
      };
    default:
      return state;
  }
}

export function useAuth() {
  const [state, dispatch] = useReducer(authReducer, {
    isLoading: true,
    isSignedIn: false,
    user: null,
    error: null,
  });

  // Check if user is authenticated on mount
  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        const isAuth = await AuthService.isAuthenticated();
        if (isAuth) {
          const user = await AuthService.getCurrentUser();
          dispatch({ type: 'RESTORE_TOKEN', payload: { user, token: '' } });
        } else {
          dispatch({ type: 'SIGN_OUT' });
        }
      } catch (error) {
        dispatch({ type: 'SIGN_OUT' });
      }
    };

    bootstrapAsync();
  }, []);

  const authContext = {
    state,
    isLoading: state.isLoading,
    signIn: async (email: string, password: string) => {
      try {
        const response = await AuthService.login({ email, password });
        dispatch({ type: 'SIGN_IN', payload: { user: response.user } });
      } catch (error) {
        dispatch({ type: 'ERROR', payload: (error as any).message });
        throw error;
      }
    },
    signUp: async (email: string, password: string, full_name: string) => {
      try {
        const response = await AuthService.register({ email, password, full_name });
        dispatch({ type: 'SIGN_UP', payload: { user: response.user } });
      } catch (error) {
        dispatch({ type: 'ERROR', payload: (error as any).message });
        throw error;
      }
    },
    signOut: async () => {
      try {
        await AuthService.logout();
        dispatch({ type: 'SIGN_OUT' });
      } catch (error) {
        console.error('Sign out error:', error);
      }
    },
  };

  return authContext;
}
