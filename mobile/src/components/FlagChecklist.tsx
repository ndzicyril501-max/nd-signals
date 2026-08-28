import { StyleSheet, Text, View } from 'react-native';

export default function FlagChecklist({ flags }: { flags: Record<string, boolean> }) {
  return (
    <View>
      {Object.entries(flags).map(([name, earned]) => (
        <View key={name} style={styles.row}>
          <Text style={[styles.icon, { color: earned ? '#1a8a4a' : '#c0392b' }]}>
            {earned ? '✓' : '✗'}
          </Text>
          <Text style={[styles.label, !earned && styles.labelMuted]}>{name}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  icon: {
    width: 20,
    fontWeight: '700',
    fontSize: 15,
  },
  label: {
    fontSize: 14,
  },
  labelMuted: {
    color: '#888',
  },
});
