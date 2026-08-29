import { DarkTheme, NavigationContainer, Theme, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import SignalFeedScreen from '../screens/SignalFeedScreen';
import SignalDetailScreen from '../screens/SignalDetailScreen';
import PerformanceScreen from '../screens/PerformanceScreen';
import { colors, fonts } from '../theme';

export type SignalsStackParamList = {
  Feed: undefined;
  Detail: { signalId: number };
};

export type RootTabParamList = {
  Signals: undefined;
  Performance: undefined;
};

// Kept as the type other files (push-notification deep link) navigate
// against -- it's really the nested signals-stack param list.
export type RootStackParamList = SignalsStackParamList;

const Stack = createNativeStackNavigator<SignalsStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();

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

function SignalsStack() {
  return (
    <Stack.Navigator initialRouteName="Feed" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Feed" component={SignalFeedScreen} />
      <Stack.Screen name="Detail" component={SignalDetailScreen} />
    </Stack.Navigator>
  );
}

// A listener registered outside any screen (e.g. a push-notification tap
// handler at the app root) can't rely on a screen's own `navigation` prop --
// it may fire before the navigator has mounted. A ref gives it a stable
// handle to navigate with regardless of when it fires. Nested navigator
// routes are addressed as { screen, params }.
export const navigationRef = createNavigationContainerRef<Record<string, object | undefined>>();

export default function RootNavigator() {
  const insets = useSafeAreaInsets();
  return (
    <NavigationContainer ref={navigationRef} theme={ndTheme}>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.headerBg,
            borderTopColor: colors.border,
            height: 50 + insets.bottom,
            paddingTop: 6,
            paddingBottom: insets.bottom + 4,
          },
          tabBarActiveTintColor: colors.gold,
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
      </Tab.Navigator>
    </NavigationContainer>
  );
}
