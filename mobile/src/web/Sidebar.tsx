import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, fonts, useTheme } from '../theme';
import { Section } from '../state/navStore';

const ITEMS: { key: Section; label: string; icon: string }[] = [
  { key: 'signals', label: 'SIGNALS', icon: '◈' },
  { key: 'performance', label: 'PERFORMANCE', icon: '◱' },
  { key: 'settings', label: 'SETTINGS', icon: '◐' },
];

export const SIDEBAR_WIDTH = 116;

export default function Sidebar({ active, onSelect }: { active: Section; onSelect: (section: Section) => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.sidebar}>
      <View style={styles.brandMark}>
        <Text style={styles.brandMarkText}>ND</Text>
      </View>
      <View style={styles.items}>
        {ITEMS.map((item) => {
          const selected = item.key === active;
          return (
            <TouchableOpacity
              key={item.key}
              style={[styles.item, selected && styles.itemSelected]}
              onPress={() => onSelect(item.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.icon, { color: selected ? colors.accent : colors.textQuaternary }]}>{item.icon}</Text>
              <Text style={[styles.label, { color: selected ? colors.accent : colors.textQuaternary }]} numberOfLines={1}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    sidebar: {
      width: SIDEBAR_WIDTH,
      backgroundColor: colors.headerBg,
      borderRightWidth: 1,
      borderRightColor: colors.border,
      alignItems: 'center',
      paddingTop: 20,
    },
    brandMark: {
      width: 34,
      height: 34,
      borderWidth: 1.6,
      borderColor: colors.accent,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 24,
    },
    brandMarkText: { fontFamily: fonts.monoBold, fontSize: 12, color: colors.accent },
    items: { width: '100%', gap: 4 },
    item: {
      alignItems: 'center',
      paddingVertical: 12,
      gap: 6,
      borderLeftWidth: 2,
      borderLeftColor: 'transparent',
    },
    itemSelected: {
      backgroundColor: colors.surfaceElevated,
      borderLeftColor: colors.accent,
    },
    icon: { fontSize: 18 },
    label: { fontFamily: fonts.monoBold, fontSize: 8.5, letterSpacing: 0.5 },
  });
}
