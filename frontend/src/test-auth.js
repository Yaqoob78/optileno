// Test script to manually authenticate user for testing
import { useUserStore } from './stores/useUserStore';

// Set user as authenticated for testing
const store = useUserStore.getState();
store.setProfile({
  ...store.profile,
  email: 'khan011504@gmail.com',
  role: 'premium',
  planType: 'ULTRA',
  subscription: {
    tier: 'elite',
    expiresAt: null,
    features: []
  },
  stats: {
    ...store.profile.stats,
    joinedAt: new Date().toISOString()
  }
});

store.setIsAuthenticated(true);

console.log('✅ User set as authenticated for testing');
console.log('Profile:', store.getProfile());
