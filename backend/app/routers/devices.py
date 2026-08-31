from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from app.auth import require_api_key
from app.db import get_session
from app.models import DeviceToken, WebPushSubscription

router = APIRouter(dependencies=[Depends(require_api_key)])


class RegisterDeviceRequest(BaseModel):
    expo_push_token: str
    platform: str
    label: str | None = None


class WebPushKeys(BaseModel):
    p256dh: str
    auth: str


class RegisterWebPushRequest(BaseModel):
    endpoint: str
    keys: WebPushKeys


@router.post("/devices/register")
def register_device(req: RegisterDeviceRequest, session: Session = Depends(get_session)):
    existing = session.exec(
        select(DeviceToken).where(DeviceToken.expo_push_token == req.expo_push_token)
    ).first()
    if existing:
        existing.platform = req.platform
        existing.label = req.label
        existing.last_seen_at = datetime.utcnow()
        session.add(existing)
        session.commit()
        return {"status": "updated", "id": existing.id}

    device = DeviceToken(expo_push_token=req.expo_push_token, platform=req.platform, label=req.label)
    session.add(device)
    session.commit()
    session.refresh(device)
    return {"status": "registered", "id": device.id}


@router.post("/devices/register-web-push")
def register_web_push(req: RegisterWebPushRequest, session: Session = Depends(get_session)):
    """Stores a browser's PushSubscription (desktop PWA). Matches the shape
    of the object the browser's PushManager.subscribe() call returns
    verbatim -- endpoint/keys.p256dh/keys.auth."""
    existing = session.exec(
        select(WebPushSubscription).where(WebPushSubscription.endpoint == req.endpoint)
    ).first()
    if existing:
        existing.p256dh = req.keys.p256dh
        existing.auth = req.keys.auth
        existing.last_seen_at = datetime.utcnow()
        session.add(existing)
        session.commit()
        return {"status": "updated", "id": existing.id}

    sub = WebPushSubscription(endpoint=req.endpoint, p256dh=req.keys.p256dh, auth=req.keys.auth)
    session.add(sub)
    session.commit()
    session.refresh(sub)
    return {"status": "registered", "id": sub.id}
