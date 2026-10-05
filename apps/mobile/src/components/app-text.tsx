import { Text, type TextProps, type TextStyle } from 'react-native';

import { tabular as tabularStyle, textStyles, useTheme, type ThemeColors, type TypeToken } from '@/theme';

export type TextTone =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'accent'
  | 'danger'
  | 'success'
  | 'warning'
  | 'onAccent'
  | 'onDanger'
  | 'inverse';

const toneRole: Record<TextTone, keyof ThemeColors> = {
  primary: 'text',
  secondary: 'textSecondary',
  tertiary: 'textTertiary',
  accent: 'accentText',
  danger: 'danger',
  success: 'success',
  warning: 'warning',
  onAccent: 'onAccent',
  onDanger: 'onDanger',
  inverse: 'inverseText',
};

export type AppTextProps = TextProps & {
  variant?: TypeToken;
  tone?: TextTone;
  /** Fixed-width figures for numbers that change in place. */
  tabular?: boolean;
  weight?: TextStyle['fontWeight'];
  align?: TextStyle['textAlign'];
};

/** Every piece of text in the app: a type-scale step plus a colour role. Scales with Dynamic Type. */
export function AppText({ variant = 'body', tone = 'primary', tabular, weight, align, style, ...props }: AppTextProps) {
  const { colors } = useTheme();
  return (
    <Text
      {...props}
      style={[
        textStyles[variant],
        { color: colors[toneRole[tone]] },
        tabular ? tabularStyle : null,
        weight ? { fontWeight: weight } : null,
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}
