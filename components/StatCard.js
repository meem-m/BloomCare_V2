import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export default function StatCard({ label, value, emoji }) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <View style={styles.card}>
      <Text style={styles.emoji}>{emoji}</Text>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const createStyles = (theme) => StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: theme.card,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  emoji: { fontSize: 22, marginBottom: 4 },
  value: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.textPrimary,
  },
  label: {
    fontSize: 10,
    color: theme.textSecondary,
    textAlign: 'center',
    marginTop: 2,
  },
});
