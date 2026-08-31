import { Platform } from 'react-native';
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

// The web cold-start case (app launched fresh by a notification click, see
// service-worker.js's clients.openWindow) reads a plain URL query param
// instead of Expo's getLastNotificationResponseAsync -- window.location is
// available immediately, but the navigator likely isn't ready on the very
// first tick yet, so poll briefly rather than silently dropping the link.
function waitForNavigationReady(maxAttempts = 20, intervalMs = 100): Promise<boolean> {
  return new Promise((resolve) => {
    let attempts = 0;
    const check = () => {
      if (navigationRef.isReady()) {
        resolve(true);
        return;
      }
      attempts += 1;
      if (attempts >= maxAttempts) {
        resolve(false);
        return;
      }
      setTimeout(check, intervalMs);
    };
    check();
  });
}

function setupWebNotificationTapHandling(): () => void {
  // Already-open window: the service worker posts a message on notificationclick.
  const onMessage = (event: MessageEvent) => {
    if (event.data?.type === 'nd-signal-notification-click') {
      navigateToSignal({ signal_id: event.data.signal_id });
    }
  };
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', onMessage);
  }

  // Cold start: the service worker opened a fresh window at ?signal=<id>.
  if (typeof window !== 'undefined') {
    const raw = new URLSearchParams(window.location.search).get('signal');
    const signalId = raw != null ? Number(raw) : NaN;
    if (!Number.isNaN(signalId)) {
      waitForNavigationReady().then((ready) => {
        if (ready) navigateToSignal({ signal_id: signalId });
      });
    }
  }

  return () => {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.removeEventListener('message', onMessage);
    }
  };
}

/** Call once near the app root. Handles a tap while the app is foregrounded,
 * backgrounded, or was killed (cold start via getLastNotificationResponseAsync,
 * since the live listener below can't catch a tap that happened before it
 * was ever registered). */
export function setupNotificationTapHandling(): () => void {
  if (Platform.OS === 'web') {
    return setupWebNotificationTapHandling();
  }

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
