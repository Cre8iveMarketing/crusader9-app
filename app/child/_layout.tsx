import { Stack } from 'expo-router';

export default function ChildLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0a0a0a' }, animation: 'slide_from_right' }} />;
}
