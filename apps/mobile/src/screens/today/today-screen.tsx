import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { DoseGroup, DoseRow } from '@/components/dose-row';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { ListGroup, ListRow } from '@/components/list-row';
import { MedIcon } from '@/components/med-icon';
import { PrimaryButton } from '@/components/primary-button';
import { ProfileChips } from '@/components/profile-chips';
import { ProgressRing } from '@/components/progress-ring';
import { Screen } from '@/components/screen';
import { SeasonalBackdrop, type Lane } from '@/components/seasonal-backdrop';
import { SectionHeader } from '@/components/section-header';
import { InfoPill } from '@/components/state-pill';
import { formatDayLong, inventorySummary, plural } from '@/constants/format';
import { icons } from '@/constants/icons';
import { formatClock, useToday, type DoseView, type MedicationView } from '@/data';
import { useActiveWindow } from '@/hooks/use-active-window';
import { useTodayDoses } from '@/hooks/use-doses';
import { useMedications } from '@/hooks/use-medications';
import { useProfiles } from '@/hooks/use-profiles';
import { CHROME_FONT_CAP, doseTarget, spacing, useTheme } from '@/theme';

import { logDose, skip, snooze, take, undo } from './dose-actions';
import { DueNowCard } from './due-now-card';

const RING = 148;
const HERO_HEIGHT = RING + spacing.md;

type TimeGroup = { key: string; label: string; doses: DoseView[] };

function groupByTime(doses: DoseView[]): TimeGroup[] {
  const groups: TimeGroup[] = [];
  for (const d of doses) {
    const label = formatClock(d.dueAt);
    const last = groups.at(-1);
    if (last && last.label === label) last.doses.push(d);
    else groups.push({ key: d.dueAt, label, doses: [d] });
  }
  return groups;
}

function Hero({ taken, total, remaining, today }: { taken: number; total: number; remaining: number; today: string }) {
  const { motif } = useTheme();
  const [width, setWidth] = useState(0);
  // Particles live only in the side lanes beside the ring: never behind the ring's label or the
  // text below it.
  const gutter = spacing.md;
  const lanes: Lane[] =
    width > RING + 4 * gutter
      ? [
          { start: 0, end: (width - RING) / 2 - gutter },
          { start: (width + RING) / 2 + gutter, end: width },
        ]
      : [];
  const summary =
    total === 0 ? 'No scheduled doses today' : remaining === 0 ? 'All done for today' : `${plural(remaining, 'dose')} still to take`;

  return (
    <View style={{ gap: spacing.md, alignItems: 'center' }}>
      <View style={{ alignSelf: 'stretch', height: HERO_HEIGHT, alignItems: 'center', justifyContent: 'center' }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
        <SeasonalBackdrop motif={motif} height={HERO_HEIGHT} lanes={lanes} />
        <ProgressRing
          progress={total ? taken / total : 0}
          size={RING}
          stroke={14}
          accessibilityLabel={total ? `${taken} of ${total} doses taken today` : 'No doses scheduled today'}
        >
          <AppText variant="display" tabular maxFontSizeMultiplier={1.2} align="center" adjustsFontSizeToFit numberOfLines={1}>
            {total ? `${taken}/${total}` : '–'}
          </AppText>
          <AppText variant="caption" tone="secondary" maxFontSizeMultiplier={1.2} align="center">
            taken
          </AppText>
        </ProgressRing>
      </View>
      <View style={{ alignItems: 'center', gap: 2 }}>
        <AppText variant="headline" align="center">
          {formatDayLong(today)}
        </AppText>
        <AppText variant="body" tone="secondary" align="center">
          {summary}
        </AppText>
      </View>
    </View>
  );
}

function AsNeededRow({ med, todayCount }: { med: MedicationView; todayCount: number }) {
  const max = med.schedule.kind === 'as-needed' ? med.schedule.maxPerDay : undefined;
  const atLimit = max !== undefined && todayCount >= max;
  const countLabel = max ? `${todayCount} of ${max} today` : `${plural(todayCount, 'dose')} today`;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md }}>
      <MedIcon icon={med.icon} color={med.color} size={44} />
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="body" weight="600">
          {med.name}
        </AppText>
        <AppText variant="callout" tone="secondary">
          {[med.strength, countLabel].filter(Boolean).join(' · ')}
        </AppText>
      </View>
      <PrimaryButton
        title={atLimit ? 'Limit reached' : 'Log a dose'}
        variant="secondary"
        size="lg"
        block={false}
        disabled={atLimit}
        accessibilityHint={`Records one ${med.name} taken now`}
        onPress={() => void logDose(med)}
        style={{ minWidth: doseTarget * 2 }}
      />
    </View>
  );
}

export function TodayScreen() {
  const profiles = useProfiles();
  const [profileId, setProfileId] = useState<string | null>(null);
  const activeProfileId = profileId && profiles.some((p) => p.id === profileId) ? profileId : null;
  const today = useToday();
  const doses = useTodayDoses(activeProfileId);
  const meds = useMedications(activeProfileId);
  const everyMed = useMedications(null);
  const activeWindow = useActiveWindow();

  const scheduled = doses.filter((d) => d.source === 'scheduled');
  const taken = scheduled.filter((d) => d.state === 'taken').length;
  const settled = scheduled.filter((d) => d.state === 'taken' || d.state === 'skipped').length;
  const windowDoses = (activeWindow?.doses ?? []).filter((d) => !activeProfileId || d.profileId === activeProfileId);
  const groups = groupByTime(doses);
  const asNeeded = meds.filter((m) => m.schedule.kind === 'as-needed');
  const lowStock = meds.filter((m) => m.needsRefill || (m.daysLeft !== null && m.daysLeft <= 7));
  const showProfile = !activeProfileId && profiles.length > 1;

  const header = (
    <Stack.Screen
      options={{
        headerRight: () => (
          <IconButton icon={icons.add} label="Add medication" onPress={() => router.push('/med-editor')} />
        ),
      }}
    />
  );

  if (everyMed.length === 0) {
    return (
      <Screen>
        {header}
        <Hero taken={0} total={0} remaining={0} today={today} />
        <EmptyState
          icon={icons.today}
          title="Add your first medication"
          body="Tell Dosely what you take and when. Reminders, the Lock Screen countdown and your history follow from there."
          action={<PrimaryButton title="Add medication" icon={icons.add} size="lg" block={false} onPress={() => router.push('/med-editor')} />}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      {header}
      <ProfileChips profiles={profiles} value={activeProfileId} onChange={setProfileId} />
      <Hero taken={taken} total={scheduled.length} remaining={scheduled.length - settled} today={today} />

      {activeWindow && windowDoses.length ? <DueNowCard doses={windowDoses} endsAt={activeWindow.latestWindowEndsAt} /> : null}

      {groups.length === 0 ? (
        <View style={{ paddingVertical: spacing.md }}>
          <AppText variant="body" tone="secondary" align="center">
            Nothing is scheduled today{activeProfileId ? ' for this person' : ''}.
          </AppText>
        </View>
      ) : (
        groups.map((g) => (
          <View key={g.key} style={{ gap: spacing.sm }}>
            <SectionHeader
              title={g.label}
              trailing={
                g.doses.every((d) => d.state === 'taken') ? (
                  <AppText variant="caption" tone="success" weight="600" maxFontSizeMultiplier={CHROME_FONT_CAP}>
                    Done
                  </AppText>
                ) : null
              }
            />
            <DoseGroup>
              {g.doses.map((d) => (
                <DoseRow key={d.id} dose={d} onTake={take} onSkip={skip} onSnooze={snooze} onUndo={undo} showProfile={showProfile} />
              ))}
            </DoseGroup>
          </View>
        ))
      )}

      {asNeeded.length ? (
        <View style={{ gap: spacing.sm }}>
          <SectionHeader title="As needed" />
          <ListGroup footer="Logged doses count towards your supply, not your adherence.">
            {asNeeded.map((m) => (
              <AsNeededRow
                key={m.id}
                med={m}
                todayCount={doses.filter((d) => d.source === 'as-needed' && d.medicationId === m.id).length}
              />
            ))}
          </ListGroup>
        </View>
      ) : null}

      {lowStock.length ? (
        <View style={{ gap: spacing.sm }}>
          <SectionHeader title="Running low" />
          <ListGroup>
            {lowStock.map((m) => (
              <ListRow
                key={m.id}
                title={m.name}
                leading={<MedIcon icon={m.icon} color={m.color} size={36} />}
                trailing={<InfoPill label={inventorySummary(m.inventoryCount, m.daysLeft) ?? 'Low'} tone="warning" icon={icons.refill} />}
                onPress={() => router.push({ pathname: '/inventory', params: { id: m.id } })}
                accessibilityHint="Update how many you have"
              />
            ))}
          </ListGroup>
        </View>
      ) : null}
    </Screen>
  );
}
