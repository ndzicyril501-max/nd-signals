import { SignalDetail, SignalListItem } from '../types/signal';
import { Performance, ScanStatus, StatsSummary } from '../types/stats';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8080';
const API_KEY = process.env.EXPO_PUBLIC_API_KEY ?? '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export function fetchSignals(opts?: { minScore?: number; active?: boolean }): Promise<SignalListItem[]> {
  const params = new URLSearchParams();
  if (opts?.minScore != null) params.set('min_score', String(opts.minScore));
  if (opts?.active != null) params.set('active', String(opts.active));
  const query = params.toString();
  return request<SignalListItem[]>(`/signals${query ? `?${query}` : ''}`);
}

export function fetchSignalDetail(id: number): Promise<SignalDetail> {
  return request<SignalDetail>(`/signals/${id}`);
}

export function fetchStatsSummary(): Promise<StatsSummary> {
  return request<StatsSummary>('/stats/summary');
}

export function fetchScanStatus(): Promise<ScanStatus> {
  return request<ScanStatus>('/scan-status');
}

export function fetchPerformance(): Promise<Performance> {
  return request<Performance>('/stats/performance');
}

export function registerDevice(expoPushToken: string, platform: 'ios' | 'android'): Promise<unknown> {
  return request('/devices/register', {
    method: 'POST',
    body: JSON.stringify({ expo_push_token: expoPushToken, platform }),
  });
}

export function registerWebPush(subscription: PushSubscriptionJSON): Promise<unknown> {
  return request('/devices/register-web-push', {
    method: 'POST',
    body: JSON.stringify(subscription),
  });
}
