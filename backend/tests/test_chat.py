import pytest


@pytest.mark.asyncio
async def test_chat_success_live_inference(client):
    payload = {
        "session_id": "s-test-1",
        "message": "What is the capital of France?"
    }
    response = await client.post("/chat", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["session_id"] == "s-test-1"
    assert "reply" in data and len(data["reply"]) > 0
    
    meta = data["metadata"]
    assert meta["resolution_source"] == "LIVE_INFERENCE"
    assert meta["model"] == "gemini/gemini-2.0-flash"
    assert meta["latency_ms"] >= 0
    assert meta["input_tokens"] > 0
    assert meta["output_tokens"] > 0
    assert meta["key_id"] == "key_1"
    assert meta["fallback_attempts"] == 0


@pytest.mark.asyncio
async def test_chat_validation_missing_fields(client):
    # Missing session_id
    res1 = await client.post("/chat", json={"message": "hello"})
    assert res1.status_code == 422
    assert "detail" in res1.json()

    # Empty message
    res2 = await client.post("/chat", json={"session_id": "s-1", "message": "   "})
    assert res2.status_code == 422
    assert "detail" in res2.json()

    # Message over 4000 characters
    long_msg = "a" * 4001
    res3 = await client.post("/chat", json={"session_id": "s-1", "message": long_msg})
    assert res3.status_code == 422
    assert "detail" in res3.json()


@pytest.mark.asyncio
async def test_failed_request_not_added_to_history(client):
    # Trigger 422
    await client.post("/chat", json={"session_id": "s-invalid", "message": "   "})
    
    # Check session history
    res = await client.get("/sessions/s-invalid/messages")
    assert res.status_code == 404
