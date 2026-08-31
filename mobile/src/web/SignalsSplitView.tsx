import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import SignalFeedScreen from '../screens/SignalFeedScreen';
import SignalDetailContent from '../screens/SignalDetailContent';
import { useSelectedSignalId } from '../state/navStore';
import { Colors, fonts, useTheme } from '../theme';

function EmptyDetailPlaceholder() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyText}>Select a signal to view its details.</Text>
    </View>
  );
}

export default function SignalsSplitView() {
  const [selectedId, setSelectedId] = useSelectedSignalId();

  return (
    <SignalFeedScreen
      onSelectSignal={setSelectedId}
      selectedSignalId={selectedId}
      rightPane={selectedId != null ? <SignalDetailContent signalId={selectedId} /> : <EmptyDetailPlaceholder />}
    />
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
    emptyText: { fontFamily: fonts.sans, color: colors.textSecondary },
  });
}
