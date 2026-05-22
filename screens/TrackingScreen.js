import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { allFoodCategories } from '../data/pakistaniFoods';
import { calculateRisk } from '../services/riskEngine';
import { supabase } from '../services/supabase';
import {
  getDailyLog,
  formatDateKey,
  saveDailyLog,
  getLogs,
} from '../services/storageService';
import { getProfile as getProfileFromService } from '../services/profileService';
import { globalStyles } from '../constants/styles';
import { useTheme } from '../contexts/ThemeContext';

const SYMPTOMS = [
  { key: 'dizziness', label: 'Dizziness', emoji: '😵' },
  { key: 'headache', label: 'Headache', emoji: '🤕' },
  { key: 'shortnessOfBreath', label: 'Shortness of breath', emoji: '😮‍💨' },
  { key: 'heartPalpitations', label: 'Heart palpitations', emoji: '💓' },
  { key: 'coldHandsFeet', label: 'Cold hands/feet', emoji: '🥶' },
  { key: 'paleAppearance', label: 'Pale appearance', emoji: '😶' },
];

const ACTIVITIES = ['none', 'light', 'moderate', 'heavy'];
const ACTIVITY_LABELS = { none: 'None', light: 'Light', moderate: 'Moderate', heavy: 'Heavy' };
const STRESS_LEVELS = ['low', 'medium', 'high'];
const STRESS_LABELS = { low: 'Low', medium: 'Medium', high: 'High' };
const MOODS = [
  { value: 1, emoji: '😢' },
  { value: 2, emoji: '😔' },
  { value: 3, emoji: '😐' },
  { value: 4, emoji: '🙂' },
  { value: 5, emoji: '😄' },
];

const emptyLog = () => ({
  fatigue: 5,
  energy: 5,
  symptoms: {},
  foods: {
    ironRich: [],
    ironBlocking: [],
    vitaminC: [],
    staples: [],
    dairy: [],
    junk: [],
  },
  lifestyle: { water: 6, sleep: 7, activity: 'light', mood: 3, stress: 'low' },
});

export default function TrackingScreen({ navigation }) {
  const { theme: colors } = useTheme();
  const styles = createStyles(colors);
  const CATEGORY_ACCENT = {
  ironRich: colors.primary,
  ironBlocking: colors.warning || '#e67e22',
  vitaminC: colors.success,
  staples: '#8e7b5e',
  dairy: '#5b9bd5',
  junk: colors.error || '#e74c3c',
};
  const [alreadyLogged, setAlreadyLogged] = useState(false);
  const [todaysLog, setTodaysLog] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [log, setLog] = useState(emptyLog());
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState(null);

  const loadTodayState = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUserId(user?.id);
    if (!user?.id) return;

    const today = new Date();
    const saved = await getDailyLog(user.id, today);
    if (saved) {
      setTodaysLog(saved);
      setLog(saved);
      if (!editMode) {
        setAlreadyLogged(true);
      }
      return;
    }

    setAlreadyLogged(false);
    setTodaysLog(null);
    setEditMode(false);
    setLog(emptyLog());
  }, [editMode]);

  useFocusEffect(
    useCallback(() => {
      loadTodayState();
    }, [loadTodayState])
  );

  const today = new Date().toLocaleDateString('en-PK', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const toggleSymptom = (key) => {
    setLog((prev) => ({
      ...prev,
      symptoms: { ...prev.symptoms, [key]: !prev.symptoms?.[key] },
    }));
  };

  const toggleFood = (category, id) => {
    setLog((prev) => {
      const foods = { ...prev.foods };
      const list = [...(foods[category] || [])];
      const idx = list.indexOf(id);
      if (idx >= 0) {
        list.splice(idx, 1);
      } else {
        list.push(id);
      }
      foods[category] = list;
      return { ...prev, foods };
    });
  };

  const handleSave = async () => {
    if (!userId) {
      Alert.alert('Error', 'User not authenticated. Please log in again.');
      return;
    }

    setSaving(true);
    try {
      const profile = await getProfileFromService(userId);
      const risk = calculateRisk(log, profile);

      const logToSave = {
        ...log,
        riskScore: risk.score,
        riskLevel: risk.level,
        riskColor: risk.color,
        savedAt: new Date().toISOString(),
      };

      await saveDailyLog(userId, logToSave);

      const allLogs = await getLogs(userId, 7);
      const logCount = allLogs.filter((entry) => entry.log).length;

      const message = logCount < 7
        ? `Log saved! Keep logging daily. Your risk insights unlock after 7 days. (${logCount}/7 days logged)`
        : 'Log saved! Tap Reports to see your updated risk insights.';

      Alert.alert('Saved', message, [{
        text: 'OK',
        onPress: () => {
          setEditMode(false);
          setAlreadyLogged(true);
          setTodaysLog(logToSave);
          navigation.navigate('Home');
        },
      }]);
    } catch (err) {
      console.error('Error saving log:', err);
      Alert.alert('Error', 'Failed to save log. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const selectedSymptoms = SYMPTOMS
    .filter((item) => todaysLog?.symptoms?.[item.key])
    .slice(0, 3)
    .map((item) => item.label);

  const getFoodCategoryKey = (category) => {
  const validKeys = ['ironRich', 'ironBlocking', 'vitaminC', 'staples', 'dairy', 'junk'];
  return validKeys.includes(category) ? category : 'ironRich';
};

  if (alreadyLogged && !editMode && todaysLog) {
    return (
      <ScrollView style={[globalStyles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.loggedContent}>
        <View style={styles.doneCard}>
          <Ionicons name="checkmark-circle" size={72} color={colors.success} />
          <Text style={styles.doneTitle}>All logged for today!</Text>
          <Text style={styles.doneText}>Come back tomorrow to keep your streak going 🔥</Text>
        </View>

        <View style={[globalStyles.card, styles.summaryCard]}>
          <Text style={styles.summaryLine}>Fatigue: {todaysLog.fatigue}/10</Text>
          <Text style={styles.summaryLine}>Energy: {todaysLog.energy}/10</Text>
          <Text style={styles.summaryLine}>
            Top symptoms: {selectedSymptoms.length ? selectedSymptoms.join(', ') : 'None'}
          </Text>
          <Text style={styles.summaryLine}>
            Mood: {MOODS.find((item) => item.value === todaysLog.lifestyle?.mood)?.emoji || '😐'}
          </Text>
          <Text style={styles.summaryLine}>Water: {todaysLog.lifestyle?.water ?? 0} glasses</Text>
        </View>

        <TouchableOpacity
          style={globalStyles.secondaryButton}
          onPress={() => {
            setEditMode(true);
            setLog(todaysLog);
          }}
        >
          <Text style={globalStyles.secondaryButtonText}>Edit today's log</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={[globalStyles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.scrollContent}>
      <Text style={globalStyles.heading}>Daily Tracking 📋</Text>
      <Text style={styles.date}>{today}</Text>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>💗 How are you feeling today?</Text>

        <Text style={styles.fieldLabel}>Fatigue: {log.fatigue}/10</Text>
        <Text style={styles.sliderHint}>1 = No fatigue · 10 = Extreme fatigue</Text>
        <Slider
          minimumValue={1}
          maximumValue={10}
          step={1}
          value={log.fatigue}
          onValueChange={(v) => setLog((p) => ({ ...p, fatigue: v }))}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.primary}
          style={styles.fieldSpacing}
        />

        <Text style={styles.fieldLabel}>Energy: {log.energy}/10</Text>
        <Text style={styles.sliderHint}>1 = No energy · 10 = Full energy</Text>
        <Slider
          minimumValue={1}
          maximumValue={10}
          step={1}
          value={log.energy}
          onValueChange={(v) => setLog((p) => ({ ...p, energy: v }))}
          minimumTrackTintColor={colors.success}
          maximumTrackTintColor={colors.border}
          thumbTintColor={colors.success}
          style={styles.fieldSpacing}
        />

        <Text style={styles.fieldLabel}>Symptoms</Text>
        <View style={styles.symptomGrid}>
          {SYMPTOMS.map((s) => {
            const active = !!log.symptoms?.[s.key];
            return (
              <TouchableOpacity
                key={s.key}
                style={[styles.symptomCell, active && styles.symptomCellActive]}
                onPress={() => toggleSymptom(s.key)}
                activeOpacity={0.7}
              >
                <View style={[styles.symptomDot, active && styles.symptomDotActive]} />
                <Text style={styles.symptomEmoji}>{s.emoji}</Text>
                <Text
                  style={[styles.symptomLabel, active && styles.symptomLabelActive]}
                  numberOfLines={2}
                >
                  {s.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>🍽️ What did you eat today?</Text>
        {allFoodCategories.map((cat, index) => {
          const categoryKey = cat.categoryKey || 'ironRich';
          const selectedCount = cat.foods.filter((food) => {
            const catKey = getFoodCategoryKey(food.category);
            return log.foods?.[catKey]?.includes(food.id);
          }).length;

          return (
            <View key={cat.title}>
              {index > 0 && <View style={styles.foodDivider} />}
              <View
                style={[
                  styles.foodCategoryHeader,
                  { borderLeftColor: CATEGORY_ACCENT[categoryKey] || colors.textSecondary },
                ]}
              >
                <Text style={styles.foodCategoryTitle}>{cat.title}</Text>
                {selectedCount > 0 && (
                  <Text style={styles.foodCategoryBadge}>{selectedCount} selected</Text>
                )}
              </View>
              <View style={styles.foodGrid}>
                {cat.foods.map((food) => {
                  const catKey = getFoodCategoryKey(food.category);
                  const selected = log.foods?.[catKey]?.includes(food.id);
                  return (
                    <TouchableOpacity
                      key={food.id}
                      style={[styles.foodCell, selected && styles.foodCellActive]}
                      onPress={() => toggleFood(catKey, food.id)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.foodDot, selected && styles.foodDotActive]} />
                      <Text style={styles.foodEmoji}>{food.emoji}</Text>
                      <Text
                        style={[styles.foodLabel, selected && styles.foodLabelActive]}
                        numberOfLines={2}
                      >
                        {food.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>🌙 Lifestyle</Text>

        <Text style={styles.fieldLabel}>
          Water: {log.lifestyle?.water ?? 0} glasses
        </Text>
        <View style={[styles.stepper, styles.fieldSpacing]}>
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() =>
              setLog((p) => ({
                ...p,
                lifestyle: {
                  ...p.lifestyle,
                  water: Math.max(0, (p.lifestyle?.water ?? 0) - 1),
                },
              }))
            }
          >
            <Text style={styles.stepBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.stepValue}>{log.lifestyle?.water ?? 0}</Text>
          <TouchableOpacity
            style={styles.stepBtn}
            onPress={() =>
              setLog((p) => ({
                ...p,
                lifestyle: {
                  ...p.lifestyle,
                  water: Math.min(12, (p.lifestyle?.water ?? 0) + 1),
                },
              }))
            }
          >
            <Text style={styles.stepBtnText}>+</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.fieldLabel}>Sleep: {log.lifestyle?.sleep} hours</Text>
        <Slider
          minimumValue={4}
          maximumValue={12}
          step={0.5}
          value={log.lifestyle?.sleep ?? 7}
          onValueChange={(v) =>
            setLog((p) => ({ ...p, lifestyle: { ...p.lifestyle, sleep: v } }))
          }
          minimumTrackTintColor={colors.primary}
          thumbTintColor={colors.primary}
          style={styles.fieldSpacing}
        />

        <Text style={styles.fieldLabel}>Physical Activity</Text>
        <View style={[styles.optionRow, styles.fieldSpacing]}>
          {ACTIVITIES.map((a) => (
            <TouchableOpacity
              key={a}
              style={[
                styles.optionBtn,
                log.lifestyle?.activity === a && styles.optionBtnActive,
              ]}
              onPress={() =>
                setLog((p) => ({ ...p, lifestyle: { ...p.lifestyle, activity: a } }))
              }
            >
              <Text
                style={[
                  styles.optionText,
                  log.lifestyle?.activity === a && styles.optionTextActive,
                ]}
              >
                {ACTIVITY_LABELS[a]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Mood</Text>
        <View style={[styles.moodRow, styles.fieldSpacing]}>
          {MOODS.map((m) => (
            <TouchableOpacity
              key={m.value}
              style={[
                styles.moodBtn,
                log.lifestyle?.mood === m.value && styles.moodBtnActive,
              ]}
              onPress={() =>
                setLog((p) => ({ ...p, lifestyle: { ...p.lifestyle, mood: m.value } }))
              }
            >
              <Text style={styles.moodEmoji}>{m.emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Stress Level</Text>
        <View style={styles.optionRow}>
          {STRESS_LEVELS.map((s) => (
            <TouchableOpacity
              key={s}
              style={[
                styles.optionBtn,
                log.lifestyle?.stress === s && styles.optionBtnActive,
              ]}
              onPress={() =>
                setLog((p) => ({ ...p, lifestyle: { ...p.lifestyle, stress: s } }))
              }
            >
              <Text
                style={[
                  styles.optionText,
                  log.lifestyle?.stress === s && styles.optionTextActive,
                ]}
              >
                {STRESS_LABELS[s]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={[globalStyles.primaryButton, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
        onPress={handleSave}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <Text style={globalStyles.primaryButtonText}>{editMode ? 'Update Log' : 'Save Log'}</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const createStyles = (colors) => StyleSheet.create({
  loggedContent: {
    padding: 16,
    paddingBottom: 32,
    flexGrow: 1,
    justifyContent: 'center',
  },
  doneCard: {
    alignItems: 'center',
    marginBottom: 18,
  },
  doneTitle: {
    marginTop: 12,
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  doneText: {
    marginTop: 8,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  summaryCard: {
    marginBottom: 16,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  fieldSpacing: {
    marginBottom: 12,
  },
  date: { fontSize: 14, color: colors.textSecondary, marginBottom: 12 },
  sliderHint: { fontSize: 11, color: colors.textSecondary, marginBottom: 8 },
  foodSubHeader: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: 12,
    marginBottom: 8,
  },
  foodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  foodCell: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: colors.background,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  foodCellActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  foodDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.border,
    marginRight: 8,
  },
  foodDotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  foodEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  foodLabel: {
    flex: 1,
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  foodLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  foodCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
    paddingLeft: 10,
    borderLeftWidth: 4,
  },
  foodCategoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  foodCategoryBadge: {
    marginLeft: 8,
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
  },
  foodDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginTop: 8,
    marginBottom: 4,
  },
  // ----- New 2-column symptom grid styles -----
  symptomGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  symptomCell: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    backgroundColor: colors.background,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  symptomCellActive: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  symptomDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.border,
    marginRight: 8,
  },
  symptomDotActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  symptomEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  symptomLabel: {
    flex: 1,
    fontSize: 12,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  symptomLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  // ----- End of new styles -----
  foodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: colors.background,
    borderRadius: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  foodSelected: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBtnText: { color: colors.white, fontSize: 24, fontWeight: '600' },
  stepValue: {
    fontSize: 24,
    fontWeight: '700',
    marginHorizontal: 24,
    color: colors.textPrimary,
  },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap' },
  optionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
    marginBottom: 8,
    backgroundColor: colors.card,
  },
  optionBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionText: { fontSize: 13, color: colors.textPrimary },
  optionTextActive: { color: colors.white, fontWeight: '600' },
  moodRow: { flexDirection: 'row', justifyContent: 'space-between' },
  moodBtn: {
    padding: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  moodBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  moodEmoji: { fontSize: 28 },
  summaryLine: {
    fontSize: 15,
    color: colors.textPrimary,
    marginBottom: 6,
  },
});