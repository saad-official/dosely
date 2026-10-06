import type { Profile } from '@dosely/shared';
import { Link, router, Stack } from 'expo-router';
import { Pressable, View, Platform } from 'react-native';

import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { MedIcon } from '@/components/med-icon';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { InfoPill } from '@/components/state-pill';
import { inventorySummary, scheduleSummary } from '@/constants/format';
import { icons } from '@/constants/icons';
import type { MedicationView } from '@/data';
import { useMedications } from '@/hooks/use-medications';
import { useProfiles } from '@/hooks/use-profiles';
import { hairline, radius, spacing, useTheme } from '@/theme';

function MedRow({ med, profileName }: { med: MedicationView; profileName?: string }) {
  const { colors } = useTheme();
  const supply = inventorySummary(med.inventoryCount, med.daysLeft);
  const archived = !!med.archivedAt;
  const href = { pathname: '/meds/[id]', params: { id: med.id } } as const;
  // `Link asChild` merges its own style with the child's, so a function-valued Pressable style is
  // dropped (the row then stacks vertically). Keep the Pressable unstyled and lay the row out in a
  // child View that reads the pressed state.
  const row = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[med.name, med.strength, profileName ? `for ${profileName}` : null, scheduleSummary(med.schedule), supply, archived ? 'archived' : null]
        .filter(Boolean)
        .join(', ')}
    >
      {({ pressed }) => (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.md,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm + 4,
            backgroundColor: pressed ? colors.surfaceSunken : colors.surfaceElevated,
            opacity: archived ? 0.7 : 1,
          }}
        >
          <MedIcon icon={med.icon} color={med.color} size={44} />
          <View style={{ flex: 1, gap: spacing.xs }}>
            <AppText variant="body" weight="600">
              {[med.name, med.strength].filter(Boolean).join(' ')}
            </AppText>
            <AppText variant="callout" tone="secondary">
              {scheduleSummary(med.schedule)}
            </AppText>
            {supply ? <InfoPill label={supply} tone={med.needsRefill ? 'warning' : 'neutral'} icon={med.needsRefill ? icons.refill : undefined} /> : null}
          </View>
          <Icon name={icons.chevronForward} size={14} color={colors.textTertiary} weight="semibold" directional />
        </View>
      )}
    </Pressable>
  );
  // Link.Trigger / Link.Preview (press-and-hold peek) is an iOS feature; on Android the wrapper
  // drops the row's styles and stacks its children, so the row links directly there.
  if (Platform.OS !== 'ios') {
    return (
      <Link href={href} asChild>
        {row}
      </Link>
    );
  }
  return (
    <Link href={href} asChild>
      <Link.Trigger>{row}</Link.Trigger>
      <Link.Preview />
    </Link>
  );
}

function MedList({ meds, profiles }: { meds: MedicationView[]; profiles?: Map<string, Profile> }) {
  const { colors } = useTheme();
  return (
    <View style={{ borderRadius: radius.md, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.separator, gap: hairline }}>
      {meds.map((m) => (
        <MedRow key={m.id} med={m} profileName={profiles?.get(m.profileId)?.name} />
      ))}
    </View>
  );
}

/** Every medication, grouped by person when there is more than one, archived ones last. */
export function MedsScreen() {
  const profiles = useProfiles();
  const all = useMedications(null, { includeArchived: true });
  const active = all.filter((m) => !m.archivedAt);
  const archived = all.filter((m) => !!m.archivedAt);
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const grouped = profiles.length > 1;

  const header = (
    <Stack.Screen
      options={{ headerRight: () => <IconButton icon={icons.add} label="Add medication" onPress={() => router.push('/med-editor')} /> }}
    />
  );

  if (all.length === 0) {
    return (
      <Screen>
        {header}
        <EmptyState
          icon={icons.meds}
          title="No medications yet"
          body="Add each medicine once with its schedule. Dosely takes care of the reminders."
          action={<PrimaryButton title="Add medication" icon={icons.add} size="lg" block={false} onPress={() => router.push('/med-editor')} />}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      {header}
      {grouped ? (
        profiles.map((p) => {
          const mine = active.filter((m) => m.profileId === p.id);
          return (
            <View key={p.id} style={{ gap: spacing.sm }}>
              <SectionHeader title={p.isSelf ? `${p.name} (you)` : p.name} />
              {mine.length ? (
                <MedList meds={mine} />
              ) : (
                <AppText variant="callout" tone="secondary" style={{ paddingHorizontal: spacing.md }}>
                  No medications for {p.name} yet.
                </AppText>
              )}
            </View>
          );
        })
      ) : active.length ? (
        <MedList meds={active} />
      ) : (
        <AppText variant="body" tone="secondary" align="center">
          Every medication is archived.
        </AppText>
      )}

      {archived.length ? (
        <View style={{ gap: spacing.sm }}>
          <SectionHeader title="Archived" />
          <MedList meds={archived} profiles={grouped ? byId : undefined} />
        </View>
      ) : null}

      <PrimaryButton title="Add medication" icon={icons.add} variant="secondary" onPress={() => router.push('/med-editor')} />
    </Screen>
  );
}
