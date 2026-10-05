// Public surface of the data layer. Screens import intents and reads from '@/data' and reactive
// reads from '@/hooks/use-*'; they never import expo-sqlite, drizzle or the native libraries.
export * from './actions';
export { afterSignIn, deleteAccountEverywhere, signInAndSync, signOutAndForget, signUpAndSync } from './account';
export { ApiError } from './api';
export { adherenceFor, lastDays, type AdherenceRange, type AdherenceReport, type MedAdherence } from './adherence';
export { API_URL, authClient, isSignedIn, signIn, signOut, signUp, type AuthSession } from './auth-client';
export * from './circles-client';
export { registerPushDevice, unregisterPushDevice, type DeviceRegistration } from './devices';
export { getDose, listDosesBetween } from './doses-repo';
export { DEFAULT_EXPANSION_DAYS, ensureDosesExpanded } from './expand';
export { getMedication, listMedications, type MedicationInput, type MedicationPatch } from './medications-repo';
export { ensureDatabaseReady, useDatabaseMigrations, type DatabaseReadyState } from './migrate';
export { ensureSelfProfile, getProfile, getSelfProfile, listProfiles, type ProfileInput, type ProfilePatch } from './profiles-repo';
export { seedDemoData } from './seed';
export { getSettings } from './settings-repo';
export { createStore, onTablesChanged, useStore, type Store, type TableName } from './store';
export { pullSince, pushDirty, scheduleSync, syncNow, syncStatus, type SyncStatus } from './sync-client';
export { getDeviceId, getSyncState, resetSyncCursors, type SyncedTable, type SyncState } from './sync-state-repo';
export { dayBounds, deviceTimeZone, formatClock, nowIso, todayKey, useClockTick, useToday } from './time';
export {
  activeDoseWindow,
  doseView,
  dosesForDay,
  medicationView,
  medicationViews,
  type ActiveDoseWindow,
  type DoseView,
  type MedicationView,
} from './views';
