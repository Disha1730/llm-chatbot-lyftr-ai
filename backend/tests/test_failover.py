import pytest


@pytest.mark.asyncio
async def test_failover_single_key_429(client):
    headers = {"X-Simulate-Failure": "key_1=429"}
    payload = {"session_id": "s-failover-1", "message": "Trigger failover"}
    response = await client.post("/chat", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()

    assert data["metadata"]["key_id"] == "key_2"
    assert data["metadata"]["fallback_attempts"] == 1
    assert data["metadata"]["resolution_source"] == "LIVE_INFERENCE"


@pytest.mark.asyncio
async def test_failover_single_key_500(client):
    headers = {"X-Simulate-Failure": "key_1=500"}
    payload = {"session_id": "s-failover-2", "message": "Trigger 500 failover"}
    response = await client.post("/chat", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()

    assert data["metadata"]["key_id"] == "key_2"
    assert data["metadata"]["fallback_attempts"] == 1


@pytest.mark.asyncio
async def test_all_keys_exhausted_returns_503(client):
    headers = {"X-Simulate-Failure": "*=429"}
    payload = {"session_id": "s-exhaust-1", "message": "All keys must fail"}
    response = await client.post("/chat", json=payload, headers=headers)
    
    assert response.status_code == 503
    data = response.json()
    assert data == {"detail": "all providers unavailable"}

    # Verify nothing was added to SQLite history
    hist = await client.get("/sessions/s-exhaust-1/messages")
    assert hist.status_code == 404
