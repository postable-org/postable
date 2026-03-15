"""
Gemini 2.5 Flash client for reasoning, analysis, and caption generation.
"""

import os
import json
import re
import logging
from typing import Any

import google.generativeai as genai
from google.generativeai.types import GenerateContentResponse

logger = logging.getLogger(__name__)

_model: genai.GenerativeModel | None = None
_search_model: genai.GenerativeModel | None = None


def _get_model() -> genai.GenerativeModel:
    global _model
    if _model is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY environment variable is not set")
        genai.configure(api_key=api_key)
        _model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            generation_config=genai.GenerationConfig(
                temperature=0.7,
                top_p=0.95,
                max_output_tokens=4096,
            ),
        )
    return _model


def _get_search_model() -> genai.GenerativeModel:
    """Gemini model with Google Search grounding for real-time trend data."""
    global _search_model
    if _search_model is None:
        api_key = os.environ.get("GEMINI_API_KEY")
        if not api_key:
            raise RuntimeError("GEMINI_API_KEY environment variable is not set")
        genai.configure(api_key=api_key)
        _search_model = genai.GenerativeModel(
            model_name="gemini-2.5-flash",
            generation_config=genai.GenerationConfig(
                temperature=0.5,
                top_p=0.9,
                max_output_tokens=2048,
            ),
            tools=[{"google_search": {}}],
        )
    return _search_model


def _clean_json(text: str) -> str:
    """Strip markdown code fences and extract JSON from Gemini output."""
    text = text.strip()
    # Remove ```json ... ``` or ``` ... ```
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return text.strip()


def _parse_json_response(response: GenerateContentResponse, fallback: dict) -> dict:
    """Extract and parse JSON from a Gemini response, returning fallback on failure."""
    try:
        raw = response.text
        cleaned = _clean_json(raw)
        return json.loads(cleaned)
    except Exception as e:
        logger.warning("Failed to parse Gemini JSON response: %s", e)
        return fallback


def generate_json(prompt: str, use_search: bool = False) -> dict:
    """
    Call Gemini and return parsed JSON dict.
    Uses Google Search grounding when use_search=True.
    """
    try:
        if use_search:
            model = _get_search_model()
        else:
            model = _get_model()

        response = model.generate_content(prompt)
        return _parse_json_response(response, {})
    except Exception as e:
        logger.error("Gemini call failed: %s", e)
        raise


def generate_text(prompt: str) -> str:
    """Call Gemini and return raw text response."""
    try:
        model = _get_model()
        response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        logger.error("Gemini text generation failed: %s", e)
        raise
