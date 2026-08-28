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

from app.config import (
    ATR_PERIOD, OB_SWING_LENGTH, KLINE_LIMIT, SL_ATR_MULT, TP1_PCT, TP2_PCT,
    ENTRY_MODE, OB_FIB_RATIO, LEG_OTE_RATIO, FIB_LEVELS, MIN_RR,
)
from app.scanner.bybit import get_klines


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
