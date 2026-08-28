import threading

from fastapi import Depends, FastAPI

from app.auth import require_api_key
from app.db import init_db
from app.routers import devices, signals
from app.scan_loop import run_once

app = FastAPI(title="SMC Scanner API")
app.include_router(signals.router)
app.include_router(devices.router)

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


@app.post("/internal/run-scan-now", dependencies=[Depends(require_api_key)])
def run_scan_now():
    """Triggered externally (by a free cron pinger, e.g. cron-job.org) on a
    schedule -- this endpoint IS the scan schedule on Render's free tier, not
    just a manual test trigger. Runs in a background thread so the request
    returns immediately; the cron service only needs a fast 200 response."""
    threading.Thread(target=_run_once_if_not_running, daemon=True).start()
    return {"status": "scan started"}
