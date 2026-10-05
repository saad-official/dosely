import { MED_PALETTE, type MedColor, type MedIcon as MedIconName } from '@dosely/shared';
import { View } from 'react-native';

import { medIcons } from '@/constants/icons';
import { radius, useTheme, withAlpha } from '@/theme';

import { Icon as IconGlyph } from './icon';

/** Palette name → hex (`MED_PALETTE`); unknown names fall back to teal. */
export function medColorHex(name: string | null | undefined): string {
  return MED_PALETTE.find((c) => c.name === name)?.hex ?? MED_PALETTE[0].hex;
}

/** A small colour dot for a medication or profile. */
export function MedDot({ color, size = 10 }: { color: MedColor | string; size?: number }) {
  return (
    <View
      accessible={false}
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: medColorHex(color) }}
    />
  );
}

/**
 * The medication's icon on a soft disc of its colour. The tint is a translucent wash, so the icon
 * (in the full colour) stays legible on both light and dark surfaces.
 */
export function MedIcon({ icon, color, size = 44 }: { icon: MedIconName; color: MedColor | string; size?: number }) {
  const { isDark } = useTheme();
  const hex = medColorHex(color);
  const name = medIcons[icon] ?? medIcons.pill;
  return (
    <View
      accessible={false}
      style={{
        width: size,
        height: size,
        borderRadius: size >= 56 ? radius.md : radius.pill,
        borderCurve: 'continuous',
        backgroundColor: withAlpha(hex, isDark ? 0.26 : 0.16),
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <IconGlyph name={name} color={hex} size={Math.round(size * 0.5)} />
    </View>
  );
}

