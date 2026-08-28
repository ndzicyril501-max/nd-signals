import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
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
    <>
      <RootNavigator />
      <StatusBar style="light" />
    </>
  );
}
