import { NavigationContainer } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  type NativeStackScreenProps,
} from '@react-navigation/native-stack';
import CCCDCapture from '../features/ekyc/presentation/screens/CCCDCapture';
import CCCDCapturePreview from '../features/ekyc/presentation/screens/CCCDCapturePreview';
import CCCDOcr from '../features/ekyc/presentation/screens/CCCDOcr';

export type RootStackParamList = {
  CCCDCapture: undefined;
  CCCDCapturePreview: undefined;
  CCCDOcr: undefined;
};

export type ScreenProps = NativeStackScreenProps<RootStackParamList, any>;

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="CCCDCapture"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="CCCDCapture" component={CCCDCapture} />
        <Stack.Screen
          name="CCCDCapturePreview"
          component={CCCDCapturePreview}
        />
        <Stack.Screen name="CCCDOcr" component={CCCDOcr} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
