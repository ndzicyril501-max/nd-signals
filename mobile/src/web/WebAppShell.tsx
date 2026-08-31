import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Sidebar from './Sidebar';
import SignalsSplitView from './SignalsSplitView';
import PerformanceScreen from '../screens/PerformanceScreen';
import SettingsScreen from '../screens/SettingsScreen';
import { useSection } from '../state/navStore';
import { Colors, useTheme } from '../theme';

// The web/desktop layout entirely bypasses react-navigation's navigator
// tree (no Tab/Stack navigator here) -- a fixed sidebar plus, for Signals,
// a master-detail split view isn't well served by a bottom-tab or stack
// navigator's layout assumptions, so this is a hand-rolled shell instead.
// See src/state/navStore.ts for how push-notification taps drive this
// without navigationRef.
export default function WebAppShell() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [section, setSection] = useSection();

  return (
    <View style={styles.root}>
      <Sidebar active={section} onSelect={setSection} />
      <View style={styles.content}>
        {section === 'signals' && <SignalsSplitView />}
        {section === 'performance' && <PerformanceScreen />}
        {section === 'settings' && <SettingsScreen />}
      </View>
    </View>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    root: { flex: 1, flexDirection: 'row', backgroundColor: colors.background },
    content: { flex: 1 },
  });
}
