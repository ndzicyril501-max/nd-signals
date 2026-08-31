import { useMemo } from 'react';
import { DarkTheme, NavigationContainer, Theme, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackScreenProps } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, Text } from 'react-native';
import SignalFeedScreen from '../screens/SignalFeedScreen';
import SignalDetailScreen from '../screens/SignalDetailScreen';
import PerformanceScreen from '../screens/PerformanceScreen';
import SettingsScreen from '../screens/SettingsScreen';
import WebAppShell from '../web/WebAppShell';
import { useTheme, fonts } from '../theme';

export type SignalsStackParamList = {
  Feed: undefined;
  Detail: { signalId: number };
};

export type RootTabParamList = {
  Signals: undefined;
  Performance: undefined;
  Settings: undefined;
};

// Kept as the type other files (push-notification deep link) navigate
// against -- it's really the nested signals-stack param list.
export type RootStackParamList = SignalsStackParamList;

const Stack = createNativeStackNavigator<SignalsStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();

// SignalFeedScreen takes onSelectSignal/selectedSignalId/rightPane now
// (shared with the web split-view -- see src/web/SignalsSplitView.tsx)
// instead of a `navigation` prop directly; this is the thin adapter that
// wires it back into a real stack push for the mobile route.
function FeedRoute({ navigation }: NativeStackScreenProps<SignalsStackParamList, 'Feed'>) {
  return <SignalFeedScreen onSelectSignal={(signalId) => navigation.navigate('Detail', { signalId })} />;
}

function SignalsStack() {
  return (
    <Stack.Navigator initialRouteName="Feed" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Feed" component={FeedRoute} />
      <Stack.Screen name="Detail" component={SignalDetailScreen} />
    </Stack.Navigator>
  );
}

// A listener registered outside any screen (e.g. a push-notification tap
// handler at the app root) can't rely on a screen's own `navigation` prop --
// it may fire before the navigator has mounted. A ref gives it a stable
// handle to navigate with regardless of when it fires. Nested navigator
// routes are addressed as { screen, params }. Mobile-only -- the web shell
// doesn't use react-navigation at all (see src/state/navStore.ts).
export const navigationRef = createNavigationContainerRef<Record<string, object | undefined>>();

function MobileNavigator() {
  const { colors } = useTheme();

  const ndTheme: Theme = useMemo(
    () => ({
      ...DarkTheme,
      colors: {
        ...DarkTheme.colors,
        primary: colors.accent,
        background: colors.background,
        card: colors.surface,
        text: colors.textPrimary,
        border: colors.border,
        notification: colors.accent,
      },
    }),
    [colors]
  );

  return (
    <NavigationContainer ref={navigationRef} theme={ndTheme}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          // No bottom safe-area padding here on purpose -- BrandFooter
          // renders below this whole navigator (see App.tsx) and is the
          // thing that actually needs to clear the gesture nav / home bar.
          tabBarStyle: {
            backgroundColor: colors.headerBg,
            borderTopColor: colors.border,
            height: 50,
            paddingTop: 6,
            paddingBottom: 4,
          },
          tabBarActiveTintColor: colors.accent,
          tabBarInactiveTintColor: colors.textQuaternary,
          tabBarLabelStyle: { fontFamily: fonts.monoBold, fontSize: 9, letterSpacing: 1 },
        }}
      >
        <Tab.Screen
          name="Signals"
          component={SignalsStack}
          options={{
            tabBarLabel: 'SIGNALS',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 15 }}>◈</Text>,
          }}
        />
        <Tab.Screen
          name="Performance"
          component={PerformanceScreen}
          options={{
            tabBarLabel: 'PERFORMANCE',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 15 }}>◱</Text>,
          }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            tabBarLabel: 'SETTINGS',
            tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 15 }}>◐</Text>,
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function RootNavigator() {
  if (Platform.OS === 'web') {
    return <WebAppShell />;
  }
  return <MobileNavigator />;
}
