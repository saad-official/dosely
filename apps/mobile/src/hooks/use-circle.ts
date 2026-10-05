import { useCallback, useEffect, useRef, useState } from 'react';

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
  /** No answer yet for this circle (first load). The 60 s poll never sets it. */
  loading: boolean;
  /** A `refresh()` call is in flight (drive `RefreshControl` with this). */
  refreshing: boolean;
  /** Last request failed (`data` keeps the previous answer, if any). */
  error: string | null;
  /** Refetches now; resolves when that request settles (never rejects: failures land in `error`). */
  refresh: () => Promise<void>;
};

type TodayResult = { circleId: string; data: CircleTodayView | null; error: string | null };

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Read-only caregiver "today" view of a circle (`GET /api/circles/:id/today`), refetched every 60 s. */
export function useCircleToday(circleId: string | null | undefined): CircleTodayState {
  const [result, setResult] = useState<TodayResult | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  // Bumped when the circle changes or the screen unmounts so late answers are dropped.
  const generation = useRef(0);

  const load = useCallback(async (id: string) => {
    const mine = generation.current;
    try {
      const view = await getCircleToday(id);
      if (mine === generation.current) setResult({ circleId: id, data: view, error: null });
    } catch (e) {
      if (mine !== generation.current) return;
      setResult((prev) => ({ circleId: id, data: prev?.circleId === id ? prev.data : null, error: errorText(e) }));
    }
  }, []);

  useEffect(() => {
    if (!circleId) return;
    const gen = generation;
    void load(circleId);
    const timer = setInterval(() => void load(circleId), 60_000);
    return () => {
      gen.current += 1;
      clearInterval(timer);
    };
  }, [circleId, load]);

  const refresh = useCallback(async () => {
    if (!circleId) return;
    setRefreshing(true);
    try {
      await load(circleId);
    } finally {
      setRefreshing(false);
    }
  }, [circleId, load]);

  const current = circleId && result?.circleId === circleId ? result : null;
  return {
    data: current?.data ?? null,
    loading: !!circleId && !current,
    refreshing,
    error: current?.error ?? null,
    refresh,
  };
}
