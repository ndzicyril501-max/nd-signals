import { Image, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

export default function BrandFooter() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingBottom: spacing.md + insets.bottom }]}>
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
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  mark: {
    width: 22,
    height: 22,
    borderRadius: 5,
    marginRight: spacing.sm,
  },
  name: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tagline: {
    fontSize: 9,
    letterSpacing: 1,
    color: colors.textTertiary,
    marginTop: 1,
  },
});
