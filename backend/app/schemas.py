import json
from datetime import datetime
from typing import Dict, Optional

from pydantic import BaseModel

from app.models import Signal


class SignalListItem(BaseModel):
    id: int
    symbol: str
    timeframe: str
    score: int
    rr: float
    phase: str
    created_at: datetime
    status: str
    closed_price: Optional[float] = None


class SignalDetail(BaseModel):
    id: int
    symbol: str
    timeframe: str
    created_at: datetime

    phase: str
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

    fib_ob_levels: Dict[str, float]
    fib_leg_levels: Dict[str, float]
    flags: Dict[str, bool]

    gainer_pct24h: float
    gainer_vol24h: float
    gainer_funding_rate: float
    gainer_move24h: float
    gainer_source: str

    notified: bool
    status: str
    closed_at: Optional[datetime] = None
    closed_price: Optional[float] = None

    @classmethod
    def from_signal(cls, s: Signal) -> "SignalDetail":
        data = s.model_dump()
        data["fib_ob_levels"] = json.loads(s.fib_ob_levels_json)
        data["fib_leg_levels"] = json.loads(s.fib_leg_levels_json)
        data["flags"] = json.loads(s.flags_json)
        return cls(**data)
