import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';
import { clearAllUserData } from '../services/storageService';
import { globalStyles } from '../constants/styles';
import { useTheme } from '../contexts/ThemeContext';

export default function SignUpScreen({ navigation }) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    setError('');
    if (!fullName || !email || !password) {
      setError('Please fill in all fields');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    // Clear any stale data from previous users
    if (user?.id) {
      await clearAllUserData(user.id);
    }
    navigation.replace('ProfileSetup', {
      fullName: user?.user_metadata?.full_name || fullName,
      mode: 'create',
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.logo}>🌸</Text>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join BloomCare today</Text>

        {error ? <Text style={globalStyles.errorText}>{error}</Text> : null}

        <Text style={globalStyles.label}>Full Name</Text>
        <TextInput
          style={[globalStyles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.textPrimary }]}
          value={fullName}
          onChangeText={setFullName}
          placeholder="Your name"
          placeholderTextColor={theme.textSecondary}
        />

        <Text style={globalStyles.label}>Email</Text>
        <TextInput
          style={[globalStyles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.textPrimary }]}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="your@email.com"
          placeholderTextColor={theme.textSecondary}
        />

        <Text style={globalStyles.label}>Password</Text>
        <TextInput
          style={[globalStyles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.textPrimary }]}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor={theme.textSecondary}
        />

        <Text style={globalStyles.label}>Confirm Password</Text>
        <TextInput
          style={[globalStyles.input, { backgroundColor: theme.card, borderColor: theme.border, color: theme.textPrimary }]}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor={theme.textSecondary}
        />

        <TouchableOpacity
          style={[globalStyles.primaryButton, { backgroundColor: theme.primary }, loading && styles.disabled]}
          onPress={handleSignUp}
          disabled={loading}
        >
          <Text style={globalStyles.primaryButtonText}>
            {loading ? 'Creating account...' : 'Sign Up'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={[globalStyles.link, { color: theme.primary }]}>Already have an account? Login</Text>
        </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.background },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: 24, paddingTop: 24 },
  logo: { fontSize: 48, textAlign: 'center', marginBottom: 8 },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.textPrimary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  disabled: { opacity: 0.6 },
});
