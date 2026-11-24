import pytest


@pytest.mark.asyncio
async def test_cache_hit_behavior(client):
    msg = "What is the capital of France?"

    # Request 1 in session 1: LIVE_INFERENCE
    res1 = await client.post("/chat", json={"session_id": "session-1", "message": msg})
    assert res1.status_code == 200
    data1 = res1.json()
    assert data1["metadata"]["resolution_source"] == "LIVE_INFERENCE"
    assert data1["metadata"]["key_id"] == "key_1"
    assert data1["metadata"]["fallback_attempts"] == 0

    # Request 2 in NEW session 2 with identical prompt: LLM_CACHE
    res2 = await client.post("/chat", json={"session_id": "session-2", "message": msg})
    assert res2.status_code == 200
    data2 = res2.json()

    # Rule checks
    assert data2["reply"] == data1["reply"]
    assert data2["metadata"]["resolution_source"] == "LLM_CACHE"
    assert data2["metadata"]["key_id"] is None
    assert data2["metadata"]["fallback_attempts"] == 0
    assert data2["metadata"]["input_tokens"] == data1["metadata"]["input_tokens"]
    assert data2["metadata"]["output_tokens"] == data1["metadata"]["output_tokens"]


@pytest.mark.asyncio
async def test_cache_miss_on_different_message(client):
    res1 = await client.post("/chat", json={"session_id": "session-1", "message": "First message"})
    assert res1.status_code == 200
    assert res1.json()["metadata"]["resolution_source"] == "LIVE_INFERENCE"

    # Different message in same session
    res2 = await client.post("/chat", json={"session_id": "session-1", "message": "Second message"})
    assert res2.status_code == 200
    assert res2.json()["metadata"]["resolution_source"] == "LIVE_INFERENCE"
