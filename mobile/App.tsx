import { useCallback, useEffect } from 'react';
import { Platform, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
} from '@expo-google-fonts/jetbrains-mono';
import RootNavigator from './src/navigation/RootNavigator';
import BrandFooter from './src/components/BrandFooter';
import { registerForPushNotificationsAsync } from './src/notifications/registerForPushNotificationsAsync';
import { setupNotificationTapHandling } from './src/notifications/notificationListener';
import { ThemeProvider, useTheme } from './src/theme';

SplashScreen.preventAutoHideAsync();

// The UI is phone-width-oriented; on a desktop browser window this keeps it
// from stretching into an unreadably wide single column instead of a
// redesign for wide viewports.
const DESKTOP_MAX_WIDTH = 480;

function AppShell({ onLayoutRootView }: { onLayoutRootView: () => void }) {
  const { colors, resolvedMode } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }} onLayout={onLayoutRootView}>
      <View style={Platform.OS === 'web' ? { flex: 1, width: '100%', maxWidth: DESKTOP_MAX_WIDTH, alignSelf: 'center' } : { flex: 1 }}>
        <RootNavigator />
      </View>
      <View style={Platform.OS === 'web' ? { width: '100%', maxWidth: DESKTOP_MAX_WIDTH, alignSelf: 'center' } : undefined}>
        <BrandFooter />
      </View>
      <StatusBar style={resolvedMode === 'dark' ? 'light' : 'dark'} />
    </View>
  );
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });

  useEffect(() => {
    registerForPushNotificationsAsync();
    const teardown = setupNotificationTapHandling();
    return teardown;
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (fontsLoaded) {
      await SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppShell onLayoutRootView={onLayoutRootView} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
