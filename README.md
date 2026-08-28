# SMC Scanner — Mobile App

Backend (`backend/`, FastAPI + SQLite) runs the SMC short scanner and pushes signals to
the mobile app (`mobile/`, Expo/React Native, **Android only**). This is the fully free,
no-credit-card route: Android instead of Android+iOS (avoids the $99/yr Apple Developer
account), and Render.com's free web service tier instead of a paid or card-gated cloud VM.

## Run the backend locally

```
cd backend
python -m venv .venv
.venv/Scripts/activate        # or source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8080
```

There's no internal scan loop running automatically (see "Why no internal loop" below) —
trigger a scan manually while developing:

```
curl -X POST http://localhost:8080/internal/run-scan-now -H "X-API-Key: <your key>"
```

No `API_KEY` env var set = auth is skipped (local dev only — never deploy without one).

## Run the mobile app locally

```
cd mobile
cp .env.example .env      # then fill in EXPO_PUBLIC_API_URL / EXPO_PUBLIC_API_KEY
npm start
```

**Push notifications need a real Android device and a dev-client/EAS build — they do not
work in plain Expo Go (SDK 53+).** The feed/detail screens and REST calls work fine in
Expo Go for UI development; only the push path needs the steps below.

## One-time manual setup (accounts/credentials — can't be scripted)

### 1. Expo/EAS project (free)
```
npx eas-cli@latest login
cd mobile && npx eas-cli@latest init
```
This fills in `extra.eas.projectId` in `app.json`. (Use `eas-cli@latest` rather than bare
`eas` — `npx eas ...` has a known resolution bug on some npm versions.)

### 2. Android push credentials — Firebase (free)
Create a project at console.firebase.google.com, add an Android app using the package
name in `app.json` (`com.ndgroup.signals`), generate a service-account key (Project
Settings → Service Accounts → Generate new private key), then upload it with
`npx eas-cli@latest credentials` → Android → **preview** profile → Google Service Account
→ Push Notifications (FCM V1) → Set up → point it at the downloaded `.json` file.

### 3. Build the APK (free)
```
npx eas-cli@latest build --platform android --profile preview
```
`eas.json`'s `preview` profile is set to build a raw `.apk` (not the Play-Store-only
`.aab`) so you can sideload it directly onto your phone — no Play Store listing needed.

### 4. Deploy the backend — Render.com free tier (free, no card)

1. Push this repo to a GitHub repository (Render deploys from a connected git repo).
   If you haven't already: `git init`, commit, create a repo on github.com, push.
2. At render.com, sign up (no card required), then **New → Web Service**, connect the
   GitHub repo, and point it at the `backend/` directory with the Dockerfile build.
3. Add an environment variable `API_KEY` set to a long random string.
4. Deploy. Render gives you a free HTTPS URL automatically —
   `https://<your-service-name>.onrender.com` — no domain, TLS setup, or firewall config
   needed (unlike a raw cloud VM would require).
5. Verify it's up: `curl https://<your-service-name>.onrender.com/health` → `{"status":"ok"}`.

### 5. Set up the free cron pinger — cron-job.org (free, no card)

**Why no internal loop:** Render's free tier can pause the container between requests,
so the original "background thread scans every 15 minutes" design isn't reliable here.
Instead, an external service hits the scan endpoint on a schedule — which also happens to
keep the free instance awake.

1. Sign up at cron-job.org (free, no card).
2. Create a new cron job: URL `https://<your-service-name>.onrender.com/internal/run-scan-now`,
   method `POST`, header `X-API-Key: <the same value you set in Render>`, schedule
   **every 10 minutes**.

   10 minutes, not 15 — Render's free tier sleeps after ~15 minutes with zero requests, so
   this keeps it from ever going idle. If a ping is ever missed for a full 15+ minute gap,
   the instance sleeps and wakes fresh on the next ping.

   **Important tradeoff to know**: Render's free tier disk is ephemeral. If the instance
   ever does fully sleep/restart (a missed cron ping, a redeploy, Render maintenance), the
   SQLite file — including the dedup state that stops you from getting re-alerted on a
   setup you already saw — is wiped. For a personal alert tool this is a "you might
   occasionally see a duplicate alert or lose some history" risk, not a dangerous one. If
   it ever bothers you, the fix is swapping SQLite for a free external Postgres (e.g.
   Neon.tech's free tier, no card) — a `DATABASE_PATH`/connection-string change in
   `app/db.py`, nothing else.

### 6. Point the app at your deployed backend

In `mobile/.env`:
```
EXPO_PUBLIC_API_URL=https://<your-service-name>.onrender.com
EXPO_PUBLIC_API_KEY=<the same API_KEY>
```
Rebuild (`eas build`, step 3) after changing this, since `EXPO_PUBLIC_*` vars are baked
in at build time.

## Branding

App icon/adaptive icon/favicon are generated from `ndgroup logo/nd-app-icon.svg` and
`nd-badge-mono-white.svg` into `mobile/assets/`. Regenerate after any logo change with
`npx sharp-cli -i <svg> -o mobile/assets/<name>.png resize <w> <h>`.

## If you ever want iOS back

Nothing here forecloses it — add an `ios` block to `mobile/app.json`, get an Apple
Developer account, upload an APNs key via `eas credentials`, and `eas build --platform
ios`. The backend and API don't change at all; Expo's push service already relays to
APNs the same way it relays to FCM.
