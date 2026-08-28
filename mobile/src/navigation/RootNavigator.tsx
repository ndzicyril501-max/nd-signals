import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SignalFeedScreen from '../screens/SignalFeedScreen';
import SignalDetailScreen from '../screens/SignalDetailScreen';

export type RootStackParamList = {
  Feed: undefined;
  Detail: { signalId: number };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

// A listener registered outside any screen (e.g. a push-notification tap
// handler at the app root) can't rely on a screen's own `navigation` prop --
// it may fire before the navigator has mounted. A ref gives it a stable
// handle to navigate with regardless of when it fires.
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export default function RootNavigator() {
  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator initialRouteName="Feed">
        <Stack.Screen name="Feed" component={SignalFeedScreen} options={{ title: 'Signals' }} />
        <Stack.Screen name="Detail" component={SignalDetailScreen} options={{ title: 'Signal Detail' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
