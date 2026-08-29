from datetime import datetime
from typing import Optional

from sqlmodel import SQLModel, Field


class Signal(SQLModel, table=True):
    """One alert-worthy setup. Carries every field the old Telegram
    format_alert() rendered, so the mobile detail screen can reproduce it."""

    id: Optional[int] = Field(default=None, primary_key=True)
    symbol: str = Field(index=True)
    timeframe: str
    created_at: datetime = Field(default_factory=datetime.utcnow, index=True)

    # Status at the moment this signal was recorded
    phase: str                       # "near" | "in_zone" | "at_entry"
    at_entry: bool
    in_zone: bool
    distance_pct: float

    score: int
    rr: float
    rr_zone_low: float
    risk: float
    risk_zone_low: float

    price_at_scan: float
    entry: float
    entry_method: str
    zone_low: float
    zone_high: float
    leg_low: float
    leg_high: float
    sl: float
    tp1: float
    tp2: float
    tp3: float
    swing_low: float

    fib_ob_levels_json: str          # {ratio: price}
    fib_leg_levels_json: str
    flags_json: str                  # {"price at zone (+2)": true, ...}

    gainer_pct24h: float
    gainer_vol24h: float
    gainer_funding_rate: float
    gainer_move24h: float
    gainer_source: str

    notified: bool = False

    # Tracks the trade after the alert fires -- "active" until price closes
    # the position one way or another. Refreshed every scan by comparing the
    # current price against this row's own sl/tp3 (see app/position_tracker.py).
    status: str = Field(default="active", index=True)   # "active" | "hit_sl" | "hit_tp3"
    closed_at: Optional[datetime] = None
    closed_price: Optional[float] = None

    # Updated every scan pass (whether or not the trade closes) so the app
    # can show a real live-price marker on the position rail instead of a
    # decorative one -- see app/position_tracker.py.
    last_price: Optional[float] = None
    last_checked_at: Optional[datetime] = None


class SignalState(SQLModel, table=True):
    """Direct replacement for scanner_state.json -- dedup/phase tracking per
    symbol:timeframe so each escalation (near -> in_zone -> at_entry) alerts
    exactly once."""

    key: str = Field(primary_key=True)   # f"{symbol}:{timeframe}"
    zone_low: float
    zone_high: float
    phase: str
    alerted_entry: float
    last_alert_ts: datetime = Field(default_factory=datetime.utcnow)
    last_signal_id: Optional[int] = Field(default=None, foreign_key="signal.id")


class ScanRun(SQLModel, table=True):
    """Singleton row (id always 1) recording when the most recent scan pass
    started -- lets the app show a real "last scanned Xm ago" / countdown
    instead of a client-side timer with no anchor to reality."""

    id: Optional[int] = Field(default=1, primary_key=True)
    started_at: datetime = Field(default_factory=datetime.utcnow)


class DeviceToken(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    expo_push_token: str = Field(unique=True, index=True)
    platform: str                    # "ios" | "android"
    label: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    last_seen_at: datetime = Field(default_factory=datetime.utcnow)
