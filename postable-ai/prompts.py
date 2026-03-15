"""
All AI prompts for the Postable generation pipeline.
"""

from datetime import datetime
import json


def competitor_analysis_prompt(
    niche: str,
    city: str,
    state: str,
    snapshots: list,
) -> str:
    snapshots_str = json.dumps(snapshots, ensure_ascii=False, indent=2) if snapshots else "[]"

    return f"""You are a sharp social media strategist analyzing competitor activity for a {niche} business in {city}, {state}, Brazil.

## Competitor Snapshots (last 30 days)
{snapshots_str}

Each snapshot contains:
- handle: competitor's Instagram handle
- post_count: how many posts in the window
- themes_json: content themes observed
- confidence: reliability of this data (0-1)
- signals_json: additional signals

## Your Task
Analyze these competitors deeply and return a JSON object with:

{{
  "doing_well": [
    "specific things competitors are excelling at (content themes, posting frequency, formats)"
  ],
  "doing_poorly": [
    "visible gaps, missed opportunities, weak areas in their strategy"
  ],
  "content_gaps": [
    "content types or themes NOBODY in this niche is posting that could stand out"
  ],
  "dominant_themes": [
    "the 3-5 most common content themes across all competitors"
  ],
  "avg_post_frequency": <number: average posts per week across competitors>,
  "competitors_analyzed": ["@handle1", "@handle2"],
  "confidence": "high|medium|low"
}}

Rules:
- If snapshots is empty, infer reasonable gaps for a {niche} business based on general knowledge
- Focus on ACTIONABLE gaps, not generic observations
- Return ONLY valid JSON, no markdown, no explanation
"""


def trend_analysis_prompt(
    niche: str,
    city: str,
    state: str,
    current_dt: datetime,
    competitor_insights: dict,
) -> str:
    day_name = current_dt.strftime("%A")
    hour = current_dt.hour

    time_of_day = (
        "manhã" if 6 <= hour < 12
        else "tarde" if 12 <= hour < 18
        else "noite" if 18 <= hour < 22
        else "madrugada"
    )

    gaps_str = json.dumps(competitor_insights.get("content_gaps", []), ensure_ascii=False)

    return f"""You are a social media trend analyst for the Brazilian market.

## Context
- Business: {niche} sector
- Location: {city}, {state}, Brazil
- Right now: {day_name}, {current_dt.strftime("%B %d, %Y")}, {time_of_day} (BRT)
- Competitor content gaps identified: {gaps_str}

## Your Task
Using your knowledge of current trends in Brazil and social media patterns, analyze what content approach would work BEST right now.

Consider:
1. Day of week engagement patterns (Mondays = motivation, Fridays = weekend vibes, etc.)
2. Time of day (who is online and in what mindset)
3. Current trends or seasonal events relevant to {state}/Brazil in {current_dt.strftime("%B %Y")}
4. The {niche} industry's typical content calendar patterns
5. Any viral content formats dominating Brazilian Instagram right now

Return a JSON object:
{{
  "current_trends": [
    "specific trend or pattern that's hot right now for this niche"
  ],
  "best_content_type": "one of: educational, inspirational, promotional, behind-the-scenes, testimonial, entertainment, trending-format",
  "timing_rationale": "brief explanation of why right now is good/neutral/bad for posting and what angle to use",
  "seasonal_context": "relevant seasonal/cultural context for Brazil in {current_dt.strftime("%B")}: holidays, events, climate, consumer behavior",
  "engagement_forecast": "high|medium|low"
}}

Return ONLY valid JSON, no markdown, no explanation.
"""


def strategy_prompt(
    niche: str,
    city: str,
    state: str,
    tone_of_voice: str,
    tone_custom: str | None,
    cta_channel: str,
    competitor_insights: dict,
    trend_insights: dict,
    previous_theme: str | None,
) -> str:
    tone_desc = tone_custom if tone_custom else tone_of_voice
    cta_map = {
        "whatsapp": "WhatsApp",
        "landing_page": "link na bio",
        "dm": "mensagem direta (DM)",
    }
    cta_label = cta_map.get(cta_channel, "DM")

    avoid_theme = f"Do NOT repeat the previous theme: '{previous_theme}'" if previous_theme else ""

    gaps = json.dumps(competitor_insights.get("content_gaps", []), ensure_ascii=False)
    trends = json.dumps(trend_insights.get("current_trends", []), ensure_ascii=False)
    best_type = trend_insights.get("best_content_type", "educational")

    return f"""You are the lead creative director for a {niche} brand in {city}, {state}, Brazil.

## Brand Voice
Tone: {tone_desc}
CTA channel: {cta_label}

## What Competitors Are Missing
{gaps}

## Current Trends
{trends}
Best content type for right now: {best_type}

{avoid_theme}

## Your Task
Design the perfect Instagram post strategy for this exact moment. Chain-of-thought:
1. Which gap + trend intersection creates the most impact?
2. What visual will stop the scroll?
3. How does the brand voice translate to this content?

Return a JSON object:
{{
  "selected_theme": "the single best theme/topic for this post (specific, not generic)",
  "visual_concept": "detailed description of the ideal image: subject, setting, mood, colors, style — NO TEXT IN IMAGE, Instagram 1:1 format, hyper-realistic photography style preferred for products/lifestyle or clean graphic for informational",
  "tone_notes": "specific tone guidance for this post's copy",
  "why_now": "1-2 sentence explanation of why this specific theme at this moment is strategic",
  "gap_exploited": "which competitor gap this directly targets",
  "confidence_band": "high|medium|low"
}}

Return ONLY valid JSON, no markdown, no explanation.
"""


def image_prompt_builder(
    niche: str,
    city: str,
    visual_concept: str,
    tone_notes: str,
) -> str:
    """Build the final image generation prompt for Nano Banana Pro."""
    return (
        f"{visual_concept}. "
        f"Professional Instagram photo, 1:1 square format, high quality, "
        f"no text overlays, no watermarks. "
        f"Style: modern, clean, aspirational. "
        f"Context: {niche} business in Brazil."
    )


def caption_prompt(
    niche: str,
    tone_of_voice: str,
    tone_custom: str | None,
    cta_channel: str,
    strategy: dict,
    trend_insights: dict,
    visual_concept: str,
    city: str,
    state: str,
) -> str:
    tone_desc = tone_custom if tone_custom else tone_of_voice
    cta_map = {
        "whatsapp": "Fale com a gente no WhatsApp 👇",
        "landing_page": "Clique no link da bio para saber mais 👆",
        "dm": "Manda uma DM, a gente te responde! 💬",
    }
    cta_text = cta_map.get(cta_channel, "Manda uma DM! 💬")

    theme = strategy.get("selected_theme", "")
    why_now = strategy.get("why_now", "")
    tone_notes = strategy.get("tone_notes", "")
    best_type = trend_insights.get("best_content_type", "")

    return f"""You are a top Brazilian Instagram copywriter specializing in {niche} content.

## Post Strategy
Theme: {theme}
Why now: {why_now}
Tone guidance: {tone_notes}
Content type: {best_type}
Brand voice: {tone_desc}
Location: {city}, {state}

## Visual
The photo shows: {visual_concept}

## Task
Write a compelling Instagram caption in Brazilian Portuguese.

Requirements:
- Opens with a HOOK (first line must grab attention, no emojis until after the hook or use sparingly)
- Body: 2-4 short paragraphs matching the theme and tone
- End with this CTA: "{cta_text}"
- 5-8 relevant hashtags in Portuguese + English mix
- Max 300 words total (excluding hashtags)
- Match tone: {tone_desc}
- NO generic phrases like "na sua empresa" or "entre em contato"

Return a JSON object:
{{
  "post_text": "the full caption text (no hashtags, include line breaks with \\n)",
  "cta": "{cta_text}",
  "hashtags": ["#hashtag1", "#hashtag2", ... up to 8],
  "suggested_format": "feed_post|carousel|story",
  "strategic_justification": "1 sentence explaining the strategic reasoning"
}}

Return ONLY valid JSON, no markdown, no explanation.
"""
