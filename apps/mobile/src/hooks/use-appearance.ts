// UI-only: the System / Light / Dark override from Settings. Shared `Settings` has no colour-scheme
// field, so the choice is kept as a device-local `app.appearance` value (same table, `app.` prefix)
// and applied with React Native's `Appearance.setColorScheme`, which `useColorScheme()` honours.
import { useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';

import { createStore } from '@/data';
import { getAppValue, setAppValue } from '@/data/settings-repo';

export type AppearancePreference = 'system' | 'light' | 'dark';

const KEY = 'appearance';
const store = createStore<AppearancePreference>('system');

function apply(pref: AppearancePreference) {
  Appearance.setColorScheme(pref === 'system' ? 'unspecified' : pref);
}

/** Reads the saved preference and applies it. Call once after the database is ready. */
export function restoreAppearance(): void {
  const saved = getAppValue<AppearancePreference>(KEY, 'system');
  const pref: AppearancePreference = saved === 'light' || saved === 'dark' ? saved : 'system';
  store.setState(pref);
  if (pref !== 'system') apply(pref);
}

export function setAppearance(pref: AppearancePreference): void {
  store.setState(pref);
  setAppValue(KEY, pref === 'system' ? undefined : pref);
  apply(pref);
}

export function useAppearance(): AppearancePreference {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
