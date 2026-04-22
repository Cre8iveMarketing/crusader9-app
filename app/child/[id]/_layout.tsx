import { Stack, useRouter } from 'expo-router';
import { StatusBar, TouchableOpacity, View, Text } from 'react-native';
import { SvgXml } from 'react-native-svg';

const BACK_ARROW = `<svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" xmlns="http://www.w3.org/2000/svg"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>`;

export default function ChildSubLayout() {
  const router = useRouter();

  const backButton = (
    <TouchableOpacity onPress={() => router.back()} hitSlop={12}>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1a1a1a',
        borderRadius: 20,
        paddingLeft: 12,
        paddingRight: 15,
        paddingVertical: 8,
        gap: 6,
      }}>
        <SvgXml xml={BACK_ARROW} width={16} height={16} />
        <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '500', includeFontPadding: false }}>Back</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <Stack screenOptions={{
      headerStyle: { backgroundColor: '#0a0a0a', paddingTop: StatusBar.currentHeight } as any,
      headerTintColor: '#ffffff',
      headerTitleStyle: { fontWeight: '700', fontSize: 17 },
      headerTitleAlign: 'center',
      headerBackVisible: false,
      headerLeft: () => backButton,
      contentStyle: { backgroundColor: '#0a0a0a' },
      animation: 'slide_from_right',
    }} />
  );
}
