import pytest
import litellm
from app.gateway import resolve_model_for_key, get_key_pool, is_placeholder_key


def test_resolve_model_for_gemini_key():
    # When user specifies gemini-3.5-flash-lite, it should respect it
    assert resolve_model_for_key("AIzaSyTestKey123456789", "gemini/gemini-3.5-flash-lite") == "gemini/gemini-3.5-flash-lite"
    assert resolve_model_for_key("AQTestKey123456789", "gemini/gemini-3.8-flash") == "gemini/gemini-3.8-flash"
    
    # If default model is non-gemini, fallback to gemini model
    assert resolve_model_for_key("AIzaSyTestKey123456789", "gpt-4o-mini") == "gemini/gemini-2.5-flash"


def test_resolve_model_for_other_providers():
    assert resolve_model_for_key("gsk_TestKey123456789", "groq/llama-3.3-70b-versatile") == "groq/llama-3.3-70b-versatile"
    assert resolve_model_for_key("sk-ant-TestKey123456789", "claude-3-5-haiku-20241022") == "claude-3-5-haiku-20241022"
    assert resolve_model_for_key("sk-TestKey123456789", "gpt-4o-mini") == "gpt-4o-mini"


def test_litellm_drop_params_is_enabled():
    assert litellm.drop_params is True
