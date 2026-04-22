import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ImageBackground, Image, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit() {
    if (!email.trim()) { Alert.alert('Required', 'Please enter your email address'); return; }
    setLoading(true);
    try {
      const res = await fetch('https://app.crusader9.co.uk/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      // Always show success to avoid email enumeration
      setSent(true);
    } catch {
      Alert.alert('Error', 'Could not connect. Please try again.');
    } finally { setLoading(false); }
  }

  return (
    <ImageBackground source={require('../../assets/login-bg.jpg')} style={s.bg} resizeMode="cover">
      <View style={s.overlay} />
      <SafeAreaView style={s.safe}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.kav}>
          <View style={s.card}>
            <Image
              source={require('../../assets/c9-logo.png')}
              style={s.logoImage}
              resizeMode="contain"
            />
            <Text style={s.logoSub}>MEMBER PORTAL</Text>

            {!sent ? (
              <>
                <Text style={s.title}>Reset Password</Text>
                <Text style={s.sub}>Enter your email and we'll send you a reset link.</Text>
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
                <TouchableOpacity style={[s.btn, loading && { opacity: 0.7 }]} onPress={handleSubmit} disabled={loading} activeOpacity={0.85}>
                  {loading
                    ? <ActivityIndicator color="#000" size="small" />
                    : <Text style={s.btnText}>Send reset link</Text>
                  }
                </TouchableOpacity>
              </>
            ) : (
              <View style={s.sentBox}>
                <Text style={s.sentIcon}>✉️</Text>
                <Text style={s.sentTitle}>Check your email</Text>
                <Text style={s.sentSub}>If an account exists for {email}, you'll receive a password reset link shortly.</Text>
              </View>
            )}

            <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
              <Text style={s.backBtnText}>← Back to sign in</Text>
            </TouchableOpacity>
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
  kav: { flex: 1, justifyContent: 'center', padding: 24 },
  card: { backgroundColor: 'rgba(18,18,18,0.85)', borderRadius: 20, padding: 28, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 14 },
  logoImage: { width: 200, height: 100, alignSelf: 'center' },
  logoSub: { textAlign: 'center', fontSize: 11, fontWeight: '700', color: '#8e8e93', letterSpacing: 3 },
  title: { fontSize: 20, fontWeight: '800', color: '#fff', textAlign: 'center' },
  sub: { fontSize: 14, color: '#a1a1aa', textAlign: 'center', lineHeight: 20 },
  label: { fontSize: 12, color: '#a1a1aa' },
  input: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: 14, color: '#fff', fontSize: 15 },
  btn: { backgroundColor: '#fff', padding: 16, borderRadius: 12, alignItems: 'center' },
  btnText: { color: '#0a0a0a', fontWeight: '800', fontSize: 16 },
  sentBox: { alignItems: 'center', gap: 10, paddingVertical: 8 },
  sentIcon: { fontSize: 48 },
  sentTitle: { fontSize: 18, fontWeight: '800', color: '#fff' },
  sentSub: { fontSize: 13, color: '#a1a1aa', textAlign: 'center', lineHeight: 19 },
  backBtn: { alignItems: 'center', paddingVertical: 4 },
  backBtnText: { color: '#a1a1aa', fontSize: 14 },
});
