import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

export default function FibLadderTable({ title, levels }: { title: string; levels: Record<string, number> }) {
  const entries = Object.entries(levels).sort((a, b) => Number(a[0]) - Number(b[0]));
  if (entries.length === 0) return null;
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {entries.map(([ratio, price]) => (
        <View key={ratio} style={styles.row}>
          <Text style={styles.ratio}>{Number(ratio).toFixed(3)}</Text>
          <Text style={styles.price}>{price}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  ratio: {
    color: colors.textTertiary,
    fontVariant: ['tabular-nums'],
  },
  price: {
    color: colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
});
