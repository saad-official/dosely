import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, RefreshControl, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { MedDot } from '@/components/med-icon';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { SkeletonList } from '@/components/skeleton';
import { doseStateLabel, StatePill } from '@/components/state-pill';
import { showToast } from '@/components/toast';
import { formatDayLong } from '@/constants/format';
import { icons } from '@/constants/icons';
import { formatClock, leaveCircle, type TodayDose, type TodayProfile } from '@/data';
import { useCircle, useCircleToday } from '@/hooks/use-circle';
import { useSession } from '@/hooks/use-session';
import { hairline, radius, spacing, useTheme } from '@/theme';

import { circleErrorMessage } from './circle-errors';

function DoseLine({ dose }: { dose: TodayDose }) {
  const { colors } = useTheme();
  const time = formatClock(dose.dueAt);
  return (
    <View
      accessible
      accessibilityLabel={`${dose.medicationName} ${dose.strength ?? ''}, due ${time}, ${doseStateLabel(dose.state)}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceElevated }}
    >
      <AppText variant="callout" tone="secondary" tabular style={{ width: 76 }}>
        {time}
      </AppText>
      <View style={{ flex: 1, gap: spacing.xs }}>
        <AppText variant="body" weight="600">
          {[dose.medicationName, dose.strength].filter(Boolean).join(' ')}
        </AppText>
        <StatePill state={dose.state} label={dose.state === 'taken' && dose.takenAt ? `Taken ${formatClock(dose.takenAt)}` : undefined} />
      </View>
    </View>
  );
}

function ProfileBlock({ profile }: { profile: TodayProfile }) {
  const { colors } = useTheme();
  const taken = profile.doses.filter((d) => d.state === 'taken').length;
  const attention = profile.doses.filter((d) => d.state === 'missed' || d.state === 'late').length;
  return (
    <View style={{ gap: spacing.sm }}>
      <SectionHeader
        title={profile.name}
        trailing={
          <AppText variant="caption" tone={attention ? 'danger' : 'secondary'} weight="600">
            {profile.doses.length ? `${taken} of ${profile.doses.length} taken${attention ? ` · ${attention} need attention` : ''}` : 'Nothing today'}
          </AppText>
        }
      />
      {profile.doses.length ? (
        <View style={{ borderRadius: radius.md, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.separator, gap: hairline }}>
          {profile.doses.map((d) => (
            <DoseLine key={d.id} dose={d} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * Read-only "today" for a circle (opened from the Circle tab or a caregiver alert:
 * `dosely://circle/:id`). Refreshes every minute and on pull.
 */
export function CircleTodayScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const { data: session, isPending } = useSession();
  const { circles } = useCircle({ refreshOnMount: false });
  const today = useCircleToday(session ? id : null);
  const circle = circles.find((c) => c.id === id) ?? null;

  if (!session) {
    return (
      <Screen>
        {isPending ? (
          <SkeletonList rows={3} />
        ) : (
          <EmptyState
            icon={icons.circle}
            title="Sign in to see this circle"
            body="Caregiver views are only available to circle members."
            action={<PrimaryButton title="Sign in" block={false} style={{ alignSelf: 'center' }} onPress={() => router.push({ pathname: '/auth', params: { mode: 'sign-in' } })} />}
          />
        )}
      </Screen>
    );
  }

  const leave = () =>
    Alert.alert('Leave this circle?', 'You will stop seeing their doses and getting alerts. They can invite you again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: () =>
          leaveCircle(id, session.user.id)
            .then(() => {
              router.back();
              showToast({ message: 'You left the circle' });
            })
            .catch((e) => showToast({ message: circleErrorMessage(e) })),
      },
    ]);

  const data = today.data;
  const onRefresh = () => void today.refresh();
  // The owner's account name from the API (cached circle list first, then the today payload).
  const ownerName = circle?.ownerName || data?.ownerName;

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={today.refreshing}
          onRefresh={onRefresh}
          tintColor={colors.accent}
          colors={[colors.accent]}
          progressBackgroundColor={colors.surfaceElevated}
        />
      }
    >
      <Stack.Screen options={{ title: circle?.isOwner ? 'What your circle sees' : ownerName ? `${ownerName}'s day` : 'Caregiver view' }} />

      {!data && today.loading && !today.error ? <SkeletonList rows={4} /> : null}

      {!data && today.error ? (
        <EmptyState
          icon={icons.warning}
          title="Couldn't load today"
          body={today.error}
          action={<PrimaryButton title="Try again" block={false} style={{ alignSelf: 'center' }} loading={today.refreshing} onPress={onRefresh} />}
        />
      ) : null}

      {data ? (
        <>
          <View style={{ gap: spacing.xs }}>
            <AppText variant="headline">{formatDayLong(data.date)}</AppText>
            <AppText variant="caption" tone="secondary">
              {`Updated ${new Date(data.generatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · times in ${data.timeZone}`}
            </AppText>
            {today.error ? (
              <AppText variant="caption" tone="warning">
                {`Couldn't refresh: ${today.error}`}
              </AppText>
            ) : null}
          </View>
          {data.members.flatMap((m) => m.profiles).length === 0 ? (
            <EmptyState icon={icons.today} title="Nothing shared yet" body="Doses appear here once the circle owner's phone syncs." />
          ) : (
            data.members.map((m) => (
              <View key={m.userId} style={{ gap: spacing.lg }}>
                {data.members.length > 1 ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <MedDot color="teal" />
                    <AppText variant="body" weight="600">
                      {m.name}
                    </AppText>
                  </View>
                ) : null}
                {m.profiles.map((p) => (
                  <ProfileBlock key={p.id} profile={p} />
                ))}
              </View>
            ))
          )}
        </>
      ) : null}

      {circle && !circle.isOwner ? <PrimaryButton title="Leave this circle" icon={icons.logout} variant="destructive" onPress={leave} /> : null}
    </Screen>
  );
}
