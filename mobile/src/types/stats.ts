export interface StatsSummary {
  active_count: number;
  avg_score: number;
  done_count: number;
  win_rate_pct: number;
  net_r: number;
}

export interface ScanStatus {
  last_started_at: string | null;
}

export interface EquityPoint {
  closed_at: string;
  cumulative_r: number;
}

export interface ScoreBucket {
  score: number;
  n: number;
  win_pct: number;
}

export interface TimeframeRow {
  timeframe: string;
  n: number;
  win_pct: number;
  net_r: number;
}

export interface ClosedLogEntry {
  id: number;
  symbol: string;
  timeframe: string;
  closed_at: string;
  closed_price: number;
  r: number;
  outcome: 'TARGET' | 'STOPPED';
}

export interface Performance {
  win_count: number;
  loss_count: number;
  win_rate_pct: number;
  net_r: number;
  avg_win_r: number;
  avg_loss_r: number;
  profit_factor: number;
  best_streak: number;
  max_drawdown_r: number;
  equity_curve: EquityPoint[];
  win_rate_by_score: ScoreBucket[];
  by_timeframe: TimeframeRow[];
  closed_log: ClosedLogEntry[];
}
