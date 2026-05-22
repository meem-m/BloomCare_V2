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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../services/supabase';
import { getProfile } from '../services/storageService';
import { globalStyles } from '../constants/styles';
import { useTheme } from '../contexts/ThemeContext';

export default function LoginScreen({ navigation }) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    if (!email || !password) {
      setError('Please enter email and password');
      return;
    }
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const profile = await getProfile(user?.id);
    const hasRequiredFields =
      profile
      && profile.age !== undefined
      && profile.height !== undefined
      && profile.weight !== undefined;

    if (hasRequiredFields) {
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
      return;
    }

    navigation.replace('ProfileSetup', {
      fullName: user?.user_metadata?.full_name || '',
      mode: 'create',
    });
  };

  const handleForgotPassword = async () => {
    if (!email) {
      Alert.alert('Enter email', 'Please enter your email address first.');
      return;
    }
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email);
    if (resetError) {
      Alert.alert('Error', resetError.message);
    } else {
      Alert.alert('Check your email', 'Password reset link has been sent.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.logo}>🌸</Text>
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to BloomCare</Text>

        {error ? <Text style={globalStyles.errorText}>{error}</Text> : null}

        <Text style={globalStyles.label}>Email</Text>
        <TextInput
          style={[
            globalStyles.input,
            { backgroundColor: theme.card, borderColor: theme.border, color: theme.textPrimary },
          ]}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="your@email.com"
          placeholderTextColor={theme.textSecondary}
        />

        <Text style={globalStyles.label}>Password</Text>
        <TextInput
          style={[
            globalStyles.input,
            { backgroundColor: theme.card, borderColor: theme.border, color: theme.textPrimary },
          ]}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor={theme.textSecondary}
        />

        <TouchableOpacity onPress={handleForgotPassword}>
          <Text style={styles.forgot}>Forgot password?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            globalStyles.primaryButton,
            { backgroundColor: theme.primary },
            loading && styles.disabled,
          ]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={globalStyles.primaryButtonText}>
            {loading ? 'Signing in...' : 'Login'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('SignUp')}>
          <Text style={[globalStyles.link, { color: theme.primary }]}>Don't have an account? Sign Up</Text>
        </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const createStyles = (theme) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: theme.background },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'center' },
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
  forgot: {
    color: theme.primary,
    textAlign: 'right',
    marginBottom: 8,
    fontSize: 13,
  },
  disabled: { opacity: 0.6 },
});
