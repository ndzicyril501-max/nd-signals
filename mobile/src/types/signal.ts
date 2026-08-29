export type SignalStatus = 'active' | 'hit_sl' | 'hit_tp3';

export interface SignalListItem {
  id: number;
  symbol: string;
  timeframe: string;
  score: number;
  rr: number;
  phase: 'near' | 'in_zone' | 'at_entry';
  created_at: string;
  status: SignalStatus;
  closed_price: number | null;
}

export interface SignalDetail {
  id: number;
  symbol: string;
  timeframe: string;
  created_at: string;

  phase: 'near' | 'in_zone' | 'at_entry';
  at_entry: boolean;
  in_zone: boolean;
  distance_pct: number;

  score: number;
  rr: number;
  rr_zone_low: number;
  risk: number;
  risk_zone_low: number;

  price_at_scan: number;
  entry: number;
  entry_method: string;
  zone_low: number;
  zone_high: number;
  leg_low: number;
  leg_high: number;
  sl: number;
  tp1: number;
  tp2: number;
  tp3: number;
  swing_low: number;

  fib_ob_levels: Record<string, number>;
  fib_leg_levels: Record<string, number>;
  flags: Record<string, boolean>;

  gainer_pct24h: number;
  gainer_vol24h: number;
  gainer_funding_rate: number;
  gainer_move24h: number;
  gainer_source: string;

  notified: boolean;
  status: SignalStatus;
  closed_at: string | null;
  closed_price: number | null;
}
