import requests
from sqlmodel import Session, select

from app.config import EXPO_PUSH_URL
from app.models import DeviceToken, Signal


def _title_for(signal: Signal) -> str:
    return f"\U0001F53B {signal.symbol} [{signal.timeframe}] — Score {signal.score}/10"


def _body_for(signal: Signal) -> str:
    status = ("Price at fib entry" if signal.at_entry else
              "Price in entry zone" if signal.in_zone else
              f"{signal.distance_pct:.1f}% below zone")
    return f"{status} • R:R {signal.rr}:1 • Zone {signal.zone_low:g}-{signal.zone_high:g}"


def send_expo_push(session: Session, signal: Signal) -> bool:
    """POSTs to Expo's push API for every registered device. Expo relays to
    APNs/FCM itself, so this backend never touches Firebase/Apple credentials
    directly. Returns True if Expo accepted the message for at least one
    device (or if there are no devices registered yet -- that's not a send
    failure, just nobody to notify). Returns False only on an actual
    request/transport failure, which the caller uses to avoid muting the
    signal in SignalState."""
    tokens = session.exec(select(DeviceToken)).all()
    if not tokens:
        print(f"  (no registered devices -- signal {signal.id} recorded but not pushed)")
        return True

    messages = [{
        "to": t.expo_push_token,
        "title": _title_for(signal),
        "body": _body_for(signal),
        "data": {"signal_id": signal.id},
        "sound": "default",
    } for t in tokens]

    try:
        r = requests.post(EXPO_PUSH_URL, json=messages, timeout=10,
                           headers={"Accept": "application/json", "Content-Type": "application/json"})
        r.raise_for_status()
        body = r.json()
        tickets = body.get("data", [])
        errors = [t for t in tickets if t.get("status") != "ok"]
        if errors:
            print(f"  [WARN] Expo rejected {len(errors)}/{len(tickets)} push tickets: {errors}")
        return True
    except requests.RequestException as e:
        print(f"  [ERROR] Expo push send failed: {e}")
        return False
