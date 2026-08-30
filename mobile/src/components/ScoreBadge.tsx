import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, fonts, radius, scoreTier, useTheme } from '../theme';

export default function ScoreBadge({ score }: { score: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const tier = scoreTier(score, colors);
  const neutralFg = scoreTier(7, colors).fg;
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
      <Text style={[styles.suffix, { color: tier.fg === neutralFg ? tier.fg : colors.accentMuted }]}>/10</Text>
    </View>
  );
}

function createStyles(_colors: Colors) {
  return StyleSheet.create({
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
}
