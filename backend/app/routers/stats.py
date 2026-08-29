from collections import defaultdict
from typing import List, Optional

from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from app.auth import require_api_key
from app.db import get_session
from app.models import ScanRun, Signal

router = APIRouter(dependencies=[Depends(require_api_key)])


def _r_value(s: Signal) -> float:
    """R multiple realized by one closed trade. A win banks the reward this
    setup was actually scored for (its own rr); a loss is always exactly -1R
    by definition -- risk is what SL distance measures, so hitting it means
    the full planned risk was realized, no more, no less."""
    return s.rr if s.status == "hit_tp3" else -1.0


@router.get("/stats/summary")
def stats_summary(session: Session = Depends(get_session)):
    active = session.exec(select(Signal).where(Signal.status == "active")).all()
    done = session.exec(select(Signal).where(Signal.status != "active")).all()

    avg_score = round(sum(s.score for s in active) / len(active), 1) if active else 0.0
    wins = [s for s in done if s.status == "hit_tp3"]
    win_rate = round(len(wins) / len(done) * 100, 1) if done else 0.0
    net_r = round(sum(_r_value(s) for s in done), 1)

    return {
        "active_count": len(active),
        "avg_score": avg_score,
        "done_count": len(done),
        "win_rate_pct": win_rate,
        "net_r": net_r,
    }


@router.get("/scan-status")
def scan_status(session: Session = Depends(get_session)):
    run = session.get(ScanRun, 1)
    return {"last_started_at": run.started_at if run else None}


@router.get("/stats/performance")
def stats_performance(limit: int = 30, session: Session = Depends(get_session)):
    done = session.exec(select(Signal).where(Signal.status != "active").order_by(Signal.closed_at)).all()

    wins = [s for s in done if s.status == "hit_tp3"]
    losses = [s for s in done if s.status == "hit_sl"]
    win_sum = sum(_r_value(s) for s in wins)
    loss_sum = sum(_r_value(s) for s in losses)  # negative
    net_r = round(win_sum + loss_sum, 2)
    win_rate = round(len(wins) / len(done) * 100, 1) if done else 0.0
    avg_win = round(win_sum / len(wins), 2) if wins else 0.0
    avg_loss = round(loss_sum / len(losses), 2) if losses else 0.0
    profit_factor = round(win_sum / abs(loss_sum), 2) if loss_sum != 0 else (round(win_sum, 2) if win_sum else 0.0)

    # Equity curve + best streak + max drawdown all fall out of one pass over
    # the closed_at-ordered trades.
    equity_curve = []
    cumulative = 0.0
    peak = 0.0
    max_drawdown = 0.0
    best_streak = 0
    current_streak = 0
    for s in done:
        cumulative += _r_value(s)
        equity_curve.append({"closed_at": s.closed_at, "cumulative_r": round(cumulative, 2)})
        peak = max(peak, cumulative)
        max_drawdown = min(max_drawdown, cumulative - peak)
        if s.status == "hit_tp3":
            current_streak += 1
            best_streak = max(best_streak, current_streak)
        else:
            current_streak = 0

    by_score: dict[int, List[Signal]] = defaultdict(list)
    for s in done:
        by_score[s.score].append(s)
    win_rate_by_score = [
        {
            "score": score,
            "n": len(rows),
            "win_pct": round(sum(1 for r in rows if r.status == "hit_tp3") / len(rows) * 100, 1),
        }
        for score, rows in sorted(by_score.items(), reverse=True)
    ]

    by_tf: dict[str, List[Signal]] = defaultdict(list)
    for s in done:
        by_tf[s.timeframe].append(s)
    by_timeframe = [
        {
            "timeframe": tf,
            "n": len(rows),
            "win_pct": round(sum(1 for r in rows if r.status == "hit_tp3") / len(rows) * 100, 1),
            "net_r": round(sum(_r_value(r) for r in rows), 2),
        }
        for tf, rows in sorted(by_tf.items())
    ]

    closed_log = [
        {
            "id": s.id,
            "symbol": s.symbol,
            "timeframe": s.timeframe,
            "closed_at": s.closed_at,
            "closed_price": s.closed_price,
            "r": round(_r_value(s), 2),
            "outcome": "TARGET" if s.status == "hit_tp3" else "STOPPED",
        }
        for s in reversed(done[-limit:])
    ]

    return {
        "win_count": len(wins),
        "loss_count": len(losses),
        "win_rate_pct": win_rate,
        "net_r": net_r,
        "avg_win_r": avg_win,
        "avg_loss_r": avg_loss,
        "profit_factor": profit_factor,
        "best_streak": best_streak,
        "max_drawdown_r": round(max_drawdown, 2),
        "equity_curve": equity_curve,
        "win_rate_by_score": win_rate_by_score,
        "by_timeframe": by_timeframe,
        "closed_log": closed_log,
    }
