import { useEffect, useState } from 'react';
import { useUserStore } from '../stores/useUserStore';
import { userService } from '../services/api/user.service';

export const useSessionBootstrap = (enabled = true) => {
  const login = useUserStore((state) => state.login);
  const logout = useUserStore((state) => state.logout);
  const [checked, setChecked] = useState(!enabled);

  useEffect(() => {
    if (!enabled) {
      setChecked(true);
      return;
    }

    let mounted = true;
    setChecked(false);

    const run = async () => {
      try {
        const response = await userService.validateSession();
        if (!mounted) return;

        if (response.success && response.data?.valid && response.data.user) {
          const user = response.data.user as any;
          login(user as any, (user as any).preferences);
        } else if (response.success && response.data?.valid === false) {
          logout();
        } else if (!response.success && response.error?.code !== 'NETWORK_ERROR') {
          logout();
        }
      } catch {
        // Network or unexpected error: keep local state, just unblock rendering.
      } finally {
        if (mounted) {
          setChecked(true);
        }
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [enabled, login, logout]);

  return { checked };
};
