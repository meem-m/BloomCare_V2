import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const getCacheKey = (userId) => `cache_profile_${userId}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const mapProfileRow = (data) => ({
  name:                 data.name || '',
  fullName:             data.name || '',
  age:                  data.age,
  height:               data.height_cm,
  height_cm:            data.height_cm,
  weight:               data.weight_kg,
  weight_kg:            data.weight_kg,
  bmi:                  data.bmi ?? null,
  dietaryPreference:    data.diet_type === 'non_vegetarian'
                          ? 'Omnivore' : data.diet_type,
  diet_type:            data.diet_type,
  medicalConditions:    buildMedicalConditionsArray(data),
  medical_conditions:   data.medical_conditions,
  coffee_tea_frequency: data.coffee_tea_frequency,
  exercise_frequency:   data.exercise_frequency,
  avg_sleep_hours:      data.avg_sleep_hours,
});

const readProfileCache = async (userId) => {
  try {
    const cached = await AsyncStorage.getItem(getCacheKey(userId));
    if (!cached) return null;

    const profile = JSON.parse(cached);
    return profile && profile.name ? profile : null;
  } catch (err) {
    console.warn('Invalid cached profile payload:', err?.message);
    await AsyncStorage.removeItem(getCacheKey(userId)).catch(() => {});
    return null;
  }
};

const writeProfileCache = async (userId, profile) => {
  try {
    await AsyncStorage.setItem(getCacheKey(userId), JSON.stringify(profile));
  } catch (err) {
    console.warn('Failed to persist profile cache:', err?.message);
  }
};

const fetchProfileRow = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id,user_id,name,age,weight_kg,height_cm,bmi,diet_type,medical_conditions,coffee_tea_frequency,exercise_frequency,avg_sleep_hours')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST116') {
      return null;
    }

    if (error.code === '42501' || /permission|rls|row level security/i.test(error.message || '')) {
      const retry = await supabase
        .from('profiles')
        .select('id,user_id,name,age,weight_kg,height_cm,bmi,diet_type,medical_conditions,coffee_tea_frequency,exercise_frequency,avg_sleep_hours')
        .eq('user_id', userId)
        .maybeSingle();

      if (retry.error) {
        if (retry.error.code === 'PGRST116') return null;
        throw retry.error;
      }

      return retry.data || null;
    }

    throw error;
  }

  return data || null;
};

const fetchProfileWithRetry = async (userId, attempts = 2) => {
  let lastError = null;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const row = await fetchProfileRow(userId);
      if (row) return row;
      return null;
    } catch (err) {
      lastError = err;
      if (attempt < attempts - 1) {
        await sleep(250 * (attempt + 1));
        continue;
      }
    }
  }

  throw lastError;
};

export const clearProfileCache = async (userId) => {
  if (!userId) return;
  await AsyncStorage.removeItem(getCacheKey(userId)).catch(() => {});
};

/**
 * Save profile to Supabase and cache to AsyncStorage
 */
export const saveProfile = async (userId, profileData) => {
  if (!userId) return;

  const profile = {
    name:                 profileData.name || profileData.fullName || '',
    age:                  profileData.age ? parseInt(profileData.age, 10) : null,
    weight_kg:            profileData.weight ? parseFloat(profileData.weight) : null,
    height_cm:            profileData.height ? parseFloat(profileData.height) : null,
    bmi:                  profileData.bmi ?? null,
    diet_type:            profileData.dietaryPreference
                            ? (profileData.dietaryPreference === 'Omnivore'
                                ? 'non_vegetarian'
                                : profileData.dietaryPreference.toLowerCase())
                            : null,
    coffee_tea_frequency: profileData.coffee_tea_frequency || 'never',
    exercise_frequency:   profileData.exercise_frequency   || 'weekly',
    avg_sleep_hours:      profileData.avg_sleep_hours
                            ? parseFloat(profileData.avg_sleep_hours) : 7,
    medical_conditions:   Array.isArray(profileData.medicalConditions)
                            ? profileData.medicalConditions
                            : ['noConditions'],
  };

  try {
    const { error } = await supabase
      .from('profiles')
      .upsert(
        { user_id: userId, ...profile },
        { onConflict: 'user_id' }
      );

    if (error) throw error;

    await writeProfileCache(userId, mapProfileRow(profile));
  } catch (err) {
    console.error('Error saving profile:', err);
    await writeProfileCache(userId, mapProfileRow(profile));
  }
};

/**
 * Rebuild medicalConditions array from profile
 */
const buildMedicalConditionsArray = (profile) => {
  if (Array.isArray(profile.medical_conditions) && profile.medical_conditions.length > 0) {
    return profile.medical_conditions;
  }
  const conditions = [];
  if (profile.has_thyroid)  conditions.push('thyroid');
  if (profile.has_diabetes) conditions.push('diabetes');
  if (profile.other_conditions) {
    conditions.push(
      ...profile.other_conditions.split(', ').filter((c) => c)
    );
  }
  return conditions.length > 0 ? conditions : ['noConditions'];
};

/**
 * Get profile with stale-while-revalidate pattern.
 */
export const getProfile = async (userId, onFreshData) => {
  if (!userId) return null;

  const cached = await readProfileCache(userId);
  if (cached) {
    Promise.resolve().then(async () => {
      try {
        const freshRow = await fetchProfileWithRetry(userId, 2);
        if (freshRow) {
          const freshProfile = mapProfileRow(freshRow);
          await writeProfileCache(userId, freshProfile);
          onFreshData?.(freshProfile);
        }
      } catch (err) {
        console.warn('Background profile fetch failed:', err?.message || err);
      }
    });
    return cached;
  }

  try {
    const data = await fetchProfileWithRetry(userId, 3);
    if (data) {
      const profile = mapProfileRow(data);
      await writeProfileCache(userId, profile);
      return profile;
    }
  } catch (err) {
    console.warn('Error fetching profile from Supabase:', err?.message || err);
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
    if (partialData.medicalConditions !== undefined) {
      updateData.medical_conditions = Array.isArray(partialData.medicalConditions)
        ? partialData.medicalConditions
        : ['noConditions'];
    }
    if (partialData.bmi !== undefined) {
      updateData.bmi = partialData.bmi;
    }

    const { error } = await supabase
      .from('profiles')
      .update(updateData)
      .eq('user_id', userId);

    if (error) throw error;

    const current = await AsyncStorage.getItem(getCacheKey(userId));
    if (current) {
      const updated = { ...JSON.parse(current), ...partialData };
      await AsyncStorage.setItem(getCacheKey(userId), JSON.stringify(updated));
    }
  } catch (err) {
    console.error('Error updating profile:', err);
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
      .maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  } catch (err) {
    console.warn('Error checking profile existence:', err);
    const cached = await readProfileCache(userId);
    return !!cached;
  }
};