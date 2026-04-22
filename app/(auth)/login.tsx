import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ImageBackground, Image, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { saveToken } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';

export default function Login() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password) { Alert.alert('Required', 'Please enter your email and password'); return; }
    setLoading(true);
    try {
      const res = await fetch('https://app.crusader9.co.uk/api/mobile/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      });
      const data = await res.json();
      if (!res.ok) { Alert.alert('Sign in failed', data.error ?? 'Invalid email or password'); return; }
      await saveToken(data.token);
      await refresh();
      router.replace('/(tabs)/');
    } catch { Alert.alert('Error', 'Could not connect. Please check your connection.'); }
    finally { setLoading(false); }
  }

  return (
    <ImageBackground
      source={require('../../assets/login-bg.jpg')}
      style={s.bg}
      resizeMode="cover">
      {/* Dark overlay */}
      <View style={s.overlay} />
      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.kav}>

          {/* Centred login card */}
          <View style={s.card}>
            {/* C9 logo text */}
            <Image
              source={require('../../assets/c9-logo.png')}
              style={s.logoImage}
              resizeMode="contain"
            />
            <Text style={s.logoSub}>MEMBER PORTAL</Text>

            {/* Fields */}
            <View style={s.fields}>
              <Text style={s.label}>Email</Text>
              <TextInput
                style={s.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#8e8e93"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <View style={s.passwordHeader}>
                <Text style={s.label}>Password</Text>
                <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')}>
                  <Text style={s.forgotText}>Forgot password?</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={s.input}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor="#8e8e93"
                secureTextEntry
                onSubmitEditing={handleLogin}
                returnKeyType="go"
              />
            </View>

            <TouchableOpacity style={[s.signInBtn, loading && { opacity: 0.7 }]} onPress={handleLogin} disabled={loading} activeOpacity={0.85}>
              {loading
                ? <ActivityIndicator color="#000" size="small" />
                : <Text style={s.signInBtnText}>Sign in</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Not a member CTA */}
          <View style={s.footer}>
            <Text style={s.footerText}>New to Crusader 9?</Text>
            <View style={s.footerBtns}>
              <TouchableOpacity style={s.footerBtn} onPress={() => router.push('/(auth)/register')}>
                <Text style={s.footerBtnText}>Become a member</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.footerBtn} onPress={() => router.push('/(auth)/plans')}>
                <Text style={s.footerBtnText}>Membership Options</Text>
              </TouchableOpacity>
            </View>
          </View>

        </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.72)' },
  safe: { flex: 1 },
  kav: { flex: 1, justifyContent: 'center', padding: 24, gap: 20 },
  card: { backgroundColor: 'rgba(18,18,18,0.85)', borderRadius: 20, padding: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 20 },
  logoImage: { width: 200, height: 100, alignSelf: 'center' },
  logoSub: { textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#8e8e93', letterSpacing: 3 },
  fields: { gap: 6 },
  label: { fontSize: 12, color: '#a1a1aa', marginBottom: 4 },
  passwordHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  forgotText: { fontSize: 12, color: '#a1a1aa' },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 14, color: '#fff', fontSize: 15 },
  signInBtn: { backgroundColor: '#fff', padding: 16, borderRadius: 12, alignItems: 'center' },
  signInBtnText: { color: '#0a0a0a', fontWeight: '800', fontSize: 16 },
  footer: { backgroundColor: 'rgba(18,18,18,0.75)', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', gap: 12, alignItems: 'center' },
  footerText: { color: '#a1a1aa', fontSize: 14 },
  footerBtns: { flexDirection: 'row', gap: 10, width: '100%' },
  footerBtn: { flex: 1, minHeight: 56, backgroundColor: 'rgba(255,255,255,0.08)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 13, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  footerBtnText: { color: '#fff', fontWeight: '600', fontSize: 14, textAlign: 'center' },
});
