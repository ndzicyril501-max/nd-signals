import json

import requests
from py_vapid import Vapid
from pywebpush import WebPushException, webpush
from sqlmodel import Session, select

from app.config import EXPO_PUSH_URL, VAPID_CLAIM_EMAIL, VAPID_PRIVATE_KEY_PEM
from app.models import DeviceToken, Signal, WebPushSubscription

# pywebpush's webpush() only parses a raw string as base64url(DER) -- it
# does NOT accept PEM text directly (that needs Vapid.from_pem specifically).
# Build the Vapid instance once from the PEM env var and hand pywebpush the
# already-parsed instance instead of the raw string.
_vapid: Vapid | None = None
if VAPID_PRIVATE_KEY_PEM:
    _vapid = Vapid.from_pem(VAPID_PRIVATE_KEY_PEM.encode())


def _title_for(signal: Signal) -> str:
    phase_label = "AT ENTRY" if signal.at_entry else "IN ZONE" if signal.in_zone else "NEAR ZONE"
    return f"ND Signals — {phase_label}"


def _body_for(signal: Signal) -> str:
    status = ("price is at the fib entry" if signal.at_entry else
              "price is inside the entry zone" if signal.in_zone else
              f"{signal.distance_pct:.1f}% below the zone, waiting for the retrace")
    return (f"{signal.symbol} {signal.timeframe} · score {signal.score}/10 · {status}. "
            f"R:R {signal.rr}, SL {signal.sl:g}.")


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


def send_web_push(session: Session, signal: Signal) -> bool:
    """Delivers to every registered browser (desktop PWA) via Web Push --
    entirely separate from send_expo_push above, since expo-notifications
    does not support the web platform at all. No VAPID keys configured yet
    is treated the same as "no devices registered" (not a failure) so a
    fresh deploy before the one-time VAPID setup step doesn't mute mobile
    alerts. Returns False only on an actual send failure, same contract as
    send_expo_push."""
    if _vapid is None:
        return True

    subs = session.exec(select(WebPushSubscription)).all()
    if not subs:
        return True

    payload = json.dumps({
        "title": _title_for(signal),
        "body": _body_for(signal),
        "signal_id": signal.id,
    })

    any_failure = False
    for sub in subs:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                },
                data=payload,
                vapid_private_key=_vapid,
                vapid_claims={"sub": VAPID_CLAIM_EMAIL},
                ttl=3600,
            )
        except WebPushException as e:
            status = e.response.status_code if e.response is not None else None
            if status in (404, 410):
                # Browser unsubscribed or the subscription expired -- prune it,
                # this is expected lifecycle, not a delivery failure.
                session.delete(sub)
                session.commit()
            else:
                print(f"  [ERROR] Web push send failed ({status}): {e}")
                any_failure = True

    return not any_failure
