from datetime import datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from app.auth import require_api_key
from app.db import get_session
from app.models import DeviceToken

router = APIRouter(dependencies=[Depends(require_api_key)])


class RegisterDeviceRequest(BaseModel):
    expo_push_token: str
    platform: str
    label: str | None = None


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
