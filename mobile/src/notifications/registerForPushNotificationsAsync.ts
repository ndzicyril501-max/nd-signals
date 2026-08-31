import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { registerDevice, registerWebPush } from '../api/client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Standard VAPID-key conversion: applicationServerKey must be a Uint8Array,
// but the key is generated/transported as a base64url string.
function urlBase64ToUint8Array(base64Url: string): Uint8Array {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

// expo-notifications explicitly does not support the web platform, so
// desktop/browser push is a completely separate implementation against the
// standard Push API -- a service worker (mobile/public/service-worker.js)
// plus PushManager.subscribe(), independent of everything above.
async function registerForWebPushAsync(): Promise<string | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('This browser does not support Web Push.');
    return null;
  }

  const vapidPublicKey = process.env.EXPO_PUBLIC_VAPID_PUBLIC_KEY;
  if (!vapidPublicKey) {
    console.warn('EXPO_PUBLIC_VAPID_PUBLIC_KEY is not set -- cannot subscribe to web push.');
    return null;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    console.warn('Web push permission was not granted.');
    return null;
  }

  const registration = await navigator.serviceWorker.register('service-worker.js');
  await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
    });
  }

  try {
    await registerWebPush(subscription.toJSON() as PushSubscriptionJSON);
  } catch (err) {
    console.warn('Failed to register web push subscription with backend:', err);
  }

  return subscription.endpoint;
}

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return registerForWebPushAsync();
  }

  if (!Device.isDevice) {
    console.warn('Push notifications require a physical device (or a dev-client build), not the simulator.');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.warn('Push notification permission was not granted.');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  // Push notifications require a real EAS project ID -- pulled from app config
  // rather than left to the (deprecated) implicit default, per Expo SDK 57 docs.
  // They also require a development build or EAS build; they do NOT work in
  // plain Expo Go on Android from SDK 53 onward.
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.warn('No EAS projectId configured (app.json extra.eas.projectId) -- run `eas init` first.');
    return null;
  }
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

  try {
    await registerDevice(token, Platform.OS === 'ios' ? 'ios' : 'android');
  } catch (err) {
    console.warn('Failed to register device token with backend:', err);
  }

  return token;
}
