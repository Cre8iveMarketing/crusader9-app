import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/colors';
import { SvgXml } from 'react-native-svg';

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 218.75 200"><polygon fill="#fff" points="105.64 134.51 74.71 125.58 71.8 124.75 71.8 148.87 52.56 165.03 33.32 148.87 33.32 51.14 52.56 34.91 71.8 51.14 71.8 75.2 74.71 74.37 105.64 65.5 105.64 38.66 98.97 33.81 52.56 .03 41.94 7.77 33.29 14.07 0 38.35 0 161.6 33.29 185.93 41.69 192.05 52.56 200 98.92 166.18 105.64 161.28 105.64 134.51"/><path fill="#fff" d="M218.75,38.35l-33.3-24.13-8.7-6.31-10.92-7.91-45.59,33.03-7.45,5.4v62.24l31.24,15.62,21.79,10.9,19.22-15.97v37.63l-19.22,16.23-19.22-16.23v-24.1l-2.58.72-31.24,8.76v27.06l7.13,5.21,45.91,33.48,10.83-7.9,8.8-6.42,33.3-24.29V38.35ZM185.04,77.94l-19.22,12.98-19.22-9.46v-30.3l19.22-16.24,19.22,16.24v26.78Z"/></svg>`;

export default function Login() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) { Alert.alert('Error', 'Please enter your email and password'); return; }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Login Failed', e.message ?? 'Invalid email or password');
    } finally { setLoading(false); }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: Colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.container}>
        <View style={s.logoRow}>
          <SvgXml xml={LOGO_SVG} width={36} height={36} />
          <Text style={s.logoText}>CRUSADER 9</Text>
        </View>
        <Text style={s.title}>Welcome back</Text>
        <Text style={s.subtitle}>Sign in to your membership</Text>
        <View style={s.form}>
          <TextInput style={s.input} placeholder="Email address" placeholderTextColor={Colors.textFaint}
            value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
          <TextInput style={s.input} placeholder="Password" placeholderTextColor={Colors.textFaint}
            value={password} onChangeText={setPassword} secureTextEntry />
          <TouchableOpacity style={[s.button, loading && s.buttonDisabled]} onPress={handleLogin} disabled={loading}>
            <Text style={s.buttonText}>{loading ? 'Signing in...' : 'Sign In'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.back()} style={s.back}>
            <Text style={s.backText}>← Back</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flexGrow: 1, padding: 28, justifyContent: 'center' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 32 },
  logoText: { color: Colors.white, fontSize: 18, fontWeight: '800', letterSpacing: 3 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.text, marginBottom: 6 },
  subtitle: { fontSize: 14, color: Colors.textMuted, marginBottom: 32 },
  form: { gap: 12 },
  input: { backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 14, color: Colors.text, fontSize: 15 },
  button: { backgroundColor: Colors.white, padding: 16, borderRadius: 10, alignItems: 'center', marginTop: 4 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: Colors.bg, fontSize: 15, fontWeight: '700' },
  back: { alignItems: 'center', padding: 10 },
  backText: { color: Colors.textMuted, fontSize: 14 },
});
