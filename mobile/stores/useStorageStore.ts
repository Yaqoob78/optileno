// mobile/stores/useStorageStore.ts
/**
 * Storage Store
 * Zustand store for managing local storage
 */

import create from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface StorageStore {
  token: string | null;
  user: any | null;
  setToken: (token: string) => Promise<void>;
  setUser: (user: any) => Promise<void>;
  getToken: () => Promise<string | null>;
  getUser: () => Promise<any>;
  clear: () => Promise<void>;
}

export const useStorageStore = create<StorageStore>((set: any, get: any) => ({
  token: null,
  user: null,

  setToken: async (token: string) => {
    await AsyncStorage.setItem('@concierge_token', token);
    set({ token });
  },

  setUser: async (user: any) => {
    await AsyncStorage.setItem('@concierge_user', JSON.stringify(user));
    set({ user });
  },

  getToken: async () => {
    const token = await AsyncStorage.getItem('@concierge_token');
    set({ token });
    return token;
  },

  getUser: async () => {
    const userJson = await AsyncStorage.getItem('@concierge_user');
    const user = userJson ? JSON.parse(userJson) : null;
    set({ user });
    return user;
  },

  clear: async () => {
    await AsyncStorage.multiRemove(['@concierge_token', '@concierge_user']);
    set({ token: null, user: null });
  },
}));
