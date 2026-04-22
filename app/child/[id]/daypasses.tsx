import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { apiFetch } from '@/lib/api';
import { format } from 'date-fns';
import { DayPassPurchase } from '@/components/DayPassPurchase';
import { WithTabBar } from '@/components/WithTabBar';

function fmtDate(iso: string) { try { return format(new Date(iso), 'd MMM yyyy'); } catch { return iso; } }

export default function ChildDayPasses() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [child, setChild] = useState<any>(null);
  const [plansData, setPlansData] = useState<any>(null);

  async function load() {
    const [childData, plans] = await Promise.all([apiFetch(`/family/children/${id}`), apiFetch('/plans')]);
    setChild(childData);
    setPlansData(plans);
  }

  useEffect(() => { load(); }, [id]);

  // Show purchase UI only if child's plan doesn't include open gym
  const childPlanId = child?.subscription?.planId;
  const childPlan = plansData?.plans?.find((p: any) => p.id === childPlanId);
  const showPurchase = childPlan && childPlan.accessMode !== 'OPEN_GYM';

  const dayPasses = child?.dayPasses ?? [];
  const now = new Date();

  return (
    <WithTabBar>
      <Stack.Screen options={{ title: 'Day Passes' }} />
      <ScrollView style={s.container} contentContainerStyle={s.content}>

        {showPurchase && plansData && (
          <DayPassPurchase
            gymSchedule={plansData.openGymSchedule ?? {}}
            closedDates={plansData.closedDates ?? []}
            forMemberId={id}
            onPurchased={load}
          />
        )}

        {dayPasses.length === 0 && !showPurchase && <Text style={s.empty}>No day passes yet</Text>}

        {dayPasses.map((d: any) => {
          const validDate = d.validDate ?? d.date;
          const isUsed = !!d.usedAt;
          const isUpcoming = validDate && new Date(validDate) >= now && !isUsed;
          return (
            <View key={d.id} style={[s.card, !isUpcoming && { opacity: 0.7 }]}>
              <View style={s.row}>
                <View>
                  <Text style={s.cardName}>Day Pass</Text>
                  {validDate && <Text style={s.cardMeta}>{fmtDate(validDate)}</Text>}
                  {d.price !== undefined && <Text style={s.cardMeta}>£{Number(d.price).toFixed(2)}</Text>}
                </View>
                <View style={[s.badge, isUpcoming ? s.badgeGreen : isUsed ? s.badgeAmber : s.badgeGrey]}>
                  <Text style={s.badgeText}>{isUpcoming ? 'Upcoming' : isUsed ? 'Used' : 'Expired'}</Text>
                </View>
              </View>
            </View>
          );
        })}

      </ScrollView>
    </WithTabBar>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  content: { padding: 16, gap: 10, paddingBottom: 48 },
  card: { backgroundColor: '#1a1a1a', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#2a2a2a' },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardName: { fontSize: 15, fontWeight: '700', color: '#fff' },
  cardMeta: { fontSize: 12, color: '#a0a0a0', marginTop: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  badgeGreen: { backgroundColor: 'rgba(34,197,94,0.15)' },
  badgeAmber: { backgroundColor: 'rgba(245,158,11,0.15)' },
  badgeGrey: { backgroundColor: '#2a2a2a' },
  badgeText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  empty: { color: '#a1a1aa', textAlign: 'center', paddingVertical: 48, fontSize: 14 },
});
