import { InviteCodeSchema } from '@dosely/shared';
import { router } from 'expo-router';
import { useState } from 'react';

import { AppText } from '@/components/app-text';
import { TextField } from '@/components/form-fields';
import { FormSheet } from '@/components/form-sheet';
import { PrimaryButton } from '@/components/primary-button';
import { showToast } from '@/components/toast';
import { joinCircle } from '@/data';
import { useSession } from '@/hooks/use-session';
import { haptics } from '@/native/haptics';
import { textStyles } from '@/theme';

import { circleErrorMessage } from './circle-errors';

/** Caregiver joins someone's circle with the invite code they were sent. */
export function JoinCircleSheet() {
  const { data: session } = useSession();
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const valid = InviteCodeSchema.safeParse(code).success;

  const join = async () => {
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      const circle = await joinCircle(code, session?.user.name);
      haptics.taken();
      router.back();
      showToast({ message: "You're in. You'll be told if a dose is missed." });
      router.push({ pathname: '/circle/[id]', params: { id: circle.id } });
    } catch (e) {
      haptics.error();
      setError(circleErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (!session) {
    return (
      <FormSheet title="Join a circle">
        <AppText variant="body" tone="secondary">
          Sign in first, then come back to enter the code.
        </AppText>
        <PrimaryButton title="Sign in" onPress={() => router.replace({ pathname: '/auth', params: { mode: 'sign-in' } })} />
      </FormSheet>
    );
  }

  return (
    <FormSheet title="Join a circle" primaryLabel="Join" primaryDisabled={!valid} busy={busy} onPrimary={() => void join()}>
      <AppText variant="body" tone="secondary">
        Enter the code the circle owner shared with you. You will see their doses for today and get an alert if one is missed.
      </AppText>
      <TextField
        label="Invite code"
        placeholder="ABC234"
        value={code}
        onChangeText={(t) => {
          setError(null);
          setCode(t.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8));
        }}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        autoFocus
        maxLength={8}
        returnKeyType="join"
        onSubmitEditing={() => void join()}
        error={error ?? (code.length >= 6 && !valid ? 'Codes use letters and numbers without 0, O, 1, I or L.' : null)}
        style={[textStyles.title, { letterSpacing: 4, textAlign: 'center' }]}
      />
      <PrimaryButton title="Join circle" size="lg" disabled={!valid} loading={busy} onPress={() => void join()} />
    </FormSheet>
  );
}
