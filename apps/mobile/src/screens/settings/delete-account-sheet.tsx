import { router } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';

import { AppText } from '@/components/app-text';
import { TextField } from '@/components/form-fields';
import { FormSheet } from '@/components/form-sheet';
import { ListGroup, ListRow } from '@/components/list-row';
import { PrimaryButton } from '@/components/primary-button';
import { showToast } from '@/components/toast';
import { ToggleRow } from '@/components/toggle-row';
import { icons } from '@/constants/icons';
import { deleteAccountEverywhere } from '@/data';
import { useSession } from '@/hooks/use-session';
import { haptics } from '@/native/haptics';

/**
 * Deletes the Dosely account on the server (circle, mirrored doses, devices). Two confirmations: an
 * explicit "I understand" switch plus the password, then a final system alert.
 */
export function DeleteAccountSheet() {
  const { data: session } = useSession();
  const [understood, setUnderstood] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ready = understood && password.length > 0;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const message = await deleteAccountEverywhere(password);
      if (message) {
        haptics.error();
        setError(message);
        return;
      }
      router.back();
      showToast({ message: 'Account deleted. Your medications are still on this phone.' });
    } catch (e) {
      haptics.error();
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => {
    if (!ready) return;
    haptics.warning();
    Alert.alert('Delete your account for good?', 'This cannot be undone.', [
      { text: 'Keep account', style: 'cancel' },
      { text: 'Delete account', style: 'destructive', onPress: () => void run() },
    ]);
  };

  if (!session) {
    return (
      <FormSheet title="Delete account">
        <AppText variant="body" tone="secondary">
          You are signed out, so there is no account to delete on this phone.
        </AppText>
      </FormSheet>
    );
  }

  return (
    <FormSheet title="Delete account">
      <AppText variant="body">
        {`This deletes ${session.user.email} from Dosely's servers: your circle, everything mirrored to it and your caregivers' access. Medications and history on this phone stay; delete them separately in Settings if you want.`}
      </AppText>
      <ListGroup>
        <ListRow title="Circle and invite code" subtitle="Deleted; caregivers lose access" icon={icons.circle} />
        <ListRow title="Synced doses" subtitle="Deleted from the server" icon={icons.trash} />
        <ListRow title="This phone" subtitle="Keeps your medications and reminders" icon={icons.phone} />
      </ListGroup>
      <ListGroup>
        <ToggleRow title="I understand this can't be undone" value={understood} onValueChange={setUnderstood} />
      </ListGroup>
      <TextField
        label="Password"
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          setError(null);
        }}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        error={error}
      />
      <PrimaryButton title="Delete account" icon={icons.trash} variant="destructive" size="lg" disabled={!ready} loading={busy} onPress={confirm} />
    </FormSheet>
  );
}
