FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
RUN mkdir -p /app/data

# NOTE: Render's free tier has no persistent volume -- this file lives on the
# container's ephemeral disk and is wiped if the instance ever fully restarts
# (a redeploy, or a sleep/wake cycle if the external cron pinger misses a
# beat). See README.md for details and the tradeoff this accepts.
ENV DATABASE_PATH=/app/data/scanner.db

# Render injects $PORT and expects the app to bind to it; default 8080 keeps
# `docker run` working the same way for local testing.
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
