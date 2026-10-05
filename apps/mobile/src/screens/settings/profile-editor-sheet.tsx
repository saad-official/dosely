import { MED_COLOR_NAMES, type MedColor } from '@dosely/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Field, TextField } from '@/components/form-fields';
import { FormSheet } from '@/components/form-sheet';
import { medColorHex } from '@/components/med-icon';
import { PrimaryButton } from '@/components/primary-button';
import { SwatchPicker } from '@/components/swatch-picker';
import { showToast } from '@/components/toast';
import { initialOf } from '@/constants/format';
import { icons } from '@/constants/icons';
import { addProfile, deleteProfile, renameProfile } from '@/data';
import { useMedications } from '@/hooks/use-medications';
import { useProfile, useProfiles } from '@/hooks/use-profiles';
import { haptics } from '@/native/haptics';
import { onSwatch } from '@/theme';

/** Add a person you look after, or rename / recolour / remove one. */
export function ProfileEditorSheet() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useProfile(id);
  const profiles = useProfiles();
  const meds = useMedications(existing?.id ?? '__none__');
  const used = new Set(profiles.map((p) => p.color));
  const firstFree = MED_COLOR_NAMES.find((c) => !used.has(c)) ?? 'violet';
  const [name, setName] = useState(existing?.name ?? '');
  const [color, setColor] = useState<MedColor>(existing?.color ?? firstFree);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Add a name.');
      haptics.warning();
      return;
    }
    setBusy(true);
    try {
      if (existing) await renameProfile(existing.id, { name: trimmed, color, initial: initialOf(trimmed) });
      else await addProfile({ name: trimmed, color, initial: initialOf(trimmed) });
      haptics.taken();
      router.back();
    } catch {
      haptics.error();
      setError("Couldn't save. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!existing) return;
    haptics.warning();
    Alert.alert(
      `Remove ${existing.name}?`,
      meds.length
        ? `Their ${meds.length} medication${meds.length === 1 ? '' : 's'} and upcoming reminders are removed too. Past history stays.`
        : 'They are removed from Dosely.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () =>
            deleteProfile(existing.id)
              .then(() => {
                router.back();
                showToast({ message: `${existing.name} removed` });
              })
              .catch(() => showToast({ message: "Couldn't remove. Please try again." })),
        },
      ],
    );
  };

  return (
    <FormSheet title={existing ? 'Edit person' : 'Add a person'} primaryLabel="Save" onPrimary={() => void save()} busy={busy}>
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: medColorHex(color), alignItems: 'center', justifyContent: 'center' }}>
          <AppText variant="title" weight="700" maxFontSizeMultiplier={1.2} style={{ color: onSwatch }}>
            {initialOf(name || '?')}
          </AppText>
        </View>
      </View>
      <TextField
        label="Name"
        placeholder={existing?.isSelf ? 'Your name' : 'e.g. Mom'}
        value={name}
        onChangeText={(t) => {
          setName(t);
          setError(null);
        }}
        error={error}
        autoCapitalize="words"
        autoFocus={!existing}
        maxLength={80}
        returnKeyType="done"
        onSubmitEditing={() => void save()}
      />
      <Field label="Colour" hint="Used for their medications on Today when you look after more than one person.">
        <SwatchPicker value={color} onChange={setColor} />
      </Field>
      {existing && !existing.isSelf ? (
        <PrimaryButton title={`Remove ${existing.name}`} icon={icons.trash} variant="destructive" onPress={remove} />
      ) : null}
    </FormSheet>
  );
}
