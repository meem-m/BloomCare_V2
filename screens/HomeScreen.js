import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import StatCard from '../components/StatCard';
import MythCard from '../components/MythCard';
import {
  getDailyLog,
  formatDateKey,
  getStreak,
  getLogs,
} from '../services/storageService';
import { getProfile as getProfileFromService } from '../services/profileService';
import { calculateWeeklyRisk } from '../services/riskEngine';
import { supabase } from '../services/supabase';
import { getMythOfTheDay } from '../data/myths';
import { globalStyles } from '../constants/styles';
import { useTheme } from '../contexts/ThemeContext';

const MOOD_EMOJIS = { 1: '😢', 2: '😔', 3: '😐', 4: '🙂', 5: '😄' };

export default function HomeScreen({ navigation }) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [profile, setProfile] = useState(null);
  const [todayLog, setTodayLog] = useState(null);
  const [risk, setRisk] = useState(null);
  const [logCount, setLogCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isRefreshingBg, setIsRefreshingBg] = useState(false);

  const loadData = async () => {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.warn('HomeScreen: no auth user', userError?.message);
        setLoading(false);
        navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
        return;
      }

      const initialProfile = await getProfileFromService(user.id);
      console.log('DEBUG profile:', JSON.stringify(initialProfile));
      if (!initialProfile) {
        setLoading(false);
        navigation.reset({
          index: 0,
          routes: [{ name: 'ProfileSetup', params: { mode: 'create' } }],
        });
        return;
      }

      setProfile(initialProfile);

      const today = new Date();
      const todayLogData = await getDailyLog(user.id, today);
      setTodayLog(todayLogData);

      setIsRefreshingBg(true);
      await Promise.all([
        getProfileFromService(user.id, (freshProfile) => {
          setProfile(freshProfile);
        }),
        getLogs(user.id, 7, (freshLogs) => {
          const validLogs = freshLogs
            .map((entry) => entry.log || entry)
            .filter(Boolean);
          setLogCount(validLogs.length);
          if (validLogs.length >= 7 && initialProfile) {
            const freshRisk = calculateWeeklyRisk(validLogs, initialProfile);
            setRisk(freshRisk);
          }
        }),
      ]);
      setIsRefreshingBg(false);

      const allLogs = (await getLogs(user.id, 7)) || [];
      const validLogs = allLogs
        .map((entry) => entry.log || entry)
        .filter(Boolean);

      let r = null;
      if (validLogs.length >= 7) {
        try {
          r = calculateWeeklyRisk(validLogs, initialProfile);
        } catch (e) {
          console.warn('calculateWeeklyRisk failed:', e?.message);
        }
      }

      let s = 0;
      try {
        s = await getStreak();
      } catch (e) {
        console.warn('getStreak failed:', e?.message);
      }

      setRisk(r);
      setLogCount(validLogs.length);
      setStreak(s);
    } catch (err) {
      console.error('Error loading home data:', err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { marginTop: 12 }]}>Loading your data...</Text>
      </View>
    );
  }

  const today = new Date().toLocaleDateString('en-PK', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const myth = getMythOfTheDay();
  const firstName =
    (profile?.fullName || profile?.name || '').split(' ')[0] || 'Sister';

  const renderRiskCard = () => {
    if (logCount === 0) {
      return (
        <View style={[styles.riskCard, styles.welcomeCard]}>
          <Ionicons name="sparkles-outline" size={28} color={theme.textSecondary} />
          <Text style={styles.riskTitle}>Welcome to BloomCare</Text>
          <Text style={styles.riskSubtitle}>Log your first day to get started</Text>
        </View>
      );
    }

    if (logCount < 7) {
      const progress = (logCount / 7) * 100;
      const daysRemaining = 7 - logCount;
      return (
        <View style={[styles.riskCard, styles.progressCard]}>
          <Text style={styles.riskTitle}>Building your health profile</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressMeta}>{logCount}/7 days logged</Text>
          <Text style={styles.progressSubtitle}>
            {daysRemaining} more {daysRemaining === 1 ? 'day' : 'days'} until your first risk insight
          </Text>
        </View>
      );
    }

    return (
      <View
        style={[
          styles.riskCard,
          {
            backgroundColor: `${risk?.color || theme.success}18`,
            borderColor: risk?.color || theme.success,
          },
        ]}
      >
        <Text style={styles.riskLabel}>Weekly Risk Level</Text>
        <View style={[styles.levelBadge, { backgroundColor: risk?.color || theme.success }]}>
          <Text style={styles.levelBadgeText}>{risk?.level || 'Low'}</Text>
        </View>
        <Text style={styles.riskSubtitle}>Based on your last 7 days</Text>
      </View>
    );
  };

  return (
    <ScrollView
      style={[globalStyles.container, { backgroundColor: theme.background }]}
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.greeting}>Assalam o Alaikum, {firstName} 👋</Text>
      <Text style={styles.date}>{today}</Text>

      <View style={styles.block}>{renderRiskCard()}</View>

      <View style={styles.statsRow}>
        <StatCard
          emoji="💧"
          label="Water"
          value={todayLog ? `${todayLog.lifestyle?.water ?? 0} glasses` : '-'}
        />
        <StatCard
          emoji="⚡"
          label="Energy"
          value={todayLog ? `${todayLog.energy ?? '-'}/10` : '-'}
        />
        <StatCard
          emoji="😊"
          label="Mood"
          value={
            todayLog
              ? MOOD_EMOJIS[todayLog.lifestyle?.mood ?? todayLog.mood] || '😐'
              : '-'
          }
        />
      </View>

      <TouchableOpacity
        style={[
          globalStyles.primaryButton,
          { backgroundColor: theme.primary },
          styles.block,
        ]}
        onPress={() => navigation.navigate('Tracking')}
      >
        <Text style={globalStyles.primaryButtonText}>Log Today 📋</Text>
      </TouchableOpacity>

      <View style={[globalStyles.card, styles.block]}>
        <Text style={styles.streakText}>🔥 {streak} day streak</Text>
        <Text style={globalStyles.bodyText}>
          Keep logging daily to track your health patterns!
        </Text>
      </View>

      <Text style={styles.sectionTitle}>💡 Myth of the Day</Text>
      <View style={styles.block}>
        <MythCard myth={myth} compact />
      </View>
    </ScrollView>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.background,
  },
  centerContent: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: theme.textSecondary,
    fontSize: 14,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  greeting: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 16,
  },
  date: {
    fontSize: 13,
    color: theme.textSecondary,
    marginBottom: 16,
  },
  block: {
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  streakText: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.primary,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 16,
  },
  riskCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
    padding: 20,
    alignItems: 'center',
  },
  welcomeCard: {
    backgroundColor: theme.card,
    borderColor: theme.border,
  },
  progressCard: {
    borderColor: theme.warning || '#F39C12',
    backgroundColor: theme.primaryLight || '#FFF6EA',
    alignItems: 'flex-start',
  },
  riskLabel: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  riskTitle: {
    marginTop: 10,
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
    textAlign: 'center',
  },
  riskSubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
  },
  progressTrack: {
    marginTop: 14,
    height: 10,
    width: '100%',
    borderRadius: 999,
    backgroundColor: theme.border,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: theme.primary,
  },
  progressMeta: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '600',
    color: theme.warning || '#F39C12',
  },
  progressSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: theme.textSecondary,
  },
  levelBadge: {
    marginTop: 10,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  levelBadgeText: {
    color: theme.white,
    fontSize: 14,
    fontWeight: '700',
  },
});