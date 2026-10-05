import Constants from 'expo-constants';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { ListGroup, ListRow } from '@/components/list-row';
import { medColorHex } from '@/components/med-icon';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { SegmentedControl } from '@/components/segmented-control';
import { InfoPill } from '@/components/state-pill';
import { showToast } from '@/components/toast';
import { formatHhmm, initialOf } from '@/constants/format';
import { icons } from '@/constants/icons';
import { links, MEDICAL_DISCLAIMER } from '@/constants/links';
import { deleteAllLocalData, seedDemoData, signOutAndForget } from '@/data';
import { setAppearance, useAppearance, type AppearancePreference } from '@/hooks/use-appearance';
import { useNotificationPermission } from '@/hooks/use-notification-permission';
import { useProfiles } from '@/hooks/use-profiles';
import { useSession } from '@/hooks/use-session';
import { useSettings } from '@/hooks/use-settings';
import { shareHistoryCsv } from '@/native/exports';
import { haptics } from '@/native/haptics';
import { openNotificationSettings, requestNotificationPermission } from '@/native/notifications';
import { onSwatch, spacing } from '@/theme';


import { EscalationSlider } from './escalation-slider';
import { ThemeGallery } from './theme-gallery';

const APPEARANCE = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
] as const;

function ProfileAvatar({ name, color }: { name: string; color: string }) {
  return (
    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: medColorHex(color), alignItems: 'center', justifyContent: 'center' }}>
      <AppText variant="callout" weight="700" maxFontSizeMultiplier={1.3} style={{ color: onSwatch }}>
        {initialOf(name)}
      </AppText>
    </View>
  );
}

function open(url: string) {
  WebBrowser.openBrowserAsync(url).catch(() => undefined);
}

export function SettingsScreen() {
  const profiles = useProfiles();
  const settings = useSettings();
  const appearance = useAppearance();
  const permission = useNotificationPermission();
  const { data: session } = useSession();
  const [exporting, setExporting] = useState(false);

  const reminderStatus =
    permission === null ? '…' : permission.status === 'granted' ? 'On' : permission.status === 'denied' ? 'Off' : 'Not set up';

  const fixReminders = async () => {
    const result = await requestNotificationPermission().catch(() => null);
    if (result && result.status !== 'granted' && !result.canAskAgain) openNotificationSettings().catch(() => undefined);
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const r = await shareHistoryCsv();
      if (!r.ok) showToast({ message: r.reason === 'unavailable' ? "Sharing isn't available on this device." : "Couldn't export. Please try again." });
    } finally {
      setExporting(false);
    }
  };

  const confirmWipe = () => {
    haptics.warning();
    Alert.alert(
      'Delete all data on this phone?',
      'Every medication, dose and profile on this phone is erased and reminders stop. This cannot be undone. Export your history first if you need it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: () =>
            deleteAllLocalData()
              .then(() => showToast({ message: 'All local data deleted' }))
              .catch(() => showToast({ message: "Couldn't delete. Please try again." })),
        },
      ],
    );
  };

  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'Your medications stay on this phone. Caregivers stop getting updates until you sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => signOutAndForget().then(() => showToast({ message: 'Signed out' })).catch(() => undefined),
      },
    ]);

  const version = Constants.expoConfig?.version ?? '';

  return (
    <Screen>
      <View style={{ gap: spacing.sm }}>
        <SectionHeader title="People" />
        <ListGroup footer="Add the people whose medicines you manage, like a parent or a child.">
          {profiles.map((p) => (
            <ListRow
              key={p.id}
              title={p.name}
              subtitle={p.isSelf ? 'You' : undefined}
              leading={<ProfileAvatar name={p.name} color={p.color} />}
              onPress={() => router.push({ pathname: '/profile-editor', params: { id: p.id } })}
            />
          ))}
          <ListRow title="Add someone you look after" icon={icons.personAdd} onPress={() => router.push('/profile-editor')} chevron={false} />
        </ListGroup>
      </View>

      <View style={{ gap: spacing.sm }}>
        <SectionHeader title="Theme" />
        <ThemeGallery />
      </View>

      <View style={{ gap: spacing.sm }}>
        <SectionHeader title="Appearance" />
        <SegmentedControl
          accessibilityLabel="Appearance"
          options={APPEARANCE}
          value={appearance}
          onChange={(v: AppearancePreference) => setAppearance(v)}
        />
      </View>

      <View style={{ gap: spacing.sm }}>
        <SectionHeader title="Reminders" />
        <ListGroup footer="Dose reminders are time-sensitive, so they can break through Focus modes you allow.">
          <ListRow
            title="Notifications"
            icon={permission?.status === 'granted' ? icons.bell : icons.bellOff}
            trailing={<InfoPill label={reminderStatus} tone={permission?.status === 'granted' ? 'accent' : 'warning'} />}
            onPress={permission?.status === 'granted' ? () => openNotificationSettings().catch(() => undefined) : () => void fixReminders()}
            accessibilityHint={permission?.status === 'granted' ? 'Opens system settings' : 'Turns on reminders'}
          />
          <ListRow
            title="Quiet hours"
            icon={icons.moon}
            value={settings.quietHours ? `${formatHhmm(settings.quietHours.start)}–${formatHhmm(settings.quietHours.end)}` : 'Not available yet'}
            subtitle={settings.quietHours ? undefined : 'Use your phone’s Focus or Do Not Disturb for now'}
          />
        </ListGroup>
      </View>

      <View style={{ gap: spacing.sm }}>
        <SectionHeader title="Caregiver alerts" />
        <ListGroup footer="Counted from the end of a dose window. Only applies when you share with a circle.">
          <EscalationSlider />
        </ListGroup>
      </View>

      <View style={{ gap: spacing.sm }}>
        <SectionHeader title="Account" />
        <ListGroup footer={session ? undefined : 'An account is only needed to share with a caregiver circle.'}>
          {session ? (
            <>
              <ListRow title={session.user.name || 'Signed in'} subtitle={session.user.email} icon={icons.account} />
              <ListRow title="Sign out" icon={icons.logout} onPress={confirmSignOut} chevron={false} />
              <ListRow title="Delete account" icon={icons.trash} tone="danger" onPress={() => router.push('/delete-account')} />
            </>
          ) : (
            <ListRow title="Sign in or create account" icon={icons.account} onPress={() => router.push({ pathname: '/auth', params: { mode: 'sign-in' } })} />
          )}
        </ListGroup>
      </View>

      <View style={{ gap: spacing.sm }}>
        <SectionHeader title="Your data" />
        <ListGroup footer="Health data stays on this phone, encrypted, unless you share it with a circle.">
          <ListRow title={exporting ? 'Preparing…' : 'Export history (CSV)'} icon={icons.share} onPress={() => void exportCsv()} disabled={exporting} chevron={false} />
          <ListRow title="Delete all data on this phone" icon={icons.trash} tone="danger" onPress={confirmWipe} />
        </ListGroup>
      </View>

      {__DEV__ ? (
        <View style={{ gap: spacing.sm }}>
          <SectionHeader title="Developer" />
          <ListGroup>
            <ListRow
              title="Load demo data"
              subtitle="Self + Mom, 4 meds, 6 days of history"
              icon={icons.sparkles}
              chevron={false}
              onPress={() =>
                seedDemoData()
                  .then(() => showToast({ message: 'Demo data loaded' }))
                  .catch((e: unknown) => showToast({ message: e instanceof Error ? e.message : 'Seed failed' }))
              }
            />
          </ListGroup>
        </View>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <SectionHeader title="About" />
        <ListGroup footer={MEDICAL_DISCLAIMER}>
          <ListRow title="Version" value={version} icon={icons.info} />
          <ListRow title="Privacy" icon={icons.shield} onPress={() => open(links.privacy)} accessibilityRole="link" />
          <ListRow title="Support" icon={icons.lifebuoy} onPress={() => open(links.support)} accessibilityRole="link" />
          <ListRow title="Terms" icon={icons.doc} onPress={() => open(links.terms)} accessibilityRole="link" />
        </ListGroup>
        <AppText variant="caption" tone="tertiary" align="center">
          Dosely is free. No ads, no subscriptions.
        </AppText>
      </View>
    </Screen>
  );
}
