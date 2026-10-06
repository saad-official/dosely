import { timeLeftLabel } from '@dosely/shared';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { GlassCard } from '@/components/glass-card';
import { Icon } from '@/components/icon';
import { MedDot } from '@/components/med-icon';
import { PrimaryButton } from '@/components/primary-button';
import { icons } from '@/constants/icons';
import type { DoseView } from '@/data';
import { formatClock } from '@/data';
import { spacing, useTheme } from '@/theme';

import { snoozeAll, takeAll } from './dose-actions';

/**
 * The floating "due now" card for the open dose window: what is due, how long the window has left,
 * and the two actions that matter (Taken all, Snooze 10). Glass on iOS 26.
 */
export function DueNowCard({ doses, endsAt }: { doses: DoseView[]; endsAt: string }) {
  const { colors } = useTheme();
  const ids = doses.map((d) => d.id);
  const left = timeLeftLabel(endsAt);
  const since = doses[0] ? formatClock(doses[0].dueAt) : '';
  return (
    <View>
      <GlassCard tinted padding={spacing.md} gap={spacing.md}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Icon name={icons.bell} size={18} color={colors.accentText} weight="semibold" />
          <AppText variant="callout" weight="700" tone="accent" style={{ flex: 1 }} accessibilityRole="header">
            {`Due now · since ${since}`}
          </AppText>
          <AppText variant="callout" weight="600" tone="secondary" tabular>
            {left}
          </AppText>
        </View>
        <View style={{ gap: spacing.sm }} accessible accessibilityLabel={doses.map((d) => [d.medication?.name, d.medication?.strength].filter(Boolean).join(' ')).join(', ')}>
          {doses.map((d) => (
            <View key={d.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <MedDot color={d.medication?.color ?? 'teal'} size={12} />
              <AppText variant="headline" style={{ flexShrink: 1 }}>
                {d.medication?.name ?? 'Medication'}
              </AppText>
              {d.medication?.strength ? (
                <AppText variant="body" tone="secondary">
                  {d.medication.strength}
                </AppText>
              ) : null}
            </View>
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <PrimaryButton
            title={doses.length > 1 ? 'Taken all' : 'Taken'}
            icon={icons.check}
            size="lg"
            style={{ flex: 1 }}
            onPress={() => takeAll(ids)}
          />
          <PrimaryButton title="Snooze 10" icon={icons.snooze} size="lg" variant="tonal" style={{ flex: 1 }} onPress={() => snoozeAll(ids, 10)} />
        </View>
      </GlassCard>
    </View>
  );
}
