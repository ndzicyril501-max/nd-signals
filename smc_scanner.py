#!/usr/bin/env python3
"""
SMC/ICT Short Scanner for Bybit Perpetuals
--------------------------------------------
Scans all Bybit USDT perpetuals, finds the top gainers, checks each one
for your SMC short criteria (bearish OB, premium location, momentum),
and sends a Telegram alert when a real setup appears or price taps
a zone that was already flagged.

Run it on a schedule (cron / Task Scheduler / a simple while-loop with
sleep). No trading permissions required — this only reads public market
data, it never places orders.

SETUP
-----
1. pip install requests
2. Create a Telegram bot: message @BotFather on Telegram -> /newbot -> copy the token
3. Get your chat_id: message your new bot anything, then visit
   https://api.telegram.org/bot<TOKEN>/getUpdates  and read the "chat":{"id": ...} field
4. Set the two environment variables below (or hardcode them for local use only —
   never commit a real token to a public repo)
5. Run:  python3 smc_scanner.py
"""

import os
import json
import time
import requests
from datetime import datetime, timezone

# ============ CONFIG ============
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID   = os.environ.get("TELEGRAM_CHAT_ID", "")

BYBIT_BASE = "https://api.bybit.com"

MIN_24H_VOLUME_USD  = 3_000_000  # skip illiquid pairs -- the only cap now; every
                                  # pair above this that passes the upside filter
                                  # gets scanned, not just a top-N slice
IMPULSIVE_MOVE_PCT  = 10         # tag threshold for "impulsive move" context in
                                  # alerts (informational only, doesn't gate the scan)
SCAN_REQUEST_DELAY_SEC = 0.1     # small pause between kline requests when scanning
                                  # the full pair list, so we don't hammer Bybit's API
# Order block detection ports LuxAlgo's open-source "Smart Money Concepts (SMC)"
# TradingView indicator (CC BY-NC-SA 4.0) instead of a custom approximation --
# see luxalgo_swing_structure_and_obs() below for the actual algorithm.
OB_SWING_LENGTH    = 50          # bars each side for "Swing" structure -- matches
                                  # LuxAlgo's default Swing Structure length input
ATR_PERIOD         = 200         # matches LuxAlgo's fixed ta.atr(200) used to filter
                                  # out overly volatile candles from OB candidacy
KLINE_LIMIT        = 300         # need 200+ bars of warmup for ATR(200) plus room
                                  # for the swing lookback and OB search window
SL_ATR_MULT        = 0.5
TP1_PCT            = 0.30        # % of range from OB to swing low
TP2_PCT            = 0.60
SCAN_INTERVAL_SEC  = 15 * 60     # 15 minutes
MIN_ALERT_SCORE    = 9           # only alert on the top band (out of 10). See the
                                  # note in score_setup(): at 9 the "price already at
                                  # the zone" flag (+2) becomes MANDATORY, because
                                  # 5 + the three 1-point flags only reaches 8.

# ---- Single fib entry (replaces the old entry RANGE) ----
# For a SHORT, price rallies UP into the zone: it touches the OB bottom first and
# the OB top last. So a deeper ratio = better fill price + tighter stop, but a
# lower chance of ever filling. 0.5 is ICT's "mean threshold" and is the sane
# default. Measured 0.0 = OB bottom (first touch) -> 1.0 = OB top.
ENTRY_MODE         = "ob_mean_threshold"   # "ob_mean_threshold" | "leg_ote"
OB_FIB_RATIO       = 0.5         # 0.5 = mean threshold, 0.618/0.705 = deeper
LEG_OTE_RATIO      = 0.705       # only used when ENTRY_MODE == "leg_ote"
FIB_LEVELS         = [0.5, 0.618, 0.705, 0.79]   # shown in the alert for context

MIN_RR             = 0.0         # 0 = off. Set e.g. 3.0 to reject thin setups.
AT_ENTRY_TOL_PCT   = 0.15        # price within this % of the entry counts as "at entry"
TIMEFRAMES = [("D", "1D"), ("240", "4H")]   # Bybit interval code -> display label;
                                              # every candidate gets checked on both
NEAR_ENTRY_PCT     = 5           # only alert when price is already within this % of
                                  # the entry zone (or inside it) -- skips setups that
                                  # are technically valid but still far away and not
                                  # actionable yet

STATE_FILE = "scanner_state.json"   # remembers what's already been alerted


# ============ BYBIT DATA ============
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


# ============ SMC LOGIC (ported from LuxAlgo's open-source Pine Script) ============
#
# The order block detection below is a line-by-line Python port of the "Swing
# Order Blocks" logic from LuxAlgo's "Smart Money Concepts (SMC)" indicator,
# open-source under CC BY-NC-SA 4.0:
# https://www.tradingview.com/script/CnB3fSph-Smart-Money-Concepts-SMC-LuxAlgo/
#
# It replicates: swings(length) [pivot detection], the swing BOS/CHoCH crossover
# logic, ob_coord() [order block candle search filtered by 2x ATR volatility],
# and order block mitigation (a zone is dropped once price closes back through it).
#
# WHY THIS FIXES THE FALSE-POSITIVE PROBLEM: the old custom logic used a short
# 10-bar symmetric window and no requirement that a real structure break ever
# happened -- it would call anything "premium zone + last red candle" a setup,
# which fires constantly in choppy/sideways markets where there's no real
# order flow to speak of. This version only creates a bearish order block AFTER
# a confirmed bearish structure break (price closes below a confirmed swing
# low that itself needed 50 bars of confirmation), and only accepts a candle
# as the OB if its range is under 2x ATR(200) -- both of which choppy noise
# routinely fails. Net effect: far fewer signals, but each one reflects an
# actual, indicator-verifiable order block instead of a coincidental candle.

def compute_true_range(bars):
    n = len(bars)
    tr = [None] * n
    for i in range(1, n):
        h, l, pc = bars[i]["high"], bars[i]["low"], bars[i - 1]["close"]
        tr[i] = max(h - l, abs(h - pc), abs(l - pc))
    return tr


def compute_atr_rma(bars, period=ATR_PERIOD):
    """Wilder's RMA-smoothed ATR -- matches Pine Script's ta.atr(period) exactly
    (a plain moving average would NOT match; Pine's ta.atr uses RMA smoothing)."""
    n = len(bars)
    tr = compute_true_range(bars)
    atr_vals = [None] * n
    if n <= period:
        return atr_vals
    seed = sum(tr[1:period + 1]) / period
    atr_vals[period] = seed
    prev = seed
    for i in range(period + 1, n):
        prev = (prev * (period - 1) + tr[i]) / period
        atr_vals[i] = prev
    return atr_vals


def compute_swings(bars, length):
    """Port of LuxAlgo's swings(len) function -- NOT a simple symmetric-window
    pivot; it's a directional-change style detector: os flips to 0 (tracking a
    top) when the high `length` bars ago exceeds the most recent `length`-bar
    high, and flips to 1 (tracking a bottom) on the equivalent low breakout.
    A swing point is confirmed (with `length` bars of lag) when os flips.
    Returns (tops, btms) -- same length as bars, 0 where no swing confirmed,
    otherwise the swing price.
    """
    n = len(bars)
    tops = [0.0] * n
    btms = [0.0] * n
    os_state = 0
    for i in range(n):
        if i < length:
            continue
        window = bars[i - length + 1:i + 1]
        upper = max(b["high"] for b in window)
        lower = min(b["low"] for b in window)
        h_len_ago = bars[i - length]["high"]
        l_len_ago = bars[i - length]["low"]

        prev_os = os_state
        if h_len_ago > upper:
            os_state = 0
        elif l_len_ago < lower:
            os_state = 1
        else:
            os_state = prev_os

        if os_state == 0 and prev_os != 0:
            tops[i] = h_len_ago
        if os_state == 1 and prev_os != 1:
            btms[i] = l_len_ago
    return tops, btms


def _ob_coord_search(bars, atr_series, loc_idx, current_idx, use_max):
    """Port of LuxAlgo's ob_coord(): among bars strictly between loc_idx and
    current_idx, find the extreme candle (highest high if use_max else lowest
    low) whose range is under 2x that bar's ATR(200) -- LuxAlgo's filter for
    excluding overly volatile candles from order block candidacy. Scans newest
    to oldest, matching the original loop order (and its tie-break behavior).
    Returns {"top","bottom","idx"} or None if nothing in range passes the filter.
    """
    best_val = None
    best_idx = None
    for i in range(current_idx - 1, loc_idx, -1):
        thr = atr_series[i]
        if thr is None:
            continue
        if (bars[i]["high"] - bars[i]["low"]) >= thr * 2:
            continue  # too volatile to be a valid OB candle
        val = bars[i]["high"] if use_max else bars[i]["low"]
        if best_val is None or (use_max and val >= best_val) or (not use_max and val <= best_val):
            best_val = val
            best_idx = i
    if best_idx is None:
        return None
    return {"top": bars[best_idx]["high"], "bottom": bars[best_idx]["low"], "idx": best_idx}


def luxalgo_swing_structure_and_obs(bars, length=OB_SWING_LENGTH, atr_period=ATR_PERIOD):
    """Replay LuxAlgo's swing-structure + order-block state machine bar by bar.
    Returns the state after the last bar: current trend, last confirmed swing
    high/low, and the lists of currently ACTIVE (unmitigated) bullish/bearish
    swing order blocks, most recent first (matches LuxAlgo's array.unshift).
    """
    n = len(bars)
    atr_series = compute_atr_rma(bars, atr_period)
    tops, btms = compute_swings(bars, length)

    top_y = btm_y = None
    top_x = btm_x = None
    top_cross = True
    btm_cross = True
    trend = 0

    bull_obs = []
    bear_obs = []
    prev_close = None

    for i in range(n):
        close = bars[i]["close"]

        if tops[i]:
            top_cross = True
            top_y, top_x = tops[i], i - length
        if btms[i]:
            btm_cross = True
            btm_y, btm_x = btms[i], i - length

        # Bullish swing break: close crosses above the last confirmed swing high
        if (top_y is not None and top_cross and prev_close is not None
                and prev_close <= top_y < close):
            ob = _ob_coord_search(bars, atr_series, top_x, i, use_max=False)
            if ob:
                bull_obs.insert(0, {"top": ob["top"], "bottom": ob["bottom"], "created_idx": ob["idx"]})
            top_cross = False
            trend = 1

        # Bearish swing break: close crosses below the last confirmed swing low
        if (btm_y is not None and btm_cross and prev_close is not None
                and prev_close >= btm_y > close):
            ob = _ob_coord_search(bars, atr_series, btm_x, i, use_max=True)
            if ob:
                bear_obs.insert(0, {"top": ob["top"], "bottom": ob["bottom"], "created_idx": ob["idx"]})
            btm_cross = False
            trend = -1

        # Mitigation: drop OBs price has already closed back through
        bull_obs = [b for b in bull_obs if close >= b["bottom"]]
        bear_obs = [b for b in bear_obs if close <= b["top"]]

        prev_close = close

    return {"trend": trend, "top_y": top_y, "btm_y": btm_y,
            "bull_obs": bull_obs, "bear_obs": bear_obs}


def fib_entry(ob_bottom, ob_top, leg_low, leg_high, mode=ENTRY_MODE):
    """Collapse the order-block RANGE into ONE entry price using a fib ratio.

    Two anchorings are possible and they are NOT interchangeable:

    "ob_mean_threshold" (default) -- fib measured across the OB candle itself,
        0.0 = OB bottom, 1.0 = OB top. 0.5 is ICT's mean threshold. Price
        rallying into a bearish OB touches the bottom first, so a higher ratio
        means a better sell price and a tighter stop, but fewer fills.

    "leg_ote" -- the classic 0.62-0.79 optimal-trade-entry measured across the
        whole impulse leg (swing low -> OB high). Worth knowing before you pick
        it: whenever the leg is longer than roughly 3.4x the OB height, every
        OTE level sits BELOW the OB entirely. You get filled earlier, at a
        worse price for a short, with the stop still above the OB -- which is a
        materially worse R:R than the mean threshold on the same setup. It is
        offered because it is a real ICT entry, not because it is the better
        one here.

    Returns the entry plus the full ladder, so the alert can show the levels
    you did not take.
    """
    ob_h = ob_top - ob_bottom
    leg_h = leg_high - leg_low

    ob_levels = {r: ob_bottom + ob_h * r for r in FIB_LEVELS}
    leg_levels = {r: leg_low + leg_h * r for r in FIB_LEVELS} if leg_h > 0 else {}

    if mode == "leg_ote" and leg_h > 0:
        entry = leg_low + leg_h * LEG_OTE_RATIO
        method = f"leg OTE {LEG_OTE_RATIO:.3f}"
    else:
        entry = ob_bottom + ob_h * OB_FIB_RATIO
        method = f"OB mean threshold {OB_FIB_RATIO:.3f}"

    # Where the OB sits as a retracement of the leg -- tells you at a glance
    # whether the two anchorings agree or are pointing at different prices.
    ob_bottom_retr = ((ob_bottom - leg_low) / leg_h) if leg_h > 0 else None

    return {
        "entry": entry,
        "method": method,
        "ob_levels": ob_levels,
        "leg_levels": leg_levels,
        "ob_bottom_retracement": ob_bottom_retr,
        "entry_inside_ob": ob_bottom <= entry <= ob_top,
    }


def analyze_symbol(symbol, interval="D", tf_label="1D"):
    """Run the SMC short check on one symbol/timeframe using LuxAlgo's ported
    swing order block algorithm. Returns a setup dict or None."""
    all_bars = get_klines(symbol, interval=interval, limit=KLINE_LIMIT)
    if len(all_bars) < ATR_PERIOD + 30:
        return None  # not enough history for a reliable ATR(200) warmup

    # The last bar is the still-forming candle -- unreliable for structure;
    # use it only as "current price", run all detection on CLOSED candles only.
    current_price = all_bars[-1]["close"]
    bars = all_bars[:-1]

    state = luxalgo_swing_structure_and_obs(bars)
    bear_obs = state["bear_obs"]
    if not bear_obs:
        return {"symbol": symbol, "timeframe": tf_label, "valid": False,
                "reason": "no active unmitigated bearish swing order block (LuxAlgo definition) -- "
                          "either no confirmed bearish CHoCH/BOS yet, or the last one already broke"}

    ob = bear_obs[0]  # most recent unmitigated bearish OB
    entry_low, entry_high = ob["bottom"], ob["top"]

    # If price has already pushed well back through the zone, treat it as
    # effectively invalidated even though the still-forming candle hasn't
    # technically "closed" through it yet.
    if current_price > entry_high * 1.02:
        return {"symbol": symbol, "timeframe": tf_label, "valid": False,
                "reason": "price has already pushed back through the bearish OB -- effectively mitigated"}

    atr_series = compute_atr_rma(bars, ATR_PERIOD)
    a = atr_series[-1] or (entry_high - entry_low)

    # ---- Impulse leg: from the OB high down to the lowest low it produced ----
    ob_idx = ob["created_idx"]
    leg_high = entry_high
    leg_low = min(b["low"] for b in bars[ob_idx:]) if ob_idx < len(bars) else entry_low

    fib = fib_entry(entry_low, entry_high, leg_low, leg_high)
    entry = fib["entry"]

    # SL stays above the OB regardless of where the entry sits -- the zone is
    # what is invalidated, not the fill price.
    sl = entry_high + a * SL_ATR_MULT
    risk = sl - entry
    if risk <= 0:
        return {"symbol": symbol, "timeframe": tf_label, "valid": False,
                "reason": "entry above stop -- degenerate zone"}

    swing_low_target = state["btm_y"]
    if not swing_low_target or swing_low_target >= entry:
        swing_low_target = entry * 0.85  # fallback if no clean lower target available

    # Targets now measure from the SINGLE entry, not the old zone bottom.
    rng = entry - swing_low_target
    tp1 = entry - rng * TP1_PCT
    tp2 = entry - rng * TP2_PCT
    tp3 = swing_low_target
    rr = (entry - tp3) / risk

    # The zone is still the tradable range: a limit at the fib price is the
    # target fill, but price touches zone_low FIRST. Quote both so the
    # best-case and worst-case fills are visible before you size anything.
    risk_edge = sl - entry_low
    rr_edge = (entry_low - tp3) / risk_edge if risk_edge > 0 else 0.0

    if MIN_RR > 0 and rr < MIN_RR:
        return {"symbol": symbol, "timeframe": tf_label, "valid": False,
                "reason": f"R:R {rr:.1f} below MIN_RR {MIN_RR}"}

    # ---- Score (unchanged weights; now itemised so the alert can show WHY) ----
    # Only six totals are reachable (5..10), and the first flag is worth 2, so
    # requiring 9 makes that flag mandatory plus any two of the others.
    flags = {
        "price at zone (+2)":  current_price >= entry_low * 0.98,
        "tight OB (+1)":       (entry_high - entry_low) / entry_high < 0.08,
        "room to target (+1)": rng / entry > 0.15,
        "trend agrees (+1)":   state["trend"] == -1,
    }
    score = 5 + (2 if flags["price at zone (+2)"] else 0) + sum(
        1 for k, v in flags.items() if v and k != "price at zone (+2)")

    return {
        "symbol": symbol,
        "timeframe": tf_label,
        "valid": True,
        "price": current_price,
        "entry": round(entry, 8),
        "entry_method": fib["method"],
        "fib": fib,
        "zone_low": round(entry_low, 8),      # kept for tap detection + context
        "zone_high": round(entry_high, 8),
        "leg_low": round(leg_low, 8),
        "leg_high": round(leg_high, 8),
        "sl": round(sl, 8),
        "risk": round(risk, 8),
        "rr": round(rr, 2),
        "risk_zone_low": round(risk_edge, 8),   # fill at the first touch of the zone
        "rr_zone_low": round(rr_edge, 2),
        "tp1": round(tp1, 8),
        "tp2": round(tp2, 8),
        "tp3": round(tp3, 8),
        "score": min(score, 10),
        "flags": flags,
        "swing_low": swing_low_target,
    }


# ============ ALERTING ============
def tradingview_link(symbol):
    """TradingView chart link for a Bybit USDT perpetual, e.g. BTCUSDT -> BYBIT:BTCUSDT.P"""
    return f"https://www.tradingview.com/chart/?symbol=BYBIT:{symbol}.P"


def send_telegram(text):
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        print("[WARN] Telegram not configured — printing instead:\n", text)
        return False
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {"chat_id": TELEGRAM_CHAT_ID, "text": text,
               "parse_mode": "Markdown", "disable_web_page_preview": True}
    try:
        r = requests.post(url, data=payload, timeout=10)
        if r.ok:
            return True
        # A non-2xx from Telegram does NOT raise -- without this check a bad
        # token, wrong chat_id or a Markdown parse error looks identical to a
        # successful send, and the alert vanishes silently.
        try:
            body = r.json()
            desc, code = body.get("description", r.text[:200]), body.get("error_code", r.status_code)
        except ValueError:
            desc, code = r.text[:200], r.status_code
        print(f"[ERROR] Telegram rejected the message ({code}): {desc}")
        if "parse" in str(desc).lower() or "entit" in str(desc).lower():
            payload.pop("parse_mode")
            if requests.post(url, data=payload, timeout=10).ok:
                print("[INFO] resent as plain text (Markdown was the problem)")
                return True
        return False
    except requests.RequestException as e:
        print("[ERROR] Telegram send failed:", e)
        return False


def format_alert(gainer, setup, at_entry, in_zone, distance_pct):
    tag = "Top Gainer" if gainer.get("source") == "top_gainer" else "Impulsive Move"
    tf = setup.get("timeframe", "1D")
    move_line = ""
    if "move24h" in gainer:
        move_line = f"24h High-Low Swing: {gainer['move24h']:.1f}%\n"

    # Three distinct phases, because they call for different actions: park a
    # limit / it is live / it is filling now.
    if at_entry:
        status = "🎯 Price is AT the fib entry right now"
    elif in_zone:
        status = "✅ Price is INSIDE the entry zone (fib level not tagged yet)"
    else:
        status = f"⏳ {distance_pct:.1f}% below the zone — waiting for the retrace up"

    earned = ", ".join(k for k, v in setup["flags"].items() if v)

    # The fib ladder inside the OB, so the levels NOT taken are still visible.
    ladder = "  ".join(f"{r:.3f}={v:.8g}"
                       for r, v in sorted(setup["fib"]["ob_levels"].items()))

    return (
        f"🔻 *SMC Short Setup — {setup['symbol']} [{tf}]*  _({tag})_\n"
        f"Signal Quality: *{setup['score']}/10*  |  R:R *{setup['rr']}:1*\n"
        f"{status}\n"
        f"24h Gain: +{gainer['pct24h']:.1f}%  |  Vol: ${gainer['vol24h']:,.0f}\n"
        f"{move_line}"
        f"Funding: {gainer['fundingRate']*100:.4f}%\n\n"
        f"Price: {setup['price']}\n\n"
        f"*ENTRY ZONE: {setup['zone_low']} – {setup['zone_high']}*\n"
        f"*FIB ENTRY: {setup['entry']}*  ({setup['entry_method']})\n"
        f"SL: {setup['sl']}\n"
        f"TP1: {setup['tp1']}\n"
        f"TP2: {setup['tp2']}\n"
        f"TP3: {setup['tp3']}\n\n"
        f"R:R at fib entry: {setup['rr']}:1  (risk {setup['risk']:.8g})\n"
        f"R:R at zone edge: {setup['rr_zone_low']}:1  (risk {setup['risk_zone_low']:.8g})\n"
        f"OB fib ladder: {ladder}\n"
        f"Scored on: {earned}\n\n"
        f"📊 {tradingview_link(setup['symbol'])}\n"
    )


# ============ STATE (avoid duplicate alerts) ============
def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE) as f:
            return json.load(f)
    return {}


def save_state(state):
    with open(STATE_FILE, "w") as f:
        json.dump(state, f)


# ============ MAIN SCAN LOOP ============
def run_once():
    state = load_state()
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
        "low_score": 0,         # valid setup, but below MIN_ALERT_SCORE (9 = top band)
        "too_far": 0,           # valid + high score, but price not near entry yet
        "duplicate": 0,         # already alerted this exact zone, not re-tapping
        "alerted": 0,
        "errors": 0,
    }

    checks_done = 0
    total_checks = len(candidates) * len(TIMEFRAMES)

    for g in candidates:
        symbol = g["symbol"]
        for interval, tf_label in TIMEFRAMES:
            checks_done += 1
            try:
                setup = analyze_symbol(symbol, interval=interval, tf_label=tf_label)
            except Exception as e:
                print(f"  {symbol} [{tf_label}]: error — {e}")
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
            already = state.get(key)

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
            same_zone = already and already.get("alerted_zone") == [zlo, zhi]
            if same_zone and already.get("phase") == phase:
                funnel["duplicate"] += 1
                time.sleep(SCAN_REQUEST_DELAY_SEC)
                continue  # already told you about this zone at this phase

            if in_zone or at_entry or not already:
                if send_telegram(format_alert(g, setup, at_entry, in_zone, distance_pct)):
                    funnel["alerted"] += 1
                    state[key] = {"alerted_zone": [zlo, zhi], "phase": phase,
                                  "alerted_entry": entry, "last_alert_ts": time.time()}
                    where = ("AT FIB ENTRY" if at_entry else
                             "IN ZONE" if in_zone else f"{distance_pct:.1f}% below zone")
                    print(f"  {symbol} [{tf_label}]: ALERT SENT (score {setup['score']}/10, "
                          f"R:R {setup['rr']}, zone {zlo}-{zhi}, entry {entry}, {where}) "
                          f"— {tradingview_link(symbol)}")
                else:
                    # Do NOT record it as alerted -- a failed send must not
                    # mute this entry until the state file is cleared.
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
          f"({funnel['low_score']} of those were valid setups scoring 5-8) "
          f"{funnel['duplicate']} duplicate/already known, "
          f"{funnel['errors']} errors, "
          f"{funnel['alerted']} ALERTED")

    save_state(state)


def main():
    print("SMC Short Scanner started. Press Ctrl+C to stop.")
    while True:
        try:
            run_once()
        except Exception as e:
            print("[ERROR] scan failed:", e)
        time.sleep(SCAN_INTERVAL_SEC)


if __name__ == "__main__":
    main()
