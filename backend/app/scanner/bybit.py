import requests

from app.config import BYBIT_BASE, MIN_24H_VOLUME_USD, IMPULSIVE_MOVE_PCT


def get_all_tickers():
    """Pull 24h stats for every linear (USDT) perpetual."""
    url = f"{BYBIT_BASE}/v5/market/tickers"
    r = requests.get(url, params={"category": "linear"}, timeout=15)
    r.raise_for_status()
    data = r.json()["result"]["list"]
    return data


def get_all_candidates(min_vol=MIN_24H_VOLUME_USD, impulsive_move_pct=IMPULSIVE_MOVE_PCT):
    """Build the scan universe: EVERY liquid pair that passes the upside-only
    filter -- no longer capped to a top-N list. "Upside" is enforced two ways:
    (1) pct24h must be positive -- this excludes coins that just crashed (a big
    high-low swing on a red day is a selloff, not a pump, and isn't useful for
    a premium-zone short setup), and (2) current price must still sit in the
    upper half of the day's high-low range, so a pair that spiked up and then
    fully round-tripped back down doesn't get flagged as an "upside" move.
    Each pair is tagged "impulsive_move" if it also cleared the intraday-swing
    threshold, else "top_gainer" -- purely for alert context, doesn't gate
    which pairs get scanned.
    """
    tickers = get_all_tickers()
    rows = []
    for t in tickers:
        try:
            symbol = t["symbol"]
            if not symbol.endswith("USDT"):
                continue
            pct = float(t["price24hPcnt"]) * 100
            vol_usd = float(t["turnover24h"])
            if vol_usd < min_vol:
                continue
            high24h = float(t["highPrice24h"])
            low24h = float(t["lowPrice24h"])
            last_price = float(t["lastPrice"])
            move_pct = ((high24h - low24h) / low24h * 100) if low24h > 0 else 0.0
            day_range = high24h - low24h
            position_in_range = ((last_price - low24h) / day_range) if day_range > 0 else 0.5
            rows.append({
                "symbol": symbol,
                "pct24h": pct,
                "vol24h": vol_usd,
                "lastPrice": last_price,
                "fundingRate": float(t.get("fundingRate", 0) or 0),
                "openInterest": float(t.get("openInterest", 0) or 0),
                "move24h": move_pct,
                "position_in_range": position_in_range,
            })
        except (KeyError, ValueError, TypeError):
            continue

    # Upside-only filter: must be green on the day AND still trading in the
    # upper half of its 24h range (not a pump that already fully reversed)
    rows = [r for r in rows if r["pct24h"] > 0 and r["position_in_range"] >= 0.5]

    for r in rows:
        r["source"] = "impulsive_move" if r["move24h"] >= impulsive_move_pct else "top_gainer"

    rows.sort(key=lambda x: x["pct24h"], reverse=True)
    return rows


def get_klines(symbol, interval="D", limit=120):
    """interval: '60'=1H, '240'=4H, 'D'=1D"""
    url = f"{BYBIT_BASE}/v5/market/kline"
    r = requests.get(url, params={
        "category": "linear",
        "symbol": symbol,
        "interval": interval,
        "limit": limit
    }, timeout=15)
    r.raise_for_status()
    raw = r.json()["result"]["list"]
    # Bybit returns newest-first; flip to oldest-first for easier logic
    bars = []
    for row in reversed(raw):
        bars.append({
            "time": int(row[0]) // 1000,
            "open": float(row[1]),
            "high": float(row[2]),
            "low": float(row[3]),
            "close": float(row[4]),
            "volume": float(row[5]),
        })
    return bars
