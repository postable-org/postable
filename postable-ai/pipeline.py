"""
Main AI generation pipeline.

Stages:
  1. competitor-analysis  — Gemini analyzes competitor snapshot data
  2. trend-analysis       — Gemini + Google Search for current trends/timing
  3. strategy             — Gemini designs the post strategy (theme + visual)
  4. image-generation     — Nano Banana Pro generates the photo
  5. caption              — Gemini writes the Brazilian Portuguese caption
  6. done                 — Emits final JSON

Each stage emits a JSON progress line so the Go layer can stream updates to the client.
The final line emitted is the complete GenerateResponse JSON (PostContent shape).
"""

import json
import logging
from datetime import datetime, timezone

import pytz

from models import GenerateRequest, FinalResponse
from gemini_client import generate_json
from nano_banana import NanaBananaClient
from prompts import (
    competitor_analysis_prompt,
    trend_analysis_prompt,
    strategy_prompt,
    image_prompt_builder,
    caption_prompt,
)

logger = logging.getLogger(__name__)

# Brasília timezone for timing-aware decisions
BRT = pytz.timezone("America/Sao_Paulo")

_nano_banana = NanaBananaClient()


def _progress(stage: str, status: str, message: str) -> str:
    """Return a JSON progress line to be streamed to the client."""
    return json.dumps(
        {"type": "progress", "stage": stage, "status": status, "message": message},
        ensure_ascii=False,
    )


def _flatten_snapshots(raw: list) -> list[dict]:
    """Normalize competitor snapshots into a clean list for prompts."""
    result = []
    for s in raw:
        if isinstance(s, str):
            try:
                s = json.loads(s)
            except Exception:
                continue
        if not isinstance(s, dict):
            continue
        result.append(
            {
                "handle": s.get("handle", s.get("normalized_handle", "unknown")),
                "post_count": s.get("post_count", 0),
                "themes": s.get("themes_json", s.get("themes", [])),
                "confidence": s.get("confidence", 0.0),
                "captured_at": s.get("captured_at", ""),
            }
        )
    return result


async def run(req: GenerateRequest):
    """
    Async generator — yields newline-terminated JSON strings.
    The Go layer forwards each line as a `data: ...` SSE event.
    The LAST yielded line is the complete FinalResponse JSON.
    """
    now_brt = datetime.now(BRT)
    snapshots = _flatten_snapshots(req.competitor_snapshots)

    # ── Stage 1: Competitor Analysis ─────────────────────────────────────────
    yield _progress("competitor-analysis", "started", "Analisando concorrentes...") + "\n"

    competitor_insights = {}
    try:
        prompt_c = competitor_analysis_prompt(
            niche=req.niche,
            city=req.city,
            state=req.state,
            snapshots=snapshots,
        )
        competitor_insights = generate_json(prompt_c, use_search=False)
        if not competitor_insights:
            competitor_insights = {
                "doing_well": [],
                "doing_poorly": [],
                "content_gaps": ["conteúdo educativo sobre o produto"],
                "dominant_themes": [],
                "avg_post_frequency": 3.0,
                "competitors_analyzed": [],
                "confidence": "low",
            }
    except Exception as e:
        logger.error("Competitor analysis failed: %s", e)
        competitor_insights = {
            "doing_well": [],
            "doing_poorly": [],
            "content_gaps": ["conteúdo educativo sobre o produto"],
            "dominant_themes": [],
            "avg_post_frequency": 3.0,
            "competitors_analyzed": [],
            "confidence": "low",
        }

    yield _progress(
        "competitor-analysis",
        "complete",
        f"Análise concluída — {len(competitor_insights.get('content_gaps', []))} lacunas encontradas",
    ) + "\n"

    # ── Stage 2: Trend Analysis ───────────────────────────────────────────────
    yield _progress("trend-analysis", "started", "Identificando tendências do momento...") + "\n"

    trend_insights = {}
    try:
        prompt_t = trend_analysis_prompt(
            niche=req.niche,
            city=req.city,
            state=req.state,
            current_dt=now_brt,
            competitor_insights=competitor_insights,
        )
        # Use Google Search grounding for real-time trend awareness
        trend_insights = generate_json(prompt_t, use_search=True)
        if not trend_insights:
            trend_insights = {
                "current_trends": ["conteúdo autêntico e humanizado"],
                "best_content_type": "educational",
                "timing_rationale": "Horário favorável para engajamento",
                "seasonal_context": "Período regular sem datas comemorativas específicas",
                "engagement_forecast": "medium",
            }
    except Exception as e:
        logger.warning("Trend analysis with search failed, retrying without: %s", e)
        try:
            trend_insights = generate_json(
                trend_analysis_prompt(
                    niche=req.niche,
                    city=req.city,
                    state=req.state,
                    current_dt=now_brt,
                    competitor_insights=competitor_insights,
                ),
                use_search=False,
            )
        except Exception as e2:
            logger.error("Trend analysis fallback also failed: %s", e2)
            trend_insights = {
                "current_trends": ["conteúdo autêntico e humanizado"],
                "best_content_type": "educational",
                "timing_rationale": "Horário favorável para engajamento",
                "seasonal_context": "Período regular",
                "engagement_forecast": "medium",
            }

    yield _progress(
        "trend-analysis",
        "complete",
        f"Tendências identificadas — {trend_insights.get('best_content_type', 'conteúdo educativo')}",
    ) + "\n"

    # ── Stage 3: Post Strategy ────────────────────────────────────────────────
    yield _progress("strategy", "started", "Desenvolvendo estratégia criativa...") + "\n"

    strategy = {}
    try:
        prompt_s = strategy_prompt(
            niche=req.niche,
            city=req.city,
            state=req.state,
            tone_of_voice=req.tone_of_voice,
            tone_custom=req.tone_custom,
            cta_channel=req.cta_channel or "dm",
            competitor_insights=competitor_insights,
            trend_insights=trend_insights,
            previous_theme=req.previous_primary_theme,
        )
        strategy = generate_json(prompt_s, use_search=False)
        if not strategy:
            strategy = {
                "selected_theme": "dica prática do dia",
                "visual_concept": f"Clean professional setting for {req.niche} in Brazil",
                "tone_notes": req.tone_of_voice,
                "why_now": "Conteúdo educativo performou bem neste horário",
                "gap_exploited": "falta de conteúdo educativo",
                "confidence_band": "low",
            }
    except Exception as e:
        logger.error("Strategy generation failed: %s", e)
        strategy = {
            "selected_theme": "dica prática do dia",
            "visual_concept": f"Clean professional setting for {req.niche} in Brazil",
            "tone_notes": req.tone_of_voice,
            "why_now": "Conteúdo educativo performou bem neste horário",
            "gap_exploited": "falta de conteúdo educativo",
            "confidence_band": "low",
        }

    yield _progress(
        "strategy",
        "complete",
        f"Estratégia definida — tema: {strategy.get('selected_theme', '')}",
    ) + "\n"

    # ── Stage 4: Image Generation ─────────────────────────────────────────────
    yield _progress("image-generation", "started", "Gerando imagem com Nano Banana Pro...") + "\n"

    visual_concept = strategy.get("visual_concept", f"Professional {req.niche} scene in Brazil")
    img_prompt = image_prompt_builder(
        niche=req.niche,
        city=req.city,
        visual_concept=visual_concept,
        tone_notes=strategy.get("tone_notes", ""),
    )

    image_url: str | None = None
    try:
        image_url = await _nano_banana.generate(prompt=img_prompt, width=1080, height=1080)
    except Exception as e:
        logger.error("Image generation error: %s", e)

    if image_url:
        yield _progress("image-generation", "complete", "Imagem gerada com sucesso!") + "\n"
    else:
        yield _progress(
            "image-generation",
            "skipped",
            "Imagem não disponível — continue com a legenda",
        ) + "\n"

    # ── Stage 5: Caption Generation ────────────────────────────────────────────
    yield _progress("caption", "started", "Escrevendo legenda...") + "\n"

    caption_data = {}
    tokens_used = 0
    try:
        prompt_cap = caption_prompt(
            niche=req.niche,
            tone_of_voice=req.tone_of_voice,
            tone_custom=req.tone_custom,
            cta_channel=req.cta_channel or "dm",
            strategy=strategy,
            trend_insights=trend_insights,
            visual_concept=visual_concept,
            city=req.city,
            state=req.state,
        )
        caption_data = generate_json(prompt_cap, use_search=False)
        tokens_used = 800  # approximate; Gemini SDK doesn't always expose this easily
    except Exception as e:
        logger.error("Caption generation failed: %s", e)
        caption_data = {
            "post_text": f"Conteúdo especial para você sobre {strategy.get('selected_theme', req.niche)}.",
            "cta": "Manda uma DM! 💬",
            "hashtags": [f"#{req.niche.replace(' ', '')}", "#brasil", "#dica"],
            "suggested_format": "feed_post",
            "strategic_justification": strategy.get("why_now", ""),
        }

    yield _progress("caption", "complete", "Legenda pronta!") + "\n"

    # ── Stage 6: Assemble Final Response ──────────────────────────────────────
    gap_analysis = {
        "selection_mode": "gap_first" if competitor_insights.get("content_gaps") else "trend_fallback",
        "primary_gap_theme": (competitor_insights.get("content_gaps") or [""])[0],
        "why_now_summary": strategy.get("why_now", ""),
        "competitors_considered": competitor_insights.get("competitors_analyzed", []),
        "key_signals": {
            "gap_strength": 0.85 if competitor_insights.get("confidence") == "high" else 0.6,
            "trend_momentum": 0.8 if trend_insights.get("engagement_forecast") == "high" else 0.55,
            "brand_fit": 0.9,
        },
        "confidence_band": strategy.get("confidence_band", "medium"),
        "selected_theme": strategy.get("selected_theme", ""),
    }

    final = FinalResponse(
        post_text=caption_data.get("post_text", ""),
        cta=caption_data.get("cta", ""),
        hashtags=caption_data.get("hashtags", []),
        suggested_format=caption_data.get("suggested_format", "feed_post"),
        strategic_justification=caption_data.get(
            "strategic_justification", strategy.get("why_now", "")
        ),
        tokens_used=tokens_used,
        image_url=image_url,
        image_prompt=img_prompt,
        competitor_gap_analysis=gap_analysis,
    )

    # This is the line that Go will collect as the final response JSON
    yield final.model_dump_json(exclude_none=True) + "\n"
