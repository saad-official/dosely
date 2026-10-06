import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { IconButton } from '@/components/icon-button';
import { ListGroup, ListRow } from '@/components/list-row';
import { MedIcon } from '@/components/med-icon';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { StatRow, StatTile } from '@/components/stat-tile';
import { InfoPill } from '@/components/state-pill';
import { showToast } from '@/components/toast';
import { formatDayShort, formatMinutes, formatPercent, inventorySummary, plural, scheduleSummary } from '@/constants/format';
import { icons } from '@/constants/icons';
import { archiveMedication, deleteMedication } from '@/data';
import { lastDays, useAdherence } from '@/hooks/use-adherence';
import { useMedication } from '@/hooks/use-medications';
import { useProfile } from '@/hooks/use-profiles';
import { haptics } from '@/native/haptics';
import { spacing } from '@/theme';

const FORM_LABEL: Record<string, string> = {
  tablet: 'Tablet',
  capsule: 'Capsule',
  liquid: 'Liquid',
  injection: 'Injection',
  inhaler: 'Inhaler',
  drops: 'Drops',
  patch: 'Patch',
  other: 'Other',
};

export function MedDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const med = useMedication(id);
  const profile = useProfile(med?.profileId);
  const report = useAdherence(lastDays(30), med?.profileId ?? null);

  if (!med || med.deletedAt) {
    return (
      <Screen>
        <Stack.Screen options={{ title: '' }} />
        <EmptyState icon={icons.meds} title="This medication was removed" body="Its past doses are still part of your history." />
      </Screen>
    );
  }

  const stats = report?.perMed.find((m) => m.medicationId === med.id);
  const archived = !!med.archivedAt;
  const supply = inventorySummary(med.inventoryCount, med.daysLeft);
  // The list row keeps the short count on the right; the longer refill sentence goes under the title
  // so neither side has to wrap into a narrow column.
  const [supplyCount, supplyRefill] = supply ? supply.split(' · ') : [null, null];
  const supplyDetail = [
    supplyRefill ? supplyRefill.charAt(0).toUpperCase() + supplyRefill.slice(1) : null,
    med.refillDate && med.daysLeft !== null ? `runs out around ${formatDayShort(med.refillDate)}` : null,
  ]
    .filter(Boolean)
    .join(' · ') || undefined;

  const toggleArchive = () => {
    haptics.selection();
    archiveMedication(med.id, !archived)
      .then(() => showToast({ message: archived ? `${med.name} is active again` : `${med.name} archived. Reminders stopped.` }))
      .catch(() => showToast({ message: "Couldn't update. Please try again." }));
  };

  const confirmDelete = () => {
    haptics.warning();
    Alert.alert(`Delete ${med.name}?`, 'Upcoming reminders stop and it leaves your list. Doses you already marked stay in your history.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteMedication(med.id)
            .then(() => {
              router.back();
              showToast({ message: `${med.name} deleted` });
            })
            .catch(() => showToast({ message: "Couldn't delete. Please try again." }));
        },
      },
    ]);
  };

  return (
    <Screen>
      <Stack.Screen
        options={{
          title: med.name,
          headerRight: () => (
            <IconButton icon={icons.edit} label={`Edit ${med.name}`} onPress={() => router.push({ pathname: '/med-editor', params: { id: med.id } })} />
          ),
        }}
      />

      <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
        <MedIcon icon={med.icon} color={med.color} size={64} />
        <View style={{ flex: 1, gap: spacing.xs }}>
          <AppText variant="title" accessibilityRole="header">
            {med.name}
          </AppText>
          <AppText variant="body" tone="secondary">
            {[med.strength, FORM_LABEL[med.form], profile && !profile.isSelf ? `for ${profile.name}` : null].filter(Boolean).join(' · ')}
          </AppText>
          {archived ? <InfoPill label="Archived" icon={icons.archive} /> : null}
        </View>
      </View>

      <ListGroup>
        <ListRow title="Schedule" subtitle={scheduleSummary(med.schedule)} icon={icons.clock} />
        {med.schedule.kind !== 'as-needed' ? (
          <ListRow title="Dose window" value={formatMinutes(med.windowMinutes)} icon={icons.bell} />
        ) : null}
        <ListRow
          title="Supply"
          value={supplyCount ?? 'Not tracked'}
          subtitle={supplyDetail}
          icon={icons.refill}
          onPress={() => router.push({ pathname: '/inventory', params: { id: med.id } })}
          accessibilityHint="Set how many you have"
        />
      </ListGroup>

      {med.instructions ? (
        <View style={{ gap: spacing.sm }}>
          <SectionHeader title="Instructions" />
          <AppText variant="body" selectable style={{ paddingHorizontal: spacing.md }}>
            {med.instructions}
          </AppText>
        </View>
      ) : null}

      {med.schedule.kind !== 'as-needed' ? (
        <View style={{ gap: spacing.sm }}>
          <SectionHeader title="Last 30 days" />
          <StatRow>
            <StatTile label="Taken" icon={icons.checkCircle} value={formatPercent(stats?.rate)} caption={stats ? `${stats.taken} of ${stats.taken + stats.skipped + stats.missed} settled doses` : 'No doses yet'} />
            <StatTile label="Streak" icon={icons.streak} value={stats ? plural(stats.streak, 'day') : '–'} caption="Fully taken days in a row" />
            <StatTile label="Missed" icon={icons.warning} value={String(stats?.missed ?? 0)} caption={stats?.skipped ? `${stats.skipped} skipped` : undefined} />
          </StatRow>
        </View>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <PrimaryButton title="Edit medication" icon={icons.edit} variant="secondary" onPress={() => router.push({ pathname: '/med-editor', params: { id: med.id } })} />
        <PrimaryButton title={archived ? 'Unarchive' : 'Archive'} icon={archived ? icons.unarchive : icons.archive} variant="ghost" onPress={toggleArchive} />
        <PrimaryButton title="Delete medication" icon={icons.trash} variant="destructive" onPress={confirmDelete} />
      </View>
    </Screen>
  );
}
