import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export default function FlagChecklist({ flags }: { flags: Record<string, boolean> }) {
  return (
    <View>
      {Object.entries(flags).map(([name, earned]) => (
        <View key={name} style={styles.row}>
          <Text style={[styles.icon, { color: earned ? colors.gold : colors.textTertiary }]}>
            {earned ? '✓' : '✗'}
          </Text>
          <Text style={[styles.label, { color: earned ? colors.textPrimary : colors.textTertiary }]}>{name}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
  },
  icon: {
    width: 20,
    fontWeight: '700',
    fontSize: 15,
  },
  label: {
    fontSize: 14,
  },
});
