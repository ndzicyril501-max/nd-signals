from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import Session, select

from app.auth import require_api_key
from app.db import get_session
from app.models import Signal
from app.schemas import SignalDetail, SignalListItem

router = APIRouter(dependencies=[Depends(require_api_key)])


@router.get("/signals", response_model=List[SignalListItem])
def list_signals(limit: int = Query(default=50, le=200),
                  min_score: Optional[int] = None,
                  active: Optional[bool] = None,
                  session: Session = Depends(get_session)):
    """`active=true` -> only open trades (status == "active").
    `active=false` -> only closed trades (hit_sl / hit_tp3).
    Omitted -> everything, newest first."""
    stmt = select(Signal).order_by(Signal.created_at.desc())
    if min_score is not None:
        stmt = stmt.where(Signal.score >= min_score)
    if active is True:
        stmt = stmt.where(Signal.status == "active")
    elif active is False:
        stmt = stmt.where(Signal.status != "active")
    stmt = stmt.limit(limit)
    return session.exec(stmt).all()


@router.get("/signals/{signal_id}", response_model=SignalDetail)
def get_signal(signal_id: int, session: Session = Depends(get_session)):
    signal = session.get(Signal, signal_id)
    if signal is None:
        raise HTTPException(status_code=404, detail="signal not found")
    return SignalDetail.from_signal(signal)
