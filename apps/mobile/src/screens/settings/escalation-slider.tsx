import { Host, Slider } from '@expo/ui';
import { useRef, useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { formatMinutes } from '@/constants/format';
import { updateSettings } from '@/data';
import { useSettings } from '@/hooks/use-settings';
import { spacing, useTheme } from '@/theme';

const MIN = 15;
const MAX = 120;
const STEP = 5;

/**
 * How long after a dose window closes before the circle is told (15–120 min). The native slider
 * updates the label live and saves once the value settles.
 */
export function EscalationSlider() {
  const { colors, scheme } = useTheme();
  const { escalationMinutes } = useSettings();
  const [draft, setDraft] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shown = draft ?? Math.min(MAX, Math.max(MIN, escalationMinutes));

  const onChange = (value: number) => {
    const next = Math.round(value / STEP) * STEP;
    setDraft(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      updateSettings({ escalationMinutes: next })
        .catch(() => undefined)
        .finally(() => setDraft(null));
    }, 500);
  };

  return (
    <View
      style={{ padding: spacing.md, gap: spacing.sm }}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel="Tell my circle after"
      accessibilityValue={{ min: MIN, max: MAX, now: shown, text: formatMinutes(shown) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e) => onChange(Math.min(MAX, Math.max(MIN, shown + (e.nativeEvent.actionName === 'increment' ? STEP : -STEP))))}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md }}>
        <AppText variant="body" style={{ flexShrink: 1 }}>
          Tell my circle after
        </AppText>
        <AppText variant="body" weight="600" tone="accent" tabular>
          {formatMinutes(shown)}
        </AppText>
      </View>
      <Host matchContents={{ vertical: true }} style={{ alignSelf: 'stretch' }} colorScheme={scheme} seedColor={colors.accent}>
        <Slider value={shown} min={MIN} max={MAX} step={STEP} onValueChange={onChange} />
      </Host>
    </View>
  );
}
