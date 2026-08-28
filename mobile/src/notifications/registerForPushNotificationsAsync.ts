import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { registerDevice } from '../api/client';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<string | null> {
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
