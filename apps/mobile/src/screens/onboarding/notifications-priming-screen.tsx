import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { TextField } from '@/components/form-fields';
import { Icon } from '@/components/icon';
import { PrimaryButton } from '@/components/primary-button';
import { icons, type IconName } from '@/constants/icons';
import { ensureSelfProfile, updateSettings } from '@/data';
import { haptics } from '@/native/haptics';
import { requestNotificationPermission } from '@/native/notifications';
import { radius, spacing, useTheme } from '@/theme';

function Point({ icon, text }: { icon: IconName; text: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
      <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon name={icon} size={18} color={colors.accentText} />
      </View>
      <AppText variant="body" tone="secondary" style={{ flex: 1, paddingTop: spacing.xs }}>
        {text}
      </AppText>
    </View>
  );
}

/**
 * Asks for notification permission only after explaining why (the OS prompt is one-shot), then
 * creates the user's own profile and finishes onboarding. "Not now" still finishes: reminders can
 * be turned on later from Settings.
 */
export function NotificationsPrimingScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const finish = async (ask: boolean) => {
    setBusy(true);
    try {
      if (ask) await requestNotificationPermission().catch(() => null);
      ensureSelfProfile(name.trim() || 'Me');
      haptics.taken();
      await updateSettings({ onboarded: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: insets.top + spacing.xl,
          paddingBottom: insets.bottom + spacing.lg,
          paddingHorizontal: spacing.lg,
          gap: spacing.xl,
        }}
      >
        <View style={{ alignItems: 'center', gap: spacing.md }}>
          <View
            style={{
              width: 88,
              height: 88,
              borderRadius: radius.lg,
              borderCurve: 'continuous',
              backgroundColor: colors.accentSoft,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={icons.bell} size={44} color={colors.accentText} />
          </View>
          <AppText variant="title" align="center" accessibilityRole="header">
            Turn on reminders
          </AppText>
          <AppText variant="body" tone="secondary" align="center">
            Dosely only notifies you when a dose is due, and marks it time-sensitive so it can reach you in Focus modes.
          </AppText>
        </View>

        <View style={{ gap: spacing.md }}>
          <Point icon={icons.check} text="Taken, Snooze and Skip work right from the notification." />
          <Point icon={icons.clock} text="Reminders follow your local time, even across daylight-saving changes." />
          <Point icon={icons.shield} text="Your health data stays on this phone unless you join a caregiver circle." />
        </View>

        <TextField
          label="What should we call you? (optional)"
          placeholder="Your first name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoComplete="given-name"
          textContentType="givenName"
          returnKeyType="done"
          maxLength={40}
        />

        <View style={{ flex: 1 }} />

        <View style={{ gap: spacing.sm }}>
          <PrimaryButton title="Turn on reminders" size="lg" icon={icons.bell} loading={busy} onPress={() => finish(true)} />
          <PrimaryButton title="Not now" variant="ghost" disabled={busy} onPress={() => finish(false)} />
        </View>
      </ScrollView>
    </View>
  );
}
