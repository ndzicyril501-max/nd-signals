from datetime import datetime

from sqlmodel import Session, select

from app.models import Signal
from app.scanner.bybit import get_all_tickers


def refresh_open_signals(session: Session) -> int:
    """Closes out "active" signals once price has actually settled the trade.

    Signals only get scanned for a fresh setup while their symbol still
    passes the "top gainer" upside filter (see get_all_candidates) -- but a
    trade obviously needs following after that stops being true (e.g. price
    turns over and drops, which is exactly what a working short looks like).
    So this checks EVERY currently-active signal against the full unfiltered
    ticker list, independent of whether the symbol is still a "candidate".

    All these setups are SHORTS: SL sits above entry, TP3 sits below. Hitting
    SL first means the trade lost; hitting TP3 first means it reached final
    target and won. Whichever price crosses first wins -- if a single price
    update happens to be past both (a big gap move), SL takes precedence
    since that's the more conservative (already-invalidated) read.

    Returns how many signals were closed out this pass.
    """
    open_signals = session.exec(select(Signal).where(Signal.status == "active")).all()
    if not open_signals:
        return 0

    tickers = get_all_tickers()
    price_by_symbol = {t["symbol"]: float(t["lastPrice"]) for t in tickers if "lastPrice" in t}

    closed = 0
    for signal in open_signals:
        price = price_by_symbol.get(signal.symbol)
        if price is None:
            continue  # symbol delisted or otherwise missing -- leave as active

        if price >= signal.sl:
            signal.status = "hit_sl"
        elif price <= signal.tp3:
            signal.status = "hit_tp3"
        else:
            continue  # still active, nothing to update

        signal.closed_at = datetime.utcnow()
        signal.closed_price = price
        session.add(signal)
        closed += 1

    if closed:
        session.commit()
    return closed
