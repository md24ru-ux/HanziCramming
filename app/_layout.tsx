import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AlertProvider } from '@/template';
import { StudyProvider } from '@/contexts/StudyContext';
export function RootLayout() {
  return <AlertProvider><SafeAreaProvider><StudyProvider><Stack screenOptions={{ headerShown: false }}><Stack.Screen name="index" /></Stack></StudyProvider></SafeAreaProvider></AlertProvider>;
}
export default RootLayout;
