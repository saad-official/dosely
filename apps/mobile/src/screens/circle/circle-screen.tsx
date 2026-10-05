import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, RefreshControl, Share, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { Icon } from '@/components/icon';
import { ListGroup, ListRow } from '@/components/list-row';
import { PrimaryButton } from '@/components/primary-button';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { SkeletonList } from '@/components/skeleton';
import { showToast } from '@/components/toast';
import { initialOf } from '@/constants/format';
import { icons } from '@/constants/icons';
import { SITE_URL } from '@/constants/links';
import { createCircle, deleteCircle, removeCircleMember, type CircleView } from '@/data';
import { useCircle } from '@/hooks/use-circle';
import { useSession } from '@/hooks/use-session';
import { useSyncStatus } from '@/hooks/use-sync-status';
import { haptics } from '@/native/haptics';
import { radius, spacing, useTheme } from '@/theme';

import { circleErrorMessage } from './circle-errors';

function Avatar({ name }: { name: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
      <AppText variant="callout" weight="700" tone="accent" maxFontSizeMultiplier={1.3}>
        {initialOf(name)}
      </AppText>
    </View>
  );
}

/** Who owns a circle I care for (the owner shares; caregivers watch). */
function ownerName(circle: CircleView): string {
  return circle.members.find((m) => m.role === 'member')?.name ?? 'Shared circle';
}

function SignedOut() {
  return (
    <>
      <EmptyState
        icon={icons.circle}
        title="Let someone keep an eye out"
        body="Create a free account, then invite a family member or caregiver. If a dose stays unmarked, they get a gentle heads-up."
        action={
          <View style={{ alignSelf: 'stretch', gap: spacing.sm }}>
            <PrimaryButton title="Create account" size="lg" onPress={() => router.push({ pathname: '/auth', params: { mode: 'sign-up' } })} />
            <PrimaryButton title="Sign in" variant="secondary" onPress={() => router.push({ pathname: '/auth', params: { mode: 'sign-in' } })} />
          </View>
        }
      />
      <ListGroup footer="Without a circle, nothing about your health leaves this phone.">
        <ListRow title="What your circle sees" subtitle="Today's doses and whether they were taken. Never your notes." icon={icons.info} />
        <ListRow title="When they're told" subtitle="Only when a dose is still unmarked after its window and your chosen delay." icon={icons.bell} />
      </ListGroup>
    </>
  );
}

function OwnCircle({ circle, myUserId }: { circle: CircleView; myUserId: string }) {
  const { colors } = useTheme();
  const caregivers = circle.members.filter((m) => m.userId !== myUserId);
  const code = circle.inviteCode;

  const share = () => {
    if (!code) return;
    haptics.selection();
    Share.share({
      message: `Join my Dosely circle so you know if I miss a dose. Install Dosely (${SITE_URL}), open Circle, choose "Join with a code" and enter ${code}.`,
    }).catch(() => undefined);
  };

  const remove = (userId: string, name: string) =>
    Alert.alert(`Remove ${name}?`, 'They will stop seeing your doses and getting alerts.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          removeCircleMember(circle.id, userId)
            .then(() => showToast({ message: `${name} removed` }))
            .catch((e) => showToast({ message: circleErrorMessage(e) })),
      },
    ]);

  const stop = () =>
    Alert.alert('Stop sharing?', 'Your circle is deleted and everything mirrored to the server is removed. Your data stays on this phone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Stop sharing',
        style: 'destructive',
        onPress: () =>
          deleteCircle(circle.id)
            .then(() => showToast({ message: 'Sharing stopped' }))
            .catch((e) => showToast({ message: circleErrorMessage(e) })),
      },
    ]);

  return (
    <View style={{ gap: spacing.md }}>
      {code ? (
        <View style={{ backgroundColor: colors.accentSoft, borderRadius: radius.lg, borderCurve: 'continuous', padding: spacing.lg, gap: spacing.md, alignItems: 'center' }}>
          <AppText variant="callout" tone="accent" weight="600">
            Invite code
          </AppText>
          <AppText
            variant="display"
            selectable
            accessibilityLabel={`Invite code ${code.split('').join(' ')}`}
            style={{ letterSpacing: 6, fontVariant: ['tabular-nums'] }}
          >
            {code}
          </AppText>
          <AppText variant="callout" tone="secondary" align="center">
            Your caregiver enters this in Dosely under Circle › Join with a code.
          </AppText>
          <PrimaryButton title="Share invite" icon={icons.share} onPress={share} />
        </View>
      ) : null}
      <ListGroup footer={caregivers.length ? undefined : 'No one has joined yet.'}>
        {caregivers.map((m) => (
          <ListRow
            key={m.userId}
            title={m.name}
            subtitle={m.role === 'caregiver' ? 'Caregiver' : 'Member'}
            leading={<Avatar name={m.name} />}
            trailing={
              <PrimaryButton title="Remove" variant="ghost" block={false} onPress={() => remove(m.userId, m.name)} />
            }
          />
        ))}
        <ListRow
          title="Preview what they see"
          icon={icons.today}
          onPress={() => router.push({ pathname: '/circle/[id]', params: { id: circle.id } })}
        />
        <ListRow title="Stop sharing" icon={icons.trash} tone="danger" onPress={stop} />
      </ListGroup>
    </View>
  );
}

function StartSharing({ name }: { name: string | undefined }) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const create = async () => {
    setBusy(true);
    try {
      await createCircle(name);
      haptics.taken();
    } catch (e) {
      haptics.error();
      showToast({ message: circleErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <ListGroup footer="You get an invite code to send to the people you trust. You can stop sharing at any time.">
      <View style={{ padding: spacing.md, gap: spacing.md }}>
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
          <Icon name={icons.personAdd} size={28} color={colors.accentText} />
          <AppText variant="body" style={{ flex: 1 }}>
            Create a circle so a caregiver hears about missed doses.
          </AppText>
        </View>
        <PrimaryButton title="Create a circle" loading={busy} onPress={() => void create()} />
      </View>
    </ListGroup>
  );
}

/** Caregiver circle: sign in, share my doses with an invite code, or watch over someone else's. */
export function CircleScreen() {
  const { colors } = useTheme();
  const { data: session, isPending } = useSession();
  const { circles, own, loading, error, refresh } = useCircle({ refreshOnMount: !!session });
  const sync = useSyncStatus();
  const [refreshing, setRefreshing] = useState(false);
  const caring = circles.filter((c) => !c.isOwner);

  const onRefresh = () => {
    setRefreshing(true);
    refresh()
      .catch(() => undefined)
      .finally(() => setRefreshing(false));
  };

  if (isPending && !session) {
    return (
      <Screen>
        <SkeletonList rows={3} />
      </Screen>
    );
  }

  if (!session) {
    return (
      <Screen>
        <SignedOut />
      </Screen>
    );
  }

  const myId = session.user.id;

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />}>
      {error ? (
        <View style={{ backgroundColor: colors.warningSoft, borderRadius: radius.md, padding: spacing.md, gap: spacing.sm }}>
          <AppText variant="callout" tone="warning" selectable>
            {`Showing saved info. ${error}`}
          </AppText>
          <PrimaryButton title="Try again" variant="ghost" block={false} onPress={onRefresh} />
        </View>
      ) : null}

      {loading && circles.length === 0 ? (
        <SkeletonList rows={2} />
      ) : (
        <>
          <View style={{ gap: spacing.sm }}>
            <SectionHeader title="Sharing my doses" />
            {own ? <OwnCircle circle={own} myUserId={myId} /> : <StartSharing name={session.user.name} />}
            {own && sync.lastSyncAt ? (
              <AppText variant="caption" tone="secondary" style={{ paddingHorizontal: spacing.md }}>
                {sync.error ? `Last sync failed: ${sync.error}` : `Synced ${new Date(sync.lastSyncAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
              </AppText>
            ) : null}
          </View>

          <View style={{ gap: spacing.sm }}>
            <SectionHeader title="Caring for" />
            <ListGroup footer={caring.length ? undefined : 'Got a code from someone? Join their circle to see their day.'}>
              {caring.map((c) => (
                <ListRow
                  key={c.id}
                  title={ownerName(c)}
                  subtitle={`${c.members.length} in circle`}
                  leading={<Avatar name={ownerName(c)} />}
                  onPress={() => router.push({ pathname: '/circle/[id]', params: { id: c.id } })}
                />
              ))}
              <ListRow title="Join with a code" icon={icons.personAdd} onPress={() => router.push('/join-circle')} />
            </ListGroup>
          </View>
        </>
      )}
    </Screen>
  );
}
