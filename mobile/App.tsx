import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import RootNavigator from './src/navigation/RootNavigator';
import { registerForPushNotificationsAsync } from './src/notifications/registerForPushNotificationsAsync';
import { setupNotificationTapHandling } from './src/notifications/notificationListener';

export default function App() {
  useEffect(() => {
    registerForPushNotificationsAsync();
    const teardown = setupNotificationTapHandling();
    return teardown;
  }, []);

  return (
    <SafeAreaProvider>
      <RootNavigator />
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}
