import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { globalStyles } from '../constants/styles';

export default function MythCard({ myth, compact }) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  const verdictColors = {
    BUSTED:           { bg: '#FADBD8', text: theme.danger,   label: 'BUSTED' },
    'PARTIALLY TRUE': { bg: '#FDEBD0', text: theme.warning,  label: 'PARTIALLY TRUE' },
    TRUE:             { bg: '#D5F5E3', text: theme.success,   label: 'TRUE' },
  };

  const v = verdictColors[myth.verdict] || verdictColors.BUSTED;

  return (
    <View style={[
      globalStyles.card,
      compact && styles.compact,
      { backgroundColor: theme.card, borderColor: theme.border },
    ]}>
      <View style={styles.header}>
        <Text style={styles.emoji}>{myth.emoji}</Text>
        <View style={[styles.badge, { backgroundColor: v.bg }]}>
          <Text style={[styles.badgeText, { color: v.text }]}>{v.label}</Text>
        </View>
      </View>
      <Text style={styles.myth} numberOfLines={compact ? 2 : undefined}>
        {myth.myth}
      </Text>
      <Text style={styles.explanation} numberOfLines={compact ? 2 : undefined}>
        {myth.explanation}
      </Text>
    </View>
  );
}

const createStyles = (theme) => StyleSheet.create({
  compact: { marginBottom: 8 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  emoji: { fontSize: 18 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: { fontSize: 11, fontWeight: '700' },
  myth: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.textPrimary,
    marginBottom: 8,
  },
  explanation: {
    fontSize: 13,
    color: theme.textSecondary,
    lineHeight: 19,
  },
});