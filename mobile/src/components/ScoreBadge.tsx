import { StyleSheet, Text, View } from 'react-native';
import { fonts, radius, scoreTier } from '../theme';

export default function ScoreBadge({ score }: { score: number }) {
  const tier = scoreTier(score);
  return (
    <View
      style={[
        styles.badge,
        {
          borderColor: tier.border,
          backgroundColor: tier.bg,
          shadowColor: tier.glow ? tier.fg : 'transparent',
          shadowOpacity: tier.glow ? 0.5 : 0,
          shadowRadius: tier.glow ? 10 : 0,
        },
      ]}
    >
      <Text style={[styles.score, { color: tier.fg }]}>{score}</Text>
      <Text style={[styles.suffix, { color: tier.fg === scoreTier(7).fg ? tier.fg : '#8a7038' }]}>/10</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: 8,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: 3,
  },
  score: {
    fontFamily: fonts.monoBold,
    fontSize: 13,
  },
  suffix: {
    fontFamily: fonts.monoRegular,
    fontSize: 10,
  },
});
