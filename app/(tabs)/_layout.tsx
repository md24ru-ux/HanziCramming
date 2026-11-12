/*
 * @Description: 
 */

// Powered by OnSpace.AI
import { MaterialIcons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';

export default function TabLayout() {

  const insets = useSafeAreaInsets();

  const tabBarStyle = {
    height: Platform.select({
      ios: insets.bottom + 60,
      android: insets.bottom + 60,
      default: 70,
    }),
    paddingTop: 8,
    paddingBottom: Platform.select({
      ios: insets.bottom + 8,
      android: insets.bottom + 8,
      default: 8,
    }),
    paddingHorizontal: 16,
    backgroundColor: '#0a0a0a',
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  };

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle,
        tabBarActiveTintColor: '#FFD700',
        tabBarInactiveTintColor: '#666',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Gallery',
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="photo-library" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
