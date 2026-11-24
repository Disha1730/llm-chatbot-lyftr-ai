import time
import logging
from typing import Dict, List, Optional, Tuple, Any
import litellm
from app.config import settings

logger = logging.getLogger("gateway")


class AllProvidersUnavailableException(Exception):
    """Raised when every key in the pool fails (rate limit, quota, 5xx, or simulated)."""
    def __init__(self, message: str = "all providers unavailable", last_error: str = ""):
        super().__init__(message)
        self.last_error = last_error


def get_key_pool() -> List[Dict[str, str]]:
    keys = settings.api_key_list
    if not keys:
        # Fallback to at least 2 mock keys if none provided
        keys = ["mock-key-1", "mock-key-2"]
    # Strip whitespace, quotes, and newlines from keys
    cleaned_keys = [k.strip().strip("'").strip('"') for k in keys if k.strip()]
    return [{"id": f"key_{i+1}", "api_key": key} for i, key in enumerate(cleaned_keys)]


def parse_simulation_header(header: Optional[str]) -> Dict[str, int]:
    """
    Parses comma-separated <key_id>=<status> pairs, e.g. 'key_1=429,key_2=500' or '*=429'.
    Allowed statuses: 429, 500, 502, 503.
    """
    if not header or not settings.ENABLE_FAILURE_SIMULATION:
        return {}
    
    rules = {}
    valid_statuses = {429, 500, 502, 503}
    parts = [p.strip() for p in header.split(",") if p.strip()]
    for part in parts:
        if "=" in part:
            k, v = part.split("=", 1)
            k = k.strip()
            try:
                status_code = int(v.strip())
                if status_code in valid_statuses:
                    rules[k] = status_code
            except ValueError:
                pass
    return rules


def estimate_tokens(text: str) -> int:
    """Rough estimation if token usage is missing from provider response."""
    words = text.split()
    return max(1, int(len(words) * 1.33))


def is_placeholder_key(api_key: str) -> bool:
    """Determines whether a key is a mock, test, or placeholder string."""
    k = api_key.lower().strip()
    return (
        k.startswith("mock-")
        or k.startswith("test")
        or k.startswith("placeholder")
        or "placeholder" in k
        or "your-" in k
        or "example" in k
        or k in {"key1", "key2", "key_1", "key_2", "dummy"}
        or len(k) < 15
    )


def resolve_model_for_key(api_key: str, default_model: str) -> str:
    """Auto-detect provider model if default model does not match the key prefix."""
    k = api_key.strip().strip("'").strip('"')
    if k.startswith("gsk_"):
        return "groq/llama-3.3-70b-versatile"
    elif k.startswith("AQ") or k.startswith("AIzaSy"):
        return "gemini/gemini-3.8-flash"
    elif k.startswith("sk-ant-"):
        return "claude-3-5-haiku-20241022"
    elif k.startswith("sk-or-"):
        return "openrouter/auto"
    elif k.startswith("sk-") and not k.startswith("sk-ant-") and not k.startswith("sk-or-"):
        return "gpt-4o-mini"
    return default_model


async def execute_completion(
    messages: List[Dict[str, str]],
    model: Optional[str] = None,
    simulation_header: Optional[str] = None
) -> Tuple[str, int, int, str, int]:
    """
    Executes completion across the key pool with automatic fallback.
    Returns: (reply, input_tokens, output_tokens, winning_key_id, fallback_attempts)
    Raises: AllProvidersUnavailableException if all keys fail.
    """
    base_model = model or settings.LLM_MODEL
    key_pool = get_key_pool()
    sim_rules = parse_simulation_header(simulation_header)

    fallback_attempts = 0
    last_error_msg = ""

    for key_info in key_pool:
        key_id = key_info["id"]
        api_key = key_info["api_key"]
        target_model = resolve_model_for_key(api_key, base_model)

        # Check for simulated failure
        simulated_status = None
        if "*" in sim_rules:
            simulated_status = sim_rules["*"]
        elif key_id in sim_rules:
            simulated_status = sim_rules[key_id]

        if simulated_status is not None:
            logger.info(f"Simulating failure {simulated_status} for {key_id}")
            print(f"[GATEWAY] Simulating failure {simulated_status} for {key_id}", flush=True)
            fallback_attempts += 1
            continue

        # Check for mock / placeholder key
        if is_placeholder_key(api_key):
            print(f"[GATEWAY] Key {key_id} is a mock/placeholder key. Returning simulated response.", flush=True)
            user_msg = messages[-1].get("content", "") if messages else ""
            reply_text = f"Response from {key_id} ({target_model}): Received '{user_msg}'."
            input_tokens = sum(len(m.get("content", "").split()) for m in messages) + 12
            output_tokens = len(reply_text.split())
            return reply_text, input_tokens, output_tokens, key_id, fallback_attempts

        # Real inference attempt with LiteLLM
        try:
            print(f"[GATEWAY] Attempting completion with {key_id} on {target_model}...", flush=True)
            response = await litellm.acompletion(
                model=target_model,
                messages=messages,
                api_key=api_key,
                temperature=0.7,
                timeout=15,
                num_retries=0
            )

            reply_text = response.choices[0].message.content or ""
            usage = getattr(response, "usage", None)
            
            input_tokens = getattr(usage, "prompt_tokens", None) if usage else None
            output_tokens = getattr(usage, "completion_tokens", None) if usage else None

            if input_tokens is None:
                full_input = " ".join(m.get("content", "") for m in messages)
                input_tokens = estimate_tokens(full_input)

            if output_tokens is None:
                output_tokens = estimate_tokens(reply_text)

            print(f"[GATEWAY] Key {key_id} succeeded on {target_model}.", flush=True)
            return reply_text, input_tokens, output_tokens, key_id, fallback_attempts

        except Exception as e:
            err_msg = f"Key {key_id} failed: {type(e).__name__}: {str(e)}"
            logger.warning(err_msg)
            print(f"[GATEWAY] {err_msg}", flush=True)
            last_error_msg = f"{type(e).__name__}: {str(e)}"
            fallback_attempts += 1
            # Continue to next key in the pool
            continue

    # If all keys failed
    logger.error("All providers exhausted.")
    print(f"[GATEWAY] All providers exhausted. Last error: {last_error_msg}", flush=True)
    raise AllProvidersUnavailableException("all providers unavailable", last_error=last_error_msg)
