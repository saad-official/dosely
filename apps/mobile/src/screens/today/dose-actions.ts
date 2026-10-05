// Today's dose intents with the UI feedback around them: haptic in the same frame as the visual,
// an Undo toast for Taken / Skip, and a quiet error toast if a write fails.
import { showToast } from '@/components/toast';
import { formatMinutes } from '@/constants/format';
import { logAsNeeded, skipDose, snoozeDose, snoozeDoses, takeDose, takeDoses, undoDose, type DoseView, type MedicationView } from '@/data';
import { haptics } from '@/native/haptics';

const failed = () => {
  haptics.error();
  showToast({ message: "Couldn't save that. Please try again." });
};

const nameOf = (dose: DoseView) => dose.medication?.name ?? 'Dose';

export function take(dose: DoseView) {
  haptics.taken();
  takeDose(dose.id).catch(failed);
  showToast({ message: `${nameOf(dose)} marked taken`, actionLabel: 'Undo', onAction: () => void undoDose(dose.id).catch(failed) });
}

export function skip(dose: DoseView) {
  haptics.skipped();
  skipDose(dose.id).catch(failed);
  showToast({ message: `${nameOf(dose)} skipped`, actionLabel: 'Undo', onAction: () => void undoDose(dose.id).catch(failed) });
}

export function snooze(dose: DoseView, minutes: number) {
  haptics.snoozed();
  snoozeDose(dose.id, minutes).catch(failed);
  showToast({ message: `${nameOf(dose)} snoozed for ${formatMinutes(minutes)}` });
}

export function undo(dose: DoseView) {
  haptics.undone();
  undoDose(dose.id).catch(failed);
}

export function takeAll(ids: string[]) {
  if (!ids.length) return;
  haptics.taken();
  takeDoses(ids).catch(failed);
  showToast({
    message: ids.length === 1 ? 'Marked taken' : `${ids.length} doses marked taken`,
    actionLabel: 'Undo',
    onAction: () => {
      for (const id of ids) undoDose(id).catch(failed);
    },
  });
}

export function snoozeAll(ids: string[], minutes = 10) {
  if (!ids.length) return;
  haptics.snoozed();
  snoozeDoses(ids, minutes).catch(failed);
  showToast({ message: `Snoozed for ${formatMinutes(minutes)}` });
}

export async function logDose(med: MedicationView) {
  const result = await logAsNeeded(med.id).catch(() => null);
  if (!result) return failed();
  if (result.ok) {
    haptics.taken();
    const id = result.dose.id;
    showToast({ message: `${med.name} logged`, actionLabel: 'Undo', onAction: () => void undoDose(id).catch(failed) });
    return;
  }
  haptics.warning();
  showToast({
    message: result.reason === 'daily-limit' ? `That's today's limit for ${med.name}.` : `${med.name} can't be logged right now.`,
  });
}
