"""Voice Pipeline — Groq STT + Direct LLM + Piper TTS.

POST /api/voice (multipart/form-data)
    1. Audio blob from browser (webm/opus) → Groq STT
    2. Direct LLM call (no agent graph, no tools — fast)
    3. Piper ONNX → WAV bytes (runs in thread pool)
    4. base64 encode → JSON response

POST /api/voice/tts
    { text } — Piper ONNX → { audio_base64 }
"""
import io
import base64
import asyncio
from functools import lru_cache

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from loguru import logger

from backend.config import settings
from backend.models.chat import TTSRequest, TTSResponse, VoicePipelineResponse

router = APIRouter()

# ── Voice system prompt (lightweight, no tools) ──────────────────────────

VOICE_SYSTEM_PROMPT = (
    "Eres JARVIS, un asistente de voz. Responde de forma CONCISA y NATURAL, "
    "como si estuvieras hablando. Máximo 2-3 oraciones. Nada de markdown, "
    "listas, ni código. Solo texto plano para ser leído en voz alta. "
    "Sé amable y directo. Responde en español."
)

# ── Module A: Groq STT ──────────────────────────────────────────────────

async def _transcribe(audio_bytes: bytes) -> str:
    if not settings.groq_api_key:
        raise ValueError("GROQ_API_KEY no configurada.")
    from groq import Groq
    client = Groq(api_key=settings.groq_api_key)
    response = client.audio.transcriptions.create(
        model=settings.groq_stt_model,
        file=("audio.webm", io.BytesIO(audio_bytes), "audio/webm"),
        language=None,
    )
    return response.text

# ── Module B: Direct LLM (bypass graph, way faster) ─────────────────────

async def _chat_lightweight(transcript: str) -> str:
    from langchain_core.messages import SystemMessage, HumanMessage
    from backend.llm import get_llm
    llm = get_llm()
    messages = [
        SystemMessage(content=VOICE_SYSTEM_PROMPT),
        HumanMessage(content=transcript),
    ]
    try:
        response = await llm.ainvoke(messages)
    except Exception as e:
        logger.warning(f"LLM ainvoke fallo, probando invoke sincrono: {e}")
        response = await asyncio.get_event_loop().run_in_executor(
            None, llm.invoke, messages
        )
    return response.content

# ── Module C: TTS in thread pool ────────────────────────────────────────

@lru_cache(maxsize=1)
def _get_tts():
    from backend.services.tts_service import TextToSpeechService
    svc = TextToSpeechService()
    try:
        svc._init_voice()
    except Exception as e:
        logger.warning(f"Piper TTS no inicializo: {e}")
    return svc


def _synthesize_blocking(text: str) -> str:
    """Blocking synthesis — designed to run in executor."""
    tts = _get_tts()
    wav = tts.synthesize(text)
    return base64.b64encode(wav).decode("ascii")


async def _synthesize_base64(text: str) -> str:
    """Run TTS in thread pool so it doesn't block the event loop."""
    return await asyncio.get_event_loop().run_in_executor(
        None, _synthesize_blocking, text
    )

# ── Endpoint: POST /api/voice ───────────────────────────────────────────

@router.post("", response_model=VoicePipelineResponse)
async def voice_pipeline(
    audio: UploadFile = File(...),
    session_id: str = Form(default=""),
):
    if not audio.filename:
        raise HTTPException(status_code=400, detail="No audio file provided")
    try:
        content = await audio.read()

        transcript = await _transcribe(content)
        logger.info(f"Voice STT transcript: {transcript[:100]}")

        response_text = await _chat_lightweight(transcript)
        logger.info(f"Voice LLM response: {response_text[:100]}")

        audio_b64 = await _synthesize_base64(response_text)

        return VoicePipelineResponse(
            transcript=transcript,
            response_text=response_text,
            audio_base64=audio_b64,
            session_id=session_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        logger.error(f"Voice pipeline error: {e}")
        logger.error(f"Voice pipeline traceback:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

# ── Endpoint: POST /api/voice/tts ───────────────────────────────────────

@router.post("/tts", response_model=TTSResponse)
async def text_to_speech(request: TTSRequest):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text is required")
    try:
        audio_b64 = await _synthesize_base64(request.text)
        return TTSResponse(audio_base64=audio_b64)
    except Exception as e:
        logger.error(f"TTS error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
