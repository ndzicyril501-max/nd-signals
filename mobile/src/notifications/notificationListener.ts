import * as Notifications from 'expo-notifications';
import { navigationRef } from '../navigation/RootNavigator';

function navigateToSignal(data: Record<string, unknown> | undefined) {
  const signalId = data?.signal_id;
  if (typeof signalId !== 'number') return;
  if (navigationRef.isReady()) {
    // Detail lives inside the Signals tab's nested stack.
    navigationRef.navigate('Signals', { screen: 'Detail', params: { signalId } });
  }
}

/** Call once near the app root. Handles a tap while the app is foregrounded,
 * backgrounded, or was killed (cold start via getLastNotificationResponseAsync,
 * since the live listener below can't catch a tap that happened before it
 * was ever registered). */
export function setupNotificationTapHandling(): () => void {
  Notifications.getLastNotificationResponseAsync().then((response) => {
    if (response) {
      navigateToSignal(response.notification.request.content.data as Record<string, unknown>);
    }
  });

  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    navigateToSignal(response.notification.request.content.data as Record<string, unknown>);
  });

  return () => subscription.remove();
}
