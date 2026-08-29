import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing } from '../theme';

export default function BrandFooter() {
  return (
    <View style={styles.container}>
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
    paddingVertical: spacing.md,
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
