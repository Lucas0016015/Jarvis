"""Voice Pipeline — Groq STT + Agent + Piper TTS.

POST /api/voice (multipart/form-data)
    1. Audio blob from browser (webm/opus) → Groq STT (acepta webm/mp3/mp4/wav/opus)
    2. Groq API — transcript (STT)
    3. Agent graph — reply text
    4. Piper ONNX — WAV bytes
    5. base64 encode — JSON response

POST /api/voice/tts
    { text } — Piper ONNX — { audio_base64 }
"""
import io
import base64
from functools import lru_cache

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from loguru import logger

from backend.config import settings
from backend.models.chat import TTSRequest, TTSResponse, VoicePipelineResponse
from backend.api.dependencies import get_jarvis_graph

router = APIRouter()


# Module A: Groq STT Transcription (browser sends webm/opus/mp4)

async def _transcribe(audio_bytes: bytes) -> str:
    """Transcribe audio using Groq Whisper. Accepts webm/mp3/mp4/wav/opus."""
    if not settings.groq_api_key:
        raise ValueError("GROQ_API_KEY no configurada. El STT no funciona sin ella.")
    from groq import Groq
    client = Groq(api_key=settings.groq_api_key)
    response = client.audio.transcriptions.create(
        model=settings.groq_stt_model,
        file=("audio.webm", io.BytesIO(audio_bytes), "audio/webm"),
        language=None,
    )
    return response.text


# Module B: Piper TTS (delegates to PiperTTSService)

@lru_cache(maxsize=1)
def _get_tts():
    """Singleton TextToSpeechService -- model loaded once per process."""
    from backend.services.tts_service import TextToSpeechService
    svc = TextToSpeechService()
    try:
        svc._init_voice()
    except Exception as e:
        logger.warning(f"Piper TTS no inicializo: {e}. La voz no funcionara.")
    return svc


def _synthesize_base64(text: str) -> str:
    """Synthesize text -- base64 WAV using PiperTTSService."""
    tts = _get_tts()
    try:
        wav = tts.synthesize(text)
        return base64.b64encode(wav).decode("ascii")
    except Exception as e:
        logger.error(f"TTS synthesis fallo: {e}")
        raise


# Module C: Agent Chat

async def _chat(transcript: str, session_id: str = "") -> str:
    """Invoke agent graph and return AI reply text."""
    from langchain_core.messages import HumanMessage
    graph = get_jarvis_graph()
    config = {"configurable": {"thread_id": session_id or "voice-session"}}
    state = await graph.ainvoke(
        {"messages": [HumanMessage(content=transcript)],
         "session_id": session_id, "persona": "profesional"},
        config=config,
    )
    return state["messages"][-1].content


# Endpoint: POST /api/voice -- Full Voice Pipeline

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
        response_text = await _chat(transcript, session_id)
        audio_b64 = _synthesize_base64(response_text)
        return VoicePipelineResponse(
            transcript=transcript, response_text=response_text,
            audio_base64=audio_b64, session_id=session_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        import traceback
        logger.error(f"Voice pipeline error: {e}")
        logger.error(f"Voice pipeline traceback:\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))


# Endpoint: POST /api/voice/tts -- Standalone TTS

@router.post("/tts", response_model=TTSResponse)
async def text_to_speech(request: TTSRequest):
    if not request.text.strip():
        raise HTTPException(status_code=400, detail="Text is required")
    try:
        return TTSResponse(audio_base64=_synthesize_base64(request.text))
    except Exception as e:
        logger.error(f"TTS error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
