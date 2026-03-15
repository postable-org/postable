"""
Gemini Image Generation client.

Uses the Gemini image generation model (default: gemini-3-pro-image-preview)
via the Google Generative AI REST API. Shares the same GOOGLE_API_KEY used
for text generation — no separate API key needed.

Returns a base64 data URL (data:image/png;base64,...) on success, or None.
"""

import os
import base64
import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_GOOGLE_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"


class NanaBananaClient:
    """Drop-in replacement backed by Gemini image generation."""

    def __init__(self) -> None:
        self.model = os.environ.get("IMAGE_MODEL", "gemini-3-pro-image-preview")

    def _get_api_key(self) -> Optional[str]:
        return os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")

    async def generate(self, prompt: str, width: int = 1080, height: int = 1080) -> Optional[str]:
        """
        Generate an image from a text prompt using Gemini.
        Returns a base64 data URL, or None if generation failed.
        """
        api_key = self._get_api_key()
        if not api_key:
            logger.warning("GOOGLE_API_KEY not set — skipping image generation.")
            return None

        url = f"{_GOOGLE_API_BASE}/{self.model}:generateContent?key={api_key}"
        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"responseModalities": ["IMAGE", "TEXT"]},
        }

        try:
            async with httpx.AsyncClient(timeout=120.0) as client:
                resp = await client.post(url, json=payload)

            if resp.status_code != 200:
                logger.error(
                    "Gemini image generation returned %d: %s",
                    resp.status_code,
                    resp.text[:500],
                )
                return None

            data = resp.json()
            candidates = data.get("candidates", [])
            if not candidates:
                logger.error("Gemini image: no candidates in response")
                return None

            for part in candidates[0].get("content", {}).get("parts", []):
                inline = part.get("inlineData") or part.get("inline_data")
                if inline:
                    mime = inline.get("mimeType", "image/png")
                    b64 = inline.get("data", "")
                    if b64:
                        return f"data:{mime};base64,{b64}"

            logger.error("Gemini image: no image data found in response parts")
            return None

        except httpx.TimeoutException:
            logger.error("Gemini image: request timed out after 120s")
            return None
        except Exception as e:
            logger.error("Gemini image: unexpected error: %s", e)
            return None
