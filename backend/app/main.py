import time
from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI, Header, HTTPException, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import (
    init_db,
    check_db_health,
    save_message,
    get_session_history_for_llm,
    get_session_messages
)
from app.schemas import (
    HealthResponse,
    ChatRequest,
    ChatResponse,
    AssistantMetadata,
    SessionHistoryResponse,
    SessionMessage,
    AssistantStoredMetadata
)
from app.cache import response_cache
from app.gateway import (
    execute_completion,
    get_key_pool,
    AllProvidersUnavailableException
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize SQLite database and tables on startup
    await init_db()
    yield


app = FastAPI(
    title="Lyftr AI Chatbot Gateway",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception Handlers ensuring all errors return JSON with "detail"
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": jsonable_encoder(exc.errors())}
    )


@app.exception_handler(AllProvidersUnavailableException)
async def providers_unavailable_handler(request: Request, exc: AllProvidersUnavailableException):
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={"detail": "all providers unavailable"}
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    # Never return an HTML error or stack trace
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"}
    )


# Root endpoint for platform health checks and direct browser visits
@app.get("/")
async def root():
    return {
        "status": "ok",
        "service": "Lyftr AI Chatbot Gateway",
        "health": "/health",
        "docs": "/docs"
    }


# 1. GET /health
@app.get("/health", response_model=HealthResponse)
async def health_check():
    db_ok = await check_db_health()
    if not db_ok:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable"
        )
    keys = get_key_pool()
    return HealthResponse(
        status="ok",
        keys_configured=len(keys),
        cache_enabled=response_cache.enabled
    )


# 2. POST /chat
@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(
    req: ChatRequest,
    x_simulate_failure: Optional[str] = Header(None, alias="X-Simulate-Failure")
):
    start_time = time.perf_counter()

    # Retrieve existing message history for this session from SQLite
    history = await get_session_history_for_llm(req.session_id)

    # Build prompt messages list: [system, ...history, user_message]
    system_prompt = req.system_prompt if req.system_prompt is not None else settings.DEFAULT_SYSTEM_PROMPT
    full_messages = [{"role": "system", "content": system_prompt}]
    full_messages.extend(history)
    full_messages.append({"role": "user", "content": req.message})

    # Check response cache
    cached = response_cache.get(model=settings.LLM_MODEL, messages=full_messages)

    if cached:
        elapsed_ms = max(1, int((time.perf_counter() - start_time) * 1000))
        reply = cached["reply"]
        input_tokens = cached["input_tokens"]
        output_tokens = cached["output_tokens"]
        metadata = AssistantMetadata(
            resolution_source="LLM_CACHE",
            model=cached.get("model", settings.LLM_MODEL),
            latency_ms=elapsed_ms,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            key_id=None,
            fallback_attempts=0
        )

        # Save to SQLite history
        await save_message(req.session_id, "user", req.message)
        await save_message(
            req.session_id,
            "assistant",
            reply,
            metadata={
                "resolution_source": "LLM_CACHE",
                "input_tokens": input_tokens,
                "output_tokens": output_tokens
            }
        )

        return ChatResponse(
            session_id=req.session_id,
            reply=reply,
            metadata=metadata
        )

    # Cache miss: execute live inference through key pool with fallback
    reply, input_tokens, output_tokens, key_id, fallback_attempts = await execute_completion(
        messages=full_messages,
        model=settings.LLM_MODEL,
        simulation_header=x_simulate_failure
    )

    elapsed_ms = max(1, int((time.perf_counter() - start_time) * 1000))

    # Populate cache for future identical requests
    response_cache.set(
        model=settings.LLM_MODEL,
        messages=full_messages,
        reply=reply,
        input_tokens=input_tokens,
        output_tokens=output_tokens
    )

    metadata = AssistantMetadata(
        resolution_source="LIVE_INFERENCE",
        model=settings.LLM_MODEL,
        latency_ms=elapsed_ms,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        key_id=key_id,
        fallback_attempts=fallback_attempts
    )

    # Save to SQLite history only after successful inference
    await save_message(req.session_id, "user", req.message)
    await save_message(
        req.session_id,
        "assistant",
        reply,
        metadata={
            "resolution_source": "LIVE_INFERENCE",
            "input_tokens": input_tokens,
            "output_tokens": output_tokens
        }
    )

    return ChatResponse(
        session_id=req.session_id,
        reply=reply,
        metadata=metadata
    )


# 3. GET /sessions/{session_id}/messages
@app.get("/sessions/{session_id}/messages", response_model=SessionHistoryResponse)
async def get_messages_endpoint(session_id: str):
    msgs = await get_session_messages(session_id)
    if msgs is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="session not found"
        )

    formatted_messages = []
    for m in msgs:
        meta = None
        if m.get("metadata"):
            meta = AssistantStoredMetadata(
                resolution_source=m["metadata"]["resolution_source"],
                input_tokens=m["metadata"]["input_tokens"],
                output_tokens=m["metadata"]["output_tokens"]
            )
        formatted_messages.append(SessionMessage(
            role=m["role"],
            content=m["content"],
            metadata=meta
        ))

    return SessionHistoryResponse(
        session_id=session_id,
        messages=formatted_messages
    )
