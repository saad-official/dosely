import { useStore } from '@/data/store';
import { type SyncStatus, syncStatus } from '@/data/sync-client';

/** Circle sync status `{ running, lastSyncAt, error }`. Trigger a sync with `syncNow()` from `@/data/sync-client`. */
export function useSyncStatus(): SyncStatus {
  return useStore(syncStatus);
}
