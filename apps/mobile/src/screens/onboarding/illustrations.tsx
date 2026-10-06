// Onboarding artwork built from the app's own components, so it always matches the current theme.
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { MedIcon, medColorHex } from '@/components/med-icon';
import { icons } from '@/constants/icons';
import { buildAppTheme, hairline, onSwatchFor, radius, spacing, useTheme, withAlpha } from '@/theme';

function MiniButton({ label, filled }: { label: string; filled?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        minHeight: 40,
        borderRadius: radius.sm,
        backgroundColor: filled ? colors.accent : withAlpha(colors.text, 0.08),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <AppText variant="callout" weight="600" maxFontSizeMultiplier={1.3} style={{ color: filled ? colors.onAccent : colors.text }}>
        {label}
      </AppText>
    </View>
  );
}

/** Page 1: a reminder notification with Taken / Snooze / Skip right on it. */
export function NotificationArt() {
  const { colors, shadow } = useTheme();
  return (
    <View
      style={{
        width: '100%',
        maxWidth: 340,
        backgroundColor: colors.surfaceElevated,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        padding: spacing.md,
        gap: spacing.md,
        boxShadow: shadow('lg'),
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <MedIcon icon="pill" color="teal" size={36} />
        <View style={{ flex: 1 }}>
          <AppText variant="caption" tone="secondary" maxFontSizeMultiplier={1.3}>
            DOSELY · now
          </AppText>
          <AppText variant="body" weight="600" maxFontSizeMultiplier={1.3}>
            Metformin 500 mg is due
          </AppText>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <MiniButton label="Taken" filled />
        <MiniButton label="Snooze 10" />
        <MiniButton label="Skip" />
      </View>
    </View>
  );
}

/** Page 2: the dose-window Live Activity on a dark Lock Screen. */
export function LiveActivityArt() {
  const { shadow, themeId } = useTheme();
  // The Lock Screen is always dark: paint the whole mock (accent included) with the theme's dark
  // palette; the light-scheme accent is too deep to read on it.
  const lock = buildAppTheme(themeId, 'dark').colors;
  return (
    <View
      style={{
        width: '100%',
        maxWidth: 340,
        backgroundColor: lock.surfaceSunken,
        borderRadius: radius.lg + 4,
        borderCurve: 'continuous',
        // In dark mode the mock is darker than the page by a hair; the edge keeps it a "screen".
        borderWidth: hairline,
        borderColor: lock.border,
        padding: spacing.md,
        gap: spacing.md,
        boxShadow: shadow('lg'),
      }}
    >
      <AppText variant="display" weight="600" align="center" maxFontSizeMultiplier={1.2} style={{ color: lock.text }}>
        8:12
      </AppText>
      <View style={{ backgroundColor: withAlpha(lock.text, 0.1), borderRadius: radius.md, padding: spacing.md, gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Icon name={icons.today} size={18} color={lock.accent} />
          <AppText variant="callout" weight="600" maxFontSizeMultiplier={1.3} style={{ flex: 1, color: lock.text }}>
            Morning doses · 2 due
          </AppText>
          <AppText variant="caption" maxFontSizeMultiplier={1.3} style={{ color: lock.textSecondary }}>
            48 min left
          </AppText>
        </View>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: withAlpha(lock.text, 0.15), overflow: 'hidden' }}>
          <View style={{ width: '22%', height: 6, backgroundColor: lock.accent }} />
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.xs }}>
          <View style={{ flex: 1, minHeight: 38, borderRadius: radius.sm, backgroundColor: lock.accent, alignItems: 'center', justifyContent: 'center' }}>
            <AppText variant="callout" weight="600" maxFontSizeMultiplier={1.3} style={{ color: lock.onAccent }}>
              Taken all
            </AppText>
          </View>
          <View style={{ flex: 1, minHeight: 38, borderRadius: radius.sm, backgroundColor: withAlpha(lock.text, 0.16), alignItems: 'center', justifyContent: 'center' }}>
            <AppText variant="callout" weight="600" maxFontSizeMultiplier={1.3} style={{ color: lock.text }}>
              Snooze
            </AppText>
          </View>
        </View>
      </View>
    </View>
  );
}

/** Page 3: a small circle of people and the gentle alert they get. */
export function CircleArt() {
  const { colors, shadow } = useTheme();
  const people = [
    { initial: 'M', color: medColorHex('pink') },
    { initial: 'S', color: medColorHex('blue') },
    { initial: 'A', color: medColorHex('green') },
  ];
  return (
    <View style={{ width: '100%', maxWidth: 340, alignItems: 'center', gap: spacing.lg }}>
      <View style={{ flexDirection: 'row' }}>
        {people.map((p, i) => (
          <View
            key={p.initial}
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              marginStart: i === 0 ? 0 : -14,
              backgroundColor: p.color,
              borderWidth: 3,
              borderColor: colors.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AppText variant="headline" weight="700" maxFontSizeMultiplier={1.2} style={{ color: onSwatchFor(p.color) }}>
              {p.initial}
            </AppText>
          </View>
        ))}
      </View>
      <View
        style={{
          alignSelf: 'stretch',
          backgroundColor: colors.surfaceElevated,
          borderRadius: radius.lg,
          borderCurve: 'continuous',
          padding: spacing.md,
          flexDirection: 'row',
          gap: spacing.sm,
          alignItems: 'center',
          boxShadow: shadow('lg'),
        }}
      >
        <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.warningSoft, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={icons.bell} size={18} color={colors.warning} />
        </View>
        <View style={{ flex: 1 }}>
          <AppText variant="callout" weight="600" maxFontSizeMultiplier={1.3}>
            {"Mom's 8:00 PM dose isn't marked yet"}
          </AppText>
          <AppText variant="caption" tone="secondary" maxFontSizeMultiplier={1.3}>
            Sent to Sam and Alex, 30 min after the window
          </AppText>
        </View>
      </View>
    </View>
  );
}

