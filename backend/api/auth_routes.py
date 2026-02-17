"""
Google OAuth authentication routes.

Verifies Google ID tokens and returns user profile info.
"""

import logging
import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth")

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")


class GoogleAuthRequest(BaseModel):
    credential: str  # The Google ID token (JWT)


class GoogleAuthResponse(BaseModel):
    email: str
    name: str
    picture: str
    given_name: str = ""
    family_name: str = ""


@router.post("/google", response_model=GoogleAuthResponse)
async def google_auth(payload: GoogleAuthRequest):
    """
    Verify a Google ID token and return the user's profile.
    The frontend sends the credential (JWT) received from Google Sign-In.
    """
    try:
        id_info = id_token.verify_oauth2_token(
            payload.credential,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )

        # Ensure the token was issued for our app
        if id_info.get("aud") != GOOGLE_CLIENT_ID:
            raise HTTPException(status_code=401, detail="Invalid audience")

        if not id_info.get("email_verified", False):
            raise HTTPException(status_code=401, detail="Email not verified")

        return GoogleAuthResponse(
            email=id_info.get("email", ""),
            name=id_info.get("name", ""),
            picture=id_info.get("picture", ""),
            given_name=id_info.get("given_name", ""),
            family_name=id_info.get("family_name", ""),
        )

    except ValueError as e:
        logger.warning("Google token verification failed: %s", e)
        raise HTTPException(status_code=401, detail="Invalid Google token")
    except Exception as e:
        logger.error("Google auth error: %s", e)
        raise HTTPException(status_code=500, detail="Authentication failed")
