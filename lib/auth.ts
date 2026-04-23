import * as SecureStore from 'expo-secure-store';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Alert, Platform } from 'react-native';

const TOKEN_KEY = 'mobile_jwt';

export async function saveToken(token: string) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function getToken(): Promise<string | null> {
  return await SecureStore.getItemAsync(TOKEN_KEY);
}

export async function deleteToken() {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

export async function registerPushToken(authToken: string) {
  Alert.alert('registerPushToken called', 'starting...');
  try {
    if (!Device.isDevice) {
      console.log('Push: skipping - not a real device');
      return;
    }
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    console.log('Push: existing permission status:', existingStatus);
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    console.log('Push: final permission status:', finalStatus);
    if (finalStatus !== 'granted') return;
    const projectId = '6e01da50-f7de-4634-873b-b257b0c1fe31';
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    console.log('Push: got token:', tokenData.data);
    const response = await fetch('https://app.crusader9.co.uk/api/member/push-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ token: tokenData.data, platform: Platform.OS })
    });
    console.log('Push: server response:', response.status);
  } catch (e: any) {
    console.error('Push registration failed:', e?.message ?? e);
    Alert.alert('Push Debug', e?.message ?? JSON.stringify(e));
  }
}
