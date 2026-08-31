import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { SignalsStackParamList } from '../navigation/RootNavigator';
import SignalDetailContent from './SignalDetailContent';

type Props = NativeStackScreenProps<SignalsStackParamList, 'Detail'>;

// Mobile-only route wrapper: SignalDetailContent is shared with the web
// split-view panel (src/web/SignalsSplitView.tsx), which has no "back" to
// go to -- the actual header/body rendering lives there, this just supplies
// the navigation-specific bits (signalId from route params, back button).
export default function SignalDetailScreen({ route, navigation }: Props) {
  return <SignalDetailContent signalId={route.params.signalId} onBack={() => navigation.goBack()} />;
}
