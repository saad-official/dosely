import type { Profile } from '@dosely/shared';
import { Pressable, ScrollView, View } from 'react-native';

import { haptics } from '@/native/haptics';
import { CHROME_FONT_CAP, radius, spacing, touchTarget, useTheme } from '@/theme';

import { AppText } from './app-text';
import { MedDot } from './med-icon';

export type ProfileChipsProps = {
  profiles: Profile[];
  /** null = everyone. */
  value: string | null;
  onChange: (profileId: string | null) => void;
  /** Offer an "Everyone" chip (Today, History). */
  includeAll?: boolean;
};

/** Profile switcher shown when the user looks after more than one person. */
export function ProfileChips({ profiles, value, onChange, includeAll = true }: ProfileChipsProps) {
  const { colors } = useTheme();
  if (profiles.length < 2) return null;
  const options: { id: string | null; label: string; color?: string }[] = [
    ...(includeAll ? [{ id: null, label: 'Everyone' }] : []),
    ...profiles.map((p) => ({ id: p.id, label: p.isSelf ? `${p.name} (you)` : p.name, color: p.color })),
  ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -spacing.md }}
      contentContainerStyle={{ paddingHorizontal: spacing.md, gap: spacing.sm }}
      accessibilityRole="tablist"
    >
      {options.map((o) => {
        const selected = o.id === value;
        return (
          <Pressable
            key={o.id ?? 'all'}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={o.label}
            onPress={() => {
              if (selected) return;
              haptics.selection();
              onChange(o.id);
            }}
            style={({ pressed }) => ({
              minHeight: touchTarget,
              paddingHorizontal: spacing.md,
              borderRadius: radius.pill,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.sm,
              backgroundColor: selected ? colors.accent : pressed ? colors.surfaceSunken : colors.surfaceElevated,
            })}
          >
            {o.color ? (
              <View style={{ borderRadius: radius.pill, borderWidth: selected ? 2 : 0, borderColor: colors.onAccent }}>
                <MedDot color={o.color} size={10} />
              </View>
            ) : null}
            <AppText
              variant="callout"
              weight="600"
              maxFontSizeMultiplier={CHROME_FONT_CAP}
              style={{ color: selected ? colors.onAccent : colors.text }}
            >
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
