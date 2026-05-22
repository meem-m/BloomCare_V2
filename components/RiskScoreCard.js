import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export default function RiskScoreCard({ risk, noData }) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  if (noData || !risk) {
    return (
      <View style={[styles.card, styles.noDataCard]}>
        <Text style={styles.noDataText}>No data yet. Log your day!</Text>
      </View>
    );
  }

  return (
    <View style={[styles.card, { borderColor: risk.color, backgroundColor: risk.color + '18' }]}>
      <Text style={styles.label}>Today's Risk Level</Text>
      <Text style={[styles.level, { color: risk.color }]}>{risk.level}</Text>
      <Text style={styles.score}>Score: {risk.score}/100</Text>
    </View>
  );
}

const createStyles = (theme) => StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 0,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  noDataCard: {
    backgroundColor: theme.card,
    borderColor: theme.border,
  },
  noDataText: {
    fontSize: 16,
    color: theme.grey,
    fontWeight: '500',
  },
  label: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 4,
  },
  level: {
    fontSize: 36,
    fontWeight: '800',
    marginVertical: 4,
  },
  score: {
    fontSize: 14,
    color: theme.textSecondary,
    marginTop: 4,
  },
});
