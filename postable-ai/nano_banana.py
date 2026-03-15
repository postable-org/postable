"""
Nano Banana Pro — image generation client.

Configure via environment variables:
  NANO_BANANA_API_URL   Base URL of the Nano Banana Pro API
                        (e.g. https://api.nanobanana.ai/v1)
  NANO_BANANA_API_KEY   Your API key

The client POSTs to {NANO_BANANA_API_URL}/images/generate with:
  {
    "prompt": "<image description>",
    "width": 1080,
    "height": 1080,
    "model": "nano-banana-pro"
  }

Expected response (any of these formats are auto-detected):
  { "image_url": "https://..." }
  { "url": "https://..." }
  { "data": [{ "url": "https://..." }] }
  { "output": "https://..." }
"""

import os
import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


class NanaBananaClient:
    def __init__(self) -> None:
        self.api_url = os.environ.get(
            "NANO_BANANA_API_URL", "https://api.nanobanana.ai/v1"
        ).rstrip("/")
        self.api_key = os.environ.get("NANO_BANANA_API_KEY", "")
        self.model = os.environ.get("NANO_BANANA_MODEL", "nano-banana-pro")

    def _headers(self) -> dict:
        h = {"Content-Type": "application/json"}
        if self.api_key:
            h["Authorization"] = f"Bearer {self.api_key}"
        return h

    def _extract_url(self, data: dict) -> Optional[str]:
        """Try multiple response shapes to find the image URL."""
        for key in ("image_url", "url", "output", "image"):
            if key in data and isinstance(data[key], str) and data[key].startswith("http"):
                return data[key]
        # OpenAI-compatible: { "data": [{ "url": "..." }] }
        if "data" in data and isinstance(data["data"], list) and data["data"]:
            item = data["data"][0]
            if isinstance(item, dict):
                for key in ("url", "image_url"):
                    if key in item and isinstance(item[key], str):
                        return item[key]
        return None

    async def generate(self, prompt: str, width: int = 1080, height: int = 1080) -> Optional[str]:
        """
        Generate an image from a text prompt.
        Returns the image URL, or None if generation failed or is not configured.
        """
        if not self.api_key:
            logger.warning(
                "NANO_BANANA_API_KEY not set — skipping image generation. "
                "Set NANO_BANANA_API_URL and NANO_BANANA_API_KEY to enable."
            )
            return None

        payload = {
            "prompt": prompt,
            "width": width,
            "height": height,
            "model": self.model,
        }

        try:
            async with httpx.AsyncClient(timeout=90.0) as client:
                resp = await client.post(
                    f"{self.api_url}/images/generate",
                    headers=self._headers(),
                    json=payload,
                )

            if resp.status_code != 200:
                logger.error(
                    "Nano Banana returned %d: %s",
                    resp.status_code,
                    resp.text[:300],
                )
                return None

            data = resp.json()
            url = self._extract_url(data)
            if not url:
                logger.error("Nano Banana: could not extract image URL from response: %s", data)
            return url

        except httpx.TimeoutException:
            logger.error("Nano Banana: request timed out after 90s")
            return None
        except Exception as e:
            logger.error("Nano Banana: unexpected error: %s", e)
            return None
