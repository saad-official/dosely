import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { AppText } from '@/components/app-text';
import { ChoiceChips, Field, TextField } from '@/components/form-fields';
import { FormSheet } from '@/components/form-sheet';
import { MedIcon } from '@/components/med-icon';
import { PrimaryButton } from '@/components/primary-button';
import { showToast } from '@/components/toast';
import { formatDayShort, plural } from '@/constants/format';
import { setInventory } from '@/data';
import { useMedication } from '@/hooks/use-medications';
import { haptics } from '@/native/haptics';
import { spacing } from '@/theme';

const REFILLS = [30, 60, 90] as const;

/** Refill or correct the supply count of one medication (or stop tracking it). */
export function InventorySheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const med = useMedication(id);
  const [text, setText] = useState(med?.inventoryCount != null ? String(med.inventoryCount) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!med) {
    return (
      <FormSheet title="Supply">
        <AppText variant="body" tone="secondary">
          This medication is no longer available.
        </AppText>
      </FormSheet>
    );
  }

  const current = med.inventoryCount ?? 0;
  const parsed = Number(text.replace(',', '.'));
  const valid = text.trim() !== '' && Number.isFinite(parsed) && parsed >= 0 && parsed <= 100000;

  const commit = async (value: number | null) => {
    setBusy(true);
    setError(null);
    try {
      await setInventory(med.id, value);
      haptics.taken();
      router.back();
      showToast({ message: value === null ? `Stopped tracking ${med.name}` : `${med.name}: ${plural(value, 'dose')} on hand` });
    } catch {
      haptics.error();
      setError("Couldn't save. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormSheet title="Supply" primaryLabel="Save" primaryDisabled={!valid} busy={busy} onPrimary={() => void commit(parsed)}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
        <MedIcon icon={med.icon} color={med.color} size={48} />
        <View style={{ flex: 1 }}>
          <AppText variant="headline">{med.name}</AppText>
          <AppText variant="callout" tone="secondary">
            {med.inventoryCount == null
              ? 'Supply not tracked yet'
              : med.refillDate && med.daysLeft !== null
                ? `${plural(med.daysLeft, 'day')} left · runs out around ${formatDayShort(med.refillDate)}`
                : `${med.inventoryCount} on hand`}
          </AppText>
        </View>
      </View>

      <TextField
        label="On hand now"
        keyboardType="decimal-pad"
        value={text}
        onChangeText={setText}
        placeholder="0"
        error={error}
        maxLength={6}
        autoFocus
      />

      <Field label="Just refilled? Add a pack">
        <ChoiceChips
          accessibilityLabel="Add a pack"
          options={REFILLS.map((n) => ({ value: n, label: `+${n}` }))}
          isSelected={() => false}
          onToggle={(n) => setText(String((valid ? parsed : current) + n))}
        />
      </Field>

      {med.inventoryCount != null ? (
        <PrimaryButton title="Stop tracking supply" variant="ghost" disabled={busy} onPress={() => void commit(null)} />
      ) : null}
    </FormSheet>
  );
}
