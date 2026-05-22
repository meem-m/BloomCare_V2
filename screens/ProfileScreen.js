import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Switch,
  Alert,
  Linking,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { getProfile as getProfileFromService } from '../services/profileService';
import { getLogs } from '../services/storageService';
import { calculateWeeklyRisk } from '../services/riskEngine';
import { useTheme, themes } from '../contexts/ThemeContext';

const DISCLAIMER_TEXT = `BloomCare is a health tracking and education tool designed for awareness purposes only. It does NOT provide medical diagnosis, treatment, or professional healthcare advice.

The anemia risk score is calculated from self-reported daily logs and is an estimate, not a clinical test result. Always consult a qualified doctor for blood tests (hemoglobin, ferritin, CBC) and proper treatment.

If you experience severe symptoms such as fainting, chest pain, or extreme shortness of breath, seek emergency medical care immediately.

By using this app, you acknowledge that BloomCare and its developers are not liable for any health decisions made based on app data.`;

export default function ProfileScreen({ navigation }) {
  const { theme, themeName, setTheme } = useTheme();
  const styles = createStyles(theme);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [streak, setStreak] = useState(0);
  const [totalLogs, setTotalLogs] = useState(0);
  const [weeklyRisk, setWeeklyRisk] = useState(null);
  const [notifications, setNotifications] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [weekStartsOn, setWeekStartsOn] = useState('Monday');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        console.warn('No authenticated user on Profile screen', userError);
        setLoading(false);
        return;
      }

      setEmail(user.email || '');

      // Load initial data in parallel
      const initialProfile = await getProfileFromService(user.id);
      const initialLogs = (await getLogs(user.id, 30)) || [];
      
      setProfile(initialProfile);

      // Compute streak from initial logs
      const dates = new Set(
        initialLogs
          .map((l) => l.log_date || l.date)
          .filter(Boolean)
      );
      let s = 0;
      const today = new Date();
      for (let i = 0; i < 30; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const iso = d.toISOString().split('T')[0];
        if (dates.has(iso)) s++;
        else break;
      }
      setStreak(s);
      setTotalLogs(initialLogs.length);

      // Compute initial weekly risk if available
      if (initialLogs.length >= 7 && initialProfile) {
        try {
          const last7 = initialLogs.slice(0, 7);
          const risk = calculateWeeklyRisk(last7, initialProfile);
          setWeeklyRisk(risk);
        } catch (e) {
          console.warn('Initial calculateWeeklyRisk failed:', e?.message);
        }
      }

      // Refresh in background with stale-while-revalidate pattern
      Promise.all([
        getProfileFromService(user.id, (freshProfile) => {
          setProfile(freshProfile);
        }),
        getLogs(user.id, 30, (freshLogs) => {
          const freshDates = new Set(
            freshLogs
              .map((l) => l.log_date || l.date)
              .filter(Boolean)
          );
          let freshStreak = 0;
          const today = new Date();
          for (let i = 0; i < 30; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() - i);
            const iso = d.toISOString().split('T')[0];
            if (freshDates.has(iso)) freshStreak++;
            else break;
          }
          setStreak(freshStreak);
          setTotalLogs(freshLogs.length);

          if (freshLogs.length >= 7 && initialProfile) {
            try {
              const freshLast7 = freshLogs.slice(0, 7);
              const freshRisk = calculateWeeklyRisk(freshLast7, initialProfile);
              setWeeklyRisk(freshRisk);
            } catch (e) {
              console.warn('Background calculateWeeklyRisk failed:', e?.message);
            }
          }
        }),
      ]).catch((err) => {
        console.warn('Background refresh failed:', err?.message);
      });
    } catch (err) {
      console.error('Error loading profile data:', err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const fullName = profile?.fullName || profile?.name || 'BloomCare User';
  const initials = fullName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const changeWeekStart = async (value) => {
    setWeekStartsOn(value);
    await AsyncStorage.setItem('weekStartsOn', value);
  };

  const handleChangePassword = async () => {
    if (!email) {
      Alert.alert('Unavailable', 'No email found for your account.');
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) {
      Alert.alert('Error', error.message);
      return;
    }
    Alert.alert('Password Reset Sent', `A reset email has been sent to ${email}.`);
  };

  const handleDeleteAccount = async () => {
    setShowDeleteConfirm(false);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.id) {
        // Clear local caches
        const allKeys = await AsyncStorage.getAllKeys();
        const userKeys = allKeys.filter((key) =>
          key.includes(user.id) ||
          key.startsWith('cache_') ||
          key.startsWith('pending_') ||
          key === 'streakCount'
        );
        if (userKeys.length) await AsyncStorage.multiRemove(userKeys);
      }
      await supabase.auth.signOut();
      navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
    } catch (e) {
      Alert.alert('Error', 'Could not complete delete. Please try again.');
    }
  };

  // ---------- Render states ----------

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={styles.loaderText}>Loading profile...</Text>
      </View>
    );
  }

  // No profile row exists yet — route the user to setup
  if (!profile) {
    return (
      <View style={styles.loaderWrap}>
        <Ionicons name="person-add-outline" size={48} color={theme.primary} />
        <Text style={[styles.loaderText, { marginTop: 12, fontSize: 16 }]}>
          No profile found
        </Text>
        <Text style={[styles.loaderText, { marginBottom: 16, textAlign: 'center', paddingHorizontal: 24 }]}>
          Set up your health profile to start tracking
        </Text>
        <TouchableOpacity
          style={{
            backgroundColor: theme.primary,
            paddingHorizontal: 24,
            paddingVertical: 12,
            borderRadius: 10,
            marginBottom: 12,
          }}
          onPress={() => navigation.navigate('ProfileSetup', { mode: 'create' })}
        >
          <Text style={{ color: theme.white, fontWeight: '600' }}>Set up profile</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={async () => {
            await supabase.auth.signOut();
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          }}
        >
          <Text style={{ color: theme.textSecondary, fontSize: 13 }}>Log out instead</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const Row = ({ icon, title, subtitle, onPress, danger, right }) => (
    <TouchableOpacity style={styles.row} onPress={onPress} disabled={!onPress}>
      <View style={styles.rowLeft}>
        <Ionicons name={icon} size={20} color={danger ? theme.danger : theme.primary} />
        <View style={styles.rowTextWrap}>
          <Text style={[styles.rowTitle, danger && { color: theme.danger }]}>{title}</Text>
          {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {right || <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />}
    </TouchableOpacity>
  );

  // Support both old (height/weight) and new (height_cm/weight_kg) field names
  const heightDisplay = profile?.height_cm ?? profile?.height ?? '-';
  const weightDisplay = profile?.weight_kg ?? profile?.weight ?? '-';

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials || '?'}</Text>
        </View>
        <Text style={styles.name}>{fullName}</Text>
        <Text style={styles.email}>{email || 'No email available'}</Text>

        <View style={styles.metricsRow}>
          <View style={styles.metricPill}><Text style={styles.metricText}>Age: {profile?.age ?? '-'}</Text></View>
          <View style={styles.metricPill}><Text style={styles.metricText}>{heightDisplay} cm</Text></View>
          <View style={styles.metricPill}><Text style={styles.metricText}>{weightDisplay} kg</Text></View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Today's Status</Text>
        {weeklyRisk ? (
          <View style={[styles.riskBadge, { backgroundColor: `${weeklyRisk.color}22`, borderColor: weeklyRisk.color }]}>
            <Text style={[styles.riskText, { color: weeklyRisk.color }]}>{weeklyRisk.level}</Text>
          </View>
        ) : (
          <View style={[styles.riskBadge, { backgroundColor: `${theme.warning}22`, borderColor: theme.warning }]}>
            <Text style={[styles.riskText, { color: theme.warning }]}>
              {totalLogs < 7 ? `Need ${7 - totalLogs} more day${7 - totalLogs === 1 ? '' : 's'}` : 'Building profile'}
            </Text>
          </View>
        )}
        <Text style={styles.statLine}>🔥 {streak} day streak</Text>
        <Text style={styles.statLine}>📊 {totalLogs} days logged (last 30)</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Personal Info</Text>
        <TouchableOpacity
          style={styles.editInfoCard}
          onPress={() => navigation.navigate('ProfileSetup', { mode: 'edit' })}
        >
          <Ionicons name="create-outline" size={20} color={theme.primary} />
          <Text style={styles.editInfoText}>Edit Personal Info</Text>
          <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <Row
          icon="color-palette-outline"
          title="Theme"
          onPress={() => setShowThemeModal(true)}
          right={<View style={styles.rowRightWrap}><Text style={styles.rowRightText}>{themeName}</Text><Ionicons name="chevron-forward" size={18} color={theme.textSecondary} /></View>}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <Ionicons name="notifications-outline" size={20} color={theme.primary} />
            <Text style={styles.rowTitle}>Daily reminder</Text>
          </View>
          <Switch
            value={notifications}
            onValueChange={setNotifications}
            trackColor={{ true: theme.primaryLight, false: theme.border }}
            thumbColor={notifications ? theme.primary : theme.textSecondary}
          />
        </View>

        <View style={[styles.row, styles.disabledRow]}>
          <View style={styles.rowLeft}>
            <Ionicons name="language-outline" size={20} color={theme.textSecondary} />
            <Text style={[styles.rowTitle, { color: theme.textSecondary }]}>Language</Text>
          </View>
          <Text style={styles.rowSubtitle}>English</Text>
        </View>

        <View style={styles.weekWrap}>
          <View style={styles.rowLeft}>
            <Ionicons name="calendar-outline" size={20} color={theme.primary} />
            <Text style={styles.rowTitle}>Week starts on</Text>
          </View>
          <View style={styles.segmentWrap}>
            {['Monday', 'Sunday'].map((day) => (
              <TouchableOpacity
                key={day}
                style={[
                  styles.segment,
                  weekStartsOn === day && { backgroundColor: theme.primary, borderColor: theme.primary },
                ]}
                onPress={() => changeWeekStart(day)}
              >
                <Text style={[styles.segmentText, weekStartsOn === day && { color: theme.white }]}>{day}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>About</Text>
        <Row icon="information-circle-outline" title="About BloomCare" onPress={() => setShowAbout(true)} />
        <Row icon="warning-outline" title="Medical Disclaimer" onPress={() => setShowDisclaimer(true)} />
        <Row icon="mail-outline" title="Contact / Feedback" onPress={() => Linking.openURL('mailto:bloomcare.app@gmail.com')} />
        <Row icon="star-outline" title="Rate BloomCare" onPress={() => Alert.alert('Coming Soon', 'Coming soon to Play Store')} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Account</Text>
        <Row icon="lock-closed-outline" title="Change Password" onPress={handleChangePassword} />
        <Row
          icon="log-out-outline"
          title="Logout"
          onPress={async () => {
            await supabase.auth.signOut();
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          }}
        />
        <Row
          icon="trash-outline"
          title="Sign Out & Clear Local Data"
          danger
          onPress={() => setShowDeleteConfirm(true)}
          right={<Ionicons name="chevron-forward" size={18} color={theme.danger} />}
        />
      </View>

      <Modal visible={showThemeModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choose Theme</Text>
            {Object.keys(themes).map((name) => (
              <TouchableOpacity
                key={name}
                style={[styles.themeOption, themeName === name && { borderColor: theme.primary }]}
                onPress={async () => {
                  await setTheme(name);
                  setShowThemeModal(false);
                }}
              >
                <Text style={styles.themeName}>{name}</Text>
                <View style={styles.swatchRow}>
                  <View style={[styles.swatch, { backgroundColor: themes[name].primary }]} />
                  <View style={[styles.swatch, { backgroundColor: themes[name].background, borderWidth: 1, borderColor: themes[name].border }]} />
                  <View style={[styles.swatch, { backgroundColor: themes[name].card, borderWidth: 1, borderColor: themes[name].border }]} />
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowThemeModal(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showAbout} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>About BloomCare</Text>
            <Text style={styles.modalBody}>Version 1.0.0</Text>
            <Text style={styles.modalBody}>Made for Pakistani women.</Text>
            <Text style={styles.modalBody}>Final Year Project (FYP).</Text>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowAbout(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showDisclaimer} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Medical Disclaimer</Text>
            <ScrollView style={{ maxHeight: 320 }}>
              <Text style={styles.modalBody}>{DISCLAIMER_TEXT}</Text>
            </ScrollView>
            <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowDisclaimer(false)}>
              <Text style={styles.modalCloseText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showDeleteConfirm} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Clear Local Data?</Text>
            <Text style={styles.modalBody}>
              This will sign you out and clear all locally cached data on this device. Your account data in the cloud will be preserved. To permanently delete your account, contact support.
            </Text>
            <View style={styles.deleteActions}>
              <TouchableOpacity style={styles.cancelDeleteBtn} onPress={() => setShowDeleteConfirm(false)}>
                <Text style={styles.cancelDeleteText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmDeleteBtn} onPress={handleDeleteAccount}>
                <Text style={styles.confirmDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const createStyles = (theme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  content: { padding: 16, paddingBottom: 40 },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.background,
    paddingHorizontal: 24,
  },
  loaderText: { color: theme.textSecondary, fontSize: 14, marginTop: 8 },
  card: {
    backgroundColor: theme.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  avatar: {
    width: 64, height: 64, borderRadius: 32, alignSelf: 'center',
    alignItems: 'center', justifyContent: 'center', backgroundColor: theme.primaryLight,
  },
  avatarText: { fontSize: 22, fontWeight: '700', color: theme.primary },
  name: { marginTop: 10, fontSize: 20, fontWeight: '700', color: theme.textPrimary, textAlign: 'center' },
  email: { marginTop: 4, fontSize: 14, color: theme.textSecondary, textAlign: 'center' },
  metricsRow: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  metricPill: { flex: 1, borderRadius: 999, backgroundColor: theme.primaryLight, paddingVertical: 7, alignItems: 'center' },
  metricText: { fontSize: 12, color: theme.primary, fontWeight: '600' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: theme.textPrimary, marginBottom: 10 },
  riskBadge: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'flex-start', marginBottom: 10 },
  riskText: { fontSize: 12, fontWeight: '700' },
  statLine: { fontSize: 14, color: theme.textPrimary, marginBottom: 6 },
  editInfoCard: {
    backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 14, flexDirection: 'row', alignItems: 'center',
  },
  editInfoText: { flex: 1, marginLeft: 10, fontSize: 16, fontWeight: '500', color: theme.textPrimary },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.border },
  rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  rowTextWrap: { marginLeft: 10, flex: 1 },
  rowTitle: { fontSize: 15, color: theme.textPrimary },
  rowSubtitle: { fontSize: 13, color: theme.textSecondary },
  rowRightWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowRightText: { fontSize: 14, color: theme.textSecondary },
  disabledRow: { opacity: 0.7 },
  weekWrap: { paddingTop: 12 },
  segmentWrap: { marginTop: 10, flexDirection: 'row', gap: 8 },
  segment: { borderWidth: 1, borderColor: theme.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: theme.background },
  segmentText: { color: theme.textPrimary, fontSize: 13, fontWeight: '500' },
  modalOverlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 22 },
  modalCard: { borderRadius: 16, backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, padding: 18 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: theme.textPrimary, marginBottom: 10 },
  modalBody: { fontSize: 14, color: theme.textSecondary, lineHeight: 20, marginBottom: 8 },
  themeOption: { borderWidth: 1, borderColor: theme.border, borderRadius: 12, padding: 12, marginBottom: 10 },
  themeName: { fontSize: 15, fontWeight: '600', color: theme.textPrimary, marginBottom: 8 },
  swatchRow: { flexDirection: 'row', gap: 8 },
  swatch: { width: 30, height: 18, borderRadius: 6 },
  modalCloseBtn: { marginTop: 8, borderRadius: 10, paddingVertical: 10, alignItems: 'center', backgroundColor: theme.primary },
  modalCloseText: { color: theme.white, fontWeight: '600', fontSize: 14 },
  deleteActions: { marginTop: 14, flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  cancelDeleteBtn: { flex: 1, alignItems: 'center', borderRadius: 10, borderWidth: 1, borderColor: theme.border, paddingVertical: 10 },
  cancelDeleteText: { color: theme.textPrimary, fontSize: 14, fontWeight: '600' },
  confirmDeleteBtn: { flex: 1, alignItems: 'center', borderRadius: 10, backgroundColor: theme.danger, paddingVertical: 10 },
  confirmDeleteText: { color: theme.white, fontSize: 14, fontWeight: '700' },
});