import json
from typing import Optional

from sqlmodel import Session

from app.models import Signal
from app.notifications import send_expo_push, send_web_push


def persist_and_notify(session: Session, gainer: dict, setup: dict,
                        at_entry: bool, in_zone: bool, distance_pct: float,
                        phase: str, existing_signal: Optional[Signal] = None,
                        should_notify: bool = True) -> tuple[Signal, bool]:
    """Records a signal and, when should_notify, pushes it to every registered
    device -- mobile via Expo, desktop/browser via Web Push (two independent
    delivery paths, since expo-notifications doesn't support the web platform
    at all).

    A trade gets exactly one Signal row for its whole lifecycle: pass
    existing_signal (the row from its initial alert) to update phase/at_entry/
    in_zone/distance_pct/price_at_scan in place instead of inserting a new
    row -- sl/tp/entry/etc. are left untouched since the OB zone itself
    hasn't changed. Omit it (None) only for a genuinely new zone.

    should_notify=False skips both push calls entirely (the silent "advanced
    to in_zone" case scan_loop.py uses to keep displayed data fresh without
    interrupting the user) -- returns (signal, True), where True just means
    "safe to record this update", not "a push was sent".

    Returns (signal, notified) -- notified gates whether the caller is
    allowed to advance SignalState's phase, so a failed send never mutes an
    entry. If either channel genuinely fails (not just "no devices
    registered"), notified is False and the next scan retries both -- a
    possible duplicate on the channel that already succeeded is preferred
    over silently dropping the one that didn't.
    """
    if existing_signal is not None:
        signal = existing_signal
        signal.phase = phase
        signal.at_entry = at_entry
        signal.in_zone = in_zone
        signal.distance_pct = distance_pct
        signal.price_at_scan = setup["price"]
        session.add(signal)
        session.commit()
        session.refresh(signal)
    else:
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
    action = "SIGNAL UPDATED" if existing_signal is not None else "SIGNAL RECORDED"
    print(f"  {signal.symbol} [{signal.timeframe}]: {action} (id {signal.id}, "
          f"score {signal.score}/10, R:R {signal.rr}, {where})")

    if not should_notify:
        return signal, True

    expo_ok = send_expo_push(session, signal)
    web_ok = send_web_push(session, signal)
    notified = expo_ok and web_ok
    signal.notified = notified
    session.add(signal)
    session.commit()
    session.refresh(signal)
    return signal, notified
