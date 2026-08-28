from fastapi import Header, HTTPException

from app.config import API_KEY


def require_api_key(x_api_key: str = Header(default="")):
    """Guards every route with a static shared-secret header. If API_KEY is
    unset (local dev only), enforcement is skipped -- but a real deployment
    must set API_KEY, since this backend is otherwise a public, unauthenticated
    URL that can read your setups or register arbitrary push tokens."""
    if not API_KEY:
        return
    if x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="invalid or missing X-API-Key")
