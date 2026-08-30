import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Colors, fonts, useTheme } from '../theme';

export default function StatCard({ value, unit, label, accent }: { value: string; unit?: string; label: string; accent?: boolean }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.card}>
      <Text style={[styles.value, { color: accent ? colors.accent : colors.textPrimary }]}>
        {value}
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    card: { flex: 1, paddingVertical: 9, paddingHorizontal: 4, alignItems: 'center' },
    value: { fontFamily: fonts.monoBold, fontSize: 15 },
    unit: { fontFamily: fonts.monoRegular, fontSize: 10, color: colors.textQuaternary },
    label: {
      fontFamily: fonts.monoRegular,
      fontSize: 8.5,
      letterSpacing: 1,
      color: colors.textQuaternary,
      marginTop: 2,
    },
  });
}
