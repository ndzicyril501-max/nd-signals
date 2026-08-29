import { Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, spacing } from '../theme';

// Rendered once, globally, below the entire tab navigator (see App.tsx) --
// it's meant to be the literal last thing on screen, under the Signals/
// Performance tab bar, so it needs its own bottom safe-area padding.
export default function BrandFooter() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingBottom: spacing.sm + insets.bottom }]}>
      <Image source={require('../../assets/brand-mark.png')} style={styles.mark} />
      <View>
        <Text style={styles.name}>Developed by ND Group</Text>
        <Text style={styles.tagline}>INNOVATE. CONNECT. BUILD VALUE.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  mark: {
    width: 20,
    height: 20,
    borderRadius: 5,
    marginRight: spacing.sm,
  },
  name: {
    fontFamily: fonts.sansMedium,
    fontSize: 11,
    color: colors.textTertiary,
  },
  tagline: {
    fontFamily: fonts.monoRegular,
    fontSize: 8.5,
    letterSpacing: 1.5,
    color: colors.textQuaternary,
    marginTop: 1,
  },
});
