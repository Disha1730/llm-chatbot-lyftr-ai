import hashlib
import json
import time
from typing import Dict, List, Optional, Tuple, Any
import litellm
from litellm.caching.caching import Cache

# Enable LiteLLM's built-in cache
try:
    litellm.cache = Cache(type="memory")
except Exception:
    pass


class LLMResponseCache:
    """
    Deterministic response cache adhering strictly to the assignment rules:
    - Cache key: model + full message list sent to LLM (system prompt + history + new message)
    - Returns identical reply text
    - Preserves per-request token usage (input_tokens and output_tokens)
    """

    def __init__(self):
        self._store: Dict[str, Dict[str, Any]] = {}
        self.enabled: bool = True

    @staticmethod
    def compute_key(model: str, messages: List[Dict[str, str]]) -> str:
        # Standardize message objects
        normalized = [
            {"role": str(m.get("role", "")).strip(), "content": str(m.get("content", "")).strip()}
            for m in messages
        ]
        payload = f"{model.strip()}||{json.dumps(normalized, sort_keys=True)}"
        return hashlib.sha256(payload.encode("utf-8")).hexdigest()

    def get(self, model: str, messages: List[Dict[str, str]]) -> Optional[Dict[str, Any]]:
        if not self.enabled:
            return None
        key = self.compute_key(model, messages)
        entry = self._store.get(key)
        if entry:
            return {
                "reply": entry["reply"],
                "input_tokens": entry["input_tokens"],
                "output_tokens": entry["output_tokens"],
                "model": entry.get("model", model)
            }
        return None

    def set(
        self,
        model: str,
        messages: List[Dict[str, str]],
        reply: str,
        input_tokens: int,
        output_tokens: int
    ) -> None:
        if not self.enabled:
            return
        key = self.compute_key(model, messages)
        self._store[key] = {
            "reply": reply,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "model": model,
            "timestamp": time.time()
        }

    def clear(self) -> None:
        self._store.clear()


response_cache = LLMResponseCache()
