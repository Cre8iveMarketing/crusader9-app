import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet, RefreshControl } from 'react-native';
import { Stack, useFocusEffect } from 'expo-router';
import { apiFetch } from '@/lib/api';
import { format } from 'date-fns';
import { DayPassPurchase } from '@/components/DayPassPurchase';
import { WithTabBar } from '@/components/WithTabBar';

function fmtDate(iso: string) { try { return format(new Date(iso), 'd MMM yyyy'); } catch { return iso; } }

export default function ProfileDayPasses() {
  const [me, setMe] = useState<any>(null);
  const [plansData, setPlansData] = useState<any>(null);
  const [family, setFamily] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    const [meData, plans, familyData] = await Promise.all([
      apiFetch('/me'),
      apiFetch('/plans'),
      apiFetch('/family').catch(() => ({ children: [] })),
    ]);
    setMe(meData);
    setPlansData(plans);
    setFamily(familyData.children ?? []);
  }

  useFocusEffect(useCallback(() => { load(); }, []));

  async function onRefresh() { setRefreshing(true); await load(); setRefreshing(false); }

  // Show purchase UI only if member doesn't have open gym access
  const currentPlan = plansData?.plans?.find((p: any) => p.id === plansData?.currentPlanId);
  const showPurchase = currentPlan && currentPlan.accessMode !== 'OPEN_GYM';

  const dayPasses = me?.dayPasses ?? [];
  const now = new Date();
  const upcoming = dayPasses.filter((d: any) => {
    const validDate = d.validDate ?? d.date;
    return validDate && new Date(validDate) >= now && !d.usedAt;
  });
  const past = dayPasses.filter((d: any) => {
    const validDate = d.validDate ?? d.date;
    return !validDate || new Date(validDate) < now || d.usedAt;
  });

  return (
    <WithTabBar>
      <Stack.Screen options={{ title: 'Day Passes' }} />
      <ScrollView style={s.container} contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}>

        {showPurchase && plansData && (
          <DayPassPurchase
            gymSchedule={plansData.openGymSchedule ?? {}}
            closedDates={plansData.closedDates ?? []}
            showFamilyPicker={family.length > 0}
            family={family}
            onPurchased={load}
          />
        )}

        {dayPasses.length > 0 && (
          <>
            {upcoming.length > 0 && (
              <>
                <Text style={s.sectionLabel}>UPCOMING</Text>
                {upcoming.map((d: any) => {
                  const validDate = d.validDate ?? d.date;
                  return (
                    <View key={d.id} style={s.card}>
                      <View style={s.row}>
                        <View>
                          <Text style={s.cardName}>Day Pass</Text>
                          {validDate && <Text style={s.cardMeta}>{fmtDate(validDate)}</Text>}
                          {d.price !== undefined && <Text style={s.cardMeta}>£{Number(d.price).toFixed(2)}</Text>}
                        </View>
                        <View style={s.badgeGreen}><Text style={s.badgeText}>Upcoming</Text></View>
                      </View>
                    </View>
                  );
                })}
              </>
            )}
            {past.length > 0 && (
              <>
                <Text style={s.sectionLabel}>PAST</Text>
                {past.map((d: any) => {
                  const validDate = d.validDate ?? d.date;
                  const isUsed = !!d.usedAt;
                  const isExpired = validDate && new Date(validDate) < now && !d.usedAt;
                  return (
                    <View key={d.id} style={[s.card, { opacity: 0.7 }]}>
                      <View style={s.row}>
                        <View>
                          <Text style={s.cardName}>Day Pass</Text>
                          {validDate && <Text style={s.cardMeta}>{fmtDate(validDate)}</Text>}
                          {d.price !== undefined && <Text style={s.cardMeta}>£{Number(d.price).toFixed(2)}</Text>}
                        </View>
                        <View style={isExpired ? s.badgeGrey : s.badgeAmber}>
                          <Text style={s.badgeText}>{isExpired ? 'Expired' : 'Used'}</Text>
                        </View>
                      </View>
                    </View>
                  );
                })}
              </>
            )}
          </>
        )}

        {dayPasses.length === 0 && !showPurchase && (
          <Text style={s.empty}>No day passes yet</Text>
        )}

      </ScrollView>
    </WithTabBar>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 16, gap: 10, paddingBottom: 48 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#a1a1aa', letterSpacing: 1, marginTop: 4 },
  card: { backgroundColor: '#1a1a1a', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#2a2a2a' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardName: { fontSize: 15, fontWeight: '700', color: '#fff' },
  cardMeta: { fontSize: 12, color: '#a0a0a0', marginTop: 2 },
  badgeGreen: { backgroundColor: 'rgba(34,197,94,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeAmber: { backgroundColor: 'rgba(245,158,11,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeGrey: { backgroundColor: '#2a2a2a', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  empty: { color: '#a1a1aa', textAlign: 'center', paddingVertical: 48, fontSize: 14 },
});
