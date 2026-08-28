import json

from sqlmodel import Session

from app.models import Signal
from app.notifications import send_expo_push


def persist_and_notify(session: Session, gainer: dict, setup: dict,
                        at_entry: bool, in_zone: bool, distance_pct: float,
                        phase: str) -> tuple[Signal, bool]:
    """Replaces the old format_alert()+send_telegram() tail: records the
    signal in the DB and pushes it to every registered device via Expo.
    Returns (signal, notified) -- notified gates whether the caller is
    allowed to update SignalState, so a failed send never mutes an entry.
    """
    signal = Signal(
        symbol=setup["symbol"],
        timeframe=setup["timeframe"],
        phase=phase,
        at_entry=at_entry,
        in_zone=in_zone,
        distance_pct=distance_pct,
        score=setup["score"],
        rr=setup["rr"],
        rr_zone_low=setup["rr_zone_low"],
        risk=setup["risk"],
        risk_zone_low=setup["risk_zone_low"],
        price_at_scan=setup["price"],
        entry=setup["entry"],
        entry_method=setup["entry_method"],
        zone_low=setup["zone_low"],
        zone_high=setup["zone_high"],
        leg_low=setup["leg_low"],
        leg_high=setup["leg_high"],
        sl=setup["sl"],
        tp1=setup["tp1"],
        tp2=setup["tp2"],
        tp3=setup["tp3"],
        swing_low=setup["swing_low"],
        fib_ob_levels_json=json.dumps(setup["fib"]["ob_levels"]),
        fib_leg_levels_json=json.dumps(setup["fib"]["leg_levels"]),
        flags_json=json.dumps(setup["flags"]),
        gainer_pct24h=gainer["pct24h"],
        gainer_vol24h=gainer["vol24h"],
        gainer_funding_rate=gainer["fundingRate"],
        gainer_move24h=gainer["move24h"],
        gainer_source=gainer["source"],
        notified=False,
    )
    session.add(signal)
    session.commit()
    session.refresh(signal)

    where = "AT FIB ENTRY" if at_entry else "IN ZONE" if in_zone else f"{distance_pct:.1f}% below zone"
    print(f"  {signal.symbol} [{signal.timeframe}]: SIGNAL RECORDED (id {signal.id}, "
          f"score {signal.score}/10, R:R {signal.rr}, {where})")

    notified = send_expo_push(session, signal)
    signal.notified = notified
    session.add(signal)
    session.commit()
    session.refresh(signal)
    return signal, notified
