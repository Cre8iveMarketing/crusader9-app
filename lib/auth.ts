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
  try {
    if (!Device.isDevice) return;

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      Alert.alert('Push Debug', `Permission denied: ${finalStatus}`);
      return;
    }

    const projectId = '6e01da50-f7de-4634-873b-b257b0c1fe31';
    let tokenData;
    try {
      tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    } catch (tokenError: any) {
      Alert.alert('Push Debug', `getExpoPushToken failed: ${tokenError?.message}`);
      return;
    }

    Alert.alert('Push Debug', `Token: ${tokenData.data.slice(0, 30)}`);

    const response = await fetch('https://app.crusader9.co.uk/api/member/push-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({ token: tokenData.data, platform: Platform.OS })
    });

    const responseText = await response.text();
    Alert.alert('Push server response', `${response.status}: ${responseText}`);
  } catch (e: any) {
    Alert.alert('Push outer error', e?.message ?? JSON.stringify(e));
  }
}
