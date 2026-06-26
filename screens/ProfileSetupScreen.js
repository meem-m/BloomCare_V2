import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../services/supabase';
import { getProfile, saveProfile } from '../services/profileService';
import { clearAllUserData } from '../services/storageService';
import { globalStyles } from '../constants/styles';
import { useTheme } from '../contexts/ThemeContext';

const DIET_OPTIONS = ['Omnivore', 'Vegetarian', 'Vegan'];
const COFFEE_TEA_OPTIONS = ['never', 'rarely', 'daily', 'multiple_daily'];
const COFFEE_TEA_LABELS = {
  never: 'Never',
  rarely: 'Rarely',
  daily: 'Daily',
  multiple_daily: 'Multiple times daily',
};
const EXERCISE_OPTIONS = ['never', 'weekly', 'few_times_week', 'daily'];
const EXERCISE_LABELS = {
  never: 'Never',
  weekly: 'Weekly',
  few_times_week: 'Few times/week',
  daily: 'Daily',
};

const TIER1_CONDITIONS = [
  { key: 'ironDeficiency', label: 'Iron Deficiency (diagnosed)' },
  { key: 'thalassemia', label: 'Thalassemia' },
  { key: 'b12Deficiency', label: 'Vitamin B12 Deficiency' },
  { key: 'folateDeficiency', label: 'Folate Deficiency' },
  { key: 'menorrhagia', label: 'Menorrhagia' },
  { key: 'sickleCellTrait', label: 'Sickle Cell Trait' },
];

const TIER2_CONDITIONS = [
  { key: 'diabetes', label: 'Diabetes' },
  { key: 'thyroid', label: 'Thyroid Disorder' },
  { key: 'kidneyDisease', label: 'Kidney Disease' },
  { key: 'celiacDisease', label: 'Celiac Disease' },
  { key: 'ibd', label: "Crohn's / IBD" },
];

const TIER3_CONDITIONS = [
  { key: 'lupus', label: 'Lupus' },
  { key: 'rheumatoidArthritis', label: 'Rheumatoid Arthritis' },
  { key: 'cancer', label: 'Cancer' },
  { key: 'heartDisease', label: 'Heart Disease' },
  { key: 'liverDisease', label: 'Liver Disease' },
  { key: 'malaria', label: 'Malaria' },
  { key: 'bonemarrowDisorder', label: 'Bone Marrow Disorder' },
];

const ALL_CONDITION_KEYS = [
  ...TIER1_CONDITIONS,
  ...TIER2_CONDITIONS,
  ...TIER3_CONDITIONS,
].map((c) => c.key);

const emptyConditions = () =>
  ALL_CONDITION_KEYS.reduce((acc, key) => ({ ...acc, [key]: false }), {});

export default function ProfileSetupScreen({ navigation, route }) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const calculateBMI = (weightStr, heightStr) => {
    const w = parseFloat(weightStr);
    const h = parseFloat(heightStr);
    if (!w || !h || h === 0) return null;
    const bmi = w / ((h / 100) ** 2);
    return Math.round(bmi * 10) / 10;
  };

  const getBMICategory = (bmi) => {
    if (bmi < 18.5) return { label: 'Underweight', color: '#E67E22' };
    if (bmi < 25) return { label: 'Normal weight', color: '#27AE60' };
    if (bmi < 30) return { label: 'Overweight', color: '#F39C12' };
    return { label: 'Obese', color: '#C0392B' };
  };
  const mode = route.params?.mode === 'edit' ? 'edit' : 'create';
  const existingName = route.params?.fullName || '';

  const [fullName, setFullName] = useState(existingName);
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [dietaryPreference, setDietaryPreference] = useState('');
  const [coffeeTeaFrequency, setCoffeeTeaFrequency] = useState('never');
  const [exerciseFrequency, setExerciseFrequency] = useState('weekly');
  const [avgSleepHours, setAvgSleepHours] = useState('7');
  const [conditions, setConditions] = useState(emptyConditions());
  const [noConditions, setNoConditions] = useState(true);
  const [showTier3, setShowTier3] = useState(false);
  const [error, setError] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(mode === 'edit');
  const bmi = calculateBMI(weight, height);
  const bmiCategory = bmi !== null ? getBMICategory(bmi) : null;

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (mounted) {
          setError('Please login again to continue');
          setLoadingProfile(false);
        }
        return;
      }

      const saved = await getProfile(user.id);
      if (saved && mounted) {
        setFullName(saved.fullName || saved.name || existingName || '');
        setAge(saved.age ? String(saved.age) : '');
        setHeight(saved.height ? String(saved.height) : '');
        setWeight(saved.weight ? String(saved.weight) : '');
        setDietaryPreference(saved.dietaryPreference || '');
        setCoffeeTeaFrequency(saved.coffee_tea_frequency || 'never');
        setExerciseFrequency(saved.exercise_frequency || 'weekly');
        setAvgSleepHours(saved.avg_sleep_hours ? String(saved.avg_sleep_hours) : '7');

        if (saved.medicalConditions && Array.isArray(saved.medicalConditions)) {
          const restored = emptyConditions();
          let anyActive = false;
          saved.medicalConditions.forEach((c) => {
            if (restored.hasOwnProperty(c)) {
              restored[c] = true;
              anyActive = true;
            }
          });
          setConditions(restored);
          setNoConditions(!anyActive);
        }
      }

      if (mounted) setLoadingProfile(false);
    };

    loadProfile();
    return () => { mounted = false; };
  }, [existingName, mode]);

  const toggleCondition = (key) => {
    setConditions((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      const anyActive = Object.values(updated).some(Boolean);
      setNoConditions(!anyActive);
      return updated;
    });
  };

  const handleNoConditions = () => {
    setConditions(emptyConditions());
    setNoConditions(true);
  };

  const handleSave = async () => {
    setError('');
    const ageNum = parseInt(age, 10);
    const heightNum = parseFloat(height);
    const weightNum = parseFloat(weight);
    const sleepNum = parseFloat(avgSleepHours);

    if (!fullName || !age || !height || !weight || !dietaryPreference || !avgSleepHours) {
      setError('Please fill in all required fields');
      return;
    }
    if (ageNum < 10 || ageNum > 60) {
      setError('Age must be between 10 and 60');
      return;
    }
    if (sleepNum < 4 || sleepNum > 12) {
      setError('Sleep hours must be between 4 and 12');
      return;
    }

    const medicalConditions = noConditions
      ? ['noConditions']
      : Object.entries(conditions)
          .filter(([, val]) => val)
          .map(([key]) => key);

    const bmi = calculateBMI(weight, height);

    const profile = {
      fullName,
      name: fullName,
      age: ageNum,
      height: heightNum,
      weight: weightNum,
      bmi: bmi ?? null,
      dietaryPreference,
      coffee_tea_frequency: coffeeTeaFrequency,
      exercise_frequency: exerciseFrequency,
      avg_sleep_hours: sleepNum,
      medicalConditions,
    };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Please login again to continue');
      return;
    }

    await clearAllUserData(user.id);
    await saveProfile(user.id, profile);
    navigation.replace('Main');
  };

  const handleSkip = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Please login again to continue');
      return;
    }
    const minimalName = fullName || existingName || '';
    await saveProfile(user.id, { name: minimalName, fullName: minimalName });
    navigation.replace('Main');
  };

  const renderChip = (label, isSelected, onPress, tier = 1) => (
    <TouchableOpacity
      key={label}
      style={[
        styles.chip,
        isSelected && styles.chipSelected,
        tier === 2 && styles.chipTier2,
        tier === 2 && isSelected && styles.chipTier2Selected,
        tier === 3 && styles.chipTier3,
        tier === 3 && isSelected && styles.chipTier3Selected,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.chipText,
          isSelected && styles.chipTextSelected,
          tier === 2 && isSelected && styles.chipTier2TextSelected,
          tier === 3 && isSelected && styles.chipTier3TextSelected,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  if (loadingProfile) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={theme.primary} />
          <Text style={styles.loaderText}>Loading your profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView style={styles.flex} contentContainerStyle={styles.scroll}>
        <Text style={globalStyles.heading}>
          {mode === 'edit' ? 'Edit Your Information' : 'Tell us about yourself'}
        </Text>
        <Text style={globalStyles.bodyText}>
          This helps personalize your anemia risk insights.
        </Text>

        {error ? <Text style={globalStyles.errorText}>{error}</Text> : null}

        {/* Basic Info */}
        <Text style={globalStyles.label}>Full Name *</Text>
        <TextInput
          style={[globalStyles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.textPrimary }]}
          value={fullName}
          onChangeText={setFullName}
          placeholder="Your name"
          placeholderTextColor={theme.textSecondary}
        />

        <Text style={globalStyles.label}>Age (10–60) *</Text>
        <TextInput
          style={[globalStyles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.textPrimary }]}
          value={age}
          onChangeText={setAge}
          keyboardType="number-pad"
          placeholder="25"
          placeholderTextColor={theme.textSecondary}
        />

        <Text style={globalStyles.label}>Height (cm) *</Text>
        <TextInput
          style={[globalStyles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.textPrimary }]}
          value={height}
          onChangeText={setHeight}
          keyboardType="decimal-pad"
          placeholder="160"
          placeholderTextColor={theme.textSecondary}
        />

        <Text style={globalStyles.label}>Weight (kg) *</Text>
        <TextInput
          style={[globalStyles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.textPrimary }]}
          value={weight}
          onChangeText={setWeight}
          keyboardType="decimal-pad"
          placeholder="55"
          placeholderTextColor={theme.textSecondary}
        />

        {bmi !== null && bmiCategory && (
          <View style={[styles.bmiCard, { borderLeftColor: bmiCategory.color }]}>
            <Text style={styles.bmiValue}>BMI: {bmi.toFixed(1)}</Text>
            <Text style={[styles.bmiLabel, { color: bmiCategory.color }]}>{bmiCategory.label}</Text>
          </View>
        )}

        <Text style={globalStyles.label}>Average Sleep Hours (4–12) *</Text>
        <TextInput
          style={[globalStyles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.textPrimary }]}
          value={avgSleepHours}
          onChangeText={setAvgSleepHours}
          keyboardType="decimal-pad"
          placeholder="7"
          placeholderTextColor={theme.textSecondary}
        />

        {/* Dietary Preference */}
        <Text style={globalStyles.label}>Dietary Preference *</Text>
        <View style={styles.chipRow}>
          {DIET_OPTIONS.map((d) => renderChip(
            d,
            dietaryPreference === d,
            () => setDietaryPreference(d)
          ))}
        </View>

        {/* Coffee/Tea */}
        <Text style={globalStyles.label}>Coffee/Tea Frequency *</Text>
        <View style={styles.chipRow}>
          {COFFEE_TEA_OPTIONS.map((c) => renderChip(
            COFFEE_TEA_LABELS[c],
            coffeeTeaFrequency === c,
            () => setCoffeeTeaFrequency(c)
          ))}
        </View>

        {/* Exercise */}
        <Text style={globalStyles.label}>Exercise Frequency *</Text>
        <View style={styles.chipRow}>
          {EXERCISE_OPTIONS.map((e) => renderChip(
            EXERCISE_LABELS[e],
            exerciseFrequency === e,
            () => setExerciseFrequency(e)
          ))}
        </View>

        {/* Medical Conditions */}
        <Text style={globalStyles.label}>Medical Conditions</Text>
        <Text style={styles.conditionsHint}>
          Select all that apply. This helps personalize your risk score.
        </Text>

        {/* None option */}
        <View style={styles.chipRow}>
          {renderChip('No medical conditions', noConditions, handleNoConditions)}
        </View>

        {/* Tier 1 */}
        <Text style={styles.tierLabel}>🔴 Directly related to anemia</Text>
        <View style={styles.chipRow}>
          {TIER1_CONDITIONS.map((c) =>
            renderChip(c.label, conditions[c.key], () => toggleCondition(c.key), 1)
          )}
        </View>

        {/* Tier 2 */}
        <Text style={styles.tierLabel}>🟡 Commonly associated</Text>
        <View style={styles.chipRow}>
          {TIER2_CONDITIONS.map((c) =>
            renderChip(c.label, conditions[c.key], () => toggleCondition(c.key), 2)
          )}
        </View>

        {/* Tier 3 — expandable */}
        <TouchableOpacity
          style={styles.tier3Toggle}
          onPress={() => setShowTier3((prev) => !prev)}
        >
          <Text style={styles.tier3ToggleText}>
            {showTier3 ? 'Hide other conditions' : 'Show more conditions'}
          </Text>
          <Ionicons
            name={showTier3 ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={theme.textSecondary}
          />
        </TouchableOpacity>

        {showTier3 && (
          <>
            <Text style={styles.tierLabel}>⚪ Other conditions</Text>
            <View style={styles.chipRow}>
              {TIER3_CONDITIONS.map((c) =>
                renderChip(c.label, conditions[c.key], () => toggleCondition(c.key), 3)
              )}
            </View>
          </>
        )}

        <TouchableOpacity
          style={[globalStyles.primaryButton, { backgroundColor: theme.primary, marginTop: 24 }]}
          onPress={handleSave}
        >
          <Text style={globalStyles.primaryButtonText}>
            {mode === 'edit' ? 'Update Profile' : 'Save Profile'}
          </Text>
        </TouchableOpacity>

        {mode === 'create' && (
          <>
            <Text style={styles.skipNote}>You can complete this later from your profile</Text>
            <TouchableOpacity onPress={handleSkip}>
              <Text style={styles.skipButton}>Skip for now</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (theme) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.background },
  flex: { flex: 1, backgroundColor: theme.background },
  scroll: { padding: 20, paddingBottom: 40 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 8, gap: 8 },
  bmiCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    backgroundColor: theme.card,
  },
  bmiValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  bmiLabel: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },

  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
  },
  chipSelected: {
    borderColor: theme.primary,
    backgroundColor: theme.primaryLight,
  },
  chipText: {
    fontSize: 13,
    color: theme.textPrimary,
  },
  chipTextSelected: {
    color: theme.primary,
    fontWeight: '600',
  },

  chipTier2: {
    borderColor: theme.border,
    backgroundColor: theme.card,
  },
  chipTier2Selected: {
    borderColor: '#e67e22',
    backgroundColor: '#e67e2215',
  },
  chipTier2TextSelected: {
    color: '#e67e22',
    fontWeight: '600',
  },

  chipTier3: {
    borderColor: theme.border,
    backgroundColor: theme.card,
  },
  chipTier3Selected: {
    borderColor: theme.textSecondary,
    backgroundColor: theme.border,
  },
  chipTier3TextSelected: {
    color: theme.textPrimary,
    fontWeight: '600',
  },

  conditionsHint: {
    fontSize: 12,
    color: theme.textSecondary,
    marginBottom: 12,
    marginTop: -4,
  },
  tierLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.textSecondary,
    marginBottom: 8,
    marginTop: 8,
  },
  tier3Toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    marginBottom: 8,
  },
  tier3ToggleText: {
    fontSize: 13,
    color: theme.textSecondary,
    textDecorationLine: 'underline',
  },

  skipNote: {
    color: theme.textSecondary,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 24,
  },
  skipButton: {
    color: theme.textSecondary,
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
  loaderWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loaderText: {
    marginTop: 12,
    fontSize: 14,
    color: theme.textSecondary,
  },
});