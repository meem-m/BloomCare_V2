import React from 'react';
import { Text, StyleSheet } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

export default function SectionHeader({ title }) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  return <Text style={styles.header}>{title}</Text>;
}

const createStyles = (theme) => StyleSheet.create({
  header: {
    fontSize: 17,
    fontWeight: '700',
    color: theme.primary,
    marginTop: 16,
    marginBottom: 10,
  },
});
