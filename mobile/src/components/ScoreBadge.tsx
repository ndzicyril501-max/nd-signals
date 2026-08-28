import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, scoreColor } from '../theme';

export default function ScoreBadge({ score }: { score: number }) {
  const tint = scoreColor(score);
  return (
    <View style={[styles.badge, { borderColor: tint, backgroundColor: `${tint}26` }]}>
      <Text style={[styles.text, { color: tint }]}>{score}/10</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  text: {
    fontWeight: '700',
    fontSize: 13,
  },
});
