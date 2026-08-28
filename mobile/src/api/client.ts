import { SignalDetail, SignalListItem } from '../types/signal';

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

export function fetchSignals(minScore?: number): Promise<SignalListItem[]> {
  const query = minScore != null ? `?min_score=${minScore}` : '';
  return request<SignalListItem[]>(`/signals${query}`);
}

export function fetchSignalDetail(id: number): Promise<SignalDetail> {
  return request<SignalDetail>(`/signals/${id}`);
}

export function registerDevice(expoPushToken: string, platform: 'ios' | 'android'): Promise<unknown> {
  return request('/devices/register', {
    method: 'POST',
    body: JSON.stringify({ expo_push_token: expoPushToken, platform }),
  });
}
