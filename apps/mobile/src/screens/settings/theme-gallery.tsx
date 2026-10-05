import { THEME_IDS, THEMES, type ThemeId } from '@dosely/shared';
import { ScrollView, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { SegmentedControl } from '@/components/segmented-control';
import { THEME_CARD_WIDTH, ThemeCard } from '@/components/theme-card';
import { showToast } from '@/components/toast';
import { ToggleRow } from '@/components/toggle-row';
import { ListGroup } from '@/components/list-row';
import { updateSettings } from '@/data';
import { useEffectiveTheme } from '@/hooks/use-effective-theme';
import { useSettings } from '@/hooks/use-settings';
import { supportsAlternateIcons } from '@/native/app-icon';
import { haptics } from '@/native/haptics';
import { spacing } from '@/theme';

const REGIONS = [
  { value: 'US', label: 'US' },
  { value: 'CA', label: 'Canada' },
  { value: 'both', label: 'Both' },
] as const;

/**
 * Theme picker: a horizontal gallery of every theme (palette, motif and Home Screen icon), the
 * "switch automatically by date" toggle and the holiday calendar region. Picking a card applies it
 * at once through `updateSettings({ theme })`, which also swaps the app icon.
 */
export function ThemeGallery() {
  const settings = useSettings();
  const effective = useEffectiveTheme();
  const iconsSupported = supportsAlternateIcons();

  const pick = (id: ThemeId) => {
    if (id === settings.theme && !settings.autoSeasonal) return;
    haptics.selection();
    updateSettings({ theme: id }).catch(() => showToast({ message: "Couldn't change the theme. Please try again." }));
    if (settings.autoSeasonal && effective !== id) {
      showToast({ message: `Saved. ${THEMES[effective].name} shows until its dates end.` });
    }
  };

  const seasonal = settings.autoSeasonal && effective !== settings.theme;

  return (
    <View style={{ gap: spacing.md }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={THEME_CARD_WIDTH + spacing.sm}
        style={{ marginHorizontal: -spacing.md }}
        contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm }}
        accessibilityRole="radiogroup"
        accessibilityLabel="Theme"
      >
        {THEME_IDS.map((id) => (
          <ThemeCard
            key={id}
            themeId={id}
            selected={id === settings.theme}
            activeBadge={seasonal && id === effective ? 'Showing now' : undefined}
            onPress={() => pick(id)}
          />
        ))}
      </ScrollView>

      <ListGroup
        footer={
          iconsSupported
            ? 'Your Home Screen icon changes with the theme. iOS confirms each change with a short system message.'
            : 'The Home Screen icon stays the same on this device.'
        }
      >
        <ToggleRow
          title="Switch automatically by date"
          subtitle="Seasonal themes appear on their holidays, then your pick returns"
          value={settings.autoSeasonal}
          onValueChange={(autoSeasonal) => {
            haptics.selection();
            updateSettings({ autoSeasonal }).catch(() => undefined);
          }}
        />
        <View style={{ padding: spacing.md, gap: spacing.sm }}>
          <AppText variant="body">Holiday calendar</AppText>
          <SegmentedControl
            accessibilityLabel="Holiday calendar region"
            options={REGIONS}
            value={settings.region}
            onChange={(region) => updateSettings({ region }).catch(() => undefined)}
          />
        </View>
      </ListGroup>
    </View>
  );
}
