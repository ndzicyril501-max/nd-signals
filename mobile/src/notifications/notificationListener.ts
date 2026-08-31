import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { navigationRef } from '../navigation/RootNavigator';
import { setSection, setSelectedSignalId } from '../state/navStore';

function navigateToSignal(data: Record<string, unknown> | undefined) {
  const signalId = data?.signal_id;
  if (typeof signalId !== 'number') return;
  if (navigationRef.isReady()) {
    // Detail lives inside the Signals tab's nested stack.
    navigationRef.navigate('Signals', { screen: 'Detail', params: { signalId } });
  }
}

// Web doesn't use react-navigation at all (see src/web/WebAppShell.tsx and
// src/state/navStore.ts), so there's no "is the navigator ready" concern
// the way there is on mobile -- these are plain, synchronous state updates.
function navigateToSignalWeb(signalId: number) {
  setSection('signals');
  setSelectedSignalId(signalId);
}

function setupWebNotificationTapHandling(): () => void {
  // Already-open window: the service worker posts a message on notificationclick.
  const onMessage = (event: MessageEvent) => {
    if (event.data?.type === 'nd-signal-notification-click' && typeof event.data.signal_id === 'number') {
      navigateToSignalWeb(event.data.signal_id);
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
      navigateToSignalWeb(signalId);
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
