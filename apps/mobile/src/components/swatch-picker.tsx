import { MED_PALETTE, type MedColor } from '@dosely/shared';
import { Pressable, View } from 'react-native';

import { icons } from '@/constants/icons';
import { haptics } from '@/native/haptics';
import { radius, spacing, touchTarget, useTheme } from '@/theme';

import { Icon } from './icon';

const NAMES: Record<MedColor, string> = {
  teal: 'Teal',
  blue: 'Blue',
  indigo: 'Indigo',
  violet: 'Violet',
  pink: 'Pink',
  red: 'Red',
  orange: 'Orange',
  amber: 'Amber',
  green: 'Green',
  slate: 'Slate',
};

/** Colour picker for medications and profiles (`MED_PALETTE`), as a wrapping row of swatches. */
export function SwatchPicker({ value, onChange }: { value: MedColor; onChange: (color: MedColor) => void }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Colour" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {MED_PALETTE.map((c) => {
        const selected = c.name === value;
        return (
          <Pressable
            key={c.name}
            accessibilityRole="radio"
            accessibilityLabel={NAMES[c.name]}
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              haptics.selection();
              onChange(c.name);
            }}
            style={{
              width: touchTarget + 4,
              height: touchTarget + 4,
              borderRadius: radius.pill,
              borderWidth: 3,
              borderColor: selected ? colors.text : 'transparent',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: touchTarget - 6,
                height: touchTarget - 6,
                borderRadius: radius.pill,
                backgroundColor: c.hex,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {selected ? <Icon name={icons.check} size={18} color="#FFFFFF" weight="bold" /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
