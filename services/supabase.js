import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Catch the "Refresh Token Not Found" / invalid token errors globally
// and silently clear the dead session so the app routes to Login instead of crashing.
supabase.auth.onAuthStateChange(async (event, session) => {
  if (event === 'TOKEN_REFRESHED' && !session) {
    // Refresh failed → wipe stored session
    supabase.auth.signOut().catch(() => {});
  }

  if (event === 'SIGNED_OUT') {
    // User signed out: clear all local AsyncStorage data to prevent data leakage
    // to the next user who signs in
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const keysToWipe = allKeys.filter(
        (k) =>
          k.startsWith('cache_') ||
          k.startsWith('pending_') ||
          k.startsWith('log_') || // Legacy keys
          k.startsWith('userProfile_') || // Legacy keys
          k === 'streakCount'
      );
      if (keysToWipe.length > 0) {
        await AsyncStorage.multiRemove(keysToWipe);
      }
    } catch (err) {
      console.error('Error clearing AsyncStorage on sign out:', err);
    }
  }
});

// Safe wrapper to use anywhere we need the current user
export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) {
      // Invalid refresh token, expired, etc.
      if (error.message?.toLowerCase().includes('refresh') ||
          error.message?.toLowerCase().includes('jwt') ||
          error.message?.toLowerCase().includes('session')) {
        await supabase.auth.signOut().catch(() => {});
      }
      return null;
    }
    return user;
  } catch (e) {
    return null;
  }
};