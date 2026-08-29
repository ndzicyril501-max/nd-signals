import threading

from fastapi import Depends, FastAPI

from app.auth import require_api_key
from app.db import init_db
from app.routers import devices, signals, stats
from app.scan_loop import run_once
from app.scanner.bybit import get_all_candidates, get_all_tickers

app = FastAPI(title="SMC Scanner API")
app.include_router(signals.router)
app.include_router(devices.router)
app.include_router(stats.router)

# On Render's free tier the container can be paused between requests, so an
# internal `while True: sleep(15min)` loop isn't reliable -- an external cron
# service hits /internal/run-scan-now on a schedule instead, which also keeps
# the instance awake. This lock just stops two overlapping scans if a ping
# ever arrives while the previous scan is still running.
_scan_lock = threading.Lock()


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/health")
def health():
    return {"status": "ok"}


def _run_once_if_not_running():
    if not _scan_lock.acquire(blocking=False):
        print("[SKIP] scan already in progress, skipping this trigger")
        return
    try:
        run_once()
    finally:
        _scan_lock.release()


@app.get("/internal/debug-bybit", dependencies=[Depends(require_api_key)])
def debug_bybit():
    """Temporary diagnostic: is this host's IP able to reach Bybit's public
    API at all? Some cloud regions (notably US) get blocked/geofenced by
    Bybit, which would silently produce zero candidates every scan."""
    result = {}
    try:
        tickers = get_all_tickers()
        result["tickers_count"] = len(tickers)
        result["sample_ticker"] = tickers[0] if tickers else None
    except Exception as e:
        result["tickers_error"] = f"{type(e).__name__}: {e}"
        return result

    try:
        candidates = get_all_candidates()
        result["candidates_count"] = len(candidates)
        result["sample_candidates"] = [c["symbol"] for c in candidates[:5]]
    except Exception as e:
        result["candidates_error"] = f"{type(e).__name__}: {e}"
    return result


@app.post("/internal/run-scan-now", dependencies=[Depends(require_api_key)])
def run_scan_now():
    """Triggered externally (by a free cron pinger, e.g. cron-job.org) on a
    schedule -- this endpoint IS the scan schedule on Render's free tier, not
    just a manual test trigger. Runs in a background thread so the request
    returns immediately; the cron service only needs a fast 200 response."""
    threading.Thread(target=_run_once_if_not_running, daemon=True).start()
    return {"status": "scan started"}
