import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AlertProvider } from '@/template';
export function RootLayout() {
  return <AlertProvider><SafeAreaProvider><Stack screenOptions={{ headerShown: false }}><Stack.Screen name="index" /></Stack></SafeAreaProvider></AlertProvider>;
}
export default RootLayout;
