import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';
import { getProfile, saveProfile } from '../services/profileService';
import { clearAllUserData } from '../services/storageService';
import { globalStyles } from '../constants/styles';
import { useTheme } from '../contexts/ThemeContext';

const DIET_OPTIONS = ['Omnivore', 'Vegetarian', 'Vegan'];
const COFFEE_TEA_OPTIONS = ['never', 'rarely', 'daily', 'multiple_daily'];
const COFFEE_TEA_LABELS = { never: 'Never', rarely: 'Rarely', daily: 'Daily', multiple_daily: 'Multiple times daily' };
const EXERCISE_OPTIONS = ['never', 'weekly', 'few_times_week', 'daily'];
const EXERCISE_LABELS = { never: 'Never', weekly: 'Weekly', few_times_week: 'Few times/week', daily: 'Daily' };

export default function ProfileSetupScreen({ navigation, route }) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
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
  const [hasThyroid, setHasThyroid] = useState(false);
  const [hasDiabetes, setHasDiabetes] = useState(false);
  const [otherConditions, setOtherConditions] = useState('');
  const [error, setError] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(mode === 'edit');

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

      if (mode === 'edit') {
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
          setHasThyroid(saved.medicalConditions?.includes('Thyroid Disorder') || false);
          setHasDiabetes(saved.medicalConditions?.includes('Diabetes') || false);
          const other = saved.medicalConditions
            ?.filter((c) => !['Thyroid Disorder', 'Diabetes', 'None of the above'].includes(c))
            .join(', ') || '';
          setOtherConditions(other);
        }
      }

      if (mounted) {
        setLoadingProfile(false);
      }
    };

    loadProfile();

    return () => {
      mounted = false;
    };
  }, [existingName, mode]);

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

    const medicalConditions = [];
    if (hasThyroid) medicalConditions.push('Thyroid Disorder');
    if (hasDiabetes) medicalConditions.push('Diabetes');
    if (otherConditions.trim()) {
      medicalConditions.push(...otherConditions.split(',').map((c) => c.trim()));
    }

    const profile = {
      fullName,
      name: fullName,
      age: ageNum,
      height: heightNum,
      weight: weightNum,
      dietaryPreference,
      coffee_tea_frequency: coffeeTeaFrequency,
      exercise_frequency: exerciseFrequency,
      avg_sleep_hours: sleepNum,
      medicalConditions: medicalConditions.length > 0 ? medicalConditions : ['None of the above'],
    };

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError('Please login again to continue');
      return;
    }

    // Clear stale data from any previous users before saving new profile
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

      <Text style={globalStyles.label}>Average Sleep Hours (4-12) *</Text>
      <TextInput
        style={[globalStyles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.textPrimary }]}
        value={avgSleepHours}
        onChangeText={setAvgSleepHours}
        keyboardType="decimal-pad"
        placeholder="7"
        placeholderTextColor={theme.textSecondary}
      />

      <Text style={globalStyles.label}>Dietary Preference *</Text>
      <View style={styles.chipRow}>
        {DIET_OPTIONS.map((d) => (
          <TouchableOpacity
            key={d}
            style={[
              globalStyles.chip,
              dietaryPreference === d && globalStyles.chipSelected,
              { borderColor: theme.border, backgroundColor: theme.card },
              dietaryPreference === d && { borderColor: theme.primary, backgroundColor: theme.primaryLight },
            ]}
            onPress={() => setDietaryPreference(d)}
          >
            <Text
              style={[
                globalStyles.chipText,
                dietaryPreference === d && globalStyles.chipTextSelected,
                { color: theme.textPrimary },
                dietaryPreference === d && { color: theme.primary },
              ]}
            >
              {d}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={globalStyles.label}>Coffee/Tea Frequency *</Text>
      <View style={styles.chipRow}>
        {COFFEE_TEA_OPTIONS.map((c) => (
          <TouchableOpacity
            key={c}
            style={[
              globalStyles.chip,
              coffeeTeaFrequency === c && globalStyles.chipSelected,
              { borderColor: theme.border, backgroundColor: theme.card },
              coffeeTeaFrequency === c && { borderColor: theme.primary, backgroundColor: theme.primaryLight },
            ]}
            onPress={() => setCoffeeTeaFrequency(c)}
          >
            <Text
              style={[
                globalStyles.chipText,
                coffeeTeaFrequency === c && globalStyles.chipTextSelected,
                { color: theme.textPrimary },
                coffeeTeaFrequency === c && { color: theme.primary },
              ]}
            >
              {COFFEE_TEA_LABELS[c]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={globalStyles.label}>Exercise Frequency *</Text>
      <View style={styles.chipRow}>
        {EXERCISE_OPTIONS.map((e) => (
          <TouchableOpacity
            key={e}
            style={[
              globalStyles.chip,
              exerciseFrequency === e && globalStyles.chipSelected,
              { borderColor: theme.border, backgroundColor: theme.card },
              exerciseFrequency === e && { borderColor: theme.primary, backgroundColor: theme.primaryLight },
            ]}
            onPress={() => setExerciseFrequency(e)}
          >
            <Text
              style={[
                globalStyles.chipText,
                exerciseFrequency === e && globalStyles.chipTextSelected,
                { color: theme.textPrimary },
                exerciseFrequency === e && { color: theme.primary },
              ]}
            >
              {EXERCISE_LABELS[e]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={globalStyles.label}>Medical Conditions</Text>
      
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Thyroid Disorder</Text>
        <Switch
          value={hasThyroid}
          onValueChange={setHasThyroid}
          trackColor={{ false: theme.border, true: theme.primaryLight }}
          thumbColor={hasThyroid ? theme.primary : theme.textSecondary}
        />
      </View>

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Diabetes</Text>
        <Switch
          value={hasDiabetes}
          onValueChange={setHasDiabetes}
          trackColor={{ false: theme.border, true: theme.primaryLight }}
          thumbColor={hasDiabetes ? theme.primary : theme.textSecondary}
        />
      </View>

      <Text style={globalStyles.label}>Other Conditions (comma-separated)</Text>
      <TextInput
        style={[globalStyles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.textPrimary }]}
        value={otherConditions}
        onChangeText={setOtherConditions}
        placeholder="e.g., Thalassemia Trait, Kidney Disease"
        placeholderTextColor={theme.textSecondary}
        multiline
      />

      <TouchableOpacity style={[globalStyles.primaryButton, { backgroundColor: theme.primary }]} onPress={handleSave}>
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
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingVertical: 8 },
  toggleLabel: { fontSize: 14, color: theme.textPrimary },
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
