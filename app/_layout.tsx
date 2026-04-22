import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/context/AuthContext';
import { Colors } from '@/constants/colors';
import { StripeProvider } from '@stripe/stripe-react-native';

export default function RootLayout() {
  return (
    <StripeProvider publishableKey="pk_live_51TI63MJFmkiQ7SacoJWQpo0agtz40yqGqyxLJhfFg5dhQ53XZ56IpF6r3A7UqrUYx1xvpO03BxWcKjMtzRjg1blv004HjLtRg6">
      <AuthProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{
          headerStyle: { backgroundColor: Colors.bg },
          headerTintColor: Colors.white,
          headerTitleStyle: { color: Colors.text, fontWeight: '700' },
          contentStyle: { backgroundColor: Colors.bg },
          headerShadowVisible: false,
        }}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="profile" options={{ headerShown: false }} />
          <Stack.Screen name="child" options={{ headerShown: false }} />
          <Stack.Screen name="add-child" options={{ headerShown: false }} />
        </Stack>
      </AuthProvider>
    </StripeProvider>
  );
}
