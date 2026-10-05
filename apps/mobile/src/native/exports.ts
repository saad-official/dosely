// CSV export of dose history: shared `exportRows` / `toCsv` → a cache file → the share sheet.
import { exportRows, toCsv } from '@dosely/shared';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { allDoseRows } from '@/data/doses-repo';
import { allMedicationRows } from '@/data/medications-repo';
import { listProfiles } from '@/data/profiles-repo';
import { getSettings } from '@/data/settings-repo';
import { deviceTimeZone, nowIso, todayKey } from '@/data/time';

export type ExportResult = { ok: true; uri: string; rows: number } | { ok: false; reason: 'unavailable' | 'error'; message?: string };

/** CSV text of every non-deleted dose (optionally one profile's), in local time. */
export function buildHistoryCsv(opts: { profileId?: string } = {}): { csv: string; rows: number } {
  const doses = allDoseRows().filter((d) => !opts.profileId || d.profileId === opts.profileId);
  const rows = exportRows(doses, allMedicationRows(), deviceTimeZone(), {
    now: nowIso(),
    escalationMinutes: getSettings().escalationMinutes,
    profiles: listProfiles(),
  });
  return { csv: toCsv(rows), rows: rows.length - 1 };
}

/** Writes the CSV to the cache directory and opens the share sheet. */
export async function shareHistoryCsv(opts: { profileId?: string } = {}): Promise<ExportResult> {
  try {
    if (!(await Sharing.isAvailableAsync())) return { ok: false, reason: 'unavailable' };
    const { csv, rows } = buildHistoryCsv(opts);
    const file = new File(Paths.cache, `dosely-history-${todayKey()}.csv`);
    if (file.exists) file.delete();
    file.create();
    file.write(csv);
    await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: 'Export history' });
    return { ok: true, uri: file.uri, rows };
  } catch (error) {
    return { ok: false, reason: 'error', message: error instanceof Error ? error.message : String(error) };
  }
}
