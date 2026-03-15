from pydantic import BaseModel, Field
from typing import Optional, Any
import json


class GenerateRequest(BaseModel):
    id: str                         # brand ID
    user_id: str
    niche: str
    city: str
    state: str
    tone_of_voice: str
    tone_custom: Optional[str] = None
    cta_channel: Optional[str] = "dm"
    competitor_snapshots: list[Any] = Field(default_factory=list)
    locality_basis: str = "state"
    locality_state_key: str = ""
    previous_primary_theme: Optional[str] = None


class CompetitorInsights(BaseModel):
    doing_well: list[str]
    doing_poorly: list[str]
    content_gaps: list[str]
    dominant_themes: list[str]
    avg_post_frequency: float
    competitors_analyzed: list[str]
    confidence: str  # high | medium | low


class TrendInsights(BaseModel):
    current_trends: list[str]
    best_content_type: str
    timing_rationale: str
    seasonal_context: str
    engagement_forecast: str  # high | medium | low


class PostStrategy(BaseModel):
    selected_theme: str
    visual_concept: str
    tone_notes: str
    why_now: str
    gap_exploited: str
    confidence_band: str  # high | medium | low


class FinalResponse(BaseModel):
    post_text: str
    cta: str
    hashtags: list[str]
    suggested_format: str  # feed_post | carousel | story
    strategic_justification: str
    tokens_used: int
    image_url: Optional[str] = None
    image_prompt: Optional[str] = None
    competitor_gap_analysis: Optional[dict] = None
