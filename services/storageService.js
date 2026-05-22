import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';
import { calculateRisk } from './riskEngine';

const KEYS = {
  ONBOARDING: 'onboardingComplete',
  STREAK: 'streakCount',
};

const getProfileKey = (userId) => `userProfile_${userId}`;
const getCacheLogsKey = (userId) => `cache_logs_${userId}`;
const getPendingLogsKey = (userId) => `pending_logs_${userId}`;

export const formatDateKey = (date = new Date()) => {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const formatDateKeyWithPrefix = (date = new Date()) => {
  return `log_${formatDateKey(date)}`;
};

export const getTodayKey = () => formatDateKey(new Date());
export const getTodayKeyWithPrefix = () => formatDateKeyWithPrefix(new Date());

/**
 * Save daily log to Supabase and cache
 */
export const saveDailyLog = async (userId, logData, date = new Date()) => {
  if (!userId) return;

  const logDate = typeof date === 'string' ? date : formatDateKey(date);
  const log = {
    mood: logData.mood || logData.lifestyle?.mood || 5,
    energy: logData.energy || 5,
    fatigue: logData.fatigue || 5,
    dizziness: logData.symptoms?.dizziness ? 2 : 0, // Convert boolean to 0-3 scale
    headache: logData.symptoms?.headache ? 2 : 0,
    foods_consumed: JSON.stringify(logData.foods || {}),
    sleep_hours: logData.lifestyle?.sleep || 7,
    exercise_minutes: logData.exercise_minutes || 0,
  };

  try {
    // Try to upsert to Supabase
    const { error } = await supabase
      .from('daily_logs')
      .upsert(
        { user_id: userId, log_date: logDate, ...log },
        { onConflict: 'user_id,log_date' }
      );

    if (error) throw error;

    // Update cache
    const cached = await getLast30DaysLogsFromCache(userId);
    cached[logDate] = logData;
    await AsyncStorage.setItem(getCacheLogsKey(userId), JSON.stringify(cached));

    // Clear pending queue entry for this date
    const pending = await AsyncStorage.getItem(getPendingLogsKey(userId));
    if (pending) {
      const queue = JSON.parse(pending);
      delete queue[logDate];
      if (Object.keys(queue).length === 0) {
        await AsyncStorage.removeItem(getPendingLogsKey(userId));
      } else {
        await AsyncStorage.setItem(getPendingLogsKey(userId), JSON.stringify(queue));
      }
    }

    await calculateCurrentStreak(userId);
  } catch (err) {
    console.error('Error saving daily log:', err);
    // Queue for later sync
    const pending = await AsyncStorage.getItem(getPendingLogsKey(userId));
    const queue = pending ? JSON.parse(pending) : {};
    queue[logDate] = logData;
    await AsyncStorage.setItem(getPendingLogsKey(userId), JSON.stringify(queue));

    // Still update cache
    const cached = await getLast30DaysLogsFromCache(userId);
    cached[logDate] = logData;
    await AsyncStorage.setItem(getCacheLogsKey(userId), JSON.stringify(cached));
  }
};

/**
 * Get daily log by date
 */
export const getDailyLog = async (userId, date = new Date()) => {
  if (!userId) return null;

  const logDate = typeof date === 'string' ? date : formatDateKey(date);

  try {
    // Try Supabase first
    const { data, error } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('log_date', logDate)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = not found
      throw error;
    }

    if (data) {
      // Update cache
      const cached = await getLast30DaysLogsFromCache(userId);
      cached[logDate] = convertSupabaseLogToLocal(data);
      await AsyncStorage.setItem(getCacheLogsKey(userId), JSON.stringify(cached));
      return convertSupabaseLogToLocal(data);
    }
  } catch (err) {
    console.warn('Error fetching log from Supabase:', err);
  }

  // Fall back to cache
  const cached = await getLast30DaysLogsFromCache(userId);
  return cached[logDate] || null;
};

/**
 * Get logs for last N days with stale-while-revalidate pattern.
 * Returns cache immediately if available, then fetches fresh data in background.
 * Optional callback fires when fresh data arrives from Supabase.
 */
export const getLogs = async (userId, days = 7, onFreshData) => {
  if (!userId) return [];

  // Return cached logs immediately if available
  const cachedAll = await getLast30DaysLogsFromCache(userId);
  const cachedEntries = Object.entries(cachedAll)
    .filter(([, log]) => log) // Filter null entries
    .sort((a, b) => new Date(b[0]) - new Date(a[0]))
    .slice(0, days)
    .map(([date, log]) => ({ date, log }));

  if (cachedEntries.length > 0) {
    // Return cache immediately, then fetch fresh data in background
    setImmediate(async () => {
      try {
        const { data, error } = await supabase
          .from('daily_logs')
          .select('*')
          .eq('user_id', userId)
          .order('log_date', { ascending: false })
          .limit(Math.max(days, 30)); // Fetch extra to maintain cache

        if (error && error.code !== 'PGRST116') throw error;

        if (data && data.length > 0) {
          const freshLogs = data.map((d) => ({
            date: d.log_date,
            log: convertSupabaseLogToLocal(d),
          }));

          // Update cache
          const updated = await getLast30DaysLogsFromCache(userId);
          freshLogs.forEach(({ date, log }) => {
            updated[date] = log;
          });
          await AsyncStorage.setItem(getCacheLogsKey(userId), JSON.stringify(updated));
          onFreshData?.(freshLogs.slice(0, days));
        }
      } catch (err) {
        console.warn('Background logs fetch failed:', err);
      }
    });
    return cachedEntries;
  }

  // No cache: fetch from Supabase
  try {
    const { data, error } = await supabase
      .from('daily_logs')
      .select('*')
      .eq('user_id', userId)
      .order('log_date', { ascending: false })
      .limit(days);

    if (error && error.code !== 'PGRST116') throw error;

    if (data && data.length > 0) {
      const logs = data.map((d) => ({
        date: d.log_date,
        log: convertSupabaseLogToLocal(d),
      }));

      // Update cache
      const cached = await getLast30DaysLogsFromCache(userId);
      logs.forEach(({ date, log }) => {
        cached[date] = log;
      });
      await AsyncStorage.setItem(getCacheLogsKey(userId), JSON.stringify(cached));
      return logs;
    }
  } catch (err) {
    console.warn('Error fetching logs from Supabase:', err);
  }

  return [];
};

/**
 * Legacy function for backwards compatibility
 */
export const getLast7DaysLogs = async (userId) => {
  return getLogs(userId, 7);
};

/**
 * Convert Supabase log format to local format
 */
const convertSupabaseLogToLocal = (supabaseLog) => {
  return {
    mood: supabaseLog.mood,
    energy: supabaseLog.energy,
    fatigue: supabaseLog.fatigue,
    symptoms: {
      dizziness: supabaseLog.dizziness > 0,
      headache: supabaseLog.headache > 0,
      shortnessOfBreath: false,
      heartPalpitations: false,
      coldHandsFeet: false,
      paleAppearance: false,
    },
    foods: supabaseLog.foods_consumed ? JSON.parse(supabaseLog.foods_consumed) : {},
    lifestyle: {
      sleep: supabaseLog.sleep_hours,
    },
    exercise_minutes: supabaseLog.exercise_minutes,
  };
};

/**
 * Get cached logs from AsyncStorage (last 30 days)
 */
const getLast30DaysLogsFromCache = async (userId) => {
  const cached = await AsyncStorage.getItem(getCacheLogsKey(userId));
  return cached ? JSON.parse(cached) : {};
};

/**
 * Sync pending logs to Supabase when online
 */
export const syncPendingLogs = async (userId) => {
  if (!userId) return;

  const pending = await AsyncStorage.getItem(getPendingLogsKey(userId));
  if (!pending) return;

  const queue = JSON.parse(pending);
  const entries = Object.entries(queue);

  let syncedCount = 0;
  for (const [logDate, logData] of entries) {
    try {
      const log = {
        mood: logData.mood || logData.lifestyle?.mood || 5,
        energy: logData.energy || 5,
        fatigue: logData.fatigue || 5,
        dizziness: logData.symptoms?.dizziness ? 2 : 0,
        headache: logData.symptoms?.headache ? 2 : 0,
        foods_consumed: JSON.stringify(logData.foods || {}),
        sleep_hours: logData.lifestyle?.sleep || 7,
        exercise_minutes: logData.exercise_minutes || 0,
      };

      const { error } = await supabase
        .from('daily_logs')
        .upsert(
          { user_id: userId, log_date: logDate, ...log },
          { onConflict: 'user_id,log_date' }
        );

      if (error) throw error;
      syncedCount++;
    } catch (err) {
      console.error(`Error syncing log for ${logDate}:`, err);
    }
  }

  if (syncedCount === entries.length) {
    await AsyncStorage.removeItem(getPendingLogsKey(userId));
  }
};

/**
 * Streak calculation
 */
export const saveStreak = async (count) => {
  await AsyncStorage.setItem(KEYS.STREAK, String(count));
};

export const getStreak = async () => {
  const val = await AsyncStorage.getItem(KEYS.STREAK);
  return val ? parseInt(val, 10) : 0;
};

/**
 * Calculate current streak from logs
 */
export const calculateCurrentStreak = async (userId) => {
  if (!userId) return 0;

  const today = new Date();
  const todayLog = await getDailyLog(userId, today);

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayLog = await getDailyLog(userId, yesterday);

  let startOffset = 0;
  if (todayLog) {
    startOffset = 0;
  } else if (yesterdayLog) {
    startOffset = 1;
  } else {
    await saveStreak(0);
    return 0;
  }

  let streak = 0;
  for (let i = startOffset; i < 365; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const log = await getDailyLog(userId, d);
    if (log) {
      streak++;
    } else {
      break;
    }
  }
  await saveStreak(streak);
  return streak;
};

/**
 * Onboarding tracking (AsyncStorage only)
 */
export const setOnboardingComplete = async () => {
  await AsyncStorage.setItem(KEYS.ONBOARDING, 'true');
};

export const isOnboardingComplete = async () => {
  const val = await AsyncStorage.getItem(KEYS.ONBOARDING);
  return val === 'true';
};

/**
 * Clear ALL user data from AsyncStorage (logout/account switch)
 */
export const clearAllUserData = async (userId) => {
  if (!userId) return;

  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const keysToWipe = allKeys.filter(
      (k) =>
        k.startsWith('cache_') ||
        k.startsWith('pending_') ||
        k.startsWith('log_') || // Legacy keys from before Supabase
        k.startsWith('userProfile_') || // Legacy keys
        k === 'streakCount'
    );

    if (keysToWipe.length > 0) {
      await AsyncStorage.multiRemove(keysToWipe);
      console.log(`Cleared ${keysToWipe.length} AsyncStorage keys for user ${userId}`);
    }
  } catch (err) {
    console.error('Error clearing user data:', err);
  }
};

/**
 * Legacy profile functions (redirected to profileService)
 * Kept for backwards compatibility
 */
export const saveProfile = async (userId, profile) => {
  if (!userId) return;
  await AsyncStorage.setItem(getProfileKey(userId), JSON.stringify(profile));
};

export const getProfile = async (userId) => {
  if (!userId) return null;
  const data = await AsyncStorage.getItem(getProfileKey(userId));
  return data ? JSON.parse(data) : null;
};

/**
 * Legacy daily log functions (backwards compatibility for old key format)
 */
export const saveDailyLogLegacy = async (date, log) => {
  const key = typeof date === 'string' && date.startsWith('log_')
    ? date
    : formatDateKeyWithPrefix(date);
  await AsyncStorage.setItem(key, JSON.stringify(log));
};

export const getDailyLogLegacy = async (date) => {
  const key = typeof date === 'string' && date.startsWith('log_')
    ? date
    : formatDateKeyWithPrefix(date);
  const data = await AsyncStorage.getItem(key);
  return data ? JSON.parse(data) : null;
};
