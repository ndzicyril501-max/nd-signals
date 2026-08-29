import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useScanStatus } from '../api/hooks';
import { colors, fonts } from '../theme';

// Matches the cron-job.org schedule set up for this backend (see README).
// If that schedule ever changes, this is the one place to update it.
const ASSUMED_SCAN_INTERVAL_SEC = 10 * 60;

function useCountdown(lastStartedAt: string | null | undefined): number | null {
  const [secsLeft, setSecsLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!lastStartedAt) {
      setSecsLeft(null);
      return;
    }
    const anchor = new Date(lastStartedAt.endsWith('Z') ? lastStartedAt : `${lastStartedAt}Z`).getTime();
    const tick = () => {
      const elapsed = (Date.now() - anchor) / 1000;
      setSecsLeft(Math.max(0, Math.round(ASSUMED_SCAN_INTERVAL_SEC - elapsed)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [lastStartedAt]);

  return secsLeft;
}

function formatMmSs(secs: number): string {
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

export default function ScanCountdown() {
  const { data } = useScanStatus();
  const secsLeft = useCountdown(data?.last_started_at);
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.25, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const label = secsLeft == null ? 'SCAN —:—' : `SCAN ${formatMmSs(secsLeft)}`;

  return (
    <View style={styles.pill}>
      <Animated.View style={[styles.dot, { opacity: pulse }]} />
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(201,162,74,0.32)',
  },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.gold },
  label: { fontFamily: fonts.monoBold, fontSize: 9.5, letterSpacing: 1, color: colors.gold },
});
