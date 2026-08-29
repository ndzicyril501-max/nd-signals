import { useCallback, useEffect, useState } from 'react';
import { fetchPerformance, fetchScanStatus, fetchSignalDetail, fetchSignals, fetchStatsSummary } from './client';
import { SignalDetail, SignalListItem } from '../types/signal';
import { Performance, ScanStatus, StatsSummary } from '../types/stats';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function useAsync<T>(fetcher: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetcher()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const refetch = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, refetch };
}

export function useSignals(opts?: { minScore?: number; active?: boolean }): AsyncState<SignalListItem[]> {
  return useAsync(() => fetchSignals(opts), [opts?.minScore, opts?.active]);
}

export function useSignalDetail(id: number): AsyncState<SignalDetail> {
  return useAsync(() => fetchSignalDetail(id), [id]);
}

export function useStatsSummary(): AsyncState<StatsSummary> {
  return useAsync(fetchStatsSummary, []);
}

export function useScanStatus(): AsyncState<ScanStatus> {
  return useAsync(fetchScanStatus, []);
}

export function usePerformance(): AsyncState<Performance> {
  return useAsync(fetchPerformance, []);
}
