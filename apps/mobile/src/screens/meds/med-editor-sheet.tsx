import { MED_FORMS, MED_ICONS, type MedColor, type MedForm, type MedIcon as MedIconName } from '@dosely/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { ChoiceChips, Field, TextField } from '@/components/form-fields';
import { FormSheet } from '@/components/form-sheet';
import { Icon } from '@/components/icon';
import { ListGroup } from '@/components/list-row';
import { MedIcon } from '@/components/med-icon';
import { draftFromSchedule, ScheduleBuilder, scheduleFromDraft, scheduleProblem, type ScheduleDraft } from '@/components/schedule-builder';
import { SwatchPicker } from '@/components/swatch-picker';
import { showToast } from '@/components/toast';
import { ToggleRow } from '@/components/toggle-row';
import { formatMinutes } from '@/constants/format';
import { medIcons } from '@/constants/icons';
import { addMedication, updateMedication, type MedicationInput } from '@/data';
import { useMedication } from '@/hooks/use-medications';
import { useProfiles } from '@/hooks/use-profiles';
import { haptics } from '@/native/haptics';
import { CHROME_FONT_CAP, radius, spacing, touchTarget, useTheme } from '@/theme';

const STEPS = ['Medicine', 'Schedule', 'Supply & notes'] as const;

const FORM_LABELS: Record<MedForm, string> = {
  tablet: 'Tablet',
  capsule: 'Capsule',
  liquid: 'Liquid',
  injection: 'Injection',
  inhaler: 'Inhaler',
  drops: 'Drops',
  patch: 'Patch',
  other: 'Other',
};

const DEFAULT_ICON: Record<MedForm, MedIconName> = {
  tablet: 'tablet',
  capsule: 'capsule',
  liquid: 'bottle',
  injection: 'syringe',
  inhaler: 'inhaler',
  drops: 'drops',
  patch: 'patch',
  other: 'pill',
};

const WINDOWS = [15, 30, 60, 90, 120, 180] as const;

function parseCount(text: string): number | null {
  const n = Number(text.replace(',', '.'));
  return text.trim() === '' || !Number.isFinite(n) || n < 0 ? null : n;
}

function StepIndicator({ step, onJump }: { step: number; onJump?: (i: number) => void }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: spacing.xs, paddingHorizontal: spacing.md, paddingBottom: spacing.sm }} accessibilityRole="tablist">
      {STEPS.map((label, i) => {
        const active = i === step;
        const done = i < step;
        return (
          <Pressable
            key={label}
            accessibilityRole="tab"
            accessibilityState={{ selected: active, disabled: !onJump }}
            accessibilityLabel={`Step ${i + 1} of ${STEPS.length}: ${label}`}
            disabled={!onJump}
            onPress={() => onJump?.(i)}
            style={({ pressed }) => ({ flex: 1, gap: spacing.xs, minHeight: touchTarget, justifyContent: 'center', opacity: pressed ? 0.6 : 1 })}
          >
            <View style={{ height: 4, borderRadius: 2, backgroundColor: active || done ? colors.accent : colors.track }} />
            <AppText variant="caption" tone={active ? 'accent' : 'secondary'} weight={active ? '700' : '500'} numberOfLines={1} maxFontSizeMultiplier={CHROME_FONT_CAP}>
              {label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function IconGrid({ value, color, onChange }: { value: MedIconName; color: MedColor; onChange: (icon: MedIconName) => void }) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Icon" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
      {MED_ICONS.map((icon) => {
        const selected = icon === value;
        return (
          <Pressable
            key={icon}
            accessibilityRole="radio"
            accessibilityLabel={icon}
            accessibilityState={{ selected }}
            onPress={() => {
              haptics.selection();
              onChange(icon);
            }}
            style={({ pressed }) => ({ padding: 3, borderRadius: radius.pill, borderWidth: 2.5, borderColor: selected ? colors.text : 'transparent', opacity: pressed ? 0.7 : 1 })}
          >
            {selected ? <MedIcon icon={icon} color={color} size={touchTarget} /> : (
              <View style={{ width: touchTarget, height: touchTarget, borderRadius: radius.pill, backgroundColor: colors.track, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={medIcons[icon]} size={20} color={colors.textSecondary} />
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Add / edit a medication in three short steps (the medicine, its schedule, supply and notes).
 * Adding walks forward with Next; editing can jump to any step and save from anywhere. Nothing is
 * written until Save succeeds, and a failed save keeps everything the user typed.
 */
export function MedEditorSheet() {
  const params = useLocalSearchParams<{ id?: string; profileId?: string }>();
  const existing = useMedication(params.id);
  const editing = !!existing;
  const profiles = useProfiles();
  const scrollRef = useRef<ScrollView>(null);

  const [step, setStep] = useState(0);
  const [name, setName] = useState(existing?.name ?? '');
  const [strength, setStrength] = useState(existing?.strength ?? '');
  const [form, setForm] = useState<MedForm>(existing?.form ?? 'tablet');
  const [icon, setIcon] = useState<MedIconName>(existing?.icon ?? 'tablet');
  const [iconTouched, setIconTouched] = useState(editing);
  const [color, setColor] = useState<MedColor>(existing?.color ?? 'teal');
  const [profileId, setProfileId] = useState<string | null>(existing?.profileId ?? params.profileId ?? null);
  const [draft, setDraft] = useState<ScheduleDraft>(() => draftFromSchedule(existing?.schedule));
  const [windowMinutes, setWindowMinutes] = useState(existing?.windowMinutes ?? 60);
  const [trackSupply, setTrackSupply] = useState(existing?.inventoryCount !== null && existing?.inventoryCount !== undefined);
  const [count, setCount] = useState(existing?.inventoryCount != null ? String(existing.inventoryCount) : '');
  const [threshold, setThreshold] = useState(existing?.refillThreshold != null ? String(existing.refillThreshold) : '7');
  const [instructions, setInstructions] = useState(existing?.instructions ?? '');
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const owner = profiles.find((p) => p.id === profileId) ?? profiles.find((p) => p.isSelf) ?? profiles[0] ?? null;
  const problem = scheduleProblem(draft);
  const last = step === STEPS.length - 1;

  const goTo = (next: number) => {
    setStep(next);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const validateStep = (s: number): boolean => {
    if (s === 0 && !name.trim()) {
      setNameError('Give the medication a name.');
      haptics.warning();
      return false;
    }
    if (s === 1 && problem) {
      haptics.warning();
      return false;
    }
    return true;
  };

  const save = async () => {
    if (!validateStep(0)) return goTo(0);
    if (!validateStep(1)) return goTo(1);
    if (!owner) {
      setError('Create a profile first (Settings › Profiles).');
      return;
    }
    const input: MedicationInput = {
      profileId: owner.id,
      name: name.trim(),
      strength: strength.trim() || null,
      form,
      icon,
      color,
      schedule: scheduleFromDraft(draft),
      windowMinutes,
      inventoryCount: trackSupply ? parseCount(count) ?? 0 : null,
      refillThreshold: trackSupply ? parseCount(threshold) : null,
      instructions: instructions.trim() || null,
    };
    setBusy(true);
    setError(null);
    try {
      if (existing) await updateMedication(existing.id, input);
      else await addMedication(input);
      haptics.taken();
      router.back();
      showToast({ message: existing ? `${input.name} updated` : `${input.name} added` });
    } catch (e) {
      haptics.error();
      setError(e instanceof Error && !e.message.startsWith('[') ? e.message : 'Some details are not valid. Check each step and try again.');
    } finally {
      setBusy(false);
    }
  };

  const primary = () => {
    if (editing || last) return void save();
    if (validateStep(step)) goTo(step + 1);
  };

  return (
    <FormSheet
      title={editing ? 'Edit medication' : 'Add medication'}
      leadingLabel={!editing && step > 0 ? 'Back' : 'Cancel'}
      onLeading={!editing && step > 0 ? () => goTo(step - 1) : undefined}
      primaryLabel={editing || last ? 'Save' : 'Next'}
      onPrimary={primary}
      busy={busy}
      scrollRef={scrollRef}
      subheader={<StepIndicator step={step} onJump={editing ? goTo : undefined} />}
    >
      {error ? (
        <AppText variant="callout" tone="danger" selectable accessibilityLiveRegion="polite">
          {error}
        </AppText>
      ) : null}

      {step === 0 ? (
        <>
          <TextField
            label="Name"
            placeholder="e.g. Metformin"
            value={name}
            onChangeText={(t) => {
              setName(t);
              if (nameError) setNameError(null);
            }}
            error={nameError}
            autoFocus={!editing}
            autoCapitalize="words"
            returnKeyType="next"
            maxLength={120}
          />
          <TextField label="Strength (optional)" placeholder="e.g. 500 mg" value={strength} onChangeText={setStrength} maxLength={60} />
          <Field label="Form">
            <ChoiceChips
              accessibilityLabel="Form"
              options={MED_FORMS.map((f) => ({ value: f, label: FORM_LABELS[f] }))}
              isSelected={(f) => f === form}
              onToggle={(f) => {
                setForm(f);
                if (!iconTouched) setIcon(DEFAULT_ICON[f]);
              }}
            />
          </Field>
          {profiles.length > 1 ? (
            <Field label="For">
              <ChoiceChips
                accessibilityLabel="Who takes it"
                options={profiles.map((p) => ({ value: p.id, label: p.isSelf ? `${p.name} (you)` : p.name }))}
                isSelected={(id) => id === owner?.id}
                onToggle={setProfileId}
              />
            </Field>
          ) : null}
          <Field label="Colour">
            <SwatchPicker value={color} onChange={setColor} />
          </Field>
          <Field label="Icon">
            <IconGrid
              value={icon}
              color={color}
              onChange={(i) => {
                setIcon(i);
                setIconTouched(true);
              }}
            />
          </Field>
        </>
      ) : null}

      {step === 1 ? (
        <>
          <ScheduleBuilder draft={draft} onChange={setDraft} />
          {problem ? (
            <AppText variant="callout" tone="danger" accessibilityLiveRegion="polite">
              {problem}
            </AppText>
          ) : null}
          {draft.kind !== 'as-needed' ? (
            <Field label="Dose window" hint="How long a dose stays “due” before it counts as late. Your circle hears about it only after the window plus your caregiver delay.">
              <ChoiceChips
                accessibilityLabel="Dose window"
                options={WINDOWS.map((m) => ({ value: m, label: formatMinutes(m) }))}
                isSelected={(m) => m === windowMinutes}
                onToggle={setWindowMinutes}
              />
            </Field>
          ) : null}
        </>
      ) : null}

      {step === 2 ? (
        <>
          <ListGroup footer="Each dose you mark taken counts down your supply.">
            <ToggleRow title="Track supply" subtitle="Get a nudge before you run out" value={trackSupply} onValueChange={setTrackSupply} />
          </ListGroup>
          {trackSupply ? (
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <TextField label="On hand" placeholder="30" keyboardType="decimal-pad" value={count} onChangeText={setCount} maxLength={6} />
              </View>
              <View style={{ flex: 1 }}>
                <TextField label="Remind me at" placeholder="7" keyboardType="decimal-pad" value={threshold} onChangeText={setThreshold} maxLength={6} />
              </View>
            </View>
          ) : null}
          <TextField
            label="Instructions (optional)"
            placeholder="e.g. Take with food"
            value={instructions}
            onChangeText={setInstructions}
            multiline
            maxLength={500}
          />
        </>
      ) : null}
    </FormSheet>
  );
}
