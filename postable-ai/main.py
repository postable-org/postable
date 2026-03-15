"""
Postable AI Service — FastAPI app.

Endpoint: POST /generate
Input:    GenerateRequest JSON
Output:   Streaming plain-text, one JSON line per stage update.
          The LAST line is the complete FinalResponse JSON.

The Go backend reads each line and forwards it as:
  data: <line>\n\n
So the frontend receives SSE events from the Go layer.
"""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from models import GenerateRequest
import pipeline

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Postable AI Service starting up")
    # Validate required env vars at startup
    if not os.environ.get("GEMINI_API_KEY"):
        logger.warning(
            "GEMINI_API_KEY not set — generation will fail. "
            "Set it in postable-ai/.env"
        )
    if not os.environ.get("NANO_BANANA_API_KEY"):
        logger.warning(
            "NANO_BANANA_API_KEY not set — image generation will be skipped."
        )
    yield
    logger.info("Postable AI Service shutting down")


app = FastAPI(title="Postable AI Service", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "postable-ai"}


@app.post("/generate")
async def generate(req: GenerateRequest, request: Request):
    """
    Main generation endpoint.
    Streams line-by-line JSON: progress events + final response.
    """
    logger.info(
        "generate: brand=%s niche=%s state=%s competitors=%d",
        req.id,
        req.niche,
        req.state,
        len(req.competitor_snapshots),
    )

    async def stream():
        try:
            async for line in pipeline.run(req):
                yield line
        except Exception as e:
            logger.error("Pipeline error: %s", e)
            import json
            yield json.dumps({"type": "error", "message": str(e)}) + "\n"

    return StreamingResponse(
        stream(),
        media_type="text/plain",
        headers={
            "X-Accel-Buffering": "no",  # disable nginx buffering
            "Cache-Control": "no-cache",
        },
    )
