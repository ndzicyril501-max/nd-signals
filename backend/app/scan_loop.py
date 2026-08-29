import time
from datetime import datetime, timezone

from sqlmodel import Session

from app.alerts import persist_and_notify
from app.config import (
    AT_ENTRY_TOL_PCT, MIN_ALERT_SCORE, NEAR_ENTRY_PCT, SCAN_INTERVAL_SEC,
    SCAN_REQUEST_DELAY_SEC, TIMEFRAMES,
)
from app.db import engine
from app.models import ScanRun, SignalState
from app.position_tracker import refresh_open_signals
from app.scanner.bybit import get_all_candidates
from app.scanner.smc import analyze_symbol


def run_once():
    with Session(engine) as session:
        run = session.get(ScanRun, 1) or ScanRun(id=1)
        run.started_at = datetime.utcnow()
        session.add(run)
        session.commit()

        closed = refresh_open_signals(session)
        if closed:
            print(f"Closed out {closed} signal(s) that hit SL/TP3 since the last scan.")

    candidates = get_all_candidates()
    n_gainers = sum(1 for c in candidates if c["source"] == "top_gainer")
    n_impulsive = len(candidates) - n_gainers
    tf_labels = ", ".join(label for _, label in TIMEFRAMES)
    print(f"[{datetime.now(timezone.utc).isoformat()}] Scanning {len(candidates)} pairs "
          f"({n_gainers} top gainers + {n_impulsive} impulsive movers) across [{tf_labels}], "
          f"min score {MIN_ALERT_SCORE}/10...")

    # Funnel diagnostics -- shows exactly where setups get filtered out each scan,
    # so we can tell "genuinely rare" apart from "a filter is too strict"
    funnel = {
        "no_data": 0,           # not enough kline history yet
        "no_active_ob": 0,      # no confirmed bearish structure break / unmitigated OB
        "already_mitigated": 0, # price already pushed back through the OB
        "low_score": 0,         # valid setup, but below MIN_ALERT_SCORE
        "too_far": 0,           # valid + high score, but price not near entry yet
        "duplicate": 0,         # already alerted this exact zone, not re-tapping
        "alerted": 0,
        "errors": 0,
    }

    checks_done = 0
    total_checks = len(candidates) * len(TIMEFRAMES)

    with Session(engine) as session:
        for g in candidates:
            symbol = g["symbol"]
            for interval, tf_label in TIMEFRAMES:
                checks_done += 1
                try:
                    setup = analyze_symbol(symbol, interval=interval, tf_label=tf_label)
                except Exception as e:
                    print(f"  {symbol} [{tf_label}]: error -- {e}")
                    funnel["errors"] += 1
                    time.sleep(SCAN_REQUEST_DELAY_SEC)
                    continue

                if setup is None:
                    funnel["no_data"] += 1
                    time.sleep(SCAN_REQUEST_DELAY_SEC)
                    continue
                if not setup.get("valid"):
                    if "pushed back" in setup.get("reason", ""):
                        funnel["already_mitigated"] += 1
                    else:
                        funnel["no_active_ob"] += 1
                    time.sleep(SCAN_REQUEST_DELAY_SEC)
                    continue
                if setup["score"] < MIN_ALERT_SCORE:
                    funnel["low_score"] += 1
                    time.sleep(SCAN_REQUEST_DELAY_SEC)
                    continue  # below the quality threshold, skip alerting

                # State is tracked per symbol+timeframe, so a Daily and 4H setup on
                # the same coin are alerted and deduplicated independently
                key = f"{symbol}:{tf_label}"
                already = session.get(SignalState, key)

                # The ZONE is the trigger; the fib price is the order level inside
                # it. Both are tracked: a tap of the zone edge is actionable even
                # though price has not reached the fib entry yet.
                entry = setup["entry"]
                zlo, zhi = setup["zone_low"], setup["zone_high"]

                in_zone = zlo <= setup["price"] <= zhi
                if in_zone:
                    distance_pct = 0.0
                elif setup["price"] < zlo:
                    distance_pct = (zlo - setup["price"]) / setup["price"] * 100
                else:
                    distance_pct = (setup["price"] - zhi) / zhi * 100

                # Reached the exact fib level (a strict subset of being in the zone).
                at_entry = abs(entry - setup["price"]) / setup["price"] <= AT_ENTRY_TOL_PCT / 100

                if not (in_zone or distance_pct <= NEAR_ENTRY_PCT):
                    funnel["too_far"] += 1
                    time.sleep(SCAN_REQUEST_DELAY_SEC)
                    continue  # valid setup, but still too far from entry to be actionable right now

                # Re-alert on a genuinely new zone, or when price newly ARRIVES in
                # the zone we already published. Tracking the phase (approaching ->
                # in_zone -> at_entry) means each escalation gets one alert and no
                # more, instead of one alert per scan for fifteen minutes.
                phase = "at_entry" if at_entry else ("in_zone" if in_zone else "near")
                same_zone = already and already.zone_low == zlo and already.zone_high == zhi
                if same_zone and already.phase == phase:
                    funnel["duplicate"] += 1
                    time.sleep(SCAN_REQUEST_DELAY_SEC)
                    continue  # already told you about this zone at this phase

                if in_zone or at_entry or not already:
                    signal, notified = persist_and_notify(session, g, setup, at_entry, in_zone,
                                                            distance_pct, phase)
                    if notified:
                        funnel["alerted"] += 1
                        state_row = already or SignalState(key=key, zone_low=zlo, zone_high=zhi,
                                                            phase=phase, alerted_entry=entry)
                        state_row.zone_low = zlo
                        state_row.zone_high = zhi
                        state_row.phase = phase
                        state_row.alerted_entry = entry
                        state_row.last_alert_ts = datetime.utcnow()
                        state_row.last_signal_id = signal.id
                        session.add(state_row)
                        session.commit()
                        where = ("AT FIB ENTRY" if at_entry else
                                 "IN ZONE" if in_zone else f"{distance_pct:.1f}% below zone")
                        print(f"  {symbol} [{tf_label}]: ALERT SENT (score {setup['score']}/10, "
                              f"R:R {setup['rr']}, zone {zlo}-{zhi}, entry {entry}, {where})")
                    else:
                        # Do NOT record it as alerted -- a failed send must not
                        # mute this entry until the next scan retries it.
                        funnel["errors"] += 1
                else:
                    funnel["duplicate"] += 1
                    print(f"  {symbol} [{tf_label}]: setup exists but price not in zone, skipping")

                if checks_done % 50 == 0:
                    print(f"  ...{checks_done}/{total_checks} symbol/timeframe checks done so far")
                time.sleep(SCAN_REQUEST_DELAY_SEC)

    print(f"Scan funnel: {total_checks} symbol/timeframe checks -> "
          f"{funnel['no_data']} no history, "
          f"{funnel['no_active_ob']} no confirmed break/OB, "
          f"{funnel['already_mitigated']} already mitigated, "
          f"{funnel['low_score']} below score {MIN_ALERT_SCORE}, "
          f"{funnel['too_far']} too far from entry, "
          f"{funnel['duplicate']} duplicate/already known, "
          f"{funnel['errors']} errors, "
          f"{funnel['alerted']} ALERTED")


def main_loop():
    """Standalone continuous loop -- NOT used by the deployed app (Render's
    free tier drives scans via an external cron hitting /internal/run-scan-now
    instead, see app/main.py). Kept for running the scanner locally without a
    cron service: `python -m app.scan_loop`."""
    print("SMC Short Scanner started.")
    while True:
        try:
            run_once()
        except Exception as e:
            print("[ERROR] scan failed:", e)
        time.sleep(SCAN_INTERVAL_SEC)


if __name__ == "__main__":
    from app.db import init_db
    init_db()
    main_loop()
