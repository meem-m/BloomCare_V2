import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const getCacheKey = (userId) => `cache_profile_${userId}`;

/**
 * Save profile to Supabase and cache to AsyncStorage
 */
export const saveProfile = async (userId, profileData) => {
  if (!userId) return;

  const profile = {
    name: profileData.name || profileData.fullName || '',
    age: profileData.age ? parseInt(profileData.age, 10) : null,
    weight_kg: profileData.weight ? parseFloat(profileData.weight) : null,
    height_cm: profileData.height ? parseFloat(profileData.height) : null,
    ...(profileData.bmi !== undefined ? { bmi: profileData.bmi } : {}),
    diet_type: profileData.dietaryPreference
      ? (profileData.dietaryPreference === 'Omnivore' ? 'non_vegetarian' : profileData.dietaryPreference.toLowerCase())
      : null,
    coffee_tea_frequency: profileData.coffee_tea_frequency || 'never',
    exercise_frequency: profileData.exercise_frequency || 'weekly',
    avg_sleep_hours: profileData.avg_sleep_hours ? parseFloat(profileData.avg_sleep_hours) : 7,
    has_thyroid: profileData.medicalConditions?.includes('Thyroid Disorder') || false,
    has_diabetes: profileData.medicalConditions?.includes('Diabetes') || false,
    other_conditions: profileData.medicalConditions
      ?.filter((c) => !['Thyroid Disorder', 'Diabetes'].includes(c) && c !== 'None of the above')
      .join(', ') || null,
  };

  try {
    // Try to upsert to Supabase
    const { error } = await supabase
      .from('profiles')
      .upsert(
        { user_id: userId, ...profile },
        { onConflict: 'user_id' }
      );

    if (error) throw error;

    // Cache in AsyncStorage
    const cached = {
      ...profile,
      fullName: profile.name,
      medicalConditions: buildMedicalConditionsArray(profile),
      dietaryPreference: profile.diet_type === 'non_vegetarian' ? 'Omnivore' : profile.diet_type,
    };
    await AsyncStorage.setItem(getCacheKey(userId), JSON.stringify(cached));
  } catch (err) {
    console.error('Error saving profile:', err);
    // Still try to save to cache for offline mode
    const cached = {
      ...profile,
      fullName: profile.name,
      medicalConditions: buildMedicalConditionsArray(profile),
      dietaryPreference: profile.diet_type === 'non_vegetarian' ? 'Omnivore' : profile.diet_type,
    };
    await AsyncStorage.setItem(getCacheKey(userId), JSON.stringify(cached));
  }
};

/**
 * Rebuild medicalConditions array from profile
 */
const buildMedicalConditionsArray = (profile) => {
  const conditions = [];
  if (profile.has_thyroid) conditions.push('Thyroid Disorder');
  if (profile.has_diabetes) conditions.push('Diabetes');
  if (profile.other_conditions) {
    conditions.push(...profile.other_conditions.split(', ').filter((c) => c));
  }
  return conditions.length > 0 ? conditions : ['None of the above'];
};

/**
 * Get profile with stale-while-revalidate pattern.
 * Returns cache immediately if available, then fetches fresh data in background.
 * Optional callback fires when fresh data arrives from Supabase.
 */
export const getProfile = async (userId, onFreshData) => {
  if (!userId) return null;

  // Return cached profile immediately if available
  const cached = await AsyncStorage.getItem(getCacheKey(userId));
  if (cached) {
    const profile = JSON.parse(cached);
    // Kick off background fetch in parallel
    setImmediate(async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .single();

        if (error && error.code !== 'PGRST116') throw error;

        if (data) {
          const freshProfile = {
            name: data.name,
            fullName: data.name,
            age: data.age,
            height: data.height_cm,
            weight: data.weight_kg,
            ...(data.bmi !== undefined && data.bmi !== null ? { bmi: data.bmi } : {}),
            dietaryPreference: data.diet_type === 'non_vegetarian' ? 'Omnivore' : data.diet_type,
            medicalConditions: buildMedicalConditionsArray(data),
            coffee_tea_frequency: data.coffee_tea_frequency,
            exercise_frequency: data.exercise_frequency,
            avg_sleep_hours: data.avg_sleep_hours,
          };
          await AsyncStorage.setItem(getCacheKey(userId), JSON.stringify(freshProfile));
          onFreshData?.(freshProfile);
        }
      } catch (err) {
        console.warn('Background profile fetch failed:', err);
      }
    });
    return profile;
  }

  // No cache: fetch from Supabase
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    if (data) {
      const profile = {
        name: data.name,
        fullName: data.name,
        age: data.age,
        height: data.height_cm,
        weight: data.weight_kg,
        ...(data.bmi !== undefined && data.bmi !== null ? { bmi: data.bmi } : {}),
        dietaryPreference: data.diet_type === 'non_vegetarian' ? 'Omnivore' : data.diet_type,
        medicalConditions: buildMedicalConditionsArray(data),
        coffee_tea_frequency: data.coffee_tea_frequency,
        exercise_frequency: data.exercise_frequency,
        avg_sleep_hours: data.avg_sleep_hours,
      };
      await AsyncStorage.setItem(getCacheKey(userId), JSON.stringify(profile));
      return profile;
    }
  } catch (err) {
    console.warn('Error fetching profile from Supabase:', err);
  }

  return null;
};

/**
 * Update partial profile fields
 */
export const updateProfile = async (userId, partialData) => {
  if (!userId) return;

  try {
    const updateData = {};

    if (partialData.name || partialData.fullName) {
      updateData.name = partialData.name || partialData.fullName;
    }
    if (partialData.age !== undefined) {
      updateData.age = partialData.age;
    }
    if (partialData.weight !== undefined) {
      updateData.weight_kg = partialData.weight;
    }
    if (partialData.height !== undefined) {
      updateData.height_cm = partialData.height;
    }
    if (partialData.dietaryPreference) {
      updateData.diet_type = partialData.dietaryPreference === 'Omnivore'
        ? 'non_vegetarian'
        : partialData.dietaryPreference.toLowerCase();
    }

    // Fetch current profile to merge medical conditions if needed
    const current = await getProfile(userId);
    if (partialData.medicalConditions !== undefined) {
      updateData.has_thyroid = partialData.medicalConditions.includes('Thyroid Disorder');
      updateData.has_diabetes = partialData.medicalConditions.includes('Diabetes');
      const other = partialData.medicalConditions
        .filter((c) => !['Thyroid Disorder', 'Diabetes'].includes(c) && c !== 'None of the above')
        .join(', ');
      updateData.other_conditions = other || null;
    }

    // Update Supabase
    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('user_id', userId);

    if (error) throw error;

    // Update cache
    const updated = { ...current, ...partialData };
    await AsyncStorage.setItem(getCacheKey(userId), JSON.stringify(updated));
  } catch (err) {
    console.error('Error updating profile:', err);
    // Cache update as fallback
    const current = await AsyncStorage.getItem(getCacheKey(userId));
    if (current) {
      const updated = { ...JSON.parse(current), ...partialData };
      await AsyncStorage.setItem(getCacheKey(userId), JSON.stringify(updated));
    }
  }
};

/**
 * Check if profile exists
 */
export const profileExists = async (userId) => {
  if (!userId) return false;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return !!data;
  } catch (err) {
    console.warn('Error checking profile existence:', err);
    // Fall back to checking cache
    const cached = await AsyncStorage.getItem(getCacheKey(userId));
    return !!cached;
  }
};
