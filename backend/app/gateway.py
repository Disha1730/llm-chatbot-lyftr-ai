import time
import logging
from typing import Dict, List, Optional, Tuple, Any
import litellm
from app.config import settings

logger = logging.getLogger("gateway")


class AllProvidersUnavailableException(Exception):
    """Raised when every key in the pool fails (rate limit, quota, 5xx, or simulated)."""
    pass


def get_key_pool() -> List[Dict[str, str]]:
    keys = settings.api_key_list
    if not keys:
        # Fallback to at least 2 mock keys if none provided
        keys = ["mock-key-1", "mock-key-2"]
    return [{"id": f"key_{i+1}", "api_key": key} for i, key in enumerate(keys)]


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
    target_model = model or settings.LLM_MODEL
    key_pool = get_key_pool()
    sim_rules = parse_simulation_header(simulation_header)

    fallback_attempts = 0

    for key_info in key_pool:
        key_id = key_info["id"]
        api_key = key_info["api_key"]

        # Check for simulated failure
        simulated_status = None
        if "*" in sim_rules:
            simulated_status = sim_rules["*"]
        elif key_id in sim_rules:
            simulated_status = sim_rules[key_id]

        if simulated_status is not None:
            logger.info(f"Simulating failure {simulated_status} for {key_id}")
            fallback_attempts += 1
            continue

        # Real inference attempt
        try:
            # If the key is a mock key (e.g. during offline test), provide deterministic mock response
            if api_key.startswith("mock-") or api_key == "test-key":
                # Simulated successful response for mock/offline testing
                reply_text = f"Mock response from {key_id} using {target_model}."
                input_tokens = sum(len(m.get("content", "").split()) for m in messages) + 10
                output_tokens = len(reply_text.split())
                return reply_text, input_tokens, output_tokens, key_id, fallback_attempts

            # Real LiteLLM call
            response = await litellm.acompletion(
                model=target_model,
                messages=messages,
                api_key=api_key,
                temperature=0.7
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

            return reply_text, input_tokens, output_tokens, key_id, fallback_attempts

        except Exception as e:
            logger.warning(f"Key {key_id} failed: {type(e).__name__}: {str(e)}")
            fallback_attempts += 1
            # Continue to next key in the pool
            continue

    # If all keys failed
    logger.error("All providers exhausted.")
    raise AllProvidersUnavailableException("all providers unavailable")
