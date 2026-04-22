import { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Image, ActivityIndicator, Linking, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { saveToken } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';
import { useStripeDeepLink } from '@/hooks/useStripeDeepLink';

type Path = 'member' | 'class' | 'daypass' | '';

const WAIVER_TEXT = `CRUSADER 9 BOXING — MEMBERSHIP AGREEMENT & WAIVER

By signing this agreement, you acknowledge and accept the following terms:

1. ASSUMPTION OF RISK
I understand that boxing training and physical exercise involve inherent risks including but not limited to: muscle strains, sprains, fractures, bruising, concussion, and other physical injuries. I voluntarily assume all risks associated with participation in activities at Crusader 9 Boxing.

2. HEALTH DECLARATION
I confirm that I am physically fit to participate in boxing training and exercise activities. I have no medical conditions, injuries, or disabilities that would make my participation unsafe. I agree to inform staff immediately of any changes to my health status.

3. RULES & CONDUCT
I agree to follow all safety instructions given by coaches and staff. I will use equipment properly and return it after use. I will treat all members, staff, and the facility with respect. I understand that aggressive or unsportsmanlike behaviour will result in membership termination.

4. FACILITY RULES
I will follow all posted gym rules and guidelines. I understand the gym operates on a schedule and I will arrive on time for classes. I will maintain appropriate hygiene and wear suitable training attire.

5. MEDIA CONSENT
I understand that Crusader 9 Boxing may photograph or film training sessions and events for promotional purposes. I consent to my image being used in marketing materials unless I opt out below.

6. LIABILITY WAIVER
To the fullest extent permitted by law, I release Crusader 9 Boxing Ltd, its directors, employees, coaches, and agents from any liability for injury, loss, or damage arising from my participation in activities at the facility.

7. DATA PROTECTION
My personal data will be processed in accordance with UK GDPR. Data is used for membership management, safety, and communication purposes only.`;

export default function Register() {
  const router = useRouter();
  const params = useLocalSearchParams<{ path?: string; planId?: string }>();
  const { refresh } = useAuth();

  const [step, setStep] = useState(1);
  const [path] = useState<Path>((params.path as Path) || 'member');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [dateOfBirthDisplay, setDateOfBirthDisplay] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  const [photo, setPhoto] = useState('');
  const [planId, setPlanId] = useState(params.planId ?? '');
  const [plans, setPlans] = useState<any[]>([]);
  const [plansLoaded, setPlansLoaded] = useState(false);

  const [ackRisk, setAckRisk] = useState(false);
  const [healthConfirm, setHealthConfirm] = useState(false);
  const [rulesAgree, setRulesAgree] = useState(false);
  const [mediaConsent, setMediaConsent] = useState(false);
  const [fullAgreement, setFullAgreement] = useState(false);
  const [isUnder18, setIsUnder18] = useState(false);
  const [parentGuardianName, setParentGuardianName] = useState('');
  const [waiverName, setWaiverName] = useState('');

  useStripeDeepLink({
    onSuccess: (type) => {
      if (type === 'subscription') {
        Alert.alert(
          'Payment successful! 🎉',
          'Your membership is now active. Please sign in to access your account.',
          [{ text: 'Sign in', onPress: () => router.replace('/(auth)/login') }]
        );
      }
    },
    onCancel: (type) => {
      if (type === 'subscription') {
        Alert.alert('Payment cancelled', 'No charge was made. You can try again.');
        setSubmitting(false);
      }
    },
  });

  function loadPlans() {
    if (plansLoaded) return;
    fetch('https://app.crusader9.co.uk/api/plans')
      .then(r => r.json())
      .then(d => {
        const all = Array.isArray(d) ? d : (d.plans ?? []);
        setPlans(all.filter((p: any) => p.planType === 'MONTHLY' || p.planType === 'PAYG'));
        setPlansLoaded(true);
      })
      .catch(() => {});
  }

  function nextStep() { setError(''); if (step === 3) loadPlans(); setStep(s => s + 1); }
  function prevStep() { setError(''); setStep(s => s - 1); }

  async function handlePickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8, base64: true });
    if (!result.canceled && result.assets[0].base64) setPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
  }

  async function handleCamera() {
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 0.8, base64: true });
    if (!result.canceled && result.assets[0].base64) setPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
  }

  const canProceedDetails = firstName.trim() && lastName.trim() && email.trim() && password.length >= 8 && password === confirmPassword && phone.trim();
  const canProceedWaiver = ackRisk && healthConfirm && rulesAgree && fullAgreement && waiverName.trim().length > 3 && (!isUnder18 || parentGuardianName.trim().length > 3);
  const canProceedPlan = path !== 'member' || !!planId;

  async function handleSubmit() {
    setSubmitting(true);
    setError('');
    try {
      const body: any = {
        firstName, lastName, email, password, phone,
        dateOfBirth: dateOfBirth || null,
        emergencyName: emergencyName || null,
        emergencyPhone: emergencyPhone || null,
        photo: photo || null,
        planId: planId || null,
        waiverSignature: {
          fullName: waiverName.trim(),
          ackRisk,
          healthConfirm,
          rulesAgree,
          mediaConsent,
          fullAgreement,
          isUnder18,
          parentGuardianName: isUnder18 ? parentGuardianName.trim() : null,
        },
      };
      const res = await fetch('https://app.crusader9.co.uk/api/mobile/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? 'Registration failed'); setSubmitting(false); return; }

      if (data.stripeUrl) { await Linking.openURL(data.stripeUrl); return; }

      await saveToken(data.token);
      await refresh();
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong');
      setSubmitting(false);
    }
  }

  const nextDisabled =
    (step === 1 && !canProceedDetails) ||
    (step === 2 && !photo) ||
    (step === 3 && !canProceedWaiver) ||
    (step === 4 && !canProceedPlan);

  return (
    <SafeAreaView style={s.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

          {/* Progress pills */}
          <View style={s.progressRow}>
            {[1, 2, 3, 4, 5].map(i => (
              <View key={i} style={[s.progressDot, i <= step && s.progressDotActive]} />
            ))}
          </View>

          {/* Header */}
          <View style={s.headerBlock}>
            <Image source={require('../../assets/c9-logo.png')} style={s.c9LogoImg} resizeMode="contain" />
            <Text style={s.stepTitle}>
              {step === 1 && 'Create your account'}
              {step === 2 && 'Add a photo'}
              {step === 3 && 'Health & waiver'}
              {step === 4 && 'Choose your plan'}
              {step === 5 && 'Review'}
            </Text>
            <Text style={s.stepSub}>
              {step === 1 && 'Tell us about yourself.'}
              {step === 2 && 'For your membership card and gym access.'}
              {step === 3 && 'Read, then confirm each statement below.'}
              {step === 4 && 'Pick a plan — you can change it later.'}
              {step === 5 && "Check everything looks right before you pay."}
            </Text>
          </View>

          {error ? <View style={s.errorBox}><Text style={s.errorText}>{error}</Text></View> : null}

          {/* STEP 1 — Personal Details */}
          {step === 1 && (
            <>
              <Text style={s.sectionLabel}>ACCOUNT</Text>
              <View style={s.section}>
                <View style={s.row}>
                  <Text style={s.rowLabel}>First name</Text>
                  <TextInput style={s.rowInput} value={firstName} onChangeText={setFirstName} placeholder="Jane" placeholderTextColor="#8e8e93" autoCapitalize="words" returnKeyType="next" />
                </View>
                <View style={s.row}>
                  <Text style={s.rowLabel}>Last name</Text>
                  <TextInput style={s.rowInput} value={lastName} onChangeText={setLastName} placeholder="Doe" placeholderTextColor="#8e8e93" autoCapitalize="words" returnKeyType="next" />
                </View>
                <View style={s.row}>
                  <Text style={s.rowLabel}>Email</Text>
                  <TextInput style={s.rowInput} value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor="#8e8e93" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} returnKeyType="next" />
                </View>
                <View style={s.row}>
                  <Text style={s.rowLabel}>Password</Text>
                  <TextInput style={s.rowInput} value={password} onChangeText={setPassword} placeholder="Min 8 characters" placeholderTextColor="#8e8e93" secureTextEntry returnKeyType="next" />
                </View>
                <View style={[s.row, s.rowLast]}>
                  <Text style={s.rowLabel}>Confirm</Text>
                  <TextInput style={s.rowInput} value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Repeat password" placeholderTextColor="#8e8e93" secureTextEntry returnKeyType="next" />
                </View>
              </View>

              <Text style={s.sectionLabel}>CONTACT</Text>
              <View style={s.section}>
                <View style={s.row}>
                  <Text style={s.rowLabel}>Phone</Text>
                  <TextInput style={s.rowInput} value={phone} onChangeText={setPhone} placeholder="07700 900000" placeholderTextColor="#8e8e93" keyboardType="phone-pad" returnKeyType="next" />
                </View>
                <View style={[s.row, s.rowLast]}>
                  <Text style={s.rowLabel}>Date of birth</Text>
                  <TextInput
                    style={s.rowInput}
                    value={dateOfBirthDisplay}
                    onChangeText={(text) => {
                      const digits = text.replace(/\D/g, '');
                      let formatted = digits;
                      if (digits.length >= 3) formatted = digits.slice(0, 2) + '/' + digits.slice(2);
                      if (digits.length >= 5) formatted = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4, 8);
                      setDateOfBirthDisplay(formatted);
                      if (digits.length === 8) setDateOfBirth(`${digits.slice(4, 8)}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`);
                      else setDateOfBirth('');
                    }}
                    placeholder="DD/MM/YYYY"
                    placeholderTextColor="#8e8e93"
                    keyboardType="numeric"
                    maxLength={10}
                  />
                </View>
              </View>

              <Text style={s.sectionLabel}>EMERGENCY CONTACT</Text>
              <View style={s.section}>
                <View style={s.row}>
                  <Text style={s.rowLabel}>Name</Text>
                  <TextInput style={s.rowInput} value={emergencyName} onChangeText={setEmergencyName} placeholder="Full name" placeholderTextColor="#8e8e93" autoCapitalize="words" returnKeyType="next" />
                </View>
                <View style={[s.row, s.rowLast]}>
                  <Text style={s.rowLabel}>Phone</Text>
                  <TextInput style={s.rowInput} value={emergencyPhone} onChangeText={setEmergencyPhone} placeholder="07700 900000" placeholderTextColor="#8e8e93" keyboardType="phone-pad" returnKeyType="done" />
                </View>
              </View>
            </>
          )}

          {/* STEP 2 — Photo */}
          {step === 2 && (
            <>
              <View style={s.photoCenter}>
                <TouchableOpacity style={s.photoCircle} onPress={handlePickPhoto} activeOpacity={0.8}>
                  {photo
                    ? <Image source={{ uri: photo }} style={s.photoPreview} />
                    : <View style={s.photoCircleInner}>
                        <Text style={s.photoIcon}>📷</Text>
                      </View>
                  }
                </TouchableOpacity>
                <Text style={s.photoCaption}>{photo ? 'Looking good. Tap to replace.' : 'Tap to add a photo'}</Text>
              </View>
              <View style={s.photoBtnRow}>
                <TouchableOpacity style={s.photoBtn} onPress={handleCamera} activeOpacity={0.7}>
                  <Text style={s.photoBtnText}>Take photo</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.photoBtn} onPress={handlePickPhoto} activeOpacity={0.7}>
                  <Text style={s.photoBtnText}>From library</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* STEP 3 — Waiver */}
          {step === 3 && (
            <>
              <Text style={s.sectionLabel}>AGREEMENT</Text>
              <View style={[s.section, { padding: 12 }]}>
                <ScrollView
                  style={s.waiverBox}
                  nestedScrollEnabled
                  persistentScrollbar
                  showsVerticalScrollIndicator
                  indicatorStyle="white">
                  <Text style={s.waiverText}>{WAIVER_TEXT}</Text>
                </ScrollView>
              </View>

              <Text style={s.sectionLabel}>I CONFIRM</Text>
              <View style={s.section}>
                {[
                  { value: ackRisk, setter: setAckRisk, label: 'I acknowledge the risks of boxing training and physical exercise including risk of injury', required: true },
                  { value: healthConfirm, setter: setHealthConfirm, label: 'I confirm I am physically fit to participate and have no medical conditions that make participation unsafe', required: true },
                  { value: rulesAgree, setter: setRulesAgree, label: 'I agree to follow all safety instructions, rules and conduct outlined above', required: true },
                  { value: mediaConsent, setter: setMediaConsent, label: 'I consent to photography and video being used for marketing purposes', required: false },
                  { value: fullAgreement, setter: setFullAgreement, label: 'I have read, understood and agree to this agreement in full', required: true },
                  { value: isUnder18, setter: setIsUnder18, label: 'I am under 18 years old', required: false, last: true },
                ].map((item, i) => (
                  <TouchableOpacity key={i} style={[s.checkRow, item.last && s.rowLast]} onPress={() => item.setter(!item.value)} activeOpacity={0.7}>
                    <View style={[s.checkbox, item.value && s.checkboxChecked]}>
                      {item.value && <Text style={s.checkboxTick}>✓</Text>}
                    </View>
                    <Text style={s.checkLabel}>
                      {item.label}
                      {item.required && <Text style={s.requiredMark}> *</Text>}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {isUnder18 && (
                <>
                  <Text style={s.sectionLabel}>PARENT / GUARDIAN</Text>
                  <View style={s.section}>
                    <View style={[s.row, s.rowLast]}>
                      <Text style={s.rowLabel}>Name<Text style={s.requiredMark}> *</Text></Text>
                      <TextInput style={s.rowInput} value={parentGuardianName} onChangeText={setParentGuardianName} placeholder="Full legal name" placeholderTextColor="#8e8e93" autoCapitalize="words" returnKeyType="next" />
                    </View>
                  </View>
                </>
              )}

              <Text style={s.sectionLabel}>SIGNATURE</Text>
              <View style={s.section}>
                <View style={[s.row, s.rowLast]}>
                  <Text style={s.rowLabel}>Full name<Text style={s.requiredMark}> *</Text></Text>
                  <TextInput style={s.rowInput} value={waiverName} onChangeText={setWaiverName} placeholder="Full legal name" placeholderTextColor="#8e8e93" autoCapitalize="words" returnKeyType="done" />
                </View>
              </View>
            </>
          )}

          {/* STEP 4 — Plan */}
          {step === 4 && (
            <>
              {!plansLoaded && <ActivityIndicator color="#fff" style={{ marginVertical: 24 }} />}
              {plansLoaded && (
                <>
                  <Text style={s.sectionLabel}>PLANS</Text>
                  <View style={s.section}>
                    {plans.map((p, idx) => {
                      const selected = planId === p.id;
                      const isLast = idx === plans.length - 1;
                      return (
                        <TouchableOpacity key={p.id} style={[s.planRow, isLast && s.rowLast]}
                          onPress={() => setPlanId(p.id)} activeOpacity={0.7}>
                          <View style={s.planLeft}>
                            <Text style={s.planName}>{p.name}</Text>
                            {p.description && <Text style={s.planDesc} numberOfLines={2}>{p.description}</Text>}
                          </View>
                          <View style={s.planRight}>
                            <Text style={s.planPrice}>{p.price === 0 ? 'Free' : `£${p.price}/mo`}</Text>
                            <View style={[s.radio, selected && s.radioSelected]}>
                              {selected && <View style={s.radioInner} />}
                            </View>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
            </>
          )}

          {/* STEP 5 — Review */}
          {step === 5 && (
            <>
              <Text style={s.sectionLabel}>SUMMARY</Text>
              <View style={s.section}>
                {[
                  { label: 'Name', value: `${firstName} ${lastName}` },
                  { label: 'Email', value: email },
                  { label: 'Phone', value: phone },
                  { label: 'Plan', value: plans.find(p => p.id === planId)?.name ?? (planId ? 'Selected' : 'PAYG'), last: true },
                ].map((row, i) => (
                  <View key={i} style={[s.summaryRow, row.last && s.rowLast]}>
                    <Text style={s.summaryLabel}>{row.label}</Text>
                    <Text style={s.summaryValue} numberOfLines={1}>{row.value}</Text>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Nav */}
          {step < 5 ? (
            <View style={s.navRow}>
              <TouchableOpacity style={s.backBtn} onPress={step === 1 ? () => router.back() : prevStep} activeOpacity={0.7}>
                <Text style={s.backBtnText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.nextBtn, nextDisabled && s.nextBtnDisabled]}
                onPress={nextStep}
                disabled={nextDisabled}
                activeOpacity={0.8}>
                <Text style={[s.nextBtnText, nextDisabled && s.nextBtnTextDisabled]}>Next</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.finalNav}>
              <TouchableOpacity style={[s.confirmBtn, submitting && { opacity: 0.6 }]} onPress={handleSubmit} disabled={submitting} activeOpacity={0.8}>
                {submitting
                  ? <ActivityIndicator color="#000" size="small" />
                  : <Text style={s.confirmBtnText}>Confirm & pay →</Text>
                }
              </TouchableOpacity>
              <TouchableOpacity style={s.editBtn} onPress={() => setStep(1)} activeOpacity={0.7}>
                <Text style={s.editBtnText}>← Edit details</Text>
              </TouchableOpacity>
            </View>
          )}

          {step === 1 && (
            <TouchableOpacity style={s.signInRow} onPress={() => router.push('/(auth)/login')} activeOpacity={0.7}>
              <Text style={s.signInText}>Already a member? <Text style={s.signInLink}>Sign in</Text></Text>
            </TouchableOpacity>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  content: { padding: 20, paddingTop: 20, paddingBottom: 48 },

  // Progress pills
  progressRow: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 24 },
  progressDot: { width: 28, height: 4, borderRadius: 2, backgroundColor: '#2c2c2e' },
  progressDotActive: { backgroundColor: '#ffffff' },

  // Header block
  headerBlock: { marginBottom: 24 },
  c9LogoImg: { width: 80, height: 40, marginBottom: 12, marginLeft: -4 },
  stepTitle: { fontSize: 28, fontWeight: '800', color: '#ffffff', letterSpacing: -0.5, marginBottom: 6 },
  stepSub: { fontSize: 15, color: '#8e8e93', lineHeight: 20 },

  // Error
  errorBox: { backgroundColor: 'rgba(239,68,68,0.12)', borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)', padding: 14, borderRadius: 10, marginBottom: 16 },
  errorText: { color: '#fca5a5', fontSize: 14 },

  // iOS-style grouped sections
  sectionLabel: { fontSize: 12, fontWeight: '600', color: '#8e8e93', letterSpacing: 0.8, marginLeft: 16, marginBottom: 8, marginTop: 8 },
  section: { backgroundColor: '#1c1c1e', borderRadius: 12, marginBottom: 24, overflow: 'hidden' },

  // Form rows
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 52, paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#3a3a3c' },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { width: 112, fontSize: 15, color: '#ffffff' },
  rowInput: { flex: 1, fontSize: 15, color: '#ffffff', padding: 0, textAlign: 'right' },

  // Photo step
  photoCenter: { alignItems: 'center', marginVertical: 16, marginBottom: 28 },
  photoCircle: { width: 160, height: 160, borderRadius: 80, backgroundColor: '#1c1c1e', borderWidth: 2, borderColor: '#3a3a3c', overflow: 'hidden' },
  photoCircleInner: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  photoPreview: { width: 156, height: 156, borderRadius: 78 },
  photoIcon: { fontSize: 48 },
  photoCaption: { marginTop: 14, fontSize: 14, color: '#8e8e93' },
  photoBtnRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  photoBtn: { flex: 1, backgroundColor: '#1c1c1e', borderWidth: 1, borderColor: '#3a3a3c', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  photoBtnText: { color: '#ffffff', fontWeight: '600', fontSize: 15 },

  // Waiver
  waiverBox: { maxHeight: 220 },
  waiverText: { color: '#c7c7cc', fontSize: 12, lineHeight: 18 },

  // Checkbox rows
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#3a3a3c' },
  checkLabel: { flex: 1, color: '#ffffff', fontSize: 14, lineHeight: 19 },
  checkbox: { width: 22, height: 22, borderRadius: 5, borderWidth: 2, borderColor: '#48484a', justifyContent: 'center', alignItems: 'center', flexShrink: 0, marginTop: 1 },
  checkboxChecked: { backgroundColor: '#ffffff', borderColor: '#ffffff' },
  checkboxTick: { color: '#000000', fontSize: 13, fontWeight: '800' },
  requiredMark: { color: '#ef4444', fontWeight: '700' },

  // Plan rows
  planRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#3a3a3c' },
  planLeft: { flex: 1 },
  planName: { fontSize: 16, fontWeight: '600', color: '#ffffff' },
  planDesc: { fontSize: 13, color: '#8e8e93', marginTop: 2 },
  planRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  planPrice: { fontSize: 15, fontWeight: '700', color: '#ffffff' },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#48484a', justifyContent: 'center', alignItems: 'center' },
  radioSelected: { borderColor: '#ffffff' },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#ffffff' },

  // Summary
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#3a3a3c' },
  summaryLabel: { color: '#8e8e93', fontSize: 15 },
  summaryValue: { color: '#ffffff', fontSize: 15, fontWeight: '500', flex: 1, textAlign: 'right', marginLeft: 16 },

  // Nav
  navRow: { flexDirection: 'row', gap: 10, marginTop: 8 },
  backBtn: { flex: 1, backgroundColor: '#1c1c1e', paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  backBtnText: { color: '#ffffff', fontWeight: '600', fontSize: 16 },
  nextBtn: { flex: 2, backgroundColor: '#ffffff', paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  nextBtnDisabled: { backgroundColor: '#1c1c1e' },
  nextBtnText: { color: '#0a0a0a', fontWeight: '700', fontSize: 16 },
  nextBtnTextDisabled: { color: '#48484a' },

  finalNav: { gap: 10, marginTop: 8 },
  confirmBtn: { backgroundColor: '#ffffff', paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  confirmBtnText: { color: '#0a0a0a', fontWeight: '700', fontSize: 16 },
  editBtn: { paddingVertical: 14, borderRadius: 14, alignItems: 'center' },
  editBtnText: { color: '#8e8e93', fontWeight: '500', fontSize: 15 },

  signInRow: { alignItems: 'center', paddingTop: 16 },
  signInText: { color: '#8e8e93', fontSize: 15 },
  signInLink: { color: '#ffffff', fontWeight: '600' },
});
