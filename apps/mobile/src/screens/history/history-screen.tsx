import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { EmptyState } from '@/components/empty-state';
import { MedIcon } from '@/components/med-icon';
import { PrimaryButton } from '@/components/primary-button';
import { ProfileChips } from '@/components/profile-chips';
import { Screen } from '@/components/screen';
import { SectionHeader } from '@/components/section-header';
import { SegmentedControl } from '@/components/segmented-control';
import { Skeleton } from '@/components/skeleton';
import { StatRow, StatTile } from '@/components/stat-tile';
import { showToast } from '@/components/toast';
import { formatPercent, plural } from '@/constants/format';
import { icons } from '@/constants/icons';
import { type MedAdherence, type MedicationView } from '@/data';
import { lastDays, useAdherence } from '@/hooks/use-adherence';
import { useMedications } from '@/hooks/use-medications';
import { useProfiles } from '@/hooks/use-profiles';
import { haptics } from '@/native/haptics';
import { shareHistoryCsv } from '@/native/exports';
import { hairline, radius, spacing, useTheme } from '@/theme';

import { DayGrid } from './day-grid';

const RANGES = [
  { value: '7', label: '7 days' },
  { value: '30', label: '30 days' },
] as const;

function MedSummaryRow({ stat, med }: { stat: MedAdherence; med: MedicationView | undefined }) {
  const { colors } = useTheme();
  const settled = stat.taken + stat.skipped + stat.missed;
  const rate = stat.rate ?? 0;
  return (
    <View
      accessible
      accessibilityLabel={`${med?.name ?? 'Medication'}: ${stat.taken} of ${settled} taken, ${formatPercent(stat.rate)}${stat.streak ? `, ${plural(stat.streak, 'day')} streak` : ''}`}
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.surfaceElevated }}
    >
      <MedIcon icon={med?.icon ?? 'pill'} color={med?.color ?? 'slate'} size={40} />
      <View style={{ flex: 1, gap: spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
          <AppText variant="body" weight="600" style={{ flex: 1 }} numberOfLines={2}>
            {med?.name ?? 'Removed medication'}
          </AppText>
          <AppText variant="body" weight="600" tabular>
            {formatPercent(stat.rate)}
          </AppText>
        </View>
        <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.track, overflow: 'hidden', flexDirection: 'row' }}>
          <View style={{ flex: rate, backgroundColor: colors.accent }} />
          <View style={{ flex: 1 - rate }} />
        </View>
        <AppText variant="caption" tone="secondary">
          {[`${stat.taken} of ${settled} taken`, stat.missed ? `${stat.missed} missed` : null, stat.streak ? `${plural(stat.streak, 'day')} streak` : null]
            .filter(Boolean)
            .join(' · ')}
        </AppText>
      </View>
    </View>
  );
}

/** Adherence over the last 7 or 30 days: headline rates, a day grid and per-medication rows. */
export function HistoryScreen() {
  const { colors } = useTheme();
  const profiles = useProfiles();
  const [range, setRange] = useState<'7' | '30'>('7');
  const [profileId, setProfileId] = useState<string | null>(null);
  const activeProfileId = profileId && profiles.some((p) => p.id === profileId) ? profileId : null;
  const report = useAdherence(lastDays(Number(range)), activeProfileId);
  const meds = useMedications(activeProfileId, { includeArchived: true });
  const medById = new Map(meds.map((m) => [m.id, m]));
  const [exporting, setExporting] = useState(false);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const result = await shareHistoryCsv({ profileId: activeProfileId ?? undefined });
      if (!result.ok) {
        haptics.warning();
        showToast({ message: result.reason === 'unavailable' ? "Sharing isn't available on this device." : "Couldn't export. Please try again." });
      }
    } finally {
      setExporting(false);
    }
  };

  const bestStreak = Math.max(0, ...(report?.perMed.map((m) => m.streak) ?? [0]));
  const settled = report ? report.taken + report.skipped + report.missed : 0;

  return (
    <Screen>
      <ProfileChips profiles={profiles} value={activeProfileId} onChange={setProfileId} />
      <SegmentedControl accessibilityLabel="Range" options={RANGES} value={range} onChange={setRange} />

      {!report ? (
        <View style={{ gap: spacing.md }}>
          <Skeleton height={96} radius="md" />
          <Skeleton height={220} radius="md" />
        </View>
      ) : report.total === 0 ? (
        <EmptyState
          icon={icons.history}
          title="Your history starts here"
          body="Once doses are due, you'll see how each day went. Nothing to judge, just a clear picture to share with your doctor."
        />
      ) : (
        <>
          <StatRow>
            <StatTile label="Adherence" icon={icons.checkCircle} value={formatPercent(report.rate)} caption={`${report.taken} of ${settled} settled doses`} />
            <StatTile
              label="On time"
              icon={icons.clock}
              value={formatPercent(report.onTimeRate)}
              caption="Taken within the dose window"
            />
            <StatTile label="Best streak" icon={icons.streak} value={plural(bestStreak, 'day')} caption="Fully taken, in a row" />
          </StatRow>

          <View style={{ gap: spacing.sm }}>
            <SectionHeader title={range === '7' ? 'This week' : 'Last 30 days'} />
            <View style={{ backgroundColor: colors.surfaceElevated, borderRadius: radius.md, borderCurve: 'continuous', padding: spacing.md }}>
              <DayGrid days={report.days} large={range === '7'} />
            </View>
          </View>

          {report.perMed.length ? (
            <View style={{ gap: spacing.sm }}>
              <SectionHeader title="By medication" />
              <View style={{ borderRadius: radius.md, borderCurve: 'continuous', overflow: 'hidden', backgroundColor: colors.separator, gap: hairline }}>
                {report.perMed.map((s) => (
                  <MedSummaryRow key={s.medicationId} stat={s} med={medById.get(s.medicationId)} />
                ))}
              </View>
            </View>
          ) : null}

          {report.pending ? (
            <AppText variant="caption" tone="secondary" align="center">
              {`${plural(report.pending, 'dose')} not marked yet ${report.pending === 1 ? 'is' : 'are'} left out of these figures.`}
            </AppText>
          ) : null}
        </>
      )}

      <PrimaryButton title="Export CSV" icon={icons.share} variant="secondary" loading={exporting} onPress={() => void exportCsv()} />
    </Screen>
  );
}
