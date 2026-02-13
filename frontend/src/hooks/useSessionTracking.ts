import { useEffect, useRef } from 'react';
import { useUserStore } from '../stores/useUserStore';
import { userService } from '../services/api/user.service';

/**
 * Track time spent on the website
 * Updates user stats with session duration and current session time
 */
const getDateKey = (date: Date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const dailyKeyForUser = (userId: string, dateKey: string) => `usage_time_${userId}_${dateKey}`;
const totalKeyForUser = (userId: string) => `usage_time_total_${userId}`;

const readStoredMinutes = (key: string) => {
  if (typeof localStorage === 'undefined') return 0;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return 0;
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'number') return parsed;
    if (typeof parsed?.minutes === 'number') return parsed.minutes;
    return 0;
  } catch {
    return 0;
  }
};

const writeStoredMinutes = (key: string, minutes: number) => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(key, JSON.stringify({ minutes, updatedAt: new Date().toISOString() }));
};

export const useSessionTracking = () => {
  const { profile, updateProfile } = useUserStore();
  const sessionStartRef = useRef<Date>(new Date());
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentDayRef = useRef<string>(getDateKey());
  const lastTickRef = useRef<number>(Date.now());
  const statsRef = useRef(profile.stats);
  const syncInFlightRef = useRef(false);
  const lastSyncedRef = useRef<{ dateKey: string; minutes: number; totalMinutes: number } | null>(null);

  useEffect(() => {
    statsRef.current = profile.stats;
  }, [profile.stats]);

  useEffect(() => {
    if (!profile.id) {
      return undefined;
    }

    const syncUsageToServer = async (dateKey: string, minutes: number, totalMinutes: number) => {
      if (!profile.id) return;
      if (syncInFlightRef.current) return;
      const lastSynced = lastSyncedRef.current;
      if (
        lastSynced &&
        lastSynced.dateKey === dateKey &&
        lastSynced.minutes === minutes &&
        lastSynced.totalMinutes === totalMinutes
      ) {
        return;
      }

      syncInFlightRef.current = true;
      try {
        await userService.updateProfile({
          preferences: {
            usageTime: {
              date: dateKey,
              minutes,
              totalMinutes,
              updatedAt: new Date().toISOString(),
            },
          },
        });
        lastSyncedRef.current = { dateKey, minutes, totalMinutes };
      } catch {
        // Best-effort sync; ignore transient errors.
      } finally {
        syncInFlightRef.current = false;
      }
    };

    // Record session start
    sessionStartRef.current = new Date();
    currentDayRef.current = getDateKey(sessionStartRef.current);
    lastTickRef.current = sessionStartRef.current.getTime();

    const dailyKey = dailyKeyForUser(profile.id, currentDayRef.current);
    const totalKey = totalKeyForUser(profile.id);
    const storedDaily = readStoredMinutes(dailyKey);
    const storedTotal = readStoredMinutes(totalKey);
    const normalizedDaily = Math.max(statsRef.current.timeSpentToday || 0, storedDaily);
    const normalizedTotal = Math.max(statsRef.current.totalTimeSpent || 0, storedTotal);

    if (
      normalizedDaily !== (statsRef.current.timeSpentToday || 0) ||
      normalizedTotal !== (statsRef.current.totalTimeSpent || 0)
    ) {
      const nextStats = {
        ...statsRef.current,
        timeSpentToday: normalizedDaily,
        totalTimeSpent: normalizedTotal,
      };
      statsRef.current = nextStats;
      updateProfile({ stats: nextStats });
    }

    writeStoredMinutes(dailyKey, normalizedDaily);
    writeStoredMinutes(totalKey, normalizedTotal);
    syncUsageToServer(currentDayRef.current, normalizedDaily, normalizedTotal);

    // Update time spent every minute
    updateIntervalRef.current = setInterval(() => {
      if (!profile.id) return;

      const now = new Date();
      const todayKey = getDateKey(now);

      if (todayKey !== currentDayRef.current) {
        currentDayRef.current = todayKey;
        const newDailyKey = dailyKeyForUser(profile.id, todayKey);
        const resetDaily = readStoredMinutes(newDailyKey);
        const baseTotal = Math.max(
          statsRef.current.totalTimeSpent || 0,
          readStoredMinutes(totalKeyForUser(profile.id))
        );

        const nextStats = {
          ...statsRef.current,
          timeSpentToday: resetDaily,
          totalTimeSpent: baseTotal,
          lastActivityAt: now.toISOString(),
        };
        statsRef.current = nextStats;
        updateProfile({ stats: nextStats });

        writeStoredMinutes(newDailyKey, resetDaily);
        writeStoredMinutes(totalKeyForUser(profile.id), baseTotal);
        syncUsageToServer(todayKey, resetDaily, baseTotal);
        lastTickRef.current = now.getTime();
        return;
      }

      const elapsedMinutes = Math.max(
        1,
        Math.floor((now.getTime() - lastTickRef.current) / 1000 / 60)
      );
      lastTickRef.current = now.getTime();

      const dailyMinutes = Math.max(
        statsRef.current.timeSpentToday || 0,
        readStoredMinutes(dailyKeyForUser(profile.id, todayKey))
      );
      const totalMinutes = Math.max(
        statsRef.current.totalTimeSpent || 0,
        readStoredMinutes(totalKeyForUser(profile.id))
      );

      const nextDaily = dailyMinutes + elapsedMinutes;
      const nextTotal = totalMinutes + elapsedMinutes;

      // Update profile stats
      const nextStats = {
        ...statsRef.current,
        timeSpentToday: nextDaily,
        totalTimeSpent: nextTotal,
        lastActivityAt: now.toISOString(),
      };
      statsRef.current = nextStats;
      updateProfile({ stats: nextStats });

      writeStoredMinutes(dailyKeyForUser(profile.id, todayKey), nextDaily);
      writeStoredMinutes(totalKeyForUser(profile.id), nextTotal);
      syncUsageToServer(todayKey, nextDaily, nextTotal);
    }, 60000); // Every 60 seconds

    // Handle page unload - save final session time
    const handleBeforeUnload = () => {
      if (!profile.id) return;
      const now = new Date();
      const todayKey = getDateKey(now);
      const dailyKey = dailyKeyForUser(profile.id, todayKey);
      const totalKey = totalKeyForUser(profile.id);

      const dailyMinutes = Math.max(
        statsRef.current.timeSpentToday || 0,
        readStoredMinutes(dailyKey)
      );
      const totalMinutes = Math.max(
        statsRef.current.totalTimeSpent || 0,
        readStoredMinutes(totalKey)
      );

      writeStoredMinutes(dailyKey, dailyMinutes);
      writeStoredMinutes(totalKey, totalMinutes);
      syncUsageToServer(todayKey, dailyMinutes, totalMinutes);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [profile.id, updateProfile]);

  return {
    sessionStart: sessionStartRef.current,
    sessionDuration: Math.floor(
      (new Date().getTime() - sessionStartRef.current.getTime()) / 1000 / 60
    )
  };
};
