import os

BYBIT_BASE = "https://api.bybit.com"

MIN_24H_VOLUME_USD = 3_000_000
IMPULSIVE_MOVE_PCT = 10
SCAN_REQUEST_DELAY_SEC = 0.1

OB_SWING_LENGTH = 50
ATR_PERIOD = 200
KLINE_LIMIT = 300
SL_ATR_MULT = 0.5
TP1_PCT = 0.30
TP2_PCT = 0.60
SCAN_INTERVAL_SEC = 15 * 60

# Raised back to 9 -- the user found 8/10 setups too noisy and wants only the
# top band surfaced. At 9, the "price at zone (+2)" flag becomes mandatory
# (5 + two 1-point flags only reaches 8), so every alert reflects price
# actually being at the zone plus real additional confluence.
MIN_ALERT_SCORE = int(os.environ.get("MIN_ALERT_SCORE", "9"))

ENTRY_MODE = "ob_mean_threshold"
OB_FIB_RATIO = 0.5
LEG_OTE_RATIO = 0.705
FIB_LEVELS = [0.5, 0.618, 0.705, 0.79]

MIN_RR = 0.0
AT_ENTRY_TOL_PCT = 0.15
TIMEFRAMES = [("D", "1D"), ("240", "4H")]
NEAR_ENTRY_PCT = 5

DATABASE_PATH = os.environ.get("DATABASE_PATH", "scanner.db")
API_KEY = os.environ.get("API_KEY", "")
EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

# The mobile app never needed CORS (not a browser). The web/PWA build does --
# comma-separated list of allowed origins, e.g. "https://user.github.io".
CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "https://ndzicyril501-max.github.io").split(",") if o.strip()]

# Web Push (desktop PWA) -- separate from Expo push above since
# expo-notifications does not support the web platform at all. Generate a
# pair with `py_vapid`'s Vapid().generate_keys(); the private key is a
# secret (server-side signing only), the public key is safe to expose and
# gets baked into the web build as EXPO_PUBLIC_VAPID_PUBLIC_KEY.
VAPID_PRIVATE_KEY_PEM = os.environ.get("VAPID_PRIVATE_KEY_PEM", "")
VAPID_PUBLIC_KEY = os.environ.get("VAPID_PUBLIC_KEY", "")
VAPID_CLAIM_EMAIL = os.environ.get("VAPID_CLAIM_EMAIL", "mailto:admin@ndgroup.example")
