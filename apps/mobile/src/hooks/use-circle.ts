import { useEffect, useState } from 'react';

import {
  circleStore,
  type CircleState,
  type CircleTodayView,
  getCircleToday,
  refreshCircles,
} from '@/data/circles-client';
import { useStore } from '@/data/store';

const refresh = () => refreshCircles().then(() => undefined);

/**
 * Cached caregiver circles (`{ circles, own, loading, error, updatedAt }`, persisted so it works
 * offline) plus a refresh from `GET /api/circles` on mount. `own` is the circle the user shares with.
 */
export function useCircle(opts: { refreshOnMount?: boolean } = {}): CircleState & { refresh: () => Promise<void> } {
  const state = useStore(circleStore);
  const refreshOnMount = opts.refreshOnMount ?? true;
  useEffect(() => {
    if (refreshOnMount) refresh().catch(() => undefined);
  }, [refreshOnMount]);
  return { ...state, refresh };
}

export type CircleTodayState = {
  data: CircleTodayView | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

/** Read-only caregiver "today" view of a circle (`GET /api/circles/:id/today`), refetched every 60 s. */
export function useCircleToday(circleId: string | null | undefined): CircleTodayState {
  const [data, setData] = useState<CircleTodayView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!circleId) return;
    let cancelled = false;
    const load = () => {
      setLoading(true);
      getCircleToday(circleId)
        .then((view) => {
          if (cancelled) return;
          setData(view);
          setError(null);
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(e instanceof Error ? e.message : String(e));
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    };
    load();
    const timer = setInterval(load, 60_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [circleId, nonce]);
  return {
    data: circleId && data?.circleId === circleId ? data : null,
    loading,
    error,
    refresh: () => setNonce((n) => n + 1),
  };
}
