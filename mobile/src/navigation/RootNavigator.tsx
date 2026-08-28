import { DarkTheme, NavigationContainer, Theme, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SignalFeedScreen from '../screens/SignalFeedScreen';
import SignalDetailScreen from '../screens/SignalDetailScreen';
import { colors } from '../theme';

export type RootStackParamList = {
  Feed: undefined;
  Detail: { signalId: number };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const ndTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.gold,
    background: colors.background,
    card: colors.surface,
    text: colors.textPrimary,
    border: colors.border,
    notification: colors.gold,
  },
};

// A listener registered outside any screen (e.g. a push-notification tap
// handler at the app root) can't rely on a screen's own `navigation` prop --
// it may fire before the navigator has mounted. A ref gives it a stable
// handle to navigate with regardless of when it fires.
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export default function RootNavigator() {
  return (
    <NavigationContainer ref={navigationRef} theme={ndTheme}>
      <Stack.Navigator
        initialRouteName="Feed"
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.gold,
          headerTitleStyle: { color: colors.textPrimary, fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="Feed" component={SignalFeedScreen} options={{ title: 'ND Signals' }} />
        <Stack.Screen name="Detail" component={SignalDetailScreen} options={{ title: 'Signal Detail' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
