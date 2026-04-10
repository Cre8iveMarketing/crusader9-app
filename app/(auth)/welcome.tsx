import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { SvgXml } from 'react-native-svg';

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 218.75 200">
  <g>
    <polygon fill="#fff" points="105.64 134.51 74.71 125.58 71.8 124.75 71.8 148.87 52.56 165.03 33.32 148.87 33.32 51.14 52.56 34.91 71.8 51.14 71.8 75.2 74.71 74.37 105.64 65.5 105.64 38.66 98.97 33.81 52.56 .03 41.94 7.77 33.29 14.07 0 38.35 0 161.6 33.29 185.93 41.69 192.05 52.56 200 98.92 166.18 105.64 161.28 105.64 134.51"/>
    <path fill="#fff" d="M218.75,38.35l-33.3-24.13-8.7-6.31-10.92-7.91-45.59,33.03-7.45,5.4v62.24l31.24,15.62,21.79,10.9,19.22-15.97v37.63l-19.22,16.23-19.22-16.23v-24.1l-2.58.72-31.24,8.76v27.06l7.13,5.21,45.91,33.48,10.83-7.9,8.8-6.42,33.3-24.29V38.35ZM185.04,77.94l-19.22,12.98-19.22-9.46v-30.3l19.22-16.24,19.22,16.24v26.78Z"/>
  </g>
</svg>`;

export default function Welcome() {
  const router = useRouter();
  return (
    <View style={s.container}>
      <View style={s.hero}>
        <SvgXml xml={LOGO_SVG} width={80} height={80} />
        <Text style={s.title}>CRUSADER 9</Text>
        <Text style={s.subtitle}>Boxing & Fitness</Text>
      </View>
      <View style={s.buttons}>
        <TouchableOpacity style={s.primary} onPress={() => router.push('/(auth)/login')}>
          <Text style={s.primaryText}>Member Login</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.secondary} onPress={() => router.push('/(auth)/plans')}>
          <Text style={s.secondaryText}>Join Now</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, justifyContent: 'space-between', padding: 32 },
  hero: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  title: { fontSize: 36, fontWeight: '900', color: Colors.white, letterSpacing: 6 },
  subtitle: { fontSize: 14, color: Colors.textMuted, letterSpacing: 3 },
  buttons: { gap: 12, paddingBottom: 24 },
  primary: { backgroundColor: Colors.white, padding: 16, borderRadius: 10, alignItems: 'center' },
  primaryText: { color: Colors.bg, fontSize: 15, fontWeight: '700' },
  secondary: { backgroundColor: Colors.surface, padding: 16, borderRadius: 10, alignItems: 'center', borderWidth: 1, borderColor: Colors.border },
  secondaryText: { color: Colors.text, fontSize: 15, fontWeight: '600' },
});
