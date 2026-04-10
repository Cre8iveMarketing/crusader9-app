import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform, Linking } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { apiPost } from '@/lib/api';
import { saveToken } from '@/lib/auth';
import { Colors } from '@/constants/colors';

export default function Register() {
  const router = useRouter();
  const { planId } = useLocalSearchParams<{ planId: string }>();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', password: '', confirmPassword: '',
    phone: '', dateOfBirth: '', emergencyName: '', emergencyPhone: '',
  });
  const [waiver, setWaiver] = useState({ fullName: '', ackRisk: false, healthConfirm: false, rulesAgree: false, mediaConsent: false, fullAgreement: false });

  function update(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function submit() {
    if (!waiver.ackRisk || !waiver.healthConfirm || !waiver.rulesAgree || !waiver.fullAgreement) {
      Alert.alert('Waiver Required', 'Please complete all required waiver fields'); return;
    }
    if (!waiver.fullName) { Alert.alert('Waiver Required', 'Please enter your full name to sign the waiver'); return; }
    setLoading(true);
    try {
      const res = await apiPost('/register', { ...form, planId, waiverSignature: waiver });
      if (res.stripeUrl) {
        await Linking.openURL(res.stripeUrl);
        router.replace('/(auth)/welcome');
      } else {
        await saveToken(res.token);
        router.replace('/(tabs)');
      }
    } catch (e: any) {
      Alert.alert('Registration Failed', e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <TouchableOpacity onPress={() => step > 1 ? setStep(s => s - 1) : router.back()}>
          <Text style={styles.back}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>{step === 1 ? 'Your Details' : step === 2 ? 'Emergency Contact' : 'Health Waiver'}</Text>
        <Text style={styles.step}>Step {step} of 3</Text>

        {step === 1 && (
          <View style={styles.form}>
            {[['firstName','First Name'],['lastName','Last Name'],['email','Email Address'],['password','Password'],['confirmPassword','Confirm Password'],['phone','Phone Number'],['dateOfBirth','Date of Birth (YYYY-MM-DD)']].map(([k, label]) => (
              <View key={k}>
                <Text style={styles.label}>{label}</Text>
                <TextInput style={styles.input} value={form[k as keyof typeof form]} onChangeText={v => update(k, v)}
                  secureTextEntry={k.includes('assword')} keyboardType={k === 'email' ? 'email-address' : 'default'}
                  autoCapitalize={k === 'email' ? 'none' : 'words'} placeholderTextColor={Colors.textMuted} placeholder={label} />
              </View>
            ))}
            <TouchableOpacity style={styles.button} onPress={() => {
              if (!form.firstName || !form.lastName || !form.email || !form.password) { Alert.alert('Required', 'Please fill in all required fields'); return; }
              if (form.password !== form.confirmPassword) { Alert.alert('Error', 'Passwords do not match'); return; }
              setStep(2);
            }}>
              <Text style={styles.buttonText}>Next →</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 2 && (
          <View style={styles.form}>
            {[['emergencyName','Emergency Contact Name'],['emergencyPhone','Emergency Contact Phone']].map(([k, label]) => (
              <View key={k}>
                <Text style={styles.label}>{label}</Text>
                <TextInput style={styles.input} value={form[k as keyof typeof form]} onChangeText={v => update(k, v)}
                  placeholderTextColor={Colors.textMuted} placeholder={label} />
              </View>
            ))}
            <TouchableOpacity style={styles.button} onPress={() => setStep(3)}>
              <Text style={styles.buttonText}>Next →</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 3 && (
          <View style={styles.form}>
            <Text style={styles.waiverText}>By joining Crusader 9, you acknowledge the risks involved in boxing and fitness training. Please read and agree to the following:</Text>
            <TouchableOpacity style={styles.checkRow} onPress={() => setWaiver(w => ({ ...w, ackRisk: !w.ackRisk }))}>
              <View style={[styles.checkbox, waiver.ackRisk && styles.checked]} />
              <Text style={styles.checkLabel}>I acknowledge the inherent risks of boxing and fitness training</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.checkRow} onPress={() => setWaiver(w => ({ ...w, healthConfirm: !w.healthConfirm }))}>
              <View style={[styles.checkbox, waiver.healthConfirm && styles.checked]} />
              <Text style={styles.checkLabel}>I confirm I am in good health and have no medical conditions that prevent participation</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.checkRow} onPress={() => setWaiver(w => ({ ...w, rulesAgree: !w.rulesAgree }))}>
              <View style={[styles.checkbox, waiver.rulesAgree && styles.checked]} />
              <Text style={styles.checkLabel}>I agree to follow all gym rules and codes of conduct</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.checkRow} onPress={() => setWaiver(w => ({ ...w, fullAgreement: !w.fullAgreement }))}>
              <View style={[styles.checkbox, waiver.fullAgreement && styles.checked]} />
              <Text style={styles.checkLabel}>I have read and agree to the full membership agreement</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.checkRow} onPress={() => setWaiver(w => ({ ...w, mediaConsent: !w.mediaConsent }))}>
              <View style={[styles.checkbox, waiver.mediaConsent && styles.checked]} />
              <Text style={styles.checkLabel}>I consent to photos/videos being taken (optional)</Text>
            </TouchableOpacity>
            <View>
              <Text style={styles.label}>Full Name (signature)</Text>
              <TextInput style={styles.input} value={waiver.fullName} onChangeText={v => setWaiver(w => ({ ...w, fullName: v }))}
                placeholder="Type your full name" placeholderTextColor={Colors.textMuted} />
            </View>
            <TouchableOpacity style={[styles.button, loading && { opacity: 0.6 }]} onPress={submit} disabled={loading}>
              <Text style={styles.buttonText}>{loading ? 'Creating account...' : 'Complete Registration'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.black },
  content: { padding: 24, gap: 8, paddingBottom: 60 },
  back: { color: Colors.textMuted, fontSize: 14, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', color: Colors.text },
  step: { color: Colors.gold, fontSize: 13, marginBottom: 24 },
  form: { gap: 16 },
  label: { color: Colors.textMuted, fontSize: 13, marginBottom: 4 },
  input: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 12, padding: 16, color: Colors.text, fontSize: 16 },
  button: { backgroundColor: Colors.gold, padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 8 },
  buttonText: { color: Colors.black, fontSize: 16, fontWeight: '700' },
  waiverText: { color: Colors.textMuted, fontSize: 14, lineHeight: 20, marginBottom: 8 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: Colors.border, marginTop: 2 },
  checked: { backgroundColor: Colors.gold, borderColor: Colors.gold },
  checkLabel: { color: Colors.text, fontSize: 14, flex: 1, lineHeight: 20 },
});
