import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

const getCacheKey = (userId) => `cache_profile_${userId}`;

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

    const cached = {
      name:                 profile.name,
      fullName:             profile.name,
      age:                  profile.age,
      height:               profile.height_cm,
      height_cm:            profile.height_cm,
      weight:               profile.weight_kg,
      weight_kg:            profile.weight_kg,
      bmi:                  profile.bmi,
      dietaryPreference:    profile.diet_type === 'non_vegetarian'
                              ? 'Omnivore' : profile.diet_type,
      diet_type:            profile.diet_type,
      medicalConditions:    buildMedicalConditionsArray(profile),
      medical_conditions:   profile.medical_conditions,
      coffee_tea_frequency: profile.coffee_tea_frequency,
      exercise_frequency:   profile.exercise_frequency,
      avg_sleep_hours:      profile.avg_sleep_hours,
    };
    await AsyncStorage.setItem(getCacheKey(userId), JSON.stringify(cached));
  } catch (err) {
    console.error('Error saving profile:', err);
    const cached = {
      name:                 profile.name,
      fullName:             profile.name,
      age:                  profile.age,
      height:               profile.height_cm,
      height_cm:            profile.height_cm,
      weight:               profile.weight_kg,
      weight_kg:            profile.weight_kg,
      bmi:                  profile.bmi,
      dietaryPreference:    profile.diet_type === 'non_vegetarian'
                              ? 'Omnivore' : profile.diet_type,
      diet_type:            profile.diet_type,
      medicalConditions:    buildMedicalConditionsArray(profile),
      medical_conditions:   profile.medical_conditions,
      coffee_tea_frequency: profile.coffee_tea_frequency,
      exercise_frequency:   profile.exercise_frequency,
      avg_sleep_hours:      profile.avg_sleep_hours,
    };
    await AsyncStorage.setItem(getCacheKey(userId), JSON.stringify(cached));
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

  // Check cache but only use it if it has essential fields
  const cached = await AsyncStorage.getItem(getCacheKey(userId));
  if (cached) {
    const profile = JSON.parse(cached);
    const isValid = !!(
      profile.name &&
      profile.age &&
      (profile.height_cm || profile.height)
    );

    if (isValid) {
      // Cache is good — return immediately and refresh in background
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
              name:                 data.name,
              fullName:             data.name,
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
            };
            await AsyncStorage.setItem(
              getCacheKey(userId),
              JSON.stringify(freshProfile)
            );
            onFreshData?.(freshProfile);
          }
        } catch (err) {
          console.warn('Background profile fetch failed:', err);
        }
      });
      return profile;
    } else {
      // Cache is incomplete — delete it and fetch fresh
      console.log('Cache incomplete — fetching fresh from Supabase');
      await AsyncStorage.removeItem(getCacheKey(userId));
    }
  }

  // No cache or invalid cache — fetch from Supabase
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    if (data) {
      const profile = {
        name:                 data.name,
        fullName:             data.name,
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
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return !!data;
  } catch (err) {
    console.warn('Error checking profile existence:', err);
    const cached = await AsyncStorage.getItem(getCacheKey(userId));
    return !!cached;
  }
};