import React, { useMemo, useState } from 'react';
import {
  ScrollView,
  Text,
  View,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { myths } from '../data/myths';
import { useTheme } from '../contexts/ThemeContext';

const FILTERS = [
  { key: 'All', label: 'All', dot: null },
  { key: 'BUSTED', label: 'Busted', dot: 'danger' },
  { key: 'PARTIALLY TRUE', label: 'Partially True', dot: 'warning' },
  { key: 'TRUE', label: 'True', dot: 'success' },
];

const verdictMap = {
  BUSTED: { bgKey: 'danger', label: 'BUSTED' },
  'PARTIALLY TRUE': { bgKey: 'warning', label: 'PARTIALLY TRUE' },
  TRUE: { bgKey: 'success', label: 'TRUE' },
};

export default function MythBustingScreen() {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const [selected, setSelected] = useState('All');

  const filteredMyths = useMemo(() => {
    if (selected === 'All') return myths;
    return myths.filter((item) => item.verdict === selected);
  }, [selected]);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <LinearGradient
        colors={[theme.primary, theme.accent]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        <Ionicons name="bulb-outline" size={46} color="rgba(255,255,255,0.95)" />
        <Text style={styles.heroTitle}>Myth Busters</Text>
        <Text style={styles.heroSubtitle}>Anemia facts for Pakistani women</Text>
      </LinearGradient>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {FILTERS.map((filter) => {
          const isSelected = selected === filter.key;
          const dotColor = filter.dot ? theme[filter.dot] : null;

          return (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterChip,
                isSelected && { backgroundColor: theme.primary, borderColor: theme.primary },
              ]}
              onPress={() => setSelected(filter.key)}
            >
              {dotColor ? <View style={[styles.dot, { backgroundColor: dotColor }]} /> : null}
              <Text style={[styles.filterText, isSelected && { color: theme.white }]}>{filter.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.listWrap}>
        {filteredMyths.map((myth) => {
          const verdict = verdictMap[myth.verdict] || verdictMap.BUSTED;
          const verdictColor = theme[verdict.bgKey];

          return (
            <View key={myth.id} style={styles.card}>
              <View style={styles.cardTopRow}>
                <Text style={styles.emoji}>{myth.emoji}</Text>
                <View style={[styles.verdictBadge, { backgroundColor: verdictColor }]}>
                  <Text style={styles.verdictText}>{verdict.label}</Text>
                </View>
              </View>

              <Text style={styles.mythText}>"{myth.myth}"</Text>

              <View style={styles.divider} />

              <Text style={styles.explanation}>{myth.explanation}</Text>
            </View>
          );
        })}
      </View>

      <Text style={styles.disclaimer}>
        Information for awareness only. Consult a doctor for medical advice.
      </Text>
    </ScrollView>
  );
}

const createStyles = (theme) => StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: theme.background,
  },
  content: {
    paddingBottom: 28,
  },
  hero: {
    height: 160,
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  heroTitle: {
    marginTop: 6,
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  filterRow: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 10,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: theme.card,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  filterText: {
    fontSize: 13,
    color: theme.textPrimary,
    fontWeight: '500',
  },
  listWrap: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  card: {
    backgroundColor: theme.card,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  emoji: {
    fontSize: 32,
  },
  verdictBadge: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  verdictText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  mythText: {
    marginVertical: 12,
    fontSize: 16,
    fontWeight: '600',
    color: theme.textPrimary,
    fontStyle: 'italic',
  },
  divider: {
    height: 1,
    backgroundColor: theme.border,
    marginBottom: 10,
  },
  explanation: {
    fontSize: 14,
    color: theme.textSecondary,
    lineHeight: 20,
  },
  disclaimer: {
    paddingHorizontal: 16,
    paddingTop: 4,
    fontSize: 12,
    color: theme.textSecondary,
    fontStyle: 'italic',
  },
});