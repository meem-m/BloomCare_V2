import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';
import { isOnboardingComplete, getLogs } from '../services/storageService';
import { getProfile, clearProfileCache } from '../services/profileService';
import { useTheme } from '../contexts/ThemeContext';

export default function SplashScreen({ navigation }) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  useEffect(() => {
    const init = async () => {
      await new Promise((r) => setTimeout(r, 1500));

      // 1. Onboarding check
      let onboardingDone = false;
      try {
        onboardingDone = await isOnboardingComplete();
      } catch (e) {
        console.warn('Onboarding check failed:', e?.message);
      }

      if (!onboardingDone) {
        navigation.replace('Onboarding');
        return;
      }

      // 2. Session check
      let session = null;
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('getSession error:', error.message);
          await supabase.auth.signOut().catch(() => {});
        } else {
          session = data?.session;
        }
      } catch (e) {
        console.warn('Session fetch threw:', e?.message);
        await supabase.auth.signOut().catch(() => {});
      }

      if (!session?.user?.id) {
        navigation.replace('Login');
        return;
      }

      const userId = session.user.id;

      // 3. Profile check
      let profile = null;
      try {
        profile = await getProfile(userId);
      } catch (e) {
        console.warn('Profile fetch attempt 1 failed:', e?.message);
      }

      if (!profile) {
        await new Promise((r) => setTimeout(r, 800));
        try {
          profile = await getProfile(userId);
        } catch (e) {
          console.warn('Profile fetch attempt 2 failed:', e?.message);
        }
      }

      if (profile && !profile.name) {
        profile = null;
      }

      if (!profile) {
        await clearProfileCache(userId);
      }

      // Pre-warm logs cache in background
      getLogs(userId, 7).catch((err) => {
        console.warn('Background cache warm failed:', err?.message);
      });

      if (profile) {
        navigation.replace('Main');
      } else {
        navigation.replace('ProfileSetup', {
          fullName: session.user?.user_metadata?.full_name || '',
          mode: 'create',
        });
      }
    };

    init().catch((e) => {
      console.error('Splash init fatal:', e);
      navigation.replace('Login');
    });
  }, [navigation]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <Text style={styles.logo}>🌸</Text>
        <Text style={styles.title}>BloomCare</Text>
        <Text style={styles.tagline}>Your Health, Your Power</Text>
        <ActivityIndicator
          size="large"
          color={theme.primary}
          style={styles.loader}
        />
      </View>
    </SafeAreaView>
  );
}

const createStyles = (theme) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.background },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.background,
  },
  logo: { fontSize: 80, marginBottom: 16 },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.primary,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  loader: { marginTop: 40 },
});